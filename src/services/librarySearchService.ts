import { auth } from './firebase';
import { dataUrlToImageFile } from './geminiImageService';

export type LibrarySearchKind = 'images' | 'maps' | 'videos';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ImageSearchResultItem {
  id: string;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  mimeType: string;
}

export interface VideoSearchResultItem {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  watchUrl: string;
  sourceUrl: string;
}

export interface LibrarySearchResult {
  kind: LibrarySearchKind;
  items: ImageSearchResultItem[] | VideoSearchResultItem[];
  groundingSources: GroundingSource[];
  searchQueries: string[];
  hasMore?: boolean;
}

export class LibrarySearchError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'LibrarySearchError';
    this.code = code;
    this.status = status;
  }
}

export async function searchLibraryMedia(params: {
  kind: LibrarySearchKind;
  query: string;
  language?: 'en' | 'es';
  userApiKey?: string | null;
  page?: number;
  excludeUrls?: string[];
}): Promise<LibrarySearchResult> {
  if (!auth.currentUser) {
    throw new LibrarySearchError('Sign in required to search media.', 'UNAUTHORIZED', 401);
  }
  const idToken = await auth.currentUser.getIdToken();

  const res = await fetch('/api/gemini-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({
      kind: params.kind,
      query: params.query,
      language: params.language || 'en',
      userApiKey: params.userApiKey || undefined,
      page: params.page ?? 1,
      excludeUrls: params.excludeUrls || undefined,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new LibrarySearchError(
      `Search endpoint returned an invalid response (${res.status}).`,
      res.status === 504 ? 'TIMEOUT' : 'INVALID_RESPONSE',
      res.status
    );
  }

  const data = (await res.json().catch(() => ({}))) as Partial<LibrarySearchResult> & {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new LibrarySearchError(
      data.error || `Search failed (${res.status}).`,
      data.code,
      res.status
    );
  }

  return {
    kind: (data.kind as LibrarySearchKind) || params.kind,
    items: Array.isArray(data.items) ? data.items : [],
    groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
    searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
    hasMore: Boolean(data.hasMore),
  };
}

export async function importExternalImageAsFile(
  imageUrl: string,
  suggestedTitle?: string
): Promise<File> {
  if (!auth.currentUser) {
    throw new LibrarySearchError('Sign in required to import image.', 'UNAUTHORIZED', 401);
  }
  const idToken = await auth.currentUser.getIdToken();

  const res = await fetch('/api/import-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({
      imageUrl,
      title: suggestedTitle,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new LibrarySearchError(
      `Image proxy returned an invalid response (${res.status}).`,
      'INVALID_RESPONSE',
      res.status
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    dataUrl?: string;
    mimeType?: string;
    filename?: string;
    error?: string;
  };

  if (!res.ok || !data.dataUrl) {
    throw new LibrarySearchError(
      data.error || `Could not download image (${res.status}).`,
      undefined,
      res.status
    );
  }

  const file = dataUrlToImageFile(data.dataUrl, suggestedTitle || 'web-image');
  if (data.filename) {
    return new File([file], data.filename, { type: file.type });
  }
  return file;
}
