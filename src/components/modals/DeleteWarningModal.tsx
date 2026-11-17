import React from 'react';
import { AlertTriangle, Archive, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface DeleteWarningModalProps {
  nodeCount?: number;
  textCount?: number;
  onClose: () => void;
  onConfirmDelete: () => void;
  onConfirmStore?: () => void;
}

export const DeleteWarningModal: React.FC<DeleteWarningModalProps> = ({
  nodeCount = 1,
  textCount = 0,
  onClose,
  onConfirmDelete,
  onConfirmStore,
}) => {
  const { t } = useLanguage();
  const totalCount = nodeCount + textCount;
  const isBatch = totalCount > 1;
  const canStore = nodeCount > 0 && Boolean(onConfirmStore);

  const summaryParts: string[] = [];
  if (nodeCount > 0) {
    summaryParts.push(
      `${nodeCount} ${nodeCount === 1 ? t('deleteModal.sceneNodeSingular') : t('deleteModal.sceneNodePlural')}`
    );
  }
  if (textCount > 0) {
    summaryParts.push(
      `${textCount} ${textCount === 1 ? t('deleteModal.textItemSingular') : t('deleteModal.textItemPlural')}`
    );
  }
  const summaryLabel = summaryParts.join(t('deleteModal.andJoiner'));

  const title = isBatch
    ? canStore
      ? t('deleteModal.titleBatchCanStore', { count: totalCount })
      : t('deleteModal.titleBatchTextOnly', { count: totalCount })
    : nodeCount === 0
    ? t('deleteModal.titleSingleText')
    : t('deleteModal.titleSingleNode');

  const description = isBatch
    ? canStore
      ? nodeCount === 1
        ? t('deleteModal.descBatchCanStoreSingle', { summary: summaryLabel, nodeCount })
        : t('deleteModal.descBatchCanStorePlural', { summary: summaryLabel, nodeCount })
      : t('deleteModal.descBatchNoStore', { summary: summaryLabel })
    : nodeCount === 0
    ? t('deleteModal.descSingleText')
    : t('deleteModal.descSingleNode');

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-full bg-red-600/12 dark:bg-red-500/10 border border-red-600/25 dark:border-red-500/20 text-red-700 dark:text-red-500 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-bold text-[#2b2924] dark:text-neutral-100">{title}</h3>
          <p className="text-xs text-[#5c584e] dark:text-neutral-400 mt-1 leading-relaxed">{description}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-[#3a362e] hover:bg-[#dcd7cc] dark:text-neutral-300 dark:hover:bg-neutral-800 rounded-lg transition-colors border border-[#c3beb1] dark:border-neutral-700 cursor-pointer whitespace-nowrap"
          >
            {t('common.cancel')}
          </button>
          {canStore && onConfirmStore && (
            <button
              onClick={onConfirmStore}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>
                {isBatch
                  ? nodeCount === totalCount
                    ? t('deleteModal.storeAll')
                    : t('deleteModal.storeScenes', { count: nodeCount })
                  : t('deleteModal.storeIt')}
              </span>
            </button>
          )}
          <button
            onClick={onConfirmDelete}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isBatch ? t('deleteModal.deleteAll') : t('common.delete')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
