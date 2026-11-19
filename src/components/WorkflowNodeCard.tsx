import React, { useRef, useState } from 'react';
import { LabelItem, WorkflowNode } from '../types/workflow';
import { Unlink, Trash2, MessageSquare, Image as ImageIcon, Tag } from 'lucide-react';
import { ShreddedImageIcon } from './icons/ShreddedImageIcon';
import { ResolvedImg } from './ResolvedImg';
import { useLanguage } from '../hooks/useLanguage';
import { getContrastTextColor } from '../utils/colorContrast';

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  label?: LabelItem;
  isReadOnly: boolean;
  isHoveringContainer?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isHiddenByFilter?: boolean;
  searchMatchState?: 'none' | 'match' | 'dimmed';
  isConnectionDragging?: boolean;
  activeSourcePort?: 'top' | 'bottom' | 'left' | 'right' | null;
  approachedPort?: {
    port: 'top' | 'bottom' | 'left' | 'right';
    proximity: number;
    isReady: boolean;
  } | null;
  onStartPortDrag: (nodeId: string, port: 'top' | 'bottom' | 'left' | 'right', e: React.PointerEvent) => void;
  onOpenDashboard: (nodeId: string) => void;
  onOpenLabelPicker?: (nodeId: string, e: React.MouseEvent) => void;
  onDeleteRequest: (nodeId: string) => void;
  onUnlinkContainer: (nodeId: string) => void;
  onUpdateTitle: (nodeId: string, newTitle: string) => void;
  onImagePaste: (nodeId: string, file: File) => void;
}

