import React, { useRef, useState } from 'react';
import { GalleryImage } from '../../types/workflow';
import { Check, Globe, Image as ImageIcon, Map as MapIcon, Sparkles, Trash2, UploadCloud, Wand2, X } from 'lucide-react';
import { ShreddedImageIcon } from '../icons/ShreddedImageIcon';
import { ResolvedImg } from '../ResolvedImg';
import { useLanguage } from '../../hooks/useLanguage';
import { ImageSearchResultItem } from '../../services/librarySearchService';
import { WebMediaSearchPanel } from './WebMediaSearchPanel';

interface GalleryModalProps {
  mode: 'images-manage' | 'maps-manage' | 'images-picker' | 'maps-picker';
  projectTitle?: string;
  isReadOnly?: boolean;
  hasApiKey?: boolean;
  userApiKey?: string | null;
  images: GalleryImage[];
  isLoading: boolean;
  onClose: () => void;
  onUploadFiles: (files: FileList) => void;
  onImportWebImages?: (
    items: ImageSearchResultItem[],
    onProgress?: (current: number, total: number) => void
  ) => Promise<{ added: number; failed: number }>;
  onSelectImage: (url: string) => void;
  onDeleteSelected: (fileIds: string[]) => void;
  onOpenAiCreate?: () => void;
  onOpenAiEdit?: (image: GalleryImage) => void;
  onOpenApiKeyConfig?: () => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  mode,
  projectTitle,
  isReadOnly = false,
  hasApiKey = false,
  userApiKey = null,
  images,
  isLoading,
  onClose,
  onUploadFiles,
  onImportWebImages,
  onSelectImage,
  onDeleteSelected,
  onOpenAiCreate,
  onOpenAiEdit,
  onOpenApiKeyConfig,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'library' | 'search'>('library');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [brokenImgKeys, setBrokenImgKeys] = useState<Set<string>>(new Set());
  const [isImportingWeb, setIsImportingWeb] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMap = mode.includes('maps');
  const isPicker = mode.includes('picker');
  const title = isMap ? t('gallery.titleMap') : t('gallery.titleImages');
  const kindWord = isMap ? t('gallery.kindMap') : t('gallery.kindImage');

