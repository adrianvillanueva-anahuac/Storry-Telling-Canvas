import { TextElement, WorkflowNode } from '../types/workflow';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 171;
export const SNAP_THRESHOLD_PX = 8;

export interface SnapGuideLine {
  axis: 'x' | 'y';
  coord: number;
  spanStart: number;
  spanEnd: number;
  markers: number[];
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuideLine[];
}

interface AxisTarget {
  coord: number;
  spanStart: number;
  spanEnd: number;
  priority: number; // 0 = outer edge (preferred on tie), 1 = center
}

export function computeNodeSnap(
  rawX: number,
  rawY: number,
  draggedNodeId: string,
  excludeContainerId: string | null | undefined,
  nodes: Record<string, WorkflowNode>,
  texts: Record<string, TextElement>,
  threshold: number = SNAP_THRESHOLD_PX,
  excludeIds?: Set<string>
): SnapResult {
  const xTargets: AxisTarget[] = [];
  const yTargets: AxisTarget[] = [];

  // Collect peer node edges and centers
  Object.values(nodes).forEach((n) => {
    if (n.id === draggedNodeId || excludeIds?.has(n.id)) return;
    const nx = parseFloat(n.x) || 0;
    const ny = parseFloat(n.y) || 0;
    const nRight = nx + NODE_WIDTH;
    const nBottom = ny + NODE_HEIGHT;

    xTargets.push(
      { coord: nx, spanStart: ny, spanEnd: nBottom, priority: 0 },
      { coord: nx + NODE_WIDTH / 2, spanStart: ny, spanEnd: nBottom, priority: 1 },
      { coord: nRight, spanStart: ny, spanEnd: nBottom, priority: 0 }
    );

    yTargets.push(
      { coord: ny, spanStart: nx, spanEnd: nRight, priority: 0 },
      { coord: ny + NODE_HEIGHT / 2, spanStart: nx, spanEnd: nRight, priority: 1 },
      { coord: nBottom, spanStart: nx, spanEnd: nRight, priority: 0 }
    );
  });

  // Collect peer container edges (excluding dragged node's own dynamically resizing parent container)
  Object.values(texts).forEach((t) => {
    if (t.mode !== 'container') return;
    if ((excludeContainerId && t.id === excludeContainerId) || excludeIds?.has(t.id)) return;
    const tx = parseFloat(t.x) || 0;
    const ty = parseFloat(t.y) || 0;
    const tw = t.width || 340;
    const th = t.height || 240;

    xTargets.push(
      { coord: tx, spanStart: ty, spanEnd: ty + th, priority: 0 },
      { coord: tx + tw, spanStart: ty, spanEnd: ty + th, priority: 0 }
    );

    yTargets.push(
      { coord: ty, spanStart: tx, spanEnd: tx + tw, priority: 0 },
      { coord: ty + th, spanStart: tx, spanEnd: tx + tw, priority: 0 }
    );
  });

  // Dragged node alignment anchors relative to top-left
  const xAnchors = [
    { offset: 0, priority: 0 },
    { offset: NODE_WIDTH / 2, priority: 1 },
    { offset: NODE_WIDTH, priority: 0 },
  ];
  const yAnchors = [
    { offset: 0, priority: 0 },
    { offset: NODE_HEIGHT / 2, priority: 1 },
    { offset: NODE_HEIGHT, priority: 0 },
  ];

  // Find closest vertical (X) snap
  let bestXDelta = 0;
  let bestXDist = threshold + 0.001;
  let bestXPriority = 2;
  let snappedXCoord: number | null = null;

  for (const anchor of xAnchors) {
    const dragVal = rawX + anchor.offset;
    for (const target of xTargets) {
      const dist = Math.abs(target.coord - dragVal);
      if (
        dist < bestXDist - 0.01 ||
        (Math.abs(dist - bestXDist) <= 0.01 &&
          Math.max(anchor.priority, target.priority) < bestXPriority)
      ) {
        bestXDist = dist;
        bestXDelta = target.coord - dragVal;
        bestXPriority = Math.max(anchor.priority, target.priority);
        snappedXCoord = target.coord;
      }
    }
  }

  // Find closest horizontal (Y) snap
  let bestYDelta = 0;
  let bestYDist = threshold + 0.001;
  let bestYPriority = 2;
  let snappedYCoord: number | null = null;

  for (const anchor of yAnchors) {
    const dragVal = rawY + anchor.offset;
    for (const target of yTargets) {
      const dist = Math.abs(target.coord - dragVal);
      if (
        dist < bestYDist - 0.01 ||
        (Math.abs(dist - bestYDist) <= 0.01 &&
          Math.max(anchor.priority, target.priority) < bestYPriority)
      ) {
        bestYDist = dist;
        bestYDelta = target.coord - dragVal;
        bestYPriority = Math.max(anchor.priority, target.priority);
        snappedYCoord = target.coord;
      }
    }
  }

  const finalX = snappedXCoord !== null ? rawX + bestXDelta : rawX;
  const finalY = snappedYCoord !== null ? rawY + bestYDelta : rawY;

  const guides: SnapGuideLine[] = [];
  const GUIDE_PADDING = 14;

  if (snappedXCoord !== null) {
    const matchingTargets = xTargets.filter((t) => Math.abs(t.coord - snappedXCoord!) < 0.5);
    const minY = Math.min(finalY, ...matchingTargets.map((t) => t.spanStart));
    const maxY = Math.max(finalY + NODE_HEIGHT, ...matchingTargets.map((t) => t.spanEnd));
    const markerSet = new Set<number>([
      finalY,
      finalY + NODE_HEIGHT,
      ...matchingTargets.flatMap((t) => [t.spanStart, t.spanEnd]),
    ]);
    guides.push({
      axis: 'x',
      coord: snappedXCoord,
      spanStart: minY - GUIDE_PADDING,
      spanEnd: maxY + GUIDE_PADDING,
      markers: Array.from(markerSet),
    });
  }

  if (snappedYCoord !== null) {
    const matchingTargets = yTargets.filter((t) => Math.abs(t.coord - snappedYCoord!) < 0.5);
    const minX = Math.min(finalX, ...matchingTargets.map((t) => t.spanStart));
    const maxX = Math.max(finalX + NODE_WIDTH, ...matchingTargets.map((t) => t.spanEnd));
    const markerSet = new Set<number>([
      finalX,
      finalX + NODE_WIDTH,
      ...matchingTargets.flatMap((t) => [t.spanStart, t.spanEnd]),
    ]);
    guides.push({
      axis: 'y',
      coord: snappedYCoord,
      spanStart: minX - GUIDE_PADDING,
      spanEnd: maxX + GUIDE_PADDING,
      markers: Array.from(markerSet),
    });
  }

  return { x: finalX, y: finalY, guides };
}

