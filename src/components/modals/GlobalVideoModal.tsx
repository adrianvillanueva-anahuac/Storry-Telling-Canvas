import React, { useMemo, useState } from 'react';
import { GlobalVideo } from '../../types/workflow';
import { Globe, Plus, Trash2, Video, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { VideoSearchResultItem } from '../../services/librarySearchService';
import { WebMediaSearchPanel } from './WebMediaSearchPanel';

interface GlobalVideoModalProps {
  videos: GlobalVideo[];
  projectTitle?: string;
  isReadOnly?: boolean;
  userApiKey?: string | null;
  author: string;
  onClose: () => void;
  onAddVideo: (video: GlobalVideo) => void;
  onDeleteVideo: (id: string) => void;
}

export function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=[&]*|v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export const GlobalVideoModal: React.FC<GlobalVideoModalProps> = ({
  videos,
  projectTitle,
  isReadOnly = false,
  userApiKey = null,
  author,
  onClose,
  onAddVideo,
  onDeleteVideo,
}) => {
  const { t, locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<'library' | 'search'>('library');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const existingVideoIds = useMemo(
    () => new Set(videos.map((v) => v.id)),
    [videos]
  );

  const handleAdd = () => {
    setError('');
    setAddedNotice(null);
    const ytId = extractYouTubeId(url.trim());
    if (!ytId) {
      setError(t('videoLib.invalidUrl'));
      return;
    }

    onAddVideo({
      id: ytId,
      name: name.trim() || t('videoLib.untitledVideo'),
      date: new Date().toLocaleDateString(locale),
      author: author || t('videoLib.defaultUser'),
    });

    setUrl('');
    setName('');
  };

  const handleConfirmSearchedVideos = async (items: VideoSearchResultItem[]) => {
    let added = 0;
    const today = new Date().toLocaleDateString(locale);
    const resolvedAuthor = author || t('videoLib.defaultUser');
    for (const v of items) {
      if (existingVideoIds.has(v.youtubeId)) continue;
      onAddVideo({
        id: v.youtubeId,
        name: v.title.slice(0, 200) || t('videoLib.untitledVideo'),
        date: today,
        author: resolvedAuthor,
      });
      added += 1;
    }
    if (added > 0) {
      setAddedNotice(t('webSearch.importedSuccess', { count: added }));
      setActiveTab('library');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#d4cfc3] dark:border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <Video className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <h3 className="font-semibold text-[#2b2924] dark:text-neutral-100 text-sm truncate">{t('videoLib.title')}</h3>
            {projectTitle && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-rose-600/12 text-rose-800 border border-rose-600/30 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30 truncate max-w-[200px]">
                {projectTitle}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher: Paste URL / Library vs Search YouTube */}
        {!isReadOnly && (
          <div className="px-4 py-2.5 border-b border-[#d4cfc3] dark:border-neutral-800 bg-[#e4dfd4] dark:bg-neutral-900/90 flex items-center justify-between gap-2 flex-wrap">
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
                {t('videoLib.tabAddUrl')} ({videos.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('search');
                  setAddedNotice(null);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{t('videoLib.tabSearchYouTube')}</span>
              </button>
            </div>

            {addedNotice && activeTab === 'library' && (
              <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-600/12 dark:bg-emerald-600/15 border border-emerald-600/30 px-2.5 py-1 rounded-md">
                {addedNotice}
              </span>
            )}
          </div>
        )}

        {activeTab === 'search' && !isReadOnly ? (
          <WebMediaSearchPanel
            kind="videos"
            userApiKey={userApiKey}
            multiSelect={true}
            existingVideoIds={existingVideoIds}
            onConfirmVideos={handleConfirmSearchedVideos}
          />
        ) : (
          <>
            {/* Input form */}
            {!isReadOnly && (
              <div className="p-4 border-b border-[#d4cfc3] dark:border-neutral-800 space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('videoLib.urlPlaceholder')}
                    className="flex-2 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder={t('videoLib.titlePlaceholder')}
                    className="flex-1 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('common.add')}</span>
                  </button>
                </div>

                {error && <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">{error}</p>}
              </div>
            )}

            {/* Video list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {videos.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#6e695d] dark:text-neutral-500">
                  {t('videoLib.empty')}
                </div>
              ) : (
                videos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 p-2.5 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800/80 rounded-xl"
                  >
                    <img
                      src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                      alt={v.name}
                      className="w-24 h-14 object-cover rounded-lg border border-[#c3beb1] dark:border-neutral-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-[#2b2924] dark:text-neutral-200 truncate">{v.name}</h4>
                      <p className="text-[10px] text-[#5c584e] dark:text-neutral-500 mt-0.5">
                        {t('videoLib.addedByMeta', { author: v.author, date: v.date })}
                      </p>
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={() => onDeleteVideo(v.id)}
                        className="p-1.5 text-[#5c584e] hover:text-red-700 hover:bg-[#d5cfc2] dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-900 rounded transition-colors cursor-pointer"
                        title={t('videoLib.removeTooltip')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
