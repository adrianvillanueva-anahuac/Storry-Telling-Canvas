import React, { useRef, useState, useEffect } from 'react';
import { CommentPin, GlobalVideo, WorkflowNode } from '../../types/workflow';
import {
  Archive,
  CheckSquare,
  Clock,
  Edit,
  FolderOpen,
  Image as ImageIcon,
  Map as MapIcon,
  MessageSquare,
  Plus,
  Trash2,
  UploadCloud,
  Video,
  X,
} from 'lucide-react';
import { ShreddedImageIcon } from '../icons/ShreddedImageIcon';

interface NodeDashboardModalProps {
  node: WorkflowNode;
  globalVideos: GlobalVideo[];
  isReadOnly: boolean;
  isArchived?: boolean;
  currentUserName: string;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode?: (nodeId: string) => void;
  onArchiveNode?: (nodeId: string) => void;
  onOpenPinning: (nodeId: string) => void;
  onOpenMapViewer: (nodeId: string) => void;
  onOpenGalleryPicker: () => void;
  onOpenMapGalleryPicker: () => void;
  onOpenAddVideoToColumn: (column: 'enfoque' | 'accion' | 'descripcion') => void;
  onOpenVideoPlayer: (column: 'enfoque' | 'accion' | 'descripcion') => void;
  onUploadMainImage: (file: File) => void;
  onUploadMapImage: (file: File) => void;
  onRemoveMap: () => void;
}

