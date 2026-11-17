import { WorkflowNode } from '../types/workflow';

export function getNodePortCoords(
  nodes: Record<string, WorkflowNode>,
  nodeId: string,
  port: 'top' | 'bottom' | 'left' | 'right'
): { x: number; y: number } | null {
  const node = nodes[nodeId];
  if (!node) return null;

  const x = parseFloat(node.x) || 0;
  const y = parseFloat(node.y) || 0;
  const w = 220;
  // Exact WorkflowNodeCard rendered height (border 2 + header 37 + padding 20 + aspect-video 112)
  const h = 171;

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

function buildRoundedAngleData(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sourcePort: string,
  targetPort: string,
  parallelOffset = 0
): { d: string; labelX: number; labelY: number } {
  const { nx: nx1, ny: ny1 } = getPortNormal(sourcePort);
  const { nx: nx2, ny: ny2 } = getPortNormal(targetPort);
  const stub = 24;

  const p0 = { x: x1, y: y1 };
  const p1 = { x: x1 + nx1 * stub, y: y1 + ny1 * stub };
  const pEndMinus1 = { x: x2 + nx2 * stub, y: y2 + ny2 * stub };
  const pLast = { x: x2, y: y2 };

  let rawPts: { x: number; y: number }[] = [];
  const srcHoriz = nx1 !== 0;
  const tgtHoriz = nx2 !== 0;

  if (srcHoriz && tgtHoriz) {
    const forwardOpposite =
      (nx1 === 1 && nx2 === -1 && p1.x <= pEndMinus1.x) ||
      (nx1 === -1 && nx2 === 1 && p1.x >= pEndMinus1.x);

    if (forwardOpposite) {
      const midX = (p1.x + pEndMinus1.x) / 2;
      rawPts = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pEndMinus1.y }, pEndMinus1, pLast];
    } else {
      const dy = Math.abs(y1 - y2);
      const detourY = dy > 190 ? (y1 + y2) / 2 : Math.min(y1, y2) - 110;
      rawPts = [p0, p1, { x: p1.x, y: detourY }, { x: pEndMinus1.x, y: detourY }, pEndMinus1, pLast];
    }
  } else if (!srcHoriz && !tgtHoriz) {
    const forwardOpposite =
      (ny1 === 1 && ny2 === -1 && p1.y <= pEndMinus1.y) ||
      (ny1 === -1 && ny2 === 1 && p1.y >= pEndMinus1.y);

    if (forwardOpposite) {
      const midY = (p1.y + pEndMinus1.y) / 2;
      rawPts = [p0, p1, { x: p1.x, y: midY }, { x: pEndMinus1.x, y: midY }, pEndMinus1, pLast];
    } else {
      const dx = Math.abs(x1 - x2);
      const detourX =
        dx > 240
          ? (x1 + x2) / 2
          : x2 >= x1
          ? Math.min(x1, x2) - 135
          : Math.max(x1, x2) + 135;
      rawPts = [p0, p1, { x: detourX, y: p1.y }, { x: detourX, y: pEndMinus1.y }, pEndMinus1, pLast];
    }
  } else if (srcHoriz && !tgtHoriz) {
    const xOk = (pEndMinus1.x - p1.x) * nx1 >= 0;
    const yOk = (pEndMinus1.y - p1.y) * ny2 <= 0;

    if (xOk && yOk) {
      rawPts = [p0, p1, { x: pEndMinus1.x, y: p1.y }, pEndMinus1, pLast];
    } else if (xOk) {
      const midX = (p1.x + pEndMinus1.x) / 2;
      rawPts = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pEndMinus1.y }, pEndMinus1, pLast];
    } else {
      const midY =
        Math.abs(p1.y - pEndMinus1.y) > 40 ? (p1.y + pEndMinus1.y) / 2 : Math.min(p1.y, pEndMinus1.y) - 90;
      rawPts = [p0, p1, { x: p1.x, y: midY }, { x: pEndMinus1.x, y: midY }, pEndMinus1, pLast];
    }
  } else {
    const yOk = (pEndMinus1.y - p1.y) * ny1 >= 0;
    const xOk = (pEndMinus1.x - p1.x) * nx2 <= 0;

    if (yOk && xOk) {
      rawPts = [p0, p1, { x: p1.x, y: pEndMinus1.y }, pEndMinus1, pLast];
    } else if (yOk) {
      const midY = (p1.y + pEndMinus1.y) / 2;
      rawPts = [p0, p1, { x: p1.x, y: midY }, { x: pEndMinus1.x, y: midY }, pEndMinus1, pLast];
    } else {
      const midX =
        Math.abs(p1.x - pEndMinus1.x) > 40 ? (p1.x + pEndMinus1.x) / 2 : Math.max(p1.x, pEndMinus1.x) + 120;
      rawPts = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pEndMinus1.y }, pEndMinus1, pLast];
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
    };
  }

  let pts = basePts;
  if (parallelOffset !== 0) {
    const segNormals: { nx: number; ny: number }[] = [];
    for (let i = 0; i < basePts.length - 1; i++) {
      const dx = basePts[i + 1].x - basePts[i].x;
      const dy = basePts[i + 1].y - basePts[i].y;
      const len = Math.hypot(dx, dy) || 1;
      segNormals.push({ nx: -dy / len, ny: dx / len });
    }

    pts = basePts.map((pt, i) => {
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

  const CORNER_RADIUS = 10;
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

    const r = Math.min(CORNER_RADIUS, len1 / 2, len2 / 2);
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

  let labelX = (x1 + x2) / 2;
  let labelY = (y1 + y2) / 2;
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

export function calculateConnectionPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sourcePort: string,
  targetPort: string,
  type: 'curve' | 'angle' | 'straight' = 'angle',
  parallelOffset = 0
): { d: string; labelX: number; labelY: number } {
  if (type === 'straight') {
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
    };
  }

  if (type === 'angle') {
    return buildRoundedAngleData(x1, y1, x2, y2, sourcePort, targetPort, parallelOffset);
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

  if (parallelOffset === 0) {
    return {
      d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2,
    };
  }

  // Sample cubic Bezier and offset each sample along its unit left normal for true parallel curves
  const STEPS = 28;
  const sampled: string[] = [];
  let midX = (x1 + x2) / 2;
  let midY = (y1 + y2) / 2;

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
  };
}
