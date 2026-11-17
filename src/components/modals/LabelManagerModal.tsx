import React, { useState } from 'react';
import { LabelItem } from '../../types/workflow';
import { Plus, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface LabelManagerModalProps {
  labels: Record<string, LabelItem>;
  onClose: () => void;
  onAddLabel: (name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
}

export const LabelManagerModal: React.FC<LabelManagerModalProps> = ({
  labels,
  onClose,
  onAddLabel,
  onDeleteLabel,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');

  const handleAdd = () => {
    if (name.trim()) {
      onAddLabel(name.trim(), color);
      setName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#d4cfc3] dark:border-neutral-800 pb-3">
          <h3 className="font-semibold text-[#2b2924] dark:text-neutral-100 text-sm">{t('labels.title')}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add new label input */}
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-9 h-9 rounded-lg border-0 bg-transparent cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={t('labels.newPlaceholder')}
            className="flex-1 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder-[#757065] outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('common.add')}</span>
          </button>
        </div>

        {/* List of labels */}
        <div className="max-h-56 overflow-y-auto space-y-2 pt-2 border-t border-[#d4cfc3] dark:border-neutral-800">
          {Object.keys(labels).length === 0 ? (
            <p className="text-center text-xs text-[#6e695d] dark:text-neutral-500 py-4">{t('labels.empty')}</p>
          ) : (
            Object.entries(labels).map(([id, lbl]) => (
              <div
                key={id}
                className="flex items-center justify-between p-2 rounded-lg bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800/80"
              >
                <div className="flex items-center gap-2">
                  <div
                    style={{ backgroundColor: lbl.color }}
                    className="w-4 h-4 rounded-full border border-black/15 dark:border-white/20 shadow-sm"
                  />
                  <span className="text-xs font-medium text-[#2b2924] dark:text-neutral-200">{lbl.name}</span>
                </div>
                <button
                  onClick={() => onDeleteLabel(id)}
                  className="p-1 text-[#6e695d] hover:text-red-700 hover:bg-[#d2ccbf] dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                  title={t('labels.deleteTitle')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
