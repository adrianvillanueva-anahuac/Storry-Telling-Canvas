import React, { useMemo, useRef, useState } from 'react';
import { Connection, TextElement, WorkflowNode } from '../types/workflow';
import {
  AUTO_CREATE_MIN_DRAG_DISTANCE,
  calculateConnectionPath,
  ConnectionPathHandle,
  ConnectionPathOptions,
  getNodePortCoords,
  getNodeTopLeftForPortDrop,
  isPointInsideNodeCard,
  NODE_CARD_HEIGHT,
  NODE_CARD_WIDTH,
  resolveAutoTargetPort,
} from '../utils/connectionPath';
import {
  computeLineAngleSnap,
  computeLinePointSnap,
  SnapGuideLine,
} from '../utils/snapGuides';
import { useLanguage } from '../hooks/useLanguage';

interface ConnectionLinesProps {
  connections: Connection[];
  nodes: Record<string, WorkflowNode>;
  texts?: Record<string, TextElement>;
  tempConnection: {
    sourceId: string;
    sourcePort: 'top' | 'bottom' | 'left' | 'right';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hoverTarget?: {
      nodeId: string;
      port: 'top' | 'bottom' | 'left' | 'right';
      proximity: number;
      isReady: boolean;
      snapX: number;
      snapY: number;
    } | null;
  } | null;
  onClickConnection?: (connectionId: string, clientX: number, clientY: number) => void;
  onHoverConnection?: (connectionId: string, clientX: number, clientY: number) => void;
  selectedConnectionId?: string | null;
  isPanMode?: boolean;
  isReadOnly?: boolean;
  isSearchActive?: boolean;
  matchedNodeIds?: Set<string>;
  hiddenNodeIds?: Set<string>;
  onCommitConnectionShape?: (
    connectionId: string,
    updates: Partial<Pick<Connection, 'angleOffset' | 'curveOffset'>>
  ) => void;
  onSnapGuidesChange?: (guides: SnapGuideLine[]) => void;
}

