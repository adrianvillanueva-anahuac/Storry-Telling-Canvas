import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ActorItem,
  AppState,
  CanvasStyleSettings,
  Connection,
  DEFAULT_CANVAS_STYLE,
  GlobalVideo,
  ImageResource,
  LabelItem,
  NodeActorAssignment,
  Project,
  TextElement,
  UserProfile,
  WorkflowNode,
} from './types/workflow';
import {
  auth,
  signInWithGoogle,
  logOut,
  testFirestoreConnection,
  onAuthStateChanged,
  FirebaseUser,
} from './services/firebase';
import {
  subscribeProjects,
  createProject,
  deleteProject,
  updateProject,
  subscribeProjectCanvas,
  saveNodeToFirestore,
  deleteNodeFromFirestore,
  archiveNodeInFirestore,
  restoreNodeInFirestore,
  deleteStoredNodeFromFirestore,
  updateStoredNodeNoteInFirestore,
  saveConnectionToFirestore,
  deleteConnectionFromFirestore,
  saveTextToFirestore,
  deleteTextFromFirestore,
  saveCanvasPositionsBatch,
  deleteCanvasItemsBatch,
  archiveNodesBatch,
  subscribeUsers,
  subscribeUserProfile,
  updateUserRole,
  inviteUserByEmail,
  deleteUserCompletely,
  setProjectParticipantRole,
  removeProjectParticipant,
  setUserProjectAssignments,
  subscribeAllImages,
  registerImageInDb,
  deleteImageFromDb,
  clearDeletedImagesFromProjectNodes,
  subscribeProjectVideos,
  addProjectVideoDoc,
  deleteProjectVideoDoc,
  subscribeProjectActors,
  saveProjectActor,
  deleteProjectActor,
  subscribeUserGeminiApiKey,
  saveUserGeminiApiKey,
  deleteUserGeminiApiKey,
  saveLabelToFirestore,
  deleteLabelFromFirestore,
  syncCanvasSnapshotDiffToFirestore,
  CanvasSnapshotData,
} from './services/firestoreService';
import { uploadImageToStorage } from './services/storageService';
import {
  ImageSearchResultItem,
  importExternalImageAsFile,
} from './services/librarySearchService';
import {
  MousePointer2,
  Hand,
  Trash2,
  Archive,
  X,
  Undo2,
  Redo2,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Tag,
} from 'lucide-react';
import { Header } from './components/Header';
import { LabelFilterBar, UNLABELED_FILTER_ID } from './components/LabelFilterBar';
import { WorkflowNodeCard } from './components/WorkflowNodeCard';
import { CanvasTextCard } from './components/CanvasTextCard';
import { ConnectionLines } from './components/ConnectionLines';
import { LinePropertiesMenu } from './components/popovers/LinePropertiesMenu';
import { TextPropertiesMenu } from './components/popovers/TextPropertiesMenu';
import { LabelPickerPopover } from './components/popovers/LabelPickerPopover';
import { LabelManagerModal } from './components/modals/LabelManagerModal';
import { DeleteWarningModal } from './components/modals/DeleteWarningModal';
import { ArchiveModal } from './components/modals/ArchiveModal';
import { GalleryModal } from './components/modals/GalleryModal';
import { GlobalVideoModal } from './components/modals/GlobalVideoModal';
import { ActorLibraryModal } from './components/modals/ActorLibraryModal';
import { ActorDetailModal } from './components/modals/ActorDetailModal';
import { VideoSelectionModal } from './components/modals/VideoSelectionModal';
import { VideoPlayerModal } from './components/modals/VideoPlayerModal';
import { NodeDashboardModal } from './components/modals/NodeDashboardModal';
import { PinningModal } from './components/modals/PinningModal';
import { MapViewerModal } from './components/modals/MapViewerModal';
import { ReplaceImageWarningModal } from './components/modals/ReplaceImageWarningModal';
import { AdminConsoleModal } from './components/modals/AdminConsoleModal';
import { ExportModal } from './components/modals/ExportModal';
import { ApiKeyConfigModal } from './components/modals/ApiKeyConfigModal';
import { AiImagePromptModal } from './components/modals/AiImagePromptModal';
import { SketchStudioModal } from './components/modals/SketchStudioModal';
import {
  SearchTarget,
  doesNodeMatchQuery,
  doesTextMatchQuery,
} from './components/HeaderSearch';
import { ViewportCanvasRect } from './utils/canvasExport';
import { computeNodeSnap, SnapGuideLine } from './utils/snapGuides';
import { getNodePortCoords } from './utils/connectionPath';
import { ReactiveDotGrid } from './components/ReactiveDotGrid';
import { useLanguage } from './hooks/useLanguage';

const MAX_HISTORY_STEPS = 10;

interface CanvasSnapshot extends CanvasSnapshotData {
  labels: Record<string, LabelItem>;
}

const cloneCanvasSnapshot = (snap: CanvasSnapshot): CanvasSnapshot =>
  JSON.parse(JSON.stringify(snap)) as CanvasSnapshot;