export const WorkflowNodeCard: React.FC<WorkflowNodeCardProps> = ({
  node,
  label,
  isReadOnly,
  isHoveringContainer = false,
  isHighlighted = false,
  isSelected = false,
  isHiddenByFilter = false,
  searchMatchState = 'none',
  isConnectionDragging = false,
  activeSourcePort = null,
  approachedPort = null,
  onStartPortDrag,
  onOpenDashboard,
  onOpenLabelPicker,
  onDeleteRequest,
  onUnlinkContainer,
  onUpdateTitle,
  onImagePaste,
}) => {
  const { t } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(node.title || t('node.defaultScene'));
  const [imageLoadError, setImageLoadError] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pointerDownPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastTitleTapRef = useRef<number>(0);

  React.useEffect(() => {
    setImageLoadError(false);
  }, [node.image]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() !== node.title) {
      onUpdateTitle(node.id, titleValue.trim() || t('node.untitledScene'));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImagePaste(node.id, e.dataTransfer.files[0]);
    }
  };

  const handleThumbClick = (e: React.MouseEvent) => {
    if (e.button === 1) return;
    e.stopPropagation();
    if (e.shiftKey) return;
    const start = pointerDownPointRef.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
    onOpenDashboard(node.id);
  };

  if (isHiddenByFilter) {
    return null;
  }

  const hasCustomLabelBorder =
    Boolean(label) &&
    !isHoveringContainer &&
    !isHighlighted &&
    !isSelected &&
    searchMatchState !== 'match';

  return (
    <div
      id={node.id}
      data-node-id={node.id}
      data-selected={isSelected ? 'true' : 'false'}
      onPointerDown={(e) => {
        pointerDownPointRef.current = { x: e.clientX, y: e.clientY };
      }}
      style={{
        left: node.x,
        top: node.y,
        width: 220,
        ...(hasCustomLabelBorder && label ? { borderColor: label.color } : {}),
      }}
      className={`workflow-node touch-canvas absolute bg-[#706d65] dark:bg-neutral-900 border rounded-xl transition-[opacity,filter,border-color,box-shadow] duration-200 group cursor-grab active:cursor-grabbing select-none ${
        searchMatchState === 'dimmed'
          ? 'opacity-20 saturate-50 hover:opacity-55 z-10'
          : searchMatchState === 'match'
          ? 'opacity-100 z-20'
          : 'z-10'
      } ${
        isHoveringContainer
          ? 'border-blue-400 ring-2 ring-blue-400/70 shadow-[0_0_24px_rgba(59,130,246,0.6)]'
          : isHighlighted
          ? 'border-sky-400 ring-2 ring-sky-400/85 shadow-[0_0_28px_rgba(56,189,248,0.6)]'
          : isSelected
          ? 'border-sky-400 ring-2 ring-sky-400/75 shadow-[0_0_22px_rgba(56,189,248,0.38)]'
          : searchMatchState === 'match'
          ? 'border-sky-400 ring-2 ring-sky-400/80 shadow-[0_0_24px_rgba(56,189,248,0.45)]'
          : 'border-[#57544d] hover:border-blue-400 dark:border-neutral-700/80 dark:hover:border-blue-500/80 shadow-md dark:shadow-lg'
      }`}
    >
      {/* Top 3px color-coded grouping strip */}
      {label && (
        <div
          style={{ backgroundColor: label.color }}
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[11px] pointer-events-none z-20"
        />
      )}

      {/* Floating Action Bar on Hover / Touch Selection (Outside Upper Right) */}
      {!isReadOnly && (
        <div className="touch-action-bar absolute -top-9 right-0 pb-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none group-hover:pointer-events-auto">
          <div className="bg-[#ebe7de]/95 dark:bg-neutral-900/95 border border-[#c3beb1] dark:border-neutral-700 rounded-full py-1 px-2 flex items-center gap-1 shadow-lg dark:shadow-xl backdrop-blur-sm">
            {onOpenLabelPicker && (
              <button
                onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLabelPicker(node.id, e);
                }}
                className="p-1.5 hover:bg-[#d8d3c8] dark:hover:bg-neutral-800 text-[#5c584e] hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400 rounded-full transition-colors cursor-pointer"
                title={t('node.labelBtn')}
              >
                <Tag className="w-3.5 h-3.5" style={label ? { color: label.color } : undefined} />
              </button>
            )}

            {node.containerId && (
              <button
                onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlinkContainer(node.id);
                }}
                className="p-1.5 hover:bg-red-500/15 dark:hover:bg-red-500/20 text-amber-700 hover:text-red-700 dark:text-amber-300 dark:hover:text-red-300 rounded-full transition-colors cursor-pointer"
                title={t('node.unlinkContainer')}
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRequest(node.id);
              }}
              className="p-1.5 hover:bg-red-500/15 dark:hover:bg-red-500/20 text-[#5c584e] hover:text-red-700 dark:text-neutral-400 dark:hover:text-red-400 rounded-full transition-colors cursor-pointer"
              title={t('node.deleteOrArchive')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Connection Ports */}
      {(['top', 'bottom', 'left', 'right'] as const).map((port) => {
        const translateClass =
          port === 'top'
            ? '-top-2 left-1/2 -translate-x-1/2'
            : port === 'bottom'
            ? '-bottom-2 left-1/2 -translate-x-1/2'
            : port === 'left'
            ? '-left-2 top-1/2 -translate-y-1/2'
            : '-right-2 top-1/2 -translate-y-1/2';

        const isActiveSource = isConnectionDragging && activeSourcePort === port;
        const isApproached = isConnectionDragging && approachedPort?.port === port;
        const isReadyTarget = isApproached && approachedPort.isReady;
        const proximity = isApproached ? approachedPort.proximity : 0;

        let stateClass =
          'port-idle bg-[#dedad0] dark:bg-neutral-900 border-2 border-blue-600 dark:border-blue-500 opacity-0 group-hover:opacity-100 hover:bg-blue-500 hover:scale-125 shadow-md';
        let dynamicStyle: React.CSSProperties | undefined;

        if (isReadOnly) {
          stateClass = 'opacity-0 pointer-events-none border-2 border-blue-600 dark:border-blue-500';
        } else if (isConnectionDragging) {
          if (isActiveSource) {
            stateClass =
              'opacity-100 bg-blue-600 dark:bg-blue-500 border-2 border-blue-200 dark:border-blue-200 scale-110 shadow-sm';
          } else if (isReadyTarget) {
            stateClass =
              'opacity-100 bg-blue-600 dark:bg-blue-500 border-2 border-blue-100 dark:border-blue-200 scale-125';
            dynamicStyle = {
              boxShadow: '0 0 3px 0px rgba(37, 99, 235, 0.35)',
            };
          } else if (isApproached) {
            const glowBlur = 6 + proximity * 26;
            const glowSpread = 1 + proximity * 7;
            const glowAlpha = (0.28 + proximity * 0.68).toFixed(2);
            const scale = (0.9 + proximity * 0.25).toFixed(3);
            stateClass =
              'bg-[#dedad0] dark:bg-neutral-900 border-2 border-blue-400 dark:border-blue-400';
            dynamicStyle = {
              opacity: Number((0.28 + proximity * 0.72).toFixed(2)),
              transform: `scale(${scale})`,
              boxShadow: `0 0 ${glowBlur.toFixed(1)}px ${glowSpread.toFixed(1)}px rgba(59, 130, 246, ${glowAlpha}), inset 0 0 ${(2 + proximity * 5).toFixed(1)}px rgba(96, 165, 250, ${glowAlpha})`,
            };
          } else {
            stateClass =
              'opacity-0 pointer-events-none bg-[#dedad0] dark:bg-neutral-900 border-2 border-blue-600 dark:border-blue-500';
          }
        }

        return (
          <div
            key={port}
            data-port={port}
            data-node={node.id}
            onPointerDown={(e) => {
              if ((e.pointerType === 'mouse' && e.button !== 0) || isReadOnly) return;
              e.stopPropagation();
              onStartPortDrag(node.id, port, e);
            }}
            style={dynamicStyle}
            className={`port absolute ${translateClass} w-3.5 h-3.5 rounded-full ${stateClass} cursor-crosshair z-30 transition-[opacity,transform,box-shadow,background-color,border-color] duration-150`}
            title={t('node.connectFromPort', { port: t(`port.${port}`) })}
          />
        );
      })}

      {/* Node Header / Title */}
      <div className="p-2.5 border-b border-[#57544d]/80 dark:border-neutral-800 bg-[#5e5b54] dark:bg-neutral-900/60 rounded-t-xl flex items-center justify-between gap-2">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitleValue(node.title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            className="w-full text-xs font-semibold bg-[#4f4c46] dark:bg-neutral-800 text-[#f3f0e8] dark:text-neutral-100 px-1.5 py-0.5 rounded border border-blue-500 focus:outline-none"
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isReadOnly) {
                setTitleValue(node.title || t('node.defaultScene'));
                setIsEditingTitle(true);
              }
            }}
            onPointerUp={(e) => {
              if (e.pointerType === 'mouse' || isReadOnly) return;
              const start = pointerDownPointRef.current;
              if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
              const now = Date.now();
              if (now - lastTitleTapRef.current < 320) {
                e.stopPropagation();
                lastTitleTapRef.current = 0;
                setTitleValue(node.title || t('node.defaultScene'));
                setIsEditingTitle(true);
              } else {
                lastTitleTapRef.current = now;
              }
            }}
            className="text-xs font-semibold text-[#f3f0e8] dark:text-neutral-200 truncate cursor-text hover:text-[#faf8f2] dark:hover:text-white flex-1 min-w-0"
            title={t('node.doubleTapRename')}
          >
            {node.title || t('node.defaultScene')}
          </div>
        )}
      </div>

      {/* Node Thumbnail & Drop Area */}
      <div
        className="p-2.5 relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {node.image && !imageLoadError ? (
          <div
            onClick={handleThumbClick}
            className="relative rounded-lg overflow-hidden bg-black aspect-video group/thumb cursor-pointer border border-[#54514a] dark:border-neutral-800"
          >
            <ResolvedImg
              src={node.image}
              alt={node.title}
              referrerPolicy="no-referrer"
              onError={() => setImageLoadError(true)}
              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/20 group-hover/thumb:bg-black/0 transition-colors" />
          </div>
        ) : node.imageDeletedFromAdmin || imageLoadError ? (
          <div
            onClick={handleThumbClick}
            className="aspect-video rounded-lg border-2 border-dashed border-red-500/70 hover:border-red-400 flex flex-col items-center justify-center text-red-400 gap-1 p-2 text-center transition-colors cursor-pointer bg-red-950/25 hover:bg-red-950/40"
            title={node.imageDeletedFromAdmin ? t('node.deletedImageTitle') : t('node.unavailableImageTitle')}
          >
            <ShreddedImageIcon className="w-10 h-10 text-red-500" />
            <span className="text-[11px] font-semibold leading-tight text-red-400">
              {node.imageDeletedFromAdmin ? t('node.deletedImage') : t('node.unavailableImage')}
            </span>
          </div>
        ) : (
          <div
            onClick={handleThumbClick}
            className="aspect-video rounded-lg border-2 border-dashed border-[#c2bdb1]/70 dark:border-neutral-700/80 hover:border-blue-400 dark:hover:border-blue-500/80 flex flex-col items-center justify-center text-[#eae6dc] dark:text-neutral-500 hover:text-[#faf8f2] dark:hover:text-neutral-300 gap-1.5 p-2 text-center transition-colors cursor-pointer bg-[#625f58]/50 dark:bg-neutral-900/40"
          >
            <ImageIcon className="w-5 h-5 text-[#dbd6ca] dark:text-neutral-600" />
            <span className="text-[11px] font-medium leading-tight">
              {t('node.pasteOrDrop')}
            </span>
          </div>
        )}

        {/* Color-coded label pill */}
        {label && (
          <button
            type="button"
            disabled={isReadOnly || !onOpenLabelPicker}
            onPointerDown={(e) => {
              if (!isReadOnly && onOpenLabelPicker && e.button !== 1) e.stopPropagation();
            }}
            onClick={(e) => {
              if (isReadOnly || !onOpenLabelPicker) return;
              e.stopPropagation();
              onOpenLabelPicker(node.id, e);
            }}
            style={{
              backgroundColor: label.color,
              color: getContrastTextColor(label.color),
            }}
            className={`absolute bottom-3.5 left-3.5 max-w-[148px] px-2 py-0.5 rounded-md text-[10px] font-semibold shadow-md flex items-center gap-1 truncate z-20 ${
              !isReadOnly && onOpenLabelPicker ? 'cursor-pointer hover:brightness-110' : 'pointer-events-none'
            }`}
            title={label.name}
          >
            <span className="truncate">{label.name}</span>
          </button>
        )}

        {/* Comment count badge */}
        {node.pins && node.pins.length > 0 && (
          <div
            className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center shadow-lg border border-[#57544d] dark:border-neutral-900"
            title={t('node.commentsBadgeTitle', { count: node.pins.length })}
          >
            <MessageSquare className="w-2.5 h-2.5 mr-0.5 inline" />
            {node.pins.length}
          </div>
        )}
      </div>
    </div>
  );
};
