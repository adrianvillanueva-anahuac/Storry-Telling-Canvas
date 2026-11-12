import React, { useState } from 'react';
import { TextElement, LabelItem } from '../types/workflow';
import { Settings, Trash2, Unlink } from 'lucide-react';

interface CanvasTextCardProps {
  element: TextElement;
  label?: LabelItem;
  isReadOnly: boolean;
  isDropTarget?: boolean;
  onOpenSettings: (elementId: string, e: React.MouseEvent) => void;
  onDelete: (elementId: string) => void;
  onUnlink: (elementId: string) => void;
  onUpdateText: (elementId: string, updates: Partial<TextElement>) => void;
}

export const CanvasTextCard: React.FC<CanvasTextCardProps> = ({
  element,
  label,
  isReadOnly,
  isDropTarget = false,
  onOpenSettings,
  onDelete,
  onUnlink,
  onUpdateText,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(element.text);
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [bodyValue, setBodyValue] = useState(element.body || '');

  const themeColor = label?.color || element.color || '#0052cc';

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (titleValue !== element.text) {
      onUpdateText(element.id, { text: titleValue || 'Text' });
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
        style={{
          left: element.x,
          top: element.y,
          width: element.width || 340,
          height: element.height || 240,
          borderColor: themeColor,
          backgroundColor: isDropTarget ? `${themeColor}2b` : `${themeColor}12`,
          boxShadow: isDropTarget
            ? `0 0 32px 6px ${themeColor}80, inset 0 0 24px ${themeColor}33`
            : undefined,
          transform: isDropTarget ? 'scale(1.01)' : undefined,
        }}
        className={`canvas-text-node absolute border-2 rounded-2xl group z-[2] cursor-grab active:cursor-grabbing select-none transition-[border-color,box-shadow,background-color] duration-150 ${
          isDropTarget ? 'border-solid ring-2 ring-white/40' : 'border-dashed'
        }`}
      >
        {/* Container Title Tag */}
        <div
          style={{ backgroundColor: themeColor }}
          className="absolute -top-3.5 left-4 px-3 py-0.5 rounded-md text-white text-xs font-bold shadow-md cursor-text flex items-center gap-1.5"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) setIsEditingTitle(true);
          }}
        >
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              autoFocus
              className="bg-transparent text-white border-b border-white outline-none text-xs font-bold w-36"
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
            Soltar para agrupar
          </div>
        )}

        {/* Hover Action Controls */}
        {!isReadOnly && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-neutral-900/90 rounded-lg p-1 border border-neutral-700 shadow-lg">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings(element.id, e);
              }}
              className="p-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded"
              title="Container Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(element.id);
              }}
              className="p-1 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded"
              title="Delete Container"
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
        style={{
          left: element.x,
          top: element.y,
          width: 220,
        }}
        className="canvas-text-node absolute bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3 shadow-md group z-10 cursor-grab active:cursor-grabbing text-neutral-900 dark:text-amber-100 select-none"
      >
        {/* Controls */}
        {!isReadOnly && (
          <div className="absolute -top-3 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-neutral-900 rounded-full p-0.5 border border-neutral-700 shadow-md">
            {element.containerId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink(element.id);
                }}
                className="p-1 text-neutral-400 hover:text-white rounded-full"
                title="Unlink from Container"
              >
                <Unlink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings(element.id, e);
              }}
              className="p-1 text-neutral-400 hover:text-white rounded-full"
              title="Settings"
            >
              <Settings className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(element.id);
              }}
              className="p-1 text-neutral-400 hover:text-red-400 rounded-full"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Title */}
        <div
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) setIsEditingTitle(true);
          }}
          className="font-bold text-xs border-b border-amber-200 dark:border-amber-800/50 pb-1 mb-1.5 cursor-text truncate"
        >
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              autoFocus
              className="w-full bg-amber-100/50 dark:bg-amber-900/50 px-1 py-0.5 rounded outline-none border border-amber-400 text-xs font-bold"
            />
          ) : (
            element.text || 'Sticky Note'
          )}
        </div>

        {/* Body */}
        <div
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) setIsEditingBody(true);
          }}
          className="text-xs leading-relaxed min-h-[40px] cursor-text whitespace-pre-wrap break-words opacity-90"
        >
          {isEditingBody ? (
            <textarea
              value={bodyValue}
              onChange={(e) => setBodyValue(e.target.value)}
              onBlur={handleBodyBlur}
              autoFocus
              rows={3}
              className="w-full bg-amber-100/50 dark:bg-amber-900/50 p-1 rounded outline-none border border-amber-400 text-xs resize-none"
            />
          ) : (
            element.body || <span className="opacity-40 italic">Double-click to add note...</span>
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
      style={{
        left: element.x,
        top: element.y,
        color: element.color,
        fontSize: `${element.size}px`,
        fontWeight: element.bold ? 'bold' : 'normal',
        fontStyle: element.italic ? 'italic' : 'normal',
      }}
      className="canvas-text-node absolute group z-10 cursor-grab active:cursor-grabbing p-1.5 rounded hover:ring-1 hover:ring-neutral-700 select-none"
    >
      {!isReadOnly && (
        <div className="absolute -top-3 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-neutral-900 rounded-full p-0.5 border border-neutral-700 shadow-md">
          {element.containerId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnlink(element.id);
              }}
              className="p-1 text-neutral-400 hover:text-white rounded-full"
              title="Unlink from Container"
            >
              <Unlink className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings(element.id, e);
            }}
            className="p-1 text-neutral-400 hover:text-white rounded-full"
            title="Settings"
          >
            <Settings className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
            className="p-1 text-neutral-400 hover:text-red-400 rounded-full"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isReadOnly) setIsEditingTitle(true);
        }}
        className="cursor-text tracking-tight whitespace-pre-wrap"
      >
        {isEditingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
            autoFocus
            style={{ fontSize: `${element.size}px`, color: element.color }}
            className="bg-transparent border-b border-blue-500 outline-none"
          />
        ) : (
          element.text
        )}
      </div>
    </div>
  );
};
