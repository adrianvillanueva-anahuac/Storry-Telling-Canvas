import React, { useEffect, useRef, useState } from 'react';
import { CommentPin, DrawingElement, WorkflowNode } from '../../types/workflow';
import { getFigureBBox } from './PinningModal';
import { X, Map as MapIcon } from 'lucide-react';
import { DrawingToolsBar } from './DrawingToolsBar';
import { useLanguage } from '../../hooks/useLanguage';
import {
  DrawingToolType,
  SvgPoint,
  buildArrowPath,
  buildEllipsePath,
  buildFreehandPath,
  buildLinePath,
  buildMeasureData,
  buildPreviewPathForTool,
  buildRectPath,
  getMeasurePointsFromDrawing,
} from '../../utils/drawingTools';

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
  const { t, tColumn } = useLanguage();
  const [activeLayer, setActiveLayer] = useState<'enfoque' | 'accion' | 'descripcion'>('enfoque');
  const [activeTool, setActiveTool] = useState<DrawingToolType>('none');
  const [pencilThickness, setPencilThickness] = useState(4);
  const [strokeColor, setStrokeColor] = useState<string>(LAYER_COLORS.enfoque);
  const [figureMenuOpen, setFigureMenuOpen] = useState(false);

  // Pin creation popup state
  const [popupPos, setPopupPos] = useState<{ x: number; y: number; pctX: number; pctY: number } | null>(null);
  const [popupText, setPopupText] = useState('');

  // Tooltip state for pins
  const [hoveredPin, setHoveredPin] = useState<{ text: string; x: number; y: number } | null>(null);

  // Drawing path / drag-shape state
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [currentPathPoints, setCurrentPathPoints] = useState<SvgPoint[]>([]);
  const [dragStartPoint, setDragStartPoint] = useState<SvgPoint | null>(null);
  const [dragCurrentPoint, setDragCurrentPoint] = useState<SvgPoint | null>(null);
  const [tempMeasureDrawing, setTempMeasureDrawing] = useState<DrawingElement | null>(null);

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
  const [mapLoadError, setMapLoadError] = useState(false);

  useEffect(() => {
    setMapLoadError(false);
  }, [node.mapImage]);

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
  const svgUnit = Math.max(1, Math.max(vbWidth, vbHeight) / 900);

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

    if (hoveredPin) {
      setHoveredPin(null);
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
      stroke: strokeColor || color,
      baseWidth: vbWidth,
      baseHeight: vbHeight,
      transform: { x: cx, y: cy, scale: 1, rotate: 0, cx: 0, cy: 0 },
    };

    const next = [...drawings, newFig];
    setDrawings(next);
    onUpdateNode(node.id, { mapDrawings: next });
    setActiveFigureId(drawId);
    setActiveTool('none');
    setFigureMenuOpen(false);
  };

  const deleteDrawing = (id: string) => {
    const next = drawings.filter((d) => d.id !== id);
    setDrawings(next);
    onUpdateNode(node.id, { mapDrawings: next });
    if (activeFigureId === id) setActiveFigureId(null);
  };

  const handleUndoLastDrawing = () => {
    if (isReadOnly) return;
    let lastIdx = -1;
    for (let i = drawings.length - 1; i >= 0; i--) {
      if (drawings[i].layer === activeLayer || drawings[i].layer === 'map') {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx === -1) return;
    const removed = drawings[lastIdx];
    const next = drawings.filter((_, idx) => idx !== lastIdx);
    setDrawings(next);
    onUpdateNode(node.id, { mapDrawings: next });
    if (activeFigureId === removed.id) setActiveFigureId(null);
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

  const isDragShapeTool = (t: DrawingToolType) =>
    t === 'line' || t === 'arrow' || t === 'rect' || t === 'ellipse' || t === 'measure';

  const handlePointerDownSVG = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (activeTool === 'eraser' || activeTool === 'none' || activeTool === 'figure') return;
    if (isReadOnly && activeTool !== 'measure') return;

    const pt = getSVGPoint(e.clientX, e.clientY);
    setActiveFigureId(null);
    setFigureMenuOpen(false);
    setTempMeasureDrawing(null);

    if (activeTool === 'pencil' || activeTool === 'highlighter') {
      setIsDrawingPath(true);
      setCurrentPathPoints([pt]);
      return;
    }

    if (isDragShapeTool(activeTool)) {
      setIsDrawingPath(true);
      setDragStartPoint(pt);
      setDragCurrentPoint(pt);
      return;
    }
  };

  const handlePointerMoveSVG = (e: React.PointerEvent) => {
    if (isDrawingPath && (activeTool === 'pencil' || activeTool === 'highlighter')) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      setCurrentPathPoints((prev) => [...prev, pt]);
      return;
    }

    if (isDrawingPath && isDragShapeTool(activeTool)) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      setDragCurrentPoint(pt);
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

  const handlePointerUpSVG = () => {
    if (isDrawingPath) {
      setIsDrawingPath(false);

      if ((activeTool === 'pencil' || activeTool === 'highlighter') && currentPathPoints.length > 0) {
        const d = buildFreehandPath(currentPathPoints);
        const isHighlighter = activeTool === 'highlighter';
        const effectiveWidth = isHighlighter
          ? Math.round(Math.max(14, pencilThickness * 2.8) * svgUnit)
          : Math.round(pencilThickness * svgUnit);

        const newPath: DrawingElement = {
          id: `map-draw-${Date.now()}`,
          layer: activeLayer,
          type: 'path',
          shape: isHighlighter ? 'highlighter' : 'freehand',
          d,
          stroke: strokeColor,
          width: String(effectiveWidth),
          opacity: isHighlighter ? 0.42 : 1,
          baseWidth: vbWidth,
          baseHeight: vbHeight,
          transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
        };

        const next = [...drawings, newPath];
        setDrawings(next);
        onUpdateNode(node.id, { mapDrawings: next });
        setCurrentPathPoints([]);
      } else if (isDragShapeTool(activeTool) && dragStartPoint && dragCurrentPoint) {
        const dragDist = Math.hypot(
          dragCurrentPoint.x - dragStartPoint.x,
          dragCurrentPoint.y - dragStartPoint.y
        );

        if (dragDist >= 4) {
          let newEl: DrawingElement | null = null;
          const scaledWidth = String(Math.round(Math.max(2, pencilThickness) * svgUnit));

          if (activeTool === 'line') {
            newEl = {
              id: `map-draw-${Date.now()}`,
              layer: activeLayer,
              type: 'path',
              shape: 'line',
              d: buildLinePath(dragStartPoint, dragCurrentPoint),
              stroke: strokeColor,
              width: scaledWidth,
              baseWidth: vbWidth,
              baseHeight: vbHeight,
              transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
            };
          } else if (activeTool === 'arrow') {
            newEl = {
              id: `map-draw-${Date.now()}`,
              layer: activeLayer,
              type: 'path',
              shape: 'arrow-draw',
              d: buildArrowPath(dragStartPoint, dragCurrentPoint, 16 * svgUnit),
              stroke: strokeColor,
              width: scaledWidth,
              baseWidth: vbWidth,
              baseHeight: vbHeight,
              transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
            };
          } else if (activeTool === 'rect') {
            newEl = {
              id: `map-draw-${Date.now()}`,
              layer: activeLayer,
              type: 'path',
              shape: 'rect',
              d: buildRectPath(dragStartPoint, dragCurrentPoint),
              stroke: strokeColor,
              width: scaledWidth,
              baseWidth: vbWidth,
              baseHeight: vbHeight,
              transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
            };
          } else if (activeTool === 'ellipse') {
            newEl = {
              id: `map-draw-${Date.now()}`,
              layer: activeLayer,
              type: 'path',
              shape: 'ellipse',
              d: buildEllipsePath(dragStartPoint, dragCurrentPoint),
              stroke: strokeColor,
              width: scaledWidth,
              baseWidth: vbWidth,
              baseHeight: vbHeight,
              transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
            };
          } else if (activeTool === 'measure') {
            const mData = buildMeasureData(
              dragStartPoint,
              dragCurrentPoint,
              vbWidth,
              vbHeight,
              10 * svgUnit
            );
            newEl = {
              id: `map-measure-${Date.now()}`,
              layer: activeLayer,
              type: 'measure',
              shape: 'measure',
              d: mData.d,
              stroke: strokeColor,
              width: String(Math.round(Math.max(2, pencilThickness * 0.65) * svgUnit)),
              measureLabel: mData.measureLabel,
              measurePoints: mData.measurePoints,
              baseWidth: vbWidth,
              baseHeight: vbHeight,
              transform: { x: 0, y: 0, scale: 1, rotate: 0, cx: 0, cy: 0 },
            };
          }

          if (newEl) {
            if (isReadOnly && newEl.type === 'measure') {
              setTempMeasureDrawing(newEl);
            } else if (!isReadOnly) {
              const next = [...drawings, newEl];
              setDrawings(next);
              onUpdateNode(node.id, { mapDrawings: next });
            }
          }
        }

        setDragStartPoint(null);
        setDragCurrentPoint(null);
      }

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
  const canUndoOnLayer = drawings.some((d) => d.layer === activeLayer || d.layer === 'map');

  const previewPathD = isDrawingPath
    ? buildPreviewPathForTool(
        activeTool,
        currentPathPoints,
        dragStartPoint,
        dragCurrentPoint,
        vbWidth,
        vbHeight,
        svgUnit
      )
    : '';

  const liveMeasurePreview =
    isDrawingPath && activeTool === 'measure' && dragStartPoint && dragCurrentPoint
      ? buildMeasureData(dragStartPoint, dragCurrentPoint, vbWidth, vbHeight, 10 * svgUnit)
      : null;

  const renderMeasureBadge = (
    pts: { x1: number; y1: number; x2: number; y2: number },
    label: string,
    color: string
  ) => {
    const mx = (pts.x1 + pts.x2) / 2;
    const my = (pts.y1 + pts.y2) / 2;
    const fontSize = Math.round(12 * svgUnit);
    const charW = fontSize * 0.62;
    const boxW = Math.max(58 * svgUnit, label.length * charW + 14 * svgUnit);
    const boxH = fontSize + 10 * svgUnit;

    return (
      <g className="pointer-events-none select-none">
        <rect
          x={mx - boxW / 2}
          y={my - boxH / 2}
          width={boxW}
          height={boxH}
          rx={4 * svgUnit}
          fill="rgba(15, 23, 42, 0.92)"
          stroke={color}
          strokeWidth={1.5 * svgUnit}
        />
        <text
          x={mx}
          y={my}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#c9c6bd]/95 dark:bg-black/90 flex items-center justify-center pb-14 select-none touch-canvas"
      onPointerMove={handlePointerMoveSVG}
      onPointerUp={handlePointerUpSVG}
      onPointerCancel={handlePointerUpSVG}
    >
      {/* Top Left Controls: Layers, Title, Replace Map */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-50 flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-[calc(100vw-5.5rem)] bg-[#ebe7de]/95 dark:bg-neutral-900/90 backdrop-blur-md px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-[#c3beb1] dark:border-neutral-700/80 shadow-2xl">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mr-1">
          <MapIcon className="w-4 h-4" />
          <span className="truncate max-w-[120px] sm:max-w-[180px]">{node.mapName || t('mapViewer.defaultTitle')}</span>
        </div>

        <div className="hidden sm:block w-px h-5 bg-[#c3beb1] dark:bg-neutral-700 mx-1" />

        {(['enfoque', 'accion', 'descripcion'] as const).map((layer) => {
          const count = pins.filter((p) => p.type === layer).length;
          const isActive = activeLayer === layer;
          const color = LAYER_COLORS[layer];

          return (
            <button
              key={layer}
              onClick={() => {
                setActiveLayer(layer);
                setStrokeColor(LAYER_COLORS[layer]);
                setActiveFigureId(null);
              }}
              style={{
                backgroundColor: isActive ? color : 'transparent',
                borderColor: color,
              }}
              className={`touch-target px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'text-white shadow-lg scale-105 ring-2 ring-black/15 dark:ring-white/70'
                  : 'text-[#3a362e] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              {tColumn(layer)} ({count})
            </button>
          );
        })}

        <div className="hidden sm:block w-px h-5 bg-[#c3beb1] dark:bg-neutral-700 mx-1" />

        <button
          onClick={onRequestReplaceMap}
          className="touch-target px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-red-700 hover:text-white dark:text-red-400 dark:hover:text-white bg-red-600/10 hover:bg-red-600 border border-red-600/35 dark:border-red-500/30 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          🔄 {t('mapViewer.replaceMap')}
        </button>
      </div>

      {/* Top Right Close Button */}
      <button
        onClick={onClose}
        className="touch-target absolute top-3 right-3 sm:top-4 sm:right-4 z-50 w-10 h-10 rounded-full bg-[#ebe7de]/95 hover:bg-[#dcd7cc] dark:bg-neutral-900/90 dark:hover:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 text-[#433f37] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white flex items-center justify-center shadow-xl transition-all cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Map Image & SVG Layer */}
      <div
        ref={imageWrapperRef}
        onClick={handleImageClick}
        className={`touch-canvas relative max-w-[92vw] sm:max-w-[88vw] max-h-[75vh] sm:max-h-[78vh] inline-block shadow-2xl rounded-xl overflow-hidden ${
          activeTool !== 'none' ? 'cursor-crosshair' : ''
        }`}
      >
        {mapLoadError ? (
          <div className="w-[70vw] max-w-xl aspect-video rounded-xl bg-neutral-900 border border-amber-500/50 flex items-center justify-center p-6 text-center text-xs text-amber-200">
            {t('mapViewer.imageUnavailable')}
          </div>
        ) : (
          <img
            ref={fullSizeMapImageRef}
            src={node.mapImage || ''}
            alt={node.mapName}
            referrerPolicy="no-referrer"
            onLoad={handleImageLoad}
            onError={() => setMapLoadError(true)}
            className="block max-w-[92vw] sm:max-w-[88vw] max-h-[75vh] sm:max-h-[78vh] object-contain select-none pointer-events-none"
          />
        )}

        <svg
          ref={svgOverlayRef}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          onPointerDown={handlePointerDownSVG}
          className={`touch-canvas absolute inset-0 w-full h-full pointer-events-auto overflow-visible ${
            activeTool !== 'none' ? 'cursor-crosshair' : ''
          }`}
        >
          <rect
            id="mapDrawingCatch"
            x={-Math.max(2000, vbWidth)}
            y={-Math.max(2000, vbHeight)}
            width={Math.max(5000, vbWidth * 3)}
            height={Math.max(5000, vbHeight * 3)}
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

            const canInteractWithDrawings = activeTool === 'none' || activeTool === 'eraser';

            return (
              <g
                key={draw.id}
                id={draw.id}
                data-drawing="true"
                transform={transformStr}
                className={canInteractWithDrawings ? 'cursor-pointer' : 'pointer-events-none'}
                onPointerDown={(e) => {
                  if (!canInteractWithDrawings) return;
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
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
                  if (!canInteractWithDrawings) return;
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
                  className={canInteractWithDrawings ? 'pointer-events-auto' : 'pointer-events-none'}
                />
                {/* Visible styled path */}
                <path
                  d={draw.d}
                  stroke={draw.stroke}
                  strokeWidth={draw.type === 'path' || draw.type === 'measure' ? draw.width || '4' : '4'}
                  strokeOpacity={draw.opacity ?? 1}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={canInteractWithDrawings ? undefined : 'pointer-events-none'}
                />

                {draw.type === 'measure' &&
                  draw.measureLabel &&
                  (() => {
                    const pts = getMeasurePointsFromDrawing(draw);
                    return pts ? renderMeasureBadge(pts, draw.measureLabel, draw.stroke) : null;
                  })()}
              </g>
            );
          })}

          {tempMeasureDrawing && tempMeasureDrawing.layer === activeLayer && (
            <g className="pointer-events-none">
              <path
                d={tempMeasureDrawing.d}
                stroke={tempMeasureDrawing.stroke}
                strokeWidth={tempMeasureDrawing.width || '3'}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {tempMeasureDrawing.measureLabel &&
                tempMeasureDrawing.measurePoints &&
                renderMeasureBadge(
                  tempMeasureDrawing.measurePoints,
                  tempMeasureDrawing.measureLabel,
                  tempMeasureDrawing.stroke
                )}
            </g>
          )}

          {isDrawingPath && previewPathD && (
            <g className="pointer-events-none">
              <path
                d={previewPathD}
                stroke={strokeColor}
                strokeWidth={
                  activeTool === 'highlighter'
                    ? Math.round(Math.max(14, pencilThickness * 2.8) * svgUnit)
                    : activeTool === 'measure'
                    ? Math.round(Math.max(2, pencilThickness * 0.65) * svgUnit)
                    : Math.round(pencilThickness * svgUnit)
                }
                strokeOpacity={activeTool === 'highlighter' ? 0.42 : 1}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {liveMeasurePreview &&
                renderMeasureBadge(
                  liveMeasurePreview.measurePoints,
                  liveMeasurePreview.measureLabel,
                  strokeColor
                )}
            </g>
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
                ? `${scalePrefix}translate(${tx}, ${ty}) rotate(${rot})`
                : `${scalePrefix}translate(${tx}, ${ty}) translate(${originX}, ${originY}) rotate(${rot}) translate(${-originX}, ${-originY})`;

            const scaledX = originX + (bbox.x - originX) * scl;
            const scaledY = originY + (bbox.y - originY) * scl;
            const scaledWidth = bbox.width * scl;
            const scaledHeight = bbox.height * scl;
            const scaledCx = originX + (bbox.cx - originX) * scl;

            return (
              <g
                id="manipulatorGroup"
                data-drawing="true"
                transform={transformStr}
                className={activeTool !== 'none' ? 'pointer-events-none' : undefined}
                onClick={(e) => {
                  if (activeTool !== 'none') return;
                  e.stopPropagation();
                  suppressPinClickRef.current = true;
                }}
              >
                <rect
                  x={scaledX}
                  y={scaledY}
                  width={scaledWidth}
                  height={scaledHeight}
                  className="figure-manipulator"
                  style={{ stroke: '#9f2727', borderColor: '#9f2727' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startAction('move', e.clientX, e.clientY, activeFigure);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    suppressPinClickRef.current = true;
                  }}
                />
                <line
                  x1={scaledCx}
                  y1={scaledY}
                  x2={scaledCx}
                  y2={scaledY - 30}
                  className="figure-manipulator"
                  style={{ stroke: '#9f2727' }}
                />
                <circle
                  cx={scaledCx}
                  cy={scaledY - 30}
                  r="20"
                  fill="transparent"
                  className="manipulator-handle cursor-crosshair"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startAction('rotate', e.clientX, e.clientY, activeFigure);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    suppressPinClickRef.current = true;
                  }}
                />
                <circle
                  cx={scaledCx}
                  cy={scaledY - 30}
                  r="8"
                  className="manipulator-handle cursor-crosshair pointer-events-none"
                  style={{ stroke: '#9f2727', borderColor: '#9f2727' }}
                />
                <rect
                  x={scaledX + scaledWidth - 18}
                  y={scaledY + scaledHeight - 18}
                  width="36"
                  height="36"
                  fill="transparent"
                  className="manipulator-handle cursor-nwse-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startAction('scale', e.clientX, e.clientY, activeFigure);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    suppressPinClickRef.current = true;
                  }}
                />
                <rect
                  x={scaledX + scaledWidth - 7}
                  y={scaledY + scaledHeight - 7}
                  width="14"
                  height="14"
                  className="manipulator-handle cursor-nwse-resize pointer-events-none"
                  style={{ stroke: '#9f2727', borderColor: '#9f2727' }}
                />
              </g>
            );
          })()}
        </svg>

        {/* Render Comment Pins on Map */}
        {pins.map((pin) => {
          const isVisible = pin.type === activeLayer;
          if (!isVisible) return null;
          const isPinInteractive = activeTool === 'none';

          return (
            <div
              key={pin.id}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              onMouseEnter={(e) => {
                if (!isPinInteractive) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHoveredPin({ text: pin.text, x: rect.left + rect.width / 2, y: rect.top - 8 });
              }}
              onMouseLeave={() => {
                if (!isPinInteractive) return;
                setHoveredPin(null);
              }}
              onPointerDown={(e) => {
                if (!isPinInteractive) return;
                e.stopPropagation();
                setDraggingPinId(pin.id);
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHoveredPin({ text: pin.text, x: rect.left + rect.width / 2, y: rect.top - 8 });
              }}
              onClick={(e) => {
                if (!isPinInteractive) return;
                e.stopPropagation();
              }}
              className={`comment-pin pin-${pin.type} absolute w-7 h-7 sm:w-6 sm:h-6 rounded-full text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-xl z-20 -translate-x-1/2 -translate-y-full transition-transform ${
                isPinInteractive
                  ? 'cursor-grab active:cursor-grabbing hover:scale-125 pointer-events-auto'
                  : 'pointer-events-none'
              }`}
            >
              <span>{pin.num}</span>
            </div>
          );
        })}
      </div>

      {/* Always-Visible Bottom-Centered Drawing Tools Bar */}
      <DrawingToolsBar
        activeTool={activeTool}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          setFigureMenuOpen(false);
          if (tool !== 'none') {
            setActiveFigureId(null);
            setHoveredPin(null);
            setPopupPos(null);
          }
        }}
        figureMenuOpen={figureMenuOpen}
        onToggleFigureMenu={() => {
          setActiveTool('figure');
          setFigureMenuOpen((prev) => !prev);
          setActiveFigureId(null);
          setHoveredPin(null);
          setPopupPos(null);
        }}
        onSpawnFigure={spawnFigure}
        strokeThickness={pencilThickness}
        onChangeThickness={setPencilThickness}
        strokeColor={strokeColor}
        layerDefaultColor={LAYER_COLORS[activeLayer]}
        onChangeColor={setStrokeColor}
        canUndo={canUndoOnLayer}
        onUndo={handleUndoLastDrawing}
        isReadOnly={isReadOnly}
      />

      {/* Pin Creation Popup Dialog */}
      {popupPos && (
        <>
          <div className="fixed inset-0 z-50" onPointerDown={() => setPopupPos(null)} onClick={() => setPopupPos(null)} />
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              left: typeof window !== 'undefined' ? Math.max(152, Math.min(popupPos.x, window.innerWidth - 152)) : popupPos.x,
              top: typeof window !== 'undefined' ? Math.max(220, popupPos.y) : popupPos.y,
            }}
            className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl shadow-2xl p-3.5 space-y-3 backdrop-blur-md -translate-x-1/2 -translate-y-full mb-3"
          >
            <div className="flex items-center justify-between border-b border-[#d4cfc3] dark:border-neutral-800 pb-2">
              <span className="font-semibold text-xs text-[#2b2924] dark:text-neutral-200">
                {t('mapViewer.createPinTitle', { layer: tColumn(activeLayer).toUpperCase() })}
              </span>
              <span className="text-[10px] text-[#5c584e] dark:text-neutral-400">
                {t('mapViewer.byAuthor', { author: currentUserName })}
              </span>
            </div>

            <textarea
              value={popupText}
              onChange={(e) => setPopupText(e.target.value)}
              placeholder={t('mapViewer.notePlaceholder')}
              rows={3}
              autoFocus
              className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-xl p-2 text-xs text-[#2b2924] dark:text-neutral-200 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500 resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#d4cfc3] dark:border-neutral-800">
              <button
                onClick={() => setPopupPos(null)}
                className="px-3 py-1 text-xs text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 font-medium cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSavePin}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {t('mapViewer.savePin')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hover Tooltip for existing pins */}
      {hoveredPin && !popupPos && (
        <div
          style={{ left: hoveredPin.x, top: hoveredPin.y }}
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 px-3 py-1.5 rounded-lg bg-[#ebe7de]/95 dark:bg-neutral-900/95 border border-[#c3beb1] dark:border-neutral-700/80 text-[#2b2924] dark:text-white text-xs font-medium max-w-xs shadow-2xl backdrop-blur-sm"
        >
          {hoveredPin.text}
        </div>
      )}
    </div>
  );
};
