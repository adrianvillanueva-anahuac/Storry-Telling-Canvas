import React from 'react';
import { LabelItem, TextElement } from '../../types/workflow';
import { Bold, Italic, Tag, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface TextPropertiesMenuProps {
  element: TextElement;
  labels: Record<string, LabelItem>;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate: (updates: Partial<TextElement>) => void;
  onOpenLabelManager: () => void;
}

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
          <span className="font-semibold text-[#2b2924] dark:text-neutral-200">{t('textPopover.title')}</span>
          <button onClick={onClose} className="p-1 text-[#635e54] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-[11px] text-[#5c584e] dark:text-neutral-400 block mb-1">{t('textPopover.functionMode')}</label>
          <select
            value={element.mode}
            onChange={(e) => onUpdate({ mode: e.target.value as 'floating' | 'annotation' | 'container' })}
            className="w-full bg-[#e0dbd0] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
          >
            <option value="floating" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('textPopover.modeFloating')}</option>
            <option value="annotation" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('textPopover.modeAnnotation')}</option>
            <option value="container" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('textPopover.modeContainer')}</option>
          </select>
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

        <div className="flex items-center justify-between">
          <label className="text-[11px] text-[#5c584e] dark:text-neutral-400">{t('textPopover.color')}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={element.color || '#0052cc'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[10px] text-[#5c584e] dark:text-neutral-400">{element.color}</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-[#5c584e] dark:text-neutral-400 block mb-1">{t('textPopover.fontSize', { size: element.size || 14 })}</label>
          <input
            type="range"
            min={12}
            max={72}
            value={element.size || 14}
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
