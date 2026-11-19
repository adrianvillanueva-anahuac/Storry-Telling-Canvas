import React, { useEffect, useRef, useState } from 'react';
import { TextElement, LabelItem } from '../types/workflow';
import { Maximize2, Settings, Tag, Trash2, Unlink } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { getContrastTextColor } from '../utils/colorContrast';

type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface LiveResizeState {
  x: number;
  y: number;
  width?: number;
  height?: number;
  displayWidth: number;
  displayHeight: number;
}

interface CanvasTextCardProps {
  element: TextElement;
  label?: LabelItem;
  isReadOnly: boolean;
  isDropTarget?: boolean;
  isSelected?: boolean;
  isHiddenByFilter?: boolean;
  searchMatchState?: 'none' | 'match' | 'dimmed';
  onOpenSettings: (elementId: string, e: React.MouseEvent) => void;
  onOpenLabelPicker?: (elementId: string, e: React.MouseEvent) => void;
  onDelete: (elementId: string) => void;
  onUnlink: (elementId: string) => void;
  onUpdateText: (elementId: string, updates: Partial<TextElement>) => void;
  onFitContainer?: (elementId: string) => void;
}

const MODE_MIN_DIMENSIONS: Record<
  TextElement['mode'],
  { minWidth: number; minHeight: number }
> = {
  container: { minWidth: 160, minHeight: 100 },
  annotation: { minWidth: 140, minHeight: 84 },
  floating: { minWidth: 60, minHeight: 28 },
};

const HANDLE_DEFINITIONS: {
  dir: ResizeDirection;
  left: string;
  top: string;
  cursor: string;
  isCorner: boolean;
}[] = [
  { dir: 'nw', left: '0%', top: '0%', cursor: 'cursor-nwse-resize', isCorner: true },
  { dir: 'n', left: '50%', top: '0%', cursor: 'cursor-ns-resize', isCorner: false },
  { dir: 'ne', left: '100%', top: '0%', cursor: 'cursor-nesw-resize', isCorner: true },
  { dir: 'e', left: '100%', top: '50%', cursor: 'cursor-ew-resize', isCorner: false },
  { dir: 'se', left: '100%', top: '100%', cursor: 'cursor-nwse-resize', isCorner: true },
  { dir: 's', left: '50%', top: '100%', cursor: 'cursor-ns-resize', isCorner: false },
  { dir: 'sw', left: '0%', top: '100%', cursor: 'cursor-nesw-resize', isCorner: true },
  { dir: 'w', left: '0%', top: '50%', cursor: 'cursor-ew-resize', isCorner: false },
];

