import React, { useRef, useState } from 'react';
import { TextElement, LabelItem } from '../types/workflow';
import { Maximize2, Pencil, Settings, Trash2, Unlink } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface CanvasTextCardProps {
  element: TextElement;
  label?: LabelItem;
  isReadOnly: boolean;
  isDropTarget?: boolean;
  isSelected?: boolean;
  searchMatchState?: 'none' | 'match' | 'dimmed';
  onOpenSettings: (elementId: string, e: React.MouseEvent) => void;
  onDelete: (elementId: string) => void;
  onUnlink: (elementId: string) => void;
  onUpdateText: (elementId: string, updates: Partial<TextElement>) => void;
  onFitContainer?: (elementId: string) => void;
}

export const CanvasTextCard: React.FC<CanvasTextCardProps> = ({
  element,
  label,
  isReadOnly,
  isDropTarget = false,
  isSelected = false,
  searchMatchState = 'none',
  onOpenSettings,
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
  const lastTapRef = useRef<{ target: string; time: number; x: number; y: number } | null>(null);

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

  if (element.mode === 'container') {
    return (
      <div
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
          if ((e.target as HTMLElement).closest('button, input')) return;
          checkDoubleTap('container-fit', e, () => onFitContainer(element.id));
        }}
        style={{
          left: element.x,
          top: element.y,
          width: element.width || 340,
          height: element.height || 240,
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
          }}
          className="absolute px-3 py-0.5 rounded-md text-white shadow-md cursor-text flex items-center gap-1.5 whitespace-nowrap leading-snug"
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
              }}
              className="bg-transparent text-white border-b border-white outline-none w-40 leading-snug"
            />
          ) : (
            <span>{element.text}</span>
          )}
        </div>

        {/* Category / Label Badge on Top Right */}
        {label && (
          <div
            style={{ backgroundColor: label.color }}
            className="absolute -top-3 right-4 px-2 py-0.5 rounded-full text-white text-[10px] font-semibold shadow-md"
          >
            {label.name}
          </div>
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

        {/* Hover / Selected Touch Action Controls */}
        {!isReadOnly && (
          <div className="touch-action-bar absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#ebe7de]/95 dark:bg-neutral-900/90 rounded-lg p-1 border border-[#c3beb1] dark:border-neutral-700 shadow-lg">
            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                setTitleValue(element.text);
                setIsEditingTitle(true);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
              title={t('textCard.renameContainer')}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {onFitContainer && (
              <button
                onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  onFitContainer(element.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
                title={t('textCard.fitContainer')}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings(element.id, e);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
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
              className="p-1.5 text-[#5c584e] hover:text-red-700 hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-red-400 dark:hover:bg-neutral-800 rounded cursor-pointer"
              title={t('textCard.deleteContainer')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (element.mode === 'annotation') {
    return (
      <div
        id={element.id}
        data-text-id={element.id}
        data-selected={isSelected ? 'true' : 'false'}
        style={{
          left: element.x,
          top: element.y,
          width: 220,
        }}
        className={`canvas-text-node touch-canvas absolute bg-[#e9e1c9] dark:bg-amber-950/80 border border-[#c9bd98] dark:border-amber-800/80 rounded-xl p-3 shadow-md group cursor-grab active:cursor-grabbing text-[#2b2821] dark:text-amber-100 select-none transition-[opacity,filter,box-shadow] duration-200 ${
          searchMatchState === 'dimmed'
            ? 'opacity-20 saturate-50 hover:opacity-50 z-10'
            : searchMatchState === 'match'
            ? 'opacity-100 z-20 ring-2 ring-sky-400/85 shadow-[0_0_22px_rgba(56,189,248,0.4)]'
            : isSelected
            ? 'z-10 ring-2 ring-sky-400/85'
            : 'z-10'
        }`}
      >
        {/* Controls */}
        {!isReadOnly && (
          <div className="touch-action-bar absolute -top-3.5 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#ebe7de] dark:bg-neutral-900 rounded-full p-0.5 border border-[#c3beb1] dark:border-neutral-700 shadow-md">
            <button
              onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                setBodyValue(element.body || '');
                setIsEditingBody(true);
              }}
              className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white rounded-full"
              title={t('textCard.editNote')}
            >
              <Pencil className="w-3 h-3" />
            </button>
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
          className="font-bold text-xs border-b border-[#d5cab0] dark:border-amber-800/50 pb-1 mb-1.5 cursor-text truncate"
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
          className="text-xs leading-relaxed min-h-[40px] cursor-text whitespace-pre-wrap break-words opacity-90"
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
              className="w-full bg-[#dfd5b8]/70 dark:bg-amber-900/50 p-1 rounded outline-none border border-[#b8a97e] dark:border-amber-400 text-xs resize-none"
            />
          ) : (
            element.body || <span className="opacity-45 italic">{t('textCard.doubleTapNote')}</span>
          )}
        </div>
      </div>
    );
  }

  // Floating text
  return (
    <div
      id={element.id}
      data-text-id={element.id}
      data-selected={isSelected ? 'true' : 'false'}
      style={{
        left: element.x,
        top: element.y,
        color: element.color,
        fontSize: `${element.size}px`,
        fontWeight: element.bold ? 'bold' : 'normal',
        fontStyle: element.italic ? 'italic' : 'normal',
      }}
      className={`canvas-text-node touch-canvas absolute group cursor-grab active:cursor-grabbing p-1.5 rounded select-none transition-[opacity,filter,box-shadow] duration-200 ${
        searchMatchState === 'dimmed'
          ? 'opacity-20 saturate-50 hover:opacity-50 z-10'
          : searchMatchState === 'match'
          ? 'opacity-100 z-20 ring-2 ring-sky-400/85 shadow-[0_0_18px_rgba(56,189,248,0.35)]'
          : isSelected
          ? 'z-10 ring-2 ring-sky-400/85'
          : 'z-10 hover:ring-1 hover:ring-[#8a8579]/70 dark:hover:ring-neutral-700'
      }`}
    >
      {!isReadOnly && (
        <div className="touch-action-bar absolute -top-3.5 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#ebe7de] dark:bg-neutral-900 rounded-full p-0.5 border border-[#c3beb1] dark:border-neutral-700 shadow-md">
          <button
            onPointerDown={(e) => { if (e.button !== 1) e.stopPropagation(); }}
            onClick={(e) => {
              e.stopPropagation();
              setTitleValue(element.text);
              setIsEditingTitle(true);
            }}
            className="p-1.5 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white rounded-full"
            title={t('textCard.editText')}
          >
            <Pencil className="w-3 h-3" />
          </button>
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
        className="cursor-text tracking-tight whitespace-pre-wrap"
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
            className="bg-transparent border-b border-blue-500 outline-none"
          />
        ) : (
          element.text
        )}
      </div>
    </div>
  );
};
