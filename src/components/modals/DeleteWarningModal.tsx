import React from 'react';
import { AlertTriangle, Archive, Trash2, X } from 'lucide-react';

interface DeleteWarningModalProps {
  onClose: () => void;
  onConfirmDelete: () => void;
  onConfirmStore: () => void;
}

export const DeleteWarningModal: React.FC<DeleteWarningModalProps> = ({
  onClose,
  onConfirmDelete,
  onConfirmStore,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-bold text-neutral-100">Delete Scene or Store in Archive?</h3>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Do you want to permanently remove this node, or store it in the archive so you can review or restore it later?
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmStore}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Store It</span>
          </button>
          <button
            onClick={onConfirmDelete}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
