import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageResource, Project, UserProfile } from '../../types/workflow';
import {
  Archive,
  Check,
  FolderKanban,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Search,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface AdminConsoleModalProps {
  currentUser: UserProfile;
  projects: Project[];
  users: UserProfile[];
  images: ImageResource[];
  activeProjectId: string;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (title: string, description: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onToggleProjectStatus: (projectId: string, currentStatus: 'active' | 'archived') => Promise<void>;
  onUpdateUserRole: (uid: string, role: 'Admin' | 'Editor' | 'Viewer') => Promise<void>;
  onInviteUser: (email: string, role: 'Admin' | 'Editor' | 'Viewer') => Promise<void>;
  onDeleteUser: (user: UserProfile) => Promise<void>;
  onSetProjectParticipant: (
    project: Project,
    email: string,
    role: 'Admin' | 'Editor' | 'Viewer',
    meta?: { uid?: string; name?: string }
  ) => Promise<void>;
  onRemoveProjectParticipant: (project: Project, email: string) => Promise<void>;
  onSaveUserProjects: (
    user: UserProfile,
    assignments: Record<string, 'Admin' | 'Editor' | 'Viewer' | null>
  ) => Promise<void>;
  onDeleteImageRecord: (imageId: string) => Promise<void>;
  onDeleteImagesBatch: (imageIds: string[]) => Promise<void>;
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({
  currentUser,
  projects,
  users,
  images,
  activeProjectId,
  onClose,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onToggleProjectStatus,
  onUpdateUserRole,
  onInviteUser,
  onDeleteUser,
  onSetProjectParticipant,
  onRemoveProjectParticipant,
  onSaveUserProjects,
  onDeleteImageRecord,
  onDeleteImagesBatch,
}) => {
  const { t, tRole, locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<'projects' | 'users' | 'images'>('projects');

  // New Project Form
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isProjectSubmitting, setIsProjectSubmitting] = useState(false);

  // New User Invite Form
  const [isInvitingUser, setIsInvitingUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Editor' | 'Viewer'>('Editor');
  const [inviteProjectIds, setInviteProjectIds] = useState<Record<string, boolean>>({});
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);

  // Team & Roles: Project Scope + Per-User Assignment + Delete Confirmation
  const [selectedTeamProjectId, setSelectedTeamProjectId] = useState<string>('all');
  const [addParticipantEmail, setAddParticipantEmail] = useState<string>('');
  const [addParticipantRole, setAddParticipantRole] = useState<'Admin' | 'Editor' | 'Viewer'>('Editor');
  const [editingUserKey, setEditingUserKey] = useState<string | null>(null);
  const [draftUserAssignments, setDraftUserAssignments] = useState<
    Record<string, 'Admin' | 'Editor' | 'Viewer' | null>
  >({});
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [confirmDeleteUserKey, setConfirmDeleteUserKey] = useState<string | null>(null);
  const [deletingUserKey, setDeletingUserKey] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Image DB: Project scope, resolved sizes (HEAD fallback for legacy uploads), selection & bulk delete
  const [selectedImageProjectId, setSelectedImageProjectId] = useState<string>('all');
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [confirmDeleteImagesMode, setConfirmDeleteImagesMode] = useState<
    null | { type: 'selected' } | { type: 'all'; scopeId: string; scopeTitle: string; ids: string[] }
  >(null);
  const [isDeletingImages, setIsDeletingImages] = useState(false);
  const [resolvedImageSizes, setResolvedImageSizes] = useState<Record<string, number>>({});
  const probedImageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = images.filter(
      (img) =>
        typeof img.sizeBytes !== 'number' &&
        !probedImageIdsRef.current.has(img.id) &&
        Boolean(img.url)
    );
    if (missing.length === 0) return;

    let cancelled = false;
    missing.forEach((img) => probedImageIdsRef.current.add(img.id));

    (async () => {
      const updates: Record<string, number> = {};
      await Promise.all(
        missing.map(async (img) => {
          try {
            const res = await fetch(img.url, { method: 'HEAD' });
            if (res.ok) {
              const len = Number(res.headers.get('content-length'));
              if (Number.isFinite(len) && len >= 0) {
                updates[img.id] = len;
              }
            }
          } catch {
            // ignore unreachable URLs
          }
        })
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setResolvedImageSizes((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [images]);

  const getImageBytes = (img: ImageResource): number => {
    if (typeof img.sizeBytes === 'number' && img.sizeBytes >= 0) return img.sizeBytes;
    return resolvedImageSizes[img.id] ?? 0;
  };

  const formatMB = (bytes: number): string => {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const projectIdsSet = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);

  const getImageBucketId = (img: ImageResource): string => {
    return img.projectId && projectIdsSet.has(img.projectId) ? img.projectId : '__unassigned__';
  };

  const storageByProject = useMemo(() => {
    const stats: Record<string, { count: number; bytes: number }> = {};
    images.forEach((img) => {
      const bucket = getImageBucketId(img);
      if (!stats[bucket]) stats[bucket] = { count: 0, bytes: 0 };
      stats[bucket].count += 1;
      stats[bucket].bytes += getImageBytes(img);
    });
    return stats;
  }, [images, projectIdsSet, resolvedImageSizes]);

  const totalWorkspaceBytes = useMemo(
    () => images.reduce((acc, img) => acc + getImageBytes(img), 0),
    [images, resolvedImageSizes]
  );

  const isSuperUser = currentUser.email.trim().toLowerCase() === 'adrian.byakko@gmail.com';
  const selectedTeamProject =
    selectedTeamProjectId === 'all'
      ? null
      : projects.find((p) => p.id === selectedTeamProjectId) || null;

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsProjectSubmitting(true);
    try {
      await onCreateProject(newTitle.trim(), newDescription.trim());
      setNewTitle('');
      setNewDescription('');
      setIsCreatingProject(false);
    } finally {
      setIsProjectSubmitting(false);
    }
  };

  const handleInviteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    setIsUserSubmitting(true);
    try {
      await onInviteUser(cleanEmail, inviteRole);
      const selectedIds = Object.keys(inviteProjectIds).filter((pid) => inviteProjectIds[pid]);
      if (selectedTeamProject && !selectedIds.includes(selectedTeamProject.id)) {
        selectedIds.push(selectedTeamProject.id);
      }
      for (const pid of selectedIds) {
        const targetProj = projects.find((p) => p.id === pid);
        if (targetProj) {
          await onSetProjectParticipant(targetProj, cleanEmail, inviteRole, {
            name: cleanEmail.split('@')[0],
          });
        }
      }
      setInviteEmail('');
      setInviteProjectIds({});
      setIsInvitingUser(false);
    } finally {
      setIsUserSubmitting(false);
    }
  };

  const getUserProjects = (email: string) => {
    const clean = email.trim().toLowerCase();
    return projects
      .filter((p) => p.participants && clean in p.participants)
      .map((p) => ({
        project: p,
        role: p.participants![clean].role,
      }));
  };

  const openUserProjectEditor = (u: UserProfile) => {
    const clean = (u.email || '').trim().toLowerCase();
    const key = u.uid || clean;
    if (editingUserKey === key) {
      setEditingUserKey(null);
      return;
    }
    const nextDraft: Record<string, 'Admin' | 'Editor' | 'Viewer' | null> = {};
    projects.forEach((p) => {
      const entry = p.participants?.[clean];
      nextDraft[p.id] = entry ? entry.role : null;
    });
    setDraftUserAssignments(nextDraft);
    setEditingUserKey(key);
  };

  const handleSaveAssignmentsSubmit = async (u: UserProfile) => {
    setIsSavingAssignments(true);
    try {
      await onSaveUserProjects(u, draftUserAssignments);
      setEditingUserKey(null);
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredUsers = users.filter(
    (u) =>
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredImages = images.filter((img) => {
    const matchesSearch =
      img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.url.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedImageProjectId === 'all') return true;
    return getImageBucketId(img) === selectedImageProjectId;
  });

  const toggleImageSelected = (id: string) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmBatchDelete = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    setIsDeletingImages(true);
    try {
      await onDeleteImagesBatch(idsToDelete);
      setSelectedImageIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setConfirmDeleteImagesMode(null);
    } finally {
      setIsDeletingImages(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-5xl h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/12 border border-blue-600/30 text-blue-700 dark:bg-blue-600/20 dark:border-blue-500/30 dark:text-blue-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2b2924] dark:text-neutral-100 flex items-center gap-2">
                {t('admin.title')}
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-600/12 text-blue-800 border border-blue-600/30 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/30">
                  {t('admin.badge')}
                </span>
              </h2>
              <p className="text-xs text-[#5c584e] dark:text-neutral-400">
                {t('admin.subtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-transparent flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation & Search Bar */}
        <div className="px-4 py-2.5 border-b border-[#d4cfc3] dark:border-neutral-800 bg-[#e3ded3] dark:bg-neutral-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-[#d8d3c8] dark:bg-neutral-900 rounded-xl border border-[#c3beb1] dark:border-neutral-800">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'projects'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t('admin.tabProjects', { count: projects.length })}</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t('admin.tabUsers', { count: users.length })}</span>
            </button>

            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'images'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{t('admin.tabImages', { count: images.length })}</span>
            </button>
          </div>

          {/* Quick search */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-[#6e695d] dark:text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.filterPlaceholder')}
              className="w-full bg-[#e0dbd0] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-200 placeholder:text-[#757065] dark:placeholder:text-neutral-500 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Tab 1: Projects Management */}
        {activeTab === 'projects' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#2b2924] dark:text-neutral-200">{t('admin.projectsTitle')}</h3>
                <p className="text-xs text-[#5c584e] dark:text-neutral-400">
                  {t('admin.projectsSubtitle')}
                </p>
              </div>

              <button
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('admin.newProject')}</span>
              </button>
            </div>

            {/* Create Project Form Drawer */}
            {isCreatingProject && (
              <form
                onSubmit={handleCreateProjectSubmit}
                className="p-4 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-blue-600/40 dark:border-blue-500/40 space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between border-b border-[#c8c3b6] dark:border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-[#2b2924] dark:text-neutral-200 flex items-center gap-1.5">
                    <FolderPlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>{t('admin.createProjectDrawerTitle')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingProject(false)}
                    className="text-[#6e695d] hover:text-[#1f1d18] dark:text-neutral-500 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#5c584e] dark:text-neutral-400 block mb-1">{t('admin.projectTitleLabel')}</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={t('admin.projectTitlePlaceholder')}
                      autoFocus
                      required
                      className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#5c584e] dark:text-neutral-400 block mb-1">{t('admin.projectDescLabel')}</label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder={t('admin.projectDescPlaceholder')}
                      className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProject(false)}
                    className="px-3 py-1 text-xs text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isProjectSubmitting || !newTitle.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                  >
                    {isProjectSubmitting ? t('admin.creatingProject') : t('admin.provisionProject')}
                  </button>
                </div>
              </form>
            )}

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {filteredProjects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-[#e0dbd0] border-blue-600 ring-1 ring-blue-600/40 dark:bg-neutral-950 dark:border-blue-500 dark:ring-blue-500/50'
                        : 'bg-[#e0dbd0] border-[#c8c3b6] hover:border-[#aca698] dark:bg-neutral-950 dark:border-neutral-800/90 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100">{p.title}</h4>
                          {isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600/12 text-blue-800 border border-blue-600/30 dark:bg-blue-600/20 dark:text-blue-400 dark:border-blue-500/30 whitespace-nowrap">
                              {t('admin.activeCanvasBadge')}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded whitespace-nowrap ${
                              p.status === 'active'
                                ? 'bg-emerald-600/12 text-emerald-800 border border-emerald-700/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                : 'bg-[#d4cfc3] text-[#5c584e] dark:bg-neutral-800 dark:text-neutral-400'
                            }`}
                          >
                            {p.status === 'active' ? t('common.active') : t('common.archived')}
                          </span>
                        </div>
                        <p className="text-xs text-[#5c584e] dark:text-neutral-400 mt-1 line-clamp-2">
                          {p.description || t('admin.noDescription')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedTeamProjectId(p.id);
                            setActiveTab('users');
                          }}
                          className="px-2 py-1 text-xs font-medium text-[#3a362e] hover:text-[#1f1d18] bg-[#d4cfc3] hover:bg-[#c8c3b6] dark:text-neutral-300 dark:hover:text-white dark:bg-neutral-800/80 dark:hover:bg-neutral-700 rounded-md transition-colors flex items-center gap-1"
                          title={t('admin.manageParticipantsTitle')}
                        >
                          <Users className="w-3 h-3 text-blue-700 dark:text-blue-400" />
                          <span>{Object.keys(p.participants || {}).length}</span>
                        </button>
                        <button
                          onClick={() => {
                            onSelectProject(p.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-white bg-blue-600/12 hover:bg-blue-600 dark:text-blue-400 dark:bg-blue-600/10 dark:hover:bg-blue-600 rounded-md transition-colors whitespace-nowrap"
                          title={t('admin.openCanvasTitle')}
                        >
                          {t('admin.open')}
                        </button>
                        <button
                          onClick={() => onToggleProjectStatus(p.id, p.status)}
                          className="p-1 text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#d2ccbf] dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
                          title={p.status === 'active' ? t('admin.archiveProjectTitle') : t('admin.activateProjectTitle')}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('admin.confirmDeleteProject', { title: p.title }))) {
                              onDeleteProject(p.id);
                            }
                          }}
                          className="p-1 text-[#6e695d] hover:text-red-700 hover:bg-[#d2ccbf] dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800 rounded transition-colors"
                          title={t('admin.deleteProjectTitle')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#6e695d] dark:text-neutral-500 pt-3 mt-3 border-t border-[#ccc7ba] dark:border-neutral-800/60 font-mono">
                      <span>ID: {p.id}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageProjectId(p.id);
                            setSelectedImageIds(new Set());
                            setConfirmDeleteImagesMode(null);
                            setActiveTab('images');
                          }}
                          className="px-2 py-0.5 rounded bg-[#d8d3c8] hover:bg-[#cdc7ba] border border-[#c3beb1] text-cyan-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:border-neutral-800 dark:text-cyan-300 flex items-center gap-1 transition-colors"
                          title={t('admin.inspectStorageTitle')}
                        >
                          <HardDrive className="w-3 h-3 text-cyan-700 dark:text-cyan-400" />
                          <span>
                            {t('admin.projectStorageBadge', {
                              size: formatMB(storageByProject[p.id]?.bytes || 0),
                              count: storageByProject[p.id]?.count || 0,
                            })}
                          </span>
                        </button>
                        <span>{t('admin.createdDate', { date: new Date(p.createdAt).toLocaleDateString(locale) })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Users & Roles Management */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#2b2924] dark:text-neutral-200">{t('admin.teamTitle')}</h3>
                <p className="text-xs text-[#5c584e] dark:text-neutral-400">
                  {t('admin.teamSubtitle')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl px-2.5 py-1">
                  <FolderKanban className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                  <select
                    value={selectedTeamProjectId}
                    onChange={(e) => {
                      setSelectedTeamProjectId(e.target.value);
                      setAddParticipantEmail('');
                      setEditingUserKey(null);
                    }}
                    className="bg-transparent text-xs text-[#2b2924] dark:text-neutral-200 font-medium outline-none cursor-pointer max-w-[220px]"
                    title={t('admin.teamFilterTitle')}
                  >
                    <option value="all" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                      {t('admin.allTeamMembers', { count: users.length })}
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                        {t('admin.projectFilterOption', {
                          title: p.title,
                          count: Object.keys(p.participants || {}).length,
                        })}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    const nextOpen = !isInvitingUser;
                    setIsInvitingUser(nextOpen);
                    if (nextOpen && selectedTeamProject) {
                      setInviteProjectIds({ [selectedTeamProject.id]: true });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t('admin.inviteMemberBtn')}</span>
                </button>
              </div>
            </div>

            {/* Invite User Drawer */}
            {isInvitingUser && (
              <form
                onSubmit={handleInviteUserSubmit}
                className="p-4 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-blue-600/40 dark:border-blue-500/40 space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between border-b border-[#c8c3b6] dark:border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-[#2b2924] dark:text-neutral-200 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>{t('admin.inviteDrawerTitle')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsInvitingUser(false)}
                    className="text-[#6e695d] hover:text-[#1f1d18] dark:text-neutral-500 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#5c584e] dark:text-neutral-400 block mb-1">{t('admin.userEmailLabel')}</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t('admin.userEmailPlaceholder')}
                      autoFocus
                      required
                      className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-600 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#5c584e] dark:text-neutral-400 block mb-1">{t('admin.assignedRoleLabel')}</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'Admin' | 'Editor' | 'Viewer')}
                      className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
                    >
                      <option value="Admin" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('admin.roleDescAdmin')}</option>
                      <option value="Editor" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('admin.roleDescEditor')}</option>
                      <option value="Viewer" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('admin.roleDescViewer')}</option>
                    </select>
                  </div>
                </div>

                {projects.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#5c584e] dark:text-neutral-400 block">
                      {t('admin.assignProjectsImmediate')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {projects.map((p) => {
                        const checked = Boolean(inviteProjectIds[p.id]);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setInviteProjectIds((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-colors ${
                              checked
                                ? 'bg-blue-600/15 border-blue-600/50 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500/60 dark:text-blue-200'
                                : 'bg-[#ebe7de] border-[#c3beb1] text-[#5c584e] hover:text-[#1f1d18] dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 text-blue-700 dark:text-blue-400" />}
                            <span>{p.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsInvitingUser(false)}
                    className="px-3 py-1 text-xs text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isUserSubmitting || !inviteEmail.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                  >
                    {isUserSubmitting ? t('admin.authorizing') : t('admin.authorizeUser')}
                  </button>
                </div>
              </form>
            )}

            {/* Project-Specific Participant Management Bar */}
            {selectedTeamProject && (
              <div className="p-3.5 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-blue-600/35 dark:border-blue-500/30 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#2b2924] dark:text-neutral-100">
                      {t('admin.participantsIn', { title: selectedTeamProject.title })}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-600/12 text-blue-800 border border-blue-600/30 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/30">
                      {t('admin.assignedCount', { count: Object.keys(selectedTeamProject.participants || {}).length })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 mt-0.5">
                    {t('admin.participantsHint')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={addParticipantEmail}
                    onChange={(e) => setAddParticipantEmail(e.target.value)}
                    className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-[#2b2924] dark:text-neutral-200 outline-none focus:border-blue-500 max-w-[210px]"
                  >
                    <option value="" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('admin.selectUserToAdd')}</option>
                    {users
                      .filter(
                        (u) =>
                          u.email &&
                          !(
                            selectedTeamProject.participants &&
                            u.email.trim().toLowerCase() in selectedTeamProject.participants
                          )
                      )
                      .map((u) => (
                        <option key={u.uid || u.email} value={u.email.trim().toLowerCase()} className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                          {u.name || u.email} ({u.email})
                        </option>
                      ))}
                  </select>

                  <select
                    value={addParticipantRole}
                    onChange={(e) => setAddParticipantRole(e.target.value as 'Admin' | 'Editor' | 'Viewer')}
                    className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-[#2b2924] dark:text-neutral-200 outline-none focus:border-blue-500"
                  >
                    <option value="Admin" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Admin')}</option>
                    <option value="Editor" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Editor')}</option>
                    <option value="Viewer" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Viewer')}</option>
                  </select>

                  <button
                    type="button"
                    disabled={!addParticipantEmail}
                    onClick={async () => {
                      const targetUser = users.find(
                        (u) => u.email.trim().toLowerCase() === addParticipantEmail
                      );
                      if (!targetUser) return;
                      await onSetProjectParticipant(
                        selectedTeamProject,
                        targetUser.email,
                        addParticipantRole,
                        { uid: targetUser.uid, name: targetUser.name }
                      );
                      setAddParticipantEmail('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {t('admin.addToProject')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTeamProjectId('all')}
                    className="px-2.5 py-1.5 text-xs text-[#5c584e] hover:text-[#1f1d18] bg-[#dcd7cc] hover:bg-[#d2ccbf] border border-[#c3beb1] dark:text-neutral-400 dark:hover:text-white dark:bg-neutral-900 dark:border-neutral-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {t('admin.viewAllUsers')}
                  </button>
                </div>
              </div>
            )}

            {/* Users / Project Participants Table */}
            <div className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e0dbd0] dark:bg-neutral-950 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#c8c3b6] dark:border-neutral-800 bg-[#d8d3c8] dark:bg-neutral-900 text-[#5c584e] dark:text-neutral-400">
                    <th className="py-2.5 px-4 font-semibold">{t('admin.colUser')}</th>
                    <th className="py-2.5 px-4 font-semibold">
                      {selectedTeamProject ? t('admin.colProjectRole') : t('admin.colGlobalRole')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">{t('admin.colProjectsInvolved')}</th>
                    <th className="py-2.5 px-4 font-semibold">{t('admin.colStatus')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{t('admin.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ccc7ba] dark:divide-neutral-800/80">
                  {(() => {
                    const rows = selectedTeamProject
                      ? Object.values(selectedTeamProject.participants || {})
                          .map((part) => {
                            const matchedUser = users.find(
                              (u) => u.email.trim().toLowerCase() === part.email.trim().toLowerCase()
                            );
                            const mergedUser: UserProfile = matchedUser || {
                              uid: part.uid,
                              name: part.name || part.email.split('@')[0],
                              email: part.email,
                              role: part.role,
                              isRegistered: false,
                            };
                            return { user: mergedUser, projectRole: part.role };
                          })
                          .filter(
                            ({ user }) =>
                              (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                              (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
                          )
                      : filteredUsers.map((u) => ({ user: u, projectRole: null }));

                    if (rows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#6e695d] dark:text-neutral-500">
                            {selectedTeamProject
                              ? t('admin.noParticipants')
                              : t('admin.noMatchingUsers')}
                          </td>
                        </tr>
                      );
                    }

                    return rows.map(({ user: u, projectRole }) => {
                      const cleanEmail = (u.email || '').trim().toLowerCase();
                      const userKey = u.uid || cleanEmail;
                      const isSelf = cleanEmail === currentUser.email.trim().toLowerCase();
                      const isTargetSuperAdmin = cleanEmail === 'adrian.byakko@gmail.com';
                      const userProjects = getUserProjects(cleanEmail);
                      const isEditingProjects = editingUserKey === userKey;
                      const isConfirmingDelete = confirmDeleteUserKey === userKey;

                      return (
                        <React.Fragment key={userKey}>
                          <tr className="hover:bg-[#d6d1c6]/60 dark:hover:bg-neutral-900/40 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5">
                                {u.photoURL ? (
                                  <img
                                    src={u.photoURL}
                                    alt=""
                                    className="w-7 h-7 rounded-full border border-[#c3beb1] dark:border-neutral-700"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-blue-600/15 text-blue-700 border border-blue-600/30 dark:bg-blue-600/20 dark:text-blue-400 dark:border-blue-500/30 font-bold flex items-center justify-center text-xs">
                                    {u.name ? u.name.charAt(0).toUpperCase() : cleanEmail.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-[#2b2924] dark:text-neutral-200 flex items-center gap-1.5">
                                    <span>{u.name || t('admin.defaultMemberName')}</span>
                                    {isSelf && <span className="text-[10px] text-blue-700 dark:text-blue-400">{t('admin.youTag')}</span>}
                                    {isTargetSuperAdmin && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/18 text-amber-900 border border-amber-600/35 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                                        {t('admin.superUser')}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-[#6e695d] dark:text-neutral-500 font-mono">{u.email}</p>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-4">
                              {selectedTeamProject && projectRole ? (
                                <select
                                  value={projectRole}
                                  disabled={isTargetSuperAdmin}
                                  onChange={(e) =>
                                    onSetProjectParticipant(
                                      selectedTeamProject,
                                      cleanEmail,
                                      e.target.value as 'Admin' | 'Editor' | 'Viewer',
                                      { uid: u.uid, name: u.name }
                                    )
                                  }
                                  className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2 py-1 text-xs text-[#2b2924] dark:text-neutral-200 font-medium outline-none focus:border-blue-500 disabled:opacity-50"
                                >
                                  <option value="Admin" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Admin')}</option>
                                  <option value="Editor" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Editor')}</option>
                                  <option value="Viewer" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Viewer')}</option>
                                </select>
                              ) : (
                                <select
                                  value={u.role || 'Viewer'}
                                  disabled={isSelf || isTargetSuperAdmin}
                                  onChange={(e) =>
                                    u.uid && onUpdateUserRole(u.uid, e.target.value as 'Admin' | 'Editor' | 'Viewer')
                                  }
                                  className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2 py-1 text-xs text-[#2b2924] dark:text-neutral-200 font-medium outline-none focus:border-blue-500 disabled:opacity-50"
                                >
                                  <option value="Admin" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Admin')}</option>
                                  <option value="Editor" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Editor')}</option>
                                  <option value="Viewer" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Viewer')}</option>
                                </select>
                              )}
                            </td>

                            <td className="py-2.5 px-4">
                              <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                                {userProjects.length === 0 ? (
                                  <span className="text-[11px] text-[#6e695d] dark:text-neutral-500 italic">
                                    {t('admin.noProjectAssigned')}
                                  </span>
                                ) : (
                                  userProjects.map(({ project: p, role }) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => setSelectedTeamProjectId(p.id)}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors text-left ${
                                        selectedTeamProjectId === p.id
                                          ? 'bg-blue-600/15 border-blue-600/50 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500/50 dark:text-blue-300'
                                          : 'bg-[#ebe7de] border-[#c3beb1] text-[#3a362e] hover:border-blue-600/50 dark:bg-neutral-900 dark:border-neutral-700/80 dark:text-neutral-300 dark:hover:border-blue-500/40'
                                      }`}
                                      title={t('admin.filterToProjectRole', { title: p.title, role: tRole(role) })}
                                    >
                                      {p.title} · <span className="text-blue-700 dark:text-blue-400">{tRole(role)}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-4">
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={`w-fit px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    u.isRegistered !== false
                                      ? 'bg-emerald-600/12 text-emerald-800 border border-emerald-700/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                      : 'bg-amber-500/18 text-amber-900 border border-amber-600/35 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                  }`}
                                >
                                  {u.isRegistered !== false ? t('common.active') : t('common.invited')}
                                </span>
                                <span className="text-[10px] text-[#6e695d] dark:text-neutral-500 font-mono">
                                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(locale) : t('admin.pending')}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openUserProjectEditor(u)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 whitespace-nowrap ${
                                    isEditingProjects
                                      ? 'bg-blue-600 text-white border-blue-500'
                                      : 'bg-[#ebe7de] hover:bg-[#d6d1c6] text-[#3a362e] border-[#c3beb1] dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700'
                                  }`}
                                  title={t('admin.assignProjectsTitle')}
                                >
                                  <FolderKanban className="w-3 h-3" />
                                  <span>{t('admin.projectsBtn')}</span>
                                </button>

                                {selectedTeamProject && !isTargetSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveProjectParticipant(selectedTeamProject, cleanEmail)}
                                    className="p-1.5 text-[#5c584e] hover:text-amber-700 hover:bg-[#d2ccbf] dark:text-neutral-400 dark:hover:text-amber-300 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                                    title={t('admin.removeFromProjectTitle', { title: selectedTeamProject.title })}
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {isSuperUser && !isSelf && !isTargetSuperAdmin && (
                                  isConfirmingDelete ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={deletingUserKey === userKey}
                                        onClick={async () => {
                                          setDeletingUserKey(userKey);
                                          try {
                                            await onDeleteUser(u);
                                            setConfirmDeleteUserKey(null);
                                          } finally {
                                            setDeletingUserKey(null);
                                          }
                                        }}
                                        className="px-2 py-1 text-[10px] font-semibold bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors disabled:opacity-50"
                                      >
                                        {deletingUserKey === userKey ? t('admin.deleting') : t('common.confirm')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteUserKey(null)}
                                        className="px-1.5 py-1 text-[10px] text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white"
                                      >
                                        {t('common.cancel')}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUserKey(userKey)}
                                      className="p-1.5 text-[#6e695d] hover:text-red-700 hover:bg-[#d2ccbf] dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                                      title={t('admin.deleteUserTitle')}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Inline Project Assignment Drawer for This User */}
                          {isEditingProjects && (
                            <tr className="bg-[#d8d3c8]/70 dark:bg-neutral-900/60">
                              <td colSpan={5} className="p-3.5 border-t border-blue-600/25 dark:border-blue-500/20">
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-[#2b2924] dark:text-neutral-200">
                                      {t('admin.assignDrawerTitle', { name: u.name || u.email })}
                                    </span>
                                    <span className="text-[11px] text-[#5c584e] dark:text-neutral-400">
                                      {t('admin.assignDrawerHint')}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {projects.map((p) => {
                                      const assignedRole = draftUserAssignments[p.id] ?? null;
                                      const isAssigned = assignedRole !== null;
                                      return (
                                        <div
                                          key={p.id}
                                          className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-colors ${
                                            isAssigned
                                              ? 'bg-[#ebe7de] border-blue-600/50 dark:bg-neutral-950 dark:border-blue-500/50'
                                              : 'bg-[#ebe7de]/60 border-[#c3beb1] dark:bg-neutral-950/50 dark:border-neutral-800'
                                          }`}
                                        >
                                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                            <input
                                              type="checkbox"
                                              checked={isAssigned}
                                              onChange={(e) => {
                                                setDraftUserAssignments((prev) => ({
                                                  ...prev,
                                                  [p.id]: e.target.checked
                                                    ? u.role === 'Admin'
                                                      ? 'Admin'
                                                      : u.role === 'Viewer'
                                                        ? 'Viewer'
                                                        : 'Editor'
                                                    : null,
                                                }));
                                              }}
                                              className="rounded border-[#b5afa0] bg-[#ebe7de] dark:border-neutral-700 dark:bg-neutral-900 text-blue-600 focus:ring-0"
                                            />
                                            <span className="text-xs text-[#2b2924] dark:text-neutral-200 truncate font-medium">
                                              {p.title}
                                            </span>
                                          </label>

                                          {isAssigned && (
                                            <select
                                              value={assignedRole}
                                              onChange={(e) =>
                                                setDraftUserAssignments((prev) => ({
                                                  ...prev,
                                                  [p.id]: e.target.value as 'Admin' | 'Editor' | 'Viewer',
                                                }))
                                              }
                                              className="bg-[#e0dbd0] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-md px-2 py-0.5 text-[11px] text-[#2b2924] dark:text-neutral-200 outline-none focus:border-blue-500"
                                            >
                                              <option value="Admin" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Admin')}</option>
                                              <option value="Editor" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Editor')}</option>
                                              <option value="Viewer" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{tRole('Viewer')}</option>
                                            </select>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingUserKey(null)}
                                      className="px-3 py-1 text-xs text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white"
                                    >
                                      {t('common.cancel')}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSavingAssignments}
                                      onClick={() => handleSaveAssignmentsSubmit(u)}
                                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                                    >
                                      {isSavingAssignments ? t('common.saving') : t('admin.saveAssignments')}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Web Image Database (Per-Project Breakdown & Storage Usage) */}
        {activeTab === 'images' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Top Header & Project Scope Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#2b2924] dark:text-neutral-200 flex items-center gap-2">
                  <span>{t('admin.imageDbTitle')}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-600/12 text-cyan-800 border border-cyan-600/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30">
                    {t('admin.totalStats', { size: formatMB(totalWorkspaceBytes), count: images.length })}
                  </span>
                </h3>
                <p className="text-xs text-[#5c584e] dark:text-neutral-400 mt-0.5">
                  {t('admin.imageDbSubtitle')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl px-2.5 py-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400 shrink-0" />
                  <select
                    value={selectedImageProjectId}
                    onChange={(e) => {
                      setSelectedImageProjectId(e.target.value);
                      setSelectedImageIds(new Set());
                      setConfirmDeleteImagesMode(null);
                    }}
                    className="bg-transparent text-xs text-[#2b2924] dark:text-neutral-200 font-medium outline-none cursor-pointer max-w-[260px]"
                  >
                    <option value="all" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                      {t('admin.allProjectsScope', {
                        count: images.length,
                        size: formatMB(totalWorkspaceBytes),
                      })}
                    </option>
                    {projects.map((p) => {
                      const stat = storageByProject[p.id] || { count: 0, bytes: 0 };
                      return (
                        <option key={p.id} value={p.id} className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                          {p.title} ({stat.count} · {formatMB(stat.bytes)})
                        </option>
                      );
                    })}
                    {(storageByProject['__unassigned__']?.count || 0) > 0 && (
                      <option value="__unassigned__" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                        {t('admin.legacyUnassignedOption', {
                          count: storageByProject['__unassigned__'].count,
                          size: formatMB(storageByProject['__unassigned__'].bytes),
                        })}
                      </option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Selection & Bulk Action Bar */}
            {(() => {
              const visibleBytes = filteredImages.reduce((sum, img) => sum + getImageBytes(img), 0);
              const visibleIds = filteredImages.map((img) => img.id);
              const visibleSelectedIds = visibleIds.filter((id) => selectedImageIds.has(id));
              const selectedBytes = filteredImages
                .filter((img) => selectedImageIds.has(img.id))
                .reduce((sum, img) => sum + getImageBytes(img), 0);
              const scopeTitle =
                selectedImageProjectId === 'all'
                  ? t('admin.allVisibleImages')
                  : selectedImageProjectId === '__unassigned__'
                    ? t('admin.legacyUnassigned')
                    : projects.find((p) => p.id === selectedImageProjectId)?.title ||
                      t('admin.selectedProjectFallback');

              return (
                <div className="p-3 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-[#3a362e] dark:text-neutral-300 font-semibold flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
                      <span>{scopeTitle}:</span>
                      <span className="font-mono text-cyan-800 dark:text-cyan-300">{formatMB(visibleBytes)}</span>
                    </span>
                    <span className="text-[#6e695d] dark:text-neutral-500 font-mono text-[11px]">
                      {filteredImages.length}{' '}
                      {filteredImages.length === 1 ? t('admin.imageSingular') : t('admin.imagePlural')}
                    </span>
                    {visibleSelectedIds.length > 0 && (
                      <span className="text-amber-900 dark:text-amber-300 font-mono text-[11px] bg-amber-500/18 dark:bg-amber-500/10 border border-amber-600/35 dark:border-amber-500/30 px-2 py-0.5 rounded">
                        {t('admin.selectedStorageBadge', {
                          count: visibleSelectedIds.length,
                          size: formatMB(selectedBytes),
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {visibleSelectedIds.length > 0 && (
                      confirmDeleteImagesMode?.type === 'selected' ? (
                        <div className="flex items-center gap-1.5 bg-red-600/12 dark:bg-red-950/60 border border-red-600/35 dark:border-red-700/60 px-2.5 py-1 rounded-lg">
                          <span className="text-[11px] text-red-800 dark:text-red-200 font-medium">
                            {t('admin.deleteSelectedPrompt', { count: visibleSelectedIds.length })}
                          </span>
                          <button
                            type="button"
                            disabled={isDeletingImages}
                            onClick={() => handleConfirmBatchDelete(visibleSelectedIds)}
                            className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            {isDeletingImages ? t('admin.deleting') : t('common.confirm')}
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingImages}
                            onClick={() => setConfirmDeleteImagesMode(null)}
                            className="px-1.5 py-0.5 text-[11px] text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteImagesMode({ type: 'selected' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 border border-amber-600/40 dark:bg-amber-600/20 dark:hover:bg-amber-600/30 dark:text-amber-200 dark:border-amber-500/40 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('admin.deleteSelectedBtn', { count: visibleSelectedIds.length })}</span>
                        </button>
                      )
                    )}

                    {filteredImages.length > 0 && (
                      confirmDeleteImagesMode?.type === 'all' &&
                      confirmDeleteImagesMode.scopeId === selectedImageProjectId ? (
                        <div className="flex items-center gap-1.5 bg-red-600/12 dark:bg-red-950/70 border border-red-600/35 dark:border-red-700/70 px-2.5 py-1 rounded-lg">
                          <span className="text-[11px] text-red-800 dark:text-red-200 font-medium">
                            {t('admin.deleteAllImagesPrompt', {
                              count: filteredImages.length,
                              size: formatMB(visibleBytes),
                            })}
                          </span>
                          <button
                            type="button"
                            disabled={isDeletingImages}
                            onClick={() => handleConfirmBatchDelete(confirmDeleteImagesMode.ids)}
                            className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            {isDeletingImages ? t('admin.deleting') : t('admin.confirmDeleteAll')}
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingImages}
                            onClick={() => setConfirmDeleteImagesMode(null)}
                            className="px-1.5 py-0.5 text-[11px] text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteImagesMode({
                              type: 'all',
                              scopeId: selectedImageProjectId,
                              scopeTitle,
                              ids: visibleIds,
                            })
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/90 hover:bg-red-500 text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            {selectedImageProjectId === 'all'
                              ? t('admin.deleteAllCount', { count: filteredImages.length })
                              : t('admin.deleteAllInProjectCount', { count: filteredImages.length })}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Grouped Project Sections */}
            {(() => {
              const groups: { id: string; title: string; items: ImageResource[] }[] = [];

              if (selectedImageProjectId === 'all') {
                projects.forEach((p) => {
                  const items = filteredImages.filter((img) => getImageBucketId(img) === p.id);
                  if (items.length > 0 || !searchQuery) {
                    groups.push({ id: p.id, title: p.title, items });
                  }
                });
                const unassigned = filteredImages.filter(
                  (img) => getImageBucketId(img) === '__unassigned__'
                );
                if (unassigned.length > 0) {
                  groups.push({ id: '__unassigned__', title: t('admin.legacyUnassigned'), items: unassigned });
                }
              } else {
                const singleTitle =
                  selectedImageProjectId === '__unassigned__'
                    ? t('admin.legacyUnassigned')
                    : projects.find((p) => p.id === selectedImageProjectId)?.title || t('admin.projectFallback');
                groups.push({
                  id: selectedImageProjectId,
                  title: singleTitle,
                  items: filteredImages,
                });
              }

              if (groups.length === 0) {
                return (
                  <div className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e0dbd0] dark:bg-neutral-950 py-10 text-center text-xs text-[#6e695d] dark:text-neutral-500">
                    {t('admin.noImageRecords')}
                  </div>
                );
              }

              return groups.map((group) => {
                const groupBytes = group.items.reduce((sum, img) => sum + getImageBytes(img), 0);
                const allGroupSelected =
                  group.items.length > 0 && group.items.every((img) => selectedImageIds.has(img.id));

                return (
                  <div
                    key={group.id}
                    className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e0dbd0] dark:bg-neutral-950 overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-[#d8d3c8] dark:bg-neutral-900/90 border-b border-[#c8c3b6] dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <FolderKanban className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                        <span className="text-xs font-bold text-[#2b2924] dark:text-neutral-100">{group.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-600/12 text-cyan-800 border border-cyan-600/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30">
                          {formatMB(groupBytes)}
                        </span>
                        <span className="text-[10px] font-mono text-[#5c584e] dark:text-neutral-400">
                          {group.items.length}{' '}
                          {group.items.length === 1 ? t('admin.fileSingular') : t('admin.filePlural')}
                        </span>
                      </div>

                      {group.items.length > 0 && (
                        confirmDeleteImagesMode?.type === 'all' &&
                        confirmDeleteImagesMode.scopeId === `group:${group.id}` ? (
                          <div className="flex items-center gap-1.5 bg-red-600/12 dark:bg-red-950/70 border border-red-600/35 dark:border-red-700/70 px-2 py-0.5 rounded-lg">
                            <span className="text-[11px] text-red-800 dark:text-red-200">
                              {t('admin.deleteGroupPrompt', { count: group.items.length, title: group.title })}
                            </span>
                            <button
                              type="button"
                              disabled={isDeletingImages}
                              onClick={() => handleConfirmBatchDelete(confirmDeleteImagesMode.ids)}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-semibold disabled:opacity-50"
                            >
                              {isDeletingImages ? t('admin.deleting') : t('common.confirm')}
                            </button>
                            <button
                              type="button"
                              disabled={isDeletingImages}
                              onClick={() => setConfirmDeleteImagesMode(null)}
                              className="px-1.5 py-0.5 text-[10px] text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteImagesMode({
                                type: 'all',
                                scopeId: `group:${group.id}`,
                                scopeTitle: group.title,
                                ids: group.items.map((i) => i.id),
                              })
                            }
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-red-700 hover:text-white bg-red-600/12 hover:bg-red-600 border border-red-600/35 dark:text-red-300 dark:hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600/80 dark:border-red-800/50 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{t('admin.deleteAllCount', { count: group.items.length })}</span>
                          </button>
                        )
                      )}
                    </div>

                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#c8c3b6] dark:border-neutral-800 bg-[#dcd7cc]/70 dark:bg-neutral-900/50 text-[#5c584e] dark:text-neutral-400">
                          <th className="py-2 px-3 w-9">
                            <input
                              type="checkbox"
                              checked={allGroupSelected}
                              disabled={group.items.length === 0}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedImageIds((prev) => {
                                  const next = new Set(prev);
                                  group.items.forEach((img) => {
                                    if (checked) next.add(img.id);
                                    else next.delete(img.id);
                                  });
                                  return next;
                                });
                              }}
                              className="rounded border-[#b5afa0] bg-[#ebe7de] dark:border-neutral-700 dark:bg-neutral-900 text-blue-600 focus:ring-0 cursor-pointer"
                              title={t('admin.selectAllProjectTitle')}
                            />
                          </th>
                          <th className="py-2 px-3 font-semibold w-16">{t('admin.colPreview')}</th>
                          <th className="py-2 px-3 font-semibold">{t('admin.colNameCategory')}</th>
                          <th className="py-2 px-3 font-semibold w-24">{t('admin.colSize')}</th>
                          <th className="py-2 px-3 font-semibold">{t('admin.colWebUrl')}</th>
                          <th className="py-2 px-3 font-semibold text-right w-16">{t('admin.colAction')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ccc7ba] dark:divide-neutral-800/80">
                        {group.items.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-[#6e695d] dark:text-neutral-500">
                              {t('admin.noImagesInProject')}
                            </td>
                          </tr>
                        ) : (
                          group.items.map((img) => {
                            const isChecked = selectedImageIds.has(img.id);
                            const bytes = getImageBytes(img);
                            return (
                              <tr
                                key={img.id}
                                className={`transition-colors ${
                                  isChecked ? 'bg-blue-600/12 dark:bg-blue-950/25' : 'hover:bg-[#d6d1c6]/60 dark:hover:bg-neutral-900/40'
                                }`}
                              >
                                <td className="py-2 px-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleImageSelected(img.id)}
                                    className="rounded border-[#b5afa0] bg-[#ebe7de] dark:border-neutral-700 dark:bg-neutral-900 text-blue-600 focus:ring-0 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 px-3 w-16">
                                  <img
                                    src={img.url}
                                    alt=""
                                    className="w-12 h-8 object-cover rounded-md border border-[#c3beb1] dark:border-neutral-800"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <p className="font-semibold text-[#2b2924] dark:text-neutral-200">{img.name}</p>
                                  <span className="text-[10px] text-[#6e695d] dark:text-neutral-500 uppercase font-mono">
                                    {img.folder === 'maps'
                                      ? t('admin.folderMaps')
                                      : img.folder === 'images'
                                      ? t('admin.folderImages')
                                      : img.folder}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-cyan-800 dark:text-cyan-300">
                                  {formatMB(bytes)}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-blue-700 dark:text-blue-400 truncate max-w-xs">
                                  <a
                                    href={img.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline flex items-center gap-1"
                                  >
                                    <span className="truncate">{img.url}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    onClick={() => onDeleteImageRecord(img.id)}
                                    className="p-1 text-[#6e695d] hover:text-red-700 dark:text-neutral-500 dark:hover:text-red-400 rounded transition-colors"
                                    title={t('admin.deleteImageRecordTitle')}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
