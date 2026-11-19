import React, { useMemo, useState } from 'react';
import { LabelItem, TextElement, WorkflowNode } from '../types/workflow';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Settings2,
  Tag,
  X,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { getContrastTextColor } from '../utils/colorContrast';

export const UNLABELED_FILTER_ID = '__unlabeled__';

interface LabelFilterBarProps {
  labels: Record<string, LabelItem>;
  nodes: Record<string, WorkflowNode>;
  texts: Record<string, TextElement>;
  activeFilterIds: string[];
  filterDisplayMode: 'dim' | 'isolate';
  matchedCounts: { nodes: number; texts: number };
  onToggleLabelFilter: (labelId: string) => void;
  onClearFilter: () => void;
  onChangeDisplayMode: (mode: 'dim' | 'isolate') => void;
  onFitFiltered: () => void;
  onOpenLabelManager: () => void;
}

export const LabelFilterBar: React.FC<LabelFilterBarProps> = ({
  labels,
  nodes,
  texts,
  activeFilterIds,
  filterDisplayMode,
  matchedCounts,
  onToggleLabelFilter,
  onClearFilter,
  onChangeDisplayMode,
  onFitFiltered,
  onOpenLabelManager,
}) => {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  const stats = useMemo(() => {
    const byLabel: Record<string, number> = {};
    let unlabeledCount = 0;

    Object.values(nodes).forEach((n) => {
      if (n.labelId && labels[n.labelId]) {
        byLabel[n.labelId] = (byLabel[n.labelId] || 0) + 1;
      } else {
        unlabeledCount += 1;
      }
    });

    Object.values(texts).forEach((el) => {
      if (el.labelId && labels[el.labelId]) {
        byLabel[el.labelId] = (byLabel[el.labelId] || 0) + 1;
      } else {
        unlabeledCount += 1;
      }
    });

    return { byLabel, unlabeledCount };
  }, [labels, nodes, texts]);

  const sortedLabels = useMemo(
    () =>
      Object.entries(labels).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [labels]
  );

  const hasActiveFilter = activeFilterIds.length > 0;

  if (sortedLabels.length === 0 && !hasActiveFilter) {
    return (
      <div
        data-canvas-ui="true"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 z-20"
      >
        <button
          type="button"
          onClick={onOpenLabelManager}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#ebe7de]/92 dark:bg-neutral-900/92 hover:bg-[#e0dbd0] dark:hover:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700/80 shadow-lg backdrop-blur-md text-[11px] font-medium text-[#3a362e] dark:text-neutral-200 whitespace-nowrap cursor-pointer transition-colors"
          title={t('header.labelsTitle')}
        >
          <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{t('labelFilter.title')}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-canvas-ui="true"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-3 left-3 z-20 max-w-[calc(100vw-1.5rem)] flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-1.5 flex-wrap bg-[#ebe7de]/94 dark:bg-neutral-900/94 backdrop-blur-md border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-xl p-1.5 text-[11px]">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#dcd7cc] dark:hover:bg-neutral-800 text-[#3a362e] dark:text-neutral-200 font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          title={collapsed ? t('labelFilter.expand') : t('labelFilter.collapse')}
        >
          <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{t('labelFilter.title')}</span>
          {hasActiveFilter && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold tabular-nums">
              {activeFilterIds.length}
            </span>
          )}
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-[#635e54] dark:text-neutral-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-[#635e54] dark:text-neutral-400" />
          )}
        </button>

        {!collapsed && (
          <>
            <div className="h-4 w-px bg-[#c3beb1] dark:bg-neutral-700/80 shrink-0" />

            <button
              type="button"
              onClick={onClearFilter}
              className={`px-2 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !hasActiveFilter
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#433f37] hover:bg-[#dcd7cc] dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {t('labelFilter.all')}
            </button>

            {sortedLabels.map(([id, lbl]) => {
              const isActive = activeFilterIds.includes(id);
              const count = stats.byLabel[id] || 0;
              const activeTextColor = getContrastTextColor(lbl.color);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggleLabelFilter(id)}
                  style={
                    isActive
                      ? { backgroundColor: lbl.color, color: activeTextColor, borderColor: lbl.color }
                      : undefined
                  }
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'shadow-sm'
                      : 'bg-[#e0dbd0] hover:bg-[#d6d0c4] dark:bg-neutral-950/70 dark:hover:bg-neutral-800 text-[#2b2924] dark:text-neutral-200 border-[#c8c3b6] dark:border-neutral-800'
                  }`}
                >
                  <span
                    style={{
                      backgroundColor: isActive ? activeTextColor : lbl.color,
                    }}
                    className="w-2 h-2 rounded-full shrink-0"
                  />
                  <span className="max-w-[120px] truncate">{lbl.name}</span>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      isActive ? 'opacity-85' : 'text-[#6e695d] dark:text-neutral-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onToggleLabelFilter(UNLABELED_FILTER_ID)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeFilterIds.includes(UNLABELED_FILTER_ID)
                  ? 'bg-neutral-700 text-white border-neutral-600 shadow-sm'
                  : 'bg-[#e0dbd0] hover:bg-[#d6d0c4] dark:bg-neutral-950/70 dark:hover:bg-neutral-800 text-[#5c584e] dark:text-neutral-400 border-[#c8c3b6] dark:border-neutral-800'
              }`}
            >
              <span>{t('labelFilter.unlabeled')}</span>
              <span className="font-mono text-[10px] tabular-nums opacity-75">
                {stats.unlabeledCount}
              </span>
            </button>

            <div className="h-4 w-px bg-[#c3beb1] dark:bg-neutral-700/80 shrink-0" />

            <button
              type="button"
              onClick={onOpenLabelManager}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[#433f37] hover:text-[#1f1d18] hover:bg-[#dcd7cc] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              title={t('header.labelsTitle')}
            >
              <Settings2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span className="hidden sm:inline">{t('labelFilter.manage')}</span>
            </button>
          </>
        )}
      </div>

      {/* Secondary filter controls bar when filtering is active */}
      {!collapsed && hasActiveFilter && (
        <div className="self-start flex items-center gap-2 flex-wrap bg-[#ebe7de]/94 dark:bg-neutral-900/94 backdrop-blur-md border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-lg px-2.5 py-1 text-[11px]">
          <span className="font-mono tabular-nums text-[#433f37] dark:text-neutral-300 whitespace-nowrap">
            {t('labelFilter.matchSummary', {
              nodes: matchedCounts.nodes,
              texts: matchedCounts.texts,
            })}
          </span>

          <div className="inline-flex items-center rounded-lg bg-[#dcd7cc] dark:bg-neutral-950 border border-[#c6c0b3] dark:border-neutral-800 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onChangeDisplayMode('dim')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                filterDisplayMode === 'dim'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{t('labelFilter.dim')}</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeDisplayMode('isolate')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                filterDisplayMode === 'isolate'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <EyeOff className="w-3 h-3" />
              <span>{t('labelFilter.isolate')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onFitFiltered}
            disabled={matchedCounts.nodes + matchedCounts.texts === 0}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-45 disabled:cursor-not-allowed text-[#2b2924] dark:text-neutral-200 font-medium whitespace-nowrap cursor-pointer transition-colors"
            title={t('labelFilter.fitTitle')}
          >
            <Maximize2 className="w-3 h-3 text-blue-700 dark:text-blue-400" />
            <span>{t('labelFilter.fit')}</span>
          </button>

          <button
            type="button"
            onClick={onClearFilter}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#dcd7cc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 font-medium whitespace-nowrap cursor-pointer transition-colors"
          >
            <X className="w-3 h-3" />
            <span>{t('labelFilter.clear')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
