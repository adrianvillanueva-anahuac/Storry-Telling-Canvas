import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Hash, PencilLine, Type, X } from 'lucide-react';
import { WorkflowNode } from '../../types/workflow';
import { useLanguage } from '../../hooks/useLanguage';
import {
  BatchRenameConfig,
  BatchRenameMode,
  BatchRenameSortOrder,
  computeBatchRenamePreview,
  SequenceTargetMode,
} from '../../utils/batchRename';

interface BatchRenameModalProps {
  nodes: WorkflowNode[];
  onClose: () => void;
  onApply: (renames: Array<{ nodeId: string; title: string }>) => void;
}

export const BatchRenameModal: React.FC<BatchRenameModalProps> = ({
  nodes,
  onClose,
  onApply,
}) => {
  const { t } = useLanguage();

  const [mode, setMode] = useState<BatchRenameMode>('prefix-suffix');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [sequenceTarget, setSequenceTarget] = useState<SequenceTargetMode>('replace-base');
  const [baseName, setBaseName] = useState(() => t('batchRename.defaultBaseName'));
  const [startNumber, setStartNumber] = useState(1);
  const [step, setStep] = useState(1);
  const [padDigits, setPadDigits] = useState(2);
  const [separator, setSeparator] = useState(' ');
  const [sortOrder, setSortOrder] = useState<BatchRenameSortOrder>('left-to-right');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const config: BatchRenameConfig = useMemo(
    () => ({
      mode,
      prefix,
      suffix,
      sequenceTarget,
      baseName,
      startNumber,
      step,
      padDigits,
      separator,
      sortOrder,
    }),
    [mode, prefix, suffix, sequenceTarget, baseName, startNumber, step, padDigits, separator, sortOrder]
  );

  const previewItems = useMemo(
    () => computeBatchRenamePreview(nodes, config),
    [nodes, config]
  );

  const changedItems = useMemo(
    () => previewItems.filter((item) => item.changed),
    [previewItems]
  );
  const hasBlankTitle = useMemo(
    () => previewItems.some((item) => item.newTitle.trim().length === 0),
    [previewItems]
  );

  const canApply = changedItems.length > 0 && !hasBlankTitle;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canApply) return;
    onApply(changedItems.map((item) => ({ nodeId: item.id, title: item.newTitle })));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-xl max-h-[90dvh] shadow-2xl flex flex-col overflow-hidden text-xs"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#d4cfc3] dark:border-neutral-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/12 dark:bg-sky-500/15 border border-blue-600/25 dark:border-sky-500/30 text-blue-700 dark:text-sky-400 flex items-center justify-center shrink-0">
              <PencilLine className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100">
                  {t('batchRename.title')}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-blue-600/12 dark:bg-sky-500/20 text-blue-800 dark:text-sky-300 text-[10px] font-semibold tabular-nums">
                  {t('batchRename.selectedBadge', { count: nodes.length })}
                </span>
              </div>
              <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 mt-0.5">
                {t('batchRename.subtitle', { count: nodes.length })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer shrink-0"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#dcd7cc]/90 dark:bg-neutral-950/80 border border-[#c6c0b3] dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setMode('prefix-suffix')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                mode === 'prefix-suffix'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d2ccbf] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>{t('batchRename.modePrefixSuffix')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('sequence')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                mode === 'sequence'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d2ccbf] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>{t('batchRename.modeSequence')}</span>
            </button>
          </div>

          {mode === 'prefix-suffix' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                  {t('batchRename.prefixLabel')}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder={t('batchRename.prefixPlaceholder')}
                  className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-2 text-[#2b2924] dark:text-neutral-100 placeholder-[#8b8579] dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                  {t('batchRename.suffixLabel')}
                </label>
                <input
                  type="text"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder={t('batchRename.suffixPlaceholder')}
                  className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-2 text-[#2b2924] dark:text-neutral-100 placeholder-[#8b8579] dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                  {t('batchRename.sequenceTargetLabel')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['replace-base', t('batchRename.targetReplaceBase')],
                      ['append-title', t('batchRename.targetAppendTitle')],
                      ['prepend-title', t('batchRename.targetPrependTitle')],
                    ] as Array<[SequenceTargetMode, string]>
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSequenceTarget(val)}
                      className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer text-center truncate ${
                        sequenceTarget === val
                          ? 'bg-blue-600/15 border-blue-600/50 text-blue-800 dark:bg-sky-500/20 dark:border-sky-400/50 dark:text-sky-300'
                          : 'bg-[#e0dbd0] hover:bg-[#d6d0c3] border-[#c3beb1] text-[#3a362e] dark:bg-neutral-800 dark:hover:bg-neutral-700/80 dark:border-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {sequenceTarget === 'replace-base' && (
                <div>
                  <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                    {t('batchRename.baseNameLabel')}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    placeholder={t('batchRename.baseNamePlaceholder')}
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-2 text-[#2b2924] dark:text-neutral-100 placeholder-[#8b8579] dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                    {t('batchRename.startNumberLabel')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={startNumber}
                    onChange={(e) =>
                      setStartNumber(Math.max(0, parseInt(e.target.value || '0', 10) || 0))
                    }
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-[#2b2924] dark:text-neutral-100 tabular-nums focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                    {t('batchRename.stepLabel')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={step}
                    onChange={(e) =>
                      setStep(Math.max(1, parseInt(e.target.value || '1', 10) || 1))
                    }
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-[#2b2924] dark:text-neutral-100 tabular-nums focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                    {t('batchRename.digitsLabel')}
                  </label>
                  <select
                    value={padDigits}
                    onChange={(e) => setPadDigits(parseInt(e.target.value, 10))}
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2 py-1.5 text-[#2b2924] dark:text-neutral-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value={1}>{t('batchRename.digitsOption', { digits: 1, example: '1, 2' })}</option>
                    <option value={2}>{t('batchRename.digitsOption', { digits: 2, example: '01, 02' })}</option>
                    <option value={3}>{t('batchRename.digitsOption', { digits: 3, example: '001, 002' })}</option>
                    <option value={4}>{t('batchRename.digitsOption', { digits: 4, example: '0001' })}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                    {t('batchRename.separatorLabel')}
                  </label>
                  <select
                    value={separator}
                    onChange={(e) => setSeparator(e.target.value)}
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2 py-1.5 text-[#2b2924] dark:text-neutral-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value=" ">{t('batchRename.sepSpace')}</option>
                    <option value=" - ">{t('batchRename.sepHyphen')}</option>
                    <option value="_">{t('batchRename.sepUnderscore')}</option>
                    <option value=".">{t('batchRename.sepDot')}</option>
                    <option value="">{t('batchRename.sepNone')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 mb-1">
                  {t('batchRename.sortOrderLabel')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['left-to-right', t('batchRename.sortLeftRight')],
                      ['top-to-bottom', t('batchRename.sortTopBottom')],
                      ['selection', t('batchRename.sortSelection')],
                    ] as Array<[BatchRenameSortOrder, string]>
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSortOrder(val)}
                      className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer text-center truncate ${
                        sortOrder === val
                          ? 'bg-blue-600/15 border-blue-600/50 text-blue-800 dark:bg-sky-500/20 dark:border-sky-400/50 dark:text-sky-300'
                          : 'bg-[#e0dbd0] hover:bg-[#d6d0c3] border-[#c3beb1] text-[#3a362e] dark:bg-neutral-800 dark:hover:bg-neutral-700/80 dark:border-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live Preview */}
          <div className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e2ddd2]/80 dark:bg-neutral-950/70 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#d4cfc3] dark:border-neutral-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                {t('batchRename.previewHeader')}
              </span>
              <span className="text-[11px] font-medium tabular-nums text-blue-700 dark:text-sky-400">
                {t('batchRename.previewChangedSummary', {
                  changed: changedItems.length,
                  total: previewItems.length,
                })}
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto divide-y divide-[#d8d3c7] dark:divide-neutral-800/80">
              {previewItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="px-3 py-2 flex items-center gap-2 text-[11px]"
                >
                  <span className="w-5 text-right font-mono text-[10px] text-[#7a7467] dark:text-neutral-500 tabular-nums shrink-0">
                    {idx + 1}.
                  </span>
                  <span
                    className={`truncate max-w-[38%] ${
                      item.changed
                        ? 'text-[#6c675b] dark:text-neutral-500 line-through'
                        : 'text-[#433f37] dark:text-neutral-300'
                    }`}
                    title={item.oldTitle}
                  >
                    {item.oldTitle}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#8b8579] dark:text-neutral-600 shrink-0" />
                  <span
                    className={`truncate flex-1 font-medium ${
                      item.newTitle.trim().length === 0
                        ? 'text-red-600 dark:text-red-400'
                        : item.changed
                        ? 'text-blue-800 dark:text-sky-300'
                        : 'text-[#6c675b] dark:text-neutral-400'
                    }`}
                    title={item.newTitle}
                  >
                    {item.newTitle || '""'}
                  </span>
                  {!item.changed && (
                    <span className="text-[10px] text-[#7a7467] dark:text-neutral-500 shrink-0">
                      {t('batchRename.unchangedTag')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {hasBlankTitle && (
            <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">
              {t('batchRename.blankTitleWarning')}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#d4cfc3] dark:border-neutral-800 bg-[#e4dfd4]/70 dark:bg-neutral-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg font-medium text-[#3a362e] hover:bg-[#d6d0c3] dark:text-neutral-300 dark:hover:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canApply}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              canApply
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer'
                : 'bg-[#cfc9bc] text-[#8b8579] dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            <PencilLine className="w-3.5 h-3.5" />
            <span>{t('batchRename.applyBtn', { count: changedItems.length })}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
