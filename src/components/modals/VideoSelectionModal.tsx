import React, { useState } from 'react';
import { GlobalVideo } from '../../types/workflow';
import { Check, Video, X } from 'lucide-react';

interface VideoSelectionModalProps {
  videos: GlobalVideo[];
  columnTitle: string;
  onClose: () => void;
  onConfirm: (videoId: string) => void;
  onOpenVideoLib: () => void;
}

export const VideoSelectionModal: React.FC<VideoSelectionModalProps> = ({
  videos,
  columnTitle,
  onClose,
  onConfirm,
  onOpenVideoLib,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-md max-h-[75vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div>
            <h3 className="font-semibold text-neutral-100 text-sm">Select Reference Video</h3>
            <p className="text-[11px] text-neutral-400">Binding to {columnTitle.toUpperCase()} column</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video options */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {videos.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-xs space-y-2">
              <p>No videos available in library.</p>
              <button
                onClick={onOpenVideoLib}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                Go to Video Library
              </button>
            </div>
          ) : (
            videos.map((v) => {
              const isSelected = selectedId === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <img
                    src={`https://img.youtube.com/vi/${v.id}/default.jpg`}
                    alt={v.name}
                    className="w-16 h-10 object-cover rounded-lg border border-neutral-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-neutral-200 truncate">{v.name}</p>
                    <p className="text-[10px] text-neutral-500">YouTube ID: {v.id}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0 mr-1" />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={onOpenVideoLib}
            className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 font-medium"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Manage Lib</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!selectedId}
              onClick={() => selectedId && onConfirm(selectedId)}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none rounded-lg shadow-sm transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
