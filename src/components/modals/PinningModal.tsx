import React, { useRef, useState } from 'react';
import { CommentPin, DrawingElement, WorkflowNode } from '../../types/workflow';
import {
  Circle,
  Eraser,
  Maximize2,
  Minimize2,
  MousePointer,
  Move,
  PenTool,
  RotateCw,
  Shapes,
  Square,
  Volume2,
  X,
  ArrowRight,
  User,
  Hand,
} from 'lucide-react';

interface PinningModalProps {
  node: WorkflowNode;
  currentUserName: string;
  isReadOnly: boolean;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onRequestReplaceImage: () => void;
}

const LAYER_COLORS = {
  enfoque: '#2563eb',
  accion: '#f97316',
  descripcion: '#10b981',
};

export const PinningModal: React.FC<PinningModalProps> = ({
  node,
  currentUserName,
  isReadOnly,
  onClose,
  onUpdateNode,
  onRequestReplaceImage,
}) => {
  const [activeLayer, setActiveLayer] = useState<'enfoque' | 'accion' | 'descripcion'>('enfoque');
  const [activeTool, setActiveTool] = useState<'none' | 'pencil' | 'eraser' | 'figure'>('none');
  const [pencilThickness, setPencilThickness] = useState(5);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [figureMenuOpen, setFigureMenuOpen] = useState(false);

  // Pin creation popup state
  const [popupPos, setPopupPos] = useState<{ x: number; y: number; pctX: number; pctY: number } | null>(null);
  const [popupText, setPopupText] = useState('');

  // Tooltip state for pins
  const [hoveredPin, setHoveredPin] = useState<{ text: string; x: number; y: number } | null>(null);

  // Pencil path drawing state
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [currentPathPoints, setCurrentPathPoints] = useState<{ x: number; y: number }[]>([]);

  // Figure manipulation state
  const [activeFigureId, setActiveFigureId] = useState<string | null>(null);
  const [manipAction, setManipAction] = useState<'move' | 'rotate' | 'scale' | null>(null);
  const [startManipCoords, setStartManipCoords] = useState<{ x: number; y: number } | null>(null);

  // Pin dragging state
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);

  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const fullSizeImageRef = useRef<HTMLImageElement>(null);

  const pins = node.pins || [];
  const drawings = node.drawings || [];

  const getSVGPoint = (clientX: number, clientY: number) => {
    if (!svgOverlayRef.current) return { x: 0, y: 0 };
    const pt = svgOverlayRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgOverlayRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  };

  // Image wrapper click: create pin if tool is none
  const handleImageClick = (e: React.MouseEvent) => {
    if (activeTool !== 'none' || isReadOnly) return;
    if ((e.target as HTMLElement).closest('.comment-pin')) return;
    if ((e.target as HTMLElement).closest('#manipulatorGroup')) return;

    if (!imageWrapperRef.current) return;
    const rect = imageWrapperRef.current.getBoundingClientRect();
    const pctX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setPopupPos({ x: e.clientX, y: e.clientY, pctX, pctY });
    setPopupText('');
  };

  const handleSavePin = () => {
    if (!popupPos || !popupText.trim()) return;

    const nextCounter = (node.pinCounter || 0) + 1;
    const newPin: CommentPin = {
      id: `pin-${node.id}-${nextCounter}`,
      num: nextCounter,
      type: activeLayer,
      text: popupText.trim(),
      author: currentUserName,
      x: popupPos.pctX,
      y: popupPos.pctY,
      replies: [],
      review: false,
      done: false,
      edited: false,
    };

    onUpdateNode(node.id, {
      pins: [...pins, newPin],
      pinCounter: nextCounter,
    });

    setPopupPos(null);
    setPopupText('');
  };

  // Spawn Figure Stamp
  const spawnFigure = (shape: string) => {
    const cx = (fullSizeImageRef.current?.naturalWidth || 800) / 2;
    const cy = (fullSizeImageRef.current?.naturalHeight || 600) / 2;
    const color = LAYER_COLORS[activeLayer];
    const drawId = `fig-${Date.now()}`;

    let pathD = '';
    if (shape === 'square') {
      pathD = 'M -50 -50 L 50 -50 L 50 50 L -50 50 Z';
    } else if (shape === 'circle') {
      pathD = 'M 0 -50 C 27 -50, 50 -27, 50 0 C 50 27, 27 50, 0 50 C -27 50, -50 27, -50 0 C -50 -27, -27 -50, 0 -50 Z';
    } else if (shape === 'arrow') {
      pathD = 'M -30 -15 L 10 -15 L 10 -30 L 40 0 L 10 30 L 10 15 L -30 15 Z';
    } else if (shape === 'line-arrow') {
      pathD = 'M -40 0 L 30 0 M 15 -15 L 40 0 L 15 15';
    } else if (shape === 'speaker') {
      pathD = 'M 0 -10 L 0 10 L 15 20 L 15 -20 Z M -10 -10 L 0 -10 L 0 10 L -10 10 Z M 22 -10 Q 30 0 22 10 M 28 -20 Q 45 0 28 20';
    } else if (shape === 'zoom-in') {
      pathD = 'M -20 -20 L -30 -30 M -30 -30 L -15 -30 M -30 -30 L -30 -15 M 20 -20 L 30 -30 M 30 -30 L 15 -30 M 30 -30 L 30 -15 M -20 20 L -30 30 M -30 30 L -15 30 M -30 30 L -30 15 M 20 20 L 30 30 M 30 30 L 15 30 M 30 30 L 30 15';
    } else if (shape === 'zoom-out') {
      pathD = 'M -30 -30 L -20 -20 M -20 -20 L -35 -20 M -20 -20 L -20 -35 M 30 -30 L 20 -20 M 20 -20 L 35 -20 M 20 -20 L 20 -35 M -30 30 L -20 20 M -20 20 L -35 20 M -20 20 L -20 35 M 30 30 L 20 20 M 20 20 L 35 20 M 20 20 L 20 35';
    } else if (shape === 'hand-cube') {
      pathD = 'M -15 0 L 0 -10 L 15 0 L 0 10 Z M -15 0 L -15 15 L 0 25 L 0 10 M 15 0 L 15 15 L 0 25 M 5 20 L 5 8 A 4 4 0 0 1 13 8 L 13 25 M 13 15 A 4 4 0 0 1 20 15 L 20 28 M 20 18 A 4 4 0 0 1 27 18 L 27 30 M 27 22 A 4 4 0 0 1 34 22 L 34 35 A 15 15 0 0 1 5 35 Z';
    } else if (shape === 'human-circle') {
      pathD = 'M -25 35 A 25 8 0 1 0 25 35 A 25 8 0 1 0 -25 35 M 0 -25 A 7 7 0 1 0 0 -39 A 7 7 0 1 0 0 -25 M 0 -25 L 0 10 M -15 -10 L 15 -10 M 0 10 L -10 32 M 0 10 L 10 32';
    }

    const newFig: DrawingElement = {
      id: drawId,
      layer: activeLayer,
      type: 'figure',
      shape,
      d: pathD,
      stroke: color,
      transform: { x: cx, y: cy, scale: 1, rotate: 0, cx: 0, cy: 0 },
    };

    onUpdateNode(node.id, { drawings: [...drawings, newFig] });
    setActiveFigureId(drawId);
  };

  const deleteDrawing = (id: string) => {
    const next = drawings.filter((d) => d.id !== id);
    onUpdateNode(node.id, { drawings: next });
    if (activeFigureId === id) setActiveFigureId(null);
  };

  // Pencil path mouse events
  const handleMouseDownSVG = (e: React.MouseEvent) => {
    if (activeTool === 'eraser') return;

    if (activeTool === 'pencil') {
      setIsDrawingPath(true);
      const pt = getSVGPoint(e.clientX, e.clientY);
      setCurrentPathPoints([pt]);
      setActiveFigureId(null);
      return;
    }
  };

  const handleMouseMoveSVG = (e: React.MouseEvent) => {
    if (isDrawingPath && activeTool === 'pencil') {
      const pt = getSVGPoint(e.clientX, e.clientY);
      setCurrentPathPoints((prev) => [...prev, pt]);
    }

    if (manipAction && activeFigureId && startManipCoords) {
      const activeFig = drawings.find((d) => d.id === activeFigureId);
      if (!activeFig) return;

      const pt = getSVGPoint(e.clientX, e.clientY);
      const objCenterX = activeFig.transform.x + (activeFig.transform.cx || 0);
      const objCenterY = activeFig.transform.y + (activeFig.transform.cy || 0);
      const dx = pt.x - objCenterX;
      const dy = pt.y - objCenterY;

      if (manipAction === 'move') {
        const deltaX = pt.x - startManipCoords.x;
        const deltaY = pt.y - startManipCoords.y;
        const updated = drawings.map((d) =>
          d.id === activeFigureId
            ? {
                ...d,
                transform: {
                  ...d.transform,
                  x: d.transform.x + deltaX,
                  y: d.transform.y + deltaY,
                },
              }
            : d
        );
        onUpdateNode(node.id, { drawings: updated });
        setStartManipCoords(pt);
      } else if (manipAction === 'rotate') {
        const deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        const updated = drawings.map((d) =>
          d.id === activeFigureId ? { ...d, transform: { ...d.transform, rotate: deg } } : d
        );
        onUpdateNode(node.id, { drawings: updated });
      } else if (manipAction === 'scale') {
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        const scaleVal = Math.max(0.1, currentDist / 60);
        const updated = drawings.map((d) =>
          d.id === activeFigureId ? { ...d, transform: { ...d.transform, scale: scaleVal } } : d
        );
        onUpdateNode(node.id, { drawings: updated });
      }
    }

    if (draggingPinId && imageWrapperRef.current) {
      const rect = imageWrapperRef.current.getBoundingClientRect();
      const pctX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const pctY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      const updated = pins.map((p) => (p.id === draggingPinId ? { ...p, x: pctX, y: pctY } : p));
      onUpdateNode(node.id, { pins: updated });
    }
  };

  const handleMouseUpSVG = () => {
    if (isDrawingPath && currentPathPoints.length > 0) {
      setIsDrawingPath(false);
      let d = '';
      if (currentPathPoints.length > 2) {
        d = `M ${currentPathPoints[0].x} ${currentPathPoints[0].y}`;
        for (let i = 1; i < currentPathPoints.length - 2; i++) {
          const xc = (currentPathPoints[i].x + currentPathPoints[i + 1].x) / 2;
          const yc = (currentPathPoints[i].y + currentPathPoints[i + 1].y) / 2;
          d += ` Q ${currentPathPoints[i].x} ${currentPathPoints[i].y}, ${xc} ${yc}`;
        }
        d += ` Q ${currentPathPoints[currentPathPoints.length - 2].x} ${currentPathPoints[currentPathPoints.length - 2].y}, ${
          currentPathPoints[currentPathPoints.length - 1].x
        } ${currentPathPoints[currentPathPoints.length - 1].y}`;
      } else {
        d = `M ${currentPathPoints[0].x} ${currentPathPoints[0].y} L ${currentPathPoints[0].x + 1} ${
          currentPathPoints[0].y + 1
        }`;
      }

      const newPath: DrawingElement = {
        id: `draw-${Date.now()}`,
        layer: activeLayer,
        type: 'path',
        d,
        stroke: LAYER_COLORS[activeLayer],
        width: String(pencilThickness),
        transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
      };

      onUpdateNode(node.id, { drawings: [...drawings, newPath] });
      setCurrentPathPoints([]);
    }

    if (manipAction) setManipAction(null);
    if (draggingPinId) setDraggingPinId(null);
  };

  const activeFigure = drawings.find((d) => d.id === activeFigureId);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center select-none"
      onMouseMove={handleMouseMoveSVG}
      onMouseUp={handleMouseUpSVG}
    >
      {/* Top Left Controls: Layer Buttons & Replace Image */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-neutral-700/80 shadow-2xl">
        {(['enfoque', 'accion', 'descripcion'] as const).map((layer) => {
          const count = pins.filter((p) => p.type === layer).length;
          const isActive = activeLayer === layer;
          const color = LAYER_COLORS[layer];

          return (
            <button
              key={layer}
              onClick={() => {
                setActiveLayer(layer);
                setActiveFigureId(null);
              }}
              style={{
                backgroundColor: isActive ? color : 'transparent',
                borderColor: isActive ? 'white' : color,
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
                isActive ? 'text-white shadow-lg scale-105' : 'text-neutral-300 hover:text-white'
              }`}
            >
              {layer} ({count})
            </button>
          );
        })}

        <div className="w-px h-5 bg-neutral-700 mx-1" />

        <button
          onClick={onRequestReplaceImage}
          className="px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-white bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 rounded-lg transition-colors"
        >
          🔄 Replace Image
        </button>
      </div>

      {/* Top Right Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full bg-neutral-900/90 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 flex items-center justify-center shadow-xl transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Image & SVG Wrapper */}
      <div
        ref={imageWrapperRef}
        onClick={handleImageClick}
        className="relative max-w-[88vw] max-h-[85vh] inline-block shadow-2xl rounded-xl overflow-hidden"
      >
        <img
          ref={fullSizeImageRef}
          src={node.image || ''}
          alt={node.title}
          className="block max-w-[88vw] max-h-[85vh] object-contain select-none pointer-events-none"
        />

        {/* SVG Drawing & Manipulation Layer */}
        <svg
          ref={svgOverlayRef}
          viewBox={`0 0 ${fullSizeImageRef.current?.naturalWidth || 800} ${
            fullSizeImageRef.current?.naturalHeight || 600
          }`}
          onMouseDown={handleMouseDownSVG}
          className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible"
        >
          {/* Catch area for pencil and eraser */}
          <rect
            id="drawingCatch"
            x="-2000"
            y="-2000"
            width="5000"
            height="5000"
            fill="transparent"
            className={activeTool !== 'none' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}
          />

          {/* Render Vector Drawings & Paths */}
          {drawings.map((draw) => {
            const isFigureActive = draw.id === activeFigureId;
            const isVisible = draw.layer === activeLayer;
            if (!isVisible) return null;

            const tx = draw.transform.x || 0;
            const ty = draw.transform.y || 0;
            const rot = draw.transform.rotate || 0;
            const scl = draw.transform.scale || 1;
            const cx = draw.transform.cx || 0;
            const cy = draw.transform.cy || 0;

            const transformStr = `translate(${tx}, ${ty}) translate(${cx}, ${cy}) rotate(${rot}) scale(${scl}) translate(${-cx}, ${-cy})`;

            return (
              <g
                key={draw.id}
                id={draw.id}
                transform={transformStr}
                className="cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    deleteDrawing(draw.id);
                  } else if (activeTool === 'none') {
                    setActiveFigureId(draw.id);
                    setManipAction('move');
                    setStartManipCoords(getSVGPoint(e.clientX, e.clientY));
                  }
                }}
              >
                {/* Thick hit path for eraser and click detection */}
                <path
                  d={draw.d}
                  stroke="transparent"
                  strokeWidth="24"
                  fill="none"
                  className="pointer-events-auto"
                />

                <path
                  d={draw.d}
                  stroke={draw.stroke}
                  strokeWidth={draw.type === 'path' ? draw.width || '4' : '4'}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* Render in-progress pencil path */}
          {isDrawingPath && currentPathPoints.length > 0 && (
            <path
              d={currentPathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
              stroke={LAYER_COLORS[activeLayer]}
              strokeWidth={pencilThickness}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Manipulator Group for selected figure */}
          {activeFigure && (
            <g
              id="manipulatorGroup"
              transform={`translate(${activeFigure.transform.x}, ${activeFigure.transform.y}) rotate(${activeFigure.transform.rotate}) scale(${activeFigure.transform.scale})`}
            >
              {/* Box */}
              <rect
                x="-60"
                y="-60"
                width="120"
                height="120"
                className="figure-manipulator"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setManipAction('move');
                  setStartManipCoords(getSVGPoint(e.clientX, e.clientY));
                }}
              />
              {/* Rotate arm and handle */}
              <line x1="0" y1="-60" x2="0" y2="-90" className="figure-manipulator" />
              <circle
                cx="0"
                cy="-90"
                r="8"
                className="manipulator-handle cursor-crosshair"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setManipAction('rotate');
                  setStartManipCoords(getSVGPoint(e.clientX, e.clientY));
                }}
              />
              {/* Scale corner */}
              <rect
                x="50"
                y="50"
                width="16"
                height="16"
                className="manipulator-handle cursor-nwse-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setManipAction('scale');
                  setStartManipCoords(getSVGPoint(e.clientX, e.clientY));
                }}
              />
            </g>
          )}
        </svg>

        {/* Render Comment Pins */}
        {pins.map((pin) => {
          const isVisible = pin.type === activeLayer;
          if (!isVisible) return null;

          return (
            <div
              key={pin.id}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHoveredPin({ text: pin.text, x: rect.left + rect.width / 2, y: rect.top - 8 });
              }}
              onMouseLeave={() => setHoveredPin(null)}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (activeTool === 'none') {
                  setDraggingPinId(pin.id);
                  setHoveredPin(null);
                }
              }}
              className={`comment-pin pin-${pin.type} absolute w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-xl cursor-grab active:cursor-grabbing z-20 -translate-x-1/2 -translate-y-full hover:scale-125 transition-transform`}
            >
              <span>{pin.num}</span>
            </div>
          );
        })}
      </div>

      {/* Floating Drawing Tools Menu */}
      <div className="absolute right-4 top-20 z-50 flex flex-col items-end gap-2">
        <button
          onClick={() => {
            setToolsOpen(!toolsOpen);
            if (toolsOpen) {
              setActiveTool('none');
              setFigureMenuOpen(false);
            }
          }}
          className={`w-11 h-11 rounded-full border shadow-2xl flex items-center justify-center text-lg transition-all ${
            toolsOpen
              ? 'bg-white text-neutral-900 border-white scale-105'
              : 'bg-neutral-900/90 text-white border-neutral-700 hover:bg-neutral-800'
          }`}
          title="Drawing Tools"
        >
          〰️✏️
        </button>

        {toolsOpen && (
          <div className="bg-neutral-900/95 backdrop-blur-md p-3 rounded-2xl border border-neutral-700/80 shadow-2xl flex flex-col gap-3 items-center animate-in fade-in zoom-in-95 duration-150">
            {/* Tool Selection Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
              <button
                onClick={() => {
                  setActiveTool('none');
                  setFigureMenuOpen(false);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  activeTool === 'none' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="Select & Move / Pinning Mode"
              >
                <MousePointer className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveTool('pencil');
                  setFigureMenuOpen(false);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  activeTool === 'pencil' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="Pencil Drawing"
              >
                <PenTool className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveTool('eraser');
                  setFigureMenuOpen(false);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  activeTool === 'eraser' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="Eraser (click path/figure)"
              >
                <Eraser className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveTool('figure');
                  setFigureMenuOpen(!figureMenuOpen);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  activeTool === 'figure' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="Vector Shapes Stamp"
              >
                <Shapes className="w-4 h-4" />
              </button>
            </div>

            {/* Pencil Thickness Slider */}
            {activeTool === 'pencil' && (
              <div className="w-full flex items-center gap-2 px-1">
                <span className="text-[10px] text-neutral-400 font-mono">{pencilThickness}px</span>
                <input
                  type="range"
                  min={2}
                  max={35}
                  value={pencilThickness}
                  onChange={(e) => setPencilThickness(parseInt(e.target.value, 10))}
                  className="w-24 accent-blue-500"
                />
              </div>
            )}

            {/* Figures Stamp Submenu */}
            {figureMenuOpen && (
              <div className="grid grid-cols-3 gap-1.5 p-2 bg-neutral-950 rounded-xl border border-neutral-800 w-48 shadow-xl">
                <button
                  onClick={() => spawnFigure('square')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Square"
                >
                  <Square className="w-4 h-4" />
                </button>
                <button
                  onClick={() => spawnFigure('circle')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Circle"
                >
                  <Circle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => spawnFigure('arrow')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Thick Arrow"
                >
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
                <button
                  onClick={() => spawnFigure('line-arrow')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Line Arrow"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => spawnFigure('speaker')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Audio / Speaker"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => spawnFigure('zoom-in')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Zoom In"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => spawnFigure('zoom-out')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Zoom Out"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => spawnFigure('hand-cube')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Interactive Hand"
                >
                  <Hand className="w-4 h-4" />
                </button>
                <button
                  onClick={() => spawnFigure('human-circle')}
                  className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg flex items-center justify-center text-xs"
                  title="Actor / Human Point"
                >
                  <User className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pin Creation Popup Dialog */}
      {popupPos && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setPopupPos(null)} />
          <div
            style={{ left: popupPos.x, top: popupPos.y }}
            className="fixed z-50 w-72 bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl p-3.5 space-y-3 backdrop-blur-md -translate-x-1/2 -translate-y-full mb-3"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-semibold text-xs text-neutral-200">
                Create Pin on [{activeLayer.toUpperCase()}]
              </span>
              <span className="text-[10px] text-neutral-400">by {currentUserName}</span>
            </div>

            <textarea
              value={popupText}
              onChange={(e) => setPopupText(e.target.value)}
              placeholder="Write your scene comment or task..."
              rows={3}
              autoFocus
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2 text-xs text-neutral-200 outline-none focus:border-blue-500 resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-800">
              <button
                onClick={() => setPopupPos(null)}
                className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePin}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
              >
                Save Pin
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hover Tooltip for existing pins */}
      {hoveredPin && !popupPos && (
        <div
          style={{ left: hoveredPin.x, top: hoveredPin.y }}
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 px-3 py-1.5 rounded-lg bg-neutral-900/95 border border-neutral-700/80 text-white text-xs font-medium max-w-xs shadow-2xl backdrop-blur-sm"
        >
          {hoveredPin.text}
        </div>
      )}
    </div>
  );
};
