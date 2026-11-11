import React, { useState } from 'react';
import { ImageResource, Project, UserProfile } from '../../types/workflow';
import {
  Archive,
  Check,
  FolderPlus,
  Image as ImageIcon,
  Key,
  LayoutGrid,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
  ExternalLink,
} from 'lucide-react';

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
  onDeleteImageRecord: (imageId: string) => Promise<void>;
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
  onDeleteImageRecord,
}) => {
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
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

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
    setIsUserSubmitting(true);
    try {
      await onInviteUser(inviteEmail.trim().toLowerCase(), inviteRole);
      setInviteEmail('');
      setIsInvitingUser(false);
    } finally {
      setIsUserSubmitting(false);
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

  const filteredImages = images.filter(
    (img) =>
      img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-5xl h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                Workspace Administration Console
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30">
                  Firebase Firestore
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Manage cloud projects, user role permissions, and web image references
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation & Search Bar */}
        <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'projects'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Projects ({projects.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team & Roles ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'images'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Image DB ({images.length})</span>
            </button>
          </div>

          {/* Quick search */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Tab 1: Projects Management */}
        {activeTab === 'projects' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">Storyboard Projects</h3>
                <p className="text-xs text-neutral-400">
                  Provision new narrative canvases or decommission completed storyboards
                </p>
              </div>

              <button
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            </div>

            {/* Create Project Form Drawer */}
            {isCreatingProject && (
              <form
                onSubmit={handleCreateProjectSubmit}
                className="p-4 rounded-xl bg-neutral-950 border border-blue-500/40 space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <FolderPlus className="w-4 h-4 text-blue-400" />
                    <span>Create New Workspace Project</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingProject(false)}
                    className="text-neutral-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Project Title</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Act II: Castle Infiltration"
                      autoFocus
                      required
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Brief synopsis or team scope..."
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProject(false)}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProjectSubmitting || !newTitle.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                  >
                    {isProjectSubmitting ? 'Creating...' : 'Provision Project'}
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
                        ? 'bg-neutral-950 border-blue-500 ring-1 ring-blue-500/50'
                        : 'bg-neutral-950 border-neutral-800/90 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-neutral-100">{p.title}</h4>
                          {isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
                              Active Canvas
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              p.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                          {p.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            onSelectProject(p.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-white bg-blue-600/10 hover:bg-blue-600 rounded-md transition-colors"
                          title="Open Canvas"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => onToggleProjectStatus(p.id, p.status)}
                          className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
                          title={p.status === 'active' ? 'Archive Project' : 'Activate Project'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Permanently delete project "${p.title}"? This cannot be undone.`)) {
                              onDeleteProject(p.id);
                            }
                          }}
                          className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-3 mt-3 border-t border-neutral-800/60 font-mono">
                      <span>ID: {p.id}</span>
                      <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">Team Members & Permissions</h3>
                <p className="text-xs text-neutral-400">
                  Assign project roles: Admin (full control), Editor (create & edit), Viewer (read-only)
                </p>
              </div>

              <button
                onClick={() => setIsInvitingUser(!isInvitingUser)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite / Add Member</span>
              </button>
            </div>

            {/* Invite User Drawer */}
            {isInvitingUser && (
              <form
                onSubmit={handleInviteUserSubmit}
                className="p-4 rounded-xl bg-neutral-950 border border-blue-500/40 space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-blue-400" />
                    <span>Authorize or Invite Team Member</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsInvitingUser(false)}
                    className="text-neutral-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">User Email</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="e.g. artist@studio.com"
                      autoFocus
                      required
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Assigned Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'Admin' | 'Editor' | 'Viewer')}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-blue-500"
                    >
                      <option value="Admin">Admin (Create / delete projects, manage users)</option>
                      <option value="Editor">Editor (Add nodes, edit canvas & drawings)</option>
                      <option value="Viewer">Viewer (Read-only observation)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsInvitingUser(false)}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUserSubmitting || !inviteEmail.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                  >
                    {isUserSubmitting ? 'Authorizing...' : 'Authorize User'}
                  </button>
                </div>
              </form>
            )}

            {/* Users Table */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400">
                    <th className="py-2.5 px-4 font-semibold">User</th>
                    <th className="py-2.5 px-4 font-semibold">Role</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredUsers.map((u) => {
                    const isSelf = u.email === currentUser.email;
                    return (
                      <tr key={u.uid || u.email} className="hover:bg-neutral-900/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full border border-neutral-700" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold flex items-center justify-center text-xs">
                                {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-neutral-200">
                                {u.name || 'Team Member'}{' '}
                                {isSelf && <span className="text-[10px] text-blue-400">(You)</span>}
                              </p>
                              <p className="text-[10px] text-neutral-500 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-4">
                          <select
                            value={u.role || 'Viewer'}
                            disabled={isSelf} // Don't let user demote themselves
                            onChange={(e) =>
                              u.uid && onUpdateUserRole(u.uid, e.target.value as 'Admin' | 'Editor' | 'Viewer')
                            }
                            className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-neutral-200 font-medium outline-none focus:border-blue-500 disabled:opacity-50"
                          >
                            <option value="Admin">Admin</option>
                            <option value="Editor">Editor</option>
                            <option value="Viewer">Viewer</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              u.isRegistered !== false
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {u.isRegistered !== false ? 'Active' : 'Invited'}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 text-neutral-500 text-[11px] font-mono">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Pending'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Web Image Database (No base64) */}
        {activeTab === 'images' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Web Image Repository</h3>
              <p className="text-xs text-neutral-400">
                Lightweight remote web URLs stored in Firestore without bloat or base64 limits
              </p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400">
                    <th className="py-2.5 px-4 font-semibold">Preview</th>
                    <th className="py-2.5 px-4 font-semibold">Name & Category</th>
                    <th className="py-2.5 px-4 font-semibold">Web URL</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredImages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-neutral-500">
                        No image records registered in the Firestore database yet.
                      </td>
                    </tr>
                  ) : (
                    filteredImages.map((img) => (
                      <tr key={img.id} className="hover:bg-neutral-900/40 transition-colors">
                        <td className="py-2 px-4 w-16">
                          <img
                            src={img.url}
                            alt=""
                            className="w-12 h-8 object-cover rounded-md border border-neutral-800"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <p className="font-semibold text-neutral-200">{img.name}</p>
                          <span className="text-[10px] text-neutral-500 uppercase font-mono">{img.folder}</span>
                        </td>
                        <td className="py-2 px-4 font-mono text-[11px] text-blue-400 truncate max-w-xs">
                          <a href={img.url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                            <span className="truncate">{img.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <button
                            onClick={() => onDeleteImageRecord(img.id)}
                            className="p-1 text-neutral-500 hover:text-red-400 rounded transition-colors"
                            title="Delete Image Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
