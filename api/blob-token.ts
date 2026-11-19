import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { verifyFirebaseBearerToken } from '../lib/librarySearch';

export async function GET(): Promise<Response> {
  return Response.json({ configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
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
    const isAuthorized = await verifyFirebaseBearerToken(
      request.headers.get('authorization'),
      request.headers.get('origin') || request.headers.get('referer')
    );
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
