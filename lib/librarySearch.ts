import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

function makeSearchItemId(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('base64url').slice(0, 18);
  return `sr-${hash}`;
}

export type ServerlessRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type ServerlessResponse = ServerResponse & {
  status?: (code: number) => ServerlessResponse;
  json?: (body: unknown) => unknown;
};

export function getRequestHeader(req: IncomingMessage, name: string): string | undefined {
  const val = req.headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  return typeof val === 'string' ? val : undefined;
}

export function sendJson(res: ServerlessResponse, status: number, payload: unknown): void {
  if (typeof res.status === 'function') {
    const statusRes = res.status(status);
    if (typeof statusRes?.json === 'function') {
      statusRes.json(payload);
      return;
    }
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function readJsonBody<T = Record<string, unknown>>(req: ServerlessRequest): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return (req.body.trim() ? JSON.parse(req.body) : {}) as T;
    }
    if (Buffer.isBuffer(req.body)) {
      const text = req.body.toString('utf8').trim();
      return (text ? JSON.parse(text) : {}) as T;
    }
    if (typeof req.body === 'object') {
      return req.body as T;
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

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

export interface LibrarySearchResponse {
  kind: LibrarySearchKind;
  items: ImageSearchResultItem[] | VideoSearchResultItem[];
  groundingSources: GroundingSource[];
  searchQueries: string[];
  hasMore?: boolean;
}

const REQUEST_UA =
  'Mozilla/5.0 (compatible; VisualWorkflowCanvas/1.0; +https://vercel.app)';

export function getFirebaseWebApiKey(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(currentDir, '../firebase-applet-config.json'),
    path.resolve(currentDir, '../../firebase-applet-config.json'),
  ];
  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw) as { apiKey?: string };
        if (parsed.apiKey) return parsed.apiKey;
      }
    } catch {
      // Try next candidate
    }
  }
  return process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || '';
}

export async function verifyFirebaseBearerToken(
  authHeader?: string | null,
  requestRefererOrOrigin?: string | null
): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const idToken = authHeader.slice(7).trim();
  const apiKey = getFirebaseWebApiKey();
  if (!idToken || !apiKey) return false;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (requestRefererOrOrigin) {
    headers['Referer'] = requestRefererOrOrigin;
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: Array<{ emailVerified?: boolean }> };
    return Boolean(data.users && data.users.length > 0 && data.users[0].emailVerified !== false);
  } catch {
    return false;
  }
}

