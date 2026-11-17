import React from 'react';
import { WorkflowNode } from '../../types/workflow';
import { Archive, Eye, RotateCcw, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface ArchiveModalProps {
  storedNodes: Record<string, WorkflowNode>;
  onClose: () => void;
  onRestore: (id: string) => void;
  onView: (id: string) => void;
  onDeleteSingle: (id: string) => void;
  onDeleteAll: () => void;
  onUpdateNote: (id: string, note: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  storedNodes,
  onClose,
  onRestore,
  onView,
  onDeleteSingle,
  onDeleteAll,
  onUpdateNote,
}) => {
  const { t } = useLanguage();
  const count = Object.keys(storedNodes).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#d4cfc3] dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-purple-700 dark:text-purple-400" />
            <h3 className="font-semibold text-[#2b2924] dark:text-neutral-100 text-sm">{t('archive.title', { count })}</h3>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <button
                onClick={onDeleteAll}
                className="px-2.5 py-1 text-xs text-red-700 hover:text-white dark:text-red-400 dark:hover:text-white bg-red-600/10 hover:bg-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-md border border-red-600/30 dark:border-red-500/30 transition-colors cursor-pointer"
              >
                {t('archive.deleteAll')}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {count === 0 ? (
            <div className="text-center py-12 text-[#6e695d] dark:text-neutral-500 text-xs">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <span>{t('archive.empty')}</span>
            </div>
          ) : (
            Object.entries(storedNodes).map(([id, node]) => (
              <div
                key={id}
                className="bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 rounded-xl p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="font-semibold text-[#2b2924] dark:text-neutral-200 flex items-center gap-2">
                    <span>{node.title || t('archive.untitledScene')}</span>
                    <span className="font-mono text-[10px] text-[#6e695d] dark:text-neutral-500">{id}</span>
                  </div>
                  <span className="text-[10px] text-[#6e695d] dark:text-neutral-500">
                    {t('archive.storedMeta', {
                      date: node.storedAt || t('archive.recently'),
                      author: node.storedBy || t('archive.defaultUser'),
                    })}
                  </span>
                </div>

                {/* Storage note */}
                <input
                  type="text"
                  value={node.storeNote || ''}
                  onChange={(e) => onUpdateNote(id, e.target.value)}
                  placeholder={t('archive.notePlaceholder')}
                  className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-[#2b2924] dark:text-neutral-300 placeholder-[#757065] outline-none focus:border-purple-500"
                />

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#cec8ba] dark:border-neutral-800/60">
                  <button
                    onClick={() => onView(id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#3a362e] hover:bg-[#d2ccbf] dark:text-neutral-300 dark:hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('archive.view')}</span>
                  </button>
                  <button
                    onClick={() => onRestore(id)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('archive.restore')}</span>
                  </button>
                  <button
                    onClick={() => onDeleteSingle(id)}
                    className="p-1 text-[#6e695d] hover:text-red-700 hover:bg-[#d2ccbf] dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                    title={t('archive.deletePermanent')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