export const CanvasTextCard: React.FC<CanvasTextCardProps> = ({
  element,
  label,
  isReadOnly,
  isDropTarget = false,
  isSelected = false,
  isHiddenByFilter = false,
  searchMatchState = 'none',
  onOpenSettings,
  onOpenLabelPicker,
  onDelete,
  onUnlink,
  onUpdateText,
  onFitContainer,
}) => {
  const { t } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(element.text);
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [bodyValue, setBodyValue] = useState(element.body || '');
  const [liveResize, setLiveResize] = useState<LiveResizeState | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const lastTapRef = useRef<{ target: string; time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  const checkDoubleTap = (target: string, e: React.PointerEvent, onTrigger: () => void) => {
    if (e.pointerType === 'mouse') return;
    const now = Date.now();
    const prev = lastTapRef.current;
    if (
      prev &&
      prev.target === target &&
      now - prev.time < 320 &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 18
    ) {
      lastTapRef.current = null;
      onTrigger();
      return;
    }
    lastTapRef.current = { target, time: now, x: e.clientX, y: e.clientY };
  };

  const themeColor = element.color || label?.color || '#0052cc';
  const containerFontSize = element.size || 14;
  const containerIsBold = element.bold !== false;
  const containerIsItalic = Boolean(element.italic);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (titleValue !== element.text) {
      onUpdateText(element.id, { text: titleValue || t('textCard.defaultText') });
    }
  };

  const handleBodyBlur = () => {
    setIsEditingBody(false);
    if (bodyValue !== element.body) {
      onUpdateText(element.id, { body: bodyValue });
    }
  };

  const handleResizePointerDown = (dir: ResizeDirection, e: React.PointerEvent) => {
    if (isReadOnly || e.button === 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.stopPropagation();
    e.preventDefault();

    const cardEl = cardRef.current;
    if (!cardEl) return;

    resizeCleanupRef.current?.();

    const handleEl = e.currentTarget as HTMLElement;
    const activePointerId = e.pointerId;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = parseFloat(element.x) || 0;
    const startY = parseFloat(element.y) || 0;

    const fallbackWidth =
      element.mode === 'container' ? 340 : element.mode === 'annotation' ? 220 : cardEl.offsetWidth || 120;
    const fallbackHeight =
      element.mode === 'container' ? 240 : cardEl.offsetHeight || 96;

    const startWidth =
      typeof element.width === 'number' && Number.isFinite(element.width) && element.width > 0
        ? element.width
        : cardEl.offsetWidth || fallbackWidth;
    const startHeight =
      typeof element.height === 'number' && Number.isFinite(element.height) && element.height > 0
        ? element.height
        : cardEl.offsetHeight || fallbackHeight;

    const { minWidth, minHeight } = MODE_MIN_DIMENSIONS[element.mode];
    const hasHorizontal = dir.includes('e') || dir.includes('w');
    const hasVertical = dir.includes('n') || dir.includes('s');

    const shouldPersistWidth =
      element.mode === 'container' ||
      element.mode === 'annotation' ||
      typeof element.width === 'number' ||
      hasHorizontal;
    const shouldPersistHeight =
      element.mode === 'container' ||
      typeof element.height === 'number' ||
      hasVertical;

    let latestState: LiveResizeState = {
      x: startX,
      y: startY,
      width: shouldPersistWidth ? Math.round(startWidth) : undefined,
      height: shouldPersistHeight ? Math.round(startHeight) : undefined,
      displayWidth: Math.round(startWidth),
      displayHeight: Math.round(startHeight),
    };
    let hasDragged = false;
    let isFinished = false;

    const getLiveZoom = () => {
      if (!cardRef.current) return 1;
      const parsed = parseFloat(
        getComputedStyle(cardRef.current).getPropertyValue('--canvas-zoom')
      );
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    const updateStateFromPointer = (clientX: number, clientY: number) => {
      const zoom = getLiveZoom();
      const dx = (clientX - startClientX) / zoom;
      const dy = (clientY - startClientY) / zoom;

      if (!hasDragged && Math.hypot(dx, dy) < 1) return false;
      hasDragged = true;

      let nextX = startX;
      let nextY = startY;
      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (dir.includes('e')) {
        nextWidth = Math.max(minWidth, Math.round(startWidth + dx));
      } else if (dir.includes('w')) {
        nextWidth = Math.max(minWidth, Math.round(startWidth - dx));
        nextX = Math.round(startX + (startWidth - nextWidth));
      }

      if (dir.includes('s')) {
        nextHeight = Math.max(minHeight, Math.round(startHeight + dy));
      } else if (dir.includes('n')) {
        nextHeight = Math.max(minHeight, Math.round(startHeight - dy));
        nextY = Math.round(startY + (startHeight - nextHeight));
      }

      const roundedW = Math.round(nextWidth);
      const roundedH = Math.round(nextHeight);

      latestState = {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: shouldPersistWidth ? roundedW : undefined,
        height: shouldPersistHeight ? roundedH : undefined,
        displayWidth: roundedW,
        displayHeight: roundedH,
      };
      return true;
    };

    try {
      handleEl.setPointerCapture(activePointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    setLiveResize(latestState);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== activePointerId) return;
      if (moveEvent.pointerType === 'mouse' && moveEvent.buttons === 0) {
        finishResize(moveEvent);
        return;
      }
      if (updateStateFromPointer(moveEvent.clientX, moveEvent.clientY)) {
        setLiveResize(latestState);
      }
    };

    const finishResize = (endEvent?: Event) => {
      if (isFinished) return;
      if (endEvent instanceof PointerEvent && endEvent.pointerId !== activePointerId) return;

      if (endEvent instanceof PointerEvent && endEvent.type === 'pointerup') {
        updateStateFromPointer(endEvent.clientX, endEvent.clientY);
      }

      isFinished = true;
      cleanup();
      setLiveResize(null);

      if (!hasDragged) return;

      const updates: Partial<TextElement> = {};
      if (latestState.x !== Math.round(startX)) {
        updates.x = `${latestState.x}px`;
      }
      if (latestState.y !== Math.round(startY)) {
        updates.y = `${latestState.y}px`;
      }
      if (shouldPersistWidth && typeof latestState.width === 'number' && latestState.width !== element.width) {
        updates.width = latestState.width;
      }
      if (shouldPersistHeight && typeof latestState.height === 'number' && latestState.height !== element.height) {
        updates.height = latestState.height;
      }

      if (Object.keys(updates).length > 0) {
        onUpdateText(element.id, updates);
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', finishResize, true);
      window.removeEventListener('pointercancel', finishResize, true);
      window.removeEventListener('blur', finishResize);
      try {
        if (handleEl.hasPointerCapture?.(activePointerId)) {
          handleEl.releasePointerCapture(activePointerId);
        }
      } catch {
        // Ignore
      }
      resizeCleanupRef.current = null;
    };

    resizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', finishResize, true);
    window.addEventListener('pointercancel', finishResize, true);
    window.addEventListener('blur', finishResize);
  };

  const renderResizeHandles = (currentWidth?: number) => {
    if (!isSelected || isReadOnly) return null;

    const showHorizontalEdgeMid = currentWidth === undefined || currentWidth >= 76;

    return (
      <>
        {HANDLE_DEFINITIONS.map((h) => {
          if (!h.isCorner && (h.dir === 'n' || h.dir === 's') && !showHorizontalEdgeMid) {
            return null;
          }
          const isHorizontalEdge = h.dir === 'n' || h.dir === 's';
          const isVerticalEdge = h.dir === 'e' || h.dir === 'w';

          return (
            <div
              key={h.dir}
              role="slider"
              aria-label={`Resize ${h.dir}`}
              onPointerDown={(e) => handleResizePointerDown(h.dir, e)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                left: h.left,
                top: h.top,
                transform: 'translate(-50%, -50%) scale(calc(1 / var(--canvas-zoom, 1)))',
                transformOrigin: 'center center',
              }}
              className={`absolute touch-none flex items-center justify-center group/handle ${h.cursor} ${
                h.isCorner ? 'w-5 h-5 z-30' : 'w-4 h-4 z-20'
              }`}
            >
              {h.isCorner ? (
                <span className="w-2.5 h-2.5 rounded-[2px] bg-white border-2 border-sky-500 shadow-sm transition-transform group-hover/handle:scale-125 group-hover/handle:bg-sky-500" />
              ) : isHorizontalEdge ? (
                <span className="w-3.5 h-1 rounded-full bg-white border border-sky-500 shadow-sm transition-transform group-hover/handle:scale-125 group-hover/handle:bg-sky-500" />
              ) : isVerticalEdge ? (
                <span className="w-1 h-3.5 rounded-full bg-white border border-sky-500 shadow-sm transition-transform group-hover/handle:scale-125 group-hover/handle:bg-sky-500" />
              ) : null}
            </div>
          );
        })}

        {liveResize && (
          <div
            style={{
              left: '100%',
              top: '100%',
              transform: 'translate(8px, 8px) scale(calc(1 / var(--canvas-zoom, 1)))',
              transformOrigin: 'top left',
            }}
            className="absolute z-40 pointer-events-none font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-900/90 text-sky-300 border border-sky-500/45 shadow-md whitespace-nowrap tabular-nums"
          >
            {liveResize.displayWidth} × {liveResize.displayHeight}
          </div>
        )}
      </>
    );
  };

  if (isHiddenByFilter) {
    return null;
  }

  if (element.mode === 'container') {
    const activeWidth = liveResize?.width ?? element.width ?? 340;
    const activeHeight = liveResize?.height ?? element.height ?? 240;
    const containerTitleTextColor = getContrastTextColor(themeColor);

    return (
      <div
        ref={cardRef}
        id={element.id}
        data-text-id={element.id}
        data-selected={isSelected ? 'true' : 'false'}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isReadOnly && onFitContainer) {
            onFitContainer(element.id);
          }
        }}
        onPointerUp={(e) => {
          if (isReadOnly || !onFitContainer) return;
          if ((e.target as HTMLElement).closest('button, input, [role="slider"]')) return;
          checkDoubleTap('container-fit', e, () => onFitContainer(element.id));
        }}
        style={{
          left: liveResize ? `${liveResize.x}px` : element.x,
          top: liveResize ? `${liveResize.y}px` : element.y,
          width: activeWidth,
          height: activeHeight,
          borderColor: themeColor,
          backgroundColor: isDropTarget ? `${themeColor}2b` : `${themeColor}12`,
          boxShadow: isDropTarget
            ? `0 0 32px 6px ${themeColor}80, inset 0 0 24px ${themeColor}33`
            : isSelected || searchMatchState === 'match'
            ? '0 0 0 2px rgba(56, 189, 248, 0.85), 0 8px 24px rgba(0, 0, 0, 0.35)'
            : undefined,
          transform: isDropTarget ? 'scale(1.01)' : undefined,
        }}
        className={`canvas-text-node touch-canvas absolute border-2 rounded-2xl group z-[2] cursor-grab active:cursor-grabbing select-none transition-[opacity,filter,border-color,box-shadow,background-color] duration-200 ${
          isDropTarget ? 'border-solid ring-2 ring-white/40' : 'border-dashed'
        } ${searchMatchState === 'dimmed' ? 'opacity-20 saturate-50 hover:opacity-45' : ''}`}
      >
        {renderResizeHandles(activeWidth)}

        {/* Container Title Tag (counter-scaled to maintain constant screen dimensions across zoom levels) */}
        <div
          style={{
            backgroundColor: themeColor,
            bottom: 'calc(100% - 8px)',
            left: '16px',
            transform: 'scale(calc(1 / var(--canvas-zoom, 1)))',
            transformOrigin: 'left bottom',
            fontSize: `${containerFontSize}px`,
            fontWeight: containerIsBold ? 'bold' : 'normal',
            fontStyle: containerIsItalic ? 'italic' : 'normal',
            color: containerTitleTextColor,
          }}
          className="absolute px-3 py-0.5 rounded-md shadow-md cursor-text flex items-center gap-1.5 whitespace-nowrap leading-snug"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) {
              setTitleValue(element.text);
              setIsEditingTitle(true);
            }
          }}
          onPointerUp={(e) => {
            if (isReadOnly) return;
            checkDoubleTap('container-title', e, () => {
              e.stopPropagation();
              setTitleValue(element.text);
              setIsEditingTitle(true);
            });
          }}
        >
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              onDoubleClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                fontSize: `${containerFontSize}px`,
                fontWeight: containerIsBold ? 'bold' : 'normal',
                fontStyle: containerIsItalic ? 'italic' : 'normal',
                color: containerTitleTextColor,
                borderColor: containerTitleTextColor,
              }}
              className="bg-transparent border-b outline-none w-40 leading-snug"
            />
          ) : (
            <span>{element.text}</span>
          )}
        </div>

        {/* Category / Label Badge on Top Right */}
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
              onOpenLabelPicker(element.id, e);
            }}
            style={{
              backgroundColor: label.color,
              color: getContrastTextColor(label.color),
            }}
            className={`absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-md whitespace-nowrap ${
              !isReadOnly && onOpenLabelPicker ? 'cursor-pointer hover:brightness-110' : 'pointer-events-none'
            }`}
          >
            {label.name}
          </button>
        )}

        {/* Drop Indicator Badge when glowing */}
        {isDropTarget && (
          <div
            style={{ backgroundColor: themeColor }}
            className="absolute bottom-2.5 right-3 px-2.5 py-1 rounded-md text-white text-[10px] font-bold tracking-wide uppercase shadow-lg pointer-events-none"
          >
            {t('textCard.dropToGroup')}
          </div>
        )}

        {/* Hover / Selected Touch Action Controls (Outside Upper Right) */}
        {!isReadOnly && (
          <div className="touch-action-bar absolute -top-10 right-0 pb-2.5 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none group-hover:pointer-events-auto">
            <div className="flex items-center gap-1 bg-[#ebe7de]/95 dark:bg-neutral-900/95 rounded-full py-1 px-2 border border-[#c3beb1] dark:border-neutral-700 shadow-lg backdrop-blur-sm">
              {onFitContainer && (
                <button
                  onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFitContainer(element.id);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded-full cursor-pointer"
                  title={t('textCard.fitContainer')}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onOpenLabelPicker && (
                <button
                  onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenLabelPicker(element.id, e);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-[#5c584e] hover:text-blue-700 hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-blue-400 dark:hover:bg-neutral-800 rounded-full cursor-pointer"
                  title={t('node.labelBtn')}
                >
                  <Tag className="w-3.5 h-3.5" style={label ? { color: label.color } : undefined} />
                </button>
              )}
              <button
                onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(element.id, e);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded-full cursor-pointer"
                title={t('textCard.containerSettings')}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(element.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                className="p-1.5 text-[#5c584e] hover:text-red-700 hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-red-400 dark:hover:bg-neutral-800 rounded-full cursor-pointer"
                title={t('textCard.deleteContainer')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (element.mode === 'annotation') {
    const activeWidth = liveResize?.width ?? element.width ?? 220;
    const activeHeight = liveResize?.height ?? element.height;
    const hasCustomNoteColor = Boolean(element.color) && element.color !== '#0052cc';
    const noteFontSize = element.size ? Math.max(11, Math.min(28, element.size)) : 12;
    const noteIsBold = Boolean(element.bold);
    const noteIsItalic = Boolean(element.italic);

    return (
      <div
        ref={cardRef}
        id={element.id}
        data-text-id={element.id}
        data-selected={isSelected ? 'true' : 'false'}
        style={{
          left: liveResize ? `${liveResize.x}px` : element.x,
          top: liveResize ? `${liveResize.y}px` : element.y,
          width: activeWidth,
          height: activeHeight,
          minWidth: MODE_MIN_DIMENSIONS.annotation.minWidth,
          minHeight: MODE_MIN_DIMENSIONS.annotation.minHeight,
          ...(hasCustomNoteColor
            ? {
                borderColor: element.color,
                backgroundColor: `${element.color}22`,
              }
            : label
            ? {
                borderColor: label.color,
              }
            : {}),
        }}
        className={`canvas-text-node touch-canvas absolute flex flex-col border rounded-xl p-3 shadow-md group cursor-grab active:cursor-grabbing select-none transition-[opacity,filter,box-shadow] duration-200 ${
          hasCustomNoteColor
            ? 'backdrop-blur-sm text-[#1f1d18] dark:text-neutral-100'
            : 'bg-[#e9e1c9] dark:bg-amber-950/80 border-[#c9bd98] dark:border-amber-800/80 text-[#2b2821] dark:text-amber-100'
        } ${
          searchMatchState === 'dimmed'
            ? 'opacity-20 saturate-50 hover:opacity-50 z-10'
            : searchMatchState === 'match'
            ? 'opacity-100 z-20 ring-2 ring-sky-400/85 shadow-[0_0_22px_rgba(56,189,248,0.4)]'
            : isSelected
            ? 'z-10 ring-2 ring-sky-400/85'
            : 'z-10'
        }`}
      >
        {renderResizeHandles(activeWidth)}

        {/* Color-coded label badge on Sticky Note */}
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
              onOpenLabelPicker(element.id, e);
            }}
            style={{
              backgroundColor: label.color,
              color: getContrastTextColor(label.color),
            }}
            className={`absolute -top-2.5 left-3 max-w-[140px] px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-sm truncate z-20 ${
              !isReadOnly && onOpenLabelPicker ? 'cursor-pointer hover:brightness-110' : 'pointer-events-none'
            }`}
            title={label.name}
          >
            {label.name}
          </button>
        )}

        {/* Controls */}
        {!isReadOnly && (
          <div className="touch-action-bar absolute -top-7 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#ebe7de] dark:bg-neutral-900 rounded-full p-0.5 border border-[#c3beb1] dark:border-neutral-700 shadow-md">
            {element.containerId && (
              <button
                onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink(element.id);
                }}
                className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white rounded-full"
                title={t('textCard.unlinkContainer')}
              >
                <Unlink className="w-3 h-3" />
              </button>
            )}
            {onOpenLabelPicker && (
              <button
                onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLabelPicker(element.id, e);
                }}
                className="p-1.5 text-[#5c584e] hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400 rounded-full cursor-pointer"
                title={t('node.labelBtn')}
              >
                <Tag className="w-3 h-3" style={label ? { color: label.color } : undefined} />
              </button>
            )}
            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings(element.id, e);
              }}
              className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white rounded-full"
              title={t('common.settings')}
            >
              <Settings className="w-3 h-3" />
            </button>
            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(element.id);
              }}
              className="p-1.5 text-[#5c584e] hover:text-red-700 dark:text-neutral-400 dark:hover:text-red-400 rounded-full"
              title={t('common.delete')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Title */}
        <div
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) {
              setTitleValue(element.text || t('textCard.stickyNote'));
              setIsEditingTitle(true);
            }
          }}
          onPointerUp={(e) => {
            if (isReadOnly) return;
            checkDoubleTap('note-title', e, () => {
              e.stopPropagation();
              setTitleValue(element.text || t('textCard.stickyNote'));
              setIsEditingTitle(true);
            });
          }}
          style={{
            ...(hasCustomNoteColor ? { borderColor: `${element.color}55` } : {}),
            fontSize: `${Math.max(12, noteFontSize)}px`,
            fontStyle: noteIsItalic ? 'italic' : 'normal',
          }}
          className={`shrink-0 font-bold border-b pb-1 mb-1.5 cursor-text truncate ${
            hasCustomNoteColor ? '' : 'border-[#d5cab0] dark:border-amber-800/50'
          }`}
        >
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onDoubleClick={(e) => e.stopPropagation()}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              autoFocus
              className="w-full bg-[#dfd5b8]/70 dark:bg-amber-900/50 px-1 py-0.5 rounded outline-none border border-[#b8a97e] dark:border-amber-400 text-xs font-bold"
            />
          ) : (
            element.text || t('textCard.stickyNote')
          )}
        </div>

        {/* Body */}
        <div
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) {
              setBodyValue(element.body || '');
              setIsEditingBody(true);
            }
          }}
          onPointerUp={(e) => {
            if (isReadOnly) return;
            checkDoubleTap('note-body', e, () => {
              e.stopPropagation();
              setBodyValue(element.body || '');
              setIsEditingBody(true);
            });
          }}
          style={{
            fontSize: `${noteFontSize}px`,
            fontWeight: noteIsBold ? 'bold' : 'normal',
            fontStyle: noteIsItalic ? 'italic' : 'normal',
          }}
          className="flex-1 min-h-0 overflow-y-auto leading-relaxed cursor-text whitespace-pre-wrap break-words opacity-90"
        >
          {isEditingBody ? (
            <textarea
              value={bodyValue}
              onChange={(e) => setBodyValue(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onDoubleClick={(e) => e.stopPropagation()}
              onBlur={handleBodyBlur}
              autoFocus
              rows={3}
              className="w-full h-full min-h-[48px] bg-[#dfd5b8]/70 dark:bg-amber-900/50 p-1 rounded outline-none border border-[#b8a97e] dark:border-amber-400 text-xs resize-none"
            />
          ) : (
            element.body || <span className="opacity-45 italic">{t('textCard.doubleTapNote')}</span>
          )}
        </div>
      </div>
    );
  }

  // Floating text
  const activeFloatingWidth = liveResize?.width ?? element.width;
  const activeFloatingHeight = liveResize?.height ?? element.height;

  return (
    <div
      ref={cardRef}
      id={element.id}
      data-text-id={element.id}
      data-selected={isSelected ? 'true' : 'false'}
      style={{
        left: liveResize ? `${liveResize.x}px` : element.x,
        top: liveResize ? `${liveResize.y}px` : element.y,
        width: activeFloatingWidth,
        height: activeFloatingHeight,
        minWidth: MODE_MIN_DIMENSIONS.floating.minWidth,
        minHeight: MODE_MIN_DIMENSIONS.floating.minHeight,
        color: element.color,
        fontSize: `${element.size}px`,
        fontWeight: element.bold ? 'bold' : 'normal',
        fontStyle: element.italic ? 'italic' : 'normal',
        ...(label
          ? {
              borderColor: `${label.color}70`,
              backgroundColor: `${label.color}14`,
            }
          : {}),
      }}
      className={`canvas-text-node touch-canvas absolute group cursor-grab active:cursor-grabbing p-1.5 rounded select-none transition-[opacity,filter,box-shadow] duration-200 ${
        label ? 'border' : ''
      } ${
        searchMatchState === 'dimmed'
          ? 'opacity-20 saturate-50 hover:opacity-50 z-10'
          : searchMatchState === 'match'
          ? 'opacity-100 z-20 ring-2 ring-sky-400/85 shadow-[0_0_18px_rgba(56,189,248,0.35)]'
          : isSelected
          ? 'z-10 ring-2 ring-sky-400/85'
          : 'z-10 hover:ring-1 hover:ring-[#8a8579]/70 dark:hover:ring-neutral-700'
      }`}
    >
      {renderResizeHandles(activeFloatingWidth)}

      {/* Color-coded label badge on Floating Text */}
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
            onOpenLabelPicker(element.id, e);
          }}
          style={{
            backgroundColor: label.color,
            color: getContrastTextColor(label.color),
          }}
          className={`absolute -top-5 left-0 max-w-[140px] px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-sm truncate z-20 ${
            !isReadOnly && onOpenLabelPicker ? 'cursor-pointer hover:brightness-110' : 'pointer-events-none'
          }`}
          title={label.name}
        >
          {label.name}
        </button>
      )}

      {!isReadOnly && (
        <div className="touch-action-bar absolute -top-7 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#ebe7de] dark:bg-neutral-900 rounded-full p-0.5 border border-[#c3beb1] dark:border-neutral-700 shadow-md">
          {element.containerId && (
            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                onUnlink(element.id);
              }}
              className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white rounded-full"
              title={t('textCard.unlinkContainer')}
            >
              <Unlink className="w-3 h-3" />
            </button>
          )}
          {onOpenLabelPicker && (
            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLabelPicker(element.id, e);
              }}
              className="p-1.5 text-[#5c584e] hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400 rounded-full cursor-pointer"
              title={t('node.labelBtn')}
            >
              <Tag className="w-3 h-3" style={label ? { color: label.color } : undefined} />
            </button>
          )}
          <button
            onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings(element.id, e);
            }}
            className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white rounded-full"
            title={t('common.settings')}
          >
            <Settings className="w-3 h-3" />
          </button>
          <button
            onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
            className="p-1.5 text-[#5c584e] hover:text-red-700 dark:text-neutral-400 dark:hover:text-red-400 rounded-full"
            title={t('common.delete')}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isReadOnly) {
            setTitleValue(element.text);
            setIsEditingTitle(true);
          }
        }}
        onPointerUp={(e) => {
          if (isReadOnly) return;
          checkDoubleTap('floating-text', e, () => {
            e.stopPropagation();
            setTitleValue(element.text);
            setIsEditingTitle(true);
          });
        }}
        className={`w-full h-full cursor-text tracking-tight whitespace-pre-wrap break-words ${
          activeFloatingHeight ? 'overflow-y-auto' : ''
        }`}
      >
        {isEditingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
            autoFocus
            style={{
              fontSize: `${element.size}px`,
              color: element.color,
              fontWeight: element.bold ? 'bold' : 'normal',
              fontStyle: element.italic ? 'italic' : 'normal',
            }}
            className="w-full max-w-full bg-transparent border-b border-blue-500 outline-none"
          />
        ) : (
          element.text
        )}
      </div>
    </div>
  );
};

