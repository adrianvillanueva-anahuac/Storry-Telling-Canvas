import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddTextModalProps {
  initialType: 'floating' | 'container' | 'annotation';
  onClose: () => void;
  onConfirm: (type: 'floating' | 'container' | 'annotation', text: string) => void;
}

export const AddTextModal: React.FC<AddTextModalProps> = ({
  initialType,
  onClose,
  onConfirm,
}) => {
  const [type, setType] = useState(initialType);
  const [text, setText] = useState('');

  const labelTitle =
    type === 'annotation' ? 'Note Title' : type === 'container' ? 'Container Name' : 'Text Content';

  const placeholder =
    type === 'annotation'
      ? 'e.g. Lighting Notes, Directorial Feedback'
      : type === 'container'
      ? 'e.g. Act I: The Castle Sequence'
      : 'e.g. Scene Heading or Marker';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="font-semibold text-neutral-100 text-sm">Create Text Element</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-xs text-neutral-400 block mb-1.5">Type</label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setType('floating')}
              className={`py-1.5 px-2 rounded-md font-medium transition-colors ${
                type === 'floating' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Just Text
            </button>
            <button
              onClick={() => setType('container')}
              className={`py-1.5 px-2 rounded-md font-medium transition-colors ${
                type === 'container' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Container
            </button>
            <button
              onClick={() => setType('annotation')}
              className={`py-1.5 px-2 rounded-md font-medium transition-colors ${
                type === 'annotation' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sticky Note
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-neutral-400 block mb-1.5">{labelTitle}</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onConfirm(type, text.trim() || 'New Text');
              }
            }}
            placeholder={placeholder}
            autoFocus
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(type, text.trim() || 'New Text')}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
