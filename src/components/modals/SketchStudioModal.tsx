import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Brush,
  Check,
  Circle,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Grid,
  Hand,
  Highlighter,
  ImagePlus,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  PaintBucket,
  PenTool,
  Pipette,
  Plus,
  Redo2,
  RotateCcw,
  Slash,
  Sparkles,
  SprayCan,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const MAX_SKETCH_HISTORY = 20;

type SketchTool =
  | 'pencil'
  | 'brush'
  | 'calligraphy'
  | 'airbrush'
  | 'highlighter'
  | 'eraser'
  | 'fill'
  | 'eyedropper'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'pan';

type SymmetryMode = 'none' | 'horizontal' | 'vertical' | 'quad';
type GuideMode = 'none' | 'thirds' | 'cinema' | 'grid';
type ShapeFillMode = 'stroke' | 'fill' | 'both';

interface SketchLayerMeta {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

interface SketchHistoryEntry {
  layerId: string;
  imageData: ImageData;
}

interface SketchStudioModalProps {
  nodeTitle: string;
  targetKind?: 'image' | 'map';
  existingImageUrl?: string | null;
  onClose: () => void;
  onSaveSketch: (file: File) => Promise<void>;
}

const SWATCH_COLORS = [
  '#0f172a',
  '#18181b',
  '#52525b',
  '#94a3b8',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#2563eb',
  '#7c3aed',
  '#ec4899',
  '#92400e',
];

export const SketchStudioModal: React.FC<SketchStudioModalProps> = ({
  nodeTitle,
  targetKind = 'image',
  existingImageUrl,
  onClose,
  onSaveSketch,
}) => {
  const { t } = useLanguage();
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const layerCanvasMapRef = useRef<Record<string, HTMLCanvasElement>>({});

  const paperPresets = [
    { label: t('sketch.paperWhite'), value: '#ffffff' },
    { label: t('sketch.paperWarm'), value: '#f6f1e7' },
    { label: t('sketch.paperGray'), value: '#d4d8df' },
    { label: t('sketch.paperDark'), value: '#14171d' },
    { label: t('sketch.paperTransparent'), value: 'transparent' },
  ];

  const [layers, setLayers] = useState<SketchLayerMeta[]>(() => [
    { id: 'layer-bg-color', name: t('sketch.layerBg'), visible: true, opacity: 1 },
    { id: 'layer-sketch', name: t('sketch.layerSketch'), visible: true, opacity: 1 },
    { id: 'layer-ink', name: t('sketch.layerInk'), visible: true, opacity: 1 },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-ink');
  const [paperColor, setPaperColor] = useState<string>('#ffffff');

  const [activeTool, setActiveTool] = useState<SketchTool>('pencil');
  const [color, setColor] = useState<string>('#18181b');
  const [recentColors, setRecentColors] = useState<string[]>(['#18181b', '#2563eb', '#ef4444', '#ffffff']);
  const [brushSize, setBrushSize] = useState<number>(6);
  const [brushOpacity, setBrushOpacity] = useState<number>(100);
  const [brushHardness, setBrushHardness] = useState<number>(85);
  const [fillTolerance, setFillTolerance] = useState<number>(28);
  const [shapeFillMode, setShapeFillMode] = useState<ShapeFillMode>('stroke');
  const [symmetry, setSymmetry] = useState<SymmetryMode>('none');
  const [guideMode, setGuideMode] = useState<GuideMode>('thirds');
  const [textFontSize, setTextFontSize] = useState<number>(42);
  const [textBold, setTextBold] = useState<boolean>(true);

  const [zoom, setZoom] = useState<number>(0.55);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const [layersDrawerOpen, setLayersDrawerOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 900 : true
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isImportingImage, setIsImportingImage] = useState<boolean>(false);

  const [pendingText, setPendingText] = useState<{
    canvasX: number;
    canvasY: number;
    screenX: number;
    screenY: number;
    value: string;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // History stacks (scoped cleanly to active layer pixels)
  const undoStackRef = useRef<SketchHistoryEntry[]>([]);
  const redoStackRef = useRef<SketchHistoryEntry[]>([]);
  const [undoCount, setUndoCount] = useState<number>(0);
  const [redoCount, setRedoCount] = useState<number>(0);

  // Interactive drawing refs
  const isDrawingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const touchPointsRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchStateRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialMidX: number;
    initialMidY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const strokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentPointRef = useRef<{ x: number; y: number } | null>(null);
  const preStrokeSnapshotRef = useRef<ImageData | null>(null);
  const cursorCanvasPosRef = useRef<{ x: number; y: number } | null>(null);

  const getOrCreateLayerCanvas = useCallback((layerId: string): HTMLCanvasElement => {
    let c = layerCanvasMapRef.current[layerId];
    if (!c) {
      c = document.createElement('canvas');
      c.width = CANVAS_W;
      c.height = CANVAS_H;
      layerCanvasMapRef.current[layerId] = c;
    }
    return c;
  }, []);

  // Initialize layer canvases cleanly
  useEffect(() => {
    layers.forEach((l) => getOrCreateLayerCanvas(l.id));
  }, [layers, getOrCreateLayerCanvas]);

  // Enter browser fullscreen on mount if supported & allowed
  useEffect(() => {
    const enterFs = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Ignore browser/iframe fullscreen permission restrictions; full-viewport modal remains active
      }
    };
    enterFs();

    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Ignore if restricted by sandbox
    }
  };

  // Fit 1920x1080 artboard nicely inside the available center workspace
  const fitCanvasToViewport = useCallback(() => {
    const container = stageContainerRef.current;
    if (!container) return;
    const padX = 48;
    const padY = 48;
    const availW = Math.max(240, container.clientWidth - padX);
    const availH = Math.max(180, container.clientHeight - padY);
    const nextZoom = Math.max(0.15, Math.min(availW / CANVAS_W, availH / CANVAS_H, 1.25));
    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fitCanvasToViewport(), 30);
    window.addEventListener('resize', fitCanvasToViewport);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', fitCanvasToViewport);
    };
  }, [fitCanvasToViewport]);

  // Composite all visible layers + background onto display canvas
  const renderComposite = useCallback(() => {
    const disp = displayCanvasRef.current;
    if (!disp) return;
    const ctx = disp.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (paperColor !== 'transparent') {
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Bottom-to-top layer compositing
    for (const layer of layers) {
      if (!layer.visible) continue;
      const lc = layerCanvasMapRef.current[layer.id];
      if (!lc) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
      ctx.drawImage(lc, 0, 0);
      ctx.restore();
    }
  }, [layers, paperColor]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  const recordHistorySnapshot = useCallback((layerId: string, snapshot: ImageData) => {
    const nextUndo = [...undoStackRef.current, { layerId, imageData: snapshot }].slice(-MAX_SKETCH_HISTORY);
    undoStackRef.current = nextUndo;
    redoStackRef.current = [];
    setUndoCount(nextUndo.length);
    setRedoCount(0);
  }, []);

  const handleSketchUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    const lc = getOrCreateLayerCanvas(entry.layerId);
    const lctx = lc.getContext('2d');
    if (!lctx) return;

    const currentSnapshot = lctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const nextUndo = undoStackRef.current.slice(0, -1);
    const nextRedo = [...redoStackRef.current, { layerId: entry.layerId, imageData: currentSnapshot }].slice(
      -MAX_SKETCH_HISTORY
    );

    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setUndoCount(nextUndo.length);
    setRedoCount(nextRedo.length);

    lctx.putImageData(entry.imageData, 0, 0);
    setActiveLayerId(entry.layerId);
    renderComposite();
  }, [getOrCreateLayerCanvas, renderComposite]);

