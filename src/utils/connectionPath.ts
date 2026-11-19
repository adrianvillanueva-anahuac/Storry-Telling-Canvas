import { WorkflowNode } from '../types/workflow';

export interface ConnectionPathOptions {
  angleOffset?: number;
  cornerRadius?: number;
  curveOffset?: { x: number; y: number };
}

export interface ConnectionPathHandle {
  x: number;
  y: number;
  axis: 'x' | 'y' | 'xy';
  baseX: number;
  baseY: number;
  spanStart: number;
  spanEnd: number;
  extraTargets: number[];
}

export interface ConnectionPathResult {
  d: string;
  labelX: number;
  labelY: number;
  handle: ConnectionPathHandle;
}

export type PortSide = 'top' | 'bottom' | 'left' | 'right';

export const NODE_CARD_WIDTH = 220;
// Exact WorkflowNodeCard rendered height (border 2 + header 37 + padding 20 + aspect-video 112)
export const NODE_CARD_HEIGHT = 171;
export const AUTO_CREATE_MIN_DRAG_DISTANCE = 28;

export function getOppositePort(port: PortSide): PortSide {
  if (port === 'left') return 'right';
  if (port === 'right') return 'left';
  if (port === 'top') return 'bottom';
  return 'top';
}

export function resolveAutoTargetPort(
  sourcePort: PortSide,
  startX: number,
  startY: number,
  dropX: number,
  dropY: number
): PortSide {
  const dx = dropX - startX;
  const dy = dropY - startY;
  if (Math.hypot(dx, dy) < 32) {
    return getOppositePort(sourcePort);
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'left' : 'right';
  }
  return dy >= 0 ? 'top' : 'bottom';
}

export function getNodeTopLeftForPortDrop(
  dropX: number,
  dropY: number,
  targetPort: PortSide
): { x: number; y: number } {
  if (targetPort === 'left') {
    return { x: Math.round(dropX), y: Math.round(dropY - NODE_CARD_HEIGHT / 2) };
  }
  if (targetPort === 'right') {
    return { x: Math.round(dropX - NODE_CARD_WIDTH), y: Math.round(dropY - NODE_CARD_HEIGHT / 2) };
  }
  if (targetPort === 'top') {
    return { x: Math.round(dropX - NODE_CARD_WIDTH / 2), y: Math.round(dropY) };
  }
  return { x: Math.round(dropX - NODE_CARD_WIDTH / 2), y: Math.round(dropY - NODE_CARD_HEIGHT) };
}

export function isPointInsideNodeCard(
  node: WorkflowNode | undefined,
  canvasX: number,
  canvasY: number,
  padding = 0
): boolean {
  if (!node) return false;
  const nx = parseFloat(node.x) || 0;
  const ny = parseFloat(node.y) || 0;
  return (
    canvasX >= nx - padding &&
    canvasX <= nx + NODE_CARD_WIDTH + padding &&
    canvasY >= ny - padding &&
    canvasY <= ny + NODE_CARD_HEIGHT + padding
  );
}

export function getNodePortCoords(
  nodes: Record<string, WorkflowNode>,
  nodeId: string,
  port: PortSide
): { x: number; y: number } | null {
  const node = nodes[nodeId];
  if (!node) return null;

  const x = parseFloat(node.x) || 0;
  const y = parseFloat(node.y) || 0;
  const w = NODE_CARD_WIDTH;
  const h = NODE_CARD_HEIGHT;

  if (port === 'left') return { x, y: y + h / 2 };
  if (port === 'right') return { x: x + w, y: y + h / 2 };
  if (port === 'top') return { x: x + w / 2, y };
  return { x: x + w / 2, y: y + h };
}

function getPortNormal(port: string): { nx: number; ny: number } {
  if (port === 'left') return { nx: -1, ny: 0 };
  if (port === 'right') return { nx: 1, ny: 0 };
  if (port === 'top') return { nx: 0, ny: -1 };
  return { nx: 0, ny: 1 };
}

