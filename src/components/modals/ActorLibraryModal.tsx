import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActorItem, ActorStateOption, WorkflowNode } from '../../types/workflow';
import { uploadImageToStorage } from '../../services/storageService';
import {
  Box,
  Check,
  Globe,
  Layers,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { AiImagePromptModal } from './AiImagePromptModal';
import { LibraryWebSearchModal } from './LibraryWebSearchModal';
import { importExternalImageAsFile } from '../../services/librarySearchService';

const STATE_COLOR_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#64748b',
];

interface ActorLibraryModalProps {
  actors: ActorItem[];
  nodes: Record<string, WorkflowNode>;
  projectId: string;
  projectTitle?: string;
  isReadOnly?: boolean;
  userApiKey?: string | null;
  author: string;
  initialEditActorId?: string | null;
  pickNodeTitle?: string | null;
  onClose: () => void;
  onSaveActor: (actor: ActorItem) => Promise<void>;
  onDeleteActor: (actor: ActorItem) => Promise<void>;
  onInspectActor: (actor: ActorItem) => void;
  onPickActorForNode?: (actor: ActorItem, stateOption: ActorStateOption | null) => void;
}

export const ActorLibraryModal: React.FC<ActorLibraryModalProps> = ({
  actors,
  nodes,
  projectId,
  projectTitle,
  isReadOnly = false,
  userApiKey = null,
  author,
  initialEditActorId = null,
  pickNodeTitle = null,
  onClose,
  onSaveActor,
  onDeleteActor,
  onInspectActor,
  onPickActorForNode,
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [editorMode, setEditorMode] = useState<'list' | 'form'>('list');
  const [editingActorId, setEditingActorId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailPath, setThumbnailPath] = useState<string | undefined>(undefined);
  const [states, setStates] = useState<ActorStateOption[]>([]);
  const [newStateLabel, setNewStateLabel] = useState('');
  const [newStateColor, setNewStateColor] = useState(STATE_COLOR_PALETTE[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [webSearchOpen, setWebSearchOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allProjectTags = useMemo(() => {
    const tagSet = new Set<string>();
    actors.forEach((a) => {
      (a.tags || []).forEach((tg) => {
        const clean = tg.trim();
        if (clean) tagSet.add(clean);
      });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [actors]);

  const actorUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(nodes).forEach((node) => {
      const seen = new Set<string>();
      (node.actors || []).forEach((assignment) => {
        if (!seen.has(assignment.actorId)) {
          seen.add(assignment.actorId);
          counts[assignment.actorId] = (counts[assignment.actorId] || 0) + 1;
        }
      });
    });
    return counts;
  }, [nodes]);

  const openCreateForm = () => {
    setEditingActorId(null);
    setName('');
    setCategory('');
    setDescription('');
    setThumbnailUrl(null);
    setThumbnailPath(undefined);
    setStates([
      {
        id: `state-${Date.now()}`,
        label: t('actorLib.stateDefault'),
        color: STATE_COLOR_PALETTE[0],
      },
    ]);
    setNewStateLabel('');
    setNewStateColor(STATE_COLOR_PALETTE[1]);
    setTags([]);
    setNewTagInput('');
    setFormError(null);
    setEditorMode('form');
  };

  const openEditForm = (actor: ActorItem) => {
    setEditingActorId(actor.id);
    setName(actor.name);
    setCategory(actor.category || '');
    setDescription(actor.description || '');
    setThumbnailUrl(actor.thumbnailUrl || null);
    setThumbnailPath(actor.thumbnailPath);
    setStates(
      (actor.states || []).length > 0
        ? actor.states.map((s) => ({ ...s }))
        : [
            {
              id: `state-${Date.now()}`,
              label: t('actorLib.stateDefault'),
              color: STATE_COLOR_PALETTE[0],
            },
          ]
    );
    setNewStateLabel('');
    setNewStateColor(STATE_COLOR_PALETTE[(actor.states?.length || 0) % STATE_COLOR_PALETTE.length]);
    setTags([...(actor.tags || [])]);
    setNewTagInput('');
    setFormError(null);
    setEditorMode('form');
  };

  useEffect(() => {
    if (initialEditActorId) {
      const target = actors.find((a) => a.id === initialEditActorId);
      if (target) {
        openEditForm(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditActorId]);

  const handleUploadThumbnail = async (file: File) => {
    setFormError(null);
    setIsUploadingThumb(true);
    try {
      const res = await uploadImageToStorage(file, 'objects');
      setThumbnailUrl(res.url);
      setThumbnailPath(res.storagePath);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('actorLib.uploadFailed'));
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const handleAddState = () => {
    const clean = newStateLabel.trim();
    if (!clean) return;
    setStates((prev) => [
      ...prev,
      {
        id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: clean.slice(0, 60),
        color: newStateColor,
      },
    ]);
    setNewStateLabel('');
    setNewStateColor(STATE_COLOR_PALETTE[(states.length + 1) % STATE_COLOR_PALETTE.length]);
  };

  const handleAddTag = (raw?: string) => {
    const clean = (raw ?? newTagInput).trim().replace(/^#/, '');
    if (!clean) return;
    if (!tags.some((tItem) => tItem.toLowerCase() === clean.toLowerCase())) {
      setTags((prev) => [...prev, clean.slice(0, 40)]);
    }
    if (!raw) setNewTagInput('');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t('actorLib.nameRequired'));
      return;
    }

    const cleanedStates = states
      .map((s) => ({
        ...s,
        label: s.label.trim(),
      }))
      .filter((s) => Boolean(s.label));

    const existingActor = editingActorId ? actors.find((a) => a.id === editingActorId) : null;
    const now = new Date().toISOString();
    const payload: ActorItem = {
      id: existingActor?.id || `actor-${Date.now()}`,
      projectId,
      name: trimmedName,
      category: category.trim(),
      description: description.trim(),
      thumbnailUrl: thumbnailUrl?.trim() || null,
      ...(thumbnailPath ? { thumbnailPath } : {}),
      states:
        cleanedStates.length > 0
          ? cleanedStates
          : [{ id: `st-${Date.now()}`, label: t('actorLib.stateDefault'), color: '#3b82f6' }],
      tags,
      author: existingActor?.author || author || t('common.unknown'),
      createdAt: existingActor?.createdAt || now,
      updatedAt: now,
    };

    setIsSaving(true);
    try {
      await onSaveActor(payload);
      setEditorMode('list');
      setEditingActorId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredActors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return actors.filter((a) => {
      if (selectedTagFilter !== 'all' && !(a.tags || []).includes(selectedTagFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.tags || []).some((tg) => tg.toLowerCase().includes(q)) ||
        (a.states || []).some((st) => st.label.toLowerCase().includes(q))
      );
    });
  }, [actors, search, selectedTagFilter]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-4xl max-h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
              <h3 className="font-semibold text-sm text-[#2b2924] dark:text-neutral-100 truncate">
                {pickNodeTitle ? `${t('actorLib.pickForSceneTitle')}: ${pickNodeTitle}` : t('actorLib.title')}
              </h3>
              {projectTitle && (
                <span className="text-xs text-[#635e54] dark:text-neutral-400 truncate max-w-[180px]">
                  · {projectTitle}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 mt-0.5 truncate">
              {t('actorLib.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editorMode === 'list' && !isReadOnly && (
              <button
                type="button"
                onClick={openCreateForm}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('actorLib.newActor')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white shrink-0 cursor-pointer"
              title={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LIST / GALLERY VIEW */}
        {editorMode === 'list' && (
          <>
            {/* Search & Tag Filter Bar */}
            <div className="px-5 py-3 border-b border-[#d4cfc3] dark:border-neutral-800 bg-[#e3ded3] dark:bg-neutral-950/60 space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6e695d] dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('actorLib.searchPlaceholder')}
                  className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                />
              </div>

              {allProjectTags.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTagFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedTagFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#dcd7cc] text-[#4a463d] hover:text-[#1f1d18] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:text-white'
                    }`}
                  >
                    {t('actorLib.allTags')}
                  </button>
                  {allProjectTags.map((tg) => (
                    <button
                      key={tg}
                      type="button"
                      onClick={() => setSelectedTagFilter(tg === selectedTagFilter ? 'all' : tg)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedTagFilter === tg
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#dcd7cc] text-[#4a463d] hover:text-[#1f1d18] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:text-white'
                      }`}
                    >
                      #{tg}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actors Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {actors.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Box className="w-10 h-10 text-[#7d776a] dark:text-neutral-600 mx-auto" />
                  <p className="text-xs text-[#5c584e] dark:text-neutral-400">{t('actorLib.empty')}</p>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('actorLib.createFirst')}</span>
                    </button>
                  )}
                </div>
              ) : filteredActors.length === 0 ? (
                <div className="text-center py-14 text-xs text-[#6e695d] dark:text-neutral-500">
                  {t('actorLib.emptyFiltered')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredActors.map((actor) => {
                    const sceneCount = actorUsageCounts[actor.id] || 0;
                    return (
                      <div
                        key={actor.id}
                        className="bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col"
                      >
                        {/* Clickable Thumbnail */}
                        <button
                          type="button"
                          onClick={() => onInspectActor(actor)}
                          className="relative aspect-video w-full bg-[#d3cec2] dark:bg-neutral-900 overflow-hidden group cursor-pointer border-b border-[#c8c3b6] dark:border-neutral-800"
                          title={t('actorLib.clickThumbHint')}
                        >
                          {actor.thumbnailUrl ? (
                            <img
                              src={actor.thumbnailUrl}
                              alt={actor.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-[#757065] dark:text-neutral-600 gap-1">
                              <Box className="w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-left">
                            <span className="text-[10px] font-medium text-white">
                              {t('actorLib.clickThumbHint')}
                            </span>
                          </div>
                        </button>

                        {/* Actor Info */}
                        <div className="p-3 flex-1 flex flex-col gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#2b2924] dark:text-neutral-100 truncate">
                              {actor.name}
                            </h4>
                            <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 flex items-center gap-1.5 mt-0.5 tabular-nums">
                              <span className="truncate">{actor.category || t('actorLib.defaultCategory')}</span>
                              <span aria-hidden="true">·</span>
                              <span>{t('actorLib.statesSummary', { count: actor.states.length })}</span>
                              <span aria-hidden="true">·</span>
                              <span>{t('actorLib.scenesUsage', { count: sceneCount })}</span>
                            </p>
                          </div>

                          {actor.states.length > 0 && (
                            <div className="text-[11px] text-[#3a362e] dark:text-neutral-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {actor.states.slice(0, 4).map((st) => (
                                <span key={st.id} className="inline-flex items-center gap-1">
                                  <span
                                    className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ backgroundColor: st.color || '#3b82f6' }}
                                  />
                                  <span className="truncate max-w-[90px]">{st.label}</span>
                                </span>
                              ))}
                              {actor.states.length > 4 && (
                                <span className="text-[10px] text-[#6e695d] dark:text-neutral-500">
                                  +{actor.states.length - 4}
                                </span>
                              )}
                            </div>
                          )}

                          {actor.tags.length > 0 && (
                            <div className="text-[10px] font-mono text-[#635e54] dark:text-neutral-400 truncate">
                              {actor.tags.map((tg) => `#${tg}`).join(' · ')}
                            </div>
                          )}

                          <div className="mt-auto pt-2 border-t border-[#d4cfc3] dark:border-neutral-800/80 flex items-center justify-between gap-2">
                            {onPickActorForNode ? (
                              <button
                                type="button"
                                onClick={() => onPickActorForNode(actor, actor.states[0] || null)}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{t('actorLib.addToScene')}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onInspectActor(actor)}
                                className="text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {t('actorDetail.title')}
                              </button>
                            )}

                            {!isReadOnly && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditForm(actor)}
                                  className="p-1.5 rounded-md text-[#5c584e] hover:text-blue-700 hover:bg-[#d5cfc2] dark:text-neutral-400 dark:hover:text-blue-300 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                  title={t('common.edit')}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(t('actorLib.confirmDelete', { name: actor.name }))) {
                                      onDeleteActor(actor);
                                    }
                                  }}
                                  className="p-1.5 rounded-md text-[#5c584e] hover:text-red-700 hover:bg-[#d5cfc2] dark:text-neutral-400 dark:hover:text-red-400 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* CREATE / EDIT ACTOR FORM VIEW */}
        {editorMode === 'form' && (
          <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[#d4cfc3] dark:border-neutral-800 pb-3">
              <h4 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100">
                {editingActorId ? t('actorLib.editActor') : t('actorLib.createActor')}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setEditorMode('list');
                  setEditingActorId(null);
                }}
                className="text-xs font-medium text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              >
                {t('common.back')}
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-600/15 dark:bg-red-950/60 border border-red-600/35 dark:border-red-800/70 text-xs text-red-800 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Thumbnail Column */}
              <div className="md:col-span-4 space-y-2.5">
                <label className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 block">
                  {t('actorLib.thumbnailLabel')}
                </label>
                <div className="aspect-square rounded-xl overflow-hidden bg-[#dbd6ca] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 flex items-center justify-center relative">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={name || 'Actor'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-[#6e695d] dark:text-neutral-500 p-4 text-center">
                      <UploadCloud className="w-8 h-8" />
                      <span className="text-[11px]">{t('actorLib.uploadThumbnail')}</span>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadThumbnail(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploadingThumb}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-xs font-medium text-[#2b2924] dark:text-neutral-200 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {isUploadingThumb
                      ? t('common.uploading')
                      : thumbnailUrl
                      ? t('actorLib.changeThumbnail')
                      : t('actorLib.uploadThumbnail')}
                  </button>
                  {thumbnailUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnailUrl(null);
                        setThumbnailPath(undefined);
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-red-600/12 hover:bg-red-600/20 text-red-800 dark:text-red-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      {t('actorLib.removeThumbnail')}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isUploadingThumb}
                  onClick={() => setAiModalOpen(true)}
                  title={
                    thumbnailUrl
                      ? t('actorLib.nanoBananaEditTooltip')
                      : t('actorLib.nanoBananaCreateTooltip')
                  }
                  className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  {thumbnailUrl ? (
                    <Wand2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {thumbnailUrl
                      ? t('actorLib.nanoBananaEditBtn')
                      : t('actorLib.nanoBananaCreateBtn')}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isUploadingThumb}
                  onClick={() => setWebSearchOpen(true)}
                  title={t('actorLib.searchWebImageTooltip')}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white border border-blue-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('actorLib.searchWebImageBtn')}</span>
                </button>

                <input
                  type="text"
                  value={thumbnailUrl || ''}
                  onChange={(e) => {
                    setThumbnailUrl(e.target.value || null);
                    setThumbnailPath(undefined);
                  }}
                  placeholder={t('actorLib.thumbnailUrlPlaceholder')}
                  className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-[11px] text-[#2b2924] dark:text-neutral-200 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                />
              </div>

              {/* Metadata, States & Tags Column */}
              <div className="md:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 block mb-1">
                      {t('actorLib.nameLabel')} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('actorLib.namePlaceholder')}
                      maxLength={150}
                      required
                      className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 block mb-1">
                      {t('actorLib.categoryLabel')}
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder={t('actorLib.categoryPlaceholder')}
                      maxLength={80}
                      className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 block mb-1">
                    {t('actorLib.descriptionLabel')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('actorLib.descriptionPlaceholder')}
                    rows={3}
                    maxLength={2000}
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500 resize-y"
                  />
                </div>

                {/* Configurable Scene States */}
                <div className="border-t border-[#d4cfc3] dark:border-neutral-800 pt-3.5 space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                      <span>{t('actorLib.statesLabel')}</span>
                    </label>
                    <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 mt-0.5">
                      {t('actorLib.statesHelp')}
                    </p>
                  </div>

                  {/* Add new state bar */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <div className="flex items-center gap-1 shrink-0 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-2 py-1.5">
                      {STATE_COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewStateColor(c)}
                          className={`w-3.5 h-3.5 rounded-sm transition-transform cursor-pointer ${
                            newStateColor === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newStateLabel}
                      onChange={(e) => setNewStateLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddState();
                        }
                      }}
                      placeholder={t('actorLib.statePlaceholder')}
                      className="flex-1 min-w-[160px] bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddState}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t('actorLib.addState')}
                    </button>
                  </div>

                  {/* Existing configured states */}
                  {states.length === 0 ? (
                    <p className="text-[11px] text-[#6e695d] dark:text-neutral-500">
                      {t('actorLib.noStatesYet')}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {states.map((st, idx) => (
                        <div
                          key={st.id}
                          className="flex items-center gap-2 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 rounded-lg px-2.5 py-1.5"
                        >
                          <input
                            type="color"
                            value={st.color || '#3b82f6'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStates((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, color: val } : item))
                              );
                            }}
                            className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0 p-0"
                          />
                          <input
                            type="text"
                            value={st.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStates((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, label: val } : item))
                              );
                            }}
                            className="flex-1 bg-transparent text-xs text-[#2b2924] dark:text-neutral-100 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setStates((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-[#5c584e] hover:text-red-700 dark:text-neutral-500 dark:hover:text-red-400 p-0.5 cursor-pointer"
                            title={t('common.remove')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Configurable Tags */}
                <div className="border-t border-[#d4cfc3] dark:border-neutral-800 pt-3.5 space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      <span>{t('actorLib.tagsLabel')}</span>
                    </label>
                    <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 mt-0.5">
                      {t('actorLib.tagsHelp')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder={t('actorLib.tagPlaceholder')}
                      className="flex-1 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      className="px-3 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-xs font-semibold text-[#2b2924] dark:text-neutral-200 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t('actorLib.addTag')}
                    </button>
                  </div>

                  {/* Active tags on this actor */}
                  {tags.length === 0 ? (
                    <p className="text-[11px] text-[#6e695d] dark:text-neutral-500">
                      {t('actorLib.noTagsYet')}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tags.map((tg) => (
                        <button
                          key={tg}
                          type="button"
                          onClick={() => setTags((prev) => prev.filter((item) => item !== tg))}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-600/35 text-amber-900 dark:text-amber-300 text-[11px] font-mono hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-800 dark:hover:text-red-300 transition-colors cursor-pointer"
                          title={t('common.remove')}
                        >
                          <span>#{tg}</span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick reuse existing project tags */}
                  {allProjectTags.some((pt) => !tags.includes(pt)) && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-[#5c584e] dark:text-neutral-400">
                        {t('actorLib.suggestedTags')}
                      </span>
                      {allProjectTags
                        .filter((pt) => !tags.includes(pt))
                        .map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => handleAddTag(pt)}
                            className="px-2 py-0.5 rounded-md bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#3a362e] dark:text-neutral-300 font-mono transition-colors cursor-pointer"
                          >
                            + #{pt}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Save Row */}
            <div className="pt-4 border-t border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditorMode('list');
                  setEditingActorId(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#3a362e] hover:bg-[#dcd7cc] dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploadingThumb}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? t('common.saving') : t('common.save')}</span>
              </button>
            </div>
          </form>
        )}
        </div>
      </div>

      {aiModalOpen && (
        <AiImagePromptModal
          mode={thumbnailUrl ? 'edit' : 'create'}
          targetKind="image"
          sourceImageUrl={thumbnailUrl}
          defaultTitle={name.trim() || t('actorLib.defaultCategory')}
          defaultAspectRatio="1:1"
          userApiKey={userApiKey}
          applyButtonLabel={t('actorLib.nanoBananaApplyLabel')}
          onApplyFile={handleUploadThumbnail}
          onClose={() => setAiModalOpen(false)}
        />
      )}

      {webSearchOpen && (
        <LibraryWebSearchModal
          kind="images"
          userApiKey={userApiKey}
          multiSelect={false}
          isImporting={isUploadingThumb}
          onClose={() => setWebSearchOpen(false)}
          onConfirmImages={async (items) => {
            const chosen = items[0];
            if (!chosen) return;
            setFormError(null);
            setIsUploadingThumb(true);
            try {
              const file = await importExternalImageAsFile(chosen.imageUrl, chosen.title);
              await handleUploadThumbnail(file);
              setWebSearchOpen(false);
            } catch (err) {
              setThumbnailUrl(chosen.imageUrl);
              setThumbnailPath(undefined);
              setWebSearchOpen(false);
              if (err instanceof Error && !/4 MB/i.test(err.message)) {
                console.warn('Imported web image by direct URL fallback:', err.message);
              }
            } finally {
              setIsUploadingThumb(false);
            }
          }}
        />
      )}
    </>
  );
};