  const handleSketchRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    const lc = getOrCreateLayerCanvas(entry.layerId);
    const lctx = lc.getContext('2d');
    if (!lctx) return;

    const currentSnapshot = lctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const nextRedo = redoStackRef.current.slice(0, -1);
    const nextUndo = [...undoStackRef.current, { layerId: entry.layerId, imageData: currentSnapshot }].slice(
      -MAX_SKETCH_HISTORY
    );

    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setUndoCount(nextUndo.length);
    setRedoCount(nextRedo.length);

    lctx.putImageData(entry.imageData, 0, 0);
    setActiveLayerId(entry.layerId);
    renderComposite();
  }, [getOrCreateLayerCanvas, renderComposite]);

  const rememberColor = useCallback((hex: string) => {
    setColor(hex);
    setRecentColors((prev) => {
      const next = [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())];
      return next.slice(0, 8);
    });
  }, []);

  // Symmetry coordinate helper
  const getSymmetryPoints = useCallback(
    (x: number, y: number): { x: number; y: number }[] => {
      if (symmetry === 'horizontal') {
        return [{ x, y }, { x: CANVAS_W - x, y }];
      }
      if (symmetry === 'vertical') {
        return [{ x, y }, { x, y: CANVAS_H - y }];
      }
      if (symmetry === 'quad') {
        return [
          { x, y },
          { x: CANVAS_W - x, y },
          { x, y: CANVAS_H - y },
          { x: CANVAS_W - x, y: CANVAS_H - y },
        ];
      }
      return [{ x, y }];
    },
    [symmetry]
  );

  // Convert pointer screen coords to exact 1920x1080 canvas coords
  const clientToCanvasPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const disp = displayCanvasRef.current;
    if (!disp) return { x: 0, y: 0 };
    const rect = disp.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_H;
    return { x, y };
  }, []);

  // Fast scanline flood fill on 1920x1080 ImageData
  const applyFloodFill = useCallback(
    (startX: number, startY: number, fillHex: string, tolerance: number) => {
      const lc = getOrCreateLayerCanvas(activeLayerId);
      const lctx = lc.getContext('2d', { willReadFrequently: true });
      if (!lctx) return;

      const sx = Math.floor(startX);
      const sy = Math.floor(startY);
      if (sx < 0 || sx >= CANVAS_W || sy < 0 || sy >= CANVAS_H) return;

      const snapshot = lctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      recordHistorySnapshot(activeLayerId, snapshot);

      const img = lctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      const data = img.data;

      const cleanHex = fillHex.replace('#', '');
      const fr = parseInt(cleanHex.slice(0, 2), 16) || 0;
      const fg = parseInt(cleanHex.slice(2, 4), 16) || 0;
      const fb = parseInt(cleanHex.slice(4, 6), 16) || 0;
      const fa = Math.round((brushOpacity / 100) * 255);

      const startIdx = (sy * CANVAS_W + sx) * 4;
      const sr = data[startIdx];
      const sg = data[startIdx + 1];
      const sb = data[startIdx + 2];
      const sa = data[startIdx + 3];

      if (sr === fr && sg === fg && sb === fb && sa === fa) return;

      const tolSq = tolerance * tolerance * 4;
      const visited = new Uint8Array(CANVAS_W * CANVAS_H);

      const matchesStart = (pixelIndex: number) => {
        const i = pixelIndex * 4;
        const dr = data[i] - sr;
        const dg = data[i + 1] - sg;
        const db = data[i + 2] - sb;
        const da = data[i + 3] - sa;
        return dr * dr + dg * dg + db * db + da * da <= tolSq;
      };

      const stack: number[] = [sx, sy];
      while (stack.length > 0) {
        const y = stack.pop()!;
        const x = stack.pop()!;
        let lx = x;

        while (lx >= 0 && !visited[y * CANVAS_W + lx] && matchesStart(y * CANVAS_W + lx)) {
          lx--;
        }
        lx++;

        let spanAbove = false;
        let spanBelow = false;
        while (lx < CANVAS_W && !visited[y * CANVAS_W + lx] && matchesStart(y * CANVAS_W + lx)) {
          const pIdx = y * CANVAS_W + lx;
          visited[pIdx] = 1;
          const i = pIdx * 4;
          data[i] = fr;
          data[i + 1] = fg;
          data[i + 2] = fb;
          data[i + 3] = fa;

          if (y > 0) {
            const aboveIdx = (y - 1) * CANVAS_W + lx;
            const matchAbove = !visited[aboveIdx] && matchesStart(aboveIdx);
            if (!spanAbove && matchAbove) {
              stack.push(lx, y - 1);
              spanAbove = true;
            } else if (spanAbove && !matchAbove) {
              spanAbove = false;
            }
          }

          if (y < CANVAS_H - 1) {
            const belowIdx = (y + 1) * CANVAS_W + lx;
            const matchBelow = !visited[belowIdx] && matchesStart(belowIdx);
            if (!spanBelow && matchBelow) {
              stack.push(lx, y + 1);
              spanBelow = true;
            } else if (spanBelow && !matchBelow) {
              spanBelow = false;
            }
          }
          lx++;
        }
      }

      lctx.putImageData(img, 0, 0);
      renderComposite();
    },
    [activeLayerId, brushOpacity, getOrCreateLayerCanvas, recordHistorySnapshot, renderComposite]
  );

  const sampleCompositeColor = useCallback(
    (x: number, y: number) => {
      const disp = displayCanvasRef.current;
      if (!disp) return;
      const ctx = disp.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const px = Math.max(0, Math.min(CANVAS_W - 1, Math.round(x)));
      const py = Math.max(0, Math.min(CANVAS_H - 1, Math.round(y)));
      const pixel = ctx.getImageData(px, py, 1, 1).data;
      if (pixel[3] === 0) return;
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      rememberColor(`#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`);
    },
    [rememberColor]
  );

  // Stamp/stroke segment helper for freehand tools
  const drawFreehandSegment = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      tool: SketchTool
    ) => {
      const sym0 = getSymmetryPoints(p0.x, p0.y);
      const sym1 = getSymmetryPoints(p1.x, p1.y);
      const alpha = Math.max(0.05, Math.min(1, brushOpacity / 100));

      for (let i = 0; i < sym0.length; i++) {
        const a = sym0[i];
        const b = sym1[i];
        ctx.save();

        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (brushHardness < 95) {
            ctx.shadowColor = 'rgba(0,0,0,1)';
            ctx.shadowBlur = ((100 - brushHardness) / 100) * (brushSize * 0.65);
          }
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        } else if (tool === 'airbrush') {
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const steps = Math.max(1, Math.ceil(dist / Math.max(2, brushSize * 0.18)));
          const radius = Math.max(4, brushSize * 0.85);
          const particles = Math.max(10, Math.round(brushSize * 1.1));
          ctx.fillStyle = color;
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0 : s / steps;
            const cx = a.x + (b.x - a.x) * t;
            const cy = a.y + (b.y - a.y) * t;
            for (let p = 0; p < particles; p++) {
              const angle = Math.random() * Math.PI * 2;
              const r = Math.pow(Math.random(), 0.75) * radius;
              const px = cx + Math.cos(angle) * r;
              const py = cy + Math.sin(angle) * r;
              const falloff = 1 - r / radius;
              ctx.globalAlpha = alpha * 0.18 * falloff;
              ctx.fillRect(px, py, 2, 2);
            }
          }
        } else if (tool === 'calligraphy') {
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const steps = Math.max(1, Math.ceil(dist / 1.5));
          ctx.fillStyle = color;
          ctx.globalAlpha = alpha;
          const nibW = Math.max(2, brushSize * 1.25);
          const nibH = Math.max(1.5, brushSize * 0.28);
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const cx = a.x + (b.x - a.x) * t;
            const cy = a.y + (b.y - a.y) * t;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-Math.PI / 5);
            ctx.beginPath();
            ctx.ellipse(0, 0, nibW / 2, nibH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        } else if (tool === 'highlighter') {
          ctx.globalAlpha = Math.min(alpha, 0.35);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(8, brushSize * 1.6);
          ctx.lineCap = 'square';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        } else if (tool === 'brush') {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (brushHardness < 95) {
            ctx.shadowColor = color;
            ctx.shadowBlur = ((100 - brushHardness) / 100) * (brushSize * 0.75);
          }
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        } else {
          // Pencil: crisp fine sketch line with subtle grain variation
          ctx.globalAlpha = alpha * 0.92;
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1, brushSize);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        ctx.restore();
      }
    },
    [brushHardness, brushOpacity, brushSize, color, getSymmetryPoints]
  );

  // Geometric shape renderer (used both for preview canvas and final layer commit)
  const renderShapeToContext = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      tool: SketchTool,
      start: { x: number; y: number },
      end: { x: number; y: number },
      constrain: boolean
    ) => {
      let ex = end.x;
      let ey = end.y;
      if (constrain) {
        const dx = ex - start.x;
        const dy = ey - start.y;
        if (tool === 'line' || tool === 'arrow') {
          const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
          const dist = Math.hypot(dx, dy);
          ex = start.x + Math.cos(angle) * dist;
          ey = start.y + Math.sin(angle) * dist;
        } else if (tool === 'rect' || tool === 'ellipse') {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          ex = start.x + Math.sign(dx || 1) * side;
          ey = start.y + Math.sign(dy || 1) * side;
        }
      }

      const symStarts = getSymmetryPoints(start.x, start.y);
      const symEnds = getSymmetryPoints(ex, ey);
      const alpha = Math.max(0.05, Math.min(1, brushOpacity / 100));

      for (let i = 0; i < symStarts.length; i++) {
        const s = symStarts[i];
        const t = symEnds[i];
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(1, brushSize);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tool === 'line') {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        } else if (tool === 'arrow') {
          const headLen = Math.max(18, brushSize * 3.2);
          const angle = Math.atan2(t.y - s.y, t.x - s.x);
          const shaftEndX = t.x - Math.cos(angle) * (headLen * 0.45);
          const shaftEndY = t.y - Math.sin(angle) * (headLen * 0.45);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(shaftEndX, shaftEndY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(t.x - headLen * Math.cos(angle - Math.PI / 6), t.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(t.x - headLen * Math.cos(angle + Math.PI / 6), t.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        } else if (tool === 'rect') {
          const rx = Math.min(s.x, t.x);
          const ry = Math.min(s.y, t.y);
          const rw = Math.abs(t.x - s.x);
          const rh = Math.abs(t.y - s.y);
          if (shapeFillMode === 'fill' || shapeFillMode === 'both') {
            ctx.fillRect(rx, ry, rw, rh);
          }
          if (shapeFillMode === 'stroke' || shapeFillMode === 'both') {
            ctx.strokeRect(rx, ry, rw, rh);
          }
        } else if (tool === 'ellipse') {
          const cx = (s.x + t.x) / 2;
          const cy = (s.y + t.y) / 2;
          const rx = Math.max(1, Math.abs(t.x - s.x) / 2);
          const ry = Math.max(1, Math.abs(t.y - s.y) / 2);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          if (shapeFillMode === 'fill' || shapeFillMode === 'both') {
            ctx.fill();
          }
          if (shapeFillMode === 'stroke' || shapeFillMode === 'both') {
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    },
    [brushOpacity, brushSize, color, getSymmetryPoints, shapeFillMode]
  );

  // Brush cursor indicator on preview overlay
  const drawCursorReticle = useCallback(
    (pt: { x: number; y: number } | null) => {
      const prev = previewCanvasRef.current;
      if (!prev) return;
      const pctx = prev.getContext('2d');
      if (!pctx) return;
      pctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      if (!pt) return;

      if (
        activeTool === 'pencil' ||
        activeTool === 'brush' ||
        activeTool === 'calligraphy' ||
        activeTool === 'airbrush' ||
        activeTool === 'highlighter' ||
        activeTool === 'eraser'
      ) {
        const r = Math.max(2, (activeTool === 'highlighter' ? brushSize * 0.8 : brushSize / 2));
        pctx.save();
        pctx.strokeStyle = activeTool === 'eraser' ? '#ef4444' : '#38bdf8';
        pctx.lineWidth = Math.max(1.5, 1.5 / zoom);
        pctx.beginPath();
        pctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        pctx.stroke();
        pctx.restore();
      }
    },
    [activeTool, brushSize, zoom]
  );

  const cancelActiveStrokeWithoutCommit = useCallback(() => {
    if (isDrawingRef.current && preStrokeSnapshotRef.current) {
      const lc = getOrCreateLayerCanvas(activeLayerId);
      const lctx = lc.getContext('2d');
      lctx?.putImageData(preStrokeSnapshotRef.current, 0, 0);
      previewCanvasRef.current?.getContext('2d')?.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderComposite();
    }
    isDrawingRef.current = false;
    isPanningRef.current = false;
    activePointerIdRef.current = null;
    panStartRef.current = null;
    preStrokeSnapshotRef.current = null;
    strokePointsRef.current = [];
    shapeStartRef.current = null;
    currentPointRef.current = null;
  }, [activeLayerId, getOrCreateLayerCanvas, renderComposite]);

  const handleStagePointerDown = (e: React.PointerEvent) => {
    if (pendingText) return;

    if (e.pointerType === 'touch') {
      touchPointsRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (touchPointsRef.current.size === 2) {
        // Cancel accidental 1-finger stroke when 2nd finger lands for pinch/pan
        cancelActiveStrokeWithoutCommit();
        const pts = Array.from(touchPointsRef.current.values());
        const dist = Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY);
        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;
        pinchStateRef.current = {
          initialDist: Math.max(10, dist),
          initialZoom: zoom,
          initialMidX: midX,
          initialMidY: midY,
          initialPanX: pan.x,
          initialPanY: pan.y,
        };
        return;
      }
      if (touchPointsRef.current.size > 2) return;
    }

    if (
      e.button === 1 ||
      isSpacePressed ||
      (activeTool === 'pan' && (e.pointerType !== 'mouse' || e.button === 0))
    ) {
      e.preventDefault();
      isPanningRef.current = true;
      activePointerIdRef.current = e.pointerId;
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const pt = clientToCanvasPoint(e.clientX, e.clientY);

    if (e.altKey || activeTool === 'eyedropper') {
      sampleCompositeColor(pt.x, pt.y);
      if (activeTool === 'eyedropper') {
        setActiveTool('brush');
      }
      return;
    }

    if (activeTool === 'text') {
      setPendingText({
        canvasX: Math.max(0, Math.min(CANVAS_W - 40, pt.x)),
        canvasY: Math.max(20, Math.min(CANVAS_H - 10, pt.y)),
        screenX: e.clientX,
        screenY: e.clientY,
        value: '',
      });
      window.setTimeout(() => textInputRef.current?.focus(), 20);
      return;
    }

    if (activeTool === 'fill') {
      applyFloodFill(pt.x, pt.y, color, fillTolerance);
      return;
    }

    const activeMeta = layers.find((l) => l.id === activeLayerId);
    if (activeMeta && !activeMeta.visible) {
      setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, visible: true } : l)));
    }

    const lc = getOrCreateLayerCanvas(activeLayerId);
    const lctx = lc.getContext('2d', { willReadFrequently: true });
    if (!lctx) return;

    preStrokeSnapshotRef.current = lctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    isDrawingRef.current = true;
    activePointerIdRef.current = e.pointerId;

    if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'rect' || activeTool === 'ellipse') {
      shapeStartRef.current = pt;
      currentPointRef.current = pt;
    } else {
      strokePointsRef.current = [pt];
      drawFreehandSegment(lctx, pt, pt, activeTool);
      renderComposite();
    }
  };

  const handleStagePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && touchPointsRef.current.has(e.pointerId)) {
      touchPointsRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (touchPointsRef.current.size >= 2 && pinchStateRef.current && stageContainerRef.current) {
        const pts = Array.from(touchPointsRef.current.values());
        const dist = Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY);
        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;
        const p = pinchStateRef.current;
        const nextZoom = Math.max(0.15, Math.min(3.5, p.initialZoom * (dist / p.initialDist)));
        const rect = stageContainerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const relInitX = p.initialMidX - centerX;
        const relInitY = p.initialMidY - centerY;
        const relCurrX = midX - centerX;
        const relCurrY = midY - centerY;
        const nextPanX = relCurrX - ((relInitX - p.initialPanX) / p.initialZoom) * nextZoom;
        const nextPanY = relCurrY - ((relInitY - p.initialPanY) / p.initialZoom) * nextZoom;
        setZoom(nextZoom);
        setPan({ x: nextPanX, y: nextPanY });
        return;
      }
    }

    if (isPanningRef.current && panStartRef.current && activePointerIdRef.current === e.pointerId) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }

    const pt = clientToCanvasPoint(e.clientX, e.clientY);
    cursorCanvasPosRef.current = pt;

    if (!isDrawingRef.current) {
      if (e.pointerType !== 'touch') {
        drawCursorReticle(pt);
      } else {
        drawCursorReticle(null);
      }
      return;
    }

    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
      return;
    }

    if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'rect' || activeTool === 'ellipse') {
      currentPointRef.current = pt;
      const prev = previewCanvasRef.current;
      if (prev && shapeStartRef.current) {
        const pctx = prev.getContext('2d');
        if (pctx) {
          pctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
          renderShapeToContext(pctx, activeTool, shapeStartRef.current, pt, e.shiftKey);
        }
      }
      return;
    }

    const lc = getOrCreateLayerCanvas(activeLayerId);
    const lctx = lc.getContext('2d');
    if (!lctx) return;

    const pts = strokePointsRef.current;
    const prevPt = pts[pts.length - 1] || pt;
    pts.push(pt);

    drawFreehandSegment(lctx, prevPt, pt, activeTool);
    renderComposite();
  };

  const finishDrawingStroke = useCallback(
    (shiftKey: boolean, pointerId?: number) => {
      if (pointerId !== undefined && touchPointsRef.current.has(pointerId)) {
        touchPointsRef.current.delete(pointerId);
        if (touchPointsRef.current.size < 2) {
          pinchStateRef.current = null;
        }
      }

      if (pointerId !== undefined && activePointerIdRef.current !== null && pointerId !== activePointerIdRef.current) {
        return;
      }

      if (isPanningRef.current) {
        isPanningRef.current = false;
        panStartRef.current = null;
        activePointerIdRef.current = null;
      }

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      activePointerIdRef.current = null;

      if (
        (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'rect' || activeTool === 'ellipse') &&
        shapeStartRef.current &&
        currentPointRef.current
      ) {
        const lc = getOrCreateLayerCanvas(activeLayerId);
        const lctx = lc.getContext('2d');
        if (lctx) {
          renderShapeToContext(lctx, activeTool, shapeStartRef.current, currentPointRef.current, shiftKey);
        }
        const prev = previewCanvasRef.current;
        prev?.getContext('2d')?.clearRect(0, 0, CANVAS_W, CANVAS_H);
      }

      if (preStrokeSnapshotRef.current) {
        recordHistorySnapshot(activeLayerId, preStrokeSnapshotRef.current);
        preStrokeSnapshotRef.current = null;
      }

      strokePointsRef.current = [];
      shapeStartRef.current = null;
      currentPointRef.current = null;
      renderComposite();
    },
    [activeLayerId, activeTool, getOrCreateLayerCanvas, recordHistorySnapshot, renderComposite, renderShapeToContext]
  );

  useEffect(() => {
    const onGlobalUp = (ev: PointerEvent) => finishDrawingStroke(ev.shiftKey, ev.pointerId);
    const onGlobalCancel = (ev: PointerEvent) => finishDrawingStroke(ev.shiftKey, ev.pointerId);
    window.addEventListener('pointerup', onGlobalUp);
    window.addEventListener('pointercancel', onGlobalCancel);
    return () => {
      window.removeEventListener('pointerup', onGlobalUp);
      window.removeEventListener('pointercancel', onGlobalCancel);
    };
  }, [finishDrawingStroke]);

  // Commit pending typed text onto active layer
  const commitPendingText = useCallback(() => {
    if (!pendingText) return;
    const trimmed = pendingText.value.trim();
    if (trimmed) {
      const lc = getOrCreateLayerCanvas(activeLayerId);
      const lctx = lc.getContext('2d', { willReadFrequently: true });
      if (lctx) {
        const snap = lctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        recordHistorySnapshot(activeLayerId, snap);
        lctx.save();
        lctx.globalAlpha = Math.max(0.05, Math.min(1, brushOpacity / 100));
        lctx.fillStyle = color;
        lctx.font = `${textBold ? '700' : '500'} ${textFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
        lctx.textBaseline = 'top';
        lctx.fillText(trimmed, pendingText.canvasX, pendingText.canvasY);
        lctx.restore();
        renderComposite();
      }
    }
    setPendingText(null);
  }, [
    activeLayerId,
    brushOpacity,
    color,
    getOrCreateLayerCanvas,
    pendingText,
    recordHistorySnapshot,
    renderComposite,
    textBold,
    textFontSize,
  ]);

  // Keyboard shortcuts inside Sketch Studio (Undo, Redo, Space Pan, Brush Size [ / ])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape' && pendingText) {
          e.preventDefault();
          setPendingText(null);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleSketchUndo();
          return;
        }
        if (lower === 'y' || (lower === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleSketchRedo();
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      if (e.key === '[') {
        setBrushSize((s) => Math.max(1, s - 4));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(140, s + 4));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleSketchUndo, handleSketchRedo, onClose, pendingText]);

  // Wheel zoom on artboard stage
  const handleStageWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setZoom((z) => Math.max(0.15, Math.min(3.5, z * factor)));
  };

  // Layer utilities
  const handleAddLayer = () => {
    const newId = `layer-${Date.now()}`;
    getOrCreateLayerCanvas(newId);
    setLayers((prev) => [
      ...prev,
      { id: newId, name: t('sketch.newLayer', { num: prev.length + 1 }), visible: true, opacity: 1 },
    ]);
    setActiveLayerId(newId);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layers.length <= 1) return;
    delete layerCanvasMapRef.current[layerId];
    const remaining = layers.filter((l) => l.id !== layerId);
    setLayers(remaining);
    if (activeLayerId === layerId) {
      setActiveLayerId(remaining[remaining.length - 1].id);
    }
  };

  const handleClearActiveLayer = () => {
    const lc = getOrCreateLayerCanvas(activeLayerId);
    const lctx = lc.getContext('2d', { willReadFrequently: true });
    if (!lctx) return;
    recordHistorySnapshot(activeLayerId, lctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    lctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    renderComposite();
  };

  const handleFlipActiveLayerHorizontal = () => {
    const lc = getOrCreateLayerCanvas(activeLayerId);
    const lctx = lc.getContext('2d', { willReadFrequently: true });
    if (!lctx) return;
    recordHistorySnapshot(activeLayerId, lctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    const temp = document.createElement('canvas');
    temp.width = CANVAS_W;
    temp.height = CANVAS_H;
    temp.getContext('2d')?.drawImage(lc, 0, 0);
    lctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    lctx.save();
    lctx.translate(CANVAS_W, 0);
    lctx.scale(-1, 1);
    lctx.drawImage(temp, 0, 0);
    lctx.restore();
    renderComposite();
  };

  const handleImportExistingImage = async () => {
    if (!existingImageUrl || isImportingImage) return;
    setIsImportingImage(true);
    setSaveError(null);
    try {
      const res = await fetch(existingImageUrl);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(t('sketch.errDecode')));
        img.src = objUrl;
      });
      const lc = getOrCreateLayerCanvas(activeLayerId);
      const lctx = lc.getContext('2d', { willReadFrequently: true });
      if (lctx) {
        recordHistorySnapshot(activeLayerId, lctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
        const scale = Math.min(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const dx = (CANVAS_W - drawW) / 2;
        const dy = (CANVAS_H - drawH) / 2;
        lctx.drawImage(img, dx, dy, drawW, drawH);
        renderComposite();
      }
      URL.revokeObjectURL(objUrl);
    } catch {
      setSaveError(t('sketch.errLoadImage'));
    } finally {
      setIsImportingImage(false);
    }
  };

  // Composite exact 1920x1080 8-bit PNG blob
  const build8BitPngBlob = useCallback(async (): Promise<Blob> => {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = CANVAS_W;
    outCanvas.height = CANVAS_H;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) throw new Error(t('sketch.errCanvasUnavailable'));

    if (paperColor !== 'transparent') {
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    for (const layer of layers) {
      if (!layer.visible) continue;
      const lc = layerCanvasMapRef.current[layer.id];
      if (!lc) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
      ctx.drawImage(lc, 0, 0);
      ctx.restore();
    }

    return new Promise<Blob>((resolve, reject) => {
      outCanvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error(t('sketch.errEncodePng')));
        },
        'image/png'
      );
    });
  }, [layers, paperColor, t]);

  const handleDownloadLocalPng = async () => {
    try {
      const blob = await build8BitPngBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (nodeTitle || 'sketch').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.href = url;
      a.download = `${safeName}-1920x1080.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('sketch.errDownload'));
    }
  };

  const handleSaveToGalleryAndNode = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const blob = await build8BitPngBlob();
      const safeName = (nodeTitle || 'scene')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'sketch';
      const file = new File(
        [blob],
        `${safeName}-${targetKind === 'map' ? 'map-' : ''}sketch-${Date.now()}.png`,
        {
          type: 'image/png',
        }
      );
      await onSaveSketch(file);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('sketch.errSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const toolButtons: { id: SketchTool; label: string; icon: React.ReactNode }[] = [
    { id: 'pencil', label: t('sketch.toolPencil'), icon: <PenTool className="w-4 h-4" /> },
    { id: 'brush', label: t('sketch.toolBrush'), icon: <Brush className="w-4 h-4" /> },
    { id: 'calligraphy', label: t('sketch.toolCalligraphy'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'airbrush', label: t('sketch.toolAirbrush'), icon: <SprayCan className="w-4 h-4" /> },
    { id: 'highlighter', label: t('sketch.toolHighlighter'), icon: <Highlighter className="w-4 h-4" /> },
    { id: 'eraser', label: t('sketch.toolEraser'), icon: <Eraser className="w-4 h-4" /> },
    { id: 'fill', label: t('sketch.toolFill'), icon: <PaintBucket className="w-4 h-4" /> },
    { id: 'eyedropper', label: t('sketch.toolEyedropper'), icon: <Pipette className="w-4 h-4" /> },
    { id: 'line', label: t('sketch.toolLine'), icon: <Slash className="w-4 h-4" /> },
    { id: 'arrow', label: t('sketch.toolArrow'), icon: <ArrowUpRight className="w-4 h-4" /> },
    { id: 'rect', label: t('sketch.toolRect'), icon: <Square className="w-4 h-4" /> },
    { id: 'ellipse', label: t('sketch.toolEllipse'), icon: <Circle className="w-4 h-4" /> },
    { id: 'text', label: t('sketch.toolText'), icon: <Type className="w-4 h-4" /> },
    { id: 'pan', label: t('sketch.toolPan'), icon: <Hand className="w-4 h-4" /> },
  ];

  const isShapeTool = activeTool === 'rect' || activeTool === 'ellipse';
  const showSizeControl =
    activeTool !== 'fill' && activeTool !== 'eyedropper' && activeTool !== 'pan' && activeTool !== 'text';

  return (
    <div className="fixed inset-0 z-[70] bg-[#dcd7cc] dark:bg-[#0e1014] text-[#2b2924] dark:text-neutral-100 flex flex-col select-none">
      {/* Top Studio Header Bar */}
      <header className="h-12 px-2.5 sm:px-4 bg-[#ebe7de] dark:bg-[#15181e] border-b border-[#c3beb1] dark:border-neutral-800 flex items-center justify-between gap-2 sm:gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <span className="text-sm font-bold tracking-tight text-[#2b2924] dark:text-white whitespace-nowrap">
            {t('sketch.title')}
          </span>
          {targetKind === 'map' && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/18 dark:bg-amber-500/20 border border-amber-600/40 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-[11px] font-semibold whitespace-nowrap">
              {t('sketch.mapLibraryBadge')}
            </span>
          )}
          <span className="hidden md:inline text-[#8f897d] dark:text-neutral-600" aria-hidden="true">·</span>
          <span className="hidden md:inline text-xs text-[#3a362e] dark:text-neutral-300 truncate max-w-[160px] lg:max-w-[200px]">
            {nodeTitle || t('sketch.sceneDefault')}
          </span>
          <span className="hidden lg:inline text-[#8f897d] dark:text-neutral-600" aria-hidden="true">·</span>
          <span className="hidden lg:inline text-xs font-mono tabular-nums text-[#5c584e] dark:text-neutral-400 whitespace-nowrap">
            {t('sketch.resolutionMeta')}
          </span>
        </div>

        {/* Center Undo / Redo & Zoom Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-0.5 bg-[#dcd7cc] dark:bg-[#0e1014] border border-[#c3beb1] dark:border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={handleSketchUndo}
              disabled={undoCount === 0}
              className={`touch-target px-2 py-1 rounded-md flex items-center justify-center gap-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                undoCount > 0
                  ? 'text-[#2b2924] hover:bg-[#cfc9bc] dark:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer'
                  : 'text-[#9d9689] dark:text-neutral-600 cursor-not-allowed'
              }`}
              title={t('sketch.undoTitle')}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums text-[11px]">{undoCount}</span>
            </button>
            <button
              onClick={handleSketchRedo}
              disabled={redoCount === 0}
              className={`touch-target px-2 py-1 rounded-md flex items-center justify-center gap-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                redoCount > 0
                  ? 'text-[#2b2924] hover:bg-[#cfc9bc] dark:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer'
                  : 'text-[#9d9689] dark:text-neutral-600 cursor-not-allowed'
              }`}
              title={t('sketch.redoTitle')}
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums text-[11px]">{redoCount}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#dcd7cc] dark:bg-[#0e1014] border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-1.5 py-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.15, z - 0.15))}
              className="touch-target p-1 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer flex items-center justify-center"
              title={t('sketch.zoomOut')}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono tabular-nums text-[#2b2924] dark:text-neutral-300 w-11 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3.5, z + 0.15))}
              className="touch-target p-1 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer flex items-center justify-center"
              title={t('sketch.zoomIn')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitCanvasToViewport}
              className="touch-target px-1.5 py-0.5 text-[11px] font-medium text-[#3a362e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded cursor-pointer whitespace-nowrap"
              title={t('sketch.fitTitle')}
            >
              {t('sketch.fit')}
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="hidden sm:inline-flex touch-target items-center px-1.5 py-0.5 text-[11px] font-medium text-[#3a362e] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded cursor-pointer whitespace-nowrap"
              title={t('sketch.actualSizeTitle')}
            >
              100%
            </button>
          </div>
        </div>

        {/* Right Primary Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {existingImageUrl && (
            <button
              onClick={handleImportExistingImage}
              disabled={isImportingImage}
              className="touch-target px-2.5 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] border border-[#c3beb1] text-[#2b2924] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-700 dark:text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={targetKind === 'map' ? t('sketch.importMapTitle') : t('sketch.importNodeTitle')}
            >
              <ImagePlus className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span className="hidden sm:inline">
                {isImportingImage
                  ? t('common.loading')
                  : targetKind === 'map'
                  ? t('sketch.importMap')
                  : t('sketch.importNode')}
              </span>
            </button>
          )}

          <button
            onClick={handleDownloadLocalPng}
            className="touch-target px-2.5 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] border border-[#c3beb1] text-[#2b2924] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-700 dark:text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={t('sketch.exportPngTitle')}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('sketch.exportPng')}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="touch-target p-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] border border-[#c3beb1] text-[#3a362e] hover:text-[#1f1d18] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title={isFullscreen ? t('sketch.exitFullscreen') : t('sketch.enterFullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleSaveToGalleryAndNode}
            disabled={isSaving}
            title={targetKind === 'map' ? t('sketch.saveMapTitle') : t('sketch.saveNodeTitle')}
            className={`touch-target px-3 sm:px-3.5 py-1.5 rounded-lg disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              targetKind === 'map'
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {isSaving
                ? t('common.saving')
                : targetKind === 'map'
                ? t('sketch.saveMapLib')
                : t('sketch.saveApply')}
            </span>
          </button>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="touch-target p-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] text-[#5c584e] hover:text-[#1f1d18] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title={t('sketch.closeTitle')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Secondary Tool Options Bar */}
      <div className="h-10 px-4 bg-[#e3ded3] dark:bg-[#12151b] border-b border-[#c3beb1] dark:border-neutral-800/80 flex items-center justify-between gap-4 text-xs shrink-0 overflow-x-auto">
        <div className="flex items-center gap-4">
          {showSizeControl && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[#5c584e] dark:text-neutral-400">{t('sketch.size')}</span>
              <input
                type="range"
                min={1}
                max={140}
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                className="w-24 accent-blue-600 dark:accent-blue-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 w-10">{brushSize}px</span>
            </div>
          )}

          {activeTool !== 'eyedropper' && activeTool !== 'pan' && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[#5c584e] dark:text-neutral-400">{t('sketch.opacity')}</span>
              <input
                type="range"
                min={5}
                max={100}
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(parseInt(e.target.value, 10))}
                className="w-20 accent-blue-600 dark:accent-blue-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 w-9">{brushOpacity}%</span>
            </div>
          )}

          {(activeTool === 'brush' || activeTool === 'eraser') && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[#5c584e] dark:text-neutral-400">{t('sketch.hardness')}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={brushHardness}
                onChange={(e) => setBrushHardness(parseInt(e.target.value, 10))}
                className="w-20 accent-blue-600 dark:accent-blue-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 w-9">{brushHardness}%</span>
            </div>
          )}

          {activeTool === 'fill' && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[#5c584e] dark:text-neutral-400">{t('sketch.tolerance')}</span>
              <input
                type="range"
                min={0}
                max={80}
                value={fillTolerance}
                onChange={(e) => setFillTolerance(parseInt(e.target.value, 10))}
                className="w-24 accent-blue-600 dark:accent-blue-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 w-8">{fillTolerance}</span>
            </div>
          )}

          {isShapeTool && (
            <div className="flex items-center gap-1 bg-[#dcd7cc] dark:bg-[#0e1014] border border-[#c3beb1] dark:border-neutral-800 rounded-md p-0.5">
              {(['stroke', 'fill', 'both'] as ShapeFillMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setShapeFillMode(mode)}
                  className={`px-2 py-0.5 rounded text-[11px] cursor-pointer whitespace-nowrap ${
                    shapeFillMode === mode
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  {mode === 'stroke'
                    ? t('sketch.shapeStroke')
                    : mode === 'fill'
                    ? t('sketch.shapeFill')
                    : t('sketch.shapeBoth')}
                </button>
              ))}
            </div>
          )}

          {activeTool === 'text' && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[#5c584e] dark:text-neutral-400">{t('sketch.fontSize')}</span>
              <input
                type="range"
                min={16}
                max={140}
                value={textFontSize}
                onChange={(e) => setTextFontSize(parseInt(e.target.value, 10))}
                className="w-20 accent-blue-600 dark:accent-blue-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 w-10">{textFontSize}px</span>
              <button
                onClick={() => setTextBold((b) => !b)}
                className={`px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer ${
                  textBold
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#dcd7cc] border-[#c3beb1] text-[#5c584e] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400'
                }`}
              >
                B
              </button>
            </div>
          )}
        </div>

        {/* Symmetry, Guides & Layer Quick Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[#5c584e] dark:text-neutral-400">{t('sketch.symmetry')}</span>
            <select
              value={symmetry}
              onChange={(e) => setSymmetry(e.target.value as SymmetryMode)}
              className="bg-[#dcd7cc] dark:bg-[#0e1014] border border-[#c3beb1] dark:border-neutral-800 rounded px-2 py-0.5 text-xs text-[#2b2924] dark:text-neutral-200 outline-none focus:border-blue-500"
            >
              <option value="none" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.symNone')}</option>
              <option value="horizontal" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.symHorizontal')}</option>
              <option value="vertical" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.symVertical')}</option>
              <option value="quad" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.symQuad')}</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Grid className="w-3.5 h-3.5 text-[#5c584e] dark:text-neutral-400" />
            <select
              value={guideMode}
              onChange={(e) => setGuideMode(e.target.value as GuideMode)}
              className="bg-[#dcd7cc] dark:bg-[#0e1014] border border-[#c3beb1] dark:border-neutral-800 rounded px-2 py-0.5 text-xs text-[#2b2924] dark:text-neutral-200 outline-none focus:border-blue-500"
            >
              <option value="none" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.guideNone')}</option>
              <option value="thirds" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.guideThirds')}</option>
              <option value="cinema" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.guideCinema')}</option>
              <option value="grid" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('sketch.guideGrid')}</option>
            </select>
          </div>

          <button
            onClick={handleFlipActiveLayerHorizontal}
            className="px-2 py-1 rounded bg-[#dcd7cc] hover:bg-[#d2ccbf] border border-[#c3beb1] text-[#3a362e] hover:text-[#1f1d18] dark:bg-neutral-800/80 dark:hover:bg-neutral-700 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 whitespace-nowrap cursor-pointer"
            title={t('sketch.flipTitle')}
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
            <span>{t('sketch.flip')}</span>
          </button>

          <button
            onClick={handleClearActiveLayer}
            className="px-2 py-1 rounded bg-[#dcd7cc] hover:bg-red-600/15 border border-[#c3beb1] hover:border-red-600/50 text-[#3a362e] hover:text-red-800 dark:bg-neutral-800/80 dark:hover:bg-red-950/60 dark:border-neutral-700 dark:hover:border-red-700/60 dark:text-neutral-300 dark:hover:text-red-300 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            title={t('sketch.clearLayerTitle')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('sketch.clearLayer')}</span>
          </button>

          <button
            onClick={() => setLayersDrawerOpen((o) => !o)}
            className={`px-2 py-1 rounded border flex items-center gap-1 whitespace-nowrap cursor-pointer ${
              layersDrawerOpen
                ? 'bg-blue-600/15 border-blue-600/50 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500/60 dark:text-blue-300'
                : 'bg-[#dcd7cc] border-[#c3beb1] text-[#3a362e] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('sketch.studioPanel')}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Tool Dock */}
        <aside className="w-13 bg-[#ebe7de] dark:bg-[#15181e] border-r border-[#c3beb1] dark:border-neutral-800 py-2.5 px-1.5 flex flex-col items-center gap-1 overflow-y-auto shrink-0">
          {toolButtons.map((t) => {
            const active = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                title={t.label}
                className={`touch-target w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d8d3c8] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
                }`}
              >
                {t.icon}
              </button>
            );
          })}

          {/* Quick active color preview at bottom of left dock */}
          <div className="mt-auto pt-2 border-t border-[#d4cfc3] dark:border-neutral-800 flex flex-col items-center gap-1.5">
            <input
              type="color"
              value={color}
              onChange={(e) => rememberColor(e.target.value)}
              title={t('sketch.customColor')}
              className="w-9 h-9 rounded-lg border border-[#c3beb1] dark:border-neutral-700 bg-transparent cursor-pointer"
            />
          </div>
        </aside>

        {/* Center 1920x1080 Drawing Artboard Viewport */}
        <div
          ref={stageContainerRef}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerLeave={() => drawCursorReticle(null)}
          onAuxClick={(e) => {
            if (e.button === 1) e.preventDefault();
          }}
          onWheel={handleStageWheel}
          className={`touch-canvas flex-1 bg-[#c9c6bd] dark:bg-[#0b0d10] relative overflow-hidden flex items-center justify-center ${
            isSpacePressed || activeTool === 'pan'
              ? 'cursor-grab active:cursor-grabbing'
              : activeTool === 'text'
              ? 'cursor-text'
              : 'cursor-crosshair'
          }`}
        >
          {/* Artboard Frame */}
          <div
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            className="relative shadow-[0_24px_80px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-1 ring-black/15 dark:ring-white/15 shrink-0"
          >
            {/* Transparency checkerboard shown when background is transparent */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)',
                backgroundSize: '32px 32px',
                backgroundPosition: '0 0, 0 16px, 16px -16px, -16px 0px',
                backgroundColor: '#18181b',
              }}
            />

            {/* Composite Raster Canvas (exact 1920x1080) */}
            <canvas
              ref={displayCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="absolute inset-0 w-full h-full block"
            />

            {/* Shape Preview & Brush Cursor Canvas */}
            <canvas
              ref={previewCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="absolute inset-0 w-full h-full block pointer-events-none"
            />

            {/* Non-Exported Storyboard / Symmetry Guides */}
            <svg
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {guideMode === 'thirds' && (
                <g stroke="rgba(56, 189, 248, 0.42)" strokeWidth="2" strokeDasharray="8 8">
                  <line x1={CANVAS_W / 3} y1={0} x2={CANVAS_W / 3} y2={CANVAS_H} />
                  <line x1={(CANVAS_W * 2) / 3} y1={0} x2={(CANVAS_W * 2) / 3} y2={CANVAS_H} />
                  <line x1={0} y1={CANVAS_H / 3} x2={CANVAS_W} y2={CANVAS_H / 3} />
                  <line x1={0} y1={(CANVAS_H * 2) / 3} x2={CANVAS_W} y2={(CANVAS_H * 2) / 3} />
                </g>
              )}

              {guideMode === 'cinema' && (
                <g stroke="rgba(250, 204, 21, 0.45)" strokeWidth="2" fill="none">
                  <rect x={96} y={54} width={CANVAS_W - 192} height={CANVAS_H - 108} strokeDasharray="10 8" />
                  <rect x={192} y={108} width={CANVAS_W - 384} height={CANVAS_H - 216} />
                  <line x1={CANVAS_W / 2 - 40} y1={CANVAS_H / 2} x2={CANVAS_W / 2 + 40} y2={CANVAS_H / 2} />
                  <line x1={CANVAS_W / 2} y1={CANVAS_H / 2 - 40} x2={CANVAS_W / 2} y2={CANVAS_H / 2 + 40} />
                </g>
              )}

              {guideMode === 'grid' && (
                <g stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1.5">
                  {Array.from({ length: Math.floor(CANVAS_W / 120) - 1 }).map((_, idx) => (
                    <line key={`vx-${idx}`} x1={(idx + 1) * 120} y1={0} x2={(idx + 1) * 120} y2={CANVAS_H} />
                  ))}
                  {Array.from({ length: Math.floor(CANVAS_H / 120) - 1 }).map((_, idx) => (
                    <line key={`hy-${idx}`} x1={0} y1={(idx + 1) * 120} x2={CANVAS_W} y2={(idx + 1) * 120} />
                  ))}
                </g>
              )}

              {(symmetry === 'horizontal' || symmetry === 'quad') && (
                <line
                  x1={CANVAS_W / 2}
                  y1={0}
                  x2={CANVAS_W / 2}
                  y2={CANVAS_H}
                  stroke="rgba(168, 85, 247, 0.55)"
                  strokeWidth="2.5"
                  strokeDasharray="10 6"
                />
              )}
              {(symmetry === 'vertical' || symmetry === 'quad') && (
                <line
                  x1={0}
                  y1={CANVAS_H / 2}
                  x2={CANVAS_W}
                  y2={CANVAS_H / 2}
                  stroke="rgba(168, 85, 247, 0.55)"
                  strokeWidth="2.5"
                  strokeDasharray="10 6"
                />
              )}
            </svg>
          </div>

          {/* Inline Text Placement Input */}
          {pendingText && (
            <div
              style={{ left: pendingText.screenX, top: pendingText.screenY }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed z-50 bg-[#ebe7de] dark:bg-neutral-900 border border-blue-600 dark:border-blue-500 rounded-lg p-1.5 shadow-2xl flex items-center gap-1.5"
            >
              <input
                ref={textInputRef}
                type="text"
                value={pendingText.value}
                onChange={(e) => setPendingText({ ...pendingText, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPendingText();
                  if (e.key === 'Escape') setPendingText(null);
                }}
                placeholder={t('sketch.textPlaceholder')}
                className="bg-[#e0dbd0] dark:bg-neutral-950 text-xs text-[#2b2924] dark:text-white px-2 py-1 rounded border border-[#c3beb1] dark:border-neutral-700 outline-none w-52"
              />
              <button
                onClick={commitPendingText}
                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
              >
                {t('sketch.place')}
              </button>
              <button
                onClick={() => setPendingText(null)}
                className="p-1 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {saveError && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#ebe7de] dark:bg-red-950/95 border border-red-600/50 dark:border-red-700/70 text-red-800 dark:text-red-200 text-xs px-4 py-2 rounded-lg shadow-xl flex items-center gap-3">
              <span>{saveError}</span>
              <button onClick={() => setSaveError(null)} className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right Color & Layers Studio Panel */}
        {layersDrawerOpen && (
          <aside className="w-64 max-w-[78vw] bg-[#ebe7de] dark:bg-[#15181e] border-l border-[#c3beb1] dark:border-neutral-800 p-3 flex flex-col gap-4 overflow-y-auto shrink-0 text-xs absolute md:relative right-0 top-0 bottom-0 z-30 shadow-2xl md:shadow-none">
            {/* Color Palette */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2b2924] dark:text-neutral-200">{t('sketch.colorPalette')}</span>
                <span className="font-mono text-[11px] text-[#5c584e] dark:text-neutral-400 uppercase">{color}</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {SWATCH_COLORS.map((swatch) => {
                  const isActive = color.toLowerCase() === swatch.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      onClick={() => rememberColor(swatch)}
                      style={{ backgroundColor: swatch }}
                      className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                        isActive ? 'border-[#2b2924] dark:border-white ring-2 ring-blue-500 scale-110' : 'border-[#b5afa2] dark:border-neutral-700 hover:scale-105'
                      }`}
                      title={swatch}
                    />
                  );
                })}
              </div>

              {recentColors.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[11px] text-[#5c584e] dark:text-neutral-500 block">{t('sketch.recent')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentColors.map((rc) => (
                      <button
                        key={rc}
                        onClick={() => setColor(rc)}
                        style={{ backgroundColor: rc }}
                        className={`w-5 h-5 rounded border cursor-pointer ${
                          color.toLowerCase() === rc.toLowerCase()
                            ? 'border-[#2b2924] dark:border-white ring-1 ring-blue-500'
                            : 'border-[#b5afa2] dark:border-neutral-700'
                        }`}
                        title={rc}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-[#d4cfc3] dark:bg-neutral-800" />

            {/* Paper / Background Color */}
            <div className="space-y-1.5">
              <span className="font-semibold text-[#2b2924] dark:text-neutral-200 block">{t('sketch.canvasBg')}</span>
              <div className="grid grid-cols-5 gap-1.5">
                {paperPresets.map((preset) => {
                  const selected = paperColor === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => setPaperColor(preset.value)}
                      title={preset.label}
                      style={{
                        backgroundColor: preset.value === 'transparent' ? '#18181b' : preset.value,
                        backgroundImage:
                          preset.value === 'transparent'
                            ? 'linear-gradient(45deg, #3f3f46 25%, transparent 25%), linear-gradient(-45deg, #3f3f46 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3f3f46 75%), linear-gradient(-45deg, transparent 75%, #3f3f46 75%)'
                            : undefined,
                        backgroundSize: preset.value === 'transparent' ? '8px 8px' : undefined,
                      }}
                      className={`h-6 rounded-md border cursor-pointer transition-transform ${
                        selected ? 'border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/70 scale-105' : 'border-[#b5afa2] dark:border-neutral-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[#d4cfc3] dark:bg-neutral-800" />

            {/* Layers Stack */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2b2924] dark:text-neutral-200">{t('sketch.layers')}</span>
                <button
                  onClick={handleAddLayer}
                  className="px-2 py-0.5 rounded bg-[#dcd7cc] hover:bg-[#d2ccbf] border border-[#c3beb1] text-[#2b2924] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-700 dark:text-neutral-200 flex items-center gap-1 cursor-pointer"
                  title={t('sketch.addLayerTitle')}
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('common.add')}</span>
                </button>
              </div>

              <div className="space-y-1.5 overflow-y-auto pr-0.5">
                {[...layers].reverse().map((layer) => {
                  const isActive = layer.id === activeLayerId;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setActiveLayerId(layer.id)}
                      className={`p-2 rounded-lg border transition-colors cursor-pointer space-y-1.5 ${
                        isActive
                          ? 'bg-blue-600/12 border-blue-600/55 dark:bg-blue-600/15 dark:border-blue-500/60'
                          : 'bg-[#e0dbd0] border-[#c8c3b6] hover:border-[#8f897d] dark:bg-[#0e1014] dark:border-neutral-800 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLayers((prev) =>
                              prev.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l))
                            );
                          }}
                          className="p-0.5 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
                          title={layer.visible ? t('sketch.hideLayer') : t('sketch.showLayer')}
                        >
                          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[#9d9689] dark:text-neutral-600" />}
                        </button>

                        <span className="flex-1 truncate font-medium text-[#2b2924] dark:text-neutral-200">{layer.name}</span>

                        {layers.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLayer(layer.id);
                            }}
                            className="p-0.5 text-[#5c584e] hover:text-red-700 dark:text-neutral-500 dark:hover:text-red-400 cursor-pointer"
                            title={t('sketch.deleteLayer')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-[#5c584e] dark:text-neutral-500">{t('sketch.opacity')}</span>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={Math.round(layer.opacity * 100)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) / 100;
                            setLayers((prev) =>
                              prev.map((l) => (l.id === layer.id ? { ...l, opacity: val } : l))
                            );
                          }}
                          className="flex-1 accent-blue-600 dark:accent-blue-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono tabular-nums text-[#5c584e] dark:text-neutral-400 w-7 text-right">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
