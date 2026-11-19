import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Map as MapIcon,
  Video as VideoIcon,
  Box,
  Archive,
  Plus,
  Palette,
  ChevronDown,
  Workflow,
  Shield,
  FolderKanban,
  LogIn,
  LogOut,
  Globe,
  ExternalLink,
  FileCode2,
  Download,
  Library,
  Type,
  Layers,
  StickyNote,
  KeyRound,
  Keyboard,
  Languages,
  Tag,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import {
  CanvasStyleSettings,
  LabelItem,
  Project,
  TextElement,
  UserProfile,
  WorkflowNode,
} from '../types/workflow';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcutString,
  ShortcutBinding,
} from '../utils/keyboardShortcuts';
import { HeaderSearch, SearchTarget } from './HeaderSearch';
import { StyleMenuPopover } from './popovers/StyleMenuPopover';

interface HeaderProps {
  user: UserProfile;
  effectiveRole?: 'Admin' | 'Editor' | 'Viewer';
  projects: Project[];
  activeProject: Project | null;
  storedCount: number;
  zoom: number;
  styleSettings: CanvasStyleSettings;
  nodes: Record<string, WorkflowNode>;
  texts: Record<string, TextElement>;
  labels: Record<string, LabelItem>;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchMatchCount?: number;
  onFocusSearchTarget: (target: SearchTarget) => void;
  onChangeStyleSettings: (updater: (prev: CanvasStyleSettings) => CanvasStyleSettings) => void;
  onResetStyleSettings: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenAdminConsole: () => void;
  onOpenArchitecture: () => void;
  onOpenGallery: (mode: 'images-manage' | 'maps-manage') => void;
  onOpenVideoLib: () => void;
  onOpenActorLib: () => void;
  onOpenArchive: () => void;
  activeLabelFilterCount?: number;
  onOpenLabelManager: () => void;
  onOpenExport: () => void;
  onAddNode: () => void;
  onAddTextDirect: (type: 'floating' | 'container' | 'annotation') => void;
  onZoomChange: (type: '100' | 'center' | 'fit') => void;
  hasApiKey: boolean;
  onOpenApiKeyConfig: () => void;
  onOpenKeyboardShortcuts: () => void;
  focusSearchBinding?: ShortcutBinding;
  openShortcutsBinding?: ShortcutBinding;
  onSignInGoogle: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  effectiveRole,
  projects,
  activeProject,
  storedCount,
  zoom,
  styleSettings,
  nodes,
  texts,
  labels,
  searchQuery,
  onSearchQueryChange,
  searchMatchCount,
  onFocusSearchTarget,
  onChangeStyleSettings,
  onResetStyleSettings,
  onSelectProject,
  onOpenAdminConsole,
  onOpenArchitecture,
  onOpenGallery,
  onOpenVideoLib,
  onOpenActorLib,
  onOpenArchive,
  activeLabelFilterCount = 0,
  onOpenLabelManager,
  onOpenExport,
  onAddNode,
  onAddTextDirect,
  onZoomChange,
  hasApiKey,
  onOpenApiKeyConfig,
  onOpenKeyboardShortcuts,
  focusSearchBinding = DEFAULT_KEYBOARD_SHORTCUTS.focusSearch,
  openShortcutsBinding = DEFAULT_KEYBOARD_SHORTCUTS.openShortcuts,
  onSignInGoogle,
  onSignOut,
}) => {
  const { language, setLanguage, t, tRole } = useLanguage();
  const [libsMenuOpen, setLibsMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const zoomOptionRef = useRef<HTMLOptionElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const [isStacked, setIsStacked] = useState(false);
  const isStackedRef = useRef(false);
  const prevRectsRef = useRef<{ left?: DOMRect; right?: DOMRect } | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (zoomOptionRef.current) {
      zoomOptionRef.current.textContent = t('header.zoomPercent', { percent: Math.round(zoom * 100) });
    }
  }, [zoom, t]);

  useEffect(() => {
    const handleLiveZoom = (e: Event) => {
      const nextZoom = (e as CustomEvent<number>).detail;
      if (zoomOptionRef.current && typeof nextZoom === 'number') {
        zoomOptionRef.current.textContent = t('header.zoomPercent', { percent: Math.round(nextZoom * 100) });
      }
    };
    window.addEventListener('canvas-zoom-live', handleLiveZoom);
    return () => window.removeEventListener('canvas-zoom-live', handleLiveZoom);
  }, [t]);

  const activeRole = effectiveRole || user.role;
  const isAdmin = user.role === 'Admin';
  const isReadOnly = activeRole === 'Viewer';

  useEffect(() => {
    const headerEl = headerRef.current;
    const leftEl = leftZoneRef.current;
    const rightEl = rightZoneRef.current;
    if (!headerEl || !leftEl || !rightEl) return;

    const measureNaturalChildrenWidth = (el: HTMLElement, fallbackGap: number) => {
      const style = window.getComputedStyle(el);
      const parsedGap = parseFloat(style.columnGap || style.gap || '');
      const gap = Number.isFinite(parsedGap) ? parsedGap : fallbackGap;
      let total = 0;
      let count = 0;
      for (const child of Array.from(el.children) as HTMLElement[]) {
        const w = child.getBoundingClientRect().width;
        if (w > 0) {
          total += w;
          count += 1;
        }
      }
      return total + Math.max(0, count - 1) * gap;
    };

    const evaluateLayout = () => {
      const hStyle = window.getComputedStyle(headerEl);
      const padX =
        (parseFloat(hStyle.paddingLeft || '0') || 0) +
        (parseFloat(hStyle.paddingRight || '0') || 0);
      const availableWidth = headerEl.clientWidth - padX;
      const leftWidth = measureNaturalChildrenWidth(leftEl, 8);
      const rightWidth = measureNaturalChildrenWidth(rightEl, 6);
      const minGapBetweenZones = 20;
      const hysteresis = isStackedRef.current ? 24 : 0;
      const shouldStack = availableWidth < leftWidth + rightWidth + minGapBetweenZones + hysteresis;

      if (shouldStack !== isStackedRef.current) {
        prevRectsRef.current = {
          left: leftEl.getBoundingClientRect(),
          right: rightEl.getBoundingClientRect(),
        };
        isStackedRef.current = shouldStack;
        setIsStacked(shouldStack);
      }
    };

    evaluateLayout();

    const ro = new ResizeObserver(() => {
      evaluateLayout();
    });
    ro.observe(headerEl);
    return () => ro.disconnect();
  }, [activeProject?.title, activeLabelFilterCount, language, activeRole, isReadOnly]);

  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    if (!prev) return;
    prevRectsRef.current = null;

    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    const targets: Array<{ el: HTMLElement | null; prevRect?: DOMRect }> = [
      { el: leftZoneRef.current, prevRect: prev.left },
      { el: rightZoneRef.current, prevRect: prev.right },
    ];

    const animatedEls: HTMLElement[] = [];
    for (const { el, prevRect } of targets) {
      if (!el || !prevRect) continue;
      const nextRect = el.getBoundingClientRect();
      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transition = 'none';
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        animatedEls.push(el);
      }
    }

    if (animatedEls.length === 0) return;

    headerRef.current?.getBoundingClientRect();

    for (const el of animatedEls) {
      el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    }

    cleanupTimerRef.current = window.setTimeout(() => {
      for (const el of animatedEls) {
        el.style.transition = '';
        el.style.transform = '';
      }
      cleanupTimerRef.current = null;
    }, 340);
  }, [isStacked]);

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className={`bg-[#e8e4da] dark:bg-neutral-900 border-b border-[#c9c3b6] dark:border-neutral-800 px-2.5 sm:px-4 flex z-30 select-none relative transition-[height,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isStacked
          ? 'h-[100px] py-2 flex-col justify-center items-stretch gap-2'
          : 'h-14 flex-row items-center justify-between gap-2'
      }`}
    >
      {/* Brand, Project Switcher & Search Zone */}
      <div
        ref={leftZoneRef}
        className={`flex items-center gap-2 sm:gap-3 min-w-0 ${
          isStacked ? 'w-full' : ''
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-600/15 dark:bg-blue-600/20 border border-blue-600/30 dark:border-blue-500/30 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0">
          <Workflow className="w-5 h-5" />
        </div>

        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProjectMenuOpen(!projectMenuOpen)}
            className="touch-target flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800/90 dark:hover:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700/80 text-xs font-semibold text-[#2b2924] dark:text-neutral-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderKanban className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
            <span className="max-w-[110px] sm:max-w-[150px] lg:max-w-[180px] truncate">
              {activeProject?.title || t('header.selectProject')}
            </span>
            <ChevronDown className="w-3 h-3 text-[#635e54] dark:text-neutral-400 shrink-0" />
          </button>

          {projectMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} />
              <div className="absolute left-0 mt-1 w-64 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl py-1 z-50 text-xs">
                <div className="px-3 py-1.5 border-b border-[#d4cfc3] dark:border-neutral-800 text-[10px] uppercase font-bold text-[#6e695d] dark:text-neutral-500 tracking-wider">
                  {t('header.storyboardProjectsCount', { count: projects.length })}
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
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#dfdacf] dark:hover:bg-neutral-800/80 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/15 text-blue-800 dark:bg-blue-600/10 dark:text-blue-400 font-semibold'
                            : 'text-[#333029] dark:text-neutral-300'
                        }`}
                      >
                        <span className="truncate pr-2">{p.title}</span>
                        {isSelected && <span className="text-[10px] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {isAdmin && (
                  <div className="p-1 border-t border-[#d4cfc3] dark:border-neutral-800">
                    <button
                      onClick={() => {
                        setProjectMenuOpen(false);
                        onOpenAdminConsole();
                      }}
                      className="w-full text-left px-3 py-1.5 text-blue-700 dark:text-blue-400 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-1.5 font-semibold text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('header.manageNewProject')}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User Role Tag */}
        <span
          className={`hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border whitespace-nowrap shrink-0 ${
            activeRole === 'Admin'
              ? 'bg-blue-600/15 text-blue-800 border-blue-600/35 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/40'
              : activeRole === 'Editor'
              ? 'bg-emerald-700/15 text-emerald-800 border-emerald-700/35 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/40'
              : 'bg-[#dcd7cc] text-[#5c584e] border-[#c3beb1] dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'
          }`}
        >
          {tRole(activeRole)}
        </span>

        {/* Canvas Quick Search */}
        <HeaderSearch
          nodes={nodes}
          texts={texts}
          labels={labels}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          matchCount={searchMatchCount}
          totalNodeCount={Object.keys(nodes).length}
          focusSearchBinding={focusSearchBinding}
          onSelectTarget={onFocusSearchTarget}
        />
      </div>

      {/* Main Workspace Actions */}
      <div
        ref={rightZoneRef}
        className={`flex items-center gap-1.5 sm:gap-2 shrink-0 ${
          isStacked ? 'self-end' : ''
        }`}
      >
        {/* Libs Dropdown (Gallery, Map Lib, Video Lib, Archive) */}
        <div className="relative">
          <button
            onClick={() => {
              setLibsMenuOpen(!libsMenuOpen);
              setAddMenuOpen(false);
              setStyleMenuOpen(false);
            }}
            className="touch-target flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#2b2924] dark:text-neutral-200 bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 rounded-md border border-[#c3beb1] dark:border-neutral-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={t('header.libsTitle')}
          >
            <Library className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>{t('header.libs')}</span>
            <ChevronDown className="w-3 h-3 text-[#635e54] dark:text-neutral-400" />
          </button>

          {libsMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setLibsMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    onOpenGallery('images-manage');
                    setLibsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                  <span>{t('header.gallery')}</span>
                </button>
                <button
                  onClick={() => {
                    onOpenGallery('maps-manage');
                    setLibsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <MapIcon className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>{t('header.mapLib')}</span>
                </button>
                <button
                  onClick={() => {
                    onOpenVideoLib();
                    setLibsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <VideoIcon className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
                  <span>{t('header.videoLib')}</span>
                </button>
                <button
                  onClick={() => {
                    onOpenActorLib();
                    setLibsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Box className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
                  <span>{t('header.actorLib')}</span>
                </button>
                <button
                  onClick={() => {
                    onOpenArchive();
                    setLibsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 flex items-center justify-between border-t border-[#d4cfc3] dark:border-neutral-800 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Archive className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400 shrink-0" />
                    <span>{t('header.archive')}</span>
                  </span>
                  <span className="font-mono tabular-nums text-[10px] text-[#635e54] dark:text-neutral-400">
                    {storedCount}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => {
            setLibsMenuOpen(false);
            setAddMenuOpen(false);
            setStyleMenuOpen(false);
            setUserMenuOpen(false);
            onOpenLabelManager();
          }}
          className={`touch-target flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeLabelFilterCount > 0
              ? 'bg-blue-600/15 border-blue-600/40 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500/50 dark:text-blue-300'
              : 'text-[#2b2924] dark:text-neutral-200 bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 border-[#c3beb1] dark:border-neutral-700'
          }`}
          title={t('header.labelsTitle')}
        >
          <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
          <span className="hidden md:inline">{t('header.labels')}</span>
          {activeLabelFilterCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold tabular-nums">
              {activeLabelFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenExport}
          className="touch-target flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#2b2924] dark:text-neutral-200 bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 rounded-md border border-[#c3beb1] dark:border-neutral-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title={t('header.exportTitle')}
        >
          <Download className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
          <span className="hidden sm:inline">{t('header.export')}</span>
        </button>

        {/* Unified Blue "+ Add" Dropdown (hidden for Viewer role) */}
        {!isReadOnly && (
          <div className="relative">
            <button
              onClick={() => {
                setAddMenuOpen(!addMenuOpen);
                setLibsMenuOpen(false);
                setStyleMenuOpen(false);
              }}
              className="touch-target flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('header.add')}</span>
              <ChevronDown className="w-3 h-3 text-blue-100" />
            </button>

            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1">
                  <button
                    onClick={() => {
                      onAddNode();
                      setAddMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-white bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('header.addNode')}</span>
                  </button>

                  <div className="h-px bg-[#d4cfc3] dark:bg-neutral-800 my-1" />

                  <button
                    onClick={() => {
                      onAddTextDirect('floating');
                      setAddMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Type className="w-3.5 h-3.5 text-[#635e54] dark:text-neutral-400 shrink-0" />
                    <span>{t('header.text')}</span>
                  </button>

                  <button
                    onClick={() => {
                      onAddTextDirect('container');
                      setAddMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0" />
                    <span>{t('header.container')}</span>
                  </button>

                  <button
                    onClick={() => {
                      onAddTextDirect('annotation');
                      setAddMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <StickyNote className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>{t('header.stickyNote')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="h-4 w-px bg-[#c3beb1] dark:bg-neutral-800 mx-0.5" />

        {/* Viewport controls */}
        <select
          value="custom"
          onChange={(e) => {
            const val = e.target.value;
            if (val === '100' || val === 'center' || val === 'fit') {
              onZoomChange(val);
            }
          }}
          className="touch-target bg-[#dcd7cc] dark:bg-neutral-800 text-[#2b2924] dark:text-neutral-200 text-xs rounded-md px-2 sm:px-2.5 py-1.5 border border-[#c3beb1] dark:border-neutral-700 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option ref={zoomOptionRef} value="custom" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
            {t('header.zoomPercent', { percent: Math.round(zoom * 100) })}
          </option>
          <option value="100" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('header.zoomReset100')}</option>
          <option value="center" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('header.zoomCenter')}</option>
          <option value="fit" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">{t('header.zoomFitAll')}</option>
        </select>

        {/* Estilo Dropdown (replaces standalone Theme toggle) */}
        <div className="relative">
          <button
            onClick={() => {
              setStyleMenuOpen(!styleMenuOpen);
              setLibsMenuOpen(false);
              setAddMenuOpen(false);
              setUserMenuOpen(false);
            }}
            className={`touch-target flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              styleMenuOpen
                ? 'bg-blue-600/15 border-blue-600/40 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500/50 dark:text-blue-300'
                : 'text-[#2b2924] dark:text-neutral-200 bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 border-[#c3beb1] dark:border-neutral-700'
            }`}
            title={t('header.styleTitle')}
          >
            <Palette className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
            <span className="hidden sm:inline">{t('header.style')}</span>
            <ChevronDown className="w-3 h-3 text-[#635e54] dark:text-neutral-400 shrink-0" />
          </button>

          {styleMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStyleMenuOpen(false)} />
              <div className="absolute right-0 mt-1.5 z-50">
                <StyleMenuPopover
                  styleSettings={styleSettings}
                  onChange={onChangeStyleSettings}
                  onResetCurrentTheme={onResetStyleSettings}
                />
              </div>
            </>
          )}
        </div>

        {/* User profile dropdown / Google Sign-In */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setStyleMenuOpen(false);
              setLibsMenuOpen(false);
              setAddMenuOpen(false);
            }}
            className="touch-target flex items-center gap-1.5 pl-2 pr-2.5 py-1 text-xs rounded-md bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800/80 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-[#2b2924] dark:text-neutral-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full border border-[#b6b0a2] dark:border-neutral-600" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-blue-600/15 dark:bg-blue-500/20 border border-blue-600/35 dark:border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden lg:inline max-w-[90px] truncate">{user.name}</span>
            <ChevronDown className="w-3 h-3 text-[#635e54] dark:text-neutral-400" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-56 bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl py-1 z-50 text-xs">
                <div className="px-3 py-2 border-b border-[#d4cfc3] dark:border-neutral-800">
                  <p className="font-semibold text-[#2b2924] dark:text-neutral-200 truncate">{user.name}</p>
                  <p className="text-[10px] text-[#6b665b] dark:text-neutral-500 font-mono truncate">{user.email}</p>
                  <p className="text-[10px] text-blue-700 dark:text-blue-400 font-medium mt-0.5">
                    {t('header.roleSummary', { role: tRole(activeRole) })}
                    {activeRole !== user.role ? t('header.roleGlobalSuffix', { role: tRole(user.role) }) : ''}
                  </p>
                </div>

                {/* Language Switcher Row */}
                <div className="px-3 py-2 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[#333029] dark:text-neutral-300 font-medium">
                    <Languages className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span>{t('common.language')}</span>
                  </span>
                  <div className="inline-flex rounded-md border border-[#c3beb1] dark:border-neutral-700 bg-[#dcd7cc] dark:bg-neutral-800 p-0.5 text-[10px] shrink-0">
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                        language === 'en'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('es')}
                      className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                        language === 'es'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                      }`}
                    >
                      ES
                    </button>
                  </div>
                </div>

                {isAdmin && (
                  <div className="p-1 border-b border-[#d4cfc3] dark:border-neutral-800 space-y-0.5">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenAdminConsole();
                      }}
                      className="w-full text-left px-3 py-1.5 text-amber-800 dark:text-amber-300 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      title={t('header.adminConsoleTitle')}
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      <span>{t('header.adminConsole')}</span>
                    </button>

                    <a
                      href="https://visual-workflow-canvas.vercel.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-3 py-1.5 text-emerald-800 dark:text-emerald-300 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center justify-between gap-2 font-medium cursor-pointer"
                      title={t('header.liveVercelTitle')}
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>{t('header.liveVercel')}</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-emerald-700/70 dark:text-emerald-400/70" />
                    </a>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenArchitecture();
                      }}
                      className="w-full text-left px-3 py-1.5 text-blue-800 dark:text-blue-300 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      title={t('header.architectureTitle')}
                    >
                      <FileCode2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                      <span>{t('header.architecture')}</span>
                    </button>
                  </div>
                )}

                <div className="p-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenKeyboardShortcuts();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                    title={t('header.keyboardShortcutsTitle')}
                  >
                    <span className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                      <span>{t('header.keyboardShortcuts')}</span>
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[#dcd7cc] dark:bg-neutral-800 border border-[#c3beb1] dark:border-neutral-700 text-[10px] font-mono text-[#5c584e] dark:text-neutral-400">
                      {formatShortcutString(openShortcutsBinding)}
                    </kbd>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenApiKeyConfig();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#2b2924] dark:text-neutral-200 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                    title={t('header.configApiKeyTitle')}
                  >
                    <span className="flex items-center gap-2">
                      <KeyRound className={`w-3.5 h-3.5 ${hasApiKey ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`} />
                      <span>{t('header.configApiKey')}</span>
                    </span>
                    <span className="text-[10px] text-[#635e54] dark:text-neutral-400">
                      {hasApiKey ? t('header.saved') : t('header.set')}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignInGoogle();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#333029] dark:text-neutral-300 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>{t('header.switchGoogleLogin')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-red-700 dark:text-red-400 hover:bg-[#dfdacf] dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('header.signOut')}</span>
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
