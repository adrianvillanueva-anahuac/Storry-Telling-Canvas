import React, { useState } from 'react';
import { GlobalVideo } from '../../types/workflow';
import { Plus, Trash2, Video, X } from 'lucide-react';

interface GlobalVideoModalProps {
  videos: GlobalVideo[];
  projectTitle?: string;
  isReadOnly?: boolean;
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
  author,
  onClose,
  onAddVideo,
  onDeleteVideo,
}) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');
    const ytId = extractYouTubeId(url.trim());
    if (!ytId) {
      setError('Please enter a valid YouTube link (e.g. https://www.youtube.com/watch?v=...)');
      return;
    }

    onAddVideo({
      id: ytId,
      name: name.trim() || 'Untitled Video Ref',
      date: new Date().toLocaleDateString(),
      author: author || 'User',
    });

    setUrl('');
    setName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <Video className="w-4 h-4 text-rose-400 shrink-0" />
            <h3 className="font-semibold text-neutral-100 text-sm truncate">Project Video Reference Library</h3>
            {projectTitle && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 truncate max-w-[200px]">
                {projectTitle}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input form */}
        {!isReadOnly && (
          <div className="p-4 border-b border-neutral-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube Video URL..."
                className="flex-2 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Video Title..."
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {error && <p className="text-[11px] text-red-400 font-medium">{error}</p>}
          </div>
        )}

        {/* Video list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {videos.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-500">
              No YouTube links added to this project yet. Add a YouTube URL above.
            </div>
          ) : (
            videos.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-2.5 bg-neutral-950 border border-neutral-800/80 rounded-xl"
              >
                <img
                  src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                  alt={v.name}
                  className="w-24 h-14 object-cover rounded-lg border border-neutral-800 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-neutral-200 truncate">{v.name}</h4>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Added by {v.author} · {v.date}
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => onDeleteVideo(v.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-900 rounded transition-colors"
                    title="Remove from Project Library"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