interface LiveDragOverride {
  connectionId: string;
  angleOffset?: number;
  curveOffset?: { x: number; y: number };
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({
  connections,
  nodes,
  texts = {},
  tempConnection,
  onClickConnection,
  onHoverConnection,
  selectedConnectionId = null,
  isPanMode = false,
  isReadOnly = false,
  isSearchActive = false,
  matchedNodeIds,
  hiddenNodeIds,
  onCommitConnectionShape,
  onSnapGuidesChange,
}) => {
  const { t } = useLanguage();
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [liveDrag, setLiveDrag] = useState<LiveDragOverride | null>(null);
  const liveDragRef = useRef<LiveDragOverride | null>(null);

  const uniqueColors = useMemo(() => {
    const set = new Set<string>();
    connections.forEach((c) => set.add(c.color || '#0052cc'));
    set.add('#0052cc');
    return Array.from(set);
  }, [connections]);

  const startHandleDrag = (
    e: React.PointerEvent<SVGGElement>,
    conn: Connection,
    handle: ConnectionPathHandle
  ) => {
    if (e.button !== 0 || isReadOnly || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();

    const connType = conn.type || 'angle';
    const canvasEl = e.currentTarget.closest('.canvas-grid') as HTMLElement | null;
    const rawZoom = canvasEl
      ? parseFloat(getComputedStyle(canvasEl).getPropertyValue('--canvas-zoom'))
      : 1;
    const zoom = Number.isFinite(rawZoom) && rawZoom > 0 ? rawZoom : 1;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialAngleOffset = conn.angleOffset ?? 0;
    const initialCurveOffset = conn.curveOffset ?? { x: 0, y: 0 };

    // Snapshot other connections' bend handles for inter-line angle snapping
    const otherBendHandles: Array<{ x: number; y: number }> = [];
    connections.forEach((other) => {
      if (other.id === conn.id) return;
      const oStart = getNodePortCoords(nodes, other.source, other.sourcePort);
      const oEnd = getNodePortCoords(nodes, other.target, other.targetPort);
      if (!oStart || !oEnd) return;
      const oPath = calculateConnectionPath(
        oStart.x,
        oStart.y,
        oEnd.x,
        oEnd.y,
        other.sourcePort,
        other.targetPort,
        other.type || 'angle',
        0,
        {
          angleOffset: other.angleOffset,
          cornerRadius: other.cornerRadius,
          curveOffset: other.curveOffset,
        }
      );
      otherBendHandles.push({ x: oPath.handle.x, y: oPath.handle.y });
    });

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startClientX) / zoom;
      const dy = (moveEvent.clientY - startClientY) / zoom;

      if (connType === 'angle') {
        const rawOffset =
          handle.axis === 'x' ? initialAngleOffset + dx : initialAngleOffset + dy;
        const baseCoord = handle.axis === 'x' ? handle.baseX : handle.baseY;
        const rawCoord = baseCoord + rawOffset;

        let nextOffset = rawOffset;
        if (!moveEvent.altKey) {
          const snap = computeLineAngleSnap({
            rawCoord,
            axis: handle.axis === 'x' ? 'x' : 'y',
            baseCoord,
            spanStart: handle.spanStart,
            spanEnd: handle.spanEnd,
            extraTargets: handle.extraTargets,
            nodes,
            texts,
            otherBendHandles,
          });
          nextOffset = snap.coord - baseCoord;
          onSnapGuidesChange?.(snap.guides);
        } else {
          onSnapGuidesChange?.([]);
        }

        const roundedOffset = Math.abs(nextOffset) < 0.25 ? 0 : Math.round(nextOffset * 10) / 10;
        const nextOverride: LiveDragOverride = {
          connectionId: conn.id,
          angleOffset: roundedOffset,
        };
        liveDragRef.current = nextOverride;
        setLiveDrag(nextOverride);
      } else {
        const rawX = handle.baseX + initialCurveOffset.x + dx;
        const rawY = handle.baseY + initialCurveOffset.y + dy;

        let nextCurveX = rawX - handle.baseX;
        let nextCurveY = rawY - handle.baseY;

        if (!moveEvent.altKey) {
          const snap = computeLinePointSnap({
            rawX,
            rawY,
            baseX: handle.baseX,
            baseY: handle.baseY,
            extraXTargets: handle.extraTargets.slice(0, 2),
            extraYTargets: handle.extraTargets.slice(2, 4),
            nodes,
            texts,
            otherBendHandles,
          });
          nextCurveX = snap.x - handle.baseX;
          nextCurveY = snap.y - handle.baseY;
          onSnapGuidesChange?.(snap.guides);
        } else {
          onSnapGuidesChange?.([]);
        }

        const nextOverride: LiveDragOverride = {
          connectionId: conn.id,
          curveOffset: {
            x: Math.abs(nextCurveX) < 0.25 ? 0 : Math.round(nextCurveX * 10) / 10,
            y: Math.abs(nextCurveY) < 0.25 ? 0 : Math.round(nextCurveY * 10) / 10,
          },
        };
        liveDragRef.current = nextOverride;
        setLiveDrag(nextOverride);
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      onSnapGuidesChange?.([]);
    };

    const handleUp = () => {
      cleanup();
      const latest = liveDragRef.current;
      liveDragRef.current = null;
      setLiveDrag(null);

      if (!latest || latest.connectionId !== conn.id) return;

      if (connType === 'angle') {
        const finalOffset = latest.angleOffset ?? 0;
        if (Math.abs(finalOffset - initialAngleOffset) > 0.1) {
          onCommitConnectionShape?.(conn.id, {
            angleOffset: Math.abs(finalOffset) < 0.5 ? undefined : finalOffset,
          });
        }
      } else if (latest.curveOffset) {
        const fx = latest.curveOffset.x;
        const fy = latest.curveOffset.y;
        const changed =
          Math.abs(fx - initialCurveOffset.x) > 0.1 ||
          Math.abs(fy - initialCurveOffset.y) > 0.1;
        if (changed) {
          const isZero = Math.abs(fx) < 0.5 && Math.abs(fy) < 0.5;
          onCommitConnectionShape?.(conn.id, {
            curveOffset: isZero ? undefined : { x: fx, y: fy },
          });
        }
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none touch-none z-[5] overflow-visible">
      <defs>
        {uniqueColors.map((color) => {
          const hex = color.replace('#', '');
          return (
            <React.Fragment key={hex}>
              <marker
                id={`arrow-end-${hex}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
              <marker
                id={`arrow-start-${hex}`}
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill={color} />
              </marker>
              <marker
                id={`arrow-end-sm-${hex}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
              <marker
                id={`arrow-start-sm-${hex}`}
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill={color} />
              </marker>
            </React.Fragment>
          );
        })}
      </defs>

      {connections.map((conn) => {
        if (hiddenNodeIds?.has(conn.source) || hiddenNodeIds?.has(conn.target)) return null;
        const start = getNodePortCoords(nodes, conn.source, conn.sourcePort);
        const end = getNodePortCoords(nodes, conn.target, conn.targetPort);
        if (!start || !end) return null;

        const isDraggingThis = liveDrag?.connectionId === conn.id;
        const effectiveConn = isDraggingThis ? { ...conn, ...liveDrag } : conn;

        const connType = effectiveConn.type || 'angle';
        const pathOptions: ConnectionPathOptions = {
          angleOffset: effectiveConn.angleOffset,
          cornerRadius: effectiveConn.cornerRadius,
          curveOffset: effectiveConn.curveOffset,
        };
        const { d: pathD, labelX, labelY, handle } = calculateConnectionPath(
          start.x,
          start.y,
          end.x,
          end.y,
          effectiveConn.sourcePort,
          effectiveConn.targetPort,
          connType,
          0,
          pathOptions
        );
        const lineColor = effectiveConn.color || '#0052cc';
        const hex = lineColor.replace('#', '');
        const isParallel = effectiveConn.style === 'parallel';

        const markerEnd =
          effectiveConn.arrows === 'end' || effectiveConn.arrows === 'both'
            ? `url(#arrow-end-${hex})`
            : undefined;
        const markerStart =
          effectiveConn.arrows === 'start' || effectiveConn.arrows === 'both'
            ? `url(#arrow-start-${hex})`
            : undefined;

        const parallelLine1 = isParallel
          ? calculateConnectionPath(
              start.x,
              start.y,
              end.x,
              end.y,
              effectiveConn.sourcePort,
              effectiveConn.targetPort,
              connType,
              -15,
              pathOptions
            )
          : null;
        const parallelLine2 = isParallel
          ? calculateConnectionPath(
              start.x,
              start.y,
              end.x,
              end.y,
              effectiveConn.sourcePort,
              effectiveConn.targetPort,
              connType,
              15,
              pathOptions
            )
          : null;
        const pa = effectiveConn.parallelArrows || { first: 'forward', second: 'backward' };
        const ps = effectiveConn.parallelStyles || { first: 'solid', second: 'solid' };
        const getStrokeStyle = (pattern?: string) => {
          if (pattern === 'dotted') {
            return { strokeDasharray: '1 6', strokeLinecap: 'round' as const };
          }
          if (pattern === 'dashed') {
            return { strokeDasharray: '10 6', strokeLinecap: 'butt' as const };
          }
          return { strokeDasharray: undefined, strokeLinecap: 'butt' as const };
        };
        const singleStroke = getStrokeStyle(effectiveConn.style);
        const line1Stroke = getStrokeStyle(ps.first);
        const line2Stroke = getStrokeStyle(ps.second);

        const isSeparateLabels = isParallel && effectiveConn.parallelLabelMode === 'separate';
        const label1Text = effectiveConn.parallelLabels?.first ?? '';
        const label2Text = effectiveConn.parallelLabels?.second ?? '';

        const getOutwardLabelPos = (
          lineLabel: { labelX: number; labelY: number },
          fallbackSign: number
        ) => {
          const vx = lineLabel.labelX - labelX;
          const vy = lineLabel.labelY - labelY;
          const vLen = Math.hypot(vx, vy);
          const ux = vLen > 0.01 ? vx / vLen : 0;
          const uy = vLen > 0.01 ? vy / vLen : fallbackSign;
          const dist = Math.abs(ux) > 0.6 ? 10 : 12;
          const anchor: 'start' | 'end' | 'middle' =
            ux > 0.6 ? 'start' : ux < -0.6 ? 'end' : 'middle';
          return {
            x: lineLabel.labelX + ux * dist,
            y: lineLabel.labelY + uy * dist,
            anchor,
          };
        };

        const sourceMatches = Boolean(isSearchActive && matchedNodeIds?.has(effectiveConn.source));
        const targetMatches = Boolean(isSearchActive && matchedNodeIds?.has(effectiveConn.target));
        const searchOpacity = !isSearchActive
          ? 1
          : sourceMatches && targetMatches
          ? 1
          : sourceMatches || targetMatches
          ? 0.35
          : 0.12;

        const isHovered = hoveredConnectionId === conn.id;
        const isSelected = selectedConnectionId === conn.id;
        const showBendHandle =
          !isReadOnly && !isPanMode && (isHovered || isSelected || isDraggingThis);
        const isCustomBent =
          connType === 'angle'
            ? Math.abs(effectiveConn.angleOffset ?? 0) > 0.5
            : Math.hypot(
                effectiveConn.curveOffset?.x ?? 0,
                effectiveConn.curveOffset?.y ?? 0
              ) > 0.5;
        const handleCursor =
          connType === 'angle'
            ? handle.axis === 'x'
              ? 'ew-resize'
              : 'ns-resize'
            : 'move';

        return (
          <g
            key={conn.id}
            style={{ opacity: searchOpacity, transition: 'opacity 200ms ease' }}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredConnectionId(conn.id)}
            onMouseLeave={() =>
              setHoveredConnectionId((prev) => (prev === conn.id ? null : prev))
            }
          >
            {isParallel && parallelLine1 && parallelLine2 ? (
              <>
                <path
                  d={parallelLine1.d}
                  stroke={lineColor}
                  strokeWidth="2"
                  strokeDasharray={line1Stroke.strokeDasharray}
                  strokeLinecap={line1Stroke.strokeLinecap}
                  fill="none"
                  markerEnd={
                    pa.first === 'forward' || pa.first === 'both'
                      ? `url(#arrow-end-sm-${hex})`
                      : undefined
                  }
                  markerStart={
                    pa.first === 'backward' || pa.first === 'both'
                      ? `url(#arrow-start-sm-${hex})`
                      : undefined
                  }
                />
                <path
                  d={parallelLine2.d}
                  stroke={lineColor}
                  strokeWidth="2"
                  strokeDasharray={line2Stroke.strokeDasharray}
                  strokeLinecap={line2Stroke.strokeLinecap}
                  fill="none"
                  markerEnd={
                    pa.second === 'forward' || pa.second === 'both'
                      ? `url(#arrow-end-sm-${hex})`
                      : undefined
                  }
                  markerStart={
                    pa.second === 'backward' || pa.second === 'both'
                      ? `url(#arrow-start-sm-${hex})`
                      : undefined
                  }
                />
              </>
            ) : (
              <path
                d={pathD}
                stroke={lineColor}
                strokeWidth="2.5"
                strokeDasharray={singleStroke.strokeDasharray}
                strokeLinecap={singleStroke.strokeLinecap}
                fill="none"
                markerEnd={markerEnd}
                markerStart={markerStart}
              />
            )}

            {isParallel && parallelLine1 && parallelLine2 ? (
              <>
                <path
                  d={parallelLine1.d}
                  stroke="transparent"
                  strokeWidth="28"
                  fill="none"
                  className={isPanMode ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'}
                  onPointerDown={(e) => {
                    if (e.button === 1 || isPanMode) return;
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    if (isPanMode || e.button === 1) return;
                    e.stopPropagation();
                    if (onClickConnection) {
                      onClickConnection(conn.id, e.clientX, e.clientY);
                    } else if (onHoverConnection) {
                      onHoverConnection(conn.id, e.clientX, e.clientY);
                    }
                  }}
                />
                <path
                  d={parallelLine2.d}
                  stroke="transparent"
                  strokeWidth="28"
                  fill="none"
                  className={isPanMode ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'}
                  onPointerDown={(e) => {
                    if (e.button === 1 || isPanMode) return;
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    if (isPanMode || e.button === 1) return;
                    e.stopPropagation();
                    if (onClickConnection) {
                      onClickConnection(conn.id, e.clientX, e.clientY);
                    } else if (onHoverConnection) {
                      onHoverConnection(conn.id, e.clientX, e.clientY);
                    }
                  }}
                />
              </>
            ) : (
              <path
                d={pathD}
                stroke="transparent"
                strokeWidth="30"
                fill="none"
                className={isPanMode ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'}
                onPointerDown={(e) => {
                  if (e.button === 1 || isPanMode) return;
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  if (isPanMode || e.button === 1) return;
                  e.stopPropagation();
                  if (onClickConnection) {
                    onClickConnection(conn.id, e.clientX, e.clientY);
                  } else if (onHoverConnection) {
                    onHoverConnection(conn.id, e.clientX, e.clientY);
                  }
                }}
              />
            )}

            {isSeparateLabels && parallelLine1 && parallelLine2 ? (
              <>
                {label1Text && (() => {
                  const pos = getOutwardLabelPos(parallelLine1, -1);
                  return (
                    <g
                      style={{
                        transform: `translate(${pos.x}px, ${pos.y}px) scale(calc(1 / var(--canvas-zoom, 1)))`,
                        transformOrigin: '0 0',
                      }}
                      className="pointer-events-none select-none"
                    >
                      <text
                        x={0}
                        y={0}
                        textAnchor={pos.anchor}
                        dominantBaseline="central"
                        className="text-[11px] font-bold fill-neutral-900 dark:fill-neutral-200 pointer-events-none select-none [text-shadow:0_1px_2px_rgba(255,255,255,0.9),0_0_4px_#fff] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.8),0_0_4px_#000]"
                      >
                        {label1Text}
                      </text>
                    </g>
                  );
                })()}
                {label2Text && (() => {
                  const pos = getOutwardLabelPos(parallelLine2, 1);
                  return (
                    <g
                      style={{
                        transform: `translate(${pos.x}px, ${pos.y}px) scale(calc(1 / var(--canvas-zoom, 1)))`,
                        transformOrigin: '0 0',
                      }}
                      className="pointer-events-none select-none"
                    >
                      <text
                        x={0}
                        y={0}
                        textAnchor={pos.anchor}
                        dominantBaseline="central"
                        className="text-[11px] font-bold fill-neutral-900 dark:fill-neutral-200 pointer-events-none select-none [text-shadow:0_1px_2px_rgba(255,255,255,0.9),0_0_4px_#fff] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.8),0_0_4px_#000]"
                      >
                        {label2Text}
                      </text>
                    </g>
                  );
                })()}
              </>
            ) : (
              effectiveConn.label && (
                <g
                  style={{
                    transform: `translate(${labelX}px, ${labelY}px) scale(calc(1 / var(--canvas-zoom, 1)))`,
                    transformOrigin: '0 0',
                  }}
                  className="pointer-events-none select-none"
                >
                  <text
                    x={0}
                    y={isParallel ? 0 : -8}
                    textAnchor="middle"
                    dominantBaseline={isParallel ? 'central' : undefined}
                    className="text-[11px] font-bold fill-neutral-900 dark:fill-neutral-200 pointer-events-none select-none [text-shadow:0_1px_2px_rgba(255,255,255,0.9),0_0_4px_#fff] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.8),0_0_4px_#000]"
                  >
                    {effectiveConn.label}
                  </text>
                </g>
              )
            )}

            {showBendHandle && (
              <g
                style={{
                  transform: `translate(${handle.x}px, ${handle.y}px) scale(calc(1 / var(--canvas-zoom, 1)))`,
                  transformOrigin: '0 0',
                  cursor: handleCursor,
                }}
                className="pointer-events-auto"
                onPointerDown={(e) => startHandleDrag(e, effectiveConn, handle)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (connType === 'angle') {
                    onCommitConnectionShape?.(conn.id, { angleOffset: undefined });
                  } else {
                    onCommitConnectionShape?.(conn.id, { curveOffset: undefined });
                  }
                }}
              >
                <title>{t('linePopover.bendHandleHint')}</title>
                <circle r={13} fill="transparent" />
                {isDraggingThis && (
                  <circle
                    r={11}
                    fill={lineColor}
                    fillOpacity={0.18}
                    stroke={lineColor}
                    strokeWidth={1.2}
                    strokeOpacity={0.55}
                  />
                )}
                {connType === 'angle' ? (
                  <rect
                    x={handle.axis === 'x' ? -4 : -9}
                    y={handle.axis === 'x' ? -9 : -4}
                    width={handle.axis === 'x' ? 8 : 18}
                    height={handle.axis === 'x' ? 18 : 8}
                    rx={4}
                    fill={isCustomBent ? lineColor : '#ffffff'}
                    stroke={lineColor}
                    strokeWidth={2}
                    className="drop-shadow-sm"
                  />
                ) : (
                  <circle
                    r={5.5}
                    fill={isCustomBent ? lineColor : '#ffffff'}
                    stroke={lineColor}
                    strokeWidth={2}
                    className="drop-shadow-sm"
                  />
                )}
              </g>
            )}
          </g>
        );
      })}

      {tempConnection &&
        (() => {
          const isReadyTarget = Boolean(tempConnection.hoverTarget?.isReady);
          const endX = isReadyTarget
            ? tempConnection.hoverTarget!.snapX
            : tempConnection.currentX;
          const endY = isReadyTarget
            ? tempConnection.hoverTarget!.snapY
            : tempConnection.currentY;
          const autoTargetPort = resolveAutoTargetPort(
            tempConnection.sourcePort,
            tempConnection.startX,
            tempConnection.startY,
            endX,
            endY
          );
          const targetPort = isReadyTarget
            ? tempConnection.hoverTarget!.port
            : autoTargetPort;
          const dragDist = Math.hypot(
            endX - tempConnection.startX,
            endY - tempConnection.startY
          );
          const isInsideSource = isPointInsideNodeCard(
            nodes[tempConnection.sourceId],
            endX,
            endY,
            6
          );
          const showGhostNode =
            !isReadOnly &&
            !isReadyTarget &&
            dragDist >= AUTO_CREATE_MIN_DRAG_DISTANCE &&
            !isInsideSource;
          const ghostPos = showGhostNode
            ? getNodeTopLeftForPortDrop(endX, endY, autoTargetPort)
            : null;

          return (
            <g className="pointer-events-none">
              {ghostPos && (
                <g opacity={0.85}>
                  <rect
                    x={ghostPos.x}
                    y={ghostPos.y}
                    width={NODE_CARD_WIDTH}
                    height={NODE_CARD_HEIGHT}
                    rx={12}
                    ry={12}
                    fill="rgba(59, 130, 246, 0.08)"
                    stroke="#3b82f6"
                    strokeWidth={1.75}
                    strokeDasharray="5 5"
                  />
                  <line
                    x1={ghostPos.x}
                    y1={ghostPos.y + 37}
                    x2={ghostPos.x + NODE_CARD_WIDTH}
                    y2={ghostPos.y + 37}
                    stroke="rgba(59, 130, 246, 0.35)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={ghostPos.x + NODE_CARD_WIDTH / 2}
                    cy={ghostPos.y + (NODE_CARD_HEIGHT + 37) / 2}
                    r={14}
                    fill="rgba(59, 130, 246, 0.16)"
                    stroke="rgba(59, 130, 246, 0.65)"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={ghostPos.x + NODE_CARD_WIDTH / 2 - 6}
                    y1={ghostPos.y + (NODE_CARD_HEIGHT + 37) / 2}
                    x2={ghostPos.x + NODE_CARD_WIDTH / 2 + 6}
                    y2={ghostPos.y + (NODE_CARD_HEIGHT + 37) / 2}
                    stroke="#60a5fa"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <line
                    x1={ghostPos.x + NODE_CARD_WIDTH / 2}
                    y1={ghostPos.y + (NODE_CARD_HEIGHT + 37) / 2 - 6}
                    x2={ghostPos.x + NODE_CARD_WIDTH / 2}
                    y2={ghostPos.y + (NODE_CARD_HEIGHT + 37) / 2 + 6}
                    stroke="#60a5fa"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={endX}
                    cy={endY}
                    r={5}
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </g>
              )}
              <path
                d={
                  calculateConnectionPath(
                    tempConnection.startX,
                    tempConnection.startY,
                    endX,
                    endY,
                    tempConnection.sourcePort,
                    targetPort,
                    'angle'
                  ).d
                }
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeDasharray={isReadyTarget ? undefined : '6 6'}
                fill="none"
              />
            </g>
          );
        })()}
    </svg>
  );
};
