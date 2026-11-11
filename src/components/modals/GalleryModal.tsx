import React, { useRef, useState } from 'react';
import { GalleryImage } from '../../types/workflow';
import { Check, Image as ImageIcon, Map as MapIcon, Trash2, UploadCloud, X } from 'lucide-react';

interface GalleryModalProps {
  mode: 'images-manage' | 'maps-manage' | 'images-picker' | 'maps-picker';
  images: GalleryImage[];
  isLoading: boolean;
  onClose: () => void;
  onUploadFiles: (files: FileList) => void;
  onSelectImage: (url: string) => void;
  onDeleteSelected: (fileIds: string[]) => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  mode,
  images,
  isLoading,
  onClose,
  onUploadFiles,
  onSelectImage,
  onDeleteSelected,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMap = mode.includes('maps');
  const isPicker = mode.includes('picker');
  const title = isMap ? 'Map Asset Library' : 'Scene Images Gallery';

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            {isMap ? <MapIcon className="w-4 h-4 text-amber-400" /> : <ImageIcon className="w-4 h-4 text-blue-400" />}
            <h3 className="font-semibold text-neutral-100 text-sm">{title}</h3>
          </div>

          <div className="flex items-center gap-2">
            {!isPicker && selectedIds.size > 0 && (
              <button
                onClick={() => {
                  onDeleteSelected(Array.from(selectedIds));
                  setSelectedIds(new Set());
                }}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
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

        {/* Upload drop zone */}
        <div className="p-4 border-b border-neutral-800">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-neutral-700 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-neutral-950/40 hover:bg-neutral-800/20 transition-colors"
          >
            <UploadCloud className="w-6 h-6 text-neutral-400 mb-1" />
            <p className="text-xs text-neutral-300 font-medium">
              Click to browse or drop {isMap ? 'map files' : 'images'} here
            </p>
            <p className="text-[10px] text-neutral-500">Supports PNG, JPG, WebP (auto-saved to server)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onUploadFiles(e.target.files);
                }
              }}
            />
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-neutral-400">Loading library assets...</div>
          ) : images.length === 0 ? (
            <div className="text-center py-16 text-xs text-neutral-500">
              No images uploaded yet. Drop files above to populate the library.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img) => {
                const isSelected = selectedIds.has(img.id);
                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      if (isPicker) {
                        onSelectImage(img.url);
                      } else {
                        toggleSelect(img.id);
                      }
                    }}
                    className={`relative aspect-video rounded-xl overflow-hidden bg-neutral-950 border cursor-pointer transition-all group ${
                      isSelected
                        ? 'border-red-500 ring-2 ring-red-500/50 scale-95'
                        : 'border-neutral-800 hover:border-blue-500 hover:scale-[1.02]'
                    }`}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />

                    {/* Checkmark when selected */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}

                    {/* Picker hover overlay */}
                    {isPicker && (
                      <div className="absolute inset-0 bg-blue-600/80 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        Apply to Scene
                      </div>
                    )}

                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-[10px] text-neutral-300 truncate pointer-events-none">
                      {img.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
