import React from 'react';
import { LabelItem, TextElement } from '../../types/workflow';
import { Bold, Italic, RotateCcw, Tag, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface TextPropertiesMenuProps {
  element: TextElement;
  labels: Record<string, LabelItem>;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate: (updates: Partial<TextElement>) => void;
  onOpenLabelManager: () => void;
}

const COLOR_PRESETS: Record<TextElement['mode'], string[]> = {
  floating: ['#e2e8f0', '#1f1d18', '#38bdf8', '#f59e0b', '#10b981', '#f43f5e', '#a855f7'],
  annotation: ['#d97706', '#2563eb', '#10b981', '#f43f5e', '#8b5cf6', '#64748b'],
  container: ['#0052cc', '#0284c7', '#059669', '#d97706', '#e11d48', '#7c3aed', '#475569'],
};

export const TextPropertiesMenu: React.FC<TextPropertiesMenuProps> = ({
  element,
  labels,
  position,
  onClose,
  onUpdate,
  onOpenLabelManager,
}) => {
  const { t } = useLanguage();
  const isBoldActive = element.mode === 'container' ? element.bold !== false : Boolean(element.bold);
  const currentFontSize =
    element.mode === 'annotation'
      ? Math.max(11, Math.min(28, element.size || 12))
      : element.size || (element.mode === 'container' ? 14 : 24);
  const presets = COLOR_PRESETS[element.mode];
  const colorValue =
    element.mode === 'annotation'
      ? element.color && element.color !== '#0052cc'
        ? element.color
        : '#d97706'
      : element.color || '#0052cc';

  const headerTitle =
    element.mode === 'container'
      ? t('textPopover.titleContainer')
      : element.mode === 'annotation'
      ? t('textPopover.titleAnnotation')
      : t('textPopover.titleFloating');

  const leftPos =
    typeof window !== 'undefined'
      ? Math.min(position.x + 10, window.innerWidth - 276)
      : position.x + 10;
  const topPos =
    typeof window !== 'undefined'
      ? Math.min(position.y + 10, window.innerHeight - 360)
      : position.y + 10;

  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} onClick={onClose} />
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{ left: Math.max(8, leftPos), top: Math.max(8, topPos) }}
        className="fixed z-50 w-64 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl p-3 text-xs space-y-3 backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-[#d4cfc3] dark:border-neutral-800 pb-2">
          <span className="font-semibold text-[#2b2924] dark:text-neutral-200">{headerTitle}</span>
          <button onClick={onClose} className="p-1 text-[#635e54] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {element.mode === 'container' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-[#5c584e] dark:text-neutral-400">{t('textPopover.categoryLabel')}</label>
              <button
                onClick={onOpenLabelManager}
                className="text-[10px] text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Tag className="w-3 h-3" />
                <span>{t('textPopover.manageLabels')}</span>
              </button>
            </div>
            <select
              value={element.labelId || ''}
              onChange={(e) => {
                const nextLabelId = e.target.value;
                const nextLabel = nextLabelId ? labels[nextLabelId] : undefined;
                onUpdate(
                  nextLabel
                    ? { labelId: nextLabelId, color: nextLabel.color }
                    : { labelId: '' }
                );
              }}
              className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
            >
              <option value="" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('common.none')}</option>
              {Object.entries(labels).map(([id, lbl]) => (
                <option key={id} value={id} className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                  {lbl.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-[#5c584e] dark:text-neutral-400">{t('textPopover.color')}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorValue}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="font-mono text-[10px] text-[#5c584e] dark:text-neutral-400">
                {element.mode === 'annotation' && (!element.color || element.color === '#0052cc')
                  ? t('textPopover.defaultColor')
                  : colorValue}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {element.mode === 'annotation' && (
              <button
                type="button"
                onClick={() => onUpdate({ color: '' })}
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-transform cursor-pointer bg-[#e9e1c9] dark:bg-amber-950/90 ${
                  !element.color || element.color === '#0052cc'
                    ? 'border-sky-500 ring-2 ring-sky-400/50 scale-110'
                    : 'border-[#c9bd98] dark:border-amber-700 hover:scale-110'
                }`}
                title={t('textPopover.defaultColor')}
              >
                <RotateCcw className="w-2.5 h-2.5 text-[#5c584e] dark:text-amber-200" />
              </button>
            )}
            {presets.map((swatch) => {
              const isActive =
                element.mode === 'annotation'
                  ? element.color === swatch
                  : element.color?.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => onUpdate({ color: swatch })}
                  style={{ backgroundColor: swatch }}
                  className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                    isActive
                      ? 'border-white ring-2 ring-sky-400 scale-110'
                      : 'border-black/20 dark:border-white/20 hover:scale-110'
                  }`}
                  title={swatch}
                />
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-[#5c584e] dark:text-neutral-400 block mb-1">
            {t('textPopover.fontSize', { size: currentFontSize })}
          </label>
          <input
            type="range"
            min={element.mode === 'annotation' ? 11 : 12}
            max={element.mode === 'annotation' ? 28 : 72}
            value={currentFontSize}
            onChange={(e) => onUpdate({ size: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-600 dark:accent-blue-500"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="text-[11px] text-[#5c584e] dark:text-neutral-400">{t('textPopover.formatting')}</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdate({ bold: !isBoldActive })}
              className={`p-1.5 rounded border transition-colors cursor-pointer ${
                isBoldActive
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#dcd7cc] text-[#3a362e] border-[#c3beb1] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700'
              }`}
              title={t('textPopover.bold')}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdate({ italic: !element.italic })}
              className={`p-1.5 rounded border transition-colors cursor-pointer ${
                element.italic
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#dcd7cc] text-[#3a362e] border-[#c3beb1] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700'
              }`}
              title={t('textPopover.italic')}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

