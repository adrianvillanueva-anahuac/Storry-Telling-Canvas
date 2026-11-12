import React, { useEffect, useRef, useState } from 'react';
import { CommentPin, DrawingElement, WorkflowNode } from '../../types/workflow';
import { getFigureBBox } from './PinningModal';
import {
  Circle,
  Eraser,
  Hand,
  Maximize2,
  Minimize2,
  MousePointer,
  PenTool,
  Shapes,
  Square,
  User,
  Volume2,
  X,
  ArrowRight,
  Map as MapIcon,
} from 'lucide-react';

interface MapViewerModalProps {
  node: WorkflowNode;
  currentUserName: string;
  isReadOnly: boolean;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onRequestReplaceMap: () => void;
}

const LAYER_COLORS = {
  enfoque: '#2563eb',
  accion: '#f97316',
  descripcion: '#10b981',
};

export const MapViewerModal: React.FC<MapViewerModalProps> = ({
  node,
  currentUserName,
  isReadOnly,
  onClose,
  onUpdateNode,
  onRequestReplaceMap,
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

  // Local state for smooth, unthrottled real-time rendering
  const [pins, setPins] = useState<CommentPin[]>(node.mapPins || []);
  const [drawings, setDrawings] = useState<DrawingElement[]>(node.mapDrawings || []);

  // Image dimensions state to eliminate viewBox coordinate shifts
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({
    width: node.mapImageWidth || 0,
    height: node.mapImageHeight || 0,
  });

  const initialTransformRef = useRef<{
    x: number;
    y: number;
    rotate: number;
    scale: number;
    cx: number;
    cy: number;
  } | null>(null);
  const initialDistRef = useRef<number>(1);
  const initialAngleRef = useRef<number>(0);
  const suppressPinClickRef = useRef<boolean>(false);

  // Preload image dimensions immediately so viewBox is stable from frame 0
  useEffect(() => {
    if (node.mapImage) {
      const img = new Image();
      img.src = node.mapImage;
      const onDims = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
          if (node.mapImageWidth !== img.naturalWidth || node.mapImageHeight !== img.naturalHeight) {
            onUpdateNode(node.id, {
              mapImageWidth: img.naturalWidth,
              mapImageHeight: img.naturalHeight,
            });
          }
        }
      };
      if (img.complete && img.naturalWidth) {
        onDims();
      } else {
        img.onload = onDims;
      }
    }
  }, [node.mapImage, node.id]);

  useEffect(() => {
    if (node.mapPins && !draggingPinId) {
      setPins(node.mapPins);
    }
  }, [node.mapPins, draggingPinId]);

  useEffect(() => {
    if (node.mapDrawings && !manipAction && !isDrawingPath) {
      setDrawings(node.mapDrawings);
    }
  }, [node.mapDrawings, manipAction, isDrawingPath]);

  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const fullSizeMapImageRef = useRef<HTMLImageElement>(null);

  const getSVGPoint = (clientX: number, clientY: number) => {
    if (!svgOverlayRef.current) return { x: 0, y: 0 };
    const pt = svgOverlayRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgOverlayRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      setImageDims({ width: naturalWidth, height: naturalHeight });
      if (node.mapImageWidth !== naturalWidth || node.mapImageHeight !== naturalHeight) {
        onUpdateNode(node.id, {
          mapImageWidth: naturalWidth,
          mapImageHeight: naturalHeight,
        });
      }
    }
  };

  const vbWidth = imageDims.width || fullSizeMapImageRef.current?.naturalWidth || 800;
  const vbHeight = imageDims.height || fullSizeMapImageRef.current?.naturalHeight || 600;

  // Helper to detect and scale legacy drawings made when viewBox was 800x600
  const getScalePrefix = (draw: DrawingElement) => {
    let baseW = draw.baseWidth;
    let baseH = draw.baseHeight;

    if (!baseW || !baseH) {
      const bbox = getFigureBBox(draw);
      const maxX = Math.max(bbox.x + bbox.width, (draw.transform?.x || 0) + bbox.cx);
      const maxY = Math.max(bbox.y + bbox.height, (draw.transform?.y || 0) + bbox.cy);

      if (vbWidth > 950 && maxX <= 850 && maxY <= 650) {
        baseW = 800;
        baseH = 600;
      } else {
        baseW = vbWidth;
        baseH = vbHeight;
      }
    }

    const sx = baseW > 0 ? vbWidth / baseW : 1;
    const sy = baseH > 0 ? vbHeight / baseH : 1;

    if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
      return `scale(${sx}, ${sy}) `;
    }
    return '';
  };

  // Image wrapper click: create pin if tool is none and not dragging
  const handleImageClick = (e: React.MouseEvent) => {
    if (activeTool !== 'none' || isReadOnly) return;

    if (suppressPinClickRef.current || manipAction || draggingPinId) {
      suppressPinClickRef.current = false;
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('.comment-pin, #manipulatorGroup, #mapManipulatorGroup, [data-drawing], .manipulator-handle')) {
      return;
    }

    // Deselect figure when clicking canvas
    if (activeFigureId) {
      setActiveFigureId(null);
      return;
    }

    if (!imageWrapperRef.current) return;
    const rect = imageWrapperRef.current.getBoundingClientRect();
    const pctX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setPopupPos({ x: e.clientX, y: e.clientY, pctX, pctY });
    setPopupText('');
  };

  const handleSavePin = () => {
    if (!popupPos || !popupText.trim()) return;

    const nextCounter = (node.mapPinCounter || 0) + 1;
    const newPin: CommentPin = {
      id: `map-pin-${node.id}-${nextCounter}`,
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

    const nextPins = [...pins, newPin];
    setPins(nextPins);
    onUpdateNode(node.id, {
      mapPins: nextPins,
      mapPinCounter: nextCounter,
    });

    setPopupPos(null);
    setPopupText('');
  };

  // Spawn Figure Stamp matching active layer color
  const spawnFigure = (shape: string) => {
    const cx = vbWidth / 2;
    const cy = vbHeight / 2;
    const color = LAYER_COLORS[activeLayer];
    const drawId = `map-fig-${Date.now()}`;

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
      baseWidth: vbWidth,
      baseHeight: vbHeight,
      transform: { x: cx, y: cy, scale: 1, rotate: 0, cx: 0, cy: 0 },
    };

    const next = [...drawings, newFig];
    setDrawings(next);
    onUpdateNode(node.id, { mapDrawings: next });
    setActiveFigureId(drawId);
  };

  const deleteDrawing = (id: string) => {
    const next = drawings.filter((d) => d.id !== id);
    setDrawings(next);
    onUpdateNode(node.id, { mapDrawings: next });
    if (activeFigureId === id) setActiveFigureId(null);
  };

  const startAction = (
    action: 'move' | 'rotate' | 'scale',
    clientX: number,
    clientY: number,
    fig: DrawingElement
  ) => {
    suppressPinClickRef.current = true;
    const pt = getSVGPoint(clientX, clientY);
    const bbox = getFigureBBox(fig);
    const originX = fig.type === 'figure' ? 0 : bbox.cx;
    const originY = fig.type === 'figure' ? 0 : bbox.cy;
    const currentTx = fig.transform?.x ?? 0;
    const currentTy = fig.transform?.y ?? 0;
    const currentRot = fig.transform?.rotate ?? 0;
    const currentScale = fig.transform?.scale ?? 1;

    const objCenterX = currentTx + originX;
    const objCenterY = currentTy + originY;
    const dx = pt.x - objCenterX;
    const dy = pt.y - objCenterY;

    setManipAction(action);
    setStartManipCoords(pt);
    initialTransformRef.current = {
      x: currentTx,
      y: currentTy,
      rotate: currentRot,
      scale: currentScale,
      cx: originX,
      cy: originY,
    };
    initialDistRef.current = Math.max(10, Math.sqrt(dx * dx + dy * dy));
    initialAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
  };

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
      return;
    }

    if (manipAction && activeFigureId && startManipCoords && initialTransformRef.current) {
      suppressPinClickRef.current = true;
      const activeFig = drawings.find((d) => d.id === activeFigureId);
      if (!activeFig) return;

      const pt = getSVGPoint(e.clientX, e.clientY);
      const init = initialTransformRef.current;
      const bbox = getFigureBBox(activeFig);
      const originX = activeFig.type === 'figure' ? 0 : bbox.cx;
      const originY = activeFig.type === 'figure' ? 0 : bbox.cy;
      const objCenterX = init.x + originX;
      const objCenterY = init.y + originY;
      const dx = pt.x - objCenterX;
      const dy = pt.y - objCenterY;

      if (manipAction === 'move') {
        const deltaX = pt.x - startManipCoords.x;
        const deltaY = pt.y - startManipCoords.y;
        const nextX = init.x + deltaX;
        const nextY = init.y + deltaY;
        setDrawings((prev) =>
          prev.map((d) =>
            d.id === activeFigureId
              ? {
                  ...d,
                  baseWidth: vbWidth,
                  baseHeight: vbHeight,
                  transform: {
                    ...d.transform,
                    x: nextX,
                    y: nextY,
                    cx: originX,
                    cy: originY,
                  },
                }
              : d
          )
        );
      } else if (manipAction === 'rotate') {
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const angleDelta = currentAngle - initialAngleRef.current;
        let nextRotate = (init.rotate + angleDelta) % 360;
        if (isNaN(nextRotate)) nextRotate = 0;
        setDrawings((prev) =>
          prev.map((d) =>
            d.id === activeFigureId
              ? {
                  ...d,
                  baseWidth: vbWidth,
                  baseHeight: vbHeight,
                  transform: {
                    ...d.transform,
                    rotate: nextRotate,
                    cx: originX,
                    cy: originY,
                  },
                }
              : d
          )
        );
      } else if (manipAction === 'scale') {
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        const scaleRatio = currentDist / Math.max(10, initialDistRef.current);
        let nextScale = Math.max(0.1, Math.min(10, init.scale * scaleRatio));
        if (isNaN(nextScale)) nextScale = 1;
        setDrawings((prev) =>
          prev.map((d) =>
            d.id === activeFigureId
              ? {
                  ...d,
                  baseWidth: vbWidth,
                  baseHeight: vbHeight,
                  transform: {
                    ...d.transform,
                    scale: nextScale,
                    cx: originX,
                    cy: originY,
                  },
                }
              : d
          )
        );
      }
      return;
    }

    if (draggingPinId && imageWrapperRef.current) {
      suppressPinClickRef.current = true;
      const rect = imageWrapperRef.current.getBoundingClientRect();
      const pctX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const pctY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      setPins((prev) => prev.map((p) => (p.id === draggingPinId ? { ...p, x: pctX, y: pctY } : p)));
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
        id: `map-draw-${Date.now()}`,
        layer: activeLayer,
        type: 'path',
        d,
        stroke: LAYER_COLORS[activeLayer],
        width: String(pencilThickness),
        baseWidth: vbWidth,
        baseHeight: vbHeight,
        transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
      };

      const next = [...drawings, newPath];
      setDrawings(next);
      onUpdateNode(node.id, { mapDrawings: next });
      setCurrentPathPoints([]);
      suppressPinClickRef.current = true;
      setTimeout(() => {
        suppressPinClickRef.current = false;
      }, 300);
      return;
    }

    if (manipAction) {
      setManipAction(null);
      setStartManipCoords(null);
      initialTransformRef.current = null;
      suppressPinClickRef.current = true;
      onUpdateNode(node.id, { mapDrawings: drawings });
      setTimeout(() => {
        suppressPinClickRef.current = false;
      }, 300);
    }

    if (draggingPinId) {
      setDraggingPinId(null);
      suppressPinClickRef.current = true;
      onUpdateNode(node.id, { mapPins: pins });
      setTimeout(() => {
        suppressPinClickRef.current = false;
      }, 300);
    }
  };

  const activeFigure = drawings.find((d) => d.id === activeFigureId);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center select-none"
      onMouseMove={handleMouseMoveSVG}
      onMouseUp={handleMouseUpSVG}
    >
      {/* Top Left Controls: Layers, Title, Replace Map */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-neutral-700/80 shadow-2xl">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mr-1">
          <MapIcon className="w-4 h-4" />
          <span>{node.mapName || 'Map Viewer'}</span>
        </div>

        <div className="w-px h-5 bg-neutral-700 mx-1" />

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
          onClick={onRequestReplaceMap}
          className="px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-white bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 rounded-lg transition-colors"
        >
          🔄 Replace Map
        </button>
      </div>

      {/* Top Right Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full bg-neutral-900/90 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 flex items-center justify-center shadow-xl transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Map Image & SVG Layer */}
      <div
        ref={imageWrapperRef}
        onClick={handleImageClick}
        className="relative max-w-[88vw] max-h-[85vh] inline-block shadow-2xl rounded-xl overflow-hidden"
      >
        <img
          ref={fullSizeMapImageRef}
          src={node.mapImage || ''}
          alt={node.mapName}
          onLoad={handleImageLoad}
          className="block max-w-[88vw] max-h-[85vh] object-contain select-none pointer-events-none"
        />

        <svg
          ref={svgOverlayRef}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          onMouseDown={handleMouseDownSVG}
          className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible"
        >
          <rect
            id="mapDrawingCatch"
            x="-2000"
            y="-2000"
            width="5000"
            height="5000"
            fill="transparent"
            className={activeTool !== 'none' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}
          />

          {drawings.map((draw) => {
            // Drawings from legacy 'map' layer or matching current activeLayer
            const isVisible = draw.layer === activeLayer || draw.layer === 'map';
            if (!isVisible) return null;

            const bbox = getFigureBBox(draw);
            const originX = draw.type === 'figure' ? 0 : bbox.cx;
            const originY = draw.type === 'figure' ? 0 : bbox.cy;
            const tx = draw.transform?.x ?? 0;
            const ty = draw.transform?.y ?? 0;
            const rot = draw.transform?.rotate ?? 0;
            const scl = draw.transform?.scale ?? 1;

            const scalePrefix = getScalePrefix(draw);

            const transformStr =
              draw.type === 'figure'
                ? `${scalePrefix}translate(${tx}, ${ty}) rotate(${rot}) scale(${scl})`
                : `${scalePrefix}translate(${tx}, ${ty}) translate(${originX}, ${originY}) rotate(${rot}) scale(${scl}) translate(${-originX}, ${-originY})`;

            return (
              <g
                key={draw.id}
                id={draw.id}
                data-drawing="true"
                transform={transformStr}
                className="cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  suppressPinClickRef.current = true;
                  if (activeTool === 'eraser') {
                    deleteDrawing(draw.id);
                  } else if (activeTool === 'none') {
                    setActiveFigureId(draw.id);
                    startAction('move', e.clientX, e.clientY, draw);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  suppressPinClickRef.current = true;
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
                {/* Visible styled path */}
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

          {activeFigure && (() => {
            const bbox = getFigureBBox(activeFigure);
            const originX = activeFigure.type === 'figure' ? 0 : bbox.cx;
            const originY = activeFigure.type === 'figure' ? 0 : bbox.cy;
            const tx = activeFigure.transform?.x ?? 0;
            const ty = activeFigure.transform?.y ?? 0;
            const rot = activeFigure.transform?.rotate ?? 0;
            const scl = activeFigure.transform?.scale ?? 1;

            const scalePrefix = getScalePrefix(activeFigure);

            const transformStr =
              activeFigure.type === 'figure'
                ? `${scalePrefix}translate(${tx}, ${ty}) rotate(${rot}) scale(${scl})`
                : `${scalePrefix}translate(${tx}, ${ty}) translate(${originX}, ${originY}) rotate(${rot}) scale(${scl}) translate(${-originX}, ${-originY})`;

            return (
              <g
                id="manipulatorGroup"
                data-drawing="true"
                transform={transformStr}
                onClick={(e) => {
                  e.stopPropagation();
                  suppressPinClickRef.current = true;
                }}
              >
                <rect
                  x={bbox.x}
                  y={bbox.y}
                  width={bbox.width}
                  height={bbox.height}
                  className="figure-manipulator"
                  style={{ stroke: '#9f2727', borderColor: '#9f2727' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAction('move', e.clientX, e.clientY, activeFigure);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    suppressPinClickRef.current = true;
                  }}
                />
                <line
                  x1={bbox.cx}
                  y1={bbox.y}
                  x2={bbox.cx}
                  y2={bbox.y - 30}
                  className="figure-manipulator"
                  style={{ stroke: '#9f2727' }}
                />
                <circle
                  cx={bbox.cx}
                  cy={bbox.y - 30}
                  r="8"
                  className="manipulator-handle cursor-crosshair"
                  style={{ stroke: '#9f2727', borderColor: '#9f2727' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAction('rotate', e.clientX, e.clientY, activeFigure);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    suppressPinClickRef.current = true;
                  }}
                />
                <rect
                  x={bbox.x + bbox.width - 7}
                  y={bbox.y + bbox.height - 7}
                  width="14"
                  height="14"
                  className="manipulator-handle cursor-nwse-resize"
                  style={{ stroke: '#9f2727', borderColor: '#9f2727' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startAction('scale', e.clientX, e.clientY, activeFigure);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    suppressPinClickRef.current = true;
                  }}
                />
              </g>
            );
          })()}
        </svg>

        {/* Render Comment Pins on Map */}
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
          title="Map Annotation & Drawing Tools"
        >
          〰️✏️
        </button>

        {toolsOpen && (
          <div className="bg-neutral-900/95 backdrop-blur-md p-3 rounded-2xl border border-neutral-700/80 shadow-2xl flex flex-col gap-3 items-center animate-in fade-in zoom-in-95 duration-150">
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
              placeholder="Write your map annotation comment or task..."
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
