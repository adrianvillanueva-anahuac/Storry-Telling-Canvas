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
}

export async function searchLibraryMedia(params: {
  kind: LibrarySearchKind;
  query: string;
  language?: 'en' | 'es';
  userApiKey?: string | null;
}): Promise<LibrarySearchResult> {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';

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
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<LibrarySearchResult> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `Search failed (${res.status}).`);
  }

  return {
    kind: (data.kind as LibrarySearchKind) || params.kind,
    items: Array.isArray(data.items) ? data.items : [],
    groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
    searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
  };
}

export async function importExternalImageAsFile(
  imageUrl: string,
  suggestedTitle?: string
): Promise<File> {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';

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

  const data = (await res.json().catch(() => ({}))) as {
    dataUrl?: string;
    mimeType?: string;
    filename?: string;
    error?: string;
  };

  if (!res.ok || !data.dataUrl) {
    throw new Error(data.error || `Could not download image (${res.status}).`);
  }

  const file = dataUrlToImageFile(data.dataUrl, suggestedTitle || 'web-image');
  if (data.filename) {
    return new File([file], data.filename, { type: file.type });
  }
  return file;
}
