import fs from 'node:fs';
import path from 'node:path';
import { del } from '@vercel/blob';

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

  const isAuthorized = await verifyFirebaseToken(request.headers.get('authorization'));
  if (!isAuthorized) {
    return Response.json({ error: 'Unauthorized delete request.' }, { status: 401 });
  }

  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url || !url.includes('.blob.vercel-storage.com')) {
      return Response.json({ error: 'Invalid Vercel Blob URL.' }, { status: 400 });
    }

    await del(url);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to delete blob.' },
      { status: 500 }
    );
  }
}
