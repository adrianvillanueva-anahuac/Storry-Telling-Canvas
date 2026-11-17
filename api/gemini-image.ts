import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Part } from '@google/genai';

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

function getFirebaseApiKey(): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { apiKey?: string };
    if (parsed.apiKey) return parsed.apiKey;
  } catch {
    // fallback to environment variable if configured
  }
  return process.env.VITE_FIREBASE_API_KEY || '';
}

async function verifyFirebaseToken(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const idToken = authHeader.slice(7).trim();
  const apiKey = getFirebaseApiKey();
  if (!idToken || !apiKey) return false;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: Array<{ emailVerified?: boolean }> };
    return Boolean(data.users && data.users.length > 0 && data.users[0].emailVerified !== false);
  } catch {
    return false;
  }
}

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

export async function POST(request: Request): Promise<Response> {
  const isAuthorized = await verifyFirebaseToken(request.headers.get('authorization'));
  if (!isAuthorized) {
    return Response.json({ error: 'Authentication required to generate images.' }, { status: 401 });
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
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const resolvedApiKey =
    (typeof body.userApiKey === 'string' && body.userApiKey.trim()) ||
    process.env.GEMINI_API_KEY ||
    '';
  if (!resolvedApiKey) {
    return Response.json(
      { error: 'No Gemini API key configured. Please add your API key in the user menu.' },
      { status: 400 }
    );
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return Response.json({ error: 'Please enter a text prompt.' }, { status: 400 });
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

  try {
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
      return Response.json(
        { error: responseText || 'No image was returned by Gemini. Try refining your prompt.' },
        { status: 422 }
      );
    }

    return Response.json({
      imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
      mimeType,
      text: responseText,
    });
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    return Response.json({ error: message }, { status });
  }
}