function applyParallelOffset(
  basePts: { x: number; y: number }[],
  parallelOffset: number
): { x: number; y: number }[] {
  if (parallelOffset === 0 || basePts.length < 2) return basePts;

  const segNormals: { nx: number; ny: number }[] = [];
  for (let i = 0; i < basePts.length - 1; i++) {
    const dx = basePts[i + 1].x - basePts[i].x;
    const dy = basePts[i + 1].y - basePts[i].y;
    const len = Math.hypot(dx, dy) || 1;
    segNormals.push({ nx: -dy / len, ny: dx / len });
  }

  return basePts.map((pt, i) => {
    if (i === 0) {
      return {
        x: pt.x + segNormals[0].nx * parallelOffset,
        y: pt.y + segNormals[0].ny * parallelOffset,
      };
    }
    if (i === basePts.length - 1) {
      const lastN = segNormals[segNormals.length - 1];
      return {
        x: pt.x + lastN.nx * parallelOffset,
        y: pt.y + lastN.ny * parallelOffset,
      };
    }
    const n1 = segNormals[i - 1];
    const n2 = segNormals[i];
    const dot = n1.nx * n2.nx + n1.ny * n2.ny;
    const denom = 1 + dot;
    if (denom > 0.05) {
      const scale = parallelOffset / denom;
      return {
        x: pt.x + (n1.nx + n2.nx) * scale,
        y: pt.y + (n1.ny + n2.ny) * scale,
      };
    }
    return {
      x: pt.x + n1.nx * parallelOffset,
      y: pt.y + n1.ny * parallelOffset,
    };
  });
}

function buildRoundedPolylinePath(
  pts: { x: number; y: number }[],
  cornerRadius: number
): { d: string; labelX: number; labelY: number } {
  const clampedRadius = Math.max(0, Math.min(32, cornerRadius));
  const cmds: string[] = [`M ${pts[0].x} ${pts[0].y}`];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y);

    const r = Math.min(clampedRadius, len1 / 2, len2 / 2);
    if (r < 0.5 || len1 < 0.5 || len2 < 0.5) {
      cmds.push(`L ${curr.x} ${curr.y}`);
      continue;
    }

    const ex = curr.x - (v1x / len1) * r;
    const ey = curr.y - (v1y / len1) * r;
    const fx = curr.x + (v2x / len2) * r;
    const fy = curr.y + (v2y / len2) * r;

    cmds.push(`L ${ex} ${ey} Q ${curr.x} ${curr.y}, ${fx} ${fy}`);
  }

  const last = pts[pts.length - 1];
  cmds.push(`L ${last.x} ${last.y}`);

  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(segLen);
    totalLen += segLen;
  }

  let labelX = (pts[0].x + last.x) / 2;
  let labelY = (pts[0].y + last.y) / 2;
  let remaining = totalLen / 2;
  for (let i = 0; i < segLens.length; i++) {
    if (remaining <= segLens[i] && segLens[i] > 0) {
      const t = remaining / segLens[i];
      labelX = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
      labelY = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
      break;
    }
    remaining -= segLens[i];
  }

  return { d: cmds.join(' '), labelX, labelY };
}

