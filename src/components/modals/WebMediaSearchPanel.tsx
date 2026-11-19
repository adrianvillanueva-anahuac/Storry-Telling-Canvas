import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Map as MapIcon,
  Plus,
  Search,
  Video as VideoIcon,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import {
  GroundingSource,
  ImageSearchResultItem,
  LibrarySearchError,
  LibrarySearchKind,
  searchLibraryMedia,
  VideoSearchResultItem,
} from '../../services/librarySearchService';

interface WebMediaSearchPanelProps {
  kind: LibrarySearchKind;
  userApiKey?: string | null;
  multiSelect?: boolean;
  existingVideoIds?: Set<string>;
  isImporting?: boolean;
  importProgress?: { current: number; total: number } | null;
  onConfirmImages?: (items: ImageSearchResultItem[]) => Promise<void> | void;
  onConfirmVideos?: (items: VideoSearchResultItem[]) => Promise<void> | void;
  onOpenApiKeyConfig?: () => void;
}

export const WebMediaSearchPanel: React.FC<WebMediaSearchPanelProps> = ({
  kind,
  userApiKey,
  multiSelect = true,
  existingVideoIds,
  isImporting = false,
  importProgress = null,
  onConfirmImages,
  onConfirmVideos,
  onOpenApiKeyConfig,
}) => {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [exhaustedMore, setExhaustedMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [imageResults, setImageResults] = useState<ImageSearchResultItem[]>([]);
  const [videoResults, setVideoResults] = useState<VideoSearchResultItem[]>([]);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [brokenImgIds, setBrokenImgIds] = useState<Set<string>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const isVideo = kind === 'videos';

  const placeholder =
    kind === 'videos'
      ? t('webSearch.placeholderVideos')
      : kind === 'maps'
      ? t('webSearch.placeholderMaps')
      : t('webSearch.placeholderImages');

  const visibleImages = useMemo(
    () => imageResults.filter((item) => !brokenImgIds.has(item.id)),
    [imageResults, brokenImgIds]
  );

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSearching || isImporting) return;

    setIsSearching(true);
    setIsLoadingMore(false);
    setExhaustedMore(false);
    setError(null);
    setErrorCode(null);
    setSelectedIds(new Set());
    setBrokenImgIds(new Set());
    setPage(1);
    setHasMore(false);
    setLastQuery(trimmed);

    try {
      const res = await searchLibraryMedia({
        kind,
        query: trimmed,
        language,
        userApiKey,
        page: 1,
      });
      setGroundingSources(res.groundingSources || []);
      if (isVideo) {
        setVideoResults(res.items as VideoSearchResultItem[]);
        setImageResults([]);
      } else {
        setImageResults(res.items as ImageSearchResultItem[]);
        setVideoResults([]);
      }
      setHasMore(Boolean(res.hasMore));
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setErrorCode(err instanceof LibrarySearchError ? err.code || null : null);
      setImageResults([]);
      setVideoResults([]);
      setGroundingSources([]);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (!lastQuery || isSearching || isLoadingMore || isImporting || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    setError(null);
    setErrorCode(null);

    try {
      const excludeUrls = isVideo
        ? videoResults.map((v) => v.watchUrl)
        : imageResults.map((img) => img.imageUrl);

      const res = await searchLibraryMedia({
        kind,
        query: lastQuery,
        language,
        userApiKey,
        page: nextPage,
        excludeUrls,
      });

      let addedNewCount = 0;

      if (isVideo) {
        const incoming = res.items as VideoSearchResultItem[];
        setVideoResults((prev) => {
          const existingIds = new Set(prev.map((v) => v.youtubeId));
          const merged = [...prev];
          for (const item of incoming) {
            if (!existingIds.has(item.youtubeId)) {
              existingIds.add(item.youtubeId);
              merged.push(item);
              addedNewCount += 1;
            }
          }
          return merged;
        });
      } else {
        const incoming = res.items as ImageSearchResultItem[];
        setImageResults((prev) => {
          const existingUrls = new Set(prev.map((i) => i.imageUrl.split('#')[0]));
          const existingIds = new Set(prev.map((i) => i.id));
          const merged = [...prev];
          for (const item of incoming) {
            const normUrl = item.imageUrl.split('#')[0];
            if (!existingUrls.has(normUrl) && !existingIds.has(item.id)) {
              existingUrls.add(normUrl);
              existingIds.add(item.id);
              merged.push(item);
              addedNewCount += 1;
            }
          }
          return merged;
        });
      }

      if (res.groundingSources && res.groundingSources.length > 0) {
        setGroundingSources((prev) => {
          const seen = new Set(prev.map((s) => s.uri));
          const next = [...prev];
          for (const s of res.groundingSources) {
            if (!seen.has(s.uri)) {
              seen.add(s.uri);
              next.push(s);
            }
          }
          return next;
        });
      }

      setPage(nextPage);
      const canContinue = Boolean(res.hasMore) && addedNewCount > 0;
      setHasMore(canContinue);
      if (addedNewCount === 0) {
        setExhaustedMore(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setErrorCode(err instanceof LibrarySearchError ? err.code || null : null);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMore,
    imageResults,
    isImporting,
    isLoadingMore,
    isSearching,
    isVideo,
    kind,
    language,
    lastQuery,
    page,
    t,
    userApiKey,
    videoResults,
  ]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || !hasMore || isSearching || isLoadingMore || isImporting) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          handleLoadMore();
        }
      },
      {
        root,
        rootMargin: '160px',
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, isImporting, isLoadingMore, isSearching]);

  const toggleSelect = (id: string) => {
    if (isImporting) return;
    setSelectedIds((prev) => {
      if (!multiSelect) {
        return prev.has(id) ? new Set() : new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isImporting) return;
    if (isVideo) {
      const selectable = videoResults
        .filter((v) => !existingVideoIds?.has(v.youtubeId))
        .map((v) => v.id);
      setSelectedIds(new Set(selectable));
    } else {
      setSelectedIds(new Set(visibleImages.map((img) => img.id)));
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0 || isImporting) return;
    if (isVideo) {
      const chosen = videoResults.filter((v) => selectedIds.has(v.id));
      if (chosen.length > 0) {
        await onConfirmVideos?.(chosen);
        setSelectedIds(new Set());
      }
    } else {
      const chosen = visibleImages.filter((img) => selectedIds.has(img.id));
      if (chosen.length > 0) {
        await onConfirmImages?.(chosen);
      }
    }
  };

  const resultCount = isVideo ? videoResults.length : visibleImages.length;
  const hasResults = resultCount > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search Bar */}
      <form
        onSubmit={handleSearch}
        className="p-4 border-b border-[#d4cfc3] dark:border-neutral-800 space-y-2.5 shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#6e695d] dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              disabled={isSearching || isImporting}
              className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || isSearching || isImporting}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 transition-colors shadow-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isVideo ? 'bg-rose-600 hover:bg-rose-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>{isSearching ? t('webSearch.searching') : t('webSearch.searchBtn')}</span>
          </button>
        </div>

        {/* Selection / Action Toolbar */}
        {hasResults && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-[#5c584e] dark:text-neutral-400 font-medium">
                {t('webSearch.resultsCount', { count: resultCount })}
              </span>
              {multiSelect && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={isImporting}
                  className="px-2.5 py-1 rounded-md bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#2b2924] dark:text-neutral-200 font-medium transition-colors cursor-pointer"
                >
                  {t('webSearch.selectAll')}
                </button>
              )}
              {selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={isImporting}
                    className="px-2.5 py-1 rounded-md bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#5c584e] dark:text-neutral-300 font-medium transition-colors cursor-pointer"
                  >
                    {t('webSearch.clearSelection')}
                  </button>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {t('webSearch.selectedCount', { count: selectedIds.size })}
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              disabled={selectedIds.size === 0 || isImporting}
              onClick={handleConfirm}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                isVideo ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {importProgress
                      ? t('webSearch.importing', {
                          current: importProgress.current,
                          total: importProgress.total,
                        })
                      : t('common.uploading')}
                  </span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {multiSelect
                      ? t('webSearch.addSelectedToLib', { count: selectedIds.size })
                      : t('webSearch.useSelectedImage')}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-red-600/12 dark:bg-red-950/50 border border-red-600/35 dark:border-red-800/60 text-[11px] text-red-800 dark:text-red-300 flex flex-wrap items-center justify-between gap-2">
            <span>
              {errorCode === 'MISSING_API_KEY'
                ? t('webSearch.missingApiKeyHint')
                : errorCode === 'UNAUTHORIZED'
                ? t('webSearch.signInRequired')
                : error}
            </span>
            {errorCode === 'MISSING_API_KEY' && onOpenApiKeyConfig && (
              <button
                type="button"
                onClick={onOpenApiKeyConfig}
                className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>{t('webSearch.configureApiKey')}</span>
              </button>
            )}
          </div>
        )}
      </form>

      {/* Results Body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4"
      >
        {isSearching ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2 text-xs text-[#5c584e] dark:text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
            <span>{t('webSearch.searching')}</span>
          </div>
        ) : !lastQuery ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2 text-center text-xs text-[#6e695d] dark:text-neutral-500">
            {kind === 'videos' ? (
              <VideoIcon className="w-8 h-8 text-rose-600/60 dark:text-rose-400/60" />
            ) : kind === 'maps' ? (
              <MapIcon className="w-8 h-8 text-amber-600/60 dark:text-amber-400/60" />
            ) : (
              <ImageIcon className="w-8 h-8 text-blue-600/60 dark:text-blue-400/60" />
            )}
            <p className="max-w-sm">{t('webSearch.emptyPrompt')}</p>
          </div>
        ) : !hasResults ? (
          <div className="py-14 text-center text-xs text-[#6e695d] dark:text-neutral-500">
            {t('webSearch.noResults', { query: lastQuery })}
          </div>
        ) : isVideo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {videoResults.map((v) => {
              const isSelected = selectedIds.has(v.id);
              const alreadySaved = Boolean(existingVideoIds?.has(v.youtubeId));
              return (
                <div
                  key={v.id}
                  onClick={() => !alreadySaved && toggleSelect(v.id)}
                  className={`relative flex gap-3 p-2.5 rounded-xl border transition-all ${
                    alreadySaved
                      ? 'bg-[#dcd7cc]/60 border-[#c8c3b6] dark:bg-neutral-950/40 dark:border-neutral-800/60 opacity-75 cursor-default'
                      : isSelected
                      ? 'bg-rose-600/10 border-rose-600 ring-2 ring-rose-500/40 dark:bg-rose-600/15 dark:border-rose-500 cursor-pointer'
                      : 'bg-[#e0dbd0] border-[#c8c3b6] hover:border-rose-500 dark:bg-neutral-950 dark:border-neutral-800 dark:hover:border-rose-500/70 cursor-pointer'
                  }`}
                >
                  <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-black shrink-0 border border-[#c3beb1] dark:border-neutral-800">
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {isSelected && !alreadySaved && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-[#2b2924] dark:text-neutral-100 line-clamp-2 leading-snug">
                        {v.title}
                      </h4>
                      <p className="text-[10px] text-[#5c584e] dark:text-neutral-400 truncate mt-0.5">
                        {v.channel}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      {alreadySaved ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-600/30">
                          {t('videoLib.alreadyInLib')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-[#6e695d] dark:text-neutral-500">
                          {v.youtubeId}
                        </span>
                      )}
                      <a
                        href={v.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{t('webSearch.watchOnYouTube')}</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visibleImages.map((img) => {
              const isSelected = selectedIds.has(img.id);
              return (
                <div
                  key={img.id}
                  onClick={() => toggleSelect(img.id)}
                  className={`relative aspect-video rounded-xl overflow-hidden bg-[#d8d3c8] dark:bg-neutral-950 border cursor-pointer transition-all group ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-500/60 scale-[0.97]'
                      : 'border-[#c3beb1] dark:border-neutral-800 hover:border-blue-500 hover:scale-[1.02]'
                  }`}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      setBrokenImgIds((prev) => {
                        const next = new Set(prev);
                        next.add(img.id);
                        return next;
                      });
                      setSelectedIds((prev) => {
                        if (!prev.has(img.id)) return prev;
                        const next = new Set(prev);
                        next.delete(img.id);
                        return next;
                      });
                    }}
                    className="w-full h-full object-cover"
                  />

                  <a
                    href={img.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={t('webSearch.openSource')}
                    className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 hover:bg-blue-600 text-white text-[9px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-white/15"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[90px]">{img.sourceDomain}</span>
                  </a>

                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md z-10">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}

                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-1.5 text-[10px] text-neutral-100 truncate pointer-events-none">
                    {img.title}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Scroll Sentinel & Load More Controls */}
        {hasResults && !isSearching && (hasMore || isLoadingMore || exhaustedMore) && (
          <div ref={loadMoreSentinelRef} className="pt-2 flex flex-col items-center justify-center gap-2">
            {isLoadingMore ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#e0dbd0] dark:bg-neutral-800/80 text-xs text-[#433f37] dark:text-neutral-300 border border-[#c3beb1] dark:border-neutral-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                <span>{t('webSearch.loadingMore')}</span>
              </div>
            ) : hasMore ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isImporting}
                className="px-4 py-2 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-xs font-semibold text-[#2b2924] dark:text-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('webSearch.loadMore')}
              </button>
            ) : exhaustedMore ? (
              <p className="text-[11px] text-[#6e695d] dark:text-neutral-500">
                {t('webSearch.noMoreResults')}
              </p>
            ) : null}
          </div>
        )}

        {/* Google Search Grounding Sources */}
        {groundingSources.length > 0 && !isSearching && (
          <div className="pt-3 border-t border-[#d4cfc3] dark:border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6e695d] dark:text-neutral-500">
              <Globe className="w-3 h-3" />
              <span>{t('webSearch.sourcesLabel')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groundingSources.slice(0, 12).map((src, idx) => (
                <a
                  key={`${src.uri}-${idx}`}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] text-[#3a362e] dark:text-neutral-300 border border-[#c3beb1] dark:border-neutral-700 max-w-[220px] truncate transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{src.title || src.uri}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
