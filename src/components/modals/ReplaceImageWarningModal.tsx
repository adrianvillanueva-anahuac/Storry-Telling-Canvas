import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ReplaceImageWarningModalProps {
  onClose: () => void;
  onConfirm: (option: 'borrar_todo' | 'conservar') => void;
}

export const ReplaceImageWarningModal: React.FC<ReplaceImageWarningModalProps> = ({
  onClose,
  onConfirm,
}) => {
  const [option, setOption] = useState<'borrar_todo' | 'conservar'>('borrar_todo');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-100">Replace Scene Image</h3>
            <p className="text-xs text-neutral-400">Choose how to handle existing comments & drawings</p>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <label
            onClick={() => setOption('borrar_todo')}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              option === 'borrar_todo'
                ? 'bg-red-500/10 border-red-500 ring-1 ring-red-500'
                : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <input
              type="radio"
              name="replaceOption"
              checked={option === 'borrar_todo'}
              onChange={() => setOption('borrar_todo')}
              className="mt-0.5 text-red-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-neutral-200 block">Clear Everything (Borrar todo)</span>
              <span className="text-neutral-400 text-[11px] leading-relaxed">
                Remove the image and delete all pins, comments, and drawing vectors from this node.
              </span>
            </div>
          </label>

          <label
            onClick={() => setOption('conservar')}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              option === 'conservar'
                ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
                : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <input
              type="radio"
              name="replaceOption"
              checked={option === 'conservar'}
              onChange={() => setOption('conservar')}
              className="mt-0.5 text-blue-600 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-bold text-neutral-200 block">Keep Content (Conservar contenido)</span>
              <span className="text-neutral-400 text-[11px] leading-relaxed">
                Keep all pins and vector drawings in place, updating only the background scene image.
              </span>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(option)}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition-colors"
          >
            Confirm Replacement
          </button>
        </div>
      </div>
    </div>
  );
};
