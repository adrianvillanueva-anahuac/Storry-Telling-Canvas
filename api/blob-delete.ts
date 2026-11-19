import { del } from '@vercel/blob';
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
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      sendJson(res, 503, { error: 'BLOB_READ_WRITE_TOKEN is not configured on this server.' });
      return;
    }

    const isAuthorized = await verifyFirebaseBearerToken(
      getRequestHeader(req, 'authorization'),
      getRequestHeader(req, 'origin') || getRequestHeader(req, 'referer')
    );
    if (!isAuthorized) {
      sendJson(res, 401, { error: 'Unauthorized delete request.' });
      return;
    }

    let body: { url?: string };
    try {
      body = await readJsonBody<{ url?: string }>(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON request body.' });
      return;
    }

    const url = body?.url;
    if (!url || !url.includes('.blob.vercel-storage.com')) {
      sendJson(res, 400, { error: 'Invalid Vercel Blob URL.' });
      return;
    }

    await del(url);
    sendJson(res, 200, { success: true });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Failed to delete blob.',
    });
  }
}