function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower) return true;
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.localhost')
  ) {
    return true;
  }

  const ipType = net.isIP(lower);
  if (ipType === 4) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  } else if (ipType === 6) {
    if (lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

export function isSafePublicUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (isPrivateOrBlockedHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 4500, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        'User-Agent': REQUEST_UA,
        ...(rest.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveRedirectUrl(rawUrl: string): Promise<string> {
  const parsed = isSafePublicUrl(rawUrl);
  if (!parsed) return rawUrl;
  const isGroundingRedirect =
    parsed.hostname.includes('vertexaisearch.cloud.google.com') ||
    parsed.hostname.includes('google.com');
  if (!isGroundingRedirect) return parsed.toString();

  try {
    const res = await fetchWithTimeout(parsed.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      timeoutMs: 4000,
    });
    if (res.url && isSafePublicUrl(res.url)) {
      return res.url;
    }
  } catch {
    // Fallback to GET with immediate cancel after headers
    try {
      const res = await fetchWithTimeout(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        timeoutMs: 4000,
      });
      const finalUrl = res.url;
      await res.body?.cancel().catch(() => {});
      if (finalUrl && isSafePublicUrl(finalUrl)) {
        return finalUrl;
      }
    } catch {
      // Ignore redirect failure
    }
  }
  return rawUrl;
}

export function extractYouTubeIdServer(rawUrl: string): string | null {
  const match = rawUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
  return matches.map((u) => u.replace(/[.,;:!?]+$/, ''));
}

function parseJsonArrayFromText(text: string): Array<Record<string, unknown>> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const bracketStart = candidate.indexOf('[');
  const bracketEnd = candidate.lastIndexOf(']');
  if (bracketStart === -1 || bracketEnd <= bracketStart) return [];
  try {
    const parsed = JSON.parse(candidate.slice(bracketStart, bracketEnd + 1));
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMetaImagesFromHtml(html: string, baseUrl: string): { title: string; imageUrls: string[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : '';

  const found: string[] = [];
  const addUrl = (raw?: string) => {
    if (!raw) return;
    const decoded = decodeHtmlEntities(raw.trim());
    if (!decoded || decoded.startsWith('data:')) return;
    try {
      const abs = new URL(decoded, baseUrl).toString();
      if (isSafePublicUrl(abs) && !found.includes(abs)) {
        found.push(abs);
      }
    } catch {
      // Ignore malformed URL
    }
  };

  // Priority 1: og:image, twitter:image, link rel=image_src
  const metaRegex =
    /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(html)) !== null) {
    addUrl(m[1] || m[2]);
  }

  const linkRegex =
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((m = linkRegex.exec(html)) !== null) {
    addUrl(m[1]);
  }

  // Priority 2: Direct known high-res media hosts or raster img tags
  const directHostRegex =
    /https?:\/\/(?:upload\.wikimedia\.org|images\.unsplash\.com|images\.pexels\.com|cdn\.pixabay\.com)\/[^\s"'<>]+/gi;
  while ((m = directHostRegex.exec(html)) !== null) {
    if (found.length >= 10) break;
    addUrl(m[0]);
  }

  const imgRegex = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["'][^>]*>/gi;
  while ((m = imgRegex.exec(html)) !== null) {
    if (found.length >= 14) break;
    addUrl(m[1]);
  }

  return { title: rawTitle, imageUrls: found };
}

const BLOCKED_IMAGE_PATTERNS =
  /(favicon|sprite|apple-touch-icon|1x1|spacer|pixel\.gif|blank\.gif|default_avatar|site-logo|brand-logo|badge|emoji)/i;

async function verifyImageUrl(
  candidateUrl: string
): Promise<{ url: string; mimeType: string } | null> {
  const safe = isSafePublicUrl(candidateUrl);
  if (!safe) return null;
  if (BLOCKED_IMAGE_PATTERNS.test(safe.pathname)) return null;

  try {
    let res = await fetchWithTimeout(safe.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      timeoutMs: 2500,
    });
    if (res.status === 405 || res.status === 403 || !res.ok) {
      res = await fetchWithTimeout(safe.toString(), {
        method: 'GET',
        redirect: 'follow',
        timeoutMs: 3000,
        headers: { Range: 'bytes=0-2047' },
      });
      await res.body?.cancel().catch(() => {});
    }
    if (!res.ok) return null;

    const finalUrl = res.url || safe.toString();
    if (!isSafePublicUrl(finalUrl)) return null;

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) return null;
    if (contentType === 'image/x-icon' || contentType === 'image/vnd.microsoft.icon') return null;

    const lenHeader = res.headers.get('content-length');
    if (lenHeader) {
      const bytes = Number(lenHeader);
      if (Number.isFinite(bytes) && bytes > 0 && bytes < 4000) {
        return null;
      }
    }

    return { url: finalUrl, mimeType: contentType };
  } catch {
    return null;
  }
}

async function resolveCandidateToImages(candidate: {
  title: string;
  imageUrl?: string;
  pageUrl?: string;
  source?: string;
}): Promise<ImageSearchResultItem[]> {
  const primaryRaw = candidate.imageUrl || candidate.pageUrl || '';
  if (!primaryRaw) return [];

  const resolvedPrimary = await resolveRedirectUrl(primaryRaw);
  const resolvedPage = candidate.pageUrl ? await resolveRedirectUrl(candidate.pageUrl) : resolvedPrimary;

  // 1. Check if primary URL is already a valid direct image
  const directCheck = await verifyImageUrl(resolvedPrimary);
  if (directCheck) {
    const pageDomain = (() => {
      try {
        return new URL(resolvedPage).hostname.replace(/^www\./, '');
      } catch {
        return candidate.source || 'web';
      }
    })();
    return [
      {
        id: makeSearchItemId(directCheck.url),
        title: candidate.title || pageDomain,
        imageUrl: directCheck.url,
        sourceUrl: resolvedPage,
        sourceDomain: pageDomain,
        mimeType: directCheck.mimeType,
      },
    ];
  }

  // 2. Otherwise inspect HTML page for og:image / Wikimedia / high-res img
  const safePageUrl = isSafePublicUrl(resolvedPage) || isSafePublicUrl(resolvedPrimary);
  const pageUrlToFetch = safePageUrl ? safePageUrl.toString() : null;
  if (!pageUrlToFetch) return [];

  try {
    const pageRes = await fetchWithTimeout(pageUrlToFetch, {
      method: 'GET',
      redirect: 'follow',
      timeoutMs: 3500,
      headers: {
        Accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5',
      },
    });
    if (!pageRes.ok) return [];
    const cType = (pageRes.headers.get('content-type') || '').toLowerCase();

    if (cType.startsWith('image/')) {
      await pageRes.body?.cancel().catch(() => {});
      const finalImgUrl = pageRes.url || pageUrlToFetch;
      const pageDomain = new URL(finalImgUrl).hostname.replace(/^www\./, '');
      return [
        {
          id: makeSearchItemId(finalImgUrl),
          title: candidate.title || pageDomain,
          imageUrl: finalImgUrl,
          sourceUrl: finalImgUrl,
          sourceDomain: pageDomain,
          mimeType: cType.split(';')[0].trim(),
        },
      ];
    }

    if (!cType.includes('text/html')) {
      await pageRes.body?.cancel().catch(() => {});
      return [];
    }

    const html = (await pageRes.text()).slice(0, 260_000);
    const finalPageUrl = pageRes.url || pageUrlToFetch;
    const extracted = extractMetaImagesFromHtml(html, finalPageUrl);
    const imgChecks = await Promise.allSettled(
      extracted.imageUrls.slice(0, 6).map((imgCandidate) => verifyImageUrl(imgCandidate))
    );

    const results: ImageSearchResultItem[] = [];
    const seenUrls = new Set<string>();
    const pageDomain = new URL(finalPageUrl).hostname.replace(/^www\./, '');

    for (const check of imgChecks) {
      if (check.status === 'fulfilled' && check.value) {
        const verified = check.value;
        const norm = verified.url.split('#')[0];
        if (seenUrls.has(norm)) continue;
        seenUrls.add(norm);
        results.push({
          id: makeSearchItemId(verified.url),
          title: candidate.title || extracted.title || pageDomain,
          imageUrl: verified.url,
          sourceUrl: finalPageUrl,
          sourceDomain: pageDomain,
          mimeType: verified.mimeType,
        });
        if (results.length >= 4) break;
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function verifyYouTubeVideo(
  youtubeId: string,
  fallbackTitle: string,
  fallbackChannel: string,
  sourceUrl: string
): Promise<VideoSearchResultItem | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const res = await fetchWithTimeout(oembedUrl, { timeoutMs: 4000 });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      id: youtubeId,
      youtubeId,
      title: (data.title || fallbackTitle || `YouTube (${youtubeId})`).slice(0, 200),
      channel: data.author_name || fallbackChannel || 'YouTube',
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
      watchUrl,
      sourceUrl: sourceUrl || watchUrl,
    };
  } catch {
    return null;
  }
}

export async function searchLibraryMediaWithGemini(params: {
  kind: LibrarySearchKind;
  query: string;
  apiKey: string;
  language?: 'en' | 'es';
  page?: number;
  excludeUrls?: string[];
}): Promise<LibrarySearchResponse> {
  const { kind, query, apiKey, page = 1, excludeUrls = [] } = params;
  const cleanQuery = query.trim();
  const safePage = Number.isFinite(page) && page >= 1 ? Math.min(Math.floor(page), 10) : 1;
  const excludedSet = new Set(
    excludeUrls
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => u.trim().split('#')[0])
  );

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const paginationHint =
    safePage > 1
      ? `\nIMPORTANT: This is page ${safePage} of search results. Find DIFFERENT, NEW webpages, angles, variations, and photography archives than standard top results.${
          excludedSet.size > 0
            ? ` Avoid returning these already-shown URLs or exact pages:\n${Array.from(excludedSet)
                .slice(-15)
                .join('\n')}`
            : ''
        }`
      : '';

  const prompt =
    kind === 'videos'
      ? `Search YouTube using Google Search for real, publicly available YouTube videos matching: "${cleanQuery}".${paginationHint}
Return up to 16 relevant YouTube video results as a JSON array inside \`\`\`json ... \`\`\` where each object has:
- "title": descriptive video title
- "url": full YouTube watch URL (https://www.youtube.com/watch?v=...)
- "channel": channel or creator name
Only include real YouTube URLs found in your search results.`
      : kind === 'maps'
      ? `Search the web using Google Search for real, high-resolution overhead maps, architectural floorplans, blueprints, battlemaps, or topographic map images matching: "${cleanQuery}".${paginationHint}
Prefer Wikimedia Commons, Wikipedia, Unsplash, Pexels, Pixabay, NASA, Flickr, or open reference archives where preview images load directly.
Return up to 24 diverse results as a JSON array inside \`\`\`json ... \`\`\` where each object has:
- "title": concise descriptive map title
- "imageUrl": direct image URL if available (otherwise empty string)
- "pageUrl": exact webpage URL from Google Search results
- "source": website domain name
Only include real URLs returned by Google Search.`
      : `Search the web using Google Search for real, high-resolution reference photography, concept visuals, or scene images matching: "${cleanQuery}".${paginationHint}
Prefer Wikimedia Commons, Wikipedia, Unsplash, Pexels, Pixabay, NASA, Flickr, or open photography/film reference pages where preview images load directly.
Return up to 24 diverse results as a JSON array inside \`\`\`json ... \`\`\` where each object has:
- "title": concise descriptive image title
- "imageUrl": direct image URL if available (otherwise empty string)
- "pageUrl": exact webpage URL from Google Search results
- "source": website domain name
Only include real URLs returned by Google Search.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const candidate = response.candidates?.[0];
  const groundingMeta = candidate?.groundingMetadata;
  const rawChunks = groundingMeta?.groundingChunks ?? [];
  const searchQueries = groundingMeta?.webSearchQueries ?? [];
  const responseText = response.text ?? '';

  const groundingSources: GroundingSource[] = [];
  const seenSourceUris = new Set<string>();
  for (const chunk of rawChunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title || uri || '';
    if (uri && !seenSourceUris.has(uri)) {
      seenSourceUris.add(uri);
      groundingSources.push({ title, uri });
    }
  }

  const parsedItems = parseJsonArrayFromText(responseText);

  if (kind === 'videos') {
    const ytCandidates = new Map<
      string,
      { title: string; channel: string; sourceUrl: string }
    >();

    for (const item of parsedItems) {
      const rawUrl = typeof item.url === 'string' ? item.url : '';
      const ytId = extractYouTubeIdServer(rawUrl);
      if (ytId && !ytCandidates.has(ytId)) {
        ytCandidates.set(ytId, {
          title: typeof item.title === 'string' ? item.title : '',
          channel: typeof item.channel === 'string' ? item.channel : '',
          sourceUrl: rawUrl,
        });
      }
    }

    for (const rawUrl of extractUrlsFromText(responseText)) {
      const ytId = extractYouTubeIdServer(rawUrl);
      if (ytId && !ytCandidates.has(ytId)) {
        ytCandidates.set(ytId, { title: '', channel: '', sourceUrl: rawUrl });
      }
    }

    // Also resolve grounding chunks to uncover real YouTube watch URLs
    const resolvedChunks = await Promise.allSettled(
      groundingSources.slice(0, 12).map(async (src) => {
        const finalUri = await resolveRedirectUrl(src.uri);
        return { title: src.title, uri: finalUri };
      })
    );
    for (const r of resolvedChunks) {
      if (r.status === 'fulfilled') {
        const ytId = extractYouTubeIdServer(r.value.uri);
        if (ytId && !ytCandidates.has(ytId)) {
          ytCandidates.set(ytId, {
            title: r.value.title,
            channel: '',
            sourceUrl: r.value.uri,
          });
        }
      }
    }

    const verified = await Promise.allSettled(
      Array.from(ytCandidates.entries())
        .filter(([ytId]) => !excludedSet.has(`https://www.youtube.com/watch?v=${ytId}`))
        .slice(0, 16)
        .map(([ytId, meta]) =>
          verifyYouTubeVideo(ytId, meta.title, meta.channel, meta.sourceUrl)
        )
    );

    const videos: VideoSearchResultItem[] = [];
    for (const res of verified) {
      if (res.status === 'fulfilled' && res.value) {
        videos.push(res.value);
      }
    }

    return {
      kind,
      items: videos,
      groundingSources,
      searchQueries,
      hasMore: safePage < 5 && videos.length > 0,
    };
  }

  // Image / Map search resolution
  const candidates: Array<{
    title: string;
    imageUrl?: string;
    pageUrl?: string;
    source?: string;
  }> = [];
  const seenCandidateUrls = new Set<string>();

  for (const item of parsedItems) {
    const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
    const pageUrl = typeof item.pageUrl === 'string' ? item.pageUrl.trim() : '';
    const key = imageUrl || pageUrl;
    if (key && !seenCandidateUrls.has(key)) {
      seenCandidateUrls.add(key);
      candidates.push({
        title: typeof item.title === 'string' ? item.title.trim() : '',
        imageUrl: imageUrl || undefined,
        pageUrl: pageUrl || undefined,
        source: typeof item.source === 'string' ? item.source.trim() : undefined,
      });
    }
  }

  for (const src of groundingSources) {
    if (!seenCandidateUrls.has(src.uri)) {
      seenCandidateUrls.add(src.uri);
      candidates.push({
        title: src.title,
        pageUrl: src.uri,
      });
    }
  }

  for (const rawUrl of extractUrlsFromText(responseText)) {
    if (!seenCandidateUrls.has(rawUrl)) {
      seenCandidateUrls.add(rawUrl);
      candidates.push({
        title: '',
        pageUrl: rawUrl,
      });
    }
  }

  const resolvedImages = await Promise.allSettled(
    candidates.slice(0, 24).map((cand) => resolveCandidateToImages(cand))
  );

  const uniqueImages: ImageSearchResultItem[] = [];
  const seenFinalImg = new Set<string>(excludedSet);
  const seenIds = new Set<string>();
  for (const r of resolvedImages) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const item of r.value) {
        const norm = item.imageUrl.split('#')[0];
        if (!seenFinalImg.has(norm) && !seenIds.has(item.id)) {
          seenFinalImg.add(norm);
          seenIds.add(item.id);
          uniqueImages.push(item);
        }
      }
    }
  }

  return {
    kind,
    items: uniqueImages.slice(0, 36),
    groundingSources,
    searchQueries,
    hasMore: safePage < 5 && (uniqueImages.length > 0 || groundingSources.length > 0),
  };
}

