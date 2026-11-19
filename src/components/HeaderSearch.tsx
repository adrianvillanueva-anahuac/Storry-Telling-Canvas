import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LabelItem, TextElement, WorkflowNode } from '../types/workflow';
import { Image as ImageIcon, Layers, Search, StickyNote, Type, X } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcutString,
  matchesShortcut,
  ShortcutBinding,
} from '../utils/keyboardShortcuts';

export interface SearchTarget {
  id: string;
  kind: 'node' | 'container' | 'annotation' | 'floating';
  title: string;
  snippet: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HeaderSearchProps {
  nodes: Record<string, WorkflowNode>;
  texts: Record<string, TextElement>;
  labels: Record<string, LabelItem>;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  matchCount?: number;
  totalNodeCount?: number;
  focusSearchBinding?: ShortcutBinding;
  className?: string;
  onSelectTarget: (target: SearchTarget) => void;
}

export function getNodeSearchFields(
  node: WorkflowNode,
  labels?: Record<string, LabelItem>
): { title: string; content: string[] } {
  const title = node.title || '';
  const labelName = node.labelId ? labels?.[node.labelId]?.name : undefined;
  const content = [
    labelName,
    node.enfoque,
    node.accion,
    node.descripcion,
    node.mapName,
    node.storeNote,
    ...(node.pins || []).flatMap((p) => [p.text, ...(p.replies || []).map((r) => r.text)]),
    ...(node.mapPins || []).flatMap((p) => [p.text, ...(p.replies || []).map((r) => r.text)]),
  ].filter((s): s is string => Boolean(s && s.trim()));
  return { title, content };
}

export function doesNodeMatchQuery(
  node: WorkflowNode,
  rawQuery: string,
  labels?: Record<string, LabelItem>
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;
  const { title, content } = getNodeSearchFields(node, labels);
  if (title.toLowerCase().includes(q)) return true;
  return content.some((s) => s.toLowerCase().includes(q));
}

export function doesTextMatchQuery(
  el: TextElement,
  labels: Record<string, LabelItem>,
  rawQuery: string
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;
  const labelName = el.labelId ? labels[el.labelId]?.name || '' : '';
  return (
    (el.text || '').toLowerCase().includes(q) ||
    (el.body || '').toLowerCase().includes(q) ||
    labelName.toLowerCase().includes(q)
  );
}

function buildSnippet(raw: string, query: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const idx = clean.toLowerCase().indexOf(query);
  if (idx <= 16) {
    return clean.length > 52 ? `${clean.slice(0, 51)}…` : clean;
  }
  const start = Math.max(0, idx - 14);
  const end = Math.min(clean.length, start + 52);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}

export const HeaderSearch: React.FC<HeaderSearchProps> = ({
  nodes,
  texts,
  labels,
  searchQuery,
  onSearchQueryChange,
  matchCount,
  totalNodeCount,
  focusSearchBinding = DEFAULT_KEYBOARD_SHORTCUTS.focusSearch,
  className = '',
  onSelectTarget,
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shortcutDisplay = useMemo(
    () => formatShortcutString(focusSearchBinding),
    [focusSearchBinding]
  );

  // Global configurable shortcut to focus canvas search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, focusSearchBinding)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusSearchBinding]);

  // Close dropdown on outside click / tap
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  const results = useMemo<SearchTarget[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const scored: { item: SearchTarget; score: number }[] = [];

    Object.values(nodes).forEach((node) => {
      const { title: rawTitle, content: contentSources } = getNodeSearchFields(node, labels);
      const displayTitle = rawTitle || t('search.untitledScene');
      const lowerTitle = rawTitle.toLowerCase();

      let score = -1;
      let snippet = '';

      if (lowerTitle && lowerTitle.startsWith(q)) {
        score = 0;
        snippet = contentSources[0] ? buildSnippet(contentSources[0], q) : '';
      } else if (lowerTitle && lowerTitle.includes(q)) {
        score = 1;
        snippet = contentSources[0] ? buildSnippet(contentSources[0], q) : '';
      } else {
        const matchedContent = contentSources.find((s) => s.toLowerCase().includes(q));
        if (matchedContent) {
          score = 2;
          snippet = buildSnippet(matchedContent, q);
        }
      }

      if (score >= 0) {
        scored.push({
          score,
          item: {
            id: node.id,
            kind: 'node',
            title: displayTitle,
            snippet,
            x: parseFloat(node.x) || 0,
            y: parseFloat(node.y) || 0,
            width: 220,
            height: 171,
          },
        });
      }
    });

    Object.values(texts).forEach((el) => {
      const title =
        el.text ||
        (el.mode === 'container'
          ? t('search.typeContainer')
          : el.mode === 'annotation'
          ? t('search.typeStickyNote')
          : t('search.typeText'));
      const lowerTitle = (el.text || '').toLowerCase();
      const labelName = el.labelId ? labels[el.labelId]?.name : '';
      const contentSources = [el.body, labelName].filter((s): s is string =>
        Boolean(s && s.trim())
      );

      let score = -1;
      let snippet = '';

      if (lowerTitle && lowerTitle.startsWith(q)) {
        score = 0;
        snippet = contentSources[0] ? buildSnippet(contentSources[0], q) : '';
      } else if (lowerTitle && lowerTitle.includes(q)) {
        score = 1;
        snippet = contentSources[0] ? buildSnippet(contentSources[0], q) : '';
      } else {
        const matchedContent = contentSources.find((s) => s.toLowerCase().includes(q));
        if (matchedContent) {
          score = 2;
          snippet = buildSnippet(matchedContent, q);
        }
      }

      if (score >= 0) {
        const w =
          el.mode === 'container'
            ? el.width || 340
            : el.mode === 'annotation'
            ? 220
            : 200;
        const h =
          el.mode === 'container'
            ? el.height || 240
            : el.mode === 'annotation'
            ? 120
            : 48;

        scored.push({
          score,
          item: {
            id: el.id,
            kind: el.mode,
            title,
            snippet,
            x: parseFloat(el.x) || 0,
            y: parseFloat(el.y) || 0,
            width: w,
            height: h,
          },
        });
      }
    });

    scored.sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title));
    return scored.slice(0, 12).map((s) => s.item);
  }, [searchQuery, nodes, texts, labels, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  const handleChoose = (target: SearchTarget) => {
    onSelectTarget(target);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIndex] || results[0];
      if (target) {
        handleChoose(target);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        setIsOpen(false);
      } else if (searchQuery) {
        onSearchQueryChange('');
        inputRef.current?.blur();
      } else {
        inputRef.current?.blur();
      }
    }
  };

  const getKindLabel = (kind: SearchTarget['kind']) => {
    if (kind === 'node') return t('search.typeNode');
    if (kind === 'container') return t('search.typeContainer');
    if (kind === 'annotation') return t('search.typeStickyNote');
    return t('search.typeText');
  };

  const renderKindIcon = (kind: SearchTarget['kind']) => {
    if (kind === 'node') return <ImageIcon className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />;
    if (kind === 'container') return <Layers className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0" />;
    if (kind === 'annotation') return <StickyNote className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />;
    return <Type className="w-3.5 h-3.5 text-[#5c584e] dark:text-neutral-300 shrink-0" />;
  };

  const hasFilter = searchQuery.trim().length > 0;

  return (
    <div ref={containerRef} className={`relative shrink-0 ${className}`}>
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#dcd7cc] dark:bg-neutral-800/90 border transition-colors w-36 sm:w-44 lg:w-52 xl:w-60 ${
          hasFilter
            ? 'border-sky-500/80 dark:border-sky-400/80'
            : 'border-[#c3beb1] dark:border-neutral-700/80 focus-within:border-blue-500'
        }`}
      >
        <Search
          className={`w-3.5 h-3.5 shrink-0 ${
            hasFilter
              ? 'text-sky-700 dark:text-sky-400'
              : 'text-[#635e54] dark:text-neutral-400'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onSearchQueryChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          aria-label={t('search.ariaLabel')}
          title={`${t('search.ariaLabel')} (${shortcutDisplay})`}
          className="w-full min-w-0 bg-transparent text-xs text-[#2b2924] dark:text-neutral-100 placeholder-[#757065] dark:placeholder-neutral-500 outline-none"
        />
        {searchQuery ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {hasFilter && matchCount !== undefined && totalNodeCount !== undefined && (
              <span
                className={`text-[10px] font-mono tabular-nums whitespace-nowrap ${
                  matchCount > 0
                    ? 'text-sky-700 dark:text-sky-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
                title={t('search.matchCountTitle', { match: matchCount, total: totalNodeCount })}
              >
                {matchCount}/{totalNodeCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                onSearchQueryChange('');
                inputRef.current?.focus();
              }}
              className="text-[#635e54] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white shrink-0 cursor-pointer"
              title={t('search.clearTitle')}
              aria-label={t('search.clearAria')}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span className="hidden xl:inline text-[10px] font-mono text-[#757065] dark:text-neutral-500 shrink-0">
            {shortcutDisplay}
          </span>
        )}
      </div>

      {isOpen && hasFilter && (
        <div className="absolute left-0 mt-1.5 w-80 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl py-1.5 z-50 text-xs">
          {results.length === 0 ? (
            <div className="px-3.5 py-4 text-center text-[#6e695d] dark:text-neutral-500">
              {t('search.noResults')}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {results.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleChoose(item)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/15 text-[#1f1d18] dark:bg-blue-600/20 dark:text-white'
                        : 'text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    <div className="mt-0.5">{renderKindIcon(item.kind)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-[#23211d] dark:text-neutral-100">{item.title}</div>
                      <div className="text-[11px] text-[#5c584e] dark:text-neutral-400 truncate mt-0.5 flex items-center gap-1.5">
                        <span>{getKindLabel(item.kind)}</span>
                        {item.snippet && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate text-[#757065] dark:text-neutral-500">{item.snippet}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
