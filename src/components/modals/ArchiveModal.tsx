import React from 'react';
import { WorkflowNode } from '../../types/workflow';
import { Archive, Eye, RotateCcw, Trash2, X } from 'lucide-react';

interface ArchiveModalProps {
  storedNodes: Record<string, WorkflowNode>;
  onClose: () => void;
  onRestore: (id: string) => void;
  onView: (id: string) => void;
  onDeleteSingle: (id: string) => void;
  onDeleteAll: () => void;
  onUpdateNote: (id: string, note: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  storedNodes,
  onClose,
  onRestore,
  onView,
  onDeleteSingle,
  onDeleteAll,
  onUpdateNote,
}) => {
  const count = Object.keys(storedNodes).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-purple-400" />
            <h3 className="font-semibold text-neutral-100 text-sm">Archived Scenes ({count})</h3>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <button
                onClick={onDeleteAll}
                className="px-2.5 py-1 text-xs text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 rounded-md border border-red-500/30 transition-colors"
              >
                Delete All
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {count === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <span>Archive is empty. Deleted scenes marked for archive will appear here.</span>
            </div>
          ) : (
            Object.entries(storedNodes).map(([id, node]) => (
              <div
                key={id}
                className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="font-semibold text-neutral-200 flex items-center gap-2">
                    <span>{node.title || 'Untitled Scene'}</span>
                    <span className="font-mono text-[10px] text-neutral-500">{id}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    Stored: {node.storedAt || 'Recently'} by {node.storedBy || 'User'}
                  </span>
                </div>

                {/* Storage note */}
                <input
                  type="text"
                  value={node.storeNote || ''}
                  onChange={(e) => onUpdateNote(id, e.target.value)}
                  placeholder="Add an archival note or context..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-purple-500"
                />

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-800/60">
                  <button
                    onClick={() => onView(id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800 rounded-md transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => onRestore(id)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => onDeleteSingle(id)}
                    className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
