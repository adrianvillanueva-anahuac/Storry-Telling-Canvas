export interface Reply {
  author: string;
  text: string;
}

export interface CommentPin {
  id: string;
  num: number;
  type: 'enfoque' | 'accion' | 'descripcion';
  text: string;
  author: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  replies: Reply[];
  review: boolean;
  done: boolean;
  edited: boolean;
}

export interface DrawingElement {
  id: string;
  layer: 'enfoque' | 'accion' | 'descripcion' | 'map';
  type: 'path' | 'figure';
  shape?: string;
  d: string;
  stroke: string;
  width?: string;
  baseWidth?: number;
  baseHeight?: number;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotate: number;
    cx: number;
    cy: number;
  };
}

export interface VideoSnapshot {
  id: string;
  time: number;
  comment: string;
}

export interface VideoRef {
  globalId: string;
  snapshots: VideoSnapshot[];
}

export interface WorkflowNode {
  id: string;
  projectId?: string;
  x: string;
  y: string;
  title: string;
  image: string | null;
  imageWidth?: number;
  imageHeight?: number;
  imageDeletedFromAdmin?: boolean;
  mapImage: string | null;
  mapImageWidth?: number;
  mapImageHeight?: number;
  mapImageDeletedFromAdmin?: boolean;
  mapName: string;
  enfoque: string;
  accion: string;
  descripcion: string;
  pins: CommentPin[];
  mapPins?: CommentPin[];
  drawings: DrawingElement[];
  mapDrawings: DrawingElement[];
  videos: {
    enfoque: VideoRef | null;
    accion: VideoRef | null;
    descripcion: VideoRef | null;
  };
  pinCounter: number;
  mapPinCounter?: number;
  containerId: string | null;
  storedAt?: string;
  storedBy?: string;
  storeNote?: string;
}

export interface Connection {
  id: string;
  projectId?: string;
  source: string;
  sourcePort: 'top' | 'bottom' | 'left' | 'right';
  target: string;
  targetPort: 'top' | 'bottom' | 'left' | 'right';
  type: 'curve' | 'straight';
  style: 'solid' | 'dotted';
  color: string;
  label: string;
  arrows: 'none' | 'end' | 'both';
}

export interface TextElement {
  id: string;
  projectId?: string;
  x: string;
  y: string;
  text: string;
  mode: 'floating' | 'annotation' | 'container';
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
  labelId: string;
  body?: string;
  width?: number;
  height?: number;
  containerId?: string | null;
}

export interface LabelItem {
  name: string;
  color: string;
}

export interface GlobalVideo {
  id: string;
  projectId?: string;
  name: string;
  date: string;
  author: string;
}

export interface UserProfile {
  uid?: string;
  name: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  email: string;
  photoURL?: string;
  createdAt?: string;
  lastLoginAt?: string;
  isRegistered?: boolean;
}

export interface ProjectParticipant {
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  uid?: string;
  name?: string;
  assignedAt?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  nodeCount?: number;
  participants?: Record<string, ProjectParticipant>;
}

export interface ImageResource {
  id: string;
  projectId?: string;
  name: string;
  url: string;
  storagePath?: string;
  folder: 'images' | 'maps' | 'objects';
  sizeBytes?: number;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface AppState {
  nodes: Record<string, WorkflowNode>;
  connections: Connection[];
  texts: Record<string, TextElement>;
  labels: Record<string, LabelItem>;
  storedNodes: Record<string, WorkflowNode>;
  globalVideos: GlobalVideo[];
}

export interface GalleryImage {
  id: string;
  name: string;
  url: string;
  folder?: string;
  sizeBytes?: number;
  projectId?: string;
}

