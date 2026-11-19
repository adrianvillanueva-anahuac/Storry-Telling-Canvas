import { del } from '@vercel/blob';
import { verifyFirebaseBearerToken } from '../lib/librarySearch';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not configured on this server.' },
      { status: 503 }
    );
  }

  const isAuthorized = await verifyFirebaseBearerToken(
    request.headers.get('authorization'),
    request.headers.get('origin') || request.headers.get('referer')
  );
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
