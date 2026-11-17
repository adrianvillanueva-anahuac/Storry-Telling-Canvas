import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface ReplaceImageWarningModalProps {
  onClose: () => void;
  onConfirm: (option: 'borrar_todo' | 'conservar') => void;
}

export const ReplaceImageWarningModal: React.FC<ReplaceImageWarningModalProps> = ({
  onClose,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [option, setOption] = useState<'borrar_todo' | 'conservar'>('borrar_todo');

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600/12 dark:bg-red-500/10 border border-red-600/25 dark:border-red-500/20 text-red-700 dark:text-red-500 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100">{t('replaceModal.title')}</h3>
            <p className="text-xs text-[#5c584e] dark:text-neutral-400">{t('replaceModal.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <label
            onClick={() => setOption('borrar_todo')}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              option === 'borrar_todo'
                ? 'bg-red-600/10 dark:bg-red-500/10 border-red-600 dark:border-red-500 ring-1 ring-red-600 dark:ring-red-500'
                : 'bg-[#e0dbd0] dark:bg-neutral-950 border-[#c3beb1] dark:border-neutral-800 hover:border-[#a8a293] dark:hover:border-neutral-700'
            }`}
          >
            <input
              type="radio"
              name="replaceOption"
              checked={option === 'borrar_todo'}
              onChange={() => setOption('borrar_todo')}
              className="mt-0.5 text-red-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-[#2b2924] dark:text-neutral-200 block">{t('replaceModal.clearAll')}</span>
              <span className="text-[#5c584e] dark:text-neutral-400 text-[11px] leading-relaxed">
                {t('replaceModal.clearAllDesc')}
              </span>
            </div>
          </label>

          <label
            onClick={() => setOption('conservar')}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              option === 'conservar'
                ? 'bg-blue-600/10 dark:bg-blue-500/10 border-blue-600 dark:border-blue-500 ring-1 ring-blue-600 dark:ring-blue-500'
                : 'bg-[#e0dbd0] dark:bg-neutral-950 border-[#c3beb1] dark:border-neutral-800 hover:border-[#a8a293] dark:hover:border-neutral-700'
            }`}
          >
            <input
              type="radio"
              name="replaceOption"
              checked={option === 'conservar'}
              onChange={() => setOption('conservar')}
              className="mt-0.5 text-blue-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-[#2b2924] dark:text-neutral-200 block">{t('replaceModal.keepContent')}</span>
              <span className="text-[#5c584e] dark:text-neutral-400 text-[11px] leading-relaxed">
                {t('replaceModal.keepContentDesc')}
              </span>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d4cfc3] dark:border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#3a362e] hover:bg-[#dcd7cc] dark:text-neutral-300 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onConfirm(option)}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {t('replaceModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
