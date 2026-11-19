import React from 'react';
import { Globe, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import {
  ImageSearchResultItem,
  LibrarySearchKind,
  VideoSearchResultItem,
} from '../../services/librarySearchService';
import { WebMediaSearchPanel } from './WebMediaSearchPanel';

interface LibraryWebSearchModalProps {
  kind: LibrarySearchKind;
  userApiKey?: string | null;
  multiSelect?: boolean;
  existingVideoIds?: Set<string>;
  isImporting?: boolean;
  importProgress?: { current: number; total: number } | null;
  onClose: () => void;
  onConfirmImages?: (items: ImageSearchResultItem[]) => Promise<void> | void;
  onConfirmVideos?: (items: VideoSearchResultItem[]) => Promise<void> | void;
}

export const LibraryWebSearchModal: React.FC<LibraryWebSearchModalProps> = ({
  kind,
  userApiKey,
  multiSelect = false,
  existingVideoIds,
  isImporting = false,
  importProgress = null,
  onClose,
  onConfirmImages,
  onConfirmVideos,
}) => {
  const { t } = useLanguage();

  const title =
    kind === 'videos'
      ? t('webSearch.modalTitleVideos')
      : kind === 'maps'
      ? t('webSearch.modalTitleMaps')
      : t('webSearch.modalTitleImages');

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#d4cfc3] dark:border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
            <h3 className="font-semibold text-[#2b2924] dark:text-neutral-100 text-sm truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={isImporting}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <WebMediaSearchPanel
          kind={kind}
          userApiKey={userApiKey}
          multiSelect={multiSelect}
          existingVideoIds={existingVideoIds}
          isImporting={isImporting}
          importProgress={importProgress}
          onConfirmImages={onConfirmImages}
          onConfirmVideos={onConfirmVideos}
        />
      </div>
    </div>
  );
};
