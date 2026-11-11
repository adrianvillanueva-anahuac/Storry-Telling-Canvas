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
} from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
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
  updateUserRole,
  inviteUserByEmail,
  subscribeImages,
  registerImageInDb,
  deleteImageFromDb,
  subscribeGlobalVideos,
  addGlobalVideoDoc,
  deleteGlobalVideoDoc,
} from './services/firestoreService';
import { uploadImageApi } from './services/api';
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

export default function App() {
  // Authentication & Role
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    uid: 'admin-default',
    name: 'Adrian (Lead Admin)',
    role: 'Admin',
    email: 'adrian.byakko@gmail.com',
    isRegistered: true,
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Modals & Panels
  const [adminConsoleOpen, setAdminConsoleOpen] = useState(false);
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

  // Firebase Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const isSuperAdmin = fbUser.email === 'adrian.byakko@gmail.com';
        setCurrentUser({
          uid: fbUser.uid,
          name: fbUser.displayName || 'Team Member',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || '',
          role: isSuperAdmin ? 'Admin' : 'Editor',
          isRegistered: true,
        });
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to Projects Collection in Firestore
  useEffect(() => {
    const unsub = subscribeProjects((projList) => {
      setProjects(projList);
      if (projList.length === 0) {
        // Automatically seed first project if database is empty
        createProject(
          'Act I: The Citadel Sequence',
          'Cinematic arrival sequence and initial council assembly.',
          currentUser.uid || 'admin'
        ).then((newId) => {
          setActiveProjectId(newId);
          setTimeout(() => centerCanvas(), 200);
        });
      } else if (!activeProjectId || !projList.some((p) => p.id === activeProjectId)) {
        setActiveProjectId(projList[0].id);
        setTimeout(() => centerCanvas(), 200);
      }
    });

    return () => unsub();
  }, [activeProjectId]);

  // Subscribe to Real-Time Canvas Subcollections for the Active Project
  useEffect(() => {
    if (!activeProjectId) return;

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
  }, [activeProjectId]);

  // Subscribe to Users & Web Image Database
  useEffect(() => {
    const unsubUsers = subscribeUsers((users) => setUsersList(users));
    const unsubImages = subscribeImages('images', (imgs) => setImagesDbList(imgs));
    const unsubVideos = subscribeGlobalVideos((vids) => {
      setAppState((prev) => ({ ...prev, globalVideos: vids }));
    });

    return () => {
      unsubUsers();
      unsubImages();
      unsubVideos();
    };
  }, []);

  // Update Container Bounds dynamically
  const updateContainerBounds = useCallback(
    (state: AppState): AppState => {
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
              const nh = 175;

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
            const newX = `${minX - 35}px`;
            const newY = `${minY - 50}px`;
            const newW = maxX - minX + 70;
            const newH = maxY - minY + 85;

            if (
              textEl.x !== newX ||
              textEl.y !== newY ||
              textEl.width !== newW ||
              textEl.height !== newH
            ) {
              hasChanges = true;
              updatedTexts[tid] = {
                ...textEl,
                x: newX,
                y: newY,
                width: newW,
                height: newH,
              };

              // Sync updated container bounds to Firestore
              if (activeProjectId) {
                saveTextToFirestore(activeProjectId, updatedTexts[tid]);
              }
            }
          }
        }
      });

      return hasChanges ? { ...state, texts: updatedTexts } : state;
    },
    [activeProjectId]
  );

  // Viewport helper functions
  const centerCanvas = () => {
    setZoom(1);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 2500 - viewportRef.current.clientWidth / 2;
      viewportRef.current.scrollTop = 2500 - viewportRef.current.clientHeight / 2;
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

      setZoom(newZoom);
      const centerX = minX + width / 2;
      const centerY = minY + height / 2;

      viewportRef.current.scrollLeft = centerX * newZoom - viewW / 2;
      viewportRef.current.scrollTop = centerY * newZoom - viewH / 2;
    }
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return;
    if (!viewportRef.current) return;

    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (viewportRef.current.scrollLeft + mouseX) / zoom;
    const canvasY = (viewportRef.current.scrollTop + mouseY) / zoom;

    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const newZoom = Math.max(0.2, Math.min(zoom + delta, 3.0));

    setZoom(newZoom);

    viewportRef.current.scrollLeft = canvasX * newZoom - mouseX;
    viewportRef.current.scrollTop = canvasY * newZoom - mouseY;

    setActiveLinePopover(null);
  };

  // Background Canvas Panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.workflow-node')) return;
    if ((e.target as HTMLElement).closest('.canvas-text-node')) return;
    if ((e.target as HTMLElement).closest('.port')) return;
    if (e.button !== 0 && e.button !== 1) return;

    if (!viewportRef.current) return;
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
    if (currentUser.role === 'Viewer') return;
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

    setActiveDragElement({
      id,
      type,
      startX: currentX,
      startY: currentY,
      initialMouseX: (e.clientX - canvasRect.left) / zoom,
      initialMouseY: (e.clientY - canvasRect.top) / zoom,
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
      setTempConnection({
        ...tempConnection,
        currentX: (e.clientX - cRect.left) / zoom,
        currentY: (e.clientY - cRect.top) / zoom,
      });
      return;
    }

    if (activeDragElement && canvasRef.current) {
      const cRect = canvasRef.current.getBoundingClientRect();
      const mouseCanvasX = (e.clientX - cRect.left) / zoom;
      const mouseCanvasY = (e.clientY - cRect.top) / zoom;

      const deltaX = mouseCanvasX - activeDragElement.initialMouseX;
      const deltaY = mouseCanvasY - activeDragElement.initialMouseY;

      const newX = `${activeDragElement.startX + deltaX}px`;
      const newY = `${activeDragElement.startY + deltaY}px`;

      let nextState = { ...appState };

      if (activeDragElement.type === 'node') {
        const node = nextState.nodes[activeDragElement.id];
        if (node) {
          nextState.nodes = {
            ...nextState.nodes,
            [activeDragElement.id]: { ...node, x: newX, y: newY },
          };
        }
      } else {
        const textEl = nextState.texts[activeDragElement.id];
        if (textEl) {
          nextState.texts = {
            ...nextState.texts,
            [activeDragElement.id]: { ...textEl, x: newX, y: newY },
          };
        }
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

      setAppState(nextState);
    }
  };

  // Global Mouse Up & Firestore Sync
  const handleGlobalMouseUp = (e: React.MouseEvent) => {
    if (isPanningCanvas) {
      setIsPanningCanvas(false);
    }

    if (tempConnection && activeProjectId) {
      const targetPortEl = (e.target as HTMLElement).closest('.port') as HTMLElement | null;
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
      let nextState = { ...appState };

      const elX =
        el.type === 'node'
          ? parseFloat(nextState.nodes[el.id]?.x || '0')
          : parseFloat(nextState.texts[el.id]?.x || '0');
      const elY =
        el.type === 'node'
          ? parseFloat(nextState.nodes[el.id]?.y || '0')
          : parseFloat(nextState.texts[el.id]?.y || '0');

      let droppedContainerId: string | null = null;
      Object.entries(nextState.texts).forEach(([tid, textEl]) => {
        if (textEl.mode === 'container' && tid !== el.id) {
          const tx = parseFloat(textEl.x) || 0;
          const ty = parseFloat(textEl.y) || 0;
          const tw = textEl.width || 340;
          const th = textEl.height || 240;

          if (elX >= tx && elX <= tx + tw && elY >= ty && elY <= ty + th) {
            droppedContainerId = tid;
          }
        }
      });

      if (el.type === 'node' && nextState.nodes[el.id]) {
        const updatedNode = { ...nextState.nodes[el.id], containerId: droppedContainerId };
        saveNodeToFirestore(activeProjectId, updatedNode);
      } else if (el.type === 'text' && nextState.texts[el.id]) {
        const updatedText = { ...nextState.texts[el.id], containerId: droppedContainerId };
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

      updateContainerBounds(nextState);
      setActiveDragElement(null);
    }
  };

  // Node CRUD in Firestore
  const handleAddNode = () => {
    if (!activeProjectId) return;
    const nextNum = Object.keys(appState.nodes).length + 1;
    const nodeId = `node-${Date.now()}`;

    const centerX = viewportRef.current
      ? (viewportRef.current.scrollLeft + viewportRef.current.clientWidth / 2) / zoom - 110
      : 2400;
    const centerY = viewportRef.current
      ? (viewportRef.current.scrollTop + viewportRef.current.clientHeight / 2) / zoom - 80
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
      drawings: [],
      mapDrawings: [],
      videos: { enfoque: null, accion: null, descripcion: null },
      pinCounter: 0,
      containerId: null,
    };

    saveNodeToFirestore(activeProjectId, newNode);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    if (!activeProjectId) return;
    const curr = appState.nodes[nodeId];
    if (!curr) return;

    const updatedNode = { ...curr, ...updates };
    saveNodeToFirestore(activeProjectId, updatedNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeProjectId) return;
    deleteNodeFromFirestore(activeProjectId, nodeId);
    setDeleteWarningNodeId(null);
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
  };

  // Text Elements CRUD in Firestore
  const handleAddText = (type: 'floating' | 'container' | 'annotation', text: string) => {
    if (!activeProjectId) return;
    const textId = `text-${Date.now()}`;
    const centerX = viewportRef.current
      ? (viewportRef.current.scrollLeft + viewportRef.current.clientWidth / 2) / zoom - 100
      : 2400;
    const centerY = viewportRef.current
      ? (viewportRef.current.scrollTop + viewportRef.current.clientHeight / 2) / zoom - 50
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

  const handleDeleteText = (textId: string) => {
    if (!activeProjectId) return;
    deleteTextFromFirestore(activeProjectId, textId);
  };

  // Web Image Upload & Registry in Firestore (No Base64 in documents)
  const handleUploadNodeImage = async (nodeId: string, file: File, isMap = false) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const folder = isMap ? 'maps' : 'images';
      // 1. Upload file to server static folder
      const res = await uploadImageApi(base64Data, file.name, folder);

      // 2. Register image in Firestore images collection
      const imageRecord: ImageResource = {
        id: `img-${Date.now()}`,
        name: file.name,
        url: res.url,
        folder,
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
    };
    reader.readAsDataURL(file);
  };

  // Gallery multi-upload
  const handleUploadGalleryFiles = async (files: FileList) => {
    const folder = galleryModalState.mode.includes('maps') ? 'maps' : 'images';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          const res = await uploadImageApi(reader.result as string, file.name, folder);
          await registerImageInDb({
            id: `img-${Date.now()}_${i}`,
            name: file.name,
            url: res.url,
            folder: folder as 'images' | 'maps',
            uploadedBy: currentUser.name,
            uploadedAt: new Date().toISOString(),
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
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

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex flex-col ${
        isDark ? 'dark bg-neutral-950 text-neutral-100' : 'light bg-neutral-100 text-neutral-900'
      }`}
    >
      {/* Top Application Header */}
      <Header
        user={currentUser}
        projects={projects}
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
        onOpenGallery={(mode) => setGalleryModalState({ open: true, mode })}
        onOpenVideoLib={() => setGlobalVideoModalOpen(true)}
        onOpenArchive={() => setArchiveModalOpen(true)}
        onAddNode={handleAddNode}
        onOpenAddText={(type) => setAddTextModalState({ open: true, type })}
        onZoomChange={(type) => {
          if (type === '100') setZoom(1);
          if (type === 'center') centerCanvas();
          if (type === 'fit') fitAllNodes();
        }}
        onSignInGoogle={() => signInWithGoogle()}
        onSignOut={() => logOut()}
      />

      {/* Infinite Canvas Viewport */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
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
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0 canvas-grid"
        >
          {/* SVG Connection Layer */}
          <ConnectionLines
            connections={appState.connections}
            nodes={appState.nodes}
            tempConnection={tempConnection}
            onHoverConnection={(connectionId, x, y) => {
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
                isReadOnly={currentUser.role === 'Viewer'}
                onOpenSettings={(id, e) => {
                  setActiveTextPopover({ elementId: id, x: e.clientX, y: e.clientY });
                }}
                onDelete={handleDeleteText}
                onUnlink={(id) => handleUpdateText(id, { containerId: null })}
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
                isReadOnly={currentUser.role === 'Viewer'}
                onStartPortDrag={(nodeId, port, e) => {
                  if (!canvasRef.current) return;
                  const cRect = canvasRef.current.getBoundingClientRect();
                  const startX = (e.clientX - cRect.left) / zoom;
                  const startY = (e.clientY - cRect.top) / zoom;
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
                onUnlinkContainer={(id) => handleUpdateNode(id, { containerId: null })}
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
            const pId = await createProject(title, desc, currentUser.uid || 'admin');
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
          onDeleteImageRecord={async (imgId) => {
            await deleteImageFromDb(imgId);
          }}
        />
      )}

      {/* Node Dashboard Modal */}
      {activeNode && (
        <NodeDashboardModal
          node={activeNode}
          globalVideos={appState.globalVideos}
          isReadOnly={currentUser.role === 'Viewer'}
          currentUserName={currentUser.name}
          onClose={() => setActiveEditNodeId(null)}
          onUpdateNode={handleUpdateNode}
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
          isReadOnly={currentUser.role === 'Viewer'}
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

      {/* Gallery Modal (Images & Maps from Firestore Web DB) */}
      {galleryModalState.open && (
        <GalleryModal
          mode={galleryModalState.mode}
          images={imagesDbList.map((img) => ({ id: img.id, name: img.name, url: img.url }))}
          isLoading={false}
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
              await deleteImageFromDb(id);
            }
          }}
        />
      )}

      {/* Global Video Library Modal */}
      {globalVideoModalOpen && (
        <GlobalVideoModal
          videos={appState.globalVideos}
          author={currentUser.name}
          onClose={() => setGlobalVideoModalOpen(false)}
          onAddVideo={(video) => addGlobalVideoDoc(video)}
          onDeleteVideo={(id) => deleteGlobalVideoDoc(id)}
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
    </div>
  );
}