  const singleSelectedImage =
    selectedIds.size === 1
      ? images.find((img) => selectedIds.has(img.id)) || null
      : null;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleConfirmWebImages = async (items: ImageSearchResultItem[]) => {
    if (!onImportWebImages || items.length === 0) return;
    setIsImportingWeb(true);
    setImportProgress({ current: 0, total: items.length });
    setImportNotice(null);
    try {
      const res = await onImportWebImages(items, (current, total) => {
        setImportProgress({ current, total });
      });
      if (res.failed > 0) {
        setImportNotice(
          t('webSearch.importedPartial', { added: res.added, failed: res.failed })
        );
      } else {
        setImportNotice(t('webSearch.importedSuccess', { count: res.added }));
      }
      if (res.added > 0) {
        setActiveTab('library');
      }
    } finally {
      setIsImportingWeb(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-4 border-b border-[#d4cfc3] dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isMap ? <MapIcon className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />}
            <h3 className="font-semibold text-[#2b2924] dark:text-neutral-100 text-sm truncate">{title}</h3>
            {projectTitle && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-600/12 text-blue-800 border border-blue-600/30 dark:bg-blue-600/15 dark:text-blue-300 dark:border-blue-500/30 truncate max-w-[220px]">
                {projectTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  disabled={!hasApiKey}
                  onClick={() => onOpenAiCreate?.()}
                  title={
                    hasApiKey
                      ? t('gallery.aiCreateTooltip', { kind: kindWord })
                      : t('gallery.configApiKeyTooltip')
                  }
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                    hasApiKey
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40 cursor-pointer'
                      : 'bg-[#dcd7cc]/70 text-[#7d776a] border-[#c8c3b6] dark:bg-neutral-800/50 dark:text-neutral-500 dark:border-neutral-800 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('common.create')}</span>
                </button>

                <button
                  type="button"
                  disabled={!hasApiKey || !singleSelectedImage}
                  onClick={() => {
                    if (singleSelectedImage) {
                      onOpenAiEdit?.(singleSelectedImage);
                    }
                  }}
                  title={
                    !hasApiKey
                      ? t('gallery.configApiKeyTooltip')
                      : singleSelectedImage
                      ? t('gallery.aiEditTooltip', { kind: kindWord })
                      : isPicker
                      ? t('gallery.aiEditPickerHint')
                      : t('gallery.aiEditSelectHint')
                  }
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                    hasApiKey && singleSelectedImage
                      ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/40 cursor-pointer'
                      : hasApiKey
                      ? 'bg-[#dcd7cc] text-[#5c584e] border-[#c3beb1] dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700 opacity-75 cursor-not-allowed'
                      : 'bg-[#dcd7cc]/70 text-[#7d776a] border-[#c8c3b6] dark:bg-neutral-800/50 dark:text-neutral-500 dark:border-neutral-800 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{t('gallery.editImage')}</span>
                </button>
              </>
            )}

            {activeTab === 'library' && !isPicker && !isReadOnly && selectedIds.size > 0 && (
              <button
                onClick={() => {
                  onDeleteSelected(Array.from(selectedIds));
                  setSelectedIds(new Set());
                }}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('gallery.deleteSelected', { count: selectedIds.size })}</span>
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

        {/* Library vs Web Search Switcher */}
        {!isReadOnly && onImportWebImages && (
          <div className="px-4 py-2.5 border-b border-[#d4cfc3] dark:border-neutral-800 bg-[#e4dfd4] dark:bg-neutral-900/90 flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#d7d1c4] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'library'
                    ? 'bg-[#ebe7de] text-[#1f1d18] shadow-sm dark:bg-neutral-800 dark:text-white'
                    : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                {t('gallery.tabLibrary', { count: images.length })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('search');
                  setImportNotice(null);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isMap ? t('gallery.searchMapsBtn') : t('gallery.searchImagesBtn')}</span>
              </button>
            </div>

            {importNotice && (
              <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-600/12 dark:bg-emerald-600/15 border border-emerald-600/30 px-2.5 py-1 rounded-md">
                {importNotice}
              </span>
            )}
          </div>
        )}

        {activeTab === 'search' && !isReadOnly && onImportWebImages ? (
          <WebMediaSearchPanel
            kind={isMap ? 'maps' : 'images'}
            userApiKey={userApiKey}
            multiSelect={true}
            isImporting={isImportingWeb}
            importProgress={importProgress}
            onConfirmImages={handleConfirmWebImages}
            onOpenApiKeyConfig={onOpenApiKeyConfig}
          />
        ) : (
          <>
            {/* Upload drop zone */}
            {!isReadOnly && (
              <div className="p-4 border-b border-[#d4cfc3] dark:border-neutral-800">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-[#b6b0a2] dark:border-neutral-700 hover:border-blue-600 dark:hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-[#e0dbd0]/80 hover:bg-[#d7d1c4] dark:bg-neutral-950/40 dark:hover:bg-neutral-800/20 transition-colors"
                >
                  <UploadCloud className="w-6 h-6 text-[#5c584e] dark:text-neutral-400 mb-1" />
                  <p className="text-xs text-[#2b2924] dark:text-neutral-300 font-medium">
                    {isMap ? t('gallery.dropMaps') : t('gallery.dropImages')}
                  </p>
                  <p className="text-[10px] text-[#5c584e] dark:text-neutral-500">{t('gallery.dropSub')}</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        onUploadFiles(e.target.files);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="text-center py-12 text-xs text-[#5c584e] dark:text-neutral-400">{t('gallery.loading')}</div>
              ) : images.length === 0 ? (
                <div className="text-center py-16 text-xs text-[#6e695d] dark:text-neutral-500">
                  {t('gallery.empty')}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {images.map((img) => {
                    const isSelected = selectedIds.has(img.id);
                    const imgKey = `${img.id}:${img.url}`;
                    const isBroken = brokenImgKeys.has(imgKey);
                    return (
                      <div
                        key={img.id}
                        onClick={() => {
                          if (isPicker) {
                            if (!isBroken) onSelectImage(img.url);
                          } else if (!isReadOnly) {
                            toggleSelect(img.id);
                          }
                        }}
                        className={`relative aspect-video rounded-xl overflow-hidden bg-[#d8d3c8] dark:bg-neutral-950 border cursor-pointer transition-all group ${
                          isSelected
                            ? 'border-red-500 ring-2 ring-red-500/50 scale-95'
                            : 'border-[#c3beb1] dark:border-neutral-800 hover:border-blue-500 hover:scale-[1.02]'
                        }`}
                      >
                        {isBroken ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center bg-red-950/20 dark:bg-red-950/35 text-red-700 dark:text-red-300">
                            <ShreddedImageIcon className="w-7 h-7 opacity-80" />
                            <span className="text-[10px] font-semibold leading-tight">
                              {t('gallery.imageUnavailable')}
                            </span>
                          </div>
                        ) : (
                          <ResolvedImg
                            src={img.url}
                            alt={img.name}
                            referrerPolicy="no-referrer"
                            onError={() => {
                              setBrokenImgKeys((prev) => {
                                const next = new Set(prev);
                                next.add(imgKey);
                                return next;
                              });
                            }}
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Quick AI Edit button on hover when API key is configured */}
                        {!isBroken && !isReadOnly && hasApiKey && onOpenAiEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAiEdit(img);
                            }}
                            title={t('gallery.aiEditCardTooltip', { kind: kindWord })}
                            className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/75 hover:bg-emerald-600 text-white text-[10px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer border border-white/15"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>{t('common.edit')}</span>
                          </button>
                        )}

                        {/* Checkmark when selected */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}

                        {/* Picker hover overlay */}
                        {isPicker && !isBroken && (
                          <div className="absolute inset-0 bg-blue-600/80 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            {t('gallery.applyToScene')}
                          </div>
                        )}

                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-[10px] text-neutral-100 truncate pointer-events-none">
                          {img.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
