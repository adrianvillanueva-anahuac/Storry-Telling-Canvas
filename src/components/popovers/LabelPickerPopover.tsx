import React, { useMemo } from 'react';
import { LabelItem } from '../../types/workflow';
import { Check, Settings2, Tag, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface LabelPickerPopoverProps {
  labels: Record<string, LabelItem>;
  currentLabelId?: string;
  selectedCount?: number;
  position: { x: number; y: number };
  isReadOnly?: boolean;
  onSelectLabel: (labelId: string) => void;
  onOpenLabelManager: () => void;
  onClose: () => void;
}

export const LabelPickerPopover: React.FC<LabelPickerPopoverProps> = ({
  labels,
  currentLabelId = '',
  selectedCount = 1,
  position,
  isReadOnly = false,
  onSelectLabel,
  onOpenLabelManager,
  onClose,
}) => {
  const { t } = useLanguage();

  const sortedLabels = useMemo(
    () =>
      Object.entries(labels).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [labels]
  );

  const leftPos =
    typeof window !== 'undefined'
      ? Math.min(Math.max(8, position.x + 8), Math.max(8, window.innerWidth - 252))
      : position.x + 8;
  const topPos =
    typeof window !== 'undefined'
      ? Math.min(Math.max(8, position.y + 8), Math.max(8, window.innerHeight - 320))
      : position.y + 8;

  const title =
    selectedCount > 1
      ? t('labelPicker.batchTitle', { count: selectedCount })
      : t('labelPicker.title');

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onPointerDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        data-canvas-ui="true"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{ left: leftPos, top: topPos }}
        className="fixed z-50 w-60 max-w-[calc(100vw-1rem)] bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl overflow-hidden text-xs backdrop-blur-md"
      >
        <div className="px-3 py-2 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-[#2b2924] dark:text-neutral-200 truncate">
            <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 text-[#635e54] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                onSelectLabel('');
                onClose();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                selectedCount === 1 && !currentLabelId
                  ? 'bg-blue-600/15 text-blue-800 dark:bg-blue-600/20 dark:text-blue-300 font-semibold'
                  : 'text-[#5c584e] hover:bg-[#dfdacf] dark:text-neutral-400 dark:hover:bg-neutral-800'
              }`}
            >
              <span>{t('labelPicker.none')}</span>
              {selectedCount === 1 && !currentLabelId && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          )}

          {sortedLabels.length === 0 ? (
            <div className="px-2.5 py-4 text-center text-[11px] text-[#6e695d] dark:text-neutral-500">
              {t('labelPicker.empty')}
            </div>
          ) : (
            sortedLabels.map(([id, lbl]) => {
              const isSelected = selectedCount === 1 && currentLabelId === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => {
                    onSelectLabel(id);
                    onClose();
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                    isReadOnly ? 'cursor-default opacity-80' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-blue-600/15 text-[#1f1d18] dark:bg-blue-600/20 dark:text-white font-semibold'
                      : 'text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      style={{ backgroundColor: lbl.color }}
                      className="w-3 h-3 rounded-full shrink-0 border border-black/15 dark:border-white/20"
                    />
                    <span className="truncate">{lbl.name}</span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="p-1.5 border-t border-[#d4cfc3] dark:border-neutral-800 bg-[#e6e1d7]/70 dark:bg-neutral-950/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLabelManager();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:bg-[#dcd7cc] dark:hover:bg-neutral-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{t('labelPicker.manage')}</span>
          </button>
        </div>
      </div>
    </>
  );
};
