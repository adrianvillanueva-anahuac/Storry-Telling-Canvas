import {
  getRequestHeader,
  LibrarySearchKind,
  readJsonBody,
  searchLibraryMediaWithGemini,
  searchLibraryMediaWithoutApiKey,
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

    const kind: LibrarySearchKind = VALID_KINDS.has(body.kind as LibrarySearchKind)
      ? (body.kind as LibrarySearchKind)
      : 'images';

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      sendJson(res, 400, { error: 'Please enter a search query.' });
      return;
    }

    const language: 'en' | 'es' = body.language === 'es' ? 'es' : 'en';
    const page = typeof body.page === 'number' ? body.page : 1;
    const excludeUrls = Array.isArray(body.excludeUrls) ? body.excludeUrls.slice(0, 120) : [];

    if (resolvedApiKey) {
      try {
        const geminiResult = await searchLibraryMediaWithGemini({
          kind,
          query,
          apiKey: resolvedApiKey,
          language,
          page,
          excludeUrls,
        });
        if (geminiResult.items.length > 0) {
          sendJson(res, 200, geminiResult);
          return;
        }
      } catch (geminiErr) {
        console.warn('[api/gemini-search] Gemini search failed, falling back to keyless search:', geminiErr);
      }
    }

    const fallbackResult = await searchLibraryMediaWithoutApiKey({
      kind,
      query,
      language,
      page,
      excludeUrls,
    });
    sendJson(res, 200, fallbackResult);
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    sendJson(res, status, { error: message });
  }
}