export interface LineAngleSnapParams {
  rawCoord: number;
  axis: 'x' | 'y';
  baseCoord: number;
  spanStart: number;
  spanEnd: number;
  extraTargets?: number[];
  nodes: Record<string, WorkflowNode>;
  texts: Record<string, TextElement>;
  otherBendHandles?: Array<{ x: number; y: number }>;
  threshold?: number;
}

export interface LineAngleSnapResult {
  coord: number;
  guides: SnapGuideLine[];
}

function collectAxisTargetsForLines(
  axis: 'x' | 'y',
  baseCoord: number,
  spanStart: number,
  spanEnd: number,
  extraTargets: number[] | undefined,
  nodes: Record<string, WorkflowNode>,
  texts: Record<string, TextElement>,
  otherBendHandles: Array<{ x: number; y: number }> | undefined
): AxisTarget[] {
  const targets: AxisTarget[] = [];

  // Symmetrical default center / route alignment
  targets.push({ coord: baseCoord, spanStart, spanEnd, priority: 0 });

  // Connected ports & stubs alignment
  if (extraTargets) {
    extraTargets.forEach((coord) => {
      targets.push({ coord, spanStart, spanEnd, priority: 0 });
    });
  }

  // Peer nodes edges and centers
  Object.values(nodes).forEach((n) => {
    const nx = parseFloat(n.x) || 0;
    const ny = parseFloat(n.y) || 0;
    if (axis === 'x') {
      targets.push(
        { coord: nx, spanStart: ny, spanEnd: ny + NODE_HEIGHT, priority: 0 },
        { coord: nx + NODE_WIDTH / 2, spanStart: ny, spanEnd: ny + NODE_HEIGHT, priority: 1 },
        { coord: nx + NODE_WIDTH, spanStart: ny, spanEnd: ny + NODE_HEIGHT, priority: 0 }
      );
    } else {
      targets.push(
        { coord: ny, spanStart: nx, spanEnd: nx + NODE_WIDTH, priority: 0 },
        { coord: ny + NODE_HEIGHT / 2, spanStart: nx, spanEnd: nx + NODE_WIDTH, priority: 1 },
        { coord: ny + NODE_HEIGHT, spanStart: nx, spanEnd: nx + NODE_WIDTH, priority: 0 }
      );
    }
  });

  // Containers edges
  Object.values(texts).forEach((t) => {
    if (t.mode !== 'container') return;
    const tx = parseFloat(t.x) || 0;
    const ty = parseFloat(t.y) || 0;
    const tw = t.width || 340;
    const th = t.height || 240;
    if (axis === 'x') {
      targets.push(
        { coord: tx, spanStart: ty, spanEnd: ty + th, priority: 0 },
        { coord: tx + tw, spanStart: ty, spanEnd: ty + th, priority: 0 }
      );
    } else {
      targets.push(
        { coord: ty, spanStart: tx, spanEnd: tx + tw, priority: 0 },
        { coord: ty + th, spanStart: tx, spanEnd: tx + tw, priority: 0 }
      );
    }
  });

  // Other connection bend handles
  if (otherBendHandles) {
    otherBendHandles.forEach((h) => {
      if (axis === 'x') {
        targets.push({ coord: h.x, spanStart: h.y - 12, spanEnd: h.y + 12, priority: 0 });
      } else {
        targets.push({ coord: h.y, spanStart: h.x - 12, spanEnd: h.x + 12, priority: 0 });
      }
    });
  }

  return targets;
}

