import fs from 'node:fs';
import path from 'node:path';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

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

export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not configured on this server.' },
      { status: 503 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  if (body.type === 'blob.generate-client-token') {
    const isAuthorized = await verifyFirebaseToken(request.headers.get('authorization'));
    if (!isAuthorized) {
      return Response.json({ error: 'Unauthorized upload request.' }, { status: 401 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const isAllowedFolder =
          pathname.startsWith('images/') ||
          pathname.startsWith('maps/') ||
          pathname.startsWith('objects/');
        if (!isAllowedFolder) {
          throw new Error('Invalid upload folder path.');
        }

        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/svg+xml',
          ],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to authorize upload.' },
      { status: 400 }
    );
  }
}
