import React, { useMemo } from 'react';
import { Connection, WorkflowNode } from '../types/workflow';
import { calculateConnectionPath, getNodePortCoords } from '../utils/connectionPath';

interface ConnectionLinesProps {
  connections: Connection[];
  nodes: Record<string, WorkflowNode>;
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
  isPanMode?: boolean;
  isSearchActive?: boolean;
  matchedNodeIds?: Set<string>;
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({
  connections,
  nodes,
  tempConnection,
  onClickConnection,
  onHoverConnection,
  isPanMode = false,
  isSearchActive = false,
  matchedNodeIds,
}) => {
  const uniqueColors = useMemo(() => {
    const set = new Set<string>();
    connections.forEach((c) => set.add(c.color || '#0052cc'));
    set.add('#0052cc');
    return Array.from(set);
  }, [connections]);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5] overflow-visible">
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
        const start = getNodePortCoords(nodes, conn.source, conn.sourcePort);
        const end = getNodePortCoords(nodes, conn.target, conn.targetPort);
        if (!start || !end) return null;

        const connType = conn.type || 'angle';
        const { d: pathD, labelX, labelY } = calculateConnectionPath(
          start.x,
          start.y,
          end.x,
          end.y,
          conn.sourcePort,
          conn.targetPort,
          connType
        );
        const hex = (conn.color || '#0052cc').replace('#', '');
        const isParallel = conn.style === 'parallel';

        const markerEnd =
          conn.arrows === 'end' || conn.arrows === 'both' ? `url(#arrow-end-${hex})` : undefined;
        const markerStart =
          conn.arrows === 'start' || conn.arrows === 'both' ? `url(#arrow-start-${hex})` : undefined;

        const parallelLine1 = isParallel
          ? calculateConnectionPath(
              start.x,
              start.y,
              end.x,
              end.y,
              conn.sourcePort,
              conn.targetPort,
              connType,
              -15
            )
          : null;
        const parallelLine2 = isParallel
          ? calculateConnectionPath(
              start.x,
              start.y,
              end.x,
              end.y,
              conn.sourcePort,
              conn.targetPort,
              connType,
              15
            )
          : null;
        const pa = conn.parallelArrows || { first: 'forward', second: 'backward' };
        const ps = conn.parallelStyles || { first: 'solid', second: 'solid' };
        const getStrokeStyle = (pattern?: string) => {
          if (pattern === 'dotted') {
            return { strokeDasharray: '1 6', strokeLinecap: 'round' as const };
          }
          if (pattern === 'dashed') {
            return { strokeDasharray: '10 6', strokeLinecap: 'butt' as const };
          }
          return { strokeDasharray: undefined, strokeLinecap: 'butt' as const };
        };
        const singleStroke = getStrokeStyle(conn.style);
        const line1Stroke = getStrokeStyle(ps.first);
        const line2Stroke = getStrokeStyle(ps.second);

        const isSeparateLabels = isParallel && conn.parallelLabelMode === 'separate';
        const label1Text = conn.parallelLabels?.first ?? '';
        const label2Text = conn.parallelLabels?.second ?? '';

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

        const sourceMatches = Boolean(isSearchActive && matchedNodeIds?.has(conn.source));
        const targetMatches = Boolean(isSearchActive && matchedNodeIds?.has(conn.target));
        const searchOpacity = !isSearchActive
          ? 1
          : sourceMatches && targetMatches
          ? 1
          : sourceMatches || targetMatches
          ? 0.35
          : 0.12;

        return (
          <g
            key={conn.id}
            style={{ opacity: searchOpacity, transition: 'opacity 200ms ease' }}
            className="cursor-pointer"
          >
            {isParallel && parallelLine1 && parallelLine2 ? (
              <>
                <path
                  d={parallelLine1.d}
                  stroke={conn.color || '#0052cc'}
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
                  stroke={conn.color || '#0052cc'}
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
                stroke={conn.color || '#0052cc'}
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
              conn.label && (
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
                    {conn.label}
                  </text>
                </g>
              )
            )}
          </g>
        );
      })}

      {tempConnection && (
        <path
          d={
            calculateConnectionPath(
              tempConnection.startX,
              tempConnection.startY,
              tempConnection.hoverTarget?.isReady ? tempConnection.hoverTarget.snapX : tempConnection.currentX,
              tempConnection.hoverTarget?.isReady ? tempConnection.hoverTarget.snapY : tempConnection.currentY,
              tempConnection.sourcePort,
              tempConnection.hoverTarget?.isReady ? tempConnection.hoverTarget.port : 'left',
              'angle'
            ).d
          }
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeDasharray={tempConnection.hoverTarget?.isReady ? undefined : '6 6'}
          fill="none"
        />
      )}
    </svg>
  );
};
