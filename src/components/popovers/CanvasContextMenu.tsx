import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  Crosshair,
  Layers,
  Maximize2,
  PencilLine,
  Plus,
  Redo2,
  RotateCcw,
  StickyNote,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { formatShortcutString, ShortcutBinding } from '../../utils/keyboardShortcuts';

interface CanvasContextMenuProps {
  position: { x: number; y: number };
  isReadOnly: boolean;
  selectedCount: number;
  selectedNodeCount: number;
  hasClearableSelection: boolean;
  totalSelectableCount: number;
  nodeCount: number;
  undoCount: number;
  redoCount: number;
  zoom: number;
  clearSelectionBinding: ShortcutBinding;
  undoBinding: ShortcutBinding;
  redoBinding: ShortcutBinding;
  onClose: () => void;
  onBackdropContextMenu: (
    e: React.MouseEvent<HTMLDivElement>,
    backdropEl: HTMLDivElement | null
  ) => void;
  onAddNode: () => void;
  onAddText: (type: 'floating' | 'container' | 'annotation') => void;
  onBatchRename?: () => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitAll: () => void;
  onCenterCanvas: () => void;
  onResetZoom: () => void;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  position,
  isReadOnly,
  selectedCount,
  selectedNodeCount,
  hasClearableSelection,
  totalSelectableCount,
  nodeCount,
  undoCount,
  redoCount,
  zoom,
  clearSelectionBinding,
  undoBinding,
  redoBinding,
  onClose,
  onBackdropContextMenu,
  onAddNode,
  onAddText,
  onBatchRename,
  onClearSelection,
  onSelectAll,
  onUndo,
  onRedo,
  onFitAll,
  onCenterCanvas,
  onResetZoom,
}) => {
  const { t } = useLanguage();
  const menuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>({
    left: position.x,
    top: position.y,
  });
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    const rafId = requestAnimationFrame(() => {
      setEntered(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, [position.x, position.y]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = position.x;
    let top = position.y;

    if (left + rect.width > vw - margin) {
      left = Math.max(margin, position.x - rect.width);
    }
    if (top + rect.height > vh - margin) {
      top = Math.max(margin, position.y - rect.height);
    }

    left = Math.max(margin, Math.min(left, vw - rect.width - margin));
    top = Math.max(margin, Math.min(top, vh - rect.height - margin));

    setCoords({ left, top });
  }, [position.x, position.y, isReadOnly, selectedCount, selectedNodeCount, totalSelectableCount]);

  useEffect(() => {
    const handleDismissOnResizeOrBlur = () => onClose();
    window.addEventListener('blur', handleDismissOnResizeOrBlur);
    window.addEventListener('resize', handleDismissOnResizeOrBlur);
    return () => {
      window.removeEventListener('blur', handleDismissOnResizeOrBlur);
      window.removeEventListener('resize', handleDismissOnResizeOrBlur);
    };
  }, [onClose]);

  const zoomPercent = Math.round(zoom * 100);
  const clearShortcut = formatShortcutString(clearSelectionBinding);
  const undoShortcut = formatShortcutString(undoBinding);
  const redoShortcut = formatShortcutString(redoBinding);

  const itemClass =
    'w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-3 transition-colors cursor-pointer text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800/90';
  const disabledItemClass =
    'w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-3 text-[#9b9588] dark:text-neutral-600 cursor-not-allowed';

  return (
    <>
      <div
        ref={backdropRef}
        data-canvas-ui="true"
        className="fixed inset-0 z-40"
        onPointerDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => onBackdropContextMenu(e, backdropRef.current)}
      />

      <div
        ref={menuRef}
        role="menu"
        aria-label={t('canvasMenu.title')}
        data-canvas-ui="true"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ left: coords.left, top: coords.top }}
        className={`fixed z-50 w-60 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto bg-[#ebe7de]/95 dark:bg-neutral-900/95 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl p-1.5 text-xs backdrop-blur-md origin-top-left transition-[opacity,transform] duration-120 ease-out ${
          entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="flex items-center justify-between px-2.5 py-1 mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#635e54] dark:text-neutral-400">
          <span>{t('canvasMenu.title')}</span>
          {isReadOnly && (
            <span className="px-1.5 py-0.5 rounded bg-[#dcd7cc] dark:bg-neutral-800 text-[9px] font-medium normal-case tracking-normal text-[#5c584e] dark:text-neutral-400">
              {t('canvasMenu.readOnlyBadge')}
            </span>
          )}
        </div>

        {!isReadOnly && (
          <>
            <div className="space-y-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddNode();
                  onClose();
                }}
                className="w-full text-left px-2.5 py-1.5 text-white bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('canvasMenu.addNode')}</span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddText('floating');
                  onClose();
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Type className="w-3.5 h-3.5 text-[#635e54] dark:text-neutral-400 shrink-0" />
                  <span className="truncate">{t('canvasMenu.addText')}</span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddText('container');
                  onClose();
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Layers className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0" />
                  <span className="truncate">{t('canvasMenu.addContainer')}</span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAddText('annotation');
                  onClose();
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <StickyNote className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span className="truncate">{t('canvasMenu.addStickyNote')}</span>
                </span>
              </button>
            </div>

            <div className="h-px bg-[#d4cfc3] dark:bg-neutral-800 my-1.5" />
          </>
        )}

        {/* Selection Actions */}
        <div className="space-y-0.5">
          {!isReadOnly && selectedNodeCount >= 2 && onBatchRename && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onBatchRename();
                onClose();
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 min-w-0">
                <PencilLine className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400 shrink-0" />
                <span className="truncate font-medium">{t('canvasMenu.batchRename')}</span>
              </span>
              <span className="px-1.5 py-0.2 rounded bg-blue-600/15 dark:bg-sky-500/20 text-blue-800 dark:text-sky-300 text-[10px] font-semibold tabular-nums shrink-0">
                {selectedNodeCount}
              </span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={totalSelectableCount === 0}
            onClick={() => {
              onSelectAll();
              onClose();
            }}
            className={totalSelectableCount > 0 ? itemClass : disabledItemClass}
          >
            <span className="flex items-center gap-2 min-w-0">
              <CheckSquare
                className={`w-3.5 h-3.5 shrink-0 ${
                  totalSelectableCount > 0
                    ? 'text-blue-700 dark:text-sky-400'
                    : 'text-[#9b9588] dark:text-neutral-600'
                }`}
              />
              <span className="truncate">{t('canvasMenu.selectAll')}</span>
            </span>
            {totalSelectableCount > 0 && (
              <span className="text-[10px] tabular-nums text-[#635e54] dark:text-neutral-400">
                {totalSelectableCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={!hasClearableSelection}
            onClick={() => {
              onClearSelection();
              onClose();
            }}
            className={hasClearableSelection ? itemClass : disabledItemClass}
          >
            <span className="flex items-center gap-2 min-w-0">
              <X
                className={`w-3.5 h-3.5 shrink-0 ${
                  hasClearableSelection
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[#9b9588] dark:text-neutral-600'
                }`}
              />
              <span className="truncate">{t('canvasMenu.clearSelection')}</span>
              {selectedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-blue-600/15 dark:bg-sky-500/20 text-blue-800 dark:text-sky-300 text-[10px] font-semibold tabular-nums">
                  {selectedCount}
                </span>
              )}
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#dcd7cc]/90 dark:bg-neutral-800 text-[#5c584e] dark:text-neutral-400 border border-[#c3beb1] dark:border-neutral-700 shrink-0">
              {clearShortcut}
            </kbd>
          </button>
        </div>

        <div className="h-px bg-[#d4cfc3] dark:bg-neutral-800 my-1.5" />

        {/* View Controls */}
        <div className="space-y-0.5">
          <button
            type="button"
            role="menuitem"
            disabled={nodeCount === 0}
            onClick={() => {
              onFitAll();
              onClose();
            }}
            className={nodeCount > 0 ? itemClass : disabledItemClass}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Maximize2
                className={`w-3.5 h-3.5 shrink-0 ${
                  nodeCount > 0
                    ? 'text-[#635e54] dark:text-neutral-400'
                    : 'text-[#9b9588] dark:text-neutral-600'
                }`}
              />
              <span className="truncate">{t('canvasMenu.fitAll')}</span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCenterCanvas();
              onClose();
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Crosshair className="w-3.5 h-3.5 text-[#635e54] dark:text-neutral-400 shrink-0" />
              <span className="truncate">{t('canvasMenu.centerCanvas')}</span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onResetZoom();
              onClose();
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2 min-w-0">
              <RotateCcw className="w-3.5 h-3.5 text-[#635e54] dark:text-neutral-400 shrink-0" />
              <span className="truncate">{t('canvasMenu.resetZoom')}</span>
            </span>
            <span className="text-[10px] font-mono tabular-nums text-[#635e54] dark:text-neutral-400 shrink-0">
              {zoomPercent}%
            </span>
          </button>
        </div>

        {!isReadOnly && (
          <>
            <div className="h-px bg-[#d4cfc3] dark:bg-neutral-800 my-1.5" />
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                role="menuitem"
                disabled={undoCount === 0}
                title={`${t('canvasMenu.undo')} (${undoShortcut})`}
                onClick={() => {
                  onUndo();
                  onClose();
                }}
                className={`px-2 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  undoCount > 0
                    ? 'text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800/90 cursor-pointer'
                    : 'text-[#9b9588] dark:text-neutral-600 cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-medium">{t('canvasMenu.undo')}</span>
                <span className="text-[10px] tabular-nums opacity-70">{undoCount}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                disabled={redoCount === 0}
                title={`${t('canvasMenu.redo')} (${redoShortcut})`}
                onClick={() => {
                  onRedo();
                  onClose();
                }}
                className={`px-2 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  redoCount > 0
                    ? 'text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800/90 cursor-pointer'
                    : 'text-[#9b9588] dark:text-neutral-600 cursor-not-allowed'
                }`}
              >
                <Redo2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-medium">{t('canvasMenu.redo')}</span>
                <span className="text-[10px] tabular-nums opacity-70">{redoCount}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};
