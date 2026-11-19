import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  getRequestHeader,
  readJsonBody,
  sendJson,
  type ServerlessRequest,
  type ServerlessResponse,
  verifyFirebaseBearerToken,
} from '../lib/librarySearch.js';

export default async function handler(
  req: ServerlessRequest,
  res: ServerlessResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, { configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      sendJson(res, 503, { error: 'BLOB_READ_WRITE_TOKEN is not configured on this server.' });
      return;
    }

    let body: HandleUploadBody;
    try {
      body = await readJsonBody<HandleUploadBody>(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON request body.' });
      return;
    }

    if (body?.type === 'blob.generate-client-token') {
      const isAuthorized = await verifyFirebaseBearerToken(
        getRequestHeader(req, 'authorization'),
        getRequestHeader(req, 'origin') || getRequestHeader(req, 'referer')
      );
      if (!isAuthorized) {
        sendJson(res, 401, { error: 'Unauthorized upload request.' });
        return;
      }
    }

    const jsonResponse = await handleUpload({
      body,
      request: req,
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

    sendJson(res, 200, jsonResponse);
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'Failed to authorize upload.',
    });
  }
}
