import React, { useRef, useState, useEffect } from 'react';
import {
  ActorItem,
  CommentPin,
  GlobalVideo,
  LabelItem,
  NodeActorAssignment,
  WorkflowNode,
} from '../../types/workflow';
import {
  Archive,
  Box,
  CheckSquare,
  Clock,
  Edit,
  FolderOpen,
  Image as ImageIcon,
  Library,
  Map as MapIcon,
  MessageSquare,
  PenTool,
  Plus,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react';
import { ShreddedImageIcon } from '../icons/ShreddedImageIcon';
import { useLanguage } from '../../hooks/useLanguage';
import { getContrastTextColor } from '../../utils/colorContrast';

interface NodeDashboardModalProps {
  node: WorkflowNode;
  globalVideos: GlobalVideo[];
  actors: ActorItem[];
  labels?: Record<string, LabelItem>;
  isReadOnly: boolean;
  isArchived?: boolean;
  hasApiKey: boolean;
  currentUserName: string;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode?: (nodeId: string) => void;
  onArchiveNode?: (nodeId: string) => void;
  onOpenPinning: (nodeId: string) => void;
  onOpenMapViewer: (nodeId: string) => void;
  onOpenGalleryPicker: () => void;
  onOpenMapGalleryPicker: () => void;
  onOpenActorLibrary: () => void;
  onInspectActor: (actor: ActorItem) => void;
  onOpenAiImage: (mode: 'create' | 'edit', targetKind: 'image' | 'map') => void;
  onOpenSketchStudio: (targetKind?: 'image' | 'map') => void;
  onOpenAddVideoToColumn: (column: 'enfoque' | 'accion' | 'descripcion') => void;
  onOpenVideoPlayer: (column: 'enfoque' | 'accion' | 'descripcion') => void;
  onUploadMainImage: (file: File) => void;
  onUploadMapImage: (file: File) => void;
  onRemoveMap: () => void;
  onOpenLabelManager?: () => void;
}

export const NodeDashboardModal: React.FC<NodeDashboardModalProps> = ({
  node,
  globalVideos,
  actors,
  labels = {},
  isReadOnly,
  isArchived = false,
  hasApiKey,
  currentUserName,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onArchiveNode,
  onOpenPinning,
  onOpenMapViewer,
  onOpenGalleryPicker,
  onOpenMapGalleryPicker,
  onOpenActorLibrary,
  onInspectActor,
  onOpenAiImage,
  onOpenSketchStudio,
  onOpenAddVideoToColumn,
  onOpenVideoPlayer,
  onUploadMainImage,
  onUploadMapImage,
  onRemoveMap,
  onOpenLabelManager,
}) => {
  const { t, tColumn } = useLanguage();
  const [mapSidePanelOpen, setMapSidePanelOpen] = useState(false);
  const [enfoqueText, setEnfoqueText] = useState(node.enfoque || '');
  const [accionText, setAccionText] = useState(node.accion || '');
  const [descripcionText, setDescripcionText] = useState(node.descripcion || '');
  const [actorPickerOpen, setActorPickerOpen] = useState(false);
  const [selectedPickActorId, setSelectedPickActorId] = useState('');
  const [selectedPickStateId, setSelectedPickStateId] = useState('');
  const [showDeletedImagePrompt, setShowDeletedImagePrompt] = useState(
    Boolean(node.imageDeletedFromAdmin && !node.image && !isReadOnly && !isArchived)
  );
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [mainImgError, setMainImgError] = useState(false);
  const [mapImgError, setMapImgError] = useState(false);
  const [brokenActorIds, setBrokenActorIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEnfoqueText(node.enfoque || '');
    setAccionText(node.accion || '');
    setDescripcionText(node.descripcion || '');
    setActorPickerOpen(false);
    setSelectedPickActorId('');
    setSelectedPickStateId('');
  }, [node.id, node.enfoque, node.accion, node.descripcion]);

  useEffect(() => {
    setShowDeletedImagePrompt(
      Boolean(node.imageDeletedFromAdmin && !node.image && !isReadOnly && !isArchived)
    );
    setConfirmPermanentDelete(false);
  }, [node.id, node.imageDeletedFromAdmin, isReadOnly, isArchived]);

  useEffect(() => {
    setMainImgError(false);
    if (node.image) {
      setShowDeletedImagePrompt(false);
      setConfirmPermanentDelete(false);
    }
  }, [node.id, node.image]);

  useEffect(() => {
    setMapImgError(false);
  }, [node.id, node.mapImage]);

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
    const replyText = prompt(t('dashboard.promptReply'));
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
    const newText = prompt(t('dashboard.promptEditComment'), pin.text);
    if (newText && newText.trim() && newText !== pin.text) {
      const nextPins = node.pins.map((p) =>
        p.id === pinId ? { ...p, text: newText.trim(), edited: true } : p
      );
      onUpdateNode(node.id, { pins: nextPins });
    }
  };

  const handleDeletePin = (pinId: string) => {
    if (isReadOnly) return;
    if (confirm(t('dashboard.confirmDeletePin'))) {
      const nextPins = node.pins.filter((p) => p.id !== pinId);
      onUpdateNode(node.id, { pins: nextPins });
    }
  };

  const handleRemoveColumnVideo = (col: 'enfoque' | 'accion' | 'descripcion') => {
    if (isReadOnly) return;
    if (confirm(t('dashboard.confirmRemoveVideo'))) {
      const nextVideos = { ...node.videos, [col]: null };
      onUpdateNode(node.id, { videos: nextVideos });
    }
  };

  const sceneActors = node.actors || [];
  const pickedActor = actors.find((a) => a.id === selectedPickActorId) || actors[0] || null;

  const handleToggleActorPicker = () => {
    if (isReadOnly) return;
    if (!actorPickerOpen) {
      const first = actors[0];
      setSelectedPickActorId(first?.id || '');
      setSelectedPickStateId(first?.states?.[0]?.id || '');
    }
    setActorPickerOpen((prev) => !prev);
  };

  const handleSelectPickActor = (actorId: string) => {
    setSelectedPickActorId(actorId);
    const target = actors.find((a) => a.id === actorId);
    setSelectedPickStateId(target?.states?.[0]?.id || '');
  };

  const handleConfirmAddActor = () => {
    if (isReadOnly || !pickedActor) return;
    const chosenState =
      pickedActor.states.find((s) => s.id === selectedPickStateId) || pickedActor.states[0];
    const nextAssignment: NodeActorAssignment = {
      id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorId: pickedActor.id,
      stateId: chosenState?.id || '',
      stateLabel: chosenState?.label || t('dashboard.stateFallback'),
    };
    onUpdateNode(node.id, { actors: [...sceneActors, nextAssignment] });
    setActorPickerOpen(false);
  };

  const handleChangeSceneActorState = (assignmentId: string, nextStateId: string) => {
    if (isReadOnly) return;
    const nextActors = sceneActors.map((item) => {
      if (item.id !== assignmentId) return item;
      const actor = actors.find((a) => a.id === item.actorId);
      const nextState = actor?.states.find((s) => s.id === nextStateId);
      return {
        ...item,
        stateId: nextState?.id || nextStateId,
        stateLabel: nextState?.label || item.stateLabel,
      };
    });
    onUpdateNode(node.id, { actors: nextActors });
  };

  const handleRemoveSceneActor = (assignmentId: string) => {
    if (isReadOnly) return;
    const nextActors = sceneActors.filter((item) => item.id !== assignmentId);
    onUpdateNode(node.id, { actors: nextActors });
  };

  const countEnfoque = node.pins.filter((p) => p.type === 'enfoque').length;
  const countAccion = node.pins.filter((p) => p.type === 'accion').length;
  const countDescripcion = node.pins.filter((p) => p.type === 'descripcion').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Prompt Modal when node image was removed by Admin */}
        {showDeletedImagePrompt && (
          <div className="absolute inset-0 z-40 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#ebe7de] dark:bg-neutral-900 border border-red-600/45 dark:border-red-500/40 shadow-2xl p-6 space-y-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-red-600/10 dark:bg-red-950/40 border border-red-600/35 dark:border-red-500/40 flex items-center justify-center">
                  <ShreddedImageIcon className="w-11 h-11 text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-base font-bold text-[#2b2924] dark:text-neutral-100">
                  {t('dashboard.deletedBannerTitle')}
                </h3>
                <p className="text-xs text-[#5c584e] dark:text-neutral-400 leading-relaxed">
                  {t('dashboard.deletedBannerDesc', { title: node.title })}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {/* 1. Upload image */}
                <div className="rounded-xl border border-blue-600/35 dark:border-blue-500/40 bg-blue-600/10 p-2.5 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      mainFileInputRef.current?.click();
                      setShowDeletedImagePrompt(false);
                    }}
                    className="w-full flex items-center gap-2.5 text-left text-xs font-semibold text-blue-800 hover:text-blue-950 dark:text-blue-200 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span>{t('dashboard.deletedOpt1')}</span>
                  </button>
                  <div className="pl-6 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeletedImagePrompt(false);
                        onOpenGalleryPicker();
                      }}
                      className="text-[11px] text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 underline cursor-pointer"
                    >
                      {t('dashboard.deletedOpt1Gallery')}
                    </button>
                  </div>
                </div>

                {/* 2. Delete entire node */}
                {confirmPermanentDelete ? (
                  <div className="rounded-xl border border-red-600/50 dark:border-red-500/60 bg-red-600/12 dark:bg-red-950/60 p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                      {t('dashboard.deletedConfirmDelete')}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteNode?.(node.id);
                          setShowDeletedImagePrompt(false);
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {t('dashboard.deletedConfirmYes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPermanentDelete(false)}
                        className="py-1.5 px-3 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] text-[#2b2924] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 text-xs transition-colors cursor-pointer"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmPermanentDelete(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-red-600/35 dark:border-red-500/40 bg-red-600/10 hover:bg-red-600/18 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-left text-xs font-semibold text-red-800 hover:text-red-950 dark:text-red-300 dark:hover:text-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
                    <span>{t('dashboard.deletedOpt2')}</span>
                  </button>
                )}

                {/* 3. Archive node */}
                <button
                  type="button"
                  onClick={() => {
                    onArchiveNode?.(node.id);
                    setShowDeletedImagePrompt(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-amber-600/40 dark:border-amber-500/40 bg-amber-500/12 hover:bg-amber-500/20 text-left text-xs font-semibold text-amber-900 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-100 transition-colors cursor-pointer"
                >
                  <Archive className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>{t('dashboard.deletedOpt3')}</span>
                </button>

                {/* 4. Decide later */}
                <button
                  type="button"
                  onClick={() => setShowDeletedImagePrompt(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[#c3beb1] dark:border-neutral-700 bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800/80 dark:hover:bg-neutral-800 text-left text-xs font-semibold text-[#3a362e] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-[#5c584e] dark:text-neutral-400 shrink-0" />
                  <span>{t('dashboard.deletedOpt4')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="p-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <h2 className="text-base font-bold text-[#2b2924] dark:text-neutral-100 truncate">{node.title || t('dashboard.titlePlaceholder')}</h2>
            <span className="text-xs font-mono text-[#5c584e] dark:text-neutral-500 bg-[#dcd7cc] dark:bg-neutral-800 px-2 py-0.5 rounded border border-[#c3beb1] dark:border-neutral-700 shrink-0">
              ID: {node.id}
            </span>

            {/* Color-Coded Label Control */}
            {isReadOnly ? (
              node.labelId && labels[node.labelId] ? (
                <span
                  style={{
                    backgroundColor: labels[node.labelId].color,
                    color: getContrastTextColor(labels[node.labelId].color),
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold shadow-sm shrink-0"
                >
                  <Tag className="w-3 h-3" />
                  <span>{labels[node.labelId].name}</span>
                </span>
              ) : null
            ) : (
              <div className="flex items-center gap-1.5 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-2 py-1 text-[11px] shrink-0">
                <Tag className="w-3 h-3 text-[#5c584e] dark:text-neutral-400 shrink-0" />
                <span className="text-[#5c584e] dark:text-neutral-400 font-medium hidden sm:inline">
                  {t('dashboard.labelField')}
                </span>
                {node.labelId && labels[node.labelId] && (
                  <span
                    style={{ backgroundColor: labels[node.labelId].color }}
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15 dark:border-white/20"
                  />
                )}
                <select
                  value={node.labelId || ''}
                  onChange={(e) => onUpdateNode(node.id, { labelId: e.target.value })}
                  className="bg-transparent text-[#2b2924] dark:text-neutral-100 font-medium outline-none cursor-pointer max-w-[140px]"
                >
                  <option value="" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                    {t('node.noLabel')}
                  </option>
                  {Object.entries(labels)
                    .sort(([, a], [, b]) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                    .map(([id, lbl]) => (
                      <option
                        key={id}
                        value={id}
                        className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200"
                      >
                        {lbl.name}
                      </option>
                    ))}
                </select>
                {onOpenLabelManager && (
                  <button
                    type="button"
                    onClick={onOpenLabelManager}
                    className="pl-1.5 ml-0.5 border-l border-[#c3beb1] dark:border-neutral-800 text-blue-700 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                    title={t('textPopover.manageLabels')}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden md:inline">{t('dashboard.manageLabels')}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              handleSaveTextChanges();
              onClose();
            }}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Top Area */}
        <div className="p-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex flex-col lg:flex-row gap-5 max-h-[50vh] overflow-y-auto">
          {/* Main Image Thumbnail & Map Drawer Container */}
          <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-2 relative">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMapSidePanelOpen(!mapSidePanelOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                  mapSidePanelOpen || node.mapImage
                    ? 'bg-amber-500/18 text-amber-800 border-amber-600/40 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                    : 'bg-[#dcd7cc] text-[#3a362e] border-[#c3beb1] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{t('dashboard.mapSpace')} {node.mapImage && '✓'}</span>
              </button>

              <span className="text-[11px] text-[#5c584e] dark:text-neutral-500">
                {mapSidePanelOpen
                  ? node.mapImage
                    ? t('dashboard.hintClickMap')
                    : t('dashboard.hintNoMap')
                  : node.image
                  ? t('dashboard.hintClickPreview')
                  : t('dashboard.hintNoImage')}
              </span>
            </div>

            {/* Side Map Drawer (Expandable) */}
            {mapSidePanelOpen && (
              <div className="p-3 bg-[#e0dbd0] dark:bg-neutral-950 border border-amber-600/35 dark:border-amber-500/30 rounded-xl space-y-2.5 shadow-xl animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>{t('dashboard.mapRefTitle')}</span>
                  </span>
                  <button
                    onClick={() => setMapSidePanelOpen(false)}
                    className="text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-500 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {node.mapImage ? (
                  <div className="space-y-2">
                    <div
                      onClick={() => (mapImgError ? !isReadOnly && onOpenMapGalleryPicker() : onOpenMapViewer(node.id))}
                      className="aspect-video rounded-lg overflow-hidden bg-black border border-amber-600/40 dark:border-amber-500/40 cursor-pointer group relative shadow-md"
                      title={mapImgError ? t('dashboard.mapLibrary') : t('dashboard.openFullscreenMapTitle')}
                    >
                      {mapImgError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-3 text-center bg-red-950/35 text-red-200">
                          <ShreddedImageIcon className="w-8 h-8 text-red-400" />
                          <p className="text-[11px] font-medium leading-snug">{t('dashboard.mapUnavailable')}</p>
                        </div>
                      ) : (
                        <>
                          <img
                            src={node.mapImage}
                            alt={node.mapName}
                            referrerPolicy="no-referrer"
                            onError={() => setMapImgError(true)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                            <span className="px-2 py-1 rounded bg-black/80 text-amber-300 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                              {t('dashboard.openMapViewer')}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#3a362e] dark:text-neutral-300 font-medium truncate">{node.mapName || t('dashboard.defaultMapName')}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isReadOnly && (
                          <>
                            <button
                              type="button"
                              disabled={!hasApiKey}
                              onClick={() => onOpenAiImage('edit', 'map')}
                              title={
                                hasApiKey
                                  ? t('dashboard.aiEditMapTitle')
                                  : t('dashboard.configApiKeyTooltip')
                              }
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border transition-colors ${
                                hasApiKey
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40 cursor-pointer'
                                  : 'bg-[#dcd7cc]/70 text-[#7d776a] border-[#c8c3b6] dark:bg-neutral-800/60 dark:text-neutral-500 dark:border-neutral-800 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <Wand2 className="w-3 h-3" />
                              <span>{t('dashboard.editImage')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                                  document.documentElement.requestFullscreen().catch(() => {});
                                }
                                onOpenSketchStudio('map');
                              }}
                              title={t('dashboard.sketchMapTooltip')}
                              className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30 transition-colors cursor-pointer"
                            >
                              <PenTool className="w-3 h-3" />
                              <span>{t('dashboard.sketch')}</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={onRemoveMap}
                          className="text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-[11px] font-semibold cursor-pointer"
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      onClick={() => mapFileInputRef.current?.click()}
                      className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                        node.mapImageDeletedFromAdmin
                          ? 'border-red-600/60 bg-red-600/10 hover:bg-red-600/15 dark:border-red-500/60 dark:bg-red-950/25 dark:hover:bg-red-950/40'
                          : 'border-amber-600/50 dark:border-amber-500/40 hover:bg-amber-500/10'
                      }`}
                    >
                      {node.mapImageDeletedFromAdmin ? (
                        <div className="flex flex-col items-center gap-1">
                          <ShreddedImageIcon className="w-7 h-7 text-red-600 dark:text-red-500" />
                          <p className="text-xs text-red-800 dark:text-red-300 font-medium">{t('dashboard.mapDeletedAdmin')}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">{t('dashboard.pasteDropMap')}</p>
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
                    <div className="grid grid-cols-2 gap-1.5">
                      {!isReadOnly && (
                        <button
                          type="button"
                          disabled={!hasApiKey}
                          onClick={() => onOpenAiImage('create', 'map')}
                          title={
                            hasApiKey
                              ? t('dashboard.aiCreateMapTitle')
                              : t('dashboard.configApiKeyTooltip')
                          }
                          className={`py-1 px-2 text-xs font-semibold rounded-md border flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                            hasApiKey
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40 cursor-pointer'
                              : 'bg-[#dcd7cc]/70 text-[#7d776a] border-[#c8c3b6] dark:bg-neutral-800/60 dark:text-neutral-500 dark:border-neutral-800 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>{t('common.create')}</span>
                        </button>
                      )}
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                              document.documentElement.requestFullscreen().catch(() => {});
                            }
                            onOpenSketchStudio('map');
                          }}
                          title={t('dashboard.sketchMapCreateTooltip')}
                          className="py-1 px-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md border border-indigo-400/30 flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <PenTool className="w-3 h-3 shrink-0" />
                          <span>{t('dashboard.sketch1080p')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => mapFileInputRef.current?.click()}
                        disabled={isReadOnly}
                        className="py-1 px-2 text-xs text-[#3a362e] bg-[#dcd7cc] hover:bg-[#d2ccbf] border-[#c3beb1] dark:text-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-700 disabled:opacity-50 rounded-md border flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <FolderOpen className="w-3 h-3 shrink-0" />
                        <span>{t('dashboard.browsePc')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenMapGalleryPicker}
                        className="py-1 px-2 text-xs text-white bg-amber-600 hover:bg-amber-500 rounded-md font-semibold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <MapIcon className="w-3 h-3 shrink-0" />
                        <span>{t('dashboard.mapLibrary')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main Scene Image Box (hidden while Map Space is active) */}
            {!mapSidePanelOpen && (
              <>
                <div className="aspect-video rounded-xl overflow-hidden bg-[#dbd6ca] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 relative group shadow-inner">
                  {node.image && !mainImgError ? (
                    <div
                      onClick={() => onOpenPinning(node.id)}
                      className="w-full h-full cursor-pointer relative"
                      title={t('dashboard.pinningTooltip')}
                    >
                      <img
                        src={node.image}
                        alt={node.title}
                        referrerPolicy="no-referrer"
                        onError={() => setMainImgError(true)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-lg bg-black/80 border border-white/20 text-white text-xs font-semibold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                          <Edit className="w-3.5 h-3.5 text-blue-400" />
                          <span>{t('dashboard.fullscreenPinning')}</span>
                        </span>
                      </div>
                    </div>
                  ) : node.image && mainImgError ? (
                    <div
                      onClick={() => !isReadOnly && onOpenGalleryPicker()}
                      className={`w-full h-full border-2 border-dashed border-amber-600/70 dark:border-amber-500/70 bg-amber-600/10 dark:bg-amber-950/25 flex flex-col items-center justify-center p-4 text-center transition-colors ${
                        !isReadOnly ? 'hover:border-amber-500 hover:bg-amber-600/15 dark:hover:bg-amber-950/40 cursor-pointer' : ''
                      }`}
                    >
                      <ShreddedImageIcon className="w-10 h-10 text-amber-600 dark:text-amber-400 mb-1.5" />
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        {t('dashboard.imageUnavailable')}
                      </p>
                      <p className="text-[10px] text-amber-800/90 dark:text-amber-300/80 mt-1 max-w-xs leading-snug">
                        {node.image.startsWith('/uploads/')
                          ? t('dashboard.imageUnavailableLocalHint')
                          : t('dashboard.imageUnavailableHint')}
                      </p>
                    </div>
                  ) : node.imageDeletedFromAdmin ? (
                    <div
                      onClick={() => !isReadOnly && setShowDeletedImagePrompt(true)}
                      className={`w-full h-full border-2 border-dashed border-red-600/70 dark:border-red-500/70 bg-red-600/10 dark:bg-red-950/25 flex flex-col items-center justify-center p-4 text-center transition-colors ${
                        !isReadOnly ? 'hover:border-red-500 hover:bg-red-600/15 dark:hover:border-red-400 dark:hover:bg-red-950/40 cursor-pointer' : ''
                      }`}
                    >
                      <ShreddedImageIcon className="w-12 h-12 text-red-600 dark:text-red-500 mb-2" />
                      <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                        {t('dashboard.imageDeletedAdmin')}
                      </p>
                      {!isReadOnly && (
                        <p className="text-[10px] text-red-700/80 dark:text-red-300/70 mt-0.5">
                          {t('dashboard.clickToDecide')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => mainFileInputRef.current?.click()}
                      className="w-full h-full border-2 border-dashed border-[#b6b0a2] dark:border-neutral-700 hover:border-blue-600 dark:hover:border-blue-500 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors"
                    >
                      <UploadCloud className="w-8 h-8 text-[#6e695d] dark:text-neutral-500 mb-2" />
                      <p className="text-xs font-medium text-[#2b2924] dark:text-neutral-200">{t('dashboard.pasteDropScene')}</p>
                      <p className="text-[10px] text-[#5c584e] dark:text-neutral-500 mt-0.5">{t('dashboard.clickBrowseDevice')}</p>
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
                <div className="grid grid-cols-2 gap-2">
                  {!isReadOnly && (
                    <button
                      type="button"
                      disabled={!hasApiKey}
                      onClick={() => onOpenAiImage(node.image ? 'edit' : 'create', 'image')}
                      title={
                        !hasApiKey
                          ? t('dashboard.configApiKeyTooltip')
                          : node.image
                          ? t('dashboard.aiEditImageTitle')
                          : t('dashboard.aiCreateImageTitle')
                      }
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        hasApiKey
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40 shadow-sm cursor-pointer'
                          : 'bg-[#dcd7cc]/70 text-[#7d776a] border-[#c8c3b6] dark:bg-neutral-800/50 dark:text-neutral-500 dark:border-neutral-800 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {node.image ? (
                        <Wand2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{node.image ? t('dashboard.editImage') : t('common.create')}</span>
                    </button>
                  )}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen().catch(() => {});
                        }
                        onOpenSketchStudio('image');
                      }}
                      title={t('dashboard.sketchImageTooltip')}
                      className="py-1.5 px-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border border-indigo-400/30 shadow-sm flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <PenTool className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('dashboard.sketch1080p')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => mainFileInputRef.current?.click()}
                    disabled={isReadOnly}
                    className="py-1.5 px-2 text-xs text-[#3a362e] bg-[#dcd7cc] hover:bg-[#d2ccbf] border-[#c3beb1] dark:text-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-700 disabled:opacity-50 rounded-lg border flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('dashboard.browsePc')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenGalleryPicker}
                    className="py-1.5 px-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('dashboard.gallery')}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 3 Text Columns: Enfoque, Acción, Descripción */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1: Enfoque (Scene Actors + Focus notes) */}
            <div className="flex flex-col bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800/90 rounded-xl p-3 space-y-2">
              {/* Scene Actors Section (replaces top Enfoque video reference) */}
              <div className="border-b border-[#d4cfc3] dark:border-neutral-800/80 pb-2 space-y-2">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center gap-1.5 min-w-0 truncate">
                    <Box className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span className="truncate tabular-nums">
                      {t('dashboard.sceneActorsCount', { count: sceneActors.length })}
                    </span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={handleToggleActorPicker}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          actorPickerOpen
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-blue-600/12 hover:bg-blue-600/20 text-blue-800 border-blue-600/35 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 dark:text-blue-300 dark:border-blue-500/40'
                        }`}
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                        <span>{t('dashboard.addActor')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenActorLibrary}
                      title={t('dashboard.actorLibraryTitle')}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-[#dcd7cc] hover:bg-[#d2ccbf] text-[#3a362e] border border-[#c3beb1] dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Library className="w-3 h-3 shrink-0" />
                      <span>{t('dashboard.actorLibraryBtn')}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Add Actor Picker */}
                {actorPickerOpen && !isReadOnly && (
                  <div className="p-2 rounded-lg bg-[#ebe7de] dark:bg-neutral-900 border border-blue-600/35 dark:border-blue-500/40 space-y-1.5">
                    {actors.length === 0 ? (
                      <div className="space-y-1.5 text-center py-1">
                        <p className="text-[11px] text-[#5c584e] dark:text-neutral-400">
                          {t('dashboard.noLibraryActors')}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setActorPickerOpen(false);
                            onOpenActorLibrary();
                          }}
                          className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          {t('dashboard.openActorLibCta')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <select
                          value={pickedActor?.id || ''}
                          onChange={(e) => handleSelectPickActor(e.target.value)}
                          className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[11px] text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
                        >
                          {actors.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.category || t('actorLib.defaultCategory')})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedPickStateId || pickedActor?.states?.[0]?.id || ''}
                            onChange={(e) => setSelectedPickStateId(e.target.value)}
                            disabled={!pickedActor || pickedActor.states.length === 0}
                            className="flex-1 min-w-0 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-1 text-[11px] text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500 disabled:opacity-60"
                          >
                            {pickedActor && pickedActor.states.length > 0 ? (
                              pickedActor.states.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.label}
                                </option>
                              ))
                            ) : (
                              <option value="">{t('dashboard.noStatesDefined')}</option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={handleConfirmAddActor}
                            className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                          >
                            {t('common.add')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Assigned Scene Actors List */}
                {sceneActors.length === 0 ? (
                  !actorPickerOpen && (
                    <p className="text-[11px] text-[#6e695d] dark:text-neutral-500 py-0.5">
                      {t('dashboard.noActorsInScene')}
                    </p>
                  )
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-0.5">
                    {sceneActors.map((item) => {
                      const actor = actors.find((a) => a.id === item.actorId);
                      const liveState = actor?.states.find((s) => s.id === item.stateId);
                      const stateColor = liveState?.color || '#3b82f6';
                      const hasMatchingState = Boolean(
                        actor && actor.states.some((s) => s.id === item.stateId)
                      );

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c8c3b6] dark:border-neutral-800 rounded-lg p-1.5"
                        >
                          <button
                            type="button"
                            onClick={() => actor && onInspectActor(actor)}
                            disabled={!actor}
                            title={actor ? t('dashboard.inspectActorTitle') : t('dashboard.actorMissing')}
                            className={`w-7 h-7 rounded-md overflow-hidden border border-[#c3beb1] dark:border-neutral-700 bg-[#dcd7cc] dark:bg-neutral-950 flex items-center justify-center shrink-0 ${
                              actor
                                ? 'cursor-pointer hover:ring-2 hover:ring-blue-500/60 transition-all'
                                : 'opacity-60 cursor-default'
                            }`}
                          >
                            {actor?.thumbnailUrl && !brokenActorIds.has(actor.id) ? (
                              <img
                                src={actor.thumbnailUrl}
                                alt={actor.name}
                                referrerPolicy="no-referrer"
                                onError={() => {
                                  setBrokenActorIds((prev) => {
                                    const next = new Set(prev);
                                    next.add(actor.id);
                                    return next;
                                  });
                                }}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Box className="w-3.5 h-3.5 text-[#5c584e] dark:text-neutral-400" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: stateColor }}
                              />
                              <span className="text-[11px] font-semibold text-[#2b2924] dark:text-neutral-100 truncate">
                                {actor ? actor.name : t('dashboard.actorMissing')}
                              </span>
                            </div>

                            {actor && actor.states.length > 0 ? (
                              <select
                                value={item.stateId}
                                disabled={isReadOnly}
                                onChange={(e) =>
                                  handleChangeSceneActorState(item.id, e.target.value)
                                }
                                className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded px-1.5 py-0.5 text-[10px] text-[#3a362e] dark:text-neutral-300 outline-none focus:border-blue-500 disabled:opacity-70"
                              >
                                {!hasMatchingState && (
                                  <option value={item.stateId}>
                                    {item.stateLabel || t('dashboard.stateFallback')}
                                  </option>
                                )}
                                {actor.states.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] text-[#5c584e] dark:text-neutral-400 truncate">
                                {item.stateLabel || t('dashboard.noStatesDefined')}
                              </span>
                            )}
                          </div>

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSceneActor(item.id)}
                              title={t('dashboard.removeActorTitle')}
                              className="p-1 text-[#5c584e] hover:text-red-700 dark:text-neutral-500 dark:hover:text-red-400 shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{tColumn('enfoque')}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-600/12 text-blue-800 border-blue-600/30 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/30 border">
                  {t('dashboard.pinsCount', { count: countEnfoque })}
                </span>
              </div>

              <textarea
                value={enfoqueText}
                onChange={(e) => setEnfoqueText(e.target.value)}
                onBlur={handleSaveTextChanges}
                rows={5}
                placeholder={t('dashboard.enfoquePlaceholder')}
                className="flex-1 w-full bg-transparent text-xs text-[#2b2924] dark:text-neutral-200 outline-none resize-none leading-relaxed placeholder:text-[#757065] dark:placeholder:text-neutral-600"
              />
            </div>

            {/* Column 2: Acción */}
            <div className="flex flex-col bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800/90 rounded-xl p-3 space-y-2">
              <div className="border-b border-[#d4cfc3] dark:border-neutral-800/80 pb-2">
                {node.videos?.accion?.globalId ? (
                  <div className="flex items-center gap-2 bg-[#ebe7de] dark:bg-neutral-900 border border-orange-600/35 dark:border-orange-500/30 p-1.5 rounded-lg group/v">
                    <img
                      src={`https://img.youtube.com/vi/${node.videos.accion.globalId}/default.jpg`}
                      alt="Ref"
                      className="w-10 h-6 object-cover rounded cursor-pointer"
                      onClick={() => onOpenVideoPlayer('accion')}
                    />
                    <span
                      onClick={() => onOpenVideoPlayer('accion')}
                      className="text-[11px] font-medium text-orange-700 dark:text-orange-400 hover:underline truncate flex-1 cursor-pointer"
                    >
                      {globalVideos.find((g) => g.id === node.videos.accion?.globalId)?.name || t('dashboard.videoRef')}
                    </span>
                    <button
                      onClick={() => handleRemoveColumnVideo('accion')}
                      className="text-[#5c584e] hover:text-red-700 dark:text-neutral-500 dark:hover:text-red-400 p-0.5 cursor-pointer"
                      title={t('dashboard.removeVideo')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenAddVideoToColumn('accion')}
                    className="w-full py-1 text-[11px] text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 border border-dashed border-[#b8b2a4] hover:border-[#8f897d] dark:border-neutral-800 dark:hover:border-neutral-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('dashboard.addVideo')}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">{tColumn('accion')}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-orange-600/12 text-orange-800 border-orange-600/30 dark:bg-orange-600/20 dark:text-orange-300 dark:border-orange-500/30 border">
                  {t('dashboard.pinsCount', { count: countAccion })}
                </span>
              </div>

              <textarea
                value={accionText}
                onChange={(e) => setAccionText(e.target.value)}
                onBlur={handleSaveTextChanges}
                rows={5}
                placeholder={t('dashboard.accionPlaceholder')}
                className="flex-1 w-full bg-transparent text-xs text-[#2b2924] dark:text-neutral-200 outline-none resize-none leading-relaxed placeholder:text-[#757065] dark:placeholder:text-neutral-600"
              />
            </div>

            {/* Column 3: Descripción */}
            <div className="flex flex-col bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800/90 rounded-xl p-3 space-y-2">
              <div className="border-b border-[#d4cfc3] dark:border-neutral-800/80 pb-2">
                {node.videos?.descripcion?.globalId ? (
                  <div className="flex items-center gap-2 bg-[#ebe7de] dark:bg-neutral-900 border border-emerald-600/35 dark:border-emerald-500/30 p-1.5 rounded-lg group/v">
                    <img
                      src={`https://img.youtube.com/vi/${node.videos.descripcion.globalId}/default.jpg`}
                      alt="Ref"
                      className="w-10 h-6 object-cover rounded cursor-pointer"
                      onClick={() => onOpenVideoPlayer('descripcion')}
                    />
                    <span
                      onClick={() => onOpenVideoPlayer('descripcion')}
                      className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline truncate flex-1 cursor-pointer"
                    >
                      {globalVideos.find((g) => g.id === node.videos.descripcion?.globalId)?.name || t('dashboard.videoRef')}
                    </span>
                    <button
                      onClick={() => handleRemoveColumnVideo('descripcion')}
                      className="text-[#5c584e] hover:text-red-700 dark:text-neutral-500 dark:hover:text-red-400 p-0.5 cursor-pointer"
                      title={t('dashboard.removeVideo')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenAddVideoToColumn('descripcion')}
                    className="w-full py-1 text-[11px] text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 border border-dashed border-[#b8b2a4] hover:border-[#8f897d] dark:border-neutral-800 dark:hover:border-neutral-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('dashboard.addVideo')}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{tColumn('descripcion')}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-600/12 text-emerald-800 border-emerald-600/30 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30 border">
                  {t('dashboard.pinsCount', { count: countDescripcion })}
                </span>
              </div>

              <textarea
                value={descripcionText}
                onChange={(e) => setDescripcionText(e.target.value)}
                onBlur={handleSaveTextChanges}
                rows={5}
                placeholder={t('dashboard.descripcionPlaceholder')}
                className="flex-1 w-full bg-transparent text-xs text-[#2b2924] dark:text-neutral-200 outline-none resize-none leading-relaxed placeholder:text-[#757065] dark:placeholder:text-neutral-600"
              />
            </div>
          </div>
        </div>

        {/* Dashboard Bottom Area: Comments & Tasks */}
        <div className="flex-1 flex flex-col p-4 bg-[#e3ded3] dark:bg-neutral-950/60 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#2b2924] dark:text-neutral-200 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>{t('dashboard.commentsHeader', { count: node.pins?.length || 0 })}</span>
            </h3>
            <span className="text-[10px] text-[#5c584e] dark:text-neutral-500">
              {t('dashboard.commentsHint')}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {!node.pins || node.pins.length === 0 ? (
              <div className="text-center py-10 text-[#6e695d] dark:text-neutral-500 text-xs">
                {t('dashboard.noComments')}
              </div>
            ) : (
              node.pins.map((pin) => {
                const borderClass =
                  pin.type === 'enfoque'
                    ? 'border-l-blue-600 dark:border-l-blue-500'
                    : pin.type === 'accion'
                    ? 'border-l-orange-600 dark:border-l-orange-500'
                    : 'border-l-emerald-600 dark:border-l-emerald-500';

                return (
                  <div
                    key={pin.id}
                    className={`p-3 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c8c3b6] dark:border-neutral-800/90 rounded-xl border-l-4 ${borderClass} space-y-2`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#2b2924] dark:text-neutral-200">
                          {t('dashboard.pinItemTitle', {
                            num: pin.num,
                            layer: tColumn(pin.type).toUpperCase(),
                          })}
                        </span>
                        <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
                          {t('dashboard.byAuthor', { author: pin.author })}
                        </span>
                        {pin.edited && (
                          <span className="text-[10px] text-[#6e695d] dark:text-neutral-500 italic">
                            {t('dashboard.editedTag')}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#3a362e] dark:text-neutral-300 leading-relaxed">{pin.text}</p>

                    {/* Replies */}
                    {pin.replies && pin.replies.length > 0 && (
                      <div className="pl-3 border-l-2 border-[#c3beb1] dark:border-neutral-800 space-y-1 text-xs text-[#5c584e] dark:text-neutral-400 py-1">
                        {pin.replies.map((r, i) => (
                          <div key={i}>
                            <span className="font-semibold text-[#2b2924] dark:text-neutral-300">{r.author}: </span>
                            <span>{r.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions bar */}
                    <div className="flex items-center gap-4 pt-2 border-t border-[#d4cfc3] dark:border-neutral-800/60 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[#3a362e] dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={pin.review || false}
                          onChange={() => handleToggleCheck(pin.id, 'review')}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>{t('dashboard.review')}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-[#3a362e] dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={pin.done || false}
                          onChange={() => handleToggleCheck(pin.id, 'done')}
                          className="rounded text-emerald-600 focus:ring-0"
                        />
                        <span>{t('common.done')}</span>
                      </label>

                      <button
                        onClick={() => handleAddReply(pin.id)}
                        className="text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer"
                      >
                        {t('dashboard.replyAction')}
                      </button>

                      {pin.author === currentUserName && (
                        <button
                          onClick={() => handleEditPin(pin.id)}
                          className="text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 font-medium cursor-pointer"
                        >
                          {t('dashboard.editAction')}
                        </button>
                      )}

                      <button
                        onClick={() => handleDeletePin(pin.id)}
                        className="text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-auto font-medium cursor-pointer"
                      >
                        {t('common.delete')}
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