function buildRoundedAngleData(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sourcePort: string,
  targetPort: string,
  parallelOffset = 0,
  options?: ConnectionPathOptions
): ConnectionPathResult {
  const { nx: nx1, ny: ny1 } = getPortNormal(sourcePort);
  const { nx: nx2, ny: ny2 } = getPortNormal(targetPort);
  const stub = 24;
  const angleOffset = options?.angleOffset ?? 0;
  const cornerRadius = options?.cornerRadius ?? 10;

  const p0 = { x: x1, y: y1 };
  const p1 = { x: x1 + nx1 * stub, y: y1 + ny1 * stub };
  const pEndMinus1 = { x: x2 + nx2 * stub, y: y2 + ny2 * stub };
  const pLast = { x: x2, y: y2 };

  let rawPts: { x: number; y: number }[] = [];
  let handle: ConnectionPathHandle;

  const srcHoriz = nx1 !== 0;
  const tgtHoriz = nx2 !== 0;
  const xExtra = [p0.x, p1.x, pEndMinus1.x, pLast.x];
  const yExtra = [p0.y, p1.y, pEndMinus1.y, pLast.y];

  if (srcHoriz && tgtHoriz) {
    const forwardOpposite =
      (nx1 === 1 && nx2 === -1 && p1.x <= pEndMinus1.x) ||
      (nx1 === -1 && nx2 === 1 && p1.x >= pEndMinus1.x);

    if (forwardOpposite) {
      const baseMidX = (p1.x + pEndMinus1.x) / 2;
      const midX = baseMidX + angleOffset;
      rawPts = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pEndMinus1.y }, pEndMinus1, pLast];
      handle = {
        x: midX,
        y: (p1.y + pEndMinus1.y) / 2,
        axis: 'x',
        baseX: baseMidX,
        baseY: (p1.y + pEndMinus1.y) / 2,
        spanStart: Math.min(p1.y, pEndMinus1.y),
        spanEnd: Math.max(p1.y, pEndMinus1.y),
        extraTargets: xExtra,
      };
    } else {
      const dy = Math.abs(y1 - y2);
      const baseDetourY = dy > 190 ? (y1 + y2) / 2 : Math.min(y1, y2) - 110;
      const detourY = baseDetourY + angleOffset;
      rawPts = [p0, p1, { x: p1.x, y: detourY }, { x: pEndMinus1.x, y: detourY }, pEndMinus1, pLast];
      handle = {
        x: (p1.x + pEndMinus1.x) / 2,
        y: detourY,
        axis: 'y',
        baseX: (p1.x + pEndMinus1.x) / 2,
        baseY: baseDetourY,
        spanStart: Math.min(p1.x, pEndMinus1.x),
        spanEnd: Math.max(p1.x, pEndMinus1.x),
        extraTargets: yExtra,
      };
    }
  } else if (!srcHoriz && !tgtHoriz) {
    const forwardOpposite =
      (ny1 === 1 && ny2 === -1 && p1.y <= pEndMinus1.y) ||
      (ny1 === -1 && ny2 === 1 && p1.y >= pEndMinus1.y);

    if (forwardOpposite) {
      const baseMidY = (p1.y + pEndMinus1.y) / 2;
      const midY = baseMidY + angleOffset;
      rawPts = [p0, p1, { x: p1.x, y: midY }, { x: pEndMinus1.x, y: midY }, pEndMinus1, pLast];
      handle = {
        x: (p1.x + pEndMinus1.x) / 2,
        y: midY,
        axis: 'y',
        baseX: (p1.x + pEndMinus1.x) / 2,
        baseY: baseMidY,
        spanStart: Math.min(p1.x, pEndMinus1.x),
        spanEnd: Math.max(p1.x, pEndMinus1.x),
        extraTargets: yExtra,
      };
    } else {
      const dx = Math.abs(x1 - x2);
      const baseDetourX =
        dx > 240
          ? (x1 + x2) / 2
          : x2 >= x1
          ? Math.min(x1, x2) - 135
          : Math.max(x1, x2) + 135;
      const detourX = baseDetourX + angleOffset;
      rawPts = [p0, p1, { x: detourX, y: p1.y }, { x: detourX, y: pEndMinus1.y }, pEndMinus1, pLast];
      handle = {
        x: detourX,
        y: (p1.y + pEndMinus1.y) / 2,
        axis: 'x',
        baseX: baseDetourX,
        baseY: (p1.y + pEndMinus1.y) / 2,
        spanStart: Math.min(p1.y, pEndMinus1.y),
        spanEnd: Math.max(p1.y, pEndMinus1.y),
        extraTargets: xExtra,
      };
    }
  } else if (srcHoriz && !tgtHoriz) {
    const xOk = (pEndMinus1.x - p1.x) * nx1 >= 0;
    const yOk = (pEndMinus1.y - p1.y) * ny2 <= 0;

    if (xOk && yOk) {
      const baseMidX = pEndMinus1.x;
      const midX = baseMidX + angleOffset;
      rawPts = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pEndMinus1.y }, pEndMinus1, pLast];
      handle = {
        x: midX,
        y: (p1.y + pEndMinus1.y) / 2,
        axis: 'x',
        baseX: baseMidX,
        baseY: (p1.y + pEndMinus1.y) / 2,
        spanStart: Math.min(p1.y, pEndMinus1.y),
        spanEnd: Math.max(p1.y, pEndMinus1.y),
        extraTargets: xExtra,
      };
    } else if (xOk) {
      const baseMidX = (p1.x + pEndMinus1.x) / 2;
      const midX = baseMidX + angleOffset;
      rawPts = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pEndMinus1.y }, pEndMinus1, pLast];
      handle = {
        x: midX,
        y: (p1.y + pEndMinus1.y) / 2,
        axis: 'x',
        baseX: baseMidX,
        baseY: (p1.y + pEndMinus1.y) / 2,
        spanStart: Math.min(p1.y, pEndMinus1.y),
        spanEnd: Math.max(p1.y, pEndMinus1.y),
        extraTargets: xExtra,
      };
    } else {
      const baseMidY =
        Math.abs(p1.y - pEndMinus1.y) > 40 ? (p1.y + pEndMinus1.y) / 2 : Math.min(p1.y, pEndMinus1.y) - 90;
      const midY = baseMidY + angleOffset;
      rawPts = [p0, p1, { x: p1.x, y: midY }, { x: pEndMinus1.x, y: midY }, pEndMinus1, pLast];
      handle = {
        x: (p1.x + pEndMinus1.x) / 2,
        y: midY,
        axis: 'y',
        baseX: (p1.x + pEndMinus1.x) / 2,
        baseY: baseMidY,
        spanStart: Math.min(p1.x, pEndMinus1.x),
        spanEnd: Math.max(p1.x, pEndMinus1.x),
        extraTargets: yExtra,
      };
    }
  } else {
    const yOk = (pEndMinus1.y - p1.y) * ny1 >= 0;
    const xOk = (pEndMinus1.x - p1.x) * nx2 <= 0;

    if (yOk && xOk) {
      const baseMidY = pEndMinus1.y;
      const midY = baseMidY + angleOffset;
      rawPts = [p0, p1, { x: p1.x, y: midY }, { x: pEndMinus1.x, y: midY }, pEndMinus1, pLast];
      handle = {
        x: (p1.x + pEndMinus1.x) / 2,
        y: midY,
        axis: 'y',
        baseX: (p1.x + pEndMinus1.x) / 2,
        baseY: baseMidY,
        spanStart: Math.min(p1.x, pEndMinus1.x),
        spanEnd: Math.max(p1.x, pEndMinus1.x),
        extraTargets: yExtra,
      };
    } else if (yOk) {
      const baseMidY = (p1.y + pEndMinus1.y) / 2;
      const midY = baseMidY + angleOffset;
      rawPts = [p0, p1, { x: p1.x, y: midY }, { x: pEndMinus1.x, y: midY }, pEndMinus1, pLast];
      handle = {
        x: (p1.x + pEndMinus1.x) / 2,
        y: midY,
        axis: 'y',
        baseX: (p1.x + pEndMinus1.x) / 2,
        baseY: baseMidY,
        spanStart: Math.min(p1.x, pEndMinus1.x),
        spanEnd: Math.max(p1.x, pEndMinus1.x),
        extraTargets: yExtra,
      };
    } else {
      const baseMidX =
        Math.abs(p1.x - pEndMinus1.x) > 40 ? (p1.x + pEndMinus1.x) / 2 : Math.max(p1.x, pEndMinus1.x) + 120;
      const midX = baseMidX + angleOffset;
      rawPts = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pEndMinus1.y }, pEndMinus1, pLast];
      handle = {
        x: midX,
        y: (p1.y + pEndMinus1.y) / 2,
        axis: 'x',
        baseX: baseMidX,
        baseY: (p1.y + pEndMinus1.y) / 2,
        spanStart: Math.min(p1.y, pEndMinus1.y),
        spanEnd: Math.max(p1.y, pEndMinus1.y),
        extraTargets: xExtra,
      };
    }
  }

  const deduped: { x: number; y: number }[] = [];
  for (const pt of rawPts) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.5) {
      deduped.push(pt);
    }
  }

  const basePts: { x: number; y: number }[] = [];
  for (let i = 0; i < deduped.length; i++) {
    const prev = basePts[basePts.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];
    if (prev && next) {
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const sameHoriz = Math.abs(dy1) < 0.5 && Math.abs(dy2) < 0.5 && dx1 * dx2 > 0;
      const sameVert = Math.abs(dx1) < 0.5 && Math.abs(dx2) < 0.5 && dy1 * dy2 > 0;
      if (sameHoriz || sameVert) {
        continue;
      }
    }
    basePts.push(curr);
  }

  if (basePts.length < 2) {
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2,
      handle,
    };
  }

  const pts = applyParallelOffset(basePts, parallelOffset);
  const { d, labelX, labelY } = buildRoundedPolylinePath(pts, cornerRadius);
  return { d, labelX, labelY, handle };
}

