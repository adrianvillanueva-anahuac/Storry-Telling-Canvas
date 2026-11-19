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

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function extractBalancedJsonObject(source: string, startIdx: number): string | null {
  if (startIdx < 0 || source[startIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIdx, i + 1);
      }
    }
  }
  return null;
}

function collectYouTubeVideoRenderers(
  node: unknown,
  out: Array<{
    videoId: string;
    title: string;
    channel: string;
    thumbnailUrl: string;
  }>,
  seenIds: Set<string>
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectYouTubeVideoRenderers(item, out, seenIds);
      if (out.length >= 24) return;
    }
    return;
  }

  const obj = node as Record<string, unknown>;
  const renderer = obj.videoRenderer as Record<string, unknown> | undefined;
  if (renderer && typeof renderer === 'object' && typeof renderer.videoId === 'string') {
    const videoId = renderer.videoId.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(videoId) && !seenIds.has(videoId)) {
      const titleObj = renderer.title as
        | { runs?: Array<{ text?: string }>; simpleText?: string }
        | undefined;
      const title =
        titleObj?.runs?.map((r) => r.text || '').join('').trim() ||
        titleObj?.simpleText?.trim() ||
        `YouTube (${videoId})`;

      const ownerObj = (renderer.ownerText || renderer.longBylineText) as
        | { runs?: Array<{ text?: string }> }
        | undefined;
      const channel = ownerObj?.runs?.[0]?.text?.trim() || 'YouTube';

      const thumbs = (
        renderer.thumbnail as { thumbnails?: Array<{ url?: string }> } | undefined
      )?.thumbnails;
      const rawThumb =
        (Array.isArray(thumbs) && thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '') || '';
      const thumbnailUrl = rawThumb.startsWith('http')
        ? rawThumb
        : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      seenIds.add(videoId);
      out.push({
        videoId,
        title: title.slice(0, 200),
        channel: channel.slice(0, 120),
        thumbnailUrl,
      });
      if (out.length >= 24) return;
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      collectYouTubeVideoRenderers(value, out, seenIds);
      if (out.length >= 24) return;
    }
  }
}

async function searchYouTubeWithoutApiKey(params: {
  query: string;
  language: 'en' | 'es';
  page: number;
  excludedSet: Set<string>;
}): Promise<LibrarySearchResponse> {
  const { query, language, page, excludedSet } = params;
  const pageModifiers = ['', 'HD', 'cinematic', 'reference', 'tutorial'];
  const modifier = page > 1 ? pageModifiers[(page - 1) % pageModifiers.length] : '';
  const searchQuery = modifier ? `${query} ${modifier}`.trim() : query;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    searchQuery
  )}&hl=${language === 'es' ? 'es' : 'en'}`;

  const res = await fetchWithTimeout(searchUrl, {
    method: 'GET',
    timeoutMs: 5000,
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept-Language': language === 'es' ? 'es-419,es;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
      Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+678;',
    },
  });

  if (!res.ok) {
    return {
      kind: 'videos',
      items: [],
      groundingSources: [{ title: 'YouTube Search', uri: searchUrl }],
      searchQueries: [searchQuery],
      hasMore: false,
    };
  }

  const html = await res.text();
  const collected: Array<{
    videoId: string;
    title: string;
    channel: string;
    thumbnailUrl: string;
  }> = [];
  const seenIds = new Set<string>();

  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];
  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      const jsonStart = html.indexOf('{', idx + marker.length);
      const rawJson = extractBalancedJsonObject(html, jsonStart);
      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          collectYouTubeVideoRenderers(parsed, collected, seenIds);
          if (collected.length > 0) break;
        } catch {
          // Try next marker or regex fallback
        }
      }
    }
  }

  const videos: VideoSearchResultItem[] = [];
  for (const entry of collected) {
    const watchUrl = `https://www.youtube.com/watch?v=${entry.videoId}`;
    if (excludedSet.has(watchUrl)) continue;
    videos.push({
      id: entry.videoId,
      youtubeId: entry.videoId,
      title: entry.title,
      channel: entry.channel,
      thumbnailUrl: entry.thumbnailUrl,
      watchUrl,
      sourceUrl: watchUrl,
    });
    if (videos.length >= 16) break;
  }

  // Regex + oEmbed fallback if ytInitialData layout differed
  if (videos.length === 0) {
    const idMatches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(
      (m) => m[1]
    );
    const uniqueIds = Array.from(new Set(idMatches))
      .filter((id) => !excludedSet.has(`https://www.youtube.com/watch?v=${id}`))
      .slice(0, 12);
    const verified = await Promise.allSettled(
      uniqueIds.map((id) => verifyYouTubeVideo(id, '', '', `https://www.youtube.com/watch?v=${id}`))
    );
    for (const r of verified) {
      if (r.status === 'fulfilled' && r.value) {
        videos.push(r.value);
      }
    }
  }

  return {
    kind: 'videos',
    items: videos,
    groundingSources: [{ title: 'YouTube Search', uri: searchUrl }],
    searchQueries: [searchQuery],
    hasMore: page < 5 && videos.length > 0,
  };
}

function cleanWikimediaTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsableRasterMimeOrUrl(mime: string | undefined, url: string): boolean {
  const m = (mime || '').toLowerCase();
  if (m && (m.includes('svg') || m.includes('pdf') || m.includes('video') || m.includes('audio'))) {
    return false;
  }
  const lowerUrl = url.toLowerCase().split('?')[0];
  if (
    lowerUrl.endsWith('.svg') ||
    lowerUrl.endsWith('.pdf') ||
    lowerUrl.endsWith('.webm') ||
    lowerUrl.endsWith('.ogv') ||
    lowerUrl.endsWith('.ogg') ||
    lowerUrl.endsWith('.mp4')
  ) {
    return false;
  }
  if (BLOCKED_IMAGE_PATTERNS.test(url)) return false;
  return true;
}

async function fetchWikimediaCommonsImages(
  searchTerm: string,
  offset: number
): Promise<ImageSearchResultItem[]> {
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
    `&gsrsearch=${encodeURIComponent(`${searchTerm} filetype:bitmap`)}` +
    `&gsrlimit=24&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1280&format=json&origin=*`;

  const res = await fetchWithTimeout(apiUrl, { timeoutMs: 4200 });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          index?: number;
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            thumbmime?: string;
            mime?: string;
            width?: number;
            height?: number;
            descriptionurl?: string;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages || {}).sort(
    (a, b) => (a.index ?? 999) - (b.index ?? 999)
  );
  const items: ImageSearchResultItem[] = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const chosenUrl = info.thumburl || info.url || '';
    const safeUrl = isSafePublicUrl(chosenUrl);
    if (!safeUrl) continue;

    const mime = (info.thumbmime || info.mime || 'image/jpeg').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) continue;
    if (!isUsableRasterMimeOrUrl(mime, safeUrl.toString())) continue;
    if (typeof info.width === 'number' && info.width > 0 && info.width < 180) continue;

    const sourceUrl =
      info.descriptionurl ||
      `https://commons.wikimedia.org/wiki/${encodeURIComponent((page.title || '').replace(/ /g, '_'))}`;

    items.push({
      id: makeSearchItemId(safeUrl.toString()),
      title: cleanWikimediaTitle(page.title || '') || 'Wikimedia Commons',
      imageUrl: safeUrl.toString(),
      sourceUrl,
      sourceDomain: 'commons.wikimedia.org',
      mimeType: mime.includes('png') ? 'image/png' : mime.includes('webp') ? 'image/webp' : 'image/jpeg',
    });
  }

  return items;
}

async function fetchWikipediaPageImages(
  searchTerm: string,
  wikiHost: string,
  offset: number
): Promise<ImageSearchResultItem[]> {
  const apiUrl =
    `https://${wikiHost}/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(searchTerm)}&gsrlimit=20&gsroffset=${offset}` +
    `&prop=pageimages|info&inprop=url&piprop=thumbnail|original&pithumbsize=1280&format=json&origin=*`;

  const res = await fetchWithTimeout(apiUrl, { timeoutMs: 3800 });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          index?: number;
          fullurl?: string;
          thumbnail?: { source?: string; width?: number; height?: number };
          original?: { source?: string; width?: number; height?: number };
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages || {}).sort(
    (a, b) => (a.index ?? 999) - (b.index ?? 999)
  );
  const items: ImageSearchResultItem[] = [];

  for (const page of pages) {
    const thumbSrc = page.thumbnail?.source || '';
    const origSrc = page.original?.source || '';
    const candidate =
      thumbSrc && isUsableRasterMimeOrUrl(undefined, thumbSrc)
        ? thumbSrc
        : origSrc && isUsableRasterMimeOrUrl(undefined, origSrc)
        ? origSrc
        : '';

    if (!candidate) continue;
    if (
      candidate === thumbSrc &&
      typeof page.thumbnail?.width === 'number' &&
      page.thumbnail.width > 0 &&
      page.thumbnail.width < 160
    ) {
      continue;
    }

    const safeUrl = isSafePublicUrl(candidate);
    if (!safeUrl) continue;

    const lower = safeUrl.pathname.toLowerCase();
    const mimeType = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

    const sourceUrl =
      page.fullurl ||
      `https://${wikiHost}/wiki/${encodeURIComponent((page.title || '').replace(/ /g, '_'))}`;

    items.push({
      id: makeSearchItemId(safeUrl.toString()),
      title: (page.title || wikiHost).trim(),
      imageUrl: safeUrl.toString(),
      sourceUrl,
      sourceDomain: wikiHost,
      mimeType,
    });
  }

  return items;
}