const areCanvasSnapshotsEqual = (a: CanvasSnapshot, b: CanvasSnapshot): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export default function App() {
  const { language, setLanguage, locale, t } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;

  // Authentication & Role
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    uid: '',
    name: t('app.defaultMemberName'),
    role: 'Viewer',
    email: '',
    isRegistered: false,
  });

  // Canvas & Theme style state (persisted + synced to <html>)
  const [canvasStyle, setCanvasStyle] = useState<CanvasStyleSettings>(() => {
    try {
      const legacyDark = localStorage.getItem('vwc-theme') !== 'light';
      const raw = localStorage.getItem('vwc-canvas-style');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CanvasStyleSettings>;
        return {
          ...DEFAULT_CANVAS_STYLE,
          ...parsed,
          isDark: typeof parsed.isDark === 'boolean' ? parsed.isDark : legacyDark,
          themeColors: {
            dark: {
              ...DEFAULT_CANVAS_STYLE.themeColors.dark,
              ...(parsed.themeColors?.dark || {}),
            },
            light: {
              ...DEFAULT_CANVAS_STYLE.themeColors.light,
              ...(parsed.themeColors?.light || {}),
            },
          },
        };
      }
      return {
        ...DEFAULT_CANVAS_STYLE,
        isDark: legacyDark,
      };
    } catch {
      return DEFAULT_CANVAS_STYLE;
    }
  });

  const isDark = canvasStyle.isDark;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    try {
      localStorage.setItem('vwc-theme', isDark ? 'dark' : 'light');
      localStorage.setItem('vwc-canvas-style', JSON.stringify(canvasStyle));
    } catch {
      // ignore storage quota errors
    }
  }, [isDark, canvasStyle]);

  const handleResetCanvasStyle = useCallback(() => {
    setCanvasStyle((prev) => {
      const activeKey = prev.isDark ? 'dark' : 'light';
      return {
        ...DEFAULT_CANVAS_STYLE,
        isDark: prev.isDark,
        themeColors: {
          ...prev.themeColors,
          [activeKey]: { ...DEFAULT_CANVAS_STYLE.themeColors[activeKey] },
        },
      };
    });
  }, []);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  // Firestore Real-Time Canvas Data
  const [appState, setAppState] = useState<AppState>({
    nodes: {},
    connections: [],
    texts: {},
    labels: {},
    storedNodes: {},
    globalVideos: [],
    actors: [],
  });

  // Users & Web Image DB from Firestore
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [imagesDbList, setImagesDbList] = useState<ImageResource[]>([]);
  const [imagesDbLoaded, setImagesDbLoaded] = useState(false);
  const recentlyUploadedUrlsRef = useRef<Set<string>>(new Set());

  // Zoom & Viewport
  const [zoom, setZoom] = useState(1);
  const currentZoomRef = useRef(1);
  const targetZoomRef = useRef(1);
  const targetLogZoomRef = useRef(0);
  const logZoomVelocityRef = useRef(0);
  const zoomRafRef = useRef<number | null>(null);
  const lastZoomFrameTimeRef = useRef<number>(0);
  const lastStateSyncTimeRef = useRef<number>(0);
  const cameraPosRef = useRef<{ x: number; y: number }>({ x: 1850, y: 2050 });
  const dotGridRenderRef = useRef<(() => void) | null>(null);
  const zoomAnchorRef = useRef<{
    mouseX: number;
    mouseY: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Modals & Panels
  const [adminConsoleOpen, setAdminConsoleOpen] = useState(false);
  const [architectureModalOpen, setArchitectureModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportViewportRect, setExportViewportRect] = useState<ViewportCanvasRect>({
    x: 2000,
    y: 2000,
    width: 1280,
    height: 800,
    zoom: 1,
  });
  const [highlightedElementId, setHighlightedElementId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEditNodeId, setActiveEditNodeId] = useState<string | null>(null);
  const [pinningNodeId, setPinningNodeId] = useState<string | null>(null);
  const [mapViewerNodeId, setMapViewerNodeId] = useState<string | null>(null);
  const [galleryModalState, setGalleryModalState] = useState<{
    open: boolean;
    mode: 'images-manage' | 'maps-manage' | 'images-picker' | 'maps-picker';
  }>({ open: false, mode: 'images-manage' });

  const [globalVideoModalOpen, setGlobalVideoModalOpen] = useState(false);
  const [actorLibraryState, setActorLibraryState] = useState<{
    open: boolean;
    editActorId?: string | null;
    pickForNodeId?: string | null;
  }>({ open: false });
  const [inspectedActor, setInspectedActor] = useState<ActorItem | null>(null);
  const [videoSelectCol, setVideoSelectCol] = useState<'enfoque' | 'accion' | 'descripcion' | null>(null);
  const [videoPlayerCol, setVideoPlayerCol] = useState<'enfoque' | 'accion' | 'descripcion' | null>(null);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([]);
  const [filterDisplayMode, setFilterDisplayMode] = useState<'dim' | 'isolate'>('dim');
  const [labelPickerTarget, setLabelPickerTarget] = useState<{
    mode: 'node' | 'text' | 'batch';
    targetId?: string;
    x: number;
    y: number;
  } | null>(null);
  const seededLegacyLabelsRef = useRef<Set<string>>(new Set());
  const [deleteWarningNodeId, setDeleteWarningNodeId] = useState<string | null>(null);
  const [replaceWarningTarget, setReplaceWarningTarget] = useState<{
    nodeId: string;
    pendingUrl: string | null;
  } | null>(null);
  const [userGeminiApiKey, setUserGeminiApiKey] = useState<string | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [aiImageModalState, setAiImageModalState] = useState<{
    mode: 'create' | 'edit';
    targetKind: 'image' | 'map';
    targetScope: 'node' | 'library';
    nodeId?: string;
    sourceImageUrl?: string | null;
    defaultTitle?: string;
    applyToPickerNode?: boolean;
  } | null>(null);
  const [sketchStudioState, setSketchStudioState] = useState<{
    nodeId: string;
    targetKind: 'image' | 'map';
  } | null>(null);

  // Popovers
  const [activeLinePopover, setActiveLinePopover] = useState<{
    connectionId: string;
    x: number;
    y: number;
  } | null>(null);

  const [activeTextPopover, setActiveTextPopover] = useState<{
    elementId: string;
    x: number;
    y: number;
  } | null>(null);

  // Canvas Tool Mode, Multi-Selection & Marquee Box
  const [canvasToolMode, setCanvasToolMode] = useState<'select' | 'pan'>('select');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, 'node' | 'text'>>({});
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
    baseSelection: Record<string, 'node' | 'text'>;
  } | null>(null);

  // Active Dragging & Port Connection
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const activeTouchPointsRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchStateRef = useRef<{
    pointerId1: number;
    pointerId2: number;
    prevDist: number;
    prevMidX: number;
    prevMidY: number;
  } | null>(null);
  const suppressTouchUntilZeroRef = useRef(false);

  const [hoveredDropContainerId, setHoveredDropContainerId] = useState<string | null>(null);
  const pendingExitContainerRef = useRef<Record<string, string>>({});
  const dragStartContainerBoundsRef = useRef<{
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null>(null);

  const [activeDragElement, setActiveDragElement] = useState<{
    id: string;
    type: 'node' | 'text';
    startX: number;
    startY: number;
    initialMouseX: number;
    initialMouseY: number;
    isMultiDrag: boolean;
    pendingShiftDeselect?: { id: string; type: 'node' | 'text' } | null;
    movingIds: string[];
    childrenOffsets: { id: string; type: 'node' | 'text'; startX: number; startY: number }[];
  } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuideLine[]>([]);

  const [tempConnection, setTempConnection] = useState<{
    sourceId: string;
    sourcePort: 'top' | 'bottom' | 'left' | 'right';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hoverTarget?: {
      nodeId: string;
      port: 'top' | 'bottom' | 'left' | 'right';
      proximity: number;
      isReady: boolean;
      snapX: number;
      snapY: number;
    } | null;
  } | null>(null);

  // Undo / Redo History (10 Undo steps, 10 Redo steps)
  const appStateRef = useRef<AppState>(appState);
  appStateRef.current = appState;
  const undoStackRef = useRef<CanvasSnapshot[]>([]);
  const redoStackRef = useRef<CanvasSnapshot[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const dragPreActionSnapshotRef = useRef<CanvasSnapshot | null>(null);
  const lastCoalesceRef = useRef<{ key: string; timestamp: number } | null>(null);

  // Clear selection and undo/redo history when switching projects
  useEffect(() => {
    setSelectedItems({});
    setSelectionBox(null);
    setBatchDeleteOpen(false);
    setFilterLabelIds([]);
    setLabelPickerTarget(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    dragPreActionSnapshotRef.current = null;
    lastCoalesceRef.current = null;
    setUndoCount(0);
    setRedoCount(0);
  }, [activeProjectId]);

  // Test Firestore Connection on Boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Firebase Auth Listener & Live Role Sync
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubApiKey: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubApiKey) {
        unsubApiKey();
        unsubApiKey = null;
      }

      setFirebaseUser(fbUser);
      setAuthReady(true);

      if (fbUser) {
        const normalizedEmail = (fbUser.email || '').toLowerCase();
        const isSuperAdmin = normalizedEmail === 'adrian.byakko@gmail.com';
        setCurrentUser({
          uid: fbUser.uid,
          name: fbUser.displayName || tRef.current('app.defaultMemberName'),
          email: normalizedEmail,
          photoURL: fbUser.photoURL || '',
          role: isSuperAdmin ? 'Admin' : 'Viewer',
          isRegistered: true,
        });

        unsubProfile = subscribeUserProfile(fbUser.uid, (profile) => {
          if (!profile) return;
          setCurrentUser((prev) => ({
            ...prev,
            name: profile.name || prev.name,
            email: profile.email || prev.email,
            photoURL: profile.photoURL || prev.photoURL,
            role: isSuperAdmin ? 'Admin' : (profile.role || prev.role),
            isRegistered: profile.isRegistered ?? true,
          }));
        });

        unsubApiKey = subscribeUserGeminiApiKey(fbUser.uid, (apiKey) => {
          setUserGeminiApiKey(apiKey);
        });
      } else {
        setCurrentUser({
          uid: '',
          name: tRef.current('app.defaultMemberName'),
          role: 'Viewer',
          email: '',
          isRegistered: false,
        });
        setUserGeminiApiKey(null);
        setApiKeyModalOpen(false);
        setAiImageModalState(null);
        setProjects([]);
        setActiveProjectId('');
        setUsersList([]);
        setImagesDbList([]);
        setImagesDbLoaded(false);
      }
    });

    return () => {
      if (unsubProfile) unsubProfile();
      if (unsubApiKey) unsubApiKey();
      unsubAuth();
    };
  }, []);

  const normalizedUserEmail = currentUser.email.trim().toLowerCase();
  const isGlobalAdmin =
    normalizedUserEmail === 'adrian.byakko@gmail.com' || currentUser.role === 'Admin';
  const visibleProjects = isGlobalAdmin
    ? projects
    : projects.filter(
        (p) =>
          p.ownerId === firebaseUser?.uid ||
          Boolean(p.participants && normalizedUserEmail in p.participants) ||
          !p.participants ||
          Object.keys(p.participants).length === 0
      );
  const activeProject =
    visibleProjects.find((p) => p.id === activeProjectId) ||
    (isGlobalAdmin ? projects.find((p) => p.id === activeProjectId) || null : null);
  const effectiveRole: 'Admin' | 'Editor' | 'Viewer' = isGlobalAdmin
    ? 'Admin'
    : activeProject?.participants?.[normalizedUserEmail]?.role || currentUser.role;
  const isReadOnly = effectiveRole === 'Viewer';
  const isReadOnlyRef = useRef(isReadOnly);
  isReadOnlyRef.current = isReadOnly;

  const captureCanvasSnapshot = useCallback((state: AppState = appStateRef.current): CanvasSnapshot => {
    return cloneCanvasSnapshot({
      nodes: state.nodes,
      connections: state.connections,
      texts: state.texts,
      storedNodes: state.storedNodes,
      labels: state.labels,
    });
  }, []);

  const pushUndoSnapshot = useCallback(
    (snapshot?: CanvasSnapshot, coalesceKey?: string) => {
      if (isReadOnly) return;
      const now = Date.now();
      if (coalesceKey) {
        const last = lastCoalesceRef.current;
        if (last && last.key === coalesceKey && now - last.timestamp < 700) {
          lastCoalesceRef.current = { key: coalesceKey, timestamp: now };
          return;
        }
        lastCoalesceRef.current = { key: coalesceKey, timestamp: now };
      } else {
        lastCoalesceRef.current = null;
      }

      const entry = cloneCanvasSnapshot(snapshot ?? captureCanvasSnapshot(appStateRef.current));
      const nextUndo = [...undoStackRef.current, entry].slice(-MAX_HISTORY_STEPS);
      undoStackRef.current = nextUndo;
      redoStackRef.current = [];
      setUndoCount(nextUndo.length);
      setRedoCount(0);
    },
    [isReadOnly, captureCanvasSnapshot]
  );

  const applyRestoredSnapshot = useCallback(
    (targetSnap: CanvasSnapshot, currentSnap: CanvasSnapshot) => {
      const clonedTarget = cloneCanvasSnapshot(targetSnap);
      const nextAppState: AppState = {
        ...appStateRef.current,
        nodes: clonedTarget.nodes,
        connections: clonedTarget.connections,
        texts: clonedTarget.texts,
        storedNodes: clonedTarget.storedNodes,
        labels: clonedTarget.labels,
      };
      appStateRef.current = nextAppState;
      setAppState(nextAppState);

      setSelectedItems((prev) => {
        const cleaned: Record<string, 'node' | 'text'> = {};
        let changed = false;
        Object.entries(prev).forEach(([id, t]) => {
          if ((t === 'node' && clonedTarget.nodes[id]) || (t === 'text' && clonedTarget.texts[id])) {
            cleaned[id] = t;
          } else {
            changed = true;
          }
        });
        return changed ? cleaned : prev;
      });

      setActiveLinePopover((prev) =>
        prev && !clonedTarget.connections.some((c) => c.id === prev.connectionId) ? null : prev
      );
      setActiveTextPopover((prev) => (prev && !clonedTarget.texts[prev.elementId] ? null : prev));

      if (activeProjectId) {
        syncCanvasSnapshotDiffToFirestore(activeProjectId, currentSnap, clonedTarget);
      }
    },
    [activeProjectId]
  );

  const handleUndo = useCallback(() => {
    if (!activeProjectId || isReadOnly) return;
    if (undoStackRef.current.length === 0) return;

    const prevUndo = undoStackRef.current;
    const targetSnap = prevUndo[prevUndo.length - 1];
    const nextUndo = prevUndo.slice(0, -1);

    const currentSnap = captureCanvasSnapshot(appStateRef.current);
    const nextRedo = [...redoStackRef.current, currentSnap].slice(-MAX_HISTORY_STEPS);

    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    lastCoalesceRef.current = null;
    setUndoCount(nextUndo.length);
    setRedoCount(nextRedo.length);

    applyRestoredSnapshot(targetSnap, currentSnap);
  }, [activeProjectId, isReadOnly, captureCanvasSnapshot, applyRestoredSnapshot]);

  const handleRedo = useCallback(() => {
    if (!activeProjectId || isReadOnly) return;
    if (redoStackRef.current.length === 0) return;

    const prevRedo = redoStackRef.current;
    const targetSnap = prevRedo[prevRedo.length - 1];
    const nextRedo = prevRedo.slice(0, -1);

    const currentSnap = captureCanvasSnapshot(appStateRef.current);
    const nextUndo = [...undoStackRef.current, currentSnap].slice(-MAX_HISTORY_STEPS);

    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    lastCoalesceRef.current = null;
    setUndoCount(nextUndo.length);
    setRedoCount(nextRedo.length);

    applyRestoredSnapshot(targetSnap, currentSnap);
  }, [activeProjectId, isReadOnly, captureCanvasSnapshot, applyRestoredSnapshot]);

  // Subscribe to Projects Collection in Firestore (Authenticated only)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const fbEmail = (firebaseUser.email || '').trim().toLowerCase();
    const isAdminUser = fbEmail === 'adrian.byakko@gmail.com' || currentUser.role === 'Admin';

    const unsub = subscribeProjects((projList) => {
      setProjects(projList);
      const accessible = isAdminUser
        ? projList
        : projList.filter(
            (p) =>
              p.ownerId === firebaseUser.uid ||
              Boolean(p.participants && fbEmail in p.participants) ||
              !p.participants ||
              Object.keys(p.participants).length === 0
          );

      if (projList.length === 0 && (currentUser.role === 'Admin' || currentUser.role === 'Editor')) {
        // Automatically seed first project if database is empty
        createProject(
          tRef.current('app.seedProjectTitle'),
          tRef.current('app.seedProjectDesc'),
          firebaseUser.uid,
          fbEmail,
          firebaseUser.displayName || currentUser.name
        ).then((newId) => {
          setActiveProjectId(newId);
          setTimeout(() => centerCanvas(), 200);
        });
      } else if (accessible.length > 0 && (!activeProjectId || !accessible.some((p) => p.id === activeProjectId))) {
        setActiveProjectId(accessible[0].id);
        setTimeout(() => centerCanvas(), 200);
      } else if (accessible.length === 0 && activeProjectId) {
        setActiveProjectId('');
      }
    });

    return () => unsub();
  }, [authReady, firebaseUser, activeProjectId, currentUser.role, currentUser.name]);

  // Subscribe to Real-Time Canvas Subcollections for the Active Project
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeProjectId) return;

    const unsubCanvas = subscribeProjectCanvas(activeProjectId, (data) => {
      let resolvedLabels = data.labels;
      if (Object.keys(data.labels).length === 0) {
        const starterTemplates: Record<string, LabelItem> = {
          'lbl-1': { id: 'lbl-1', projectId: activeProjectId, name: tRef.current('app.seedLabelAct1'), color: '#2563eb' },
          'lbl-2': { id: 'lbl-2', projectId: activeProjectId, name: tRef.current('app.seedLabelReview'), color: '#dc2626' },
          'lbl-3': { id: 'lbl-3', projectId: activeProjectId, name: tRef.current('app.seedLabelPolish'), color: '#059669' },
        };
        const referencedIds = new Set<string>();
        Object.values(data.nodes).forEach((n) => {
          if (n.labelId && starterTemplates[n.labelId]) referencedIds.add(n.labelId);
        });
        Object.values(data.texts).forEach((el) => {
          if (el.labelId && starterTemplates[el.labelId]) referencedIds.add(el.labelId);
        });
        if (referencedIds.size > 0) {
          const fallbackMap: Record<string, LabelItem> = {};
          referencedIds.forEach((id) => {
            fallbackMap[id] = starterTemplates[id];
          });
          resolvedLabels = fallbackMap;
          if (!isReadOnlyRef.current && !seededLegacyLabelsRef.current.has(activeProjectId)) {
            seededLegacyLabelsRef.current.add(activeProjectId);
            referencedIds.forEach((id) => {
              saveLabelToFirestore(activeProjectId, id, starterTemplates[id]);
            });
          }
        }
      }

      setAppState((prev) => {
        const next = {
          ...prev,
          nodes: data.nodes,
          connections: data.connections,
          texts: data.texts,
          storedNodes: data.storedNodes,
          labels: resolvedLabels,
        };
        appStateRef.current = next;
        return next;
      });
    });

    return () => unsubCanvas();
  }, [authReady, firebaseUser, activeProjectId]);

  // Subscribe to Web Image Database (Authenticated only)
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setImagesDbLoaded(false);
      return;
    }

    const unsubImages = subscribeAllImages((imgs) => {
      setImagesDbList(imgs);
      setImagesDbLoaded(true);
    });
    return () => {
      unsubImages();
    };
  }, [authReady, firebaseUser]);

  // Subscribe to Project-Scoped YouTube Video References
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeProjectId) {
      setAppState((prev) => ({ ...prev, globalVideos: [] }));
      return;
    }

    const unsubVideos = subscribeProjectVideos(activeProjectId, (vids) => {
      setAppState((prev) => ({ ...prev, globalVideos: vids }));
    });
    return () => unsubVideos();
  }, [authReady, firebaseUser, activeProjectId]);

  // Subscribe to Project-Scoped Actors & 3D Elements Library
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeProjectId) {
      setAppState((prev) => ({ ...prev, actors: [] }));
      return;
    }

    const unsubActors = subscribeProjectActors(activeProjectId, (actors) => {
      setAppState((prev) => ({ ...prev, actors }));
    });
    return () => unsubActors();
  }, [authReady, firebaseUser, activeProjectId]);

  // Reconcile any node whose managed image URL was already removed from Image DB
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeProjectId || !imagesDbLoaded) return;

    const normalizeUrl = (u?: string | null) => (u ? u.split('?')[0].trim() : '');
    const isManagedMediaUrl = (u?: string | null) =>
      Boolean(u && (u.includes('.blob.vercel-storage.com') || u.startsWith('/uploads/')));

    const dbUrls = new Set(imagesDbList.map((img) => normalizeUrl(img.url)).filter(Boolean));
    const orphanUrls: string[] = [];
    const updatedNodes: Record<string, WorkflowNode> = {};
    let hasOrphans = false;

    Object.entries(appState.nodes).forEach(([id, node]) => {
      const mainNorm = normalizeUrl(node.image);
      const mapNorm = normalizeUrl(node.mapImage);
      const mainOrphan =
        isManagedMediaUrl(node.image) &&
        !dbUrls.has(mainNorm) &&
        !recentlyUploadedUrlsRef.current.has(mainNorm);
      const mapOrphan =
        isManagedMediaUrl(node.mapImage) &&
        !dbUrls.has(mapNorm) &&
        !recentlyUploadedUrlsRef.current.has(mapNorm);

      if (mainOrphan || mapOrphan) {
        hasOrphans = true;
        if (mainOrphan && node.image) orphanUrls.push(node.image);
        if (mapOrphan && node.mapImage) orphanUrls.push(node.mapImage);
        updatedNodes[id] = {
          ...node,
          ...(mainOrphan ? { image: null, imageDeletedFromAdmin: true } : {}),
          ...(mapOrphan ? { mapImage: null, mapName: '', mapImageDeletedFromAdmin: true } : {}),
        };
      }
    });

    if (!hasOrphans) return;

    setAppState((prev) => ({
      ...prev,
      nodes: {
        ...prev.nodes,
        ...updatedNodes,
      },
    }));

    if (!isReadOnly && orphanUrls.length > 0) {
      clearDeletedImagesFromProjectNodes(orphanUrls, [activeProjectId]);
    }
  }, [
    authReady,
    firebaseUser,
    activeProjectId,
    imagesDbLoaded,
    imagesDbList,
    appState.nodes,
    isReadOnly,
  ]);
  useEffect(() => {
    if (!authReady || !firebaseUser || currentUser.role !== 'Admin') {
      setUsersList([]);
      return;
    }

    const unsubUsers = subscribeUsers((users) => setUsersList(users));
    return () => unsubUsers();
  }, [authReady, firebaseUser, currentUser.role]);

  // Check if an element bounding box overlaps a container with generous magnetic tolerance
  const findOverlappingContainer = useCallback(
    (
      elX: number,
      elY: number,
      elW: number,
      elH: number,
      texts: Record<string, TextElement>,
      selfId: string,
      ignoreContainerId?: string | null
    ): string | null => {
      const elRight = elX + elW;
      const elBottom = elY + elH;
      const margin = 18;

      let bestId: string | null = null;
      let bestArea = 0;

      Object.entries(texts).forEach(([tid, textEl]) => {
        if (!textEl || textEl.mode !== 'container' || tid === selfId || tid === ignoreContainerId) return;
        const tx = (parseFloat(textEl.x) || 0) - margin;
        const ty = (parseFloat(textEl.y) || 0) - margin;
        const tw = (textEl.width || 340) + margin * 2;
        const th = (textEl.height || 240) + margin * 2;

        const overlapW = Math.max(0, Math.min(elRight, tx + tw) - Math.max(elX, tx));
        const overlapH = Math.max(0, Math.min(elBottom, ty + th) - Math.max(elY, ty));
        const area = overlapW * overlapH;

        if (overlapW >= 24 && overlapH >= 24 && area > bestArea) {
          bestArea = area;
          bestId = tid;
        }
      });

      return bestId;
    },
    []
  );

  // Update Container Bounds dynamically
  const updateContainerBounds = useCallback(
    (
      state: AppState,
      options?: {
        syncToFirestore?: boolean;
        extendOnly?: boolean;
        forceSyncIds?: string[];
      }
    ): AppState => {
      const syncToFirestore = options?.syncToFirestore ?? true;
      const extendOnly = options?.extendOnly ?? false;
      const forceSyncSet = new Set(options?.forceSyncIds || []);

      const updatedTexts = { ...state.texts };
      let hasChanges = false;

      Object.entries(updatedTexts).forEach(([tid, textEl]) => {
        if (textEl.mode === 'container') {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          let hasNodes = false;

          Object.values(state.nodes).forEach((n) => {
            if (n.containerId === tid) {
              hasNodes = true;
              const nx = parseFloat(n.x) || 0;
              const ny = parseFloat(n.y) || 0;
              const nw = 220;
              const nh = 171;

              if (nx < minX) minX = nx;
              if (ny < minY) minY = ny;
              if (nx + nw > maxX) maxX = nx + nw;
              if (ny + nh > maxY) maxY = ny + nh;
            }
          });

          Object.values(state.texts).forEach((childText) => {
            if (childText.containerId === tid && childText.id !== tid) {
              hasNodes = true;
              const cx = parseFloat(childText.x) || 0;
              const cy = parseFloat(childText.y) || 0;
              const cw = childText.width || 220;
              const ch = childText.height || 100;

              if (cx < minX) minX = cx;
              if (cy < minY) minY = cy;
              if (cx + cw > maxX) maxX = cx + cw;
              if (cy + ch > maxY) maxY = cy + ch;
            }
          });

          if (hasNodes && minX !== Infinity) {
            let targetLeft = minX - 35;
            let targetTop = minY - 50;
            let targetRight = maxX + 35;
            let targetBottom = maxY + 35;

            if (extendOnly) {
              const base =
                dragStartContainerBoundsRef.current?.id === tid
                  ? dragStartContainerBoundsRef.current
                  : {
                      left: parseFloat(textEl.x) || 0,
                      top: parseFloat(textEl.y) || 0,
                      right: (parseFloat(textEl.x) || 0) + (textEl.width || 340),
                      bottom: (parseFloat(textEl.y) || 0) + (textEl.height || 240),
                    };
              targetLeft = Math.min(base.left, targetLeft);
              targetTop = Math.min(base.top, targetTop);
              targetRight = Math.max(base.right, targetRight);
              targetBottom = Math.max(base.bottom, targetBottom);
            }

            const newX = `${targetLeft}px`;
            const newY = `${targetTop}px`;
            const newW = targetRight - targetLeft;
            const newH = targetBottom - targetTop;

            const changed =
              textEl.x !== newX ||
              textEl.y !== newY ||
              textEl.width !== newW ||
              textEl.height !== newH;

            if (changed) {
              hasChanges = true;
              updatedTexts[tid] = {
                ...textEl,
                x: newX,
                y: newY,
                width: newW,
                height: newH,
              };
            }

            if (syncToFirestore && activeProjectId && (changed || forceSyncSet.has(tid))) {
              saveTextToFirestore(activeProjectId, updatedTexts[tid]);
            }
          }
        }
      });

      return hasChanges ? { ...state, texts: updatedTexts } : state;
    },
    [activeProjectId]
  );

  const applyCameraTransform = useCallback((nextZoom: number, nextCamX: number, nextCamY: number) => {
    currentZoomRef.current = nextZoom;
    cameraPosRef.current.x = nextCamX;
    cameraPosRef.current.y = nextCamY;
    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate3d(${-nextCamX}px, ${-nextCamY}px, 0) scale(${nextZoom})`;
      canvasRef.current.style.setProperty('--canvas-zoom', `${nextZoom}`);
    }
    dotGridRenderRef.current?.();
  }, []);

  const registerDotGridRender = useCallback((fn: (() => void) | null) => {
    dotGridRenderRef.current = fn;
  }, []);

  const stopZoomAnimation = useCallback(() => {
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
    logZoomVelocityRef.current = 0;
    zoomAnchorRef.current = null;
    targetZoomRef.current = currentZoomRef.current;
    targetLogZoomRef.current = Math.log(currentZoomRef.current);
  }, []);

  const applyZoomImmediate = useCallback(
    (newZoom: number, nextCamX?: number, nextCamY?: number) => {
      stopZoomAnimation();
      const clamped = Math.max(0.2, Math.min(newZoom, 3.0));
      targetZoomRef.current = clamped;
      targetLogZoomRef.current = Math.log(clamped);
      const camX = typeof nextCamX === 'number' ? nextCamX : cameraPosRef.current.x;
      const camY = typeof nextCamY === 'number' ? nextCamY : cameraPosRef.current.y;
      applyCameraTransform(clamped, camX, camY);
      window.dispatchEvent(new CustomEvent('canvas-zoom-live', { detail: clamped }));
      setZoom(clamped);
    },
    [stopZoomAnimation, applyCameraTransform]
  );

  // Viewport helper functions
  const centerCanvas = () => {
    if (viewportRef.current) {
      applyZoomImmediate(
        1,
        2500 - viewportRef.current.clientWidth / 2,
        2500 - viewportRef.current.clientHeight / 2
      );
    } else {
      applyZoomImmediate(1);
    }
  };

  const fitAllNodes = () => {
    const nodeElements = Object.values(appState.nodes);
    if (nodeElements.length === 0) {
      centerCanvas();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodeElements.forEach((n) => {
      const x = parseFloat(n.x) || 0;
      const y = parseFloat(n.y) || 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + 220 > maxX) maxX = x + 220;
      if (y + 180 > maxY) maxY = y + 180;
    });

    const padding = 120;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    if (viewportRef.current) {
      const viewW = viewportRef.current.clientWidth;
      const viewH = viewportRef.current.clientHeight;

      const scaleX = viewW / width;
      const scaleY = viewH / height;
      const newZoom = Math.max(0.2, Math.min(Math.min(scaleX, scaleY), 2.5));

      const centerX = minX + width / 2;
      const centerY = minY + height / 2;

      applyZoomImmediate(newZoom, centerX * newZoom - viewW / 2, centerY * newZoom - viewH / 2);
    }
  };

  const handleFocusSearchTarget = useCallback(
    (target: SearchTarget) => {
      const vp = viewportRef.current;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;
      const targetZoom = Math.max(0.2, Math.min(Math.max(currentZoomRef.current, 0.9), 3.0));

      if (vp) {
        applyZoomImmediate(
          targetZoom,
          targetCenterX * targetZoom - vp.clientWidth / 2,
          targetCenterY * targetZoom - vp.clientHeight / 2
        );
      } else {
        applyZoomImmediate(targetZoom);
      }

      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      setHighlightedElementId(target.id);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedElementId(null);
        highlightTimerRef.current = null;
      }, 2200);
    },
    [applyZoomImmediate]
  );

  // Smooth critically-damped log-space zoom animation strictly anchored at cursor
  const stepZoomAnimation = useCallback(
    (now: number) => {
      const dt = lastZoomFrameTimeRef.current
        ? Math.max(0.001, Math.min((now - lastZoomFrameTimeRef.current) / 1000, 0.033))
        : 1 / 60;
      lastZoomFrameTimeRef.current = now;

      const minLog = Math.log(0.2);
      const maxLog = Math.log(3.0);
      const prevZoom = currentZoomRef.current;
      const prevLog = Math.log(prevZoom);
      const targetLog = targetLogZoomRef.current;

      // Critically damped spring in logarithmic space for constant perceptual speed & silky tail
      const stiffness = 95;
      const damping = 19.5;
      const force = (targetLog - prevLog) * stiffness;
      let logVel = (logZoomVelocityRef.current + force * dt) * Math.exp(-damping * dt);
      let nextLog = prevLog + logVel * dt;

      if (nextLog <= minLog) {
        nextLog = minLog;
        if (logVel < 0) logVel = 0;
      } else if (nextLog >= maxLog) {
        nextLog = maxLog;
        if (logVel > 0) logVel = 0;
      }

      const zoomSettled = Math.abs(targetLog - nextLog) < 0.0006 && Math.abs(logVel) < 0.0006;
      if (zoomSettled) {
        nextLog = targetLog;
        logVel = 0;
      }

      const nextZoom = Math.exp(nextLog);
      logZoomVelocityRef.current = logVel;
      targetZoomRef.current = Math.exp(targetLog);

      const vp = viewportRef.current;
      const anchor = zoomAnchorRef.current;
      let nextCamX = cameraPosRef.current.x;
      let nextCamY = cameraPosRef.current.y;

      if (vp && anchor) {
        nextCamX = anchor.canvasX * nextZoom - anchor.mouseX;
        nextCamY = anchor.canvasY * nextZoom - anchor.mouseY;
      }

      applyCameraTransform(nextZoom, nextCamX, nextCamY);

      if (now - lastStateSyncTimeRef.current >= 32) {
        lastStateSyncTimeRef.current = now;
        window.dispatchEvent(new CustomEvent('canvas-zoom-live', { detail: nextZoom }));
      }

      if (zoomSettled) {
        zoomRafRef.current = null;
        zoomAnchorRef.current = null;
        window.dispatchEvent(new CustomEvent('canvas-zoom-live', { detail: nextZoom }));
        setZoom(nextZoom);
      } else {
        zoomRafRef.current = requestAnimationFrame(stepZoomAnimation);
      }
    },
    [applyCameraTransform]
  );

  // Non-passive wheel listener for smooth logarithmic zoom without scroll jumps
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const minLog = Math.log(0.2);
    const maxLog = Math.log(3.0);

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();

      let normalizedDelta = e.deltaY;
      if (e.deltaMode === 1) normalizedDelta *= 16;
      else if (e.deltaMode === 2) normalizedDelta *= 320;
      normalizedDelta = Math.max(-180, Math.min(180, normalizedDelta));
      if (Math.abs(normalizedDelta) < 0.01) return;

      const nextTargetLog = Math.max(
        minLog,
        Math.min(targetLogZoomRef.current - normalizedDelta * 0.0011, maxLog)
      );
      if (
        zoomRafRef.current === null &&
        Math.abs(nextTargetLog - targetLogZoomRef.current) < 1e-6 &&
        Math.abs(Math.log(currentZoomRef.current) - nextTargetLog) < 1e-4
      ) {
        return;
      }

      const rect = vp.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevAnchor = zoomAnchorRef.current;
      if (
        zoomRafRef.current === null ||
        !prevAnchor ||
        Math.abs(mouseX - prevAnchor.mouseX) > 2 ||
        Math.abs(mouseY - prevAnchor.mouseY) > 2
      ) {
        const z = currentZoomRef.current;
        zoomAnchorRef.current = {
          mouseX,
          mouseY,
          canvasX: (cameraPosRef.current.x + mouseX) / z,
          canvasY: (cameraPosRef.current.y + mouseY) / z,
        };
      }

      targetLogZoomRef.current = nextTargetLog;
      targetZoomRef.current = Math.exp(nextTargetLog);

      setActiveLinePopover(null);

      if (zoomRafRef.current === null) {
        lastZoomFrameTimeRef.current = 0;
        lastStateSyncTimeRef.current = 0;
        zoomRafRef.current = requestAnimationFrame(stepZoomAnimation);
      }
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      vp.removeEventListener('wheel', onWheel);
      if (zoomRafRef.current !== null) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = null;
      }
    };
  }, [stepZoomAnimation, authReady, firebaseUser]);

  // Capture-phase touch tracking so 2-finger pinch works even over nodes, ports, lines, or handles
  const handleCanvasPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    if ((e.target as HTMLElement).closest('[data-canvas-ui]')) return;

    activeTouchPointsRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (activeTouchPointsRef.current.size === 2 && viewportRef.current) {
      // Revert any micro-drag started by the 1st finger before the 2nd finger landed
      const preSnap = dragPreActionSnapshotRef.current;
      if (activeDragElement && preSnap) {
        setAppState((prev) => {
          const next = {
            ...prev,
            nodes: preSnap.nodes,
            texts: preSnap.texts,
          };
          appStateRef.current = next;
          return next;
        });
      }

      setSelectionBox(null);
      setActiveDragElement(null);
      setTempConnection(null);
      setIsPanningCanvas(false);
      setSnapGuides([]);
      setHoveredDropContainerId(null);
      dragPreActionSnapshotRef.current = null;
      dragStartContainerBoundsRef.current = null;
      stopZoomAnimation();
      suppressTouchUntilZeroRef.current = true;

      const entries = Array.from(activeTouchPointsRef.current.entries());
      const [id1, pt1] = entries[0];
      const [id2, pt2] = entries[1];
      const rect = viewportRef.current.getBoundingClientRect();
      const vpMidX = (pt1.clientX + pt2.clientX) / 2 - rect.left;
      const vpMidY = (pt1.clientY + pt2.clientY) / 2 - rect.top;
      const dist = Math.hypot(pt2.clientX - pt1.clientX, pt2.clientY - pt1.clientY);

      pinchStateRef.current = {
        pointerId1: id1,
        pointerId2: id2,
        prevDist: Math.max(8, dist),
        prevMidX: vpMidX,
        prevMidY: vpMidY,
      };
    }
  };

  // Window-level touch pinch move/release & Safari gesture suppression for accurate midpoint zooming
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleWindowTouchPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !activeTouchPointsRef.current.has(e.pointerId)) return;
      activeTouchPointsRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

      const p = pinchStateRef.current;
      const currentVp = viewportRef.current;
      if (!p || !currentVp || activeTouchPointsRef.current.size < 2) return;

      const pt1 = activeTouchPointsRef.current.get(p.pointerId1);
      const pt2 = activeTouchPointsRef.current.get(p.pointerId2);
      if (!pt1 || !pt2) return;

      const dist = Math.hypot(pt2.clientX - pt1.clientX, pt2.clientY - pt1.clientY);
      const rect = currentVp.getBoundingClientRect();
      const vpMidX = (pt1.clientX + pt2.clientX) / 2 - rect.left;
      const vpMidY = (pt1.clientY + pt2.clientY) / 2 - rect.top;

      const prevZoom = currentZoomRef.current;
      const prevDist = Math.max(8, p.prevDist);
      const safeDist = Math.max(8, dist);
      const scaleFactor = dist >= 8 && p.prevDist >= 8 ? safeDist / prevDist : 1;
      const nextZoom = Math.max(0.2, Math.min(3.0, prevZoom * scaleFactor));

      // Pin exact canvas coordinate under previous finger midpoint directly to current finger midpoint
      const anchorCanvasX = (cameraPosRef.current.x + p.prevMidX) / prevZoom;
      const anchorCanvasY = (cameraPosRef.current.y + p.prevMidY) / prevZoom;
      const nextCamX = anchorCanvasX * nextZoom - vpMidX;
      const nextCamY = anchorCanvasY * nextZoom - vpMidY;

      p.prevDist = safeDist;
      p.prevMidX = vpMidX;
      p.prevMidY = vpMidY;

      targetZoomRef.current = nextZoom;
      targetLogZoomRef.current = Math.log(nextZoom);
      applyCameraTransform(nextZoom, nextCamX, nextCamY);

      const now = performance.now();
      if (now - lastStateSyncTimeRef.current >= 32) {
        lastStateSyncTimeRef.current = now;
        window.dispatchEvent(new CustomEvent('canvas-zoom-live', { detail: nextZoom }));
      }
    };

    const handleWindowTouchPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!activeTouchPointsRef.current.has(e.pointerId)) return;

      activeTouchPointsRef.current.delete(e.pointerId);
      if (pinchStateRef.current && activeTouchPointsRef.current.size < 2) {
        pinchStateRef.current = null;
        window.dispatchEvent(new CustomEvent('canvas-zoom-live', { detail: currentZoomRef.current }));
        setZoom(currentZoomRef.current);
      }
      if (activeTouchPointsRef.current.size === 0) {
        suppressTouchUntilZeroRef.current = false;
      }
    };

    const handleWindowBlur = () => {
      activeTouchPointsRef.current.clear();
      if (pinchStateRef.current) {
        pinchStateRef.current = null;
        setZoom(currentZoomRef.current);
      }
      suppressTouchUntilZeroRef.current = false;
    };

    const preventMultiTouchNative = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    const preventSafariGesture = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('pointermove', handleWindowTouchPointerMove);
    window.addEventListener('pointerup', handleWindowTouchPointerEnd);
    window.addEventListener('pointercancel', handleWindowTouchPointerEnd);
    window.addEventListener('blur', handleWindowBlur);
    vp.addEventListener('touchstart', preventMultiTouchNative, { passive: false });
    vp.addEventListener('touchmove', preventMultiTouchNative, { passive: false });
    vp.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    vp.addEventListener('gesturechange', preventSafariGesture, { passive: false });
    vp.addEventListener('gestureend', preventSafariGesture, { passive: false });

    return () => {
      window.removeEventListener('pointermove', handleWindowTouchPointerMove);
      window.removeEventListener('pointerup', handleWindowTouchPointerEnd);
      window.removeEventListener('pointercancel', handleWindowTouchPointerEnd);
      window.removeEventListener('blur', handleWindowBlur);
      vp.removeEventListener('touchstart', preventMultiTouchNative);
      vp.removeEventListener('touchmove', preventMultiTouchNative);
      vp.removeEventListener('gesturestart', preventSafariGesture);
      vp.removeEventListener('gesturechange', preventSafariGesture);
      vp.removeEventListener('gestureend', preventSafariGesture);
    };
  }, [applyCameraTransform, authReady, firebaseUser]);

  // Background Canvas Panning, Multi-Touch Pinch-Zoom & Marquee Selection Box
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-canvas-ui]')) return;

    if (
      e.pointerType === 'touch' &&
      (activeTouchPointsRef.current.size >= 2 || pinchStateRef.current || suppressTouchUntilZeroRef.current)
    ) {
      return;
    }

    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;

    const isMiddlePan = e.button === 1;
    const shouldPan =
      isMiddlePan ||
      isSpacePressed ||
      canvasToolMode === 'pan';

    if (!shouldPan) {
      if ((e.target as HTMLElement).closest('.workflow-node')) return;
      if ((e.target as HTMLElement).closest('.canvas-text-node')) return;
      if ((e.target as HTMLElement).closest('.port')) return;
    }

    if (!viewportRef.current) return;
    if (isMiddlePan) {
      e.preventDefault();
    }
    stopZoomAnimation();
    setActiveLinePopover(null);
    setActiveTextPopover(null);

    if (shouldPan) {
      setIsPanningCanvas(true);
      setPanStart({
        x: e.pageX - viewportRef.current.offsetLeft,
        y: e.pageY - viewportRef.current.offsetTop,
        scrollLeft: cameraPosRef.current.x,
        scrollTop: cameraPosRef.current.y,
      });
      return;
    }

    if ((e.pointerType !== 'mouse' || e.button === 0) && canvasRef.current) {
      const cRect = canvasRef.current.getBoundingClientRect();
      const liveZoom = currentZoomRef.current;
      const sx = (e.clientX - cRect.left) / liveZoom;
      const sy = (e.clientY - cRect.top) / liveZoom;
      const additive = e.shiftKey;
      const baseSelection = additive ? { ...selectedItems } : {};

      if (!additive) {
        setSelectedItems({});
      }

      setSelectionBox({
        startX: sx,
        startY: sy,
        currentX: sx,
        currentY: sy,
        additive,
        baseSelection,
      });
    }
  };

  useEffect(() => {
    if (!isPanningCanvas) return;
    const stopPan = () => setIsPanningCanvas(false);
    window.addEventListener('pointerup', stopPan);
    window.addEventListener('pointercancel', stopPan);
    window.addEventListener('blur', stopPan);
    return () => {
      window.removeEventListener('pointerup', stopPan);
      window.removeEventListener('pointercancel', stopPan);
      window.removeEventListener('blur', stopPan);
    };
  }, [isPanningCanvas]);

  // Node & Text Dragging Pointer Events (with Shift-Click & Multi-Select Group Drag)
  const handleNodeOrTextPointerDown = (
    id: string,
    type: 'node' | 'text',
    e: React.PointerEvent
  ) => {
    if (
      e.pointerType === 'touch' &&
      (activeTouchPointsRef.current.size >= 2 || pinchStateRef.current || suppressTouchUntilZeroRef.current)
    ) {
      return;
    }
    if (e.button === 1 || isSpacePressed || canvasToolMode === 'pan') return;
    if ((e.target as HTMLElement).closest('.port')) return;
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('input')) return;
    if ((e.target as HTMLElement).closest('textarea')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    let effectiveSelection: Record<string, 'node' | 'text'>;
    let pendingShiftDeselect: { id: string; type: 'node' | 'text' } | null = null;

    if (e.shiftKey) {
      if (selectedItems[id]) {
        effectiveSelection = selectedItems;
        pendingShiftDeselect = { id, type };
      } else {
        effectiveSelection = { ...selectedItems, [id]: type };
        setSelectedItems(effectiveSelection);
      }
    } else if (selectedItems[id]) {
      effectiveSelection = selectedItems;
    } else {
      effectiveSelection = { [id]: type };
      setSelectedItems(effectiveSelection);
    }

    if (isReadOnly) return;
    if (!canvasRef.current) return;
    dragPreActionSnapshotRef.current = captureCanvasSnapshot(appStateRef.current);
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const currentX =
      type === 'node'
        ? parseFloat(appState.nodes[id]?.x || '0')
        : parseFloat(appState.texts[id]?.x || '0');
    const currentY =
      type === 'node'
        ? parseFloat(appState.nodes[id]?.y || '0')
        : parseFloat(appState.texts[id]?.y || '0');

    const movingMap = new Map<
      string,
      { id: string; type: 'node' | 'text'; startX: number; startY: number }
    >();

    const addMovingItem = (itemId: string, itemType: 'node' | 'text') => {
      if (movingMap.has(itemId)) return;
      if (itemType === 'node') {
        const n = appState.nodes[itemId];
        if (!n) return;
        movingMap.set(itemId, {
          id: itemId,
          type: 'node',
          startX: parseFloat(n.x) || 0,
          startY: parseFloat(n.y) || 0,
        });
      } else {
        const t = appState.texts[itemId];
        if (!t) return;
        movingMap.set(itemId, {
          id: itemId,
          type: 'text',
          startX: parseFloat(t.x) || 0,
          startY: parseFloat(t.y) || 0,
        });
      }
    };

    const selectedKeys = Object.entries(effectiveSelection) as [string, 'node' | 'text'][];
    selectedKeys.forEach(([selId, selType]) => {
      addMovingItem(selId, selType);
      if (selType === 'text' && appState.texts[selId]?.mode === 'container') {
        Object.values(appState.nodes).forEach((n) => {
          if (n.containerId === selId) {
            addMovingItem(n.id, 'node');
          }
        });
        Object.values(appState.texts).forEach((t) => {
          if (t.containerId === selId && t.id !== selId) {
            addMovingItem(t.id, 'text');
          }
        });
      }
    });

    const isMultiDrag = selectedKeys.length > 1;
    const childrenOffsets: { id: string; type: 'node' | 'text'; startX: number; startY: number }[] = [];
    movingMap.forEach((entry, key) => {
      if (key !== id) {
        childrenOffsets.push(entry);
      }
    });

    const parentCid =
      type === 'node' ? appState.nodes[id]?.containerId : appState.texts[id]?.containerId;
    if (!isMultiDrag && parentCid && appState.texts[parentCid]) {
      const c = appState.texts[parentCid];
      const cx = parseFloat(c.x) || 0;
      const cy = parseFloat(c.y) || 0;
      dragStartContainerBoundsRef.current = {
        id: parentCid,
        left: cx,
        top: cy,
        right: cx + (c.width || 340),
        bottom: cy + (c.height || 240),
      };
    } else {
      dragStartContainerBoundsRef.current = null;
    }

    setActiveDragElement({
      id,
      type,
      startX: currentX,
      startY: currentY,
      initialMouseX: (e.clientX - canvasRect.left) / currentZoomRef.current,
      initialMouseY: (e.clientY - canvasRect.top) / currentZoomRef.current,
      isMultiDrag,
      pendingShiftDeselect,
      movingIds: Array.from(movingMap.keys()),
      childrenOffsets,
    });

    setActiveLinePopover(null);
  };

  // Global Pointer Move
  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (
      e.pointerType === 'touch' &&
      (pinchStateRef.current || activeTouchPointsRef.current.size >= 2 || suppressTouchUntilZeroRef.current)
    ) {
      return;
    }

    if (isPanningCanvas && viewportRef.current) {
      const x = e.pageX - viewportRef.current.offsetLeft;
      const y = e.pageY - viewportRef.current.offsetTop;
      const nextCamX = panStart.scrollLeft - (x - panStart.x) * 1.3;
      const nextCamY = panStart.scrollTop - (y - panStart.y) * 1.3;
      applyCameraTransform(currentZoomRef.current, nextCamX, nextCamY);
      return;
    }

    if (selectionBox && canvasRef.current) {
      const cRect = canvasRef.current.getBoundingClientRect();
      const liveZoom = currentZoomRef.current;
      const curX = (e.clientX - cRect.left) / liveZoom;
      const curY = (e.clientY - cRect.top) / liveZoom;

      const minX = Math.min(selectionBox.startX, curX);
      const maxX = Math.max(selectionBox.startX, curX);
      const minY = Math.min(selectionBox.startY, curY);
      const maxY = Math.max(selectionBox.startY, curY);

      setSelectionBox((prev) => (prev ? { ...prev, currentX: curX, currentY: curY } : null));

      if (maxX - minX > 3 || maxY - minY > 3) {
        const nextSelection: Record<string, 'node' | 'text'> = { ...selectionBox.baseSelection };

        Object.values(appState.nodes).forEach((n) => {
          if (hiddenNodeIds.has(n.id)) return;
          const nx = parseFloat(n.x) || 0;
          const ny = parseFloat(n.y) || 0;
          const nw = 220;
          const nh = 171;
          if (nx < maxX && nx + nw > minX && ny < maxY && ny + nh > minY) {
            nextSelection[n.id] = 'node';
          }
        });

        Object.values(appState.texts).forEach((t) => {
          if (hiddenTextIds.has(t.id)) return;
          const tx = parseFloat(t.x) || 0;
          const ty = parseFloat(t.y) || 0;

          if (t.mode === 'container') {
            const tw = t.width || 340;
            const th = t.height || 240;
            const enclosesContainer =
              minX <= tx + 16 && maxX >= tx + tw - 16 && minY <= ty + 16 && maxY >= ty + th - 16;
            const hitsTitleTag =
              minX < tx + Math.min(tw, 200) &&
              maxX > tx + 12 &&
              minY < ty + 12 &&
              maxY > ty - 28 &&
              !(minX > tx && maxX < tx + tw && minY > ty && maxY < ty + th);
            if (enclosesContainer || hitsTitleTag) {
              nextSelection[t.id] = 'text';
            }
          } else if (t.mode === 'annotation') {
            const tw = 220;
            const th = t.height || 120;
            if (tx < maxX && tx + tw > minX && ty < maxY && ty + th > minY) {
              nextSelection[t.id] = 'text';
            }
          } else {
            const estW = t.width || Math.max(100, (t.text?.length || 4) * ((t.size || 16) * 0.62));
            const estH = t.height || Math.max(32, (t.size || 16) * 1.6);
            if (tx < maxX && tx + estW > minX && ty < maxY && ty + estH > minY) {
              nextSelection[t.id] = 'text';
            }
          }
        });

        setSelectedItems(nextSelection);
      }
      return;
    }

    if (tempConnection && canvasRef.current) {
      const cRect = canvasRef.current.getBoundingClientRect();
      const liveZoom = currentZoomRef.current;
      const curX = (e.clientX - cRect.left) / liveZoom;
      const curY = (e.clientY - cRect.top) / liveZoom;

      const APPROACH_RADIUS = 110;
      const READY_RADIUS = e.pointerType === 'touch' ? 28 : 18;
      const PORTS: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];

      let bestTarget: {
        nodeId: string;
        port: 'top' | 'bottom' | 'left' | 'right';
        dist: number;
        snapX: number;
        snapY: number;
      } | null = null;

      for (const candidateNode of Object.values(appState.nodes)) {
        if (candidateNode.id === tempConnection.sourceId) continue;
        for (const candidatePort of PORTS) {
          const coords = getNodePortCoords(appState.nodes, candidateNode.id, candidatePort);
          if (!coords) continue;
          const dist = Math.hypot(curX - coords.x, curY - coords.y);
          if (dist <= APPROACH_RADIUS && (!bestTarget || dist < bestTarget.dist)) {
            bestTarget = {
              nodeId: candidateNode.id,
              port: candidatePort,
              dist,
              snapX: coords.x,
              snapY: coords.y,
            };
          }
        }
      }

      const hoverTarget = bestTarget
        ? {
            nodeId: bestTarget.nodeId,
            port: bestTarget.port,
            proximity:
              bestTarget.dist <= READY_RADIUS
                ? 1
                : Math.max(0, Math.min(1, (APPROACH_RADIUS - bestTarget.dist) / (APPROACH_RADIUS - READY_RADIUS))),
            isReady: bestTarget.dist <= READY_RADIUS,
            snapX: bestTarget.snapX,
            snapY: bestTarget.snapY,
          }
        : null;

      setTempConnection({
        ...tempConnection,
        currentX: curX,
        currentY: curY,
        hoverTarget,
      });
      return;
    }

    if (activeDragElement && canvasRef.current) {
      const cRect = canvasRef.current.getBoundingClientRect();
      const liveZoom = currentZoomRef.current;
      const mouseCanvasX = (e.clientX - cRect.left) / liveZoom;
      const mouseCanvasY = (e.clientY - cRect.top) / liveZoom;

      const deltaX = mouseCanvasX - activeDragElement.initialMouseX;
      const deltaY = mouseCanvasY - activeDragElement.initialMouseY;

      let finalX = activeDragElement.startX + deltaX;
      let finalY = activeDragElement.startY + deltaY;
      let appliedDeltaX = deltaX;
      let appliedDeltaY = deltaY;

      let nextState: AppState = {
        ...appState,
        nodes: { ...appState.nodes },
        texts: { ...appState.texts },
      };
      let nextHoveredContainer: string | null = null;
      let shouldExtendContainer = false;

      if (activeDragElement.type === 'node') {
        const node = nextState.nodes[activeDragElement.id];
        if (node) {
          const elW = 220;
          const elH = 171;

          if (!e.altKey) {
            const snapResult = computeNodeSnap(
              finalX,
              finalY,
              node.id,
              node.containerId,
              nextState.nodes,
              nextState.texts,
              undefined,
              activeDragElement.isMultiDrag ? new Set(activeDragElement.movingIds) : undefined
            );
            finalX = snapResult.x;
            finalY = snapResult.y;
            appliedDeltaX = finalX - activeDragElement.startX;
            appliedDeltaY = finalY - activeDragElement.startY;
            setSnapGuides(snapResult.guides);
          } else if (snapGuides.length > 0) {
            setSnapGuides([]);
          }

          if (!activeDragElement.isMultiDrag) {
            if (node.containerId) {
              // Node stays attached to its container and extends container bounds dynamically as dragged
              shouldExtendContainer = true;
            } else {
              nextHoveredContainer = findOverlappingContainer(
                finalX,
                finalY,
                elW,
                elH,
                nextState.texts,
                node.id,
                pendingExitContainerRef.current[node.id]
              );
            }
          }

          nextState.nodes[activeDragElement.id] = {
            ...node,
            x: `${finalX}px`,
            y: `${finalY}px`,
          };
        }
      } else {
        if (snapGuides.length > 0) {
          setSnapGuides([]);
        }
        const textEl = nextState.texts[activeDragElement.id];
        if (textEl) {
          const isContainerSelf = textEl.mode === 'container';
          const elW = textEl.width || 220;
          const elH = textEl.height || 100;

          if (!activeDragElement.isMultiDrag) {
            if (!isContainerSelf && textEl.containerId) {
              shouldExtendContainer = true;
            } else if (!isContainerSelf) {
              nextHoveredContainer = findOverlappingContainer(
                finalX,
                finalY,
                elW,
                elH,
                nextState.texts,
                textEl.id,
                pendingExitContainerRef.current[textEl.id]
              );
            }
          }

          nextState.texts[activeDragElement.id] = {
            ...textEl,
            x: `${finalX}px`,
            y: `${finalY}px`,
          };
        }
      }

      if (hoveredDropContainerId !== nextHoveredContainer) {
        setHoveredDropContainerId(nextHoveredContainer);
      }

      const movingIdSet = new Set(activeDragElement.movingIds);
      if (activeDragElement.childrenOffsets.length > 0) {
        activeDragElement.childrenOffsets.forEach((child) => {
          const childX = `${child.startX + appliedDeltaX}px`;
          const childY = `${child.startY + appliedDeltaY}px`;
          if (child.type === 'node' && nextState.nodes[child.id]) {
            const updatedN = { ...nextState.nodes[child.id], x: childX, y: childY };
            nextState.nodes[child.id] = updatedN;
            if (updatedN.containerId && !movingIdSet.has(updatedN.containerId)) {
              shouldExtendContainer = true;
            }
          } else if (child.type === 'text' && nextState.texts[child.id]) {
            const updatedT = { ...nextState.texts[child.id], x: childX, y: childY };
            nextState.texts[child.id] = updatedT;
            if (updatedT.containerId && !movingIdSet.has(updatedT.containerId)) {
              shouldExtendContainer = true;
            }
          }
        });
      }

      if (activeDragElement.isMultiDrag) {
        const primaryContainerId =
          activeDragElement.type === 'node'
            ? nextState.nodes[activeDragElement.id]?.containerId
            : nextState.texts[activeDragElement.id]?.containerId;
        if (primaryContainerId && !movingIdSet.has(primaryContainerId)) {
          shouldExtendContainer = true;
        }
      }

      if (shouldExtendContainer) {
        nextState = updateContainerBounds(nextState, {
          syncToFirestore: false,
          extendOnly: true,
        });
      }

      setAppState(nextState);
    }
  };

  // Global Pointer Up & Firestore Sync
  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    if (
      e.pointerType === 'touch' &&
      (pinchStateRef.current || suppressTouchUntilZeroRef.current)
    ) {
      return;
    }

    if (isPanningCanvas) {
      setIsPanningCanvas(false);
    }

    if (selectionBox) {
      setSelectionBox(null);
    }

    if (tempConnection && activeProjectId) {
      const pointedEl =
        typeof document !== 'undefined'
          ? (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)
          : (e.target as HTMLElement | null);
      const rawTargetEl = pointedEl || (e.target as HTMLElement | null);
      const targetPortEl = (rawTargetEl?.closest('.port') || rawTargetEl?.closest('[data-port]')) as HTMLElement | null;
      const domNodeId = targetPortEl?.getAttribute('data-node') || null;
      const domPort = (targetPortEl?.getAttribute('data-port') as 'top' | 'bottom' | 'left' | 'right' | null) || null;

      const targetNodeId =
        domNodeId && domNodeId !== tempConnection.sourceId
          ? domNodeId
          : tempConnection.hoverTarget?.isReady
          ? tempConnection.hoverTarget.nodeId
          : null;
      const targetPort =
        domNodeId && domNodeId !== tempConnection.sourceId && domPort
          ? domPort
          : tempConnection.hoverTarget?.isReady
          ? tempConnection.hoverTarget.port
          : null;

      if (targetNodeId && targetPort && targetNodeId !== tempConnection.sourceId) {
        pushUndoSnapshot();
        const newConn: Connection = {
          id: `conn-${Date.now()}`,
          projectId: activeProjectId,
          source: tempConnection.sourceId,
          sourcePort: tempConnection.sourcePort,
          target: targetNodeId,
          targetPort: targetPort,
          type: 'angle',
          style: 'solid',
          color: '#0052cc',
          label: '',
          arrows: 'end',
        };

        setAppState((prev) => {
          const next = {
            ...prev,
            connections: [...prev.connections, newConn],
          };
          appStateRef.current = next;
          return next;
        });
        saveConnectionToFirestore(activeProjectId, newConn);
      }
      setTempConnection(null);
    }

    if (activeDragElement && activeProjectId) {
      const el = activeDragElement;
      const currentPrimaryX =
        el.type === 'node'
          ? parseFloat(appState.nodes[el.id]?.x || '0')
          : parseFloat(appState.texts[el.id]?.x || '0');
      const currentPrimaryY =
        el.type === 'node'
          ? parseFloat(appState.nodes[el.id]?.y || '0')
          : parseFloat(appState.texts[el.id]?.y || '0');
      const movedDist = Math.hypot(currentPrimaryX - el.startX, currentPrimaryY - el.startY);

      if (el.pendingShiftDeselect && movedDist < 2) {
        const deselectId = el.pendingShiftDeselect.id;
        setSelectedItems((prev) => {
          const copy = { ...prev };
          delete copy[deselectId];
          return copy;
        });
        dragPreActionSnapshotRef.current = null;
        dragStartContainerBoundsRef.current = null;
        setHoveredDropContainerId(null);
        setActiveDragElement(null);
        setSnapGuides([]);
        return;
      }

      if (el.isMultiDrag) {
        if (movedDist >= 0.5) {
          if (dragPreActionSnapshotRef.current) {
            pushUndoSnapshot(dragPreActionSnapshotRef.current);
          }
          const boundedState = updateContainerBounds(appState, {
            syncToFirestore: false,
            extendOnly: true,
          });
          appStateRef.current = boundedState;
          setAppState(boundedState);

          const nodesToSave: WorkflowNode[] = [];
          const textsToSave: TextElement[] = [];
          const savedTextIds = new Set<string>();

          if (el.type === 'node' && boundedState.nodes[el.id]) {
            nodesToSave.push(boundedState.nodes[el.id]);
          } else if (el.type === 'text' && boundedState.texts[el.id]) {
            textsToSave.push(boundedState.texts[el.id]);
            savedTextIds.add(el.id);
          }

          el.childrenOffsets.forEach((child) => {
            if (child.type === 'node' && boundedState.nodes[child.id]) {
              nodesToSave.push(boundedState.nodes[child.id]);
            } else if (child.type === 'text' && boundedState.texts[child.id]) {
              textsToSave.push(boundedState.texts[child.id]);
              savedTextIds.add(child.id);
            }
          });

          Object.values(boundedState.texts).forEach((t) => {
            if (
              t.mode === 'container' &&
              !savedTextIds.has(t.id) &&
              appState.texts[t.id] &&
              (t.x !== appState.texts[t.id].x ||
                t.y !== appState.texts[t.id].y ||
                t.width !== appState.texts[t.id].width ||
                t.height !== appState.texts[t.id].height)
            ) {
              textsToSave.push(t);
            }
          });

          saveCanvasPositionsBatch(activeProjectId, nodesToSave, textsToSave);
        } else if (!e.shiftKey) {
          setSelectedItems({ [el.id]: el.type });
        }

        dragPreActionSnapshotRef.current = null;
        dragStartContainerBoundsRef.current = null;
        setHoveredDropContainerId(null);
        setActiveDragElement(null);
        setSnapGuides([]);
        return;
      }

      const nextState: AppState = {
        ...appState,
        nodes: { ...appState.nodes },
        texts: { ...appState.texts },
      };
      const forceSyncIds: string[] = [];

      if (el.type === 'node' && nextState.nodes[el.id]) {
        const currNode = nextState.nodes[el.id];
        const elX = parseFloat(currNode.x) || 0;
        const elY = parseFloat(currNode.y) || 0;
        const ignoredId = pendingExitContainerRef.current[el.id];

        let nextContainerId = currNode.containerId;
        if (!currNode.containerId) {
          nextContainerId = findOverlappingContainer(
            elX,
            elY,
            220,
            171,
            nextState.texts,
            el.id,
            ignoredId
          );

          // If node was unlinked and now dropped outside its old container (or into a new one), it's ready for future groupings
          if (ignoredId) {
            const oldContainer = nextState.texts[ignoredId];
            const stillInOld = oldContainer
              ? Boolean(
                  findOverlappingContainer(
                    elX,
                    elY,
                    220,
                    171,
                    { [ignoredId]: oldContainer },
                    el.id
                  )
                )
              : false;
            if (!stillInOld || nextContainerId !== null) {
              delete pendingExitContainerRef.current[el.id];
            }
          }
        }

        if (nextContainerId) {
          forceSyncIds.push(nextContainerId);
        }

        const updatedNode = { ...currNode, containerId: nextContainerId };
        nextState.nodes[el.id] = updatedNode;
        saveNodeToFirestore(activeProjectId, updatedNode);
      } else if (el.type === 'text' && nextState.texts[el.id]) {
        const currText = nextState.texts[el.id];
        const isContainerSelf = currText.mode === 'container';
        const elX = parseFloat(currText.x) || 0;
        const elY = parseFloat(currText.y) || 0;
        const elW = currText.width || 220;
        const elH = currText.height || 100;
        const ignoredId = pendingExitContainerRef.current[el.id];

        let nextContainerId = currText.containerId;
        if (!isContainerSelf && !currText.containerId) {
          nextContainerId = findOverlappingContainer(
            elX,
            elY,
            elW,
            elH,
            nextState.texts,
            el.id,
            ignoredId
          );

          if (ignoredId) {
            const oldContainer = nextState.texts[ignoredId];
            const stillInOld = oldContainer
              ? Boolean(
                  findOverlappingContainer(
                    elX,
                    elY,
                    elW,
                    elH,
                    { [ignoredId]: oldContainer },
                    el.id
                  )
                )
              : false;
            if (!stillInOld || nextContainerId !== null) {
              delete pendingExitContainerRef.current[el.id];
            }
          }
        }

        if (!isContainerSelf && nextContainerId) {
          forceSyncIds.push(nextContainerId);
        }

        const updatedText = { ...currText, containerId: isContainerSelf ? null : (nextContainerId ?? null) };
        nextState.texts[el.id] = updatedText;
        saveTextToFirestore(activeProjectId, updatedText);
      }

      if (el.childrenOffsets.length > 0) {
        el.childrenOffsets.forEach((child) => {
          if (child.type === 'node' && nextState.nodes[child.id]) {
            saveNodeToFirestore(activeProjectId, nextState.nodes[child.id]);
          } else if (child.type === 'text' && nextState.texts[child.id]) {
            saveTextToFirestore(activeProjectId, nextState.texts[child.id]);
          }
        });
      }

      const boundedState = updateContainerBounds(nextState, {
        syncToFirestore: true,
        extendOnly: true,
        forceSyncIds,
      });
      if (dragPreActionSnapshotRef.current) {
        const postSnap = captureCanvasSnapshot(boundedState);
        if (!areCanvasSnapshotsEqual(dragPreActionSnapshotRef.current, postSnap)) {
          pushUndoSnapshot(dragPreActionSnapshotRef.current);
        }
        dragPreActionSnapshotRef.current = null;
      }
      dragStartContainerBoundsRef.current = null;
      appStateRef.current = boundedState;
      setAppState(boundedState);
      setHoveredDropContainerId(null);
      setActiveDragElement(null);
      setSnapGuides([]);
    }
  };

  // Node CRUD in Firestore
  const handleAddNode = () => {
    if (!activeProjectId || isReadOnly) return;
    pushUndoSnapshot();
    const nextNum = Object.keys(appState.nodes).length + 1;
    const nodeId = `node-${Date.now()}`;

    const centerX = viewportRef.current
      ? (cameraPosRef.current.x + viewportRef.current.clientWidth / 2) / currentZoomRef.current - 110
      : 2400;
    const centerY = viewportRef.current
      ? (cameraPosRef.current.y + viewportRef.current.clientHeight / 2) / currentZoomRef.current - 80
      : 2400;

    const newNode: WorkflowNode = {
      id: nodeId,
      projectId: activeProjectId,
      x: `${centerX}px`,
      y: `${centerY}px`,
      title: t('app.defaultNodeTitle', { num: nextNum }),
      image: null,
      mapImage: null,
      mapName: '',
      enfoque: '',
      accion: '',
      descripcion: '',
      pins: [],
      mapPins: [],
      drawings: [],
      mapDrawings: [],
      videos: { enfoque: null, accion: null, descripcion: null },
      pinCounter: 0,
      mapPinCounter: 0,
      containerId: null,
    };

    setAppState((prev) => {
      const next = {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: newNode,
        },
      };
      appStateRef.current = next;
      return next;
    });
    saveNodeToFirestore(activeProjectId, newNode);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    if (!activeProjectId) return;
    const curr = appStateRef.current.nodes[nodeId];
    if (!curr) return;

    pushUndoSnapshot();

    const normalizedUpdates: Partial<WorkflowNode> = { ...updates };
    if ('image' in updates && updates.image) {
      normalizedUpdates.imageDeletedFromAdmin = false;
    }
    if ('mapImage' in updates && updates.mapImage) {
      normalizedUpdates.mapImageDeletedFromAdmin = false;
    }

    const updatedNode = { ...curr, ...normalizedUpdates };
    setAppState((prev) => {
      const next = {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: updatedNode,
        },
      };
      appStateRef.current = next;
      return next;
    });
    saveNodeToFirestore(activeProjectId, updatedNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeProjectId) return;
    pushUndoSnapshot();
    const removedConnIds = appStateRef.current.connections
      .filter((c) => c.source === nodeId || c.target === nodeId)
      .map((c) => c.id);
    setAppState((prev) => {
      const nextNodes = { ...prev.nodes };
      delete nextNodes[nodeId];
      const next = {
        ...prev,
        nodes: nextNodes,
        connections: prev.connections.filter((c) => c.source !== nodeId && c.target !== nodeId),
      };
      appStateRef.current = next;
      return next;
    });
    deleteNodeFromFirestore(activeProjectId, nodeId);
    removedConnIds.forEach((cid) => deleteConnectionFromFirestore(activeProjectId, cid));
    setDeleteWarningNodeId(null);
    setSelectedItems((prev) => {
      if (!prev[nodeId]) return prev;
      const copy = { ...prev };
      delete copy[nodeId];
      return copy;
    });
    if (activeEditNodeId === nodeId) {
      setActiveEditNodeId(null);
    }
  };

  const handleArchiveNode = (nodeId: string) => {
    if (!activeProjectId) return;
    const node = appStateRef.current.nodes[nodeId];
    if (!node) return;

    pushUndoSnapshot();

    const archivedNode: WorkflowNode = {
      ...node,
      storedAt: new Date().toLocaleString(locale),
      storedBy: currentUser.name,
      storeNote: '',
    };

    setAppState((prev) => {
      const nextNodes = { ...prev.nodes };
      delete nextNodes[nodeId];
      const next = {
        ...prev,
        nodes: nextNodes,
        storedNodes: {
          ...prev.storedNodes,
          [nodeId]: archivedNode,
        },
      };
      appStateRef.current = next;
      return next;
    });

    archiveNodeInFirestore(activeProjectId, archivedNode);
    setDeleteWarningNodeId(null);
    setSelectedItems((prev) => {
      if (!prev[nodeId]) return prev;
      const copy = { ...prev };
      delete copy[nodeId];
      return copy;
    });
    if (activeEditNodeId === nodeId) {
      setActiveEditNodeId(null);
    }
  };

  const handleBatchDeleteSelected = () => {
    if (!activeProjectId || isReadOnly) return;
    const nodeIdSet = new Set(
      Object.entries(selectedItems)
        .filter(([id, t]) => t === 'node' && Boolean(appState.nodes[id]))
        .map(([id]) => id)
    );
    const textIdSet = new Set(
      Object.entries(selectedItems)
        .filter(([id, t]) => t === 'text' && Boolean(appState.texts[id]))
        .map(([id]) => id)
    );
    if (nodeIdSet.size === 0 && textIdSet.size === 0) {
      setBatchDeleteOpen(false);
      return;
    }

    const connIdsToDelete = appState.connections
      .filter((c) => nodeIdSet.has(c.source) || nodeIdSet.has(c.target))
      .map((c) => c.id);

    const unlinkedNodes: WorkflowNode[] = [];
    const unlinkedTexts: TextElement[] = [];

    Object.values(appState.nodes).forEach((n) => {
      if (!nodeIdSet.has(n.id) && n.containerId && textIdSet.has(n.containerId)) {
        unlinkedNodes.push({ ...n, containerId: null });
      }
    });
    Object.values(appState.texts).forEach((t) => {
      if (!textIdSet.has(t.id) && t.containerId && textIdSet.has(t.containerId)) {
        unlinkedTexts.push({ ...t, containerId: null });
      }
    });

    pushUndoSnapshot();

    setAppState((prev) => {
      const nextNodes = { ...prev.nodes };
      const nextTexts = { ...prev.texts };
      nodeIdSet.forEach((id) => delete nextNodes[id]);
      textIdSet.forEach((id) => delete nextTexts[id]);
      unlinkedNodes.forEach((n) => {
        nextNodes[n.id] = n;
      });
      unlinkedTexts.forEach((t) => {
        nextTexts[t.id] = t;
      });
      const next = {
        ...prev,
        nodes: nextNodes,
        texts: nextTexts,
        connections: prev.connections.filter((c) => !nodeIdSet.has(c.source) && !nodeIdSet.has(c.target)),
      };
      appStateRef.current = next;
      return next;
    });

    deleteCanvasItemsBatch(
      activeProjectId,
      Array.from(nodeIdSet),
      Array.from(textIdSet),
      connIdsToDelete,
      { nodes: unlinkedNodes, texts: unlinkedTexts }
    );

    if (activeEditNodeId && nodeIdSet.has(activeEditNodeId)) setActiveEditNodeId(null);
    if (activeTextPopover && textIdSet.has(activeTextPopover.elementId)) setActiveTextPopover(null);
    if (activeLinePopover && connIdsToDelete.includes(activeLinePopover.connectionId)) setActiveLinePopover(null);

    setSelectedItems({});
    setBatchDeleteOpen(false);
  };

  const handleBatchArchiveSelectedNodes = () => {
    if (!activeProjectId || isReadOnly) return;
    const nowStr = new Date().toLocaleString(locale);
    const nodesToArchive = Object.entries(selectedItems)
      .filter(([id, t]) => t === 'node' && Boolean(appState.nodes[id]))
      .map(([id]) => ({
        ...appState.nodes[id],
        storedAt: nowStr,
        storedBy: currentUser.name,
        storeNote: '',
      }));

    if (nodesToArchive.length === 0) {
      setBatchDeleteOpen(false);
      return;
    }

    pushUndoSnapshot();

    const archivedIdSet = new Set(nodesToArchive.map((n) => n.id));
    setAppState((prev) => {
      const nextNodes = { ...prev.nodes };
      const nextStored = { ...prev.storedNodes };
      nodesToArchive.forEach((n) => {
        delete nextNodes[n.id];
        nextStored[n.id] = n;
      });
      const next = {
        ...prev,
        nodes: nextNodes,
        storedNodes: nextStored,
      };
      appStateRef.current = next;
      return next;
    });

    archiveNodesBatch(activeProjectId, nodesToArchive);

    if (activeEditNodeId && archivedIdSet.has(activeEditNodeId)) {
      setActiveEditNodeId(null);
    }
    setSelectedItems((prev) => {
      const remaining: Record<string, 'node' | 'text'> = {};
      Object.entries(prev).forEach(([id, t]) => {
        if (!(t === 'node' && archivedIdSet.has(id))) {
          remaining[id] = t;
        }
      });
      return remaining;
    });
    setBatchDeleteOpen(false);
  };

  const handleDistributeNodes = (axis: 'horizontal' | 'vertical') => {
    if (!activeProjectId || isReadOnly) return;
    const currentSnapshot = captureCanvasSnapshot(appStateRef.current);
    const nodesToDistribute = Object.entries(selectedItems)
      .filter(([id, t]) => t === 'node' && Boolean(appStateRef.current.nodes[id]))
      .map(([id]) => appStateRef.current.nodes[id]);

    if (nodesToDistribute.length < 3) return;

    const NODE_W = 220;
    const NODE_H = 171;
    const MIN_GAP_X = 60;
    const MIN_GAP_Y = 50;

    const sorted = [...nodesToDistribute].sort((a, b) => {
      const ax = parseFloat(a.x) || 0;
      const bx = parseFloat(b.x) || 0;
      const ay = parseFloat(a.y) || 0;
      const by = parseFloat(b.y) || 0;
      if (axis === 'horizontal') {
        if (Math.abs(ax - bx) > 0.5) return ax - bx;
        if (Math.abs(ay - by) > 0.5) return ay - by;
      } else {
        if (Math.abs(ay - by) > 0.5) return ay - by;
        if (Math.abs(ax - bx) > 0.5) return ax - bx;
      }
      return a.id.localeCompare(b.id);
    });

    const count = sorted.length;
    const nextPositions = new Map<string, { x: string; y: string }>();

    if (axis === 'horizontal') {
      const minX = parseFloat(sorted[0].x) || 0;
      const maxX = parseFloat(sorted[count - 1].x) || 0;
      const avgY = Math.round(
        sorted.reduce((sum, n) => sum + (parseFloat(n.y) || 0), 0) / count
      );
      const minSpan = (count - 1) * (NODE_W + MIN_GAP_X);
      const effectiveSpan = Math.max(maxX - minX, minSpan);
      const step = effectiveSpan / (count - 1);
      const alignedY = `${Math.max(0, avgY)}px`;

      sorted.forEach((n, index) => {
        const nextX = Math.max(0, Math.round(minX + index * step));
        nextPositions.set(n.id, { x: `${nextX}px`, y: alignedY });
      });
    } else {
      const minY = parseFloat(sorted[0].y) || 0;
      const maxY = parseFloat(sorted[count - 1].y) || 0;
      const avgX = Math.round(
        sorted.reduce((sum, n) => sum + (parseFloat(n.x) || 0), 0) / count
      );
      const minSpan = (count - 1) * (NODE_H + MIN_GAP_Y);
      const effectiveSpan = Math.max(maxY - minY, minSpan);
      const step = effectiveSpan / (count - 1);
      const alignedX = `${Math.max(0, avgX)}px`;

      sorted.forEach((n, index) => {
        const nextY = Math.max(0, Math.round(minY + index * step));
        nextPositions.set(n.id, { x: alignedX, y: `${nextY}px` });
      });
    }

    const movedNodes: WorkflowNode[] = [];
    const nextNodes = { ...appStateRef.current.nodes };
    const forceSyncSet = new Set<string>();

    sorted.forEach((n) => {
      const coords = nextPositions.get(n.id);
      if (!coords) return;
      if (n.x !== coords.x || n.y !== coords.y) {
        const updatedNode: WorkflowNode = { ...n, x: coords.x, y: coords.y };
        nextNodes[n.id] = updatedNode;
        movedNodes.push(updatedNode);
        if (updatedNode.containerId) {
          forceSyncSet.add(updatedNode.containerId);
        }
      }
    });

    if (movedNodes.length === 0) return;

    pushUndoSnapshot(currentSnapshot);

    const nextState: AppState = {
      ...appStateRef.current,
      nodes: nextNodes,
    };

    const boundedState = updateContainerBounds(nextState, {
      syncToFirestore: true,
      extendOnly: true,
      forceSyncIds: Array.from(forceSyncSet),
    });

    appStateRef.current = boundedState;
    setAppState(boundedState);
    saveCanvasPositionsBatch(activeProjectId, movedNodes, []);
  };

  const handleDeleteImageRecords = async (imgIds: string[]) => {
    if (imgIds.length === 0) return;
    const normalizeUrl = (u?: string | null) => (u ? u.split('?')[0].trim() : '');
    const targets = imagesDbList.filter((img) => imgIds.includes(img.id));
    const deletedUrls = targets.map((img) => img.url).filter(Boolean);

    const allProjectIds = Array.from(
      new Set([
        ...projects.map((p) => p.id),
        ...targets.map((img) => img.projectId).filter((pid): pid is string => Boolean(pid)),
        ...(activeProjectId ? [activeProjectId] : []),
      ])
    );

    if (deletedUrls.length > 0) {
      const urlSet = new Set(deletedUrls.map(normalizeUrl).filter(Boolean));
      setAppState((prev) => {
        let changed = false;
        const nextNodes = { ...prev.nodes };
        Object.entries(nextNodes).forEach(([id, n]) => {
          const hitMain = Boolean(n.image && urlSet.has(normalizeUrl(n.image)));
          const hitMap = Boolean(n.mapImage && urlSet.has(normalizeUrl(n.mapImage)));
          if (hitMain || hitMap) {
            changed = true;
            nextNodes[id] = {
              ...n,
              ...(hitMain ? { image: null, imageDeletedFromAdmin: true } : {}),
              ...(hitMap ? { mapImage: null, mapName: '', mapImageDeletedFromAdmin: true } : {}),
            };
          }
        });
        return changed ? { ...prev, nodes: nextNodes } : prev;
      });

      if (allProjectIds.length > 0) {
        await clearDeletedImagesFromProjectNodes(deletedUrls, allProjectIds);
      }
    }

    for (const id of imgIds) {
      const target = targets.find((img) => img.id === id);
      await deleteImageFromDb(id, target?.url || target?.storagePath);
    }
  };

  // Text Elements CRUD in Firestore
  const handleAddText = (type: 'floating' | 'container' | 'annotation', text?: string) => {
    if (!activeProjectId || isReadOnly) return;
    pushUndoSnapshot();
    const textId = `text-${Date.now()}`;
    const centerX = viewportRef.current
      ? (cameraPosRef.current.x + viewportRef.current.clientWidth / 2) / currentZoomRef.current -
        (type === 'container' ? 200 : 100)
      : 2400;
    const centerY = viewportRef.current
      ? (cameraPosRef.current.y + viewportRef.current.clientHeight / 2) / currentZoomRef.current -
        (type === 'container' ? 130 : 50)
      : 2400;

    const defaultText =
      text?.trim() ||
      (type === 'container'
        ? t('app.defaultContainerText')
        : type === 'annotation'
        ? t('app.defaultAnnotationText')
        : t('app.defaultFloatingText'));

    const newElement: TextElement = {
      id: textId,
      projectId: activeProjectId,
      x: `${centerX}px`,
      y: `${centerY}px`,
      text: defaultText,
      mode: type,
      color: type === 'floating' ? '#e2e8f0' : type === 'annotation' ? '' : '#0052cc',
      size: type === 'floating' ? 24 : type === 'annotation' ? 12 : 14,
      bold: type === 'container',
      italic: false,
      labelId: '',
      ...(type === 'container' ? { width: 400, height: 260 } : {}),
    };

    setAppState((prev) => {
      const next = {
        ...prev,
        texts: {
          ...prev.texts,
          [textId]: newElement,
        },
      };
      appStateRef.current = next;
      return next;
    });
    saveTextToFirestore(activeProjectId, newElement);
  };

  const handleUpdateText = (textId: string, updates: Partial<TextElement>) => {
    if (!activeProjectId) return;
    const curr = appStateRef.current.texts[textId];
    if (!curr) return;

    const safeUpdates: Partial<TextElement> = { ...updates };
    delete safeUpdates.mode;
    if (Object.keys(safeUpdates).length === 0) return;

    const isContinuousStyleEdit =
      Object.keys(safeUpdates).length === 1 && ('size' in safeUpdates || 'color' in safeUpdates);
    pushUndoSnapshot(
      undefined,
      isContinuousStyleEdit ? `text:${textId}:${'size' in safeUpdates ? 'size' : 'color'}` : undefined
    );

    const updatedText: TextElement = {
      ...curr,
      ...safeUpdates,
      mode: curr.mode,
    };

    let nextState: AppState = {
      ...appStateRef.current,
      nodes: { ...appStateRef.current.nodes },
      texts: {
        ...appStateRef.current.texts,
        [textId]: updatedText,
      },
    };

    const changedNodes: WorkflowNode[] = [];
    const changedTextsMap = new Map<string, TextElement>();

    const isContainerBoundsChange =
      updatedText.mode === 'container' &&
      ('x' in safeUpdates ||
        'y' in safeUpdates ||
        'width' in safeUpdates ||
        'height' in safeUpdates);

    if (isContainerBoundsChange) {
      const cLeft = parseFloat(updatedText.x) || 0;
      const cTop = parseFloat(updatedText.y) || 0;
      const cRight = cLeft + (updatedText.width || 340);
      const cBottom = cTop + (updatedText.height || 240);

      const evaluateContainment = (elX: number, elY: number, elW: number, elH: number) => {
        const elRight = elX + elW;
        const elBottom = elY + elH;
        const centerX = elX + elW / 2;
        const centerY = elY + elH / 2;
        const centerInside =
          centerX >= cLeft && centerX <= cRight && centerY >= cTop && centerY <= cBottom;
        const overlapW = Math.max(0, Math.min(elRight, cRight) - Math.max(elX, cLeft));
        const overlapH = Math.max(0, Math.min(elBottom, cBottom) - Math.max(elY, cTop));
        const overlapArea = overlapW * overlapH;
        const itemArea = Math.max(1, elW * elH);
        return {
          shouldCapture: centerInside || overlapArea >= itemArea * 0.4,
          isCompletelyOutside: overlapArea === 0 && !centerInside,
        };
      };

      Object.values(nextState.nodes).forEach((node) => {
        const nx = parseFloat(node.x) || 0;
        const ny = parseFloat(node.y) || 0;
        const { shouldCapture, isCompletelyOutside } = evaluateContainment(nx, ny, 220, 171);
        if (!node.containerId && shouldCapture) {
          const capturedNode: WorkflowNode = { ...node, containerId: textId };
          nextState.nodes[node.id] = capturedNode;
          changedNodes.push(capturedNode);
          delete pendingExitContainerRef.current[node.id];
        } else if (node.containerId === textId && isCompletelyOutside) {
          const releasedNode: WorkflowNode = { ...node, containerId: null };
          nextState.nodes[node.id] = releasedNode;
          changedNodes.push(releasedNode);
        }
      });

      Object.values(nextState.texts).forEach((t) => {
        if (t.id === textId || t.mode === 'container') return;
        const tx = parseFloat(t.x) || 0;
        const ty = parseFloat(t.y) || 0;
        const domEl = typeof document !== 'undefined' ? document.getElementById(t.id) : null;
        const tw =
          t.width ||
          (domEl && domEl.offsetWidth > 0 ? domEl.offsetWidth : undefined) ||
          (t.mode === 'annotation'
            ? 220
            : Math.max(80, (t.text?.length || 4) * ((t.size || 20) * 0.62) + 16));
        const th =
          t.height ||
          (domEl && domEl.offsetHeight > 0 ? domEl.offsetHeight : undefined) ||
          (t.mode === 'annotation'
            ? 100
            : Math.max(32, (t.size || 20) * 1.4 + 12));

        const { shouldCapture, isCompletelyOutside } = evaluateContainment(tx, ty, tw, th);
        if (!t.containerId && shouldCapture) {
          const capturedText: TextElement = { ...t, containerId: textId };
          nextState.texts[t.id] = capturedText;
          changedTextsMap.set(t.id, capturedText);
          delete pendingExitContainerRef.current[t.id];
        } else if (t.containerId === textId && isCompletelyOutside) {
          const releasedText: TextElement = { ...t, containerId: null };
          nextState.texts[t.id] = releasedText;
          changedTextsMap.set(t.id, releasedText);
        }
      });
    } else if (
      updatedText.mode !== 'container' &&
      updatedText.containerId &&
      ('x' in updates || 'y' in updates || 'width' in updates || 'height' in updates || 'size' in updates)
    ) {
      const prevTexts = nextState.texts;
      const boundedState = updateContainerBounds(nextState, {
        syncToFirestore: false,
        extendOnly: true,
      });
      if (boundedState !== nextState) {
        Object.values(boundedState.texts).forEach((bt) => {
          if (bt.id !== textId && bt !== prevTexts[bt.id]) {
            changedTextsMap.set(bt.id, bt);
          }
        });
        nextState = boundedState;
      }
    }

    appStateRef.current = nextState;
    setAppState(nextState);

    if (changedNodes.length > 0 || changedTextsMap.size > 0) {
      saveCanvasPositionsBatch(activeProjectId, changedNodes, [
        updatedText,
        ...Array.from(changedTextsMap.values()),
      ]);
    } else {
      saveTextToFirestore(activeProjectId, updatedText);
    }
  };

  const handleFitContainerToNodes = useCallback(
    (containerId: string) => {
      if (!activeProjectId || isReadOnly) return;
      const container = appState.texts[containerId];
      if (!container || container.mode !== 'container') return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let hasChildren = false;

      Object.values(appState.nodes).forEach((n) => {
        if (n.containerId === containerId) {
          hasChildren = true;
          const nx = parseFloat(n.x) || 0;
          const ny = parseFloat(n.y) || 0;
          if (nx < minX) minX = nx;
          if (ny < minY) minY = ny;
          if (nx + 220 > maxX) maxX = nx + 220;
          if (ny + 171 > maxY) maxY = ny + 171;
        }
      });

      Object.values(appState.texts).forEach((childText) => {
        if (childText.containerId === containerId && childText.id !== containerId) {
          hasChildren = true;
          const cx = parseFloat(childText.x) || 0;
          const cy = parseFloat(childText.y) || 0;
          const cw = childText.width || 220;
          const ch = childText.height || 100;
          if (cx < minX) minX = cx;
          if (cy < minY) minY = cy;
          if (cx + cw > maxX) maxX = cx + cw;
          if (cy + ch > maxY) maxY = cy + ch;
        }
      });

      if (!hasChildren || minX === Infinity) return;

      const targetLeft = minX - 35;
      const targetTop = minY - 50;
      const targetWidth = maxX - minX + 70;
      const targetHeight = maxY - minY + 85;

      if (
        container.x === `${targetLeft}px` &&
        container.y === `${targetTop}px` &&
        container.width === targetWidth &&
        container.height === targetHeight
      ) {
        return;
      }

      pushUndoSnapshot();

      const updatedContainer: TextElement = {
        ...container,
        x: `${targetLeft}px`,
        y: `${targetTop}px`,
        width: targetWidth,
        height: targetHeight,
      };

      setAppState((prev) => {
        const next = {
          ...prev,
          texts: {
            ...prev.texts,
            [containerId]: updatedContainer,
          },
        };
        appStateRef.current = next;
        return next;
      });
      saveTextToFirestore(activeProjectId, updatedContainer);
    },
    [activeProjectId, isReadOnly, appState.nodes, appState.texts, pushUndoSnapshot]
  );

  const handleUnlinkNode = (nodeId: string) => {
    if (!activeProjectId) return;
    const curr = appStateRef.current.nodes[nodeId];
    if (!curr) return;

    pushUndoSnapshot();

    if (curr.containerId) {
      pendingExitContainerRef.current[nodeId] = curr.containerId;
    }

    const updatedNode = { ...curr, containerId: null };
    const nextState: AppState = {
      ...appStateRef.current,
      nodes: {
        ...appStateRef.current.nodes,
        [nodeId]: updatedNode,
      },
    };
    saveNodeToFirestore(activeProjectId, updatedNode);
    const boundedState = updateContainerBounds(nextState);
    appStateRef.current = boundedState;
    setAppState(boundedState);
  };

  const handleUnlinkText = (textId: string) => {
    if (!activeProjectId) return;
    const curr = appStateRef.current.texts[textId];
    if (!curr) return;

    pushUndoSnapshot();

    if (curr.containerId) {
      pendingExitContainerRef.current[textId] = curr.containerId;
    }

    const updatedText = { ...curr, containerId: null };
    const nextState: AppState = {
      ...appStateRef.current,
      texts: {
        ...appStateRef.current.texts,
        [textId]: updatedText,
      },
    };
    saveTextToFirestore(activeProjectId, updatedText);
    const boundedState = updateContainerBounds(nextState);
    appStateRef.current = boundedState;
    setAppState(boundedState);
  };

  const handleDeleteText = (textId: string) => {
    if (!activeProjectId) return;
    pushUndoSnapshot();
    setAppState((prev) => {
      const nextTexts = { ...prev.texts };
      delete nextTexts[textId];
      const next = {
        ...prev,
        texts: nextTexts,
      };
      appStateRef.current = next;
      return next;
    });
    deleteTextFromFirestore(activeProjectId, textId);
  };

  // Custom Project Labels CRUD, Batch Assignment & Visual Filtering
  const handleAddLabel = (name: string, color: string) => {
    if (!activeProjectId || isReadOnly) return;
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return;
    pushUndoSnapshot();
    const id = `lbl-${Date.now()}`;
    const newLabel: LabelItem = {
      id,
      projectId: activeProjectId,
      name: trimmed,
      color,
    };
    setAppState((prev) => {
      const next = {
        ...prev,
        labels: { ...prev.labels, [id]: newLabel },
      };
      appStateRef.current = next;
      return next;
    });
    saveLabelToFirestore(activeProjectId, id, newLabel);
  };

  const handleUpdateLabel = (id: string, name: string, color: string) => {
    if (!activeProjectId || isReadOnly) return;
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return;
    const currLabel = appStateRef.current.labels[id];
    if (!currLabel) return;

    pushUndoSnapshot();
    const updatedLabel: LabelItem = {
      ...currLabel,
      id,
      projectId: activeProjectId,
      name: trimmed,
      color,
    };

    const updatedContainers: TextElement[] = [];
    const oldColorLower = (currLabel.color || '').toLowerCase();

    setAppState((prev) => {
      const nextTexts = { ...prev.texts };
      Object.entries(nextTexts).forEach(([tid, el]) => {
        if (el.mode === 'container' && el.labelId === id) {
          const elColorLower = (el.color || '').toLowerCase();
          if (!elColorLower || elColorLower === oldColorLower) {
            const nextEl = { ...el, color };
            nextTexts[tid] = nextEl;
            updatedContainers.push(nextEl);
          }
        }
      });

      const next = {
        ...prev,
        labels: { ...prev.labels, [id]: updatedLabel },
        texts: nextTexts,
      };
      appStateRef.current = next;
      return next;
    });

    saveLabelToFirestore(activeProjectId, id, updatedLabel, updatedContainers);
  };

  const handleDeleteLabel = (id: string) => {
    if (!activeProjectId || isReadOnly) return;
    pushUndoSnapshot();

    const clearedNodes: WorkflowNode[] = [];
    const clearedTexts: TextElement[] = [];

    setAppState((prev) => {
      const nextLabels = { ...prev.labels };
      delete nextLabels[id];

      const nextNodes = { ...prev.nodes };
      Object.entries(nextNodes).forEach(([nid, n]) => {
        if (n.labelId === id) {
          const updated = { ...n, labelId: '' };
          nextNodes[nid] = updated;
          clearedNodes.push(updated);
        }
      });

      const nextTexts = { ...prev.texts };
      Object.entries(nextTexts).forEach(([tid, el]) => {
        if (el.labelId === id) {
          const updated = { ...el, labelId: '' };
          nextTexts[tid] = updated;
          clearedTexts.push(updated);
        }
      });

      const next = {
        ...prev,
        labels: nextLabels,
        nodes: nextNodes,
        texts: nextTexts,
      };
      appStateRef.current = next;
      return next;
    });

    setFilterLabelIds((prev) => prev.filter((fid) => fid !== id));
    deleteLabelFromFirestore(activeProjectId, id, clearedNodes, clearedTexts);
  };

  const handleSeedStarterLabels = () => {
    if (!activeProjectId || isReadOnly) return;
    pushUndoSnapshot();
    const starters: Record<string, LabelItem> = {
      'lbl-1': { id: 'lbl-1', projectId: activeProjectId, name: t('app.seedLabelAct1'), color: '#2563eb' },
      'lbl-2': { id: 'lbl-2', projectId: activeProjectId, name: t('app.seedLabelReview'), color: '#dc2626' },
      'lbl-3': { id: 'lbl-3', projectId: activeProjectId, name: t('app.seedLabelPolish'), color: '#059669' },
    };

    setAppState((prev) => {
      const next = {
        ...prev,
        labels: { ...prev.labels, ...starters },
      };
      appStateRef.current = next;
      return next;
    });

    Object.entries(starters).forEach(([id, lbl]) => {
      saveLabelToFirestore(activeProjectId, id, lbl);
    });
  };

  const handleBatchAssignLabel = (labelId: string) => {
    if (!activeProjectId || isReadOnly) return;
    const nodeIds = Object.entries(selectedItems)
      .filter(([id, kind]) => kind === 'node' && Boolean(appStateRef.current.nodes[id]))
      .map(([id]) => id);
    const textIds = Object.entries(selectedItems)
      .filter(([id, kind]) => kind === 'text' && Boolean(appStateRef.current.texts[id]))
      .map(([id]) => id);

    if (nodeIds.length === 0 && textIds.length === 0) return;

    pushUndoSnapshot();
    const labelItem = labelId ? appStateRef.current.labels[labelId] : undefined;
    const changedNodes: WorkflowNode[] = [];
    const changedTexts: TextElement[] = [];

    setAppState((prev) => {
      const nextNodes = { ...prev.nodes };
      const nextTexts = { ...prev.texts };

      nodeIds.forEach((nid) => {
        const curr = nextNodes[nid];
        if (!curr) return;
        const updated: WorkflowNode = { ...curr, labelId: labelId || '' };
        nextNodes[nid] = updated;
        changedNodes.push(updated);
      });

      textIds.forEach((tid) => {
        const curr = nextTexts[tid];
        if (!curr) return;
        const updated: TextElement = {
          ...curr,
          labelId: labelId || '',
          ...(curr.mode === 'container' && labelItem ? { color: labelItem.color } : {}),
        };
        nextTexts[tid] = updated;
        changedTexts.push(updated);
      });

      const next = {
        ...prev,
        nodes: nextNodes,
        texts: nextTexts,
      };
      appStateRef.current = next;
      return next;
    });

    saveCanvasPositionsBatch(activeProjectId, changedNodes, changedTexts);
  };

  const handleToggleFilterLabel = (labelId: string) => {
    setFilterLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  // Vercel Blob Upload & Registry in Firestore (No Base64 in documents)
  const handleUploadNodeImage = async (
    nodeId: string,
    file: File,
    isMap = false,
    skipReplaceIfNoAnnotations = false
  ) => {
    if (!activeProjectId) return;
    const folder = isMap ? 'maps' : 'images';
    setUploadError(null);
    setIsUploadingMedia(true);
    try {
      // 1. Upload file directly to Vercel Blob Storage
      const res = await uploadImageToStorage(file, folder);
      const normUrl = res.url.split('?')[0].trim();
      recentlyUploadedUrlsRef.current.add(normUrl);

      // 2. Register image metadata + Storage path + download URL in Firestore scoped to active project
      const imageRecord: ImageResource = {
        id: `img-${Date.now()}`,
        projectId: activeProjectId,
        name: file.name,
        url: res.url,
        storagePath: res.storagePath,
        folder,
        sizeBytes: file.size,
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
      };
      await registerImageInDb(imageRecord);

      // 3. Attach URL reference to node (strictly URL, zero base64 in node document!)
      if (isMap) {
        handleUpdateNode(nodeId, {
          mapImage: res.url,
          mapName: file.name.replace(/\.[^/.]+$/, ''),
        });
      } else {
        const curr = appState.nodes[nodeId];
        const hasAnnotations = Boolean(curr?.pins?.length || curr?.drawings?.length);
        if (curr?.image && (!skipReplaceIfNoAnnotations || hasAnnotations)) {
          setReplaceWarningTarget({ nodeId, pendingUrl: res.url });
        } else {
          handleUpdateNode(nodeId, { image: res.url });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('app.errUploadImage');
      setUploadError(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Upload a single AI-generated/edited asset directly into the project library (and optionally attach to active node)
  const handleUploadLibraryImageFile = async (
    file: File,
    folder: 'images' | 'maps',
    attachToNodeId?: string
  ) => {
    if (!activeProjectId) return;
    setUploadError(null);
    setIsUploadingMedia(true);
    try {
      const res = await uploadImageToStorage(file, folder);
      const normUrl = res.url.split('?')[0].trim();
      recentlyUploadedUrlsRef.current.add(normUrl);

      await registerImageInDb({
        id: `img-${Date.now()}`,
        projectId: activeProjectId,
        name: file.name,
        url: res.url,
        storagePath: res.storagePath,
        folder,
        sizeBytes: file.size,
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
      });

      if (attachToNodeId) {
        if (folder === 'maps') {
          handleUpdateNode(attachToNodeId, {
            mapImage: res.url,
            mapName: file.name.replace(/\.[^/.]+$/, ''),
          });
        } else {
          const curr = appState.nodes[attachToNodeId];
          if (curr?.image && (curr.pins?.length || curr.drawings?.length)) {
            setReplaceWarningTarget({ nodeId: attachToNodeId, pendingUrl: res.url });
          } else {
            handleUpdateNode(attachToNodeId, { image: res.url });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('app.errUploadLibrary');
      setUploadError(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Gallery multi-upload to Vercel Blob Storage
  const handleUploadGalleryFiles = async (files: FileList) => {
    if (!activeProjectId) return;
    const folder = galleryModalState.mode.includes('maps') ? 'maps' : 'images';
    setUploadError(null);
    setIsUploadingMedia(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadImageToStorage(file, folder);
        await registerImageInDb({
          id: `img-${Date.now()}_${i}`,
          projectId: activeProjectId,
          name: file.name,
          url: res.url,
          storagePath: res.storagePath,
          folder: folder as 'images' | 'maps',
          sizeBytes: file.size,
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('app.errUploadGallery'));
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Import selected web-searched images/maps into project library (with direct URL fallback for >4MB images)
  const handleImportWebImagesToGallery = async (
    items: ImageSearchResultItem[],
    folder: 'images' | 'maps',
    onProgress?: (current: number, total: number) => void
  ): Promise<{ added: number; failed: number }> => {
    if (!activeProjectId || items.length === 0) return { added: 0, failed: 0 };
    setUploadError(null);
    setIsUploadingMedia(true);
    let added = 0;
    let failed = 0;

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        onProgress?.(i + 1, items.length);
        const safeDisplayName = (item.title || 'Web Image').trim().slice(0, 200) || 'Web Image';
        try {
          const file = await importExternalImageAsFile(item.imageUrl, safeDisplayName);
          const res = await uploadImageToStorage(file, folder);
          const normUrl = res.url.split('?')[0].trim();
          recentlyUploadedUrlsRef.current.add(normUrl);

          await registerImageInDb({
            id: `img-${Date.now()}_${i}`,
            projectId: activeProjectId,
            name: safeDisplayName,
            url: res.url,
            storagePath: res.storagePath,
            folder,
            sizeBytes: file.size,
            uploadedBy: currentUser.name,
            uploadedAt: new Date().toISOString(),
          });
          added += 1;
        } catch {
          // Fallback: if external image is >4MB or proxy fails, register verified HTTPS URL directly
          if (item.imageUrl.startsWith('https://') && item.imageUrl.length <= 2048) {
            try {
              const normUrl = item.imageUrl.split('?')[0].trim();
              recentlyUploadedUrlsRef.current.add(normUrl);
              await registerImageInDb({
                id: `img-${Date.now()}_${i}`,
                projectId: activeProjectId,
                name: safeDisplayName,
                url: item.imageUrl,
                folder,
                sizeBytes: 0,
                uploadedBy: currentUser.name,
                uploadedAt: new Date().toISOString(),
              });
              added += 1;
            } catch {
              failed += 1;
            }
          } else {
            failed += 1;
          }
        }
      }
    } finally {
      setIsUploadingMedia(false);
    }

    return { added, failed };
  };

  const activeNode = activeEditNodeId
    ? appState.nodes[activeEditNodeId] || appState.storedNodes[activeEditNodeId]
    : null;
  const pinningNode = pinningNodeId ? appState.nodes[pinningNodeId] : null;
  const mapViewerNode = mapViewerNodeId ? appState.nodes[mapViewerNodeId] : null;
  const sketchStudioNode = sketchStudioState
    ? appState.nodes[sketchStudioState.nodeId] || appState.storedNodes[sketchStudioState.nodeId]
    : null;
  const activeConn = activeLinePopover
    ? appState.connections.find((c) => c.id === activeLinePopover.connectionId)
    : null;
  const activeTextEl = activeTextPopover
    ? appState.texts[activeTextPopover.elementId]
    : null;

  const selectedEntries = Object.entries(selectedItems) as [string, 'node' | 'text'][];
  const selectedNodeIds = selectedEntries
    .filter(([id, t]) => t === 'node' && Boolean(appState.nodes[id]))
    .map(([id]) => id);
  const selectedTextIds = selectedEntries
    .filter(([id, t]) => t === 'text' && Boolean(appState.texts[id]))
    .map(([id]) => id);
  const totalSelectedCount = selectedNodeIds.length + selectedTextIds.length;

  // Canvas keyboard shortcuts: Space to pan, Escape to clear selection, Delete/Backspace to remove selected
  useEffect(() => {
    const isInputTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const hasOpenModal = Boolean(
      activeEditNodeId ||
        pinningNodeId ||
        mapViewerNodeId ||
        adminConsoleOpen ||
        archiveModalOpen ||
        exportModalOpen ||
        galleryModalState.open ||
        globalVideoModalOpen ||
        actorLibraryState.open ||
        Boolean(inspectedActor) ||
        deleteWarningNodeId ||
        batchDeleteOpen ||
        labelManagerOpen ||
        replaceWarningTarget ||
        apiKeyModalOpen ||
        aiImageModalState ||
        sketchStudioState
    );

    const onKeyDown = (e: KeyboardEvent) => {
      if (isInputTarget(e.target) || hasOpenModal) return;

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const keyLower = e.key.toLowerCase();
        if (keyLower === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (keyLower === 'y' || (keyLower === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      if (e.key === 'Escape') {
        setSelectedItems({});
        setSelectionBox(null);
        setActiveLinePopover(null);
        setActiveTextPopover(null);
        setLabelPickerTarget(null);
        setSearchQuery('');
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isReadOnly && totalSelectedCount > 0) {
        e.preventDefault();
        setBatchDeleteOpen(true);
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === 'v') {
          setCanvasToolMode('select');
        } else if (e.key.toLowerCase() === 'h') {
          setCanvasToolMode('pan');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    const onWindowBlur = () => {
      setIsSpacePressed(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    activeEditNodeId,
    pinningNodeId,
    mapViewerNodeId,
    adminConsoleOpen,
    archiveModalOpen,
    exportModalOpen,
    galleryModalState.open,
    globalVideoModalOpen,
    actorLibraryState.open,
    inspectedActor,
    deleteWarningNodeId,
    batchDeleteOpen,
    labelManagerOpen,
    replaceWarningTarget,
    apiKeyModalOpen,
    aiImageModalState,
    sketchStudioState,
    isReadOnly,
    totalSelectedCount,
    handleUndo,
    handleRedo,
  ]);

  const hasApiKey = Boolean(userGeminiApiKey && userGeminiApiKey.trim());
  const isSearchActive = searchQuery.trim().length > 0;
  const isLabelFilterActive = filterLabelIds.length > 0;
  const isAnyFilterActive = isSearchActive || isLabelFilterActive;

  const doesLabelFilterMatch = useCallback(
    (elementLabelId?: string) => {
      if (!isLabelFilterActive) return true;
      const hasValidLabel = Boolean(elementLabelId && appState.labels[elementLabelId]);
      if (!hasValidLabel) {
        return filterLabelIds.includes(UNLABELED_FILTER_ID);
      }
      return filterLabelIds.includes(elementLabelId!);
    },
    [isLabelFilterActive, filterLabelIds, appState.labels]
  );

  const matchedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isAnyFilterActive) return ids;
    Object.values(appState.nodes).forEach((node) => {
      const matchesSearch = !isSearchActive || doesNodeMatchQuery(node, searchQuery, appState.labels);
      const matchesLabel = doesLabelFilterMatch(node.labelId);
      if (matchesSearch && matchesLabel) {
        ids.add(node.id);
      }
    });
    return ids;
  }, [isAnyFilterActive, isSearchActive, searchQuery, appState.nodes, appState.labels, doesLabelFilterMatch]);

  const matchedTextIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isAnyFilterActive) return ids;
    Object.values(appState.texts).forEach((el) => {
      const matchesSearch = !isSearchActive || doesTextMatchQuery(el, appState.labels, searchQuery);
      const matchesLabel = doesLabelFilterMatch(el.labelId);
      if (matchesSearch && matchesLabel) {
        ids.add(el.id);
      }
    });
    return ids;
  }, [isAnyFilterActive, isSearchActive, searchQuery, appState.texts, appState.labels, doesLabelFilterMatch]);

  const hiddenNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isLabelFilterActive || filterDisplayMode !== 'isolate') return ids;
    Object.keys(appState.nodes).forEach((id) => {
      if (!matchedNodeIds.has(id)) ids.add(id);
    });
    return ids;
  }, [isLabelFilterActive, filterDisplayMode, appState.nodes, matchedNodeIds]);

  const hiddenTextIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isLabelFilterActive || filterDisplayMode !== 'isolate') return ids;
    Object.keys(appState.texts).forEach((id) => {
      if (!matchedTextIds.has(id)) ids.add(id);
    });
    return ids;
  }, [isLabelFilterActive, filterDisplayMode, appState.texts, matchedTextIds]);

  const handleFitFilteredElements = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    Object.values(appState.nodes).forEach((n) => {
      if (isAnyFilterActive && !matchedNodeIds.has(n.id)) return;
      const x = parseFloat(n.x) || 0;
      const y = parseFloat(n.y) || 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + 220 > maxX) maxX = x + 220;
      if (y + 180 > maxY) maxY = y + 180;
    });

    Object.values(appState.texts).forEach((el) => {
      if (isAnyFilterActive && !matchedTextIds.has(el.id)) return;
      const x = parseFloat(el.x) || 0;
      const y = parseFloat(el.y) || 0;
      const w = el.width || (el.mode === 'container' ? 340 : 220);
      const h = el.height || (el.mode === 'container' ? 240 : el.mode === 'annotation' ? 120 : 48);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    });

    if (minX === Infinity) return;

    const padding = 120;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const viewW = vp.clientWidth;
    const viewH = vp.clientHeight;
    const newZoom = Math.max(0.2, Math.min(Math.min(viewW / width, viewH / height), 1.6));
    const centerX = minX - padding + width / 2;
    const centerY = minY - padding + height / 2;

    applyZoomImmediate(newZoom, centerX * newZoom - viewW / 2, centerY * newZoom - viewH / 2);
  }, [appState.nodes, appState.texts, isAnyFilterActive, matchedNodeIds, matchedTextIds, applyZoomImmediate]);

  const activeGalleryFolder = galleryModalState.mode.includes('maps') ? 'maps' : 'images';
  const filteredGalleryImages = imagesDbList.filter(
    (img) => img.folder === activeGalleryFolder && Boolean(activeProjectId) && img.projectId === activeProjectId
  );

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : t('app.googleSignInError')
      );
    }
  };

  if (!authReady) {
    return (
      <div className="w-screen h-screen bg-[#c9c6bd] dark:bg-neutral-950 text-[#2b2924] dark:text-neutral-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs text-[#5c584e] dark:text-neutral-400">{t('app.connectingWorkspace')}</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="w-screen h-screen relative bg-[#c9c6bd] dark:bg-neutral-950 text-[#2b2924] dark:text-neutral-100 flex items-center justify-center p-4">
        <div
          className="absolute top-4 right-4 z-10 inline-flex items-center gap-0.5 rounded-lg bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-800 p-0.5 shadow-md text-[11px]"
          role="group"
          aria-label={t('common.language')}
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
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
            className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
              language === 'es'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            ES
          </button>
        </div>
        <div className="w-full max-w-sm rounded-2xl bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-800 p-7 shadow-2xl text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/15 dark:bg-blue-600/20 border border-blue-600/30 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 mx-auto flex items-center justify-center font-bold text-lg">
            VW
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold tracking-tight text-[#2b2924] dark:text-neutral-100">
              {t('auth.title')}
            </h1>
            <p className="text-xs text-[#5c584e] dark:text-neutral-400 leading-relaxed">
              {t('auth.subtitle')}
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-600/12 dark:bg-red-950/50 border border-red-600/35 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300 text-left break-words">
              {authError}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-lg shadow-blue-900/20 dark:shadow-blue-900/30 transition-colors cursor-pointer"
          >
            {t('auth.signInWithGoogle')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex flex-col ${
        isDark ? 'dark bg-[#121212] text-neutral-100' : 'light bg-[#c9c6bd] text-[#2b2924]'
      }`}
    >
      {/* Top Application Header */}
      <Header
        user={currentUser}
        effectiveRole={effectiveRole}
        projects={visibleProjects}
        activeProject={activeProject}
        storedCount={Object.keys(appState.storedNodes).length}
        zoom={zoom}
        styleSettings={canvasStyle}
        nodes={appState.nodes}
        texts={appState.texts}
        labels={appState.labels}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchMatchCount={matchedNodeIds.size}
        onFocusSearchTarget={handleFocusSearchTarget}
        onChangeStyleSettings={setCanvasStyle}
        onResetStyleSettings={handleResetCanvasStyle}
        onSelectProject={(pId) => {
          setActiveProjectId(pId);
          setSearchQuery('');
          setTimeout(() => centerCanvas(), 150);
        }}
        onOpenAdminConsole={() => setAdminConsoleOpen(true)}
        onOpenArchitecture={() => setArchitectureModalOpen(true)}
        onOpenGallery={(mode) => setGalleryModalState({ open: true, mode })}
        onOpenVideoLib={() => setGlobalVideoModalOpen(true)}
        onOpenActorLib={() => setActorLibraryState({ open: true })}
        onOpenArchive={() => setArchiveModalOpen(true)}
        activeLabelFilterCount={filterLabelIds.length}
        onOpenLabelManager={() => setLabelManagerOpen(true)}
        onOpenExport={() => {
          const vp = viewportRef.current;
          const z = currentZoomRef.current || 1;
          if (vp) {
            setExportViewportRect({
              x: cameraPosRef.current.x / z,
              y: cameraPosRef.current.y / z,
              width: vp.clientWidth / z,
              height: vp.clientHeight / z,
              zoom: z,
            });
          }
          setExportModalOpen(true);
        }}
        onAddNode={handleAddNode}
        onAddTextDirect={(type) => handleAddText(type)}
        onZoomChange={(type) => {
          if (type === '100') {
            if (viewportRef.current) {
              const vp = viewportRef.current;
              const cx = vp.clientWidth / 2;
              const cy = vp.clientHeight / 2;
              const prevZ = currentZoomRef.current;
              const canvasX = (cameraPosRef.current.x + cx) / prevZ;
              const canvasY = (cameraPosRef.current.y + cy) / prevZ;
              applyZoomImmediate(1, canvasX - cx, canvasY - cy);
            } else {
              applyZoomImmediate(1);
            }
          }
          if (type === 'center') centerCanvas();
          if (type === 'fit') fitAllNodes();
        }}
        hasApiKey={hasApiKey}
        onOpenApiKeyConfig={() => setApiKeyModalOpen(true)}
        onSignInGoogle={handleGoogleLogin}
        onSignOut={() => logOut()}
      />

      {/* Infinite Canvas Viewport */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        <ReactiveDotGrid
          viewportRef={viewportRef}
          panRef={cameraPosRef}
          zoomRef={currentZoomRef}
          zoomTrigger={zoom}
          onRegisterRender={registerDotGridRender}
          styleSettings={canvasStyle}
        />
        <LabelFilterBar
          labels={appState.labels}
          nodes={appState.nodes}
          texts={appState.texts}
          activeFilterIds={filterLabelIds}
          filterDisplayMode={filterDisplayMode}
          matchedCounts={{ nodes: matchedNodeIds.size, texts: matchedTextIds.size }}
          onToggleLabelFilter={handleToggleFilterLabel}
          onClearFilter={() => setFilterLabelIds([])}
          onChangeDisplayMode={setFilterDisplayMode}
          onFitFiltered={handleFitFilteredElements}
          onOpenLabelManager={() => setLabelManagerOpen(true)}
        />
        <div
          ref={viewportRef}
          onPointerDownCapture={handleCanvasPointerDownCapture}
          onPointerDown={handleCanvasPointerDown}
          onMouseDown={(e) => {
            if (e.button === 1) e.preventDefault();
          }}
          onAuxClick={(e) => {
            if (e.button === 1) e.preventDefault();
          }}
          onPointerMove={handleGlobalPointerMove}
          onPointerUp={handleGlobalPointerUp}
          onPointerCancel={handleGlobalPointerUp}
          className={`w-full h-full overflow-hidden relative z-10 select-none touch-canvas ${
            isPanningCanvas
              ? 'cursor-grabbing'
              : isSpacePressed || canvasToolMode === 'pan'
              ? 'cursor-grab'
              : 'cursor-default'
          }`}
        >
        <div
          ref={canvasRef}
          data-pan-mode={isSpacePressed || canvasToolMode === 'pan' ? 'true' : 'false'}
          style={{
            width: 5000,
            height: 5000,
            transform: `translate3d(${-cameraPosRef.current.x}px, ${-cameraPosRef.current.y}px, 0) scale(${currentZoomRef.current})`,
            transformOrigin: '0 0',
            willChange: 'transform',
            ['--canvas-zoom' as string]: currentZoomRef.current,
          }}
          className="absolute top-0 left-0 canvas-grid"
        >
          {/* SVG Connection Layer */}
          <ConnectionLines
            connections={appState.connections}
            nodes={appState.nodes}
            texts={appState.texts}
            tempConnection={tempConnection}
            selectedConnectionId={activeLinePopover?.connectionId ?? null}
            isPanMode={isSpacePressed || canvasToolMode === 'pan'}
            isReadOnly={isReadOnly}
            isSearchActive={isAnyFilterActive}
            matchedNodeIds={matchedNodeIds}
            hiddenNodeIds={hiddenNodeIds}
            onSnapGuidesChange={setSnapGuides}
            onClickConnection={(connectionId, x, y) => {
              setActiveLinePopover({ connectionId, x, y });
            }}
            onCommitConnectionShape={(connectionId, updates) => {
              if (!activeProjectId || isReadOnly) return;
              const targetConn = appStateRef.current.connections.find((c) => c.id === connectionId);
              if (!targetConn) return;
              pushUndoSnapshot();
              const updatedConn = { ...targetConn, ...updates };
              if (updates.angleOffset === undefined && 'angleOffset' in updates) {
                delete updatedConn.angleOffset;
              }
              if (updates.curveOffset === undefined && 'curveOffset' in updates) {
                delete updatedConn.curveOffset;
              }
              setAppState((prev) => {
                const next = {
                  ...prev,
                  connections: prev.connections.map((c) =>
                    c.id === connectionId ? updatedConn : c
                  ),
                };
                appStateRef.current = next;
                return next;
              });
              saveConnectionToFirestore(activeProjectId, updatedConn);
            }}
          />

          {/* Smart Alignment Snap Guides */}
          {snapGuides.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-[25] overflow-visible">
              {snapGuides.map((guide, idx) => (
                <g key={`${guide.axis}-${guide.coord}-${idx}`}>
                  <line
                    x1={guide.axis === 'x' ? guide.coord : guide.spanStart}
                    y1={guide.axis === 'x' ? guide.spanStart : guide.coord}
                    x2={guide.axis === 'x' ? guide.coord : guide.spanEnd}
                    y2={guide.axis === 'x' ? guide.spanEnd : guide.coord}
                    stroke="#38bdf8"
                    strokeWidth="1.25"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                    opacity="0.92"
                  />
                  {guide.markers.map((pos, mIdx) =>
                    guide.axis === 'x' ? (
                      <line
                        key={mIdx}
                        x1={guide.coord - 4}
                        y1={pos}
                        x2={guide.coord + 4}
                        y2={pos}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        opacity="0.95"
                      />
                    ) : (
                      <line
                        key={mIdx}
                        x1={pos}
                        y1={guide.coord - 4}
                        x2={pos}
                        y2={guide.coord + 4}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        opacity="0.95"
                      />
                    )
                  )}
                </g>
              ))}
            </svg>
          )}

          {/* Marquee Selection Box */}
          {selectionBox && (
            <div
              style={{
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY),
                borderWidth: 'calc(1.5px / var(--canvas-zoom, 1))',
              }}
              className="absolute border-sky-400 bg-sky-400/12 pointer-events-none z-40 rounded-sm"
            />
          )}

          {/* Grouping Containers and Text Elements */}
          {Object.values(appState.texts).map((element) => (
            <div
              key={element.id}
              onPointerDown={(e) => handleNodeOrTextPointerDown(element.id, 'text', e)}
            >
              <CanvasTextCard
                element={element}
                label={element.labelId ? appState.labels[element.labelId] : undefined}
                isReadOnly={isReadOnly}
                isDropTarget={element.mode === 'container' && hoveredDropContainerId === element.id}
                isSelected={
                  activeTextPopover?.elementId === element.id ||
                  highlightedElementId === element.id ||
                  Boolean(selectedItems[element.id])
                }
                isHiddenByFilter={hiddenTextIds.has(element.id)}
                searchMatchState={
                  !isAnyFilterActive
                    ? 'none'
                    : matchedTextIds.has(element.id)
                    ? 'match'
                    : 'dimmed'
                }
                onOpenSettings={(id, e) => {
                  setActiveTextPopover({ elementId: id, x: e.clientX, y: e.clientY });
                }}
                onOpenLabelPicker={(id, e) => {
                  setLabelPickerTarget({ mode: 'text', targetId: id, x: e.clientX, y: e.clientY });
                }}
                onDelete={(id) => {
                  if (selectedItems[id] && totalSelectedCount > 1) {
                    setBatchDeleteOpen(true);
                  } else {
                    handleDeleteText(id);
                  }
                }}
                onUnlink={handleUnlinkText}
                onUpdateText={handleUpdateText}
                onFitContainer={handleFitContainerToNodes}
              />
            </div>
          ))}

          {/* Interactive Workflow Scene Nodes */}
          {Object.values(appState.nodes).map((node) => (
            <div
              key={node.id}
              onPointerDown={(e) => handleNodeOrTextPointerDown(node.id, 'node', e)}
            >
              <WorkflowNodeCard
                node={node}
                label={node.labelId ? appState.labels[node.labelId] : undefined}
                isReadOnly={isReadOnly}
                isHighlighted={highlightedElementId === node.id}
                isSelected={Boolean(selectedItems[node.id])}
                isHiddenByFilter={hiddenNodeIds.has(node.id)}
                searchMatchState={
                  !isAnyFilterActive
                    ? 'none'
                    : matchedNodeIds.has(node.id)
                    ? 'match'
                    : 'dimmed'
                }
                isConnectionDragging={Boolean(tempConnection)}
                activeSourcePort={tempConnection?.sourceId === node.id ? tempConnection.sourcePort : null}
                approachedPort={
                  tempConnection?.hoverTarget?.nodeId === node.id
                    ? {
                        port: tempConnection.hoverTarget.port,
                        proximity: tempConnection.hoverTarget.proximity,
                        isReady: tempConnection.hoverTarget.isReady,
                      }
                    : null
                }
                isHoveringContainer={
                  activeDragElement?.type === 'node' &&
                  activeDragElement.id === node.id &&
                  Boolean(hoveredDropContainerId)
                }
                onStartPortDrag={(nodeId, port, e) => {
                  if (!canvasRef.current) return;
                  const cRect = canvasRef.current.getBoundingClientRect();
                  const fallbackX = (e.clientX - cRect.left) / currentZoomRef.current;
                  const fallbackY = (e.clientY - cRect.top) / currentZoomRef.current;
                  const portCoords = getNodePortCoords(appState.nodes, nodeId, port);
                  const startX = portCoords ? portCoords.x : fallbackX;
                  const startY = portCoords ? portCoords.y : fallbackY;
                  setTempConnection({
                    sourceId: nodeId,
                    sourcePort: port,
                    startX,
                    startY,
                    currentX: fallbackX,
                    currentY: fallbackY,
                    hoverTarget: null,
                  });
                }}
                onOpenDashboard={(id) => setActiveEditNodeId(id)}
                onOpenLabelPicker={(id, e) => {
                  setLabelPickerTarget({ mode: 'node', targetId: id, x: e.clientX, y: e.clientY });
                }}
                onDeleteRequest={(id) => {
                  if (selectedItems[id] && totalSelectedCount > 1) {
                    setBatchDeleteOpen(true);
                  } else {
                    setDeleteWarningNodeId(id);
                  }
                }}
                onUnlinkContainer={handleUnlinkNode}
                onUpdateTitle={(id, title) => handleUpdateNode(id, { title })}
                onImagePaste={(id, file) => handleUploadNodeImage(id, file)}
              />
            </div>
          ))}
        </div>

        {/* Floating Canvas Interaction & Multi-Select Dock */}
        <div
          data-canvas-ui="true"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 max-w-[95vw] overflow-x-auto bg-[#ebe7de]/95 dark:bg-neutral-900/95 backdrop-blur-md border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl p-1.5 text-xs"
        >
          <div className="flex items-center gap-0.5 bg-[#dcd7cc]/90 dark:bg-neutral-950/70 rounded-lg p-0.5 border border-[#c6c0b3] dark:border-neutral-800 shrink-0">
            <button
              onClick={() => setCanvasToolMode('select')}
              className={`touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                canvasToolMode === 'select' && !isSpacePressed
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#433f37] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800'
              }`}
              title={t('app.selectToolTitle')}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>{t('app.selectTool')}</span>
            </button>
            <button
              onClick={() => setCanvasToolMode('pan')}
              className={`touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                canvasToolMode === 'pan' || isSpacePressed
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#433f37] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800'
              }`}
              title={t('app.panToolTitle')}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>{t('app.panTool')}</span>
            </button>
          </div>

          {!isReadOnly && (
            <>
              <div className="h-5 w-px bg-[#c3beb1] dark:bg-neutral-700/80" />
              <div className="flex items-center gap-0.5 bg-[#dcd7cc]/90 dark:bg-neutral-950/70 rounded-lg p-0.5 border border-[#c6c0b3] dark:border-neutral-800">
                <button
                  onClick={handleUndo}
                  disabled={undoCount === 0}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                    undoCount > 0
                      ? 'text-[#433f37] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-200 dark:hover:text-white dark:hover:bg-neutral-800 cursor-pointer'
                      : 'text-[#9b9588] dark:text-neutral-600 cursor-not-allowed'
                  }`}
                  title={t('app.undoTitle', { count: undoCount })}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="tabular-nums text-[10px] opacity-80">{undoCount}</span>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoCount === 0}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                    redoCount > 0
                      ? 'text-[#433f37] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-200 dark:hover:text-white dark:hover:bg-neutral-800 cursor-pointer'
                      : 'text-[#9b9588] dark:text-neutral-600 cursor-not-allowed'
                  }`}
                  title={t('app.redoTitle', { count: redoCount })}
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span className="tabular-nums text-[10px] opacity-80">{redoCount}</span>
                </button>
              </div>
            </>
          )}

          {totalSelectedCount >= 2 && (
            <>
              <div className="h-5 w-px bg-[#c3beb1] dark:bg-neutral-700/80" />
              <span className="px-2 font-medium text-blue-700 dark:text-sky-300 tabular-nums whitespace-nowrap shrink-0">
                {t('app.selectedCount', { count: totalSelectedCount })}
              </span>
              {!isReadOnly && (
                <div className="flex items-center gap-1">
                  {selectedNodeIds.length >= 3 && (
                    <div className="flex items-center gap-0.5 bg-[#dcd7cc]/90 dark:bg-neutral-950/70 rounded-lg p-0.5 border border-[#c6c0b3] dark:border-neutral-800 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDistributeNodes('horizontal')}
                        className="touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-[#433f37] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-200 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title={t('app.distributeHTitle', { count: selectedNodeIds.length })}
                      >
                        <AlignHorizontalDistributeCenter className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                        <span className="hidden sm:inline">{t('app.distributeH')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDistributeNodes('vertical')}
                        className="touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-[#433f37] hover:text-[#1f1d18] hover:bg-[#cfc9bc] dark:text-neutral-200 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title={t('app.distributeVTitle', { count: selectedNodeIds.length })}
                      >
                        <AlignVerticalDistributeCenter className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                        <span className="hidden sm:inline">{t('app.distributeV')}</span>
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => setLabelPickerTarget({ mode: 'batch', x: e.clientX, y: e.clientY })}
                    className="touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#ded9cd] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#2b2924] dark:text-neutral-200 border border-[#c3beb1] dark:border-neutral-700 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title={t('app.batchLabelTitle')}
                  >
                    <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>{t('app.batchLabel')}</span>
                  </button>
                  {selectedNodeIds.length > 0 && (
                    <button
                      onClick={handleBatchArchiveSelectedNodes}
                      className="touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#ded9cd] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-amber-800 dark:text-amber-300 border border-[#c3beb1] dark:border-neutral-700 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      title={t('app.archiveSelectedTitle')}
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{t('app.archiveSelected', { count: selectedNodeIds.length })}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setBatchDeleteOpen(true)}
                    className="touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title={t('app.deleteSelectedTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('app.deleteSelected', { count: totalSelectedCount })}</span>
                  </button>
                </div>
              )}
              <button
                onClick={() => setSelectedItems({})}
                className="p-1.5 text-[#5a554b] hover:text-[#1f1d18] hover:bg-[#d6d0c3] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                title={t('app.clearSelectionTitle')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Popovers */}
      {activeLinePopover && activeConn && (
        <LinePropertiesMenu
          connection={activeConn}
          position={{ x: activeLinePopover.x, y: activeLinePopover.y }}
          onClose={() => setActiveLinePopover(null)}
          onUpdate={(updates) => {
            if (activeProjectId) {
              const coalesceField =
                'label' in updates
                  ? 'label'
                  : 'parallelLabels' in updates
                  ? 'parallelLabels'
                  : 'color' in updates
                  ? 'color'
                  : 'cornerRadius' in updates
                  ? 'cornerRadius'
                  : null;
              pushUndoSnapshot(
                undefined,
                coalesceField ? `line:${activeConn.id}:${coalesceField}` : undefined
              );
              const updatedConn = { ...activeConn, ...updates };
              if ('angleOffset' in updates && updates.angleOffset === undefined) {
                delete updatedConn.angleOffset;
              }
              if ('curveOffset' in updates && updates.curveOffset === undefined) {
                delete updatedConn.curveOffset;
              }
              if ('cornerRadius' in updates && updates.cornerRadius === undefined) {
                delete updatedConn.cornerRadius;
              }
              setAppState((prev) => {
                const next = {
                  ...prev,
                  connections: prev.connections.map((c) =>
                    c.id === activeConn.id ? updatedConn : c
                  ),
                };
                appStateRef.current = next;
                return next;
              });
              saveConnectionToFirestore(activeProjectId, updatedConn);
            }
          }}
          onDelete={() => {
            if (activeProjectId) {
              pushUndoSnapshot();
              setAppState((prev) => {
                const next = {
                  ...prev,
                  connections: prev.connections.filter((c) => c.id !== activeConn.id),
                };
                appStateRef.current = next;
                return next;
              });
              deleteConnectionFromFirestore(activeProjectId, activeConn.id);
            }
            setActiveLinePopover(null);
          }}
        />
      )}

      {activeTextPopover && activeTextEl && (
        <TextPropertiesMenu
          element={activeTextEl}
          labels={appState.labels}
          position={{ x: activeTextPopover.x, y: activeTextPopover.y }}
          onClose={() => setActiveTextPopover(null)}
          onUpdate={(updates) => handleUpdateText(activeTextEl.id, updates)}
          onOpenLabelManager={() => {
            setActiveTextPopover(null);
            setLabelManagerOpen(true);
          }}
        />
      )}

      {labelPickerTarget && (
        <LabelPickerPopover
          labels={appState.labels}
          currentLabelId={
            labelPickerTarget.mode === 'node' && labelPickerTarget.targetId
              ? appState.nodes[labelPickerTarget.targetId]?.labelId || ''
              : labelPickerTarget.mode === 'text' && labelPickerTarget.targetId
              ? appState.texts[labelPickerTarget.targetId]?.labelId || ''
              : ''
          }
          selectedCount={labelPickerTarget.mode === 'batch' ? totalSelectedCount : 1}
          position={{ x: labelPickerTarget.x, y: labelPickerTarget.y }}
          isReadOnly={isReadOnly}
          onSelectLabel={(labelId) => {
            if (labelPickerTarget.mode === 'node' && labelPickerTarget.targetId) {
              handleUpdateNode(labelPickerTarget.targetId, { labelId });
            } else if (labelPickerTarget.mode === 'text' && labelPickerTarget.targetId) {
              const el = appStateRef.current.texts[labelPickerTarget.targetId];
              const nextLabel = labelId ? appStateRef.current.labels[labelId] : undefined;
              handleUpdateText(
                labelPickerTarget.targetId,
                el?.mode === 'container' && nextLabel
                  ? { labelId, color: nextLabel.color }
                  : { labelId }
              );
            } else if (labelPickerTarget.mode === 'batch') {
              handleBatchAssignLabel(labelId);
            }
          }}
          onOpenLabelManager={() => {
            setLabelPickerTarget(null);
            setLabelManagerOpen(true);
          }}
          onClose={() => setLabelPickerTarget(null)}
        />
      )}

      {/* Web Administration Console Modal */}
      {adminConsoleOpen && (
        <AdminConsoleModal
          currentUser={currentUser}
          projects={projects}
          users={usersList}
          images={imagesDbList}
          activeProjectId={activeProjectId}
          onClose={() => setAdminConsoleOpen(false)}
          onSelectProject={(pId) => {
            setActiveProjectId(pId);
            setSearchQuery('');
            setTimeout(() => centerCanvas(), 150);
          }}
          onCreateProject={async (title, desc) => {
            const pId = await createProject(
              title,
              desc,
              currentUser.uid || 'admin',
              currentUser.email,
              currentUser.name
            );
            setActiveProjectId(pId);
          }}
          onDeleteProject={async (pId) => {
            await deleteProject(pId);
          }}
          onToggleProjectStatus={async (pId, currentStatus) => {
            await updateProject(pId, {
              status: currentStatus === 'active' ? 'archived' : 'active',
            });
          }}
          onUpdateUserRole={async (uid, role) => {
            await updateUserRole(uid, role);
          }}
          onInviteUser={async (email, role) => {
            await inviteUserByEmail(email, role);
          }}
          onDeleteUser={async (user) => {
            await deleteUserCompletely(user, projects);
          }}
          onSetProjectParticipant={async (project, email, role, meta) => {
            await setProjectParticipantRole(project, email, role, meta);
          }}
          onRemoveProjectParticipant={async (project, email) => {
            await removeProjectParticipant(project, email);
          }}
          onSaveUserProjects={async (user, assignments) => {
            await setUserProjectAssignments(user, assignments, projects);
          }}
          onDeleteImageRecord={async (imgId) => {
            await handleDeleteImageRecords([imgId]);
          }}
          onDeleteImagesBatch={async (imgIds) => {
            await handleDeleteImageRecords(imgIds);
          }}
        />
      )}

      {/* Export PNG / SVG Modal */}
      {exportModalOpen && (
        <ExportModal
          appState={appState}
          projectTitle={activeProject?.title || t('app.defaultStoryboardTitle')}
          isDark={isDark}
          viewportRect={exportViewportRect}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      {/* Node Dashboard Modal */}
      {activeNode && (
        <NodeDashboardModal
          node={activeNode}
          globalVideos={appState.globalVideos}
          actors={appState.actors}
          labels={appState.labels}
          isReadOnly={isReadOnly}
          isArchived={Boolean(activeEditNodeId && appState.storedNodes[activeEditNodeId])}
          hasApiKey={hasApiKey}
          currentUserName={currentUser.name}
          onClose={() => setActiveEditNodeId(null)}
          onUpdateNode={handleUpdateNode}
          onOpenLabelManager={() => setLabelManagerOpen(true)}
          onDeleteNode={handleDeleteNode}
          onArchiveNode={handleArchiveNode}
          onOpenPinning={(id) => {
            setActiveEditNodeId(null);
            setPinningNodeId(id);
          }}
          onOpenMapViewer={(id) => {
            setActiveEditNodeId(null);
            setMapViewerNodeId(id);
          }}
          onOpenGalleryPicker={() => setGalleryModalState({ open: true, mode: 'images-picker' })}
          onOpenMapGalleryPicker={() => setGalleryModalState({ open: true, mode: 'maps-picker' })}
          onOpenActorLibrary={() =>
            setActorLibraryState({ open: true, pickForNodeId: activeNode.id })
          }
          onInspectActor={(actor) => setInspectedActor(actor)}
          onOpenAiImage={(mode, targetKind) => {
            if (!hasApiKey) return;
            setAiImageModalState({
              mode,
              targetKind,
              targetScope: 'node',
              nodeId: activeNode.id,
              sourceImageUrl:
                mode === 'edit'
                  ? targetKind === 'map'
                    ? activeNode.mapImage
                    : activeNode.image
                  : null,
              defaultTitle:
                targetKind === 'map'
                  ? activeNode.mapName || `${activeNode.title || 'scene'}-map`
                  : activeNode.title || 'scene',
            });
          }}
          onOpenSketchStudio={(targetKind = 'image') =>
            setSketchStudioState({ nodeId: activeNode.id, targetKind })
          }
          onOpenAddVideoToColumn={(col) => setVideoSelectCol(col)}
          onOpenVideoPlayer={(col) => setVideoPlayerCol(col)}
          onUploadMainImage={(file) => {
            handleUploadNodeImage(activeNode.id, file, false).catch(() => {});
          }}
          onUploadMapImage={(file) => {
            handleUploadNodeImage(activeNode.id, file, true).catch(() => {});
          }}
          onRemoveMap={() => handleUpdateNode(activeNode.id, { mapImage: null, mapName: '', mapDrawings: [] })}
        />
      )}

      {/* Fullscreen Pinning and Drawing Modal */}
      {pinningNode && (
        <PinningModal
          node={pinningNode}
          currentUserName={currentUser.name}
          isReadOnly={isReadOnly}
          onClose={() => {
            const id = pinningNode.id;
            setPinningNodeId(null);
            setActiveEditNodeId(id);
          }}
          onUpdateNode={handleUpdateNode}
          onRequestReplaceImage={() => {
            setReplaceWarningTarget({ nodeId: pinningNode.id, pendingUrl: null });
          }}
        />
      )}

      {/* Fullscreen Map Viewer Modal */}
      {mapViewerNode && (
        <MapViewerModal
          node={mapViewerNode}
          currentUserName={currentUser.name}
          isReadOnly={isReadOnly}
          onClose={() => {
            const id = mapViewerNode.id;
            setMapViewerNodeId(null);
            setActiveEditNodeId(id);
          }}
          onUpdateNode={handleUpdateNode}
          onRequestReplaceMap={() => setGalleryModalState({ open: true, mode: 'maps-picker' })}
        />
      )}

      {/* Delete / Archive Choice Warning Modal */}
      {deleteWarningNodeId && (
        <DeleteWarningModal
          onClose={() => setDeleteWarningNodeId(null)}
          onConfirmDelete={() => handleDeleteNode(deleteWarningNodeId)}
          onConfirmStore={() => handleArchiveNode(deleteWarningNodeId)}
        />
      )}

      {/* Batch Delete / Archive Warning Modal */}
      {batchDeleteOpen && totalSelectedCount > 0 && (
        <DeleteWarningModal
          nodeCount={selectedNodeIds.length}
          textCount={selectedTextIds.length}
          onClose={() => setBatchDeleteOpen(false)}
          onConfirmDelete={handleBatchDeleteSelected}
          onConfirmStore={selectedNodeIds.length > 0 ? handleBatchArchiveSelectedNodes : undefined}
        />
      )}

      {/* Stored Nodes Archive Modal */}
      {archiveModalOpen && (
        <ArchiveModal
          storedNodes={appState.storedNodes}
          onClose={() => setArchiveModalOpen(false)}
          onRestore={(id) => {
            if (!activeProjectId) return;
            const restored = appStateRef.current.storedNodes[id];
            if (restored) {
              pushUndoSnapshot();
              const restoredNode = { ...restored, containerId: null };
              setAppState((prev) => {
                const nextStored = { ...prev.storedNodes };
                delete nextStored[id];
                const next = {
                  ...prev,
                  storedNodes: nextStored,
                  nodes: { ...prev.nodes, [id]: restoredNode },
                };
                appStateRef.current = next;
                return next;
              });
              restoreNodeInFirestore(activeProjectId, restored);
            }
          }}
          onView={(id) => {
            setActiveEditNodeId(id);
            setArchiveModalOpen(false);
          }}
          onDeleteSingle={(id) => {
            if (activeProjectId) {
              pushUndoSnapshot();
              setAppState((prev) => {
                const nextStored = { ...prev.storedNodes };
                delete nextStored[id];
                const next = { ...prev, storedNodes: nextStored };
                appStateRef.current = next;
                return next;
              });
              deleteStoredNodeFromFirestore(activeProjectId, id);
            }
          }}
          onDeleteAll={() => {
            if (confirm(t('app.confirmDeleteAllArchived'))) {
              const ids = Object.keys(appStateRef.current.storedNodes);
              if (activeProjectId && ids.length > 0) {
                pushUndoSnapshot();
                setAppState((prev) => {
                  const next = { ...prev, storedNodes: {} };
                  appStateRef.current = next;
                  return next;
                });
                ids.forEach((id) => {
                  deleteStoredNodeFromFirestore(activeProjectId, id);
                });
              }
            }
          }}
          onUpdateNote={(id, note) => {
            if (!activeProjectId) return;
            pushUndoSnapshot(undefined, `stored:${id}:note`);
            setAppState((prev) => {
              const curr = prev.storedNodes[id];
              if (!curr) return prev;
              const next = {
                ...prev,
                storedNodes: {
                  ...prev.storedNodes,
                  [id]: { ...curr, storeNote: note },
                },
              };
              appStateRef.current = next;
              return next;
            });
            updateStoredNodeNoteInFirestore(activeProjectId, id, note);
          }}
        />
      )}

      {/* Category Label Manager Modal */}
      {labelManagerOpen && (
        <LabelManagerModal
          labels={appState.labels}
          nodes={appState.nodes}
          texts={appState.texts}
          isReadOnly={isReadOnly}
          activeFilterLabelIds={filterLabelIds}
          onClose={() => setLabelManagerOpen(false)}
          onAddLabel={handleAddLabel}
          onUpdateLabel={handleUpdateLabel}
          onDeleteLabel={handleDeleteLabel}
          onSeedStarterLabels={handleSeedStarterLabels}
          onToggleFilterLabel={handleToggleFilterLabel}
          onClearFilter={() => setFilterLabelIds([])}
        />
      )}

      {/* Gallery Modal (Images & Maps scoped to active project) */}
      {galleryModalState.open && (
        <GalleryModal
          mode={galleryModalState.mode}
          projectTitle={activeProject?.title}
          isReadOnly={isReadOnly}
          hasApiKey={hasApiKey}
          userApiKey={userGeminiApiKey}
          images={filteredGalleryImages.map((img) => ({
            id: img.id,
            name: img.name,
            url: img.url,
            sizeBytes: img.sizeBytes,
            projectId: img.projectId,
          }))}
          isLoading={isUploadingMedia}
          onClose={() => setGalleryModalState({ open: false, mode: 'images-manage' })}
          onUploadFiles={handleUploadGalleryFiles}
          onImportWebImages={(items, onProgress) =>
            handleImportWebImagesToGallery(
              items,
              galleryModalState.mode.includes('maps') ? 'maps' : 'images',
              onProgress
            )
          }
          onOpenAiCreate={() => {
            if (!hasApiKey) return;
            const targetKind = galleryModalState.mode.includes('maps') ? 'map' : 'image';
            const isPicker = galleryModalState.mode.includes('picker');
            setAiImageModalState({
              mode: 'create',
              targetKind,
              targetScope: 'library',
              nodeId: isPicker && activeEditNodeId ? activeEditNodeId : undefined,
              applyToPickerNode: Boolean(isPicker && activeEditNodeId),
              defaultTitle: activeProject?.title || targetKind,
            });
          }}
          onOpenAiEdit={(img) => {
            if (!hasApiKey) return;
            const targetKind = galleryModalState.mode.includes('maps') ? 'map' : 'image';
            const isPicker = galleryModalState.mode.includes('picker');
            setAiImageModalState({
              mode: 'edit',
              targetKind,
              targetScope: 'library',
              nodeId: isPicker && activeEditNodeId ? activeEditNodeId : undefined,
              applyToPickerNode: Boolean(isPicker && activeEditNodeId),
              sourceImageUrl: img.url,
              defaultTitle: img.name.replace(/\.[^/.]+$/, ''),
            });
          }}
          onSelectImage={(url) => {
            if (activeEditNodeId) {
              if (galleryModalState.mode === 'maps-picker') {
                handleUpdateNode(activeEditNodeId, { mapImage: url, mapName: t('app.pickedMapName') });
              } else {
                const curr = appState.nodes[activeEditNodeId];
                if (curr?.image) {
                  setReplaceWarningTarget({ nodeId: activeEditNodeId, pendingUrl: url });
                } else {
                  handleUpdateNode(activeEditNodeId, { image: url });
                }
              }
            }
            setGalleryModalState({ open: false, mode: 'images-manage' });
          }}
          onDeleteSelected={async (fileIds) => {
            for (const id of fileIds) {
              const target = imagesDbList.find((img) => img.id === id);
              await deleteImageFromDb(id, target?.url || target?.storagePath);
            }
          }}
        />
      )}

      {/* Project-Scoped Video Library Modal */}
      {globalVideoModalOpen && (
        <GlobalVideoModal
          videos={appState.globalVideos}
          projectTitle={activeProject?.title}
          isReadOnly={isReadOnly}
          userApiKey={userGeminiApiKey}
          author={currentUser.name}
          onClose={() => setGlobalVideoModalOpen(false)}
          onAddVideo={(video) => {
            if (activeProjectId) {
              addProjectVideoDoc(activeProjectId, video);
            }
          }}
          onDeleteVideo={(id) => {
            if (activeProjectId) {
              deleteProjectVideoDoc(activeProjectId, id);
            }
          }}
        />
      )}

      {/* Project-Scoped Actor & 3D Element Library Modal */}
      {actorLibraryState.open && activeProjectId && (
        <ActorLibraryModal
          actors={appState.actors}
          nodes={appState.nodes}
          projectId={activeProjectId}
          projectTitle={activeProject?.title}
          isReadOnly={isReadOnly}
          userApiKey={userGeminiApiKey}
          author={currentUser.name}
          initialEditActorId={actorLibraryState.editActorId ?? null}
          pickNodeTitle={
            actorLibraryState.pickForNodeId
              ? appState.nodes[actorLibraryState.pickForNodeId]?.title ||
                appState.storedNodes[actorLibraryState.pickForNodeId]?.title ||
                null
              : null
          }
          onClose={() => setActorLibraryState({ open: false })}
          onSaveActor={async (actor) => {
            await saveProjectActor(activeProjectId, actor);
          }}
          onDeleteActor={async (actor) => {
            await deleteProjectActor(activeProjectId, actor.id);
            if (inspectedActor?.id === actor.id) {
              setInspectedActor(null);
            }
          }}
          onInspectActor={(actor) => setInspectedActor(actor)}
          onPickActorForNode={
            actorLibraryState.pickForNodeId
              ? (actor, stateOpt) => {
                  const targetNodeId = actorLibraryState.pickForNodeId;
                  if (!targetNodeId) return;
                  const targetNode =
                    appStateRef.current.nodes[targetNodeId] ||
                    appStateRef.current.storedNodes[targetNodeId];
                  if (!targetNode) return;
                  const chosenState = stateOpt || actor.states?.[0] || null;
                  const nextAssignment: NodeActorAssignment = {
                    id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    actorId: actor.id,
                    stateId: chosenState?.id || '',
                    stateLabel: chosenState?.label || t('dashboard.stateFallback'),
                  };
                  handleUpdateNode(targetNodeId, {
                    actors: [...(targetNode.actors || []), nextAssignment],
                  });
                  setActorLibraryState({ open: false });
                }
              : undefined
          }
        />
      )}

      {/* Actor Thumbnail Detail Modal */}
      {inspectedActor && (
        <ActorDetailModal
          actor={
            appState.actors.find((a) => a.id === inspectedActor.id) || inspectedActor
          }
          nodes={appState.nodes}
          isReadOnly={isReadOnly}
          onClose={() => setInspectedActor(null)}
          onEdit={(actor) => {
            setInspectedActor(null);
            setActorLibraryState({
              open: true,
              editActorId: actor.id,
              pickForNodeId: activeEditNodeId,
            });
          }}
          onOpenNode={(nodeId) => {
            setInspectedActor(null);
            setActorLibraryState({ open: false });
            setActiveEditNodeId(nodeId);
          }}
        />
      )}

      {/* Column Video Selector Modal */}
      {videoSelectCol && activeNode && (
        <VideoSelectionModal
          videos={appState.globalVideos}
          columnTitle={videoSelectCol}
          onClose={() => setVideoSelectCol(null)}
          onConfirm={(videoId) => {
            const nextVideos = {
              ...activeNode.videos,
              [videoSelectCol]: { globalId: videoId, snapshots: [] },
            };
            handleUpdateNode(activeNode.id, { videos: nextVideos });
            setVideoSelectCol(null);
          }}
          onOpenVideoLib={() => {
            setVideoSelectCol(null);
            setGlobalVideoModalOpen(true);
          }}
        />
      )}

      {/* Video Player Modal with Timestamp Capture */}
      {videoPlayerCol && activeNode && activeNode.videos?.[videoPlayerCol] && (
        <VideoPlayerModal
          videoRef={activeNode.videos[videoPlayerCol]!}
          videoTitle={
            appState.globalVideos.find((g) => g.id === activeNode.videos[videoPlayerCol]?.globalId)
              ?.name || t('app.defaultVideoRef')
          }
          columnName={videoPlayerCol}
          onClose={() => setVideoPlayerCol(null)}
          onUpdateSnapshots={(snapshots) => {
            const col = videoPlayerCol;
            const updatedVideoRef = {
              ...activeNode.videos[col]!,
              snapshots,
            };
            const nextVideos = {
              ...activeNode.videos,
              [col]: updatedVideoRef,
            };
            handleUpdateNode(activeNode.id, { videos: nextVideos });
          }}
        />
      )}

      {/* Replace Image Choice Warning */}
      {replaceWarningTarget && (
        <ReplaceImageWarningModal
          onClose={() => setReplaceWarningTarget(null)}
          onConfirm={(option) => {
            const { nodeId, pendingUrl } = replaceWarningTarget;
            const node = appState.nodes[nodeId];
            if (node) {
              if (option === 'borrar_todo') {
                handleUpdateNode(nodeId, {
                  image: pendingUrl,
                  pins: [],
                  drawings: [],
                  pinCounter: 0,
                });
              } else {
                handleUpdateNode(nodeId, { image: pendingUrl });
              }
            }
            setReplaceWarningTarget(null);
          }}
        />
      )}
      {architectureModalOpen && (
        <div className="fixed inset-0 z-[80] bg-black/55 dark:bg-black/85 backdrop-blur-sm flex flex-col p-3 sm:p-5">
          <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-[#c3beb1] dark:border-neutral-700/80 bg-[#ebe7de] dark:bg-[#090b10] shadow-2xl">
            <div className="h-11 px-4 bg-[#e0dbd0] dark:bg-neutral-900 border-b border-[#c3beb1] dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-[#2b2924] dark:text-neutral-100 truncate">
                  {t('app.archDiagramTitle')}
                </span>
                <span className="hidden sm:inline text-[11px] font-mono text-cyan-700 dark:text-cyan-400">
                  /architecture-diagram.html
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="/architecture-diagram.html"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-[11px] font-semibold text-[#2b2924] dark:text-neutral-200 transition-colors"
                >
                  {t('app.openStandaloneTab')}
                </a>
                <button
                  onClick={() => setArchitectureModalOpen(false)}
                  className="px-2.5 py-1 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-[11px] font-semibold text-[#433f37] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
            <iframe
              src="/architecture-diagram.html"
              title={t('app.archIframeTitle')}
              className="w-full flex-1 border-0 bg-[#090b10]"
            />
          </div>
        </div>
      )}
      {apiKeyModalOpen && firebaseUser && (
        <ApiKeyConfigModal
          userName={currentUser.name}
          userEmail={currentUser.email}
          currentApiKey={userGeminiApiKey}
          onSaveKey={async (key) => {
            await saveUserGeminiApiKey(firebaseUser.uid, key);
          }}
          onDeleteKey={async () => {
            await deleteUserGeminiApiKey(firebaseUser.uid);
          }}
          onClose={() => setApiKeyModalOpen(false)}
        />
      )}

      {aiImageModalState && (
        <AiImagePromptModal
          mode={aiImageModalState.mode}
          targetKind={aiImageModalState.targetKind}
          sourceImageUrl={aiImageModalState.sourceImageUrl}
          defaultTitle={aiImageModalState.defaultTitle}
          userApiKey={userGeminiApiKey}
          applyButtonLabel={
            aiImageModalState.targetScope === 'library' && !aiImageModalState.applyToPickerNode
              ? aiImageModalState.targetKind === 'map'
                ? t('app.saveToMapLib')
                : t('app.saveToGallery')
              : aiImageModalState.targetKind === 'map'
              ? t('app.applyMap')
              : t('app.applyImage')
          }
          onApplyFile={async (file) => {
            if (aiImageModalState.targetScope === 'node' && aiImageModalState.nodeId) {
              await handleUploadNodeImage(
                aiImageModalState.nodeId,
                file,
                aiImageModalState.targetKind === 'map',
                true
              );
            } else {
              const folder = aiImageModalState.targetKind === 'map' ? 'maps' : 'images';
              await handleUploadLibraryImageFile(
                file,
                folder,
                aiImageModalState.applyToPickerNode ? aiImageModalState.nodeId : undefined
              );
              if (aiImageModalState.applyToPickerNode) {
                setGalleryModalState({ open: false, mode: 'images-manage' });
              }
            }
          }}
          onClose={() => setAiImageModalState(null)}
        />
      )}

      {sketchStudioNode && sketchStudioState && (
        <SketchStudioModal
          nodeTitle={sketchStudioNode.title}
          targetKind={sketchStudioState.targetKind}
          existingImageUrl={
            sketchStudioState.targetKind === 'map'
              ? sketchStudioNode.mapImage
              : sketchStudioNode.image
          }
          onClose={() => setSketchStudioState(null)}
          onSaveSketch={async (file) => {
            await handleUploadNodeImage(
              sketchStudioNode.id,
              file,
              sketchStudioState.targetKind === 'map',
              true
            );
          }}
        />
      )}

      {uploadError && (
        <div className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-xl bg-[#ebe7de] dark:bg-red-950/95 border border-red-600/50 dark:border-red-700/70 px-4 py-3 text-xs text-red-800 dark:text-red-200 shadow-2xl flex items-start justify-between gap-3">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-white font-bold shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
