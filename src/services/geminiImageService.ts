import { auth } from './firebase';

export interface GenerateGeminiImageParams {
  mode: 'create' | 'edit';
  prompt: string;
  sourceImageUrl?: string | null;
  aspectRatio?: string;
  imageSize?: string;
  userApiKey?: string | null;
}

export interface GenerateGeminiImageResult {
  imageDataUrl: string;
  mimeType: string;
  text?: string;
}

export async function generateOrEditGeminiImage(
  params: GenerateGeminiImageParams
): Promise<GenerateGeminiImageResult> {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';

  const res = await fetch('/api/gemini-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({
      mode: params.mode,
      prompt: params.prompt,
      sourceImageUrl: params.sourceImageUrl || undefined,
      aspectRatio: params.aspectRatio || '16:9',
      imageSize: params.imageSize || '1K',
      userApiKey: params.userApiKey || undefined,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    imageDataUrl?: string;
    mimeType?: string;
    text?: string;
    error?: string;
  };

  if (!res.ok || !data.imageDataUrl) {
    throw new Error(data.error || `Image generation failed (${res.status}).`);
  }

  return {
    imageDataUrl: data.imageDataUrl,
    mimeType: data.mimeType || 'image/png',
    text: data.text,
  };
}

export function dataUrlToImageFile(dataUrl: string, baseName = 'generated-scene'): File {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid generated image data.');
  }
  const mimeType = match[1] || 'image/png';
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const ext =
    mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType === 'image/webp'
      ? 'webp'
      : 'png';
  const safeBase =
    baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'generated-image';

  return new File([bytes], `${safeBase}-${Date.now()}.${ext}`, { type: mimeType });
}
