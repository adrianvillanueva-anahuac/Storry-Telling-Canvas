import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const FSMEDIA_PREFIX = 'fsmedia://';

const resolvedMediaMap = new Map<string, string>();
const inFlightMediaMap = new Map<string, Promise<string | null>>();

export function isFirestoreMediaUrl(url?: string | null): url is string {
  return typeof url === 'string' && url.startsWith(FSMEDIA_PREFIX);
}

export function parseFirestoreMediaUrl(
  urlOrPath?: string | null
): { projectId: string; mediaId: string } | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;

  if (urlOrPath.startsWith(FSMEDIA_PREFIX)) {
    const clean = urlOrPath.slice(FSMEDIA_PREFIX.length).split('?')[0].trim();
    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 2) {
      return { projectId: parts[0], mediaId: parts[1] };
    }
    return null;
  }

  const pathMatch = urlOrPath.match(/^projects\/([^/]+)\/media\/([^/?#]+)/);
  if (pathMatch) {
    return { projectId: pathMatch[1], mediaId: pathMatch[2] };
  }

  return null;
}

export function toFirestoreMediaUrl(projectId: string, mediaId: string): string {
  return `${FSMEDIA_PREFIX}${projectId}/${mediaId}`;
}

export function primeMediaCache(url: string, dataUrl: string): void {
  if (!url || !dataUrl) return;
  resolvedMediaMap.set(url, dataUrl);
}

export function evictMediaCache(urlOrPath?: string | null): void {
  if (!urlOrPath) return;
  const parsed = parseFirestoreMediaUrl(urlOrPath);
  if (parsed) {
    resolvedMediaMap.delete(toFirestoreMediaUrl(parsed.projectId, parsed.mediaId));
  }
  resolvedMediaMap.delete(urlOrPath);
}

export async function resolveMediaUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  if (!isFirestoreMediaUrl(url)) return url;

  const cached = resolvedMediaMap.get(url);
  if (cached) return cached;

  const existingInFlight = inFlightMediaMap.get(url);
  if (existingInFlight) return existingInFlight;

  const parsed = parseFirestoreMediaUrl(url);
  if (!parsed) return null;

  const promise = (async () => {
    try {
      const snap = await getDoc(doc(db, 'projects', parsed.projectId, 'media', parsed.mediaId));
      if (!snap.exists()) {
        return null;
      }
      const data = snap.data() as { dataUrl?: unknown };
      if (typeof data?.dataUrl === 'string' && data.dataUrl.startsWith('data:image/')) {
        resolvedMediaMap.set(url, data.dataUrl);
        return data.dataUrl;
      }
      return null;
    } catch (err) {
      console.warn('Could not resolve Firestore media asset:', parsed.mediaId, err);
      return null;
    } finally {
      inFlightMediaMap.delete(url);
    }
  })();

  inFlightMediaMap.set(url, promise);
  return promise;
}

export function useResolvedMediaUrl(src?: string | null): {
  resolvedSrc: string | undefined;
  isResolving: boolean;
  isMissing: boolean;
} {
  const normalized = src || '';
  const needsAsyncResolve = isFirestoreMediaUrl(normalized);
  const syncCached = needsAsyncResolve ? resolvedMediaMap.get(normalized) : undefined;

  const [asyncState, setAsyncState] = useState<{
    source: string;
    resolved: string | undefined;
    missing: boolean;
  }>(() => ({
    source: normalized,
    resolved: needsAsyncResolve ? syncCached : normalized || undefined,
    missing: false,
  }));

  useEffect(() => {
    if (!normalized) {
      setAsyncState({ source: '', resolved: undefined, missing: false });
      return;
    }

    if (!isFirestoreMediaUrl(normalized)) {
      setAsyncState({ source: normalized, resolved: normalized, missing: false });
      return;
    }

    const immediate = resolvedMediaMap.get(normalized);
    if (immediate) {
      setAsyncState({ source: normalized, resolved: immediate, missing: false });
      return;
    }

    let cancelled = false;
    setAsyncState({ source: normalized, resolved: undefined, missing: false });

    resolveMediaUrl(normalized).then((dataUrl) => {
      if (cancelled) return;
      if (dataUrl) {
        setAsyncState({ source: normalized, resolved: dataUrl, missing: false });
      } else {
        setAsyncState({ source: normalized, resolved: undefined, missing: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  if (!normalized) {
    return { resolvedSrc: undefined, isResolving: false, isMissing: false };
  }

  if (!needsAsyncResolve) {
    return { resolvedSrc: normalized, isResolving: false, isMissing: false };
  }

  if (syncCached) {
    return { resolvedSrc: syncCached, isResolving: false, isMissing: false };
  }

  if (asyncState.source !== normalized) {
    return { resolvedSrc: undefined, isResolving: true, isMissing: false };
  }

  return {
    resolvedSrc: asyncState.resolved,
    isResolving: !asyncState.resolved && !asyncState.missing,
    isMissing: asyncState.missing,
  };
}