export const NodeDashboardModal: React.FC<NodeDashboardModalProps> = ({
  node,
  globalVideos,
  isReadOnly,
  isArchived = false,
  currentUserName,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onArchiveNode,
  onOpenPinning,
  onOpenMapViewer,
  onOpenGalleryPicker,
  onOpenMapGalleryPicker,
  onOpenAddVideoToColumn,
  onOpenVideoPlayer,
  onUploadMainImage,
  onUploadMapImage,
  onRemoveMap,
}) => {
  const [mapSidePanelOpen, setMapSidePanelOpen] = useState(false);
  const [enfoqueText, setEnfoqueText] = useState(node.enfoque || '');
  const [accionText, setAccionText] = useState(node.accion || '');
  const [descripcionText, setDescripcionText] = useState(node.descripcion || '');
  const [showDeletedImagePrompt, setShowDeletedImagePrompt] = useState(
    Boolean(node.imageDeletedFromAdmin && !node.image && !isReadOnly && !isArchived)
  );
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);

  useEffect(() => {
    setEnfoqueText(node.enfoque || '');
    setAccionText(node.accion || '');
    setDescripcionText(node.descripcion || '');
  }, [node.id, node.enfoque, node.accion, node.descripcion]);

  useEffect(() => {
    setShowDeletedImagePrompt(
      Boolean(node.imageDeletedFromAdmin && !node.image && !isReadOnly && !isArchived)
    );
    setConfirmPermanentDelete(false);
  }, [node.id, node.imageDeletedFromAdmin, isReadOnly, isArchived]);

  useEffect(() => {
    if (node.image) {
      setShowDeletedImagePrompt(false);
      setConfirmPermanentDelete(false);
    }
  }, [node.image]);

  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const mapFileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveTextChanges = () => {
    onUpdateNode(node.id, {
      enfoque: enfoqueText,
      accion: accionText,
      descripcion: descripcionText,
    });
  };

  const handleToggleCheck = (pinId: string, field: 'review' | 'done') => {
    if (isReadOnly) return;
    const nextPins = node.pins.map((p) =>
      p.id === pinId ? { ...p, [field]: !p[field] } : p
    );
    onUpdateNode(node.id, { pins: nextPins });
  };

  const handleAddReply = (pinId: string) => {
    if (isReadOnly) return;
    const replyText = prompt('Type your reply:');
    if (replyText && replyText.trim()) {
      const nextPins = node.pins.map((p) =>
        p.id === pinId
          ? {
              ...p,
              replies: [...p.replies, { author: currentUserName, text: replyText.trim() }],
            }
          : p
      );
      onUpdateNode(node.id, { pins: nextPins });
    }
  };

  const handleEditPin = (pinId: string) => {
    if (isReadOnly) return;
    const pin = node.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const newText = prompt('Edit your comment:', pin.text);
    if (newText && newText.trim() && newText !== pin.text) {
      const nextPins = node.pins.map((p) =>
        p.id === pinId ? { ...p, text: newText.trim(), edited: true } : p
      );
      onUpdateNode(node.id, { pins: nextPins });
    }
  };

  const handleDeletePin = (pinId: string) => {
    if (isReadOnly) return;
    if (confirm('Are you sure you want to delete this pin?')) {
      const nextPins = node.pins.filter((p) => p.id !== pinId);
      onUpdateNode(node.id, { pins: nextPins });
    }
  };

  const handleRemoveColumnVideo = (col: 'enfoque' | 'accion' | 'descripcion') => {
    if (isReadOnly) return;
    if (confirm('Remove video reference from this column?')) {
      const nextVideos = { ...node.videos, [col]: null };
      onUpdateNode(node.id, { videos: nextVideos });
    }
  };

  const countEnfoque = node.pins.filter((p) => p.type === 'enfoque').length;
  const countAccion = node.pins.filter((p) => p.type === 'accion').length;
  const countDescripcion = node.pins.filter((p) => p.type === 'descripcion').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Prompt Modal when node image was removed by Admin */}
        {showDeletedImagePrompt && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-red-500/40 shadow-2xl p-6 space-y-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-center justify-center">
                  <ShreddedImageIcon className="w-11 h-11 text-red-500" />
                </div>
                <h3 className="text-base font-bold text-neutral-100">
                  La imagen de este nodo fue eliminada
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Fue retirada desde la consola de administración. Tus notas, pines y columnas se mantienen intactas. ¿Qué deseas hacer con <span className="text-neutral-200 font-semibold">{node.title}</span>?
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {/* 1. Upload image */}
                <div className="rounded-xl border border-blue-500/40 bg-blue-600/10 p-2.5 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      mainFileInputRef.current?.click();
                      setShowDeletedImagePrompt(false);
                    }}
                    className="w-full flex items-center gap-2.5 text-left text-xs font-semibold text-blue-200 hover:text-white transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>1. ¿Quieres subir imagen?</span>
                  </button>
                  <div className="pl-6 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeletedImagePrompt(false);
                        onOpenGalleryPicker();
                      }}
                      className="text-[11px] text-blue-300 hover:text-blue-200 underline"
                    >
                      O elegir de la galería del proyecto
                    </button>
                  </div>
                </div>

                {/* 2. Delete entire node */}
                {confirmPermanentDelete ? (
                  <div className="rounded-xl border border-red-500/60 bg-red-950/60 p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-200">
                      ¿Eliminar permanentemente este nodo, sus notas y sus pines?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteNode?.(node.id);
                          setShowDeletedImagePrompt(false);
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                      >
                        Sí, eliminar todo
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPermanentDelete(false)}
                        className="py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmPermanentDelete(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-red-500/40 bg-red-950/30 hover:bg-red-950/60 text-left text-xs font-semibold text-red-300 hover:text-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                    <span>2. Eliminar todo el nodo y su información</span>
                  </button>
                )}

                {/* 3. Archive node */}
                <button
                  type="button"
                  onClick={() => {
                    onArchiveNode?.(node.id);
                    setShowDeletedImagePrompt(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-left text-xs font-semibold text-amber-200 hover:text-amber-100 transition-colors"
                >
                  <Archive className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>3. Archivar el nodo</span>
                </button>

                {/* 4. Decide later */}
                <button
                  type="button"
                  onClick={() => setShowDeletedImagePrompt(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-800 text-left text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
                >
                  <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span>4. Decide más tarde</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-neutral-100">{node.title || 'Scene Dashboard'}</h2>
            <span className="text-xs font-mono text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
              ID: {node.id}
            </span>
          </div>

          <button
            onClick={() => {
              handleSaveTextChanges();
              onClose();
            }}
            className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Top Area */}
        <div className="p-4 border-b border-neutral-800 flex flex-col lg:flex-row gap-5 max-h-[50vh] overflow-y-auto">
          {/* Main Image Thumbnail & Map Drawer Container */}
          <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-2 relative">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMapSidePanelOpen(!mapSidePanelOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                  mapSidePanelOpen || node.mapImage
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map Space {node.mapImage && '✓'}</span>
              </button>

              <span className="text-[11px] text-neutral-500">
                {mapSidePanelOpen
                  ? node.mapImage
                    ? 'Click map for Viewer'
                    : 'No map uploaded'
                  : node.image
                  ? 'Click preview for Pinning'
                  : 'No image uploaded'}
              </span>
            </div>

            {/* Side Map Drawer (Expandable) */}
            {mapSidePanelOpen && (
              <div className="p-3 bg-neutral-950 border border-amber-500/30 rounded-xl space-y-2.5 shadow-xl animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>Topographical Map Reference</span>
                  </span>
                  <button
                    onClick={() => setMapSidePanelOpen(false)}
                    className="text-neutral-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {node.mapImage ? (
                  <div className="space-y-2">
                    <div
                      onClick={() => onOpenMapViewer(node.id)}
                      className="aspect-video rounded-lg overflow-hidden bg-black border border-amber-500/40 cursor-pointer group relative shadow-md"
                      title="Open Fullscreen Map Viewer"
                    >
                      <img src={node.mapImage} alt={node.mapName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                        <span className="px-2 py-1 rounded bg-black/80 text-amber-300 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          Open Map Viewer
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300 font-medium truncate">{node.mapName || 'Map'}</span>
                      <button
                        onClick={onRemoveMap}
                        className="text-red-400 hover:text-red-300 text-[11px] font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      onClick={() => mapFileInputRef.current?.click()}
                      className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                        node.mapImageDeletedFromAdmin
                          ? 'border-red-500/60 bg-red-950/25 hover:bg-red-950/40'
                          : 'border-amber-500/40 hover:bg-amber-500/5'
                      }`}
                    >
                      {node.mapImageDeletedFromAdmin ? (
                        <div className="flex flex-col items-center gap-1">
                          <ShreddedImageIcon className="w-7 h-7 text-red-500" />
                          <p className="text-xs text-red-300 font-medium">Mapa eliminado por administración</p>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-300 font-medium">Paste / Drop Map Here</p>
                      )}
                      <input
                        ref={mapFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            onUploadMapImage(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => mapFileInputRef.current?.click()}
                        className="flex-1 py-1 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md border border-neutral-700"
                      >
                        Browse PC
                      </button>
                      <button
                        onClick={onOpenMapGalleryPicker}
                        className="flex-1 py-1 text-xs text-white bg-amber-600 hover:bg-amber-500 rounded-md font-semibold"
                      >
                        Map Library
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main Scene Image Box (hidden while Map Space is active) */}
            {!mapSidePanelOpen && (
              <>
                <div className="aspect-video rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 relative group shadow-inner">
                  {node.image ? (
                    <div
                      onClick={() => onOpenPinning(node.id)}
                      className="w-full h-full cursor-pointer relative"
                      title="Click to open Fullscreen Pinning and Drawing Tools"
                    >
                      <img src={node.image} alt={node.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-lg bg-black/80 border border-white/20 text-white text-xs font-semibold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                          <Edit className="w-3.5 h-3.5 text-blue-400" />
                          <span>Fullscreen Pinning & Drawings</span>
                        </span>
                      </div>
                    </div>
                  ) : node.imageDeletedFromAdmin ? (
                    <div
                      onClick={() => !isReadOnly && setShowDeletedImagePrompt(true)}
                      className={`w-full h-full border-2 border-dashed border-red-500/70 bg-red-950/25 flex flex-col items-center justify-center p-4 text-center transition-colors ${
                        !isReadOnly ? 'hover:border-red-400 hover:bg-red-950/40 cursor-pointer' : ''
                      }`}
                    >
                      <ShreddedImageIcon className="w-12 h-12 text-red-500 mb-2" />
                      <p className="text-xs font-semibold text-red-300">
                        Imagen eliminada desde administración
                      </p>
                      {!isReadOnly && (
                        <p className="text-[10px] text-red-300/70 mt-0.5">
                          Haz clic para subir imagen, archivar o eliminar nodo
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => mainFileInputRef.current?.click()}
                      className="w-full h-full border-2 border-dashed border-neutral-700 hover:border-blue-500 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors"
                    >
                      <UploadCloud className="w-8 h-8 text-neutral-500 mb-2" />
                      <p className="text-xs font-medium text-neutral-200">Paste or drop scene image</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Click to browse your device</p>
                    </div>
                  )}

                  <input
                    ref={mainFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        onUploadMainImage(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                {/* Main Image Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => mainFileInputRef.current?.click()}
                    className="flex-1 py-1.5 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 flex items-center justify-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse PC</span>
                  </button>
                  <button
                    onClick={onOpenGalleryPicker}
                    className="flex-1 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Gallery</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 3 Text Columns: Enfoque, Acción, Descripción */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1: Enfoque */}
            <div className="flex flex-col bg-neutral-950 border border-neutral-800/90 rounded-xl p-3 space-y-2">
              {/* Video Header */}
              <div className="border-b border-neutral-800/80 pb-2">
                {node.videos?.enfoque?.globalId ? (
                  <div className="flex items-center gap-2 bg-neutral-900 border border-blue-500/30 p-1.5 rounded-lg group/v">
                    <img
                      src={`https://img.youtube.com/vi/${node.videos.enfoque.globalId}/default.jpg`}
                      alt="Ref"
                      className="w-10 h-6 object-cover rounded cursor-pointer"
                      onClick={() => onOpenVideoPlayer('enfoque')}
                    />
                    <span
                      onClick={() => onOpenVideoPlayer('enfoque')}
                      className="text-[11px] font-medium text-blue-400 hover:underline truncate flex-1 cursor-pointer"
                    >
                      {globalVideos.find((g) => g.id === node.videos.enfoque?.globalId)?.name || 'Video Ref'}
                    </span>
                    <button
                      onClick={() => handleRemoveColumnVideo('enfoque')}
                      className="text-neutral-500 hover:text-red-400 p-0.5"
                      title="Remove Video"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenAddVideoToColumn('enfoque')}
                    className="w-full py-1 text-[11px] text-neutral-400 hover:text-neutral-200 border border-dashed border-neutral-800 hover:border-neutral-700 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Video</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Enfoque</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">
                  {countEnfoque} pins
                </span>
              </div>

              <textarea
                value={enfoqueText}
                onChange={(e) => setEnfoqueText(e.target.value)}
                onBlur={handleSaveTextChanges}
                rows={5}
                placeholder="Directorial framing, camera movement, lens choice..."
                className="flex-1 w-full bg-transparent text-xs text-neutral-200 outline-none resize-none leading-relaxed placeholder:text-neutral-600"
              />
            </div>

            {/* Column 2: Acción */}
            <div className="flex flex-col bg-neutral-950 border border-neutral-800/90 rounded-xl p-3 space-y-2">
              <div className="border-b border-neutral-800/80 pb-2">
                {node.videos?.accion?.globalId ? (
                  <div className="flex items-center gap-2 bg-neutral-900 border border-orange-500/30 p-1.5 rounded-lg group/v">
                    <img
                      src={`https://img.youtube.com/vi/${node.videos.accion.globalId}/default.jpg`}
                      alt="Ref"
                      className="w-10 h-6 object-cover rounded cursor-pointer"
                      onClick={() => onOpenVideoPlayer('accion')}
                    />
                    <span
                      onClick={() => onOpenVideoPlayer('accion')}
                      className="text-[11px] font-medium text-orange-400 hover:underline truncate flex-1 cursor-pointer"
                    >
                      {globalVideos.find((g) => g.id === node.videos.accion?.globalId)?.name || 'Video Ref'}
                    </span>
                    <button
                      onClick={() => handleRemoveColumnVideo('accion')}
                      className="text-neutral-500 hover:text-red-400 p-0.5"
                      title="Remove Video"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenAddVideoToColumn('accion')}
                    className="w-full py-1 text-[11px] text-neutral-400 hover:text-neutral-200 border border-dashed border-neutral-800 hover:border-neutral-700 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Video</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">Acción</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-orange-600/20 text-orange-300 border border-orange-500/30">
                  {countAccion} pins
                </span>
              </div>

              <textarea
                value={accionText}
                onChange={(e) => setAccionText(e.target.value)}
                onBlur={handleSaveTextChanges}
                rows={5}
                placeholder="Character motion, blocking, beats, environmental events..."
                className="flex-1 w-full bg-transparent text-xs text-neutral-200 outline-none resize-none leading-relaxed placeholder:text-neutral-600"
              />
            </div>

            {/* Column 3: Descripción */}
            <div className="flex flex-col bg-neutral-950 border border-neutral-800/90 rounded-xl p-3 space-y-2">
              <div className="border-b border-neutral-800/80 pb-2">
                {node.videos?.descripcion?.globalId ? (
                  <div className="flex items-center gap-2 bg-neutral-900 border border-emerald-500/30 p-1.5 rounded-lg group/v">
                    <img
                      src={`https://img.youtube.com/vi/${node.videos.descripcion.globalId}/default.jpg`}
                      alt="Ref"
                      className="w-10 h-6 object-cover rounded cursor-pointer"
                      onClick={() => onOpenVideoPlayer('descripcion')}
                    />
                    <span
                      onClick={() => onOpenVideoPlayer('descripcion')}
                      className="text-[11px] font-medium text-emerald-400 hover:underline truncate flex-1 cursor-pointer"
                    >
                      {globalVideos.find((g) => g.id === node.videos.descripcion?.globalId)?.name || 'Video Ref'}
                    </span>
                    <button
                      onClick={() => handleRemoveColumnVideo('descripcion')}
                      className="text-neutral-500 hover:text-red-400 p-0.5"
                      title="Remove Video"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenAddVideoToColumn('descripcion')}
                    className="w-full py-1 text-[11px] text-neutral-400 hover:text-neutral-200 border border-dashed border-neutral-800 hover:border-neutral-700 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Video</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Descripción</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
                  {countDescripcion} pins
                </span>
              </div>

              <textarea
                value={descripcionText}
                onChange={(e) => setDescripcionText(e.target.value)}
                onBlur={handleSaveTextChanges}
                rows={5}
                placeholder="Atmosphere, sound design, wardrobe, lighting palette..."
                className="flex-1 w-full bg-transparent text-xs text-neutral-200 outline-none resize-none leading-relaxed placeholder:text-neutral-600"
              />
            </div>
          </div>
        </div>

        {/* Dashboard Bottom Area: Comments & Tasks */}
        <div className="flex-1 flex flex-col p-4 bg-neutral-950/60 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-neutral-200 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Spatial Comments & Assigned Tasks ({node.pins?.length || 0})</span>
            </h3>
            <span className="text-[10px] text-neutral-500">
              Pin markers can be created on the image inside Fullscreen Pinning
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {!node.pins || node.pins.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-xs">
                No pinned comments on this scene yet. Open Fullscreen Pinning to drop markers.
              </div>
            ) : (
              node.pins.map((pin) => {
                const borderClass =
                  pin.type === 'enfoque'
                    ? 'border-l-blue-500'
                    : pin.type === 'accion'
                    ? 'border-l-orange-500'
                    : 'border-l-emerald-500';

                return (
                  <div
                    key={pin.id}
                    className={`p-3 bg-neutral-900 border border-neutral-800/90 rounded-xl border-l-4 ${borderClass} space-y-2`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-200">
                          Pin #{pin.num} [{pin.type.toUpperCase()}]
                        </span>
                        <span className="text-[11px] text-blue-400 font-medium">by {pin.author}</span>
                        {pin.edited && (
                          <span className="text-[10px] text-neutral-500 italic">(edited)</span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed">{pin.text}</p>

                    {/* Replies */}
                    {pin.replies && pin.replies.length > 0 && (
                      <div className="pl-3 border-l-2 border-neutral-800 space-y-1 text-xs text-neutral-400 py-1">
                        {pin.replies.map((r, i) => (
                          <div key={i}>
                            <span className="font-semibold text-neutral-300">{r.author}: </span>
                            <span>{r.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions bar */}
                    <div className="flex items-center gap-4 pt-2 border-t border-neutral-800/60 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                        <input
                          type="checkbox"
                          checked={pin.review || false}
                          onChange={() => handleToggleCheck(pin.id, 'review')}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>Review</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                        <input
                          type="checkbox"
                          checked={pin.done || false}
                          onChange={() => handleToggleCheck(pin.id, 'done')}
                          className="rounded text-emerald-600 focus:ring-0"
                        />
                        <span>Done</span>
                      </label>

                      <button
                        onClick={() => handleAddReply(pin.id)}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        ↳ Reply
                      </button>

                      {pin.author === currentUserName && (
                        <button
                          onClick={() => handleEditPin(pin.id)}
                          className="text-neutral-400 hover:text-neutral-200 font-medium"
                        >
                          ✏️ Edit
                        </button>
                      )}

                      <button
                        onClick={() => handleDeletePin(pin.id)}
                        className="text-red-400 hover:text-red-300 ml-auto font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
