import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Map as MapIcon,
  Video as VideoIcon,
  Archive,
  Plus,
  Sun,
  Moon,
  ChevronDown,
  Workflow,
  Shield,
  FolderKanban,
  LogIn,
  LogOut,
  Rocket,
} from 'lucide-react';
import { Project, UserProfile } from '../types/workflow';

interface HeaderProps {
  user: UserProfile;
  projects: Project[];
  activeProject: Project | null;
  storedCount: number;
  zoom: number;
  isDark: boolean;
  onToggleDark: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenAdminConsole: () => void;
  onOpenDeploymentGuide: () => void;
  onOpenGallery: (mode: 'images-manage' | 'maps-manage') => void;
  onOpenVideoLib: () => void;
  onOpenArchive: () => void;
  onAddNode: () => void;
  onOpenAddText: (type: 'floating' | 'container' | 'annotation') => void;
  onZoomChange: (type: '100' | 'center' | 'fit') => void;
  onSignInGoogle: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  projects,
  activeProject,
  storedCount,
  zoom,
  isDark,
  onToggleDark,
  onSelectProject,
  onOpenAdminConsole,
  onOpenDeploymentGuide,
  onOpenGallery,
  onOpenVideoLib,
  onOpenArchive,
  onAddNode,
  onOpenAddText,
  onZoomChange,
  onSignInGoogle,
  onSignOut,
}) => {
  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdmin = user.role === 'Admin';
  const isReadOnly = user.role === 'Viewer';

  return (
    <header className="h-14 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between z-30 select-none relative">
      {/* Brand & Project Switcher Zone */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
          <Workflow className="w-5 h-5" />
        </div>

        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProjectMenuOpen(!projectMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-800 border border-neutral-700/80 text-xs font-semibold text-neutral-100 transition-colors"
          >
            <FolderKanban className="w-3.5 h-3.5 text-blue-400" />
            <span className="max-w-[180px] truncate">
              {activeProject?.title || 'Select Project'}
            </span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {projectMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} />
              <div className="absolute left-0 mt-1 w-64 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl py-1 z-50 text-xs">
                <div className="px-3 py-1.5 border-b border-neutral-800 text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                  Storyboard Projects ({projects.length})
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {projects.map((p) => {
                    const isSelected = p.id === activeProject?.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p.id);
                          setProjectMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-neutral-800/80 transition-colors ${
                          isSelected ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'text-neutral-300'
                        }`}
                      >
                        <span className="truncate pr-2">{p.title}</span>
                        {isSelected && <span className="text-[10px] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {isAdmin && (
                  <div className="p-1 border-t border-neutral-800">
                    <button
                      onClick={() => {
                        setProjectMenuOpen(false);
                        onOpenAdminConsole();
                      }}
                      className="w-full text-left px-3 py-1.5 text-blue-400 hover:bg-neutral-800 rounded-lg flex items-center gap-1.5 font-semibold text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Manage / New Project...</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User Role Tag */}
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
            user.role === 'Admin'
              ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
              : user.role === 'Editor'
              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}
        >
          {user.role}
        </span>
      </div>

      {/* Main Workspace Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOpenGallery('images-manage')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800/80 hover:bg-neutral-700/80 rounded-md border border-neutral-700 transition-colors"
          title="Scene Image Library"
        >
          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
          <span>Gallery</span>
        </button>

        <button
          onClick={() => onOpenGallery('maps-manage')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800/80 hover:bg-neutral-700/80 rounded-md border border-neutral-700 transition-colors"
          title="Topographical Map Library"
        >
          <MapIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Map Lib</span>
        </button>

        <button
          onClick={onOpenVideoLib}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800/80 hover:bg-neutral-700/80 rounded-md border border-neutral-700 transition-colors"
          title="Global Video References"
        >
          <VideoIcon className="w-3.5 h-3.5 text-rose-400" />
          <span>Video Lib</span>
        </button>

        <button
          onClick={onOpenArchive}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800/80 hover:bg-neutral-700/80 rounded-md border border-neutral-700 transition-colors"
          title="Stored Archived Scenes"
        >
          <Archive className="w-3.5 h-3.5 text-purple-400" />
          <span>Archive</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {storedCount}
          </span>
        </button>

        <div className="h-4 w-px bg-neutral-800 mx-1" />

        {/* Add Node (hidden for Viewer role) */}
        {!isReadOnly && (
          <button
            onClick={onAddNode}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Node</span>
          </button>
        )}

        {/* Add Text dropdown */}
        {!isReadOnly && (
          <div className="relative">
            <button
              onClick={() => setTextMenuOpen(!textMenuOpen)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md border border-neutral-700 transition-colors"
            >
              <span>+ Add Text</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {textMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setTextMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 z-50 text-xs">
                  <button
                    onClick={() => {
                      onOpenAddText('floating');
                      setTextMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-neutral-700/80 flex items-center justify-between"
                  >
                    <span>Just Text</span>
                    <span className="text-[10px] text-neutral-500">Floating</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenAddText('container');
                      setTextMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-neutral-700/80 flex items-center justify-between border-t border-neutral-700/50"
                  >
                    <span>Container Box</span>
                    <span className="text-[10px] text-neutral-500">Groups Nodes</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenAddText('annotation');
                      setTextMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-neutral-700/80 flex items-center justify-between border-t border-neutral-700/50"
                  >
                    <span>Sticky Note</span>
                    <span className="text-[10px] text-neutral-500">Annotation</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="h-4 w-px bg-neutral-800 mx-1" />

        {/* Viewport controls */}
        <select
          value="custom"
          onChange={(e) => {
            const val = e.target.value;
            if (val === '100' || val === 'center' || val === 'fit') {
              onZoomChange(val);
            }
          }}
          className="bg-neutral-800 text-neutral-200 text-xs rounded-md px-2.5 py-1.5 border border-neutral-700 focus:outline-none focus:border-blue-500"
        >
          <option value="custom">{Math.round(zoom * 100)}% Zoom</option>
          <option value="100">Reset to 100%</option>
          <option value="center">Center Canvas</option>
          <option value="fit">Fit All Nodes</option>
        </select>

        {/* Dark / Light Toggle */}
        <button
          onClick={onToggleDark}
          className="p-1.5 text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md border border-neutral-700 transition-colors"
          title="Toggle Dark / Light Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>

        {/* User profile dropdown / Google Sign-In */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 text-xs rounded-md bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 transition-colors"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full border border-neutral-600" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-blue-400">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="max-w-[90px] truncate">{user.name}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-56 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl py-1 z-50 text-xs">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <p className="font-semibold text-neutral-200 truncate">{user.name}</p>
                  <p className="text-[10px] text-neutral-500 font-mono truncate">{user.email}</p>
                  <p className="text-[10px] text-blue-400 font-medium mt-0.5">Role: {user.role}</p>
                </div>

                {isAdmin && (
                  <div className="p-1 border-b border-neutral-800 space-y-0.5">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenAdminConsole();
                      }}
                      className="w-full text-left px-3 py-1.5 text-amber-300 hover:bg-neutral-800 rounded-lg flex items-center gap-2 font-medium"
                      title="Open Web Admin Console to manage projects and user roles"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin Console</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenDeploymentGuide();
                      }}
                      className="w-full text-left px-3 py-1.5 text-emerald-300 hover:bg-neutral-800 rounded-lg flex items-center gap-2 font-medium"
                      title="Open Firebase Hosting deployment instructions and checklist"
                    >
                      <Rocket className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Deploy</span>
                    </button>
                  </div>
                )}

                <div className="p-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignInGoogle();
                    }}
                    className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 rounded-lg flex items-center gap-2"
                  >
                    <LogIn className="w-3.5 h-3.5 text-blue-400" />
                    <span>Switch / Google Login</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-neutral-800 rounded-lg flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
