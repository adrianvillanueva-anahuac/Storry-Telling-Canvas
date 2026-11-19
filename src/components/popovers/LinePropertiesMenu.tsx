import React from 'react';
import { Connection, LineStrokePattern, ParallelArrowDirection } from '../../types/workflow';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Minus, RotateCcw, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface LinePropertiesMenuProps {
  connection: Connection;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate: (updates: Partial<Connection>) => void;
  onDelete: () => void;
}

export const LinePropertiesMenu: React.FC<LinePropertiesMenuProps> = ({
  connection,
  position,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const { t } = useLanguage();
  const activeType = connection.type || 'angle';
  const isParallel = connection.style === 'parallel';
  const hasBend =
    Math.abs(connection.angleOffset ?? 0) > 0.5 ||
    Math.hypot(connection.curveOffset?.x ?? 0, connection.curveOffset?.y ?? 0) > 0.5;
  const showCornerRadius =
    activeType === 'angle' ||
    (activeType === 'straight' &&
      Math.hypot(connection.curveOffset?.x ?? 0, connection.curveOffset?.y ?? 0) > 0.5);
  const effectiveCornerRadius =
    connection.cornerRadius ?? (activeType === 'angle' ? 10 : 0);

  const parallelArrows = connection.parallelArrows || {
    first: 'forward' as ParallelArrowDirection,
    second: 'backward' as ParallelArrowDirection,
  };
  const parallelStyles = connection.parallelStyles || {
    first: 'solid' as LineStrokePattern,
    second: 'solid' as LineStrokePattern,
  };
  const parallelLabelMode = connection.parallelLabelMode || 'single';
  const parallelLabels = connection.parallelLabels || {
    first: connection.label || '',
    second: '',
  };

  const estimatedHeight =
    (isParallel ? (parallelLabelMode === 'separate' ? 465 : 420) : 330) +
    (showCornerRadius ? 48 : 0) +
    (hasBend ? 36 : 0);

  const leftPos =
    typeof window !== 'undefined'
      ? Math.min(position.x + 10, window.innerWidth - 304)
      : position.x + 10;
  const topPos =
    typeof window !== 'undefined'
      ? Math.min(position.y + 10, window.innerHeight - estimatedHeight)
      : position.y + 10;

  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} onClick={onClose} />
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{ left: Math.max(8, leftPos), top: Math.max(8, topPos) }}
        className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl p-3 text-xs space-y-3 backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-[#d4cfc3] dark:border-neutral-800 pb-2">
          <span className="font-semibold text-[#2b2924] dark:text-neutral-200">{t('linePopover.title')}</span>
          <button onClick={onClose} className="p-1 text-[#635e54] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-[#5c584e] dark:text-neutral-400">
              {isParallel ? t('linePopover.labels') : t('linePopover.labelName')}
            </label>
            {isParallel && (
              <div className="inline-flex rounded-md border border-[#c3beb1] dark:border-neutral-700 bg-[#dcd7cc] dark:bg-neutral-800 p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => onUpdate({ parallelLabelMode: 'single' })}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    parallelLabelMode === 'single'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                >
                  {t('linePopover.modeSingle')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({
                      parallelLabelMode: 'separate',
                      parallelLabels: connection.parallelLabels || {
                        first: connection.label || '',
                        second: '',
                      },
                    })
                  }
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    parallelLabelMode === 'separate'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                >
                  {t('linePopover.modeSeparate')}
                </button>
              </div>
            )}
          </div>

          {isParallel && parallelLabelMode === 'separate' ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#5c584e] dark:text-neutral-400 w-10 shrink-0">{t('linePopover.line1')}</span>
                <input
                  type="text"
                  value={parallelLabels.first}
                  onChange={(e) =>
                    onUpdate({
                      parallelLabels: { ...parallelLabels, first: e.target.value },
                    })
                  }
                  placeholder={t('linePopover.line1Placeholder')}
                  className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 placeholder-[#757065] outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#5c584e] dark:text-neutral-400 w-10 shrink-0">{t('linePopover.line2')}</span>
                <input
                  type="text"
                  value={parallelLabels.second}
                  onChange={(e) =>
                    onUpdate({
                      parallelLabels: { ...parallelLabels, second: e.target.value },
                    })
                  }
                  placeholder={t('linePopover.line2Placeholder')}
                  className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 placeholder-[#757065] outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <input
              type="text"
              value={connection.label || ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder={t('linePopover.labelPlaceholder')}
              className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 placeholder-[#757065] outline-none focus:border-blue-500"
            />
          )}
        </div>

        <div>
          <label className="text-[11px] text-[#5c584e] dark:text-neutral-400 block mb-1">{t('linePopover.lineType')}</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onUpdate({ type: 'curve' })}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1.5 rounded-md border text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeType === 'curve'
                  ? 'bg-blue-600/15 border-blue-600 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500 dark:text-blue-300'
                  : 'bg-[#dcd7cc] border-[#c3beb1] text-[#3a362e] hover:border-[#a8a293] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              <svg viewBox="0 0 24 14" className="w-5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M 3 11 C 11 11, 13 3, 21 3" />
              </svg>
              <span>{t('linePopover.curve')}</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdate({ type: 'angle' })}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1.5 rounded-md border text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeType === 'angle'
                  ? 'bg-blue-600/15 border-blue-600 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500 dark:text-blue-300'
                  : 'bg-[#dcd7cc] border-[#c3beb1] text-[#3a362e] hover:border-[#a8a293] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              <svg viewBox="0 0 24 14" className="w-5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M 3 11 L 9 11 Q 12 11 12 8 L 12 6 Q 12 3 15 3 L 21 3" />
              </svg>
              <span>{t('linePopover.angle')}</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdate({ type: 'straight' })}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1.5 rounded-md border text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeType === 'straight'
                  ? 'bg-blue-600/15 border-blue-600 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500 dark:text-blue-300'
                  : 'bg-[#dcd7cc] border-[#c3beb1] text-[#3a362e] hover:border-[#a8a293] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              <svg viewBox="0 0 24 14" className="w-5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M 3 11 L 21 3" />
              </svg>
              <span>{t('linePopover.straight')}</span>
            </button>
          </div>

          {showCornerRadius && (
            <div className="mt-2 pt-2 border-t border-[#d4cfc3]/70 dark:border-neutral-800/80">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-[#5c584e] dark:text-neutral-400">
                  {t('linePopover.cornerRadius')}
                </label>
                <span className="font-mono text-[10px] text-[#5c584e] dark:text-neutral-400">
                  {effectiveCornerRadius}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={28}
                step={1}
                value={effectiveCornerRadius}
                onChange={(e) => onUpdate({ cornerRadius: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer h-1.5"
              />
            </div>
          )}

          {hasBend && (
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  angleOffset: undefined,
                  curveOffset: undefined,
                })
              }
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700/80 border border-[#c3beb1] dark:border-neutral-700 rounded-md text-[11px] font-medium text-[#3a362e] dark:text-neutral-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('linePopover.resetRoute')}</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-[#5c584e] dark:text-neutral-400 block mb-1">{t('linePopover.lineStyle')}</label>
              <select
                value={connection.style || 'solid'}
                onChange={(e) => {
                  const nextStyle = e.target.value as 'solid' | 'dotted' | 'dashed' | 'parallel';
                  if (nextStyle === 'parallel') {
                    onUpdate({
                      style: 'parallel',
                      parallelArrows: connection.parallelArrows || {
                        first: 'forward',
                        second: 'backward',
                      },
                      parallelStyles: connection.parallelStyles || {
                        first: 'solid',
                        second: 'solid',
                      },
                      parallelLabelMode: connection.parallelLabelMode || 'single',
                    });
                  } else {
                    onUpdate({ style: nextStyle });
                  }
                }}
                className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
              >
                <option value="solid" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.continued')}</option>
                <option value="dotted" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.dotted')}</option>
                <option value="dashed" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.dashed')}</option>
                <option value="parallel" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.parallelLines')}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#5c584e] dark:text-neutral-400 block mb-1">{t('linePopover.arrows')}</label>
              {isParallel ? (
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({
                      parallelArrows: {
                        first: parallelArrows.second,
                        second: parallelArrows.first,
                      },
                    })
                  }
                  className="w-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700/80 border border-[#c3beb1] dark:border-neutral-700 hover:border-[#a8a293] dark:hover:border-neutral-600 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 text-[11px] font-medium transition-colors cursor-pointer"
                  title={t('linePopover.swapLinesTitle')}
                >
                  {t('linePopover.swapLines')}
                </button>
              ) : (
                <select
                  value={connection.arrows || 'end'}
                  onChange={(e) =>
                    onUpdate({ arrows: e.target.value as 'none' | 'start' | 'end' | 'both' })
                  }
                  className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
                >
                  <option value="none" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.arrowNone')}</option>
                  <option value="end" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.arrowEndOnly')}</option>
                  <option value="start" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.arrowStartOnly')}</option>
                  <option value="both" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.arrowBothEnds')}</option>
                </select>
              )}
            </div>
          </div>

          {isParallel && (
            <div className="bg-[#e0dbd0] dark:bg-neutral-950/70 border border-[#c8c3b6] dark:border-neutral-800 rounded-lg p-2 space-y-1.5">
              {(
                [
                  { key: 'first', label: t('linePopover.line1') },
                  { key: 'second', label: t('linePopover.line2') },
                ] as const
              ).map(({ key, label }) => {
                const currentDir = parallelArrows[key];
                const currentPattern = parallelStyles[key];
                const dirOptions: {
                  value: ParallelArrowDirection;
                  title: string;
                  icon: React.ReactNode;
                }[] = [
                  {
                    value: 'forward',
                    title: t('linePopover.dirForward'),
                    icon: <ArrowRight className="w-3.5 h-3.5" />,
                  },
                  {
                    value: 'backward',
                    title: t('linePopover.dirBackward'),
                    icon: <ArrowLeft className="w-3.5 h-3.5" />,
                  },
                  {
                    value: 'both',
                    title: t('linePopover.arrowBothEnds'),
                    icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
                  },
                  {
                    value: 'none',
                    title: t('linePopover.dirNoArrow'),
                    icon: <Minus className="w-3.5 h-3.5" />,
                  },
                ];

                return (
                  <div key={key} className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] text-[#3a362e] dark:text-neutral-300 font-medium w-10 shrink-0">
                      {label}
                    </span>

                    <select
                      value={currentPattern}
                      onChange={(e) =>
                        onUpdate({
                          parallelStyles: {
                            ...parallelStyles,
                            [key]: e.target.value as LineStrokePattern,
                          },
                        })
                      }
                      aria-label={t('linePopover.lineStyleAria', { label })}
                      className="bg-[#ebe7de] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded px-1.5 py-0.5 text-[11px] text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500 flex-1 min-w-0"
                    >
                      <option value="solid" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.continued')}</option>
                      <option value="dotted" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.dotted')}</option>
                      <option value="dashed" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('linePopover.dashed')}</option>
                    </select>

                    <div className="grid grid-cols-4 gap-1 shrink-0">
                      {dirOptions.map((opt) => {
                        const selected = currentDir === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              onUpdate({
                                parallelArrows: {
                                  ...parallelArrows,
                                  [key]: opt.value,
                                },
                              })
                            }
                            title={opt.title}
                            className={`p-1 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                              selected
                                ? 'bg-blue-600/15 border-blue-600 text-blue-800 dark:bg-blue-600/25 dark:border-blue-500 dark:text-blue-300'
                                : 'bg-[#ebe7de] border-[#c3beb1] text-[#5c584e] hover:text-[#1f1d18] hover:border-[#a8a293] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-neutral-600'
                            }`}
                          >
                            {opt.icon}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[11px] text-[#5c584e] dark:text-neutral-400">{t('linePopover.lineColor')}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={connection.color || '#0052cc'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[10px] text-[#5c584e] dark:text-neutral-400">{connection.color}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-[#d4cfc3] dark:border-neutral-800 flex justify-end">
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-600/15 hover:bg-red-600/25 dark:bg-red-600/20 dark:hover:bg-red-600/30 text-red-700 dark:text-red-400 border border-red-600/30 dark:border-red-500/30 rounded-md font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('linePopover.removeConnection')}</span>
          </button>
        </div>
      </div>
    </>
  );
};
