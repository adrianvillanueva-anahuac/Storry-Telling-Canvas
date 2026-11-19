import {
  getRequestHeader,
  LibrarySearchKind,
  readJsonBody,
  searchLibraryMediaWithGemini,
  sendJson,
  type ServerlessRequest,
  type ServerlessResponse,
  verifyFirebaseBearerToken,
} from '../lib/librarySearch.js';

const VALID_KINDS = new Set<LibrarySearchKind>(['images', 'maps', 'videos']);

function getErrorStatusAndMessage(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || 'Search failed');
  let status = 500;
  if (
    err &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
  ) {
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
      sendJson(res, 401, {
        error: 'Authentication required to search web media.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    let body: {
      kind?: string;
      query?: string;
      language?: 'en' | 'es';
      userApiKey?: string;
      page?: number;
      excludeUrls?: string[];
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
        error: 'Gemini API key is not configured on the server or in your user settings.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    const kind: LibrarySearchKind = VALID_KINDS.has(body.kind as LibrarySearchKind)
      ? (body.kind as LibrarySearchKind)
      : 'images';

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      sendJson(res, 400, { error: 'Please enter a search query.' });
      return;
    }

    const result = await searchLibraryMediaWithGemini({
      kind,
      query,
      apiKey: resolvedApiKey,
      language: body.language === 'es' ? 'es' : 'en',
      page: typeof body.page === 'number' ? body.page : 1,
      excludeUrls: Array.isArray(body.excludeUrls) ? body.excludeUrls.slice(0, 120) : [],
    });
    sendJson(res, 200, result);
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    sendJson(res, status, { error: message });
  }
}
