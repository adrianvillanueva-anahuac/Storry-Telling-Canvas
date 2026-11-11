import React, { useRef, useState } from 'react';
import { WorkflowNode } from '../types/workflow';
import { Unlink, Edit3, Trash2, MessageSquare, Image as ImageIcon } from 'lucide-react';

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  isReadOnly: boolean;
  onStartPortDrag: (nodeId: string, port: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => void;
  onOpenDashboard: (nodeId: string) => void;
  onDeleteRequest: (nodeId: string) => void;
  onUnlinkContainer: (nodeId: string) => void;
  onUpdateTitle: (nodeId: string, newTitle: string) => void;
  onImagePaste: (nodeId: string, file: File) => void;
}

export const WorkflowNodeCard: React.FC<WorkflowNodeCardProps> = ({
  node,
  isReadOnly,
  onStartPortDrag,
  onOpenDashboard,
  onDeleteRequest,
  onUnlinkContainer,
  onUpdateTitle,
  onImagePaste,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(node.title || 'Scene');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() !== node.title) {
      onUpdateTitle(node.id, titleValue.trim() || 'Untitled Scene');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImagePaste(node.id, e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      id={node.id}
      data-node-id={node.id}
      style={{
        left: node.x,
        top: node.y,
        width: 220,
      }}
      className="absolute bg-neutral-850 dark:bg-neutral-900 border border-neutral-700/80 hover:border-blue-500/80 rounded-xl shadow-lg transition-shadow duration-200 group cursor-grab active:cursor-grabbing z-10 select-none"
    >
      {/* Floating Action Bar on Hover */}
      {!isReadOnly && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/95 border border-neutral-700 rounded-full py-1 px-2.5 flex items-center gap-1.5 shadow-xl z-20 pointer-events-none group-hover:pointer-events-auto backdrop-blur-sm">
          {node.containerId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnlinkContainer(node.id);
              }}
              className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 rounded-full transition-colors"
              title="Unlink from Container"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDashboard(node.id);
            }}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-blue-400 rounded-full transition-colors"
            title="Edit Node Details"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest(node.id);
            }}
            className="p-1 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-full transition-colors"
            title="Delete or Archive Node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Connection Ports */}
      {(['top', 'bottom', 'left', 'right'] as const).map((port) => {
        let posClass = '';
        if (port === 'top') posClass = '-top-2 left-1/2 -translate-x-1/2';
        if (port === 'bottom') posClass = '-bottom-2 left-1/2 -translate-x-1/2';
        if (port === 'left') posClass = '-left-2 top-1/2 -translate-y-1/2';
        if (port === 'right') posClass = '-right-2 top-1/2 -translate-y-1/2';

        return (
          <div
            key={port}
            data-port={port}
            data-node={node.id}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartPortDrag(node.id, port, e);
            }}
            className={`absolute ${posClass} w-3.5 h-3.5 rounded-full bg-neutral-900 border-2 border-blue-500 hover:bg-blue-500 hover:scale-125 cursor-crosshair z-30 transition-transform shadow-md`}
            title={`Connect from ${port}`}
          />
        );
      })}

      {/* Node Header / Title */}
      <div className="p-2.5 border-b border-neutral-800 bg-neutral-900/60 rounded-t-xl flex items-center justify-between gap-2">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitleValue(node.title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            className="w-full text-xs font-semibold bg-neutral-800 text-neutral-100 px-1.5 py-0.5 rounded border border-blue-500 focus:outline-none"
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isReadOnly) setIsEditingTitle(true);
            }}
            className="text-xs font-semibold text-neutral-200 truncate cursor-text hover:text-white"
            title="Double-click to rename"
          >
            {node.title || 'Scene'}
          </div>
        )}
      </div>

      {/* Node Thumbnail & Drop Area */}
      <div
        className="p-2.5 relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {node.image ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenDashboard(node.id);
            }}
            className="relative rounded-lg overflow-hidden bg-black aspect-video group/thumb cursor-pointer border border-neutral-800"
          >
            <img
              src={node.image}
              alt={node.title}
              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/20 group-hover/thumb:bg-black/0 transition-colors" />
          </div>
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenDashboard(node.id);
            }}
            className="aspect-video rounded-lg border-2 border-dashed border-neutral-700/80 hover:border-blue-500/80 flex flex-col items-center justify-center text-neutral-500 hover:text-neutral-300 gap-1.5 p-2 text-center transition-colors cursor-pointer bg-neutral-900/40"
          >
            <ImageIcon className="w-5 h-5 text-neutral-600" />
            <span className="text-[11px] font-medium leading-tight">
              Paste or Drop Image
            </span>
          </div>
        )}

        {/* Comment count badge */}
        {node.pins && node.pins.length > 0 && (
          <div
            className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center shadow-lg border border-neutral-900"
            title={`${node.pins.length} comments & tasks`}
          >
            <MessageSquare className="w-2.5 h-2.5 mr-0.5 inline" />
            {node.pins.length}
          </div>
        )}
      </div>
    </div>
  );
};
