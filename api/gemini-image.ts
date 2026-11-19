import { GoogleGenAI, Part } from '@google/genai';
import {
  getRequestHeader,
  readJsonBody,
  sendJson,
  type ServerlessRequest,
  type ServerlessResponse,
  verifyFirebaseBearerToken,
} from '../lib/librarySearch.js';

const VALID_ASPECT_RATIOS = new Set([
  '1:1',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '1:4',
  '1:8',
  '4:1',
  '8:1',
]);

const VALID_IMAGE_SIZES = new Set(['1K', '2K', '4K']);

async function resolveSourceImage(
  sourceImageUrl?: string,
  sourceBase64?: string,
  sourceMimeType?: string
): Promise<{ data: string; mimeType: string }> {
  if (typeof sourceBase64 === 'string' && sourceBase64.trim()) {
    const dataUrlMatch = sourceBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      return {
        mimeType: dataUrlMatch[1],
        data: dataUrlMatch[2],
      };
    }
    return {
      mimeType: sourceMimeType || 'image/png',
      data: sourceBase64.trim(),
    };
  }

  if (typeof sourceImageUrl === 'string' && sourceImageUrl.trim()) {
    const trimmedUrl = sourceImageUrl.trim();
    if (trimmedUrl.startsWith('data:')) {
      const match = trimmedUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error('Invalid source image data URL.');
      return { mimeType: match[1], data: match[2] };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      throw new Error('Source image URL must be a valid HTTPS URL.');
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Source image URL must use HTTPS.');
    }

    const imgRes = await fetch(parsedUrl.toString());
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch source image (${imgRes.status}).`);
    }
    const contentType = (imgRes.headers.get('content-type') || 'image/png').split(';')[0].trim();
    const arrayBuf = await imgRes.arrayBuffer();
    return {
      mimeType: contentType.startsWith('image/') ? contentType : 'image/png',
      data: Buffer.from(arrayBuf).toString('base64'),
    };
  }

  throw new Error('Source image is required when editing an image.');
}

function getErrorStatusAndMessage(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || 'Image generation failed');
  let status = 500;
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status?: unknown }).status === 'number') {
    const s = (err as { status: number }).status;
    if (s >= 400 && s < 600) status = s;
  } else if (/API_KEY_INVALID|API key not valid|invalid.*key/i.test(rawMessage)) {
    status = 400;
  } else if (/PERMISSION_DENIED|403/i.test(rawMessage)) {
    status = 403;
  } else if (/NOT_FOUND|404/i.test(rawMessage)) {
    status = 404;
  } else if (/RESOURCE_EXHAUSTED|quota|429/i.test(rawMessage)) {
    status = 429;
  }
  return { status, message: rawMessage };
}

export default async function handler(
  req: ServerlessRequest,
  res: ServerlessResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const isAuthorized = await verifyFirebaseBearerToken(
      getRequestHeader(req, 'authorization'),
      getRequestHeader(req, 'origin') || getRequestHeader(req, 'referer')
    );
    if (!isAuthorized) {
      sendJson(res, 401, { error: 'Authentication required to generate images.' });
      return;
    }

    let body: {
      mode?: 'create' | 'edit';
      prompt?: string;
      sourceImageUrl?: string;
      sourceBase64?: string;
      sourceMimeType?: string;
      aspectRatio?: string;
      imageSize?: string;
      userApiKey?: string;
    };

    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON request body.' });
      return;
    }

    const resolvedApiKey =
      (typeof body.userApiKey === 'string' && body.userApiKey.trim()) ||
      process.env.GEMINI_API_KEY ||
      '';
    if (!resolvedApiKey) {
      sendJson(res, 400, {
        error: 'No Gemini API key configured. Please add your API key in the user menu.',
      });
      return;
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      sendJson(res, 400, { error: 'Please enter a text prompt.' });
      return;
    }

    const mode = body.mode === 'edit' ? 'edit' : 'create';
    const aspectRatio =
      typeof body.aspectRatio === 'string' && VALID_ASPECT_RATIOS.has(body.aspectRatio)
        ? body.aspectRatio
        : '16:9';
    const imageSize =
      typeof body.imageSize === 'string' && VALID_IMAGE_SIZES.has(body.imageSize)
        ? body.imageSize
        : '1K';

    const parts: Part[] = [];

    if (mode === 'edit') {
      const source = await resolveSourceImage(
        body.sourceImageUrl,
        body.sourceBase64,
        body.sourceMimeType
      );
      parts.push({
        inlineData: {
          data: source.data,
          mimeType: source.mimeType,
        },
      });
    }

    parts.push({ text: prompt });

    const ai = new GoogleGenAI({
      apiKey: resolvedApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    let imageBase64 = '';
    let mimeType = 'image/png';
    let responseText = '';

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/png';
        break;
      } else if (part.text) {
        responseText += part.text;
      }
    }

    if (!imageBase64) {
      sendJson(res, 422, {
        error: responseText || 'No image was returned by Gemini. Try refining your prompt.',
      });
      return;
    }

    sendJson(res, 200, {
      imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
      mimeType,
      text: responseText,
    });
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    sendJson(res, status, { error: message });
  }
}