export function calculateConnectionPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sourcePort: string,
  targetPort: string,
  type: 'curve' | 'angle' | 'straight' = 'angle',
  parallelOffset = 0,
  options?: ConnectionPathOptions
): ConnectionPathResult {
  if (type === 'straight') {
    const baseMidX = (x1 + x2) / 2;
    const baseMidY = (y1 + y2) / 2;
    const ox = options?.curveOffset?.x ?? 0;
    const oy = options?.curveOffset?.y ?? 0;
    const hasBend = Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5;
    const handle: ConnectionPathHandle = {
      x: baseMidX + ox,
      y: baseMidY + oy,
      axis: 'xy',
      baseX: baseMidX,
      baseY: baseMidY,
      spanStart: Math.min(x1, x2, y1, y2),
      spanEnd: Math.max(x1, x2, y1, y2),
      extraTargets: [x1, x2, y1, y2],
    };

    if (hasBend) {
      const basePts = [
        { x: x1, y: y1 },
        { x: baseMidX + ox, y: baseMidY + oy },
        { x: x2, y: y2 },
      ];
      const pts = applyParallelOffset(basePts, parallelOffset);
      const { d, labelX, labelY } = buildRoundedPolylinePath(pts, options?.cornerRadius ?? 0);
      return { d, labelX, labelY, handle };
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const ox1 = x1 + nx * parallelOffset;
    const oy1 = y1 + ny * parallelOffset;
    const ox2 = x2 + nx * parallelOffset;
    const oy2 = y2 + ny * parallelOffset;
    return {
      d: `M ${ox1} ${oy1} L ${ox2} ${oy2}`,
      labelX: (ox1 + ox2) / 2,
      labelY: (oy1 + oy2) / 2,
      handle,
    };
  }

  if (type === 'angle') {
    return buildRoundedAngleData(x1, y1, x2, y2, sourcePort, targetPort, parallelOffset, options);
  }

  const offsetX = Math.max(Math.abs(x2 - x1) * 0.5, 30);
  const offsetY = Math.max(Math.abs(y2 - y1) * 0.5, 30);

  let c1x = x1;
  let c1y = y1;
  let c2x = x2;
  let c2y = y2;

  if (sourcePort === 'left') c1x -= offsetX;
  else if (sourcePort === 'right') c1x += offsetX;
  else if (sourcePort === 'top') c1y -= offsetY;
  else c1y += offsetY;

  if (targetPort === 'left') c2x -= offsetX;
  else if (targetPort === 'right') c2x += offsetX;
  else if (targetPort === 'top') c2y -= offsetY;
  else c2y += offsetY;

  const baseMidX = 0.125 * x1 + 0.375 * c1x + 0.375 * c2x + 0.125 * x2;
  const baseMidY = 0.125 * y1 + 0.375 * c1y + 0.375 * c2y + 0.125 * y2;
  const bendX = options?.curveOffset?.x ?? 0;
  const bendY = options?.curveOffset?.y ?? 0;

  // Shifting both cubic control points by (4/3)*offset moves the t=0.5 curve midpoint by exactly 1*offset
  const ctrlShiftX = bendX * (4 / 3);
  const ctrlShiftY = bendY * (4 / 3);
  c1x += ctrlShiftX;
  c1y += ctrlShiftY;
  c2x += ctrlShiftX;
  c2y += ctrlShiftY;

  const handle: ConnectionPathHandle = {
    x: baseMidX + bendX,
    y: baseMidY + bendY,
    axis: 'xy',
    baseX: baseMidX,
    baseY: baseMidY,
    spanStart: Math.min(x1, x2, y1, y2),
    spanEnd: Math.max(x1, x2, y1, y2),
    extraTargets: [x1, x2, y1, y2],
  };

  if (parallelOffset === 0) {
    return {
      d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
      labelX: handle.x,
      labelY: handle.y,
      handle,
    };
  }

  // Sample cubic Bezier and offset each sample along its unit left normal for true parallel curves
  const STEPS = 28;
  const sampled: string[] = [];
  let midX = handle.x;
  let midY = handle.y;

  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const mt = 1 - t;
    const bx = mt * mt * mt * x1 + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * x2;
    const by = mt * mt * mt * y1 + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * y2;

    let tx = 3 * mt * mt * (c1x - x1) + 6 * mt * t * (c2x - c1x) + 3 * t * t * (x2 - c2x);
    let ty = 3 * mt * mt * (c1y - y1) + 6 * mt * t * (c2y - c1y) + 3 * t * t * (y2 - c2y);
    let tLen = Math.hypot(tx, ty);
    if (tLen < 0.001) {
      tx = x2 - x1;
      ty = y2 - y1;
      tLen = Math.hypot(tx, ty) || 1;
    }

    const nx = -ty / tLen;
    const ny = tx / tLen;
    const px = bx + nx * parallelOffset;
    const py = by + ny * parallelOffset;
    sampled.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`);
    if (i === STEPS / 2) {
      midX = px;
      midY = py;
    }
  }

  return {
    d: sampled.join(' '),
    labelX: midX,
    labelY: midY,
    handle,
  };
}
