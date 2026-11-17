import React, { useEffect, useRef, useState } from 'react';
import { VideoRef, VideoSnapshot } from '../../types/workflow';
import { Camera, Play, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface VideoPlayerModalProps {
  videoRef: VideoRef;
  videoTitle: string;
  columnName: string;
  onClose: () => void;
  onUpdateSnapshots: (snapshots: VideoSnapshot[]) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  videoRef,
  videoTitle,
  columnName,
  onClose,
  onUpdateSnapshots,
}) => {
  const { t, tColumn } = useLanguage();
  const [snapshots, setSnapshots] = useState<VideoSnapshot[]>(videoRef.snapshots || []);
  const [isPausedOrEnded, setIsPausedOrEnded] = useState(false);
  const playerRef = useRef<any>(null);
  const containerId = 'yt-player-embed';

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    let player: any = null;

    const initPlayer = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        player = new (window as any).YT.Player(containerId, {
          height: '100%',
          width: '100%',
          videoId: videoRef.globalId,
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onStateChange: (event: any) => {
              // 2: PAUSED, 0: ENDED
              if (event.data === 2 || event.data === 0) {
                setIsPausedOrEnded(true);
              } else {
                setIsPausedOrEnded(false);
              }
            },
          },
        });
        playerRef.current = player;
      } else {
        setTimeout(initPlayer, 200);
      }
    };

    initPlayer();

    return () => {
      if (player && player.destroy) {
        player.destroy();
      }
    };
  }, [videoRef.globalId]);

  const handleTakeSnapshot = () => {
    let currentTime = 0;
    if (playerRef.current && playerRef.current.getCurrentTime) {
      currentTime = playerRef.current.getCurrentTime();
    }

    const newSnap: VideoSnapshot = {
      id: `snap-${Date.now()}`,
      time: Math.round(currentTime * 10) / 10,
      comment: t('videoPlayer.defaultComment'),
    };

    const next = [...snapshots, newSnap].sort((a, b) => a.time - b.time);
    setSnapshots(next);
    onUpdateSnapshots(next);
  };

  const handleSeek = (time: number) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(time, true);
    }
  };

  const handleDeleteSnapshot = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    setSnapshots(next);
    onUpdateSnapshots(next);
  };

  const handleCommentChange = (id: string, comment: string) => {
    const next = snapshots.map((s) => (s.id === id ? { ...s, comment } : s));
    setSnapshots(next);
    onUpdateSnapshots(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#d4cfc3] dark:border-neutral-800">
          <div>
            <h3 className="font-semibold text-[#2b2924] dark:text-neutral-100 text-sm flex items-center gap-2">
              <span>{videoTitle}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-600/12 text-blue-800 border border-blue-600/30 dark:bg-blue-600/20 dark:text-blue-400 dark:border-blue-500/30">
                {tColumn(columnName as 'enfoque' | 'accion' | 'descripcion')}
              </span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video & Snapshots layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* YouTube Player Column */}
          <div className="flex-1 bg-black flex flex-col items-center justify-center relative min-h-[360px]">
            <div id={containerId} className="w-full h-full" />
          </div>

          {/* Snapshots Column */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[#d4cfc3] dark:border-neutral-800 flex flex-col bg-[#e0dbd0] dark:bg-neutral-950">
            <div className="p-3 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#2b2924] dark:text-neutral-200">
                {t('videoPlayer.marksTitle', { count: snapshots.length })}
              </span>
              <span className="text-[10px] text-[#5c584e] dark:text-neutral-500">{t('videoPlayer.pauseToMarkHint')}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {snapshots.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#6e695d] dark:text-neutral-500 space-y-1">
                  <Camera className="w-6 h-6 mx-auto opacity-30" />
                  <p>{t('videoPlayer.emptyMarks')}</p>
                  <p className="text-[10px] text-[#757065] dark:text-neutral-600">{t('videoPlayer.emptyMarksHint')}</p>
                </div>
              ) : (
                snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-2.5 rounded-xl bg-[#ebe7de] dark:bg-neutral-900 border border-[#c8c3b6] dark:border-neutral-800 text-xs space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSeek(snap.time)}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-blue-600/12 text-blue-800 hover:bg-blue-600/20 border border-blue-600/30 dark:bg-blue-600/20 dark:text-blue-400 dark:hover:bg-blue-600/30 dark:border-blue-500/30 transition-colors cursor-pointer"
                        title={t('videoPlayer.seekTooltip')}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{formatTime(snap.time)}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="text-[#5c584e] hover:text-red-700 p-1 rounded hover:bg-[#dcd7cc] dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        title={t('videoPlayer.deleteMarkTooltip')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      value={snap.comment}
                      onChange={(e) => handleCommentChange(snap.id, e.target.value)}
                      rows={2}
                      placeholder={t('videoPlayer.commentPlaceholder')}
                      className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg p-1.5 text-[#2b2924] dark:text-neutral-300 text-[11px] outline-none focus:border-blue-500 resize-none placeholder:text-[#757065] dark:placeholder:text-neutral-600"
                    />
                  </div>
                ))
              )}
            </div>

            {/* Snapshot trigger button */}
            <div className="p-3 border-t border-[#d4cfc3] dark:border-neutral-800 bg-[#e5e0d5] dark:bg-neutral-900/60">
              <button
                disabled={!isPausedOrEnded}
                onClick={handleTakeSnapshot}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  isPausedOrEnded
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.01] cursor-pointer'
                    : 'bg-[#d5cfc2] text-[#757065] border-[#c3beb1] dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700/50 cursor-not-allowed border'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>{isPausedOrEnded ? t('videoPlayer.addMarkReady') : t('videoPlayer.timestampDisabled')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
