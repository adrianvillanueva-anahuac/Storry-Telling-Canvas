import React, { useMemo, useState } from 'react';
import { LabelItem, TextElement, WorkflowNode } from '../../types/workflow';
import {
  Check,
  Filter,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getContrastTextColor } from '../../utils/colorContrast';

const LABEL_COLOR_PRESETS = [
  '#2563eb',
  '#0284c7',
  '#059669',
  '#d97706',
  '#dc2626',
  '#e11d48',
  '#7c3aed',
  '#475569',
];

interface LabelManagerModalProps {
  labels: Record<string, LabelItem>;
  nodes: Record<string, WorkflowNode>;
  texts: Record<string, TextElement>;
  isReadOnly: boolean;
  activeFilterLabelIds: string[];
  onClose: () => void;
  onAddLabel: (name: string, color: string) => void;
  onUpdateLabel: (id: string, name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
  onSeedStarterLabels: () => void;
  onToggleFilterLabel: (id: string) => void;
  onClearFilter: () => void;
}

export const LabelManagerModal: React.FC<LabelManagerModalProps> = ({
  labels,
  nodes,
  texts,
  isReadOnly,
  activeFilterLabelIds,
  onClose,
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
  onSeedStarterLabels,
  onToggleFilterLabel,
  onClearFilter,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#2563eb');

  const usageByLabelId = useMemo(() => {
    const counts: Record<string, { nodes: number; texts: number }> = {};
    Object.values(nodes).forEach((n) => {
      if (!n.labelId) return;
      if (!counts[n.labelId]) counts[n.labelId] = { nodes: 0, texts: 0 };
      counts[n.labelId].nodes += 1;
    });
    Object.values(texts).forEach((el) => {
      if (!el.labelId) return;
      if (!counts[el.labelId]) counts[el.labelId] = { nodes: 0, texts: 0 };
      counts[el.labelId].texts += 1;
    });
    return counts;
  }, [nodes, texts]);

  const sortedLabels = useMemo(
    () =>
      Object.entries(labels).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [labels]
  );

  const handleAdd = () => {
    if (isReadOnly) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddLabel(trimmed, color);
    setName('');
  };

  const startEdit = (id: string, lbl: LabelItem) => {
    if (isReadOnly) return;
    setEditingId(id);
    setEditName(lbl.name);
    setEditColor(lbl.color || '#2563eb');
  };

  const saveEdit = () => {
    if (!editingId || isReadOnly) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    onUpdateLabel(editingId, trimmed, editColor);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const previewTextColor = getContrastTextColor(color);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/15 dark:bg-blue-600/20 border border-blue-600/30 dark:border-blue-500/30 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0">
                <Tag className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-[#2b2924] dark:text-neutral-100 text-sm">
                {t('labels.title')}
              </h3>
            </div>
            <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 mt-1.5 leading-relaxed">
              {t('labels.subtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create new label section */}
        {isReadOnly ? (
          <div className="mx-5 mt-4 px-3 py-2.5 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 text-[11px] text-[#5c584e] dark:text-neutral-400">
            {t('labels.readOnlyNotice')}
          </div>
        ) : (
          <div className="p-5 pb-4 border-b border-[#d4cfc3] dark:border-neutral-800 space-y-3 bg-[#e6e1d7]/60 dark:bg-neutral-950/40">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title={t('labels.customColor')}
                className="w-9 h-9 rounded-lg border border-[#c3beb1] dark:border-neutral-700 bg-transparent cursor-pointer shrink-0 p-0.5"
              />
              <input
                type="text"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
                placeholder={t('labels.newPlaceholder')}
                className="flex-1 min-w-0 bg-[#ebe7de] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder-[#757065] outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!name.trim()}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('common.add')}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-medium text-[#6e695d] dark:text-neutral-500 mr-0.5">
                  {t('labels.presets')}:
                </span>
                {LABEL_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    style={{ backgroundColor: preset }}
                    title={preset}
                    className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                      color.toLowerCase() === preset.toLowerCase()
                        ? 'border-white ring-2 ring-blue-500 scale-110'
                        : 'border-black/20 dark:border-white/20 hover:scale-110'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#6e695d] dark:text-neutral-500">
                  {t('labels.previewBadge')}:
                </span>
                <span
                  style={{ backgroundColor: color, color: previewTextColor }}
                  className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold shadow-sm max-w-[140px] truncate"
                >
                  {name.trim() || t('labels.previewBadge')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Active filter bar inside modal if any */}
        {activeFilterLabelIds.length > 0 && (
          <div className="px-5 py-2 bg-blue-600/10 dark:bg-blue-500/10 border-b border-blue-600/20 dark:border-blue-500/25 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-blue-800 dark:text-blue-300 font-medium flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              <span>
                {t('labels.activeFilterBtn')} ({activeFilterLabelIds.length})
              </span>
            </span>
            <button
              type="button"
              onClick={onClearFilter}
              className="text-blue-700 dark:text-blue-300 hover:underline font-semibold cursor-pointer whitespace-nowrap"
            >
              {t('labels.clearFilter')}
            </button>
          </div>
        )}

        {/* Label list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {sortedLabels.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-xs text-[#6e695d] dark:text-neutral-500">
                {t('labels.empty')}
              </p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={onSeedStarterLabels}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-xs font-semibold text-[#2b2924] dark:text-neutral-200 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{t('labels.addStarters')}</span>
                </button>
              )}
            </div>
          ) : (
            sortedLabels.map(([id, lbl]) => {
              const isEditing = editingId === id;
              const isFilteringThis = activeFilterLabelIds.includes(id);
              const usage = usageByLabelId[id];
              const totalUsage = (usage?.nodes || 0) + (usage?.texts || 0);
              const badgeFg = getContrastTextColor(lbl.color);

              if (isEditing) {
                return (
                  <div
                    key={id}
                    className="p-3 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-blue-500/60 space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-8 h-8 rounded-md border border-[#c3beb1] dark:border-neutral-700 bg-transparent cursor-pointer shrink-0 p-0.5"
                      />
                      <input
                        type="text"
                        maxLength={60}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                        className="flex-1 min-w-0 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!editName.trim()}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('common.save')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-2.5 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#3a362e] dark:text-neutral-300 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pl-10">
                      {LABEL_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditColor(preset)}
                          style={{ backgroundColor: preset }}
                          className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                            editColor.toLowerCase() === preset.toLowerCase()
                              ? 'border-white ring-2 ring-blue-500 scale-110'
                              : 'border-black/20 dark:border-white/20 hover:scale-110'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800/90 hover:border-[#b3ad9e] dark:hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      style={{ backgroundColor: lbl.color, color: badgeFg }}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm truncate max-w-[180px]"
                    >
                      {lbl.name}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[#6e695d] dark:text-neutral-500 whitespace-nowrap">
                      {totalUsage > 0
                        ? t('labels.usageCount', {
                            nodes: usage?.nodes || 0,
                            texts: usage?.texts || 0,
                          })
                        : t('labels.usageNone')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleFilterLabel(id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${
                        isFilteringThis
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-[#ebe7de] hover:bg-[#dcd7cc] dark:bg-neutral-900 dark:hover:bg-neutral-800 text-[#4a463d] dark:text-neutral-300 border-[#c3beb1] dark:border-neutral-700'
                      }`}
                      title={t('labels.filterBtn')}
                    >
                      <Filter className="w-3 h-3" />
                      <span className="hidden sm:inline">
                        {isFilteringThis ? t('labels.activeFilterBtn') : t('labels.filterBtn')}
                      </span>
                    </button>

                    {!isReadOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(id, lbl)}
                          className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d2ccbf] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                          title={t('labels.editTitle')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLabel(id)}
                          className="p-1.5 text-[#5c584e] hover:text-red-700 hover:bg-[#d2ccbf] dark:text-neutral-400 dark:hover:text-red-400 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                          title={t('labels.deleteTitle')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
