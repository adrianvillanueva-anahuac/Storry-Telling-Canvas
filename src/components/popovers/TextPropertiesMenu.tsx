import React from 'react';
import { LabelItem, TextElement } from '../../types/workflow';
import { Bold, Italic, Tag, X } from 'lucide-react';

interface TextPropertiesMenuProps {
  element: TextElement;
  labels: Record<string, LabelItem>;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate: (updates: Partial<TextElement>) => void;
  onOpenLabelManager: () => void;
}

export const TextPropertiesMenu: React.FC<TextPropertiesMenuProps> = ({
  element,
  labels,
  position,
  onClose,
  onUpdate,
  onOpenLabelManager,
}) => {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={{ left: position.x + 10, top: position.y + 10 }}
        className="fixed z-50 w-64 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-3 text-xs space-y-3 backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <span className="font-semibold text-neutral-200">Text Properties</span>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">Function Mode</label>
          <select
            value={element.mode}
            onChange={(e) => onUpdate({ mode: e.target.value as 'floating' | 'annotation' | 'container' })}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-100 outline-none focus:border-blue-500"
          >
            <option value="floating">Floating Text</option>
            <option value="annotation">Annotation Note</option>
            <option value="container">Logic Container</option>
          </select>
        </div>

        {element.mode === 'container' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-neutral-400">Category Label</label>
              <button
                onClick={onOpenLabelManager}
                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                <span>Manage Labels</span>
              </button>
            </div>
            <select
              value={element.labelId || ''}
              onChange={(e) => onUpdate({ labelId: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-100 outline-none focus:border-blue-500"
            >
              <option value="">None</option>
              {Object.entries(labels).map(([id, lbl]) => (
                <option key={id} value={id}>
                  {lbl.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="text-[11px] text-neutral-400">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={element.color || '#333333'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[10px] text-neutral-400">{element.color}</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">Font Size: {element.size}px</label>
          <input
            type="range"
            min={12}
            max={72}
            value={element.size || 16}
            onChange={(e) => onUpdate({ size: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-500"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="text-[11px] text-neutral-400">Formatting</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdate({ bold: !element.bold })}
              className={`p-1.5 rounded border transition-colors ${
                element.bold
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdate({ italic: !element.italic })}
              className={`p-1.5 rounded border transition-colors ${
                element.italic
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
