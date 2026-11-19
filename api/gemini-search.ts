import {
  LibrarySearchKind,
  searchLibraryMediaWithGemini,
  verifyFirebaseBearerToken,
} from '../lib/librarySearch';

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

export async function POST(request: Request): Promise<Response> {
  const isAuthorized = await verifyFirebaseBearerToken(
    request.headers.get('authorization'),
    request.headers.get('origin') || request.headers.get('referer')
  );
  if (!isAuthorized) {
    return Response.json(
      { error: 'Authentication required to search web media.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let body: {
    kind?: string;
    query?: string;
    language?: 'en' | 'es';
    userApiKey?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const resolvedApiKey =
    (typeof body.userApiKey === 'string' && body.userApiKey.trim()) ||
    process.env.GEMINI_API_KEY ||
    '';

  if (!resolvedApiKey) {
    return Response.json(
      {
        error: 'Gemini API key is not configured on the server or in your user settings.',
        code: 'MISSING_API_KEY',
      },
      { status: 400 }
    );
  }

  const kind: LibrarySearchKind = VALID_KINDS.has(body.kind as LibrarySearchKind)
    ? (body.kind as LibrarySearchKind)
    : 'images';

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return Response.json({ error: 'Please enter a search query.' }, { status: 400 });
  }

  try {
    const result = await searchLibraryMediaWithGemini({
      kind,
      query,
      apiKey: resolvedApiKey,
      language: body.language === 'es' ? 'es' : 'en',
    });
    return Response.json(result);
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    return Response.json({ error: message }, { status });
  }
}
