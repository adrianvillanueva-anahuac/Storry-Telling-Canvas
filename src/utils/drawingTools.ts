import { DrawingElement } from '../types/workflow';

export type DrawingToolType =
  | 'none'
  | 'pencil'
  | 'highlighter'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'measure'
  | 'figure'
  | 'eraser';

export interface SvgPoint {
  x: number;
  y: number;
}

export const buildFreehandPath = (points: SvgPoint[]): string => {
  if (points.length === 0) return '';
  if (points.length > 2) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 2; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
    }
    d += ` Q ${points[points.length - 2].x} ${points[points.length - 2].y}, ${
      points[points.length - 1].x
    } ${points[points.length - 1].y}`;
    return d;
  }
  const end = points[points.length - 1];
  const dx = Math.abs(end.x - points[0].x);
  const dy = Math.abs(end.y - points[0].y);
  if (dx < 0.5 && dy < 0.5) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 1} ${points[0].y + 1}`;
  }
  return `M ${points[0].x} ${points[0].y} L ${end.x} ${end.y}`;
};

export const buildLinePath = (p1: SvgPoint, p2: SvgPoint): string => {
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
};

export const buildArrowPath = (p1: SvgPoint, p2: SvgPoint, baseHeadSize: number): string => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return buildLinePath(p1, p2);

  const ux = dx / len;
  const uy = dy / len;
  const headLen = Math.min(len * 0.4, Math.max(baseHeadSize, Math.min(baseHeadSize * 2.4, len * 0.22)));
  const headWidth = headLen * 0.58;

  const bx = p2.x - ux * headLen;
  const by = p2.y - uy * headLen;
  const px = -uy * headWidth;
  const py = ux * headWidth;

  const wing1x = bx + px;
  const wing1y = by + py;
  const wing2x = bx - px;
  const wing2y = by - py;

  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} M ${wing1x} ${wing1y} L ${p2.x} ${p2.y} L ${wing2x} ${wing2y}`;
};

export const buildRectPath = (p1: SvgPoint, p2: SvgPoint): string => {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;
};

export const buildEllipsePath = (p1: SvgPoint, p2: SvgPoint): string => {
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const rx = Math.max(1, Math.abs(p2.x - p1.x) / 2);
  const ry = Math.max(1, Math.abs(p2.y - p1.y) / 2);
  const k = 0.5522847498;
  const kx = rx * k;
  const ky = ry * k;

  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry}, ${cx + rx} ${cy - ky}, ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky}, ${cx + kx} ${cy + ry}, ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry}, ${cx - rx} ${cy + ky}, ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky}, ${cx - kx} ${cy - ry}, ${cx} ${cy - ry}`,
    'Z',
  ].join(' ');
};

export const buildMeasureData = (
  p1: SvgPoint,
  p2: SvgPoint,
  vbWidth: number,
  vbHeight: number,
  tickHalfLen: number
): {
  d: string;
  measureLabel: string;
  measurePoints: { x1: number; y1: number; x2: number; y2: number };
} => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  const diag = Math.max(1, Math.hypot(vbWidth, vbHeight));
  const pctDiag = (dist / diag) * 100;

  let ux = 1;
  let uy = 0;
  if (dist > 0.001) {
    ux = dx / dist;
    uy = dy / dist;
  }
  const nx = -uy * tickHalfLen;
  const ny = ux * tickHalfLen;

  const d = [
    `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
    `M ${p1.x - nx} ${p1.y - ny} L ${p1.x + nx} ${p1.y + ny}`,
    `M ${p2.x - nx} ${p2.y - ny} L ${p2.x + nx} ${p2.y + ny}`,
  ].join(' ');

  return {
    d,
    measureLabel: `${Math.round(dist)} px · ${pctDiag.toFixed(1)}%`,
    measurePoints: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
  };
};

export const getMeasurePointsFromDrawing = (
  draw: DrawingElement
): { x1: number; y1: number; x2: number; y2: number } | null => {
  if (draw.measurePoints) return draw.measurePoints;
  const matches = draw.d.match(/[-+]?(?:\d*\.\d+|\d+)/g);
  if (!matches || matches.length < 4) return null;
  const x1 = parseFloat(matches[0]);
  const y1 = parseFloat(matches[1]);
  const x2 = parseFloat(matches[2]);
  const y2 = parseFloat(matches[3]);
  if ([x1, y1, x2, y2].some((v) => isNaN(v))) return null;
  return { x1, y1, x2, y2 };
};

export const buildPreviewPathForTool = (
  tool: DrawingToolType,
  points: SvgPoint[],
  dragStart: SvgPoint | null,
  dragCurrent: SvgPoint | null,
  vbWidth: number,
  vbHeight: number,
  svgUnit: number
): string => {
  if (tool === 'pencil' || tool === 'highlighter') {
    return buildFreehandPath(points);
  }
  if (!dragStart || !dragCurrent) return '';
  if (tool === 'line') return buildLinePath(dragStart, dragCurrent);
  if (tool === 'arrow') return buildArrowPath(dragStart, dragCurrent, 16 * svgUnit);
  if (tool === 'rect') return buildRectPath(dragStart, dragCurrent);
  if (tool === 'ellipse') return buildEllipsePath(dragStart, dragCurrent);
  if (tool === 'measure') {
    return buildMeasureData(dragStart, dragCurrent, vbWidth, vbHeight, 10 * svgUnit).d;
  }
  return '';
};
