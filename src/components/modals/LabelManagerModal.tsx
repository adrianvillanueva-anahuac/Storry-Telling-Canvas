import React, { useState } from 'react';
import { LabelItem } from '../../types/workflow';
import { Plus, Trash2, X } from 'lucide-react';

interface LabelManagerModalProps {
  labels: Record<string, LabelItem>;
  onClose: () => void;
  onAddLabel: (name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
}

export const LabelManagerModal: React.FC<LabelManagerModalProps> = ({
  labels,
  onClose,
  onAddLabel,
  onDeleteLabel,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');

  const handleAdd = () => {
    if (name.trim()) {
      onAddLabel(name.trim(), color);
      setName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="font-semibold text-neutral-100 text-sm">Manage Category Labels</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add new label input */}
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-9 h-9 rounded-lg border-0 bg-transparent cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Act I, Needs Review, Approved"
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* List of labels */}
        <div className="max-h-56 overflow-y-auto space-y-2 pt-2 border-t border-neutral-800">
          {Object.keys(labels).length === 0 ? (
            <p className="text-center text-xs text-neutral-500 py-4">No custom labels yet.</p>
          ) : (
            Object.entries(labels).map(([id, lbl]) => (
              <div
                key={id}
                className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800/80"
              >
                <div className="flex items-center gap-2">
                  <div
                    style={{ backgroundColor: lbl.color }}
                    className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                  />
                  <span className="text-xs font-medium text-neutral-200">{lbl.name}</span>
                </div>
                <button
                  onClick={() => onDeleteLabel(id)}
                  className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                  title="Delete Label"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