function findBestAxisSnap(
  rawVal: number,
  targets: AxisTarget[],
  threshold: number
): number | null {
  let bestDist = threshold + 0.001;
  let bestPriority = 2;
  let snappedCoord: number | null = null;

  for (const target of targets) {
    const dist = Math.abs(target.coord - rawVal);
    if (
      dist < bestDist - 0.01 ||
      (Math.abs(dist - bestDist) <= 0.01 && target.priority < bestPriority)
    ) {
      bestDist = dist;
      bestPriority = target.priority;
      snappedCoord = target.coord;
    }
  }

  return snappedCoord;
}

export function computeLineAngleSnap({
  rawCoord,
  axis,
  baseCoord,
  spanStart,
  spanEnd,
  extraTargets,
  nodes,
  texts,
  otherBendHandles,
  threshold = SNAP_THRESHOLD_PX,
}: LineAngleSnapParams): LineAngleSnapResult {
  const targets = collectAxisTargetsForLines(
    axis,
    baseCoord,
    spanStart,
    spanEnd,
    extraTargets,
    nodes,
    texts,
    otherBendHandles
  );
  const snappedCoord = findBestAxisSnap(rawCoord, targets, threshold);

  if (snappedCoord === null) {
    return { coord: rawCoord, guides: [] };
  }

  const GUIDE_PADDING = 14;
  const matchingTargets = targets.filter((t) => Math.abs(t.coord - snappedCoord) < 0.5);
  const minSpan = Math.min(spanStart, ...matchingTargets.map((t) => t.spanStart));
  const maxSpan = Math.max(spanEnd, ...matchingTargets.map((t) => t.spanEnd));
  const markerSet = new Set<number>([
    spanStart,
    spanEnd,
    ...matchingTargets.flatMap((t) => [t.spanStart, t.spanEnd]),
  ]);

  return {
    coord: snappedCoord,
    guides: [
      {
        axis,
        coord: snappedCoord,
        spanStart: minSpan - GUIDE_PADDING,
        spanEnd: maxSpan + GUIDE_PADDING,
        markers: Array.from(markerSet),
      },
    ],
  };
}

export interface LinePointSnapParams {
  rawX: number;
  rawY: number;
  baseX: number;
  baseY: number;
  extraXTargets?: number[];
  extraYTargets?: number[];
  nodes: Record<string, WorkflowNode>;
  texts: Record<string, TextElement>;
  otherBendHandles?: Array<{ x: number; y: number }>;
  threshold?: number;
}

export function computeLinePointSnap({
  rawX,
  rawY,
  baseX,
  baseY,
  extraXTargets,
  extraYTargets,
  nodes,
  texts,
  otherBendHandles,
  threshold = SNAP_THRESHOLD_PX,
}: LinePointSnapParams): SnapResult {
  const xRes = computeLineAngleSnap({
    rawCoord: rawX,
    axis: 'x',
    baseCoord: baseX,
    spanStart: rawY - 16,
    spanEnd: rawY + 16,
    extraTargets: extraXTargets,
    nodes,
    texts,
    otherBendHandles,
    threshold,
  });

  const yRes = computeLineAngleSnap({
    rawCoord: rawY,
    axis: 'y',
    baseCoord: baseY,
    spanStart: rawX - 16,
    spanEnd: rawX + 16,
    extraTargets: extraYTargets,
    nodes,
    texts,
    otherBendHandles,
    threshold,
  });

  return {
    x: xRes.coord,
    y: yRes.coord,
    guides: [...xRes.guides, ...yRes.guides],
  };
}