export async function fetchExternalImageAsDataUrl(
  rawImageUrl: string,
  suggestedTitle?: string
): Promise<{ dataUrl: string; mimeType: string; filename: string; sizeBytes: number }> {
  const safe = isSafePublicUrl(rawImageUrl);
  if (!safe) {
    throw new Error('Image URL must be a valid public HTTP(S) address.');
  }

  const res = await fetchWithTimeout(safe.toString(), {
    method: 'GET',
    redirect: 'follow',
    timeoutMs: 9000,
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.5',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status}).`);
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new Error('The selected link did not return a valid image file.');
  }

  const arrayBuffer = await res.arrayBuffer();
  const maxBytes = 4 * 1024 * 1024;
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Downloaded image is empty.');
  }
  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error('Selected image exceeds the 4 MB import limit.');
  }

  const ext =
    contentType === 'image/jpeg'
      ? 'jpg'
      : contentType === 'image/webp'
      ? 'webp'
      : contentType === 'image/gif'
      ? 'gif'
      : contentType === 'image/avif'
      ? 'avif'
      : 'png';

  const cleanBase = (suggestedTitle || 'web-asset')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'web-asset';

  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    dataUrl: `data:${contentType};base64,${base64}`,
    mimeType: contentType,
    filename: `${cleanBase}.${ext}`,
    sizeBytes: arrayBuffer.byteLength,
  };
}
