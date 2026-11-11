import React from 'react';
import { Connection } from '../../types/workflow';
import { Trash2, X } from 'lucide-react';

interface LinePropertiesMenuProps {
  connection: Connection;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate: (updates: Partial<Connection>) => void;
  onDelete: () => void;
}

export const LinePropertiesMenu: React.FC<LinePropertiesMenuProps> = ({
  connection,
  position,
  onClose,
  onUpdate,
  onDelete,
}) => {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={{ left: position.x + 10, top: position.y + 10 }}
        className="fixed z-50 w-64 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-3 text-xs space-y-3 backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <span className="font-semibold text-neutral-200">Line Properties</span>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">Label Name</label>
          <input
            type="text"
            value={connection.label || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g. Next sequence, Triggers"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-100 outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Line Style</label>
            <select
              value={connection.style || 'solid'}
              onChange={(e) => onUpdate({ style: e.target.value as 'solid' | 'dotted' })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-100 outline-none focus:border-blue-500"
            >
              <option value="solid">Solid</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Arrows</label>
            <select
              value={connection.arrows || 'end'}
              onChange={(e) => onUpdate({ arrows: e.target.value as 'none' | 'end' | 'both' })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-100 outline-none focus:border-blue-500"
            >
              <option value="none">None</option>
              <option value="end">End Only</option>
              <option value="both">Both Ends</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[11px] text-neutral-400">Line Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={connection.color || '#0052cc'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[10px] text-neutral-400">{connection.color}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-md font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Connection</span>
          </button>
        </div>
      </div>
    </>
  );
};
