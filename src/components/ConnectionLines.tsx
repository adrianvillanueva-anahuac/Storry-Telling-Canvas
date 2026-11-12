import React, { useMemo } from 'react';
import { Connection, WorkflowNode } from '../types/workflow';

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
  } | null;
  onClickConnection?: (connectionId: string, clientX: number, clientY: number) => void;
  onHoverConnection?: (connectionId: string, clientX: number, clientY: number) => void;
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({
  connections,
  nodes,
  tempConnection,
  onClickConnection,
  onHoverConnection,
}) => {
  // Unique colors for arrow markers
  const uniqueColors = useMemo(() => {
    const set = new Set<string>();
    connections.forEach((c) => set.add(c.color || '#0052cc'));
    set.add('#0052cc');
    return Array.from(set);
  }, [connections]);

  const getPortCoords = (nodeId: string, port: 'top' | 'bottom' | 'left' | 'right') => {
    const node = nodes[nodeId];
    if (!node) return null;

    const x = parseFloat(node.x) || 0;
    const y = parseFloat(node.y) || 0;
    const w = 220;
    // Exact WorkflowNodeCard rendered height (border 2 + header 37 + padding 20 + aspect-video 112)
    const h = 171;

    let px = x;
    let py = y;

    if (port === 'left') {
      px = x;
      py = y + h / 2;
    } else if (port === 'right') {
      px = x + w;
      py = y + h / 2;
    } else if (port === 'top') {
      px = x + w / 2;
      py = y;
    } else if (port === 'bottom') {
      px = x + w / 2;
      py = y + h;
    }

    return { x: px, y: py };
  };

  const calculatePath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    sourcePort: string,
    targetPort: string,
    type: 'curve' | 'straight' = 'curve'
  ) => {
    if (type === 'straight') {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
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

    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  };

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
                orient="auto-start-reverse"
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
                orient="auto-start-reverse"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill={color} />
              </marker>
            </React.Fragment>
          );
        })}
      </defs>

      {/* Render Saved Connections */}
      {connections.map((conn) => {
        const start = getPortCoords(conn.source, conn.sourcePort);
        const end = getPortCoords(conn.target, conn.targetPort);
        if (!start || !end) return null;

        const pathD = calculatePath(
          start.x,
          start.y,
          end.x,
          end.y,
          conn.sourcePort,
          conn.targetPort,
          conn.type
        );
        const hex = (conn.color || '#0052cc').replace('#', '');

        const markerEnd = conn.arrows === 'end' || conn.arrows === 'both' ? `url(#arrow-end-${hex})` : undefined;
        const markerStart = conn.arrows === 'both' ? `url(#arrow-start-${hex})` : undefined;

        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        return (
          <g key={conn.id} className="cursor-pointer">
            {/* Visible rendered connection line - immediate tracking without CSS transition delay */}
            <path
              d={pathD}
              stroke={conn.color || '#0052cc'}
              strokeWidth="2.5"
              strokeDasharray={conn.style === 'dotted' ? '6 6' : undefined}
              fill="none"
              markerEnd={markerEnd}
              markerStart={markerStart}
            />

            {/* Wide transparent hit stroke - on roll over do nothing, on click the options appear */}
            <path
              d={pathD}
              stroke="transparent"
              strokeWidth="24"
              fill="none"
              className="pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (onClickConnection) {
                  onClickConnection(conn.id, e.clientX, e.clientY);
                } else if (onHoverConnection) {
                  onHoverConnection(conn.id, e.clientX, e.clientY);
                }
              }}
            />

            {/* Optional label */}
            {conn.label && (
              <text
                x={midX}
                y={midY - 8}
                textAnchor="middle"
                className="text-[11px] font-bold fill-neutral-200 pointer-events-none select-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 4px #000' }}
              >
                {conn.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Render In-Progress Drag Connection */}
      {tempConnection && (
        <path
          d={calculatePath(
            tempConnection.startX,
            tempConnection.startY,
            tempConnection.currentX,
            tempConnection.currentY,
            tempConnection.sourcePort,
            'left',
            'curve'
          )}
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeDasharray="6 6"
          fill="none"
        />
      )}
    </svg>
  );
};
