import {
  fetchExternalImageAsDataUrl,
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
    const isAuthorized = await verifyFirebaseBearerToken(
      getRequestHeader(req, 'authorization'),
      getRequestHeader(req, 'origin') || getRequestHeader(req, 'referer')
    );
    if (!isAuthorized) {
      sendJson(res, 401, { error: 'Authentication required to import web images.' });
      return;
    }

    let body: {
      imageUrl?: string;
      title?: string;
    };

    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON request body.' });
      return;
    }

    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!imageUrl) {
      sendJson(res, 400, { error: 'Image URL is required.' });
      return;
    }

    const result = await fetchExternalImageAsDataUrl(imageUrl, body.title);
    sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import external image.';
    const status = /limit|4 MB/i.test(message) ? 413 : 400;
    sendJson(res, status, { error: message });
  }
}
