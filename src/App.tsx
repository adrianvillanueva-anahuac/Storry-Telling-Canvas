import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AppState,
  Connection,
  GlobalVideo,
  ImageResource,
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
} from './services/firestoreService';
import { uploadImageToStorage } from './services/storageService';
import { Header } from './components/Header';
import { WorkflowNodeCard } from './components/WorkflowNodeCard';
import { CanvasTextCard } from './components/CanvasTextCard';
import { ConnectionLines } from './components/ConnectionLines';
import { LinePropertiesMenu } from './components/popovers/LinePropertiesMenu';
import { TextPropertiesMenu } from './components/popovers/TextPropertiesMenu';
import { AddTextModal } from './components/modals/AddTextModal';
import { LabelManagerModal } from './components/modals/LabelManagerModal';
import { DeleteWarningModal } from './components/modals/DeleteWarningModal';
import { ArchiveModal } from './components/modals/ArchiveModal';
import { GalleryModal } from './components/modals/GalleryModal';
import { GlobalVideoModal } from './components/modals/GlobalVideoModal';
import { VideoSelectionModal } from './components/modals/VideoSelectionModal';
import { VideoPlayerModal } from './components/modals/VideoPlayerModal';
import { NodeDashboardModal } from './components/modals/NodeDashboardModal';
import { PinningModal } from './components/modals/PinningModal';
import { MapViewerModal } from './components/modals/MapViewerModal';
import { ReplaceImageWarningModal } from './components/modals/ReplaceImageWarningModal';
import { AdminConsoleModal } from './components/modals/AdminConsoleModal';
import { DeploymentGuideModal } from './components/modals/DeploymentGuideModal';

