import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Highlighter,
  Maximize2,
  Minimize2,
  MousePointer,
  PenTool,
  Ruler,
  Shapes,
  Slash,
  Square,
  Undo2,
  User,
  Volume2,
} from 'lucide-react';
import { DrawingToolType } from '../../utils/drawingTools';
import { useLanguage } from '../../hooks/useLanguage';

interface DrawingToolsBarProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  figureMenuOpen: boolean;
  onToggleFigureMenu: () => void;
  onSpawnFigure: (shape: string) => void;
  strokeThickness: number;
  onChangeThickness: (val: number) => void;
  strokeColor: string;
  layerDefaultColor: string;
  onChangeColor: (color: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  isReadOnly?: boolean;
}

export const DrawingToolsBar: React.FC<DrawingToolsBarProps> = ({
  activeTool,
  onSelectTool,
  figureMenuOpen,
  onToggleFigureMenu,
  onSpawnFigure,
  strokeThickness,
  onChangeThickness,
  strokeColor,
  layerDefaultColor,
  onChangeColor,
  canUndo,
  onUndo,
  isReadOnly = false,
}) => {
  const { t } = useLanguage();

  const quickColors = [
    { label: t('drawingBar.colorRed'), value: '#ef4444' },
    { label: t('drawingBar.colorAmber'), value: '#facc15' },
    { label: t('drawingBar.colorCyan'), value: '#06b6d4' },
    { label: t('drawingBar.colorWhite'), value: '#ffffff' },
  ];

  const showThicknessSlider =
    activeTool === 'pencil' ||
    activeTool === 'highlighter' ||
    activeTool === 'line' ||
    activeTool === 'arrow' ||
    activeTool === 'rect' ||
    activeTool === 'ellipse' ||
    activeTool === 'measure';

  const paletteColors = [
    { label: t('drawingBar.layerColor'), value: layerDefaultColor },
    ...quickColors.filter((c) => c.value.toLowerCase() !== layerDefaultColor.toLowerCase()),
  ];

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="touch-canvas absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 max-w-[96vw]"
    >
      {/* Always-accessible Bottom-Centered Drawing Toolbar (1st child div matches target selector) */}
      <div className="relative bg-[#ebe7de]/95 dark:bg-neutral-900/95 backdrop-blur-md px-2.5 py-2 rounded-2xl border border-[#c3beb1] dark:border-neutral-700/80 shadow-2xl flex flex-wrap items-center justify-center gap-2 max-w-full">
        {/* Vector Stamps Submenu floating above the bar when open */}
        {figureMenuOpen && !isReadOnly && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 grid grid-cols-5 gap-1.5 p-2 bg-[#ebe7de]/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-xl border border-[#c3beb1] dark:border-neutral-700/80 shadow-2xl w-60 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => onSpawnFigure('square')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampSquare')}
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSpawnFigure('circle')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampCircle')}
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSpawnFigure('arrow')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampArrow')}
            >
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
            <button
              onClick={() => onSpawnFigure('line-arrow')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampLineArrow')}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSpawnFigure('speaker')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampSpeaker')}
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSpawnFigure('zoom-in')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampZoomIn')}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSpawnFigure('zoom-out')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampZoomOut')}
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSpawnFigure('hand-cube')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampHand')}
            >
              <Hand className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSpawnFigure('human-circle')}
              className="touch-target p-2 text-[#433f37] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs transition-colors"
              title={t('drawingBar.stampHuman')}
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Tool Buttons */}
        <div className="flex items-center gap-1 p-1 bg-[#dcd7cc] dark:bg-neutral-950 rounded-xl border border-[#c6c0b3] dark:border-neutral-800 overflow-x-auto max-w-full">
          <button
            onClick={() => onSelectTool('none')}
            className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
              activeTool === 'none'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
            }`}
            title={t('drawingBar.toolSelect')}
          >
            <MousePointer className="w-4 h-4" />
          </button>

          {!isReadOnly && (
            <>
              <button
                onClick={() => onSelectTool('pencil')}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'pencil'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolPencil')}
              >
                <PenTool className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectTool('highlighter')}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'highlighter'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolHighlighter')}
              >
                <Highlighter className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-[#c3beb1] dark:bg-neutral-800 mx-0.5 shrink-0" />

              <button
                onClick={() => onSelectTool('line')}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'line'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolLine')}
              >
                <Slash className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectTool('arrow')}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'arrow'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolArrow')}
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectTool('rect')}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'rect'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolRect')}
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectTool('ellipse')}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'ellipse'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolEllipse')}
              >
                <Circle className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => onSelectTool('measure')}
            className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
              activeTool === 'measure'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
            }`}
            title={t('drawingBar.toolMeasure')}
          >
            <Ruler className="w-4 h-4" />
          </button>

          {!isReadOnly && (
            <>
              <button
                onClick={onToggleFigureMenu}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'figure' || figureMenuOpen
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolStamps')}
              >
                <Shapes className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-[#c3beb1] dark:bg-neutral-800 mx-0.5 shrink-0" />

              <button
                onClick={() => onSelectTool('eraser')}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  activeTool === 'eraser'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/70'
                }`}
                title={t('drawingBar.toolEraser')}
              >
                <Eraser className="w-4 h-4" />
              </button>

              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`touch-target p-2 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  canUndo
                    ? 'text-[#433f37] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800/70'
                    : 'text-[#a39d90] dark:text-neutral-600 cursor-not-allowed'
                }`}
                title={t('drawingBar.toolUndo')}
              >
                <Undo2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Stroke Color & Size Controls */}
        {!isReadOnly && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-[#dcd7cc] dark:bg-neutral-950 rounded-xl border border-[#c6c0b3] dark:border-neutral-800">
            <div className="flex items-center gap-1.5" title={t('drawingBar.strokeColor')}>
              {paletteColors.map((swatch) => {
                const isSelected = strokeColor.toLowerCase() === swatch.value.toLowerCase();
                return (
                  <button
                    key={swatch.value}
                    onClick={() => onChangeColor(swatch.value)}
                    style={{ backgroundColor: swatch.value }}
                    className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full border transition-transform ${
                      isSelected
                        ? 'border-[#2b2924] dark:border-white scale-115 ring-2 ring-blue-500/60'
                        : 'border-[#8f897d] dark:border-neutral-600 hover:scale-110'
                    }`}
                    title={swatch.label}
                  />
                );
              })}
            </div>

            {showThicknessSlider && (
              <>
                <div className="w-px h-4 bg-[#c3beb1] dark:bg-neutral-800" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#5c584e] dark:text-neutral-400 font-mono w-7 text-right">
                    {strokeThickness}px
                  </span>
                  <input
                    type="range"
                    min={2}
                    max={28}
                    value={strokeThickness}
                    onChange={(e) => onChangeThickness(parseInt(e.target.value, 10))}
                    className="w-20 sm:w-16 accent-blue-600 dark:accent-blue-500 cursor-pointer"
                    title={t('drawingBar.strokeThickness')}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