async function fetchOpenverseImages(
  searchTerm: string,
  page: number
): Promise<ImageSearchResultItem[]> {
  const apiUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    searchTerm
  )}&page=${page}&page_size=16`;

  const res = await fetchWithTimeout(apiUrl, {
    timeoutMs: 3500,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      id?: string;
      title?: string;
      url?: string;
      thumbnail?: string;
      foreign_landing_url?: string;
      width?: number;
      filetype?: string;
    }>;
  };

  const candidates = (data.results || [])
    .filter((r) => typeof r.url === 'string' && isUsableRasterMimeOrUrl(r.filetype, r.url))
    .slice(0, 10);

  const verified = await Promise.allSettled(
    candidates.map(async (r): Promise<ImageSearchResultItem | null> => {
      const rawUrl = r.url!;
      const check = await verifyImageUrl(rawUrl);
      const chosenUrl = check?.url || (r.thumbnail && isSafePublicUrl(r.thumbnail) ? r.thumbnail : null);
      if (!chosenUrl) return null;

      const sourceUrl = r.foreign_landing_url || chosenUrl;
      const sourceDomain = (() => {
        try {
          return new URL(sourceUrl).hostname.replace(/^www\./, '');
        } catch {
          return 'openverse.org';
        }
      })();

      return {
        id: makeSearchItemId(chosenUrl),
        title: (r.title || sourceDomain).slice(0, 140),
        imageUrl: chosenUrl,
        sourceUrl,
        sourceDomain,
        mimeType: check?.mimeType || 'image/jpeg',
      };
    })
  );

  const items: ImageSearchResultItem[] = [];
  for (const v of verified) {
    if (v.status === 'fulfilled' && v.value) {
      items.push(v.value);
    }
  }
  return items;
}

export async function searchLibraryMediaWithoutApiKey(params: {
  kind: LibrarySearchKind;
  query: string;
  language?: 'en' | 'es';
  page?: number;
  excludeUrls?: string[];
}): Promise<LibrarySearchResponse> {
  const { kind, query, language = 'en', page = 1, excludeUrls = [] } = params;
  const cleanQuery = query.trim();
  const safePage = Number.isFinite(page) && page >= 1 ? Math.min(Math.floor(page), 10) : 1;
  const excludedSet = new Set(
    excludeUrls
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => u.trim().split('#')[0])
  );

  if (kind === 'videos') {
    return searchYouTubeWithoutApiKey({
      query: cleanQuery,
      language,
      page: safePage,
      excludedSet,
    });
  }

  const offset = (safePage - 1) * 20;
  const commonsQuery =
    kind === 'maps'
      ? `(${cleanQuery}) (map OR floorplan OR blueprint OR plan OR chart)`
      : cleanQuery;
  const wikiQuery = kind === 'maps' ? `${cleanQuery} map` : cleanQuery;
  const openverseQuery = kind === 'maps' ? `${cleanQuery} map` : cleanQuery;

  const jobs: Array<Promise<ImageSearchResultItem[]>> = [
    fetchWikimediaCommonsImages(commonsQuery, offset),
    fetchWikipediaPageImages(wikiQuery, 'en.wikipedia.org', offset),
    fetchOpenverseImages(openverseQuery, safePage),
  ];

  if (language === 'es') {
    jobs.push(fetchWikipediaPageImages(wikiQuery, 'es.wikipedia.org', offset));
  }
  if (kind === 'maps') {
    jobs.push(fetchWikimediaCommonsImages(cleanQuery, offset));
  }

  const settled = await Promise.allSettled(jobs);
  const uniqueImages: ImageSearchResultItem[] = [];
  const seenFinalImg = new Set<string>(excludedSet);
  const seenIds = new Set<string>();
  const usedDomains = new Set<string>();

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      const norm = item.imageUrl.split('#')[0];
      if (!seenFinalImg.has(norm) && !seenIds.has(item.id)) {
        seenFinalImg.add(norm);
        seenIds.add(item.id);
        uniqueImages.push(item);
        usedDomains.add(item.sourceDomain);
      }
    }
  }

  const groundingSources: GroundingSource[] = [];
  if (usedDomains.has('commons.wikimedia.org') || uniqueImages.length > 0) {
    groundingSources.push({
      title: 'Wikimedia Commons',
      uri: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(commonsQuery)}`,
    });
  }
  if (usedDomains.has('en.wikipedia.org')) {
    groundingSources.push({
      title: 'Wikipedia',
      uri: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiQuery)}`,
    });
  }
  if (usedDomains.has('es.wikipedia.org')) {
    groundingSources.push({
      title: 'Wikipedia (ES)',
      uri: `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiQuery)}`,
    });
  }
  if (
    Array.from(usedDomains).some(
      (d) => d !== 'commons.wikimedia.org' && d !== 'en.wikipedia.org' && d !== 'es.wikipedia.org'
    )
  ) {
    groundingSources.push({
      title: 'Openverse',
      uri: `https://openverse.org/search/image?q=${encodeURIComponent(openverseQuery)}`,
    });
  }

  return {
    kind,
    items: uniqueImages.slice(0, 36),
    groundingSources,
    searchQueries: [cleanQuery],
    hasMore: safePage < 5 && uniqueImages.length > 0,
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