export default function App() {
  // Authentication & Role
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    uid: '',
    name: 'Team Member',
    role: 'Viewer',
    email: '',
    isRegistered: false,
  });

  // Theme state
  const [isDark, setIsDark] = useState(true);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  // Firestore Real-Time Canvas Data
  const [appState, setAppState] = useState<AppState>({
    nodes: {},
    connections: [],
    texts: {},
    labels: {
      'lbl-1': { name: 'Act I - Sequence', color: '#0052cc' },
      'lbl-2': { name: 'Needs Review', color: '#ff5630' },
      'lbl-3': { name: 'Final Polish', color: '#36b37e' },
    },
    storedNodes: {},
    globalVideos: [],
  });

  // Users & Web Image DB from Firestore
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [imagesDbList, setImagesDbList] = useState<ImageResource[]>([]);

  // Zoom & Viewport
  const [zoom, setZoom] = useState(1);
  const currentZoomRef = useRef(1);
  const targetZoomRef = useRef(1);
  const zoomVelocityRef = useRef(0);
  const zoomRafRef = useRef<number | null>(null);
  const lastZoomFrameTimeRef = useRef<number>(0);
  const lastStateSyncTimeRef = useRef<number>(0);
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
  const [deploymentGuideOpen, setDeploymentGuideOpen] = useState(false);
  const [architectureModalOpen, setArchitectureModalOpen] = useState(false);
  const [activeEditNodeId, setActiveEditNodeId] = useState<string | null>(null);
  const [pinningNodeId, setPinningNodeId] = useState<string | null>(null);
  const [mapViewerNodeId, setMapViewerNodeId] = useState<string | null>(null);
  const [galleryModalState, setGalleryModalState] = useState<{
    open: boolean;
    mode: 'images-manage' | 'maps-manage' | 'images-picker' | 'maps-picker';
  }>({ open: false, mode: 'images-manage' });

  const [globalVideoModalOpen, setGlobalVideoModalOpen] = useState(false);
  const [videoSelectCol, setVideoSelectCol] = useState<'enfoque' | 'accion' | 'descripcion' | null>(null);
  const [videoPlayerCol, setVideoPlayerCol] = useState<'enfoque' | 'accion' | 'descripcion' | null>(null);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [addTextModalState, setAddTextModalState] = useState<{
    open: boolean;
    type: 'floating' | 'container' | 'annotation';
  }>({ open: false, type: 'floating' });
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [deleteWarningNodeId, setDeleteWarningNodeId] = useState<string | null>(null);
  const [replaceWarningTarget, setReplaceWarningTarget] = useState<{
    nodeId: string;
    pendingUrl: string | null;
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

  // Active Dragging & Port Connection
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

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
    childrenOffsets: { id: string; type: 'node' | 'text'; startX: number; startY: number }[];
  } | null>(null);

  const [tempConnection, setTempConnection] = useState<{
    sourceId: string;
    sourcePort: 'top' | 'bottom' | 'left' | 'right';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Test Firestore Connection on Boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Firebase Auth Listener & Live Role Sync
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setFirebaseUser(fbUser);
      setAuthReady(true);

      if (fbUser) {
        const normalizedEmail = (fbUser.email || '').toLowerCase();
        const isSuperAdmin = normalizedEmail === 'adrian.byakko@gmail.com';
        setCurrentUser({
          uid: fbUser.uid,
          name: fbUser.displayName || 'Team Member',
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
      } else {
        setCurrentUser({
          uid: '',
          name: 'Team Member',
          role: 'Viewer',
          email: '',
          isRegistered: false,
        });
        setProjects([]);
        setActiveProjectId('');
        setUsersList([]);
        setImagesDbList([]);
      }
    });

    return () => {
      if (unsubProfile) unsubProfile();
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
          'Act I: The Citadel Sequence',
          'Cinematic arrival sequence and initial council assembly.',
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
      setAppState((prev) => ({
        ...prev,
        nodes: data.nodes,
        connections: data.connections,
        texts: data.texts,
        storedNodes: data.storedNodes,
      }));
    });

    return () => unsubCanvas();
  }, [authReady, firebaseUser, activeProjectId]);

  // Subscribe to Web Image Database (Authenticated only)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const unsubImages = subscribeAllImages((imgs) => setImagesDbList(imgs));
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

  // Subscribe to Users Collection (Admin only)
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

  const stopZoomAnimation = useCallback(() => {
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
    zoomVelocityRef.current = 0;
    zoomAnchorRef.current = null;
    targetZoomRef.current = currentZoomRef.current;
  }, []);

  const applyZoomImmediate = useCallback(
    (newZoom: number, nextScrollLeft?: number, nextScrollTop?: number) => {
      stopZoomAnimation();
      const clamped = Math.max(0.2, Math.min(newZoom, 3.0));
      currentZoomRef.current = clamped;
      targetZoomRef.current = clamped;
      if (canvasRef.current) {
        canvasRef.current.style.transform = `scale(${clamped})`;
      }
      if (viewportRef.current) {
        if (typeof nextScrollLeft === 'number') viewportRef.current.scrollLeft = nextScrollLeft;
        if (typeof nextScrollTop === 'number') viewportRef.current.scrollTop = nextScrollTop;
      }
      setZoom(clamped);
    },
    [stopZoomAnimation]
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

  // Smooth spring-damped zoom animation loop (acceleration & deceleration)
  const stepZoomAnimation = useCallback((now: number) => {
    const dt = lastZoomFrameTimeRef.current
      ? Math.max(0.001, Math.min((now - lastZoomFrameTimeRef.current) / 1000, 0.05))
      : 1 / 60;
    lastZoomFrameTimeRef.current = now;

    const prevZoom = currentZoomRef.current;
    const target = targetZoomRef.current;

    // Second-order critically damped spring for progressive acceleration & smooth deceleration
    const stiffness = 170;
    const damping = 26;
    const force = (target - prevZoom) * stiffness;
    let vel = (zoomVelocityRef.current + force * dt) * Math.exp(-damping * dt);
    let nextZoom = prevZoom + vel * dt;

    if (nextZoom <= 0.2) {
      nextZoom = 0.2;
      if (vel < 0) vel = 0;
    } else if (nextZoom >= 3.0) {
      nextZoom = 3.0;
      if (vel > 0) vel = 0;
    }

    const settled = Math.abs(target - nextZoom) < 0.0005 && Math.abs(vel) < 0.0005;
    if (settled) {
      nextZoom = target;
      vel = 0;
    }

    currentZoomRef.current = nextZoom;
    zoomVelocityRef.current = vel;

    const vp = viewportRef.current;
    const canvas = canvasRef.current;
    const anchor = zoomAnchorRef.current;

    if (canvas) {
      canvas.style.transform = `scale(${nextZoom})`;
    }
    if (vp && anchor) {
      vp.scrollLeft = anchor.canvasX * nextZoom - anchor.mouseX;
      vp.scrollTop = anchor.canvasY * nextZoom - anchor.mouseY;
    }

    if (settled || now - lastStateSyncTimeRef.current >= 60) {
      lastStateSyncTimeRef.current = now;
      setZoom(nextZoom);
    }

    if (settled) {
      zoomRafRef.current = null;
      zoomAnchorRef.current = null;
    } else {
      zoomRafRef.current = requestAnimationFrame(stepZoomAnimation);
    }
  }, []);

  // Non-passive wheel listener so preventDefault works cleanly without scroll jumps
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();

      const rect = vp.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevAnchor = zoomAnchorRef.current;
      if (
        zoomRafRef.current === null ||
        !prevAnchor ||
        Math.abs(mouseX - prevAnchor.mouseX) > 0.5 ||
        Math.abs(mouseY - prevAnchor.mouseY) > 0.5
      ) {
        const z = currentZoomRef.current;
        zoomAnchorRef.current = {
          mouseX,
          mouseY,
          canvasX: (vp.scrollLeft + mouseX) / z,
          canvasY: (vp.scrollTop + mouseY) / z,
        };
      }

      let normalizedDelta = e.deltaY;
      if (e.deltaMode === 1) normalizedDelta *= 16;
      else if (e.deltaMode === 2) normalizedDelta *= 400;
      normalizedDelta = Math.max(-240, Math.min(240, normalizedDelta));

      const zoomFactor = Math.exp(-normalizedDelta * 0.0015);
      targetZoomRef.current = Math.max(0.2, Math.min(targetZoomRef.current * zoomFactor, 3.0));

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

  // Background Canvas Panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.workflow-node')) return;
    if ((e.target as HTMLElement).closest('.canvas-text-node')) return;
    if ((e.target as HTMLElement).closest('.port')) return;
    if (e.button !== 0 && e.button !== 1) return;

    if (!viewportRef.current) return;
    stopZoomAnimation();
    setIsPanningCanvas(true);
    setPanStart({
      x: e.pageX - viewportRef.current.offsetLeft,
      y: e.pageY - viewportRef.current.offsetTop,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    });

    setActiveLinePopover(null);
    setActiveTextPopover(null);
  };

  // Node & Text Dragging Mouse Events
  const handleNodeOrTextMouseDown = (
    id: string,
    type: 'node' | 'text',
    e: React.MouseEvent
  ) => {
    if (isReadOnly) return;
    if ((e.target as HTMLElement).closest('.port')) return;
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('input')) return;
    if ((e.target as HTMLElement).closest('textarea')) return;

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const currentX =
      type === 'node'
        ? parseFloat(appState.nodes[id]?.x || '0')
        : parseFloat(appState.texts[id]?.x || '0');
    const currentY =
      type === 'node'
        ? parseFloat(appState.nodes[id]?.y || '0')
        : parseFloat(appState.texts[id]?.y || '0');

    let childrenOffsets: { id: string; type: 'node' | 'text'; startX: number; startY: number }[] = [];
    if (type === 'text' && appState.texts[id]?.mode === 'container') {
      Object.values(appState.nodes).forEach((n) => {
        if (n.containerId === id) {
          childrenOffsets.push({
            id: n.id,
            type: 'node',
            startX: parseFloat(n.x) || 0,
            startY: parseFloat(n.y) || 0,
          });
        }
      });
      Object.values(appState.texts).forEach((t) => {
        if (t.containerId === id && t.id !== id) {
          childrenOffsets.push({
            id: t.id,
            type: 'text',
            startX: parseFloat(t.x) || 0,
            startY: parseFloat(t.y) || 0,
          });
        }
      });
    }

    const parentCid =
      type === 'node' ? appState.nodes[id]?.containerId : appState.texts[id]?.containerId;
    if (parentCid && appState.texts[parentCid]) {
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
      childrenOffsets,
    });

    setActiveLinePopover(null);
  };

  // Global Mouse Move
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (isPanningCanvas && viewportRef.current) {
      const x = e.pageX - viewportRef.current.offsetLeft;
      const y = e.pageY - viewportRef.current.offsetTop;
      viewportRef.current.scrollLeft = panStart.scrollLeft - (x - panStart.x) * 1.3;
      viewportRef.current.scrollTop = panStart.scrollTop - (y - panStart.y) * 1.3;
      return;
    }

    if (tempConnection && canvasRef.current) {
      const cRect = canvasRef.current.getBoundingClientRect();
      const liveZoom = currentZoomRef.current;
      setTempConnection({
        ...tempConnection,
        currentX: (e.clientX - cRect.left) / liveZoom,
        currentY: (e.clientY - cRect.top) / liveZoom,
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

          nextState.nodes[activeDragElement.id] = {
            ...node,
            x: `${finalX}px`,
            y: `${finalY}px`,
          };
        }
      } else {
        const textEl = nextState.texts[activeDragElement.id];
        if (textEl) {
          const isContainerSelf = textEl.mode === 'container';
          const elW = textEl.width || 220;
          const elH = textEl.height || 100;

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

      if (activeDragElement.childrenOffsets.length > 0) {
        activeDragElement.childrenOffsets.forEach((child) => {
          const childX = `${child.startX + deltaX}px`;
          const childY = `${child.startY + deltaY}px`;
          if (child.type === 'node' && nextState.nodes[child.id]) {
            nextState.nodes[child.id] = { ...nextState.nodes[child.id], x: childX, y: childY };
          } else if (child.type === 'text' && nextState.texts[child.id]) {
            nextState.texts[child.id] = { ...nextState.texts[child.id], x: childX, y: childY };
          }
        });
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

  // Global Mouse Up & Firestore Sync
  const handleGlobalMouseUp = (e: React.MouseEvent) => {
    if (isPanningCanvas) {
      setIsPanningCanvas(false);
    }

    if (tempConnection && activeProjectId) {
      const targetPortEl = ((e.target as HTMLElement).closest('.port') || (e.target as HTMLElement).closest('[data-port]')) as HTMLElement | null;
      if (targetPortEl) {
        const targetNodeId = targetPortEl.getAttribute('data-node');
        const targetPort = targetPortEl.getAttribute('data-port') as 'top' | 'bottom' | 'left' | 'right';

        if (targetNodeId && targetPort && targetNodeId !== tempConnection.sourceId) {
          const newConn: Connection = {
            id: `conn-${Date.now()}`,
            projectId: activeProjectId,
            source: tempConnection.sourceId,
            sourcePort: tempConnection.sourcePort,
            target: targetNodeId,
            targetPort: targetPort,
            type: 'curve',
            style: 'solid',
            color: '#0052cc',
            label: '',
            arrows: 'end',
          };

          saveConnectionToFirestore(activeProjectId, newConn);
        }
      }
      setTempConnection(null);
    }

    if (activeDragElement && activeProjectId) {
      const el = activeDragElement;
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
      dragStartContainerBoundsRef.current = null;
      setAppState(boundedState);
      setHoveredDropContainerId(null);
      setActiveDragElement(null);
    }
  };

  // Node CRUD in Firestore
  const handleAddNode = () => {
    if (!activeProjectId) return;
    const nextNum = Object.keys(appState.nodes).length + 1;
    const nodeId = `node-${Date.now()}`;

    const centerX = viewportRef.current
      ? (viewportRef.current.scrollLeft + viewportRef.current.clientWidth / 2) / currentZoomRef.current - 110
      : 2400;
    const centerY = viewportRef.current
      ? (viewportRef.current.scrollTop + viewportRef.current.clientHeight / 2) / currentZoomRef.current - 80
      : 2400;

    const newNode: WorkflowNode = {
      id: nodeId,
      projectId: activeProjectId,
      x: `${centerX}px`,
      y: `${centerY}px`,
      title: `Scene ${nextNum}: New Beat`,
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

    saveNodeToFirestore(activeProjectId, newNode);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    if (!activeProjectId) return;
    const curr = appState.nodes[nodeId];
    if (!curr) return;

    const normalizedUpdates: Partial<WorkflowNode> = { ...updates };
    if ('image' in updates && updates.image) {
      normalizedUpdates.imageDeletedFromAdmin = false;
    }
    if ('mapImage' in updates && updates.mapImage) {
      normalizedUpdates.mapImageDeletedFromAdmin = false;
    }

    const updatedNode = { ...curr, ...normalizedUpdates };
    setAppState((prev) => ({
      ...prev,
      nodes: {
        ...prev.nodes,
        [nodeId]: updatedNode,
      },
    }));
    saveNodeToFirestore(activeProjectId, updatedNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeProjectId) return;
    deleteNodeFromFirestore(activeProjectId, nodeId);
    appState.connections
      .filter((c) => c.source === nodeId || c.target === nodeId)
      .forEach((c) => deleteConnectionFromFirestore(activeProjectId, c.id));
    setDeleteWarningNodeId(null);
    if (activeEditNodeId === nodeId) {
      setActiveEditNodeId(null);
    }
  };

  const handleArchiveNode = (nodeId: string) => {
    if (!activeProjectId) return;
    const node = appState.nodes[nodeId];
    if (!node) return;

    archiveNodeInFirestore(activeProjectId, {
      ...node,
      storedAt: new Date().toLocaleString(),
      storedBy: currentUser.name,
      storeNote: '',
    });
    setDeleteWarningNodeId(null);
    if (activeEditNodeId === nodeId) {
      setActiveEditNodeId(null);
    }
  };

  const handleDeleteImageRecords = async (imgIds: string[]) => {
    if (imgIds.length === 0) return;
    const targets = imagesDbList.filter((img) => imgIds.includes(img.id));
    const deletedUrls = targets.map((img) => img.url).filter(Boolean);

    const hasUnassigned = targets.some((img) => !img.projectId);
    const affectedProjectIds = hasUnassigned
      ? projects.map((p) => p.id)
      : Array.from(
          new Set([
            ...targets.map((img) => img.projectId).filter((pid): pid is string => Boolean(pid)),
            ...(activeProjectId ? [activeProjectId] : []),
          ])
        );

    for (const id of imgIds) {
      const target = targets.find((img) => img.id === id);
      await deleteImageFromDb(id, target?.url || target?.storagePath);
    }

    if (deletedUrls.length > 0 && affectedProjectIds.length > 0) {
      const urlSet = new Set(deletedUrls);
      setAppState((prev) => {
        let changed = false;
        const nextNodes = { ...prev.nodes };
        Object.entries(nextNodes).forEach(([id, n]) => {
          const hitMain = Boolean(n.image && urlSet.has(n.image));
          const hitMap = Boolean(n.mapImage && urlSet.has(n.mapImage));
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

      await clearDeletedImagesFromProjectNodes(deletedUrls, affectedProjectIds);
    }
  };

  // Text Elements CRUD in Firestore
  const handleAddText = (type: 'floating' | 'container' | 'annotation', text: string) => {
    if (!activeProjectId) return;
    const textId = `text-${Date.now()}`;
    const centerX = viewportRef.current
      ? (viewportRef.current.scrollLeft + viewportRef.current.clientWidth / 2) / currentZoomRef.current - 100
      : 2400;
    const centerY = viewportRef.current
      ? (viewportRef.current.scrollTop + viewportRef.current.clientHeight / 2) / currentZoomRef.current - 50
      : 2400;

    const newElement: TextElement = {
      id: textId,
      projectId: activeProjectId,
      x: `${centerX}px`,
      y: `${centerY}px`,
      text,
      mode: type,
      color: type === 'floating' ? '#e2e8f0' : '#0052cc',
      size: type === 'floating' ? 24 : 14,
      bold: type === 'container',
      italic: false,
      labelId: '',
      width: type === 'container' ? 400 : undefined,
      height: type === 'container' ? 260 : undefined,
    };

    saveTextToFirestore(activeProjectId, newElement);
    setAddTextModalState({ open: false, type: 'floating' });
  };

  const handleUpdateText = (textId: string, updates: Partial<TextElement>) => {
    if (!activeProjectId) return;
    const curr = appState.texts[textId];
    if (!curr) return;

    const updatedText = { ...curr, ...updates };
    saveTextToFirestore(activeProjectId, updatedText);
  };

  const handleUnlinkNode = (nodeId: string) => {
    if (!activeProjectId) return;
    const curr = appState.nodes[nodeId];
    if (!curr) return;

    if (curr.containerId) {
      pendingExitContainerRef.current[nodeId] = curr.containerId;
    }

    const updatedNode = { ...curr, containerId: null };
    const nextState: AppState = {
      ...appState,
      nodes: {
        ...appState.nodes,
        [nodeId]: updatedNode,
      },
    };
    saveNodeToFirestore(activeProjectId, updatedNode);
    const boundedState = updateContainerBounds(nextState);
    setAppState(boundedState);
  };

  const handleUnlinkText = (textId: string) => {
    if (!activeProjectId) return;
    const curr = appState.texts[textId];
    if (!curr) return;

    if (curr.containerId) {
      pendingExitContainerRef.current[textId] = curr.containerId;
    }

    const updatedText = { ...curr, containerId: null };
    const nextState: AppState = {
      ...appState,
      texts: {
        ...appState.texts,
        [textId]: updatedText,
      },
    };
    saveTextToFirestore(activeProjectId, updatedText);
    const boundedState = updateContainerBounds(nextState);
    setAppState(boundedState);
  };

  const handleDeleteText = (textId: string) => {
    if (!activeProjectId) return;
    deleteTextFromFirestore(activeProjectId, textId);
  };

  // Vercel Blob Upload & Registry in Firestore (No Base64 in documents)
  const handleUploadNodeImage = async (nodeId: string, file: File, isMap = false) => {
    if (!activeProjectId) return;
    const folder = isMap ? 'maps' : 'images';
    setUploadError(null);
    setIsUploadingMedia(true);
    try {
      // 1. Upload file directly to Vercel Blob Storage
      const res = await uploadImageToStorage(file, folder);

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
        if (curr?.image) {
          setReplaceWarningTarget({ nodeId, pendingUrl: res.url });
        } else {
          handleUpdateNode(nodeId, { image: res.url });
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image.');
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
      setUploadError(err instanceof Error ? err.message : 'Failed to upload gallery assets.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const activeNode = activeEditNodeId
    ? appState.nodes[activeEditNodeId] || appState.storedNodes[activeEditNodeId]
    : null;
  const pinningNode = pinningNodeId ? appState.nodes[pinningNodeId] : null;
  const mapViewerNode = mapViewerNodeId ? appState.nodes[mapViewerNodeId] : null;
  const activeConn = activeLinePopover
    ? appState.connections.find((c) => c.id === activeLinePopover.connectionId)
    : null;
  const activeTextEl = activeTextPopover
    ? appState.texts[activeTextPopover.elementId]
    : null;

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
          : 'Google sign-in failed. Verify this domain is authorized in Firebase Authentication.'
      );
    }
  };

  if (!authReady) {
    return (
      <div className="w-screen h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs text-neutral-400">Connecting to workspace...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="w-screen h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-7 shadow-2xl text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center font-bold text-lg">
            VW
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold tracking-tight text-neutral-100">
              Visual Workflow Canvas
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Sign in with your Google account to access shared storyboard projects, real-time nodes, and cloud media assets.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-xs text-red-300 text-left break-words">
              {authError}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex flex-col ${
        isDark ? 'dark bg-neutral-950 text-neutral-100' : 'light bg-neutral-100 text-neutral-900'
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
        isDark={isDark}
        onToggleDark={() => setIsDark(!isDark)}
        onSelectProject={(pId) => {
          setActiveProjectId(pId);
          setTimeout(() => centerCanvas(), 150);
        }}
        onOpenAdminConsole={() => setAdminConsoleOpen(true)}
        onOpenDeploymentGuide={() => setDeploymentGuideOpen(true)}
        onOpenArchitecture={() => setArchitectureModalOpen(true)}
        onOpenGallery={(mode) => setGalleryModalState({ open: true, mode })}
        onOpenVideoLib={() => setGlobalVideoModalOpen(true)}
        onOpenArchive={() => setArchiveModalOpen(true)}
        onAddNode={handleAddNode}
        onOpenAddText={(type) => setAddTextModalState({ open: true, type })}
        onZoomChange={(type) => {
          if (type === '100') {
            if (viewportRef.current) {
              const vp = viewportRef.current;
              const cx = vp.clientWidth / 2;
              const cy = vp.clientHeight / 2;
              const prevZ = currentZoomRef.current;
              const canvasX = (vp.scrollLeft + cx) / prevZ;
              const canvasY = (vp.scrollTop + cy) / prevZ;
              applyZoomImmediate(1, canvasX - cx, canvasY - cy);
            } else {
              applyZoomImmediate(1);
            }
          }
          if (type === 'center') centerCanvas();
          if (type === 'fit') fitAllNodes();
        }}
        onSignInGoogle={handleGoogleLogin}
        onSignOut={() => logOut()}
      />

      {/* Infinite Canvas Viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleGlobalMouseMove}
        onMouseUp={handleGlobalMouseUp}
        className="flex-1 w-full h-full overflow-hidden relative cursor-default select-none"
      >
        <div
          ref={canvasRef}
          style={{
            width: 5000,
            height: 5000,
            transform: `scale(${currentZoomRef.current})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
          className="absolute inset-0 canvas-grid"
        >
          {/* SVG Connection Layer */}
          <ConnectionLines
            connections={appState.connections}
            nodes={appState.nodes}
            tempConnection={tempConnection}
            onClickConnection={(connectionId, x, y) => {
              setActiveLinePopover({ connectionId, x, y });
            }}
          />

          {/* Grouping Containers and Text Elements */}
          {Object.values(appState.texts).map((element) => (
            <div
              key={element.id}
              onMouseDown={(e) => handleNodeOrTextMouseDown(element.id, 'text', e)}
            >
              <CanvasTextCard
                element={element}
                label={element.labelId ? appState.labels[element.labelId] : undefined}
                isReadOnly={isReadOnly}
                isDropTarget={element.mode === 'container' && hoveredDropContainerId === element.id}
                onOpenSettings={(id, e) => {
                  setActiveTextPopover({ elementId: id, x: e.clientX, y: e.clientY });
                }}
                onDelete={handleDeleteText}
                onUnlink={handleUnlinkText}
                onUpdateText={handleUpdateText}
              />
            </div>
          ))}

          {/* Interactive Workflow Scene Nodes */}
          {Object.values(appState.nodes).map((node) => (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeOrTextMouseDown(node.id, 'node', e)}
            >
              <WorkflowNodeCard
                node={node}
                isReadOnly={isReadOnly}
                isHoveringContainer={
                  activeDragElement?.type === 'node' &&
                  activeDragElement.id === node.id &&
                  Boolean(hoveredDropContainerId)
                }
                onStartPortDrag={(nodeId, port, e) => {
                  if (!canvasRef.current) return;
                  const cRect = canvasRef.current.getBoundingClientRect();
                  const startX = (e.clientX - cRect.left) / currentZoomRef.current;
                  const startY = (e.clientY - cRect.top) / currentZoomRef.current;
                  setTempConnection({
                    sourceId: nodeId,
                    sourcePort: port,
                    startX,
                    startY,
                    currentX: startX,
                    currentY: startY,
                  });
                }}
                onOpenDashboard={(id) => setActiveEditNodeId(id)}
                onDeleteRequest={(id) => setDeleteWarningNodeId(id)}
                onUnlinkContainer={handleUnlinkNode}
                onUpdateTitle={(id, title) => handleUpdateNode(id, { title })}
                onImagePaste={(id, file) => handleUploadNodeImage(id, file)}
              />
            </div>
          ))}
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
              saveConnectionToFirestore(activeProjectId, { ...activeConn, ...updates });
            }
          }}
          onDelete={() => {
            if (activeProjectId) {
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

      {/* Deployment to Firebase Hosting Guide Modal */}
      {deploymentGuideOpen && (
        <DeploymentGuideModal
          projectId="massive-artwork-d07pf"
          onClose={() => setDeploymentGuideOpen(false)}
        />
      )}

      {/* Node Dashboard Modal */}
      {activeNode && (
        <NodeDashboardModal
          node={activeNode}
          globalVideos={appState.globalVideos}
          isReadOnly={isReadOnly}
          isArchived={Boolean(activeEditNodeId && appState.storedNodes[activeEditNodeId])}
          currentUserName={currentUser.name}
          onClose={() => setActiveEditNodeId(null)}
          onUpdateNode={handleUpdateNode}
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
          onOpenAddVideoToColumn={(col) => setVideoSelectCol(col)}
          onOpenVideoPlayer={(col) => setVideoPlayerCol(col)}
          onUploadMainImage={(file) => handleUploadNodeImage(activeNode.id, file, false)}
          onUploadMapImage={(file) => handleUploadNodeImage(activeNode.id, file, true)}
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

      {/* Add Text Dialog */}
      {addTextModalState.open && (
        <AddTextModal
          initialType={addTextModalState.type}
          onClose={() => setAddTextModalState({ open: false, type: 'floating' })}
          onConfirm={handleAddText}
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

      {/* Stored Nodes Archive Modal */}
      {archiveModalOpen && (
        <ArchiveModal
          storedNodes={appState.storedNodes}
          onClose={() => setArchiveModalOpen(false)}
          onRestore={(id) => {
            if (!activeProjectId) return;
            const restored = appState.storedNodes[id];
            if (restored) {
              restoreNodeInFirestore(activeProjectId, restored);
            }
          }}
          onView={(id) => {
            setActiveEditNodeId(id);
            setArchiveModalOpen(false);
          }}
          onDeleteSingle={(id) => {
            if (activeProjectId) {
              deleteStoredNodeFromFirestore(activeProjectId, id);
            }
          }}
          onDeleteAll={() => {
            if (confirm('Permanently delete all archived scenes in this project?')) {
              Object.keys(appState.storedNodes).forEach((id) => {
                if (activeProjectId) {
                  deleteStoredNodeFromFirestore(activeProjectId, id);
                }
              });
            }
          }}
          onUpdateNote={(id, note) => {
            if (!activeProjectId) return;
            updateStoredNodeNoteInFirestore(activeProjectId, id, note);
          }}
        />
      )}

      {/* Category Label Manager Modal */}
      {labelManagerOpen && (
        <LabelManagerModal
          labels={appState.labels}
          onClose={() => setLabelManagerOpen(false)}
          onAddLabel={(name, color) => {
            const id = `lbl-${Date.now()}`;
            setAppState((prev) => ({
              ...prev,
              labels: { ...prev.labels, [id]: { name, color } },
            }));
          }}
          onDeleteLabel={(id) => {
            setAppState((prev) => {
              const nextLabels = { ...prev.labels };
              delete nextLabels[id];
              return { ...prev, labels: nextLabels };
            });
          }}
        />
      )}

      {/* Gallery Modal (Images & Maps scoped to active project) */}
      {galleryModalState.open && (
        <GalleryModal
          mode={galleryModalState.mode}
          projectTitle={activeProject?.title}
          isReadOnly={isReadOnly}
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
          onSelectImage={(url) => {
            if (activeEditNodeId) {
              if (galleryModalState.mode === 'maps-picker') {
                handleUpdateNode(activeEditNodeId, { mapImage: url, mapName: 'Picked Map' });
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
              ?.name || 'Video Reference'
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
        <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex flex-col p-3 sm:p-5">
          <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-neutral-700/80 bg-[#090b10] shadow-2xl">
            <div className="h-11 px-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-neutral-100 truncate">
                  Application Architecture Diagram
                </span>
                <span className="hidden sm:inline text-[11px] font-mono text-cyan-400">
                  /architecture-diagram.html
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="/architecture-diagram.html"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[11px] font-semibold text-neutral-200 transition-colors"
                >
                  Open Standalone Tab
                </a>
                <button
                  onClick={() => setArchitectureModalOpen(false)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[11px] font-semibold text-neutral-300 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              src="/architecture-diagram.html"
              title="Visual Workflow Canvas Interactive Architecture Diagram"
              className="w-full flex-1 border-0 bg-[#090b10]"
            />
          </div>
        </div>
      )}
      {uploadError && (
        <div className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-xl bg-red-950/95 border border-red-700/70 px-4 py-3 text-xs text-red-200 shadow-2xl flex items-start justify-between gap-3">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-300 hover:text-white font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
