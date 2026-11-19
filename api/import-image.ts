import {
  fetchExternalImageAsDataUrl,
  verifyFirebaseBearerToken,
} from '../lib/librarySearch';

export async function POST(request: Request): Promise<Response> {
  const isAuthorized = await verifyFirebaseBearerToken(
    request.headers.get('authorization'),
    request.headers.get('origin') || request.headers.get('referer')
  );
  if (!isAuthorized) {
    return Response.json({ error: 'Authentication required to import web images.' }, { status: 401 });
  }

  let body: {
    imageUrl?: string;
    title?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  if (!imageUrl) {
    return Response.json({ error: 'Image URL is required.' }, { status: 400 });
  }

  try {
    const result = await fetchExternalImageAsDataUrl(imageUrl, body.title);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import external image.';
    const status = /limit|4 MB/i.test(message) ? 413 : 400;
    return Response.json({ error: message }, { status });
  }
}
