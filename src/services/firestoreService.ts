import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  Connection,
  GlobalVideo,
  ImageResource,
  Project,
  TextElement,
  UserProfile,
  WorkflowNode,
} from '../types/workflow';

// ==========================================
// 1. Projects Management
// ==========================================

export function subscribeProjects(callback: (projects: Project[]) => void) {
  const path = 'projects';
  try {
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })) as Project[];
        callback(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

export async function createProject(
  title: string,
  description: string,
  ownerId: string
): Promise<string> {
  const path = 'projects';
  try {
    const projectId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: projectId,
      title: title.trim() || 'New Storyboard Project',
      description: description.trim() || '',
      ownerId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, path, projectId), newProject);

    // Seed default initial node so canvas isn't empty
    const nodeDoc = doc(db, path, projectId, 'nodes', 'node-1');
    await setDoc(nodeDoc, {
      id: 'node-1',
      projectId,
      x: '2400px',
      y: '2350px',
      title: 'Scene 01: Opening Beat',
      image: null,
      mapImage: null,
      mapName: '',
      enfoque: 'Wide establishing frame with moody atmospheric depth.',
      accion: 'Main protagonist arrives at the designated location.',
      descripcion: 'Cool slate lighting with sharp directional rim lights.',
      pins: [],
      drawings: [],
      mapDrawings: [],
      videos: { enfoque: null, accion: null, descripcion: null },
      pinCounter: 0,
      containerId: null,
    });

    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateProject(
  projectId: string,
  updates: Partial<Project>
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// 2. Project Canvas Data (Nodes, Connections, Texts)
// ==========================================

export function subscribeProjectCanvas(
  projectId: string,
  callback: (data: {
    nodes: Record<string, WorkflowNode>;
    connections: Connection[];
    texts: Record<string, TextElement>;
    storedNodes: Record<string, WorkflowNode>;
  }) => void
) {
  let nodesMap: Record<string, WorkflowNode> = {};
  let connectionsList: Connection[] = [];
  let textsMap: Record<string, TextElement> = {};
  let storedNodesMap: Record<string, WorkflowNode> = {};

  const emit = () => {
    callback({
      nodes: { ...nodesMap },
      connections: [...connectionsList],
      texts: { ...textsMap },
      storedNodes: { ...storedNodesMap },
    });
  };

  // 1. Nodes
  const nodesUnsub = onSnapshot(
    collection(db, 'projects', projectId, 'nodes'),
    (snap) => {
      nodesMap = {};
      snap.docs.forEach((d) => {
        nodesMap[d.id] = { ...d.data(), id: d.id } as WorkflowNode;
      });
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/nodes`)
  );

  // 2. Connections
  const connsUnsub = onSnapshot(
    collection(db, 'projects', projectId, 'connections'),
    (snap) => {
      connectionsList = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Connection));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/connections`)
  );

  // 3. Texts
  const textsUnsub = onSnapshot(
    collection(db, 'projects', projectId, 'texts'),
    (snap) => {
      textsMap = {};
      snap.docs.forEach((d) => {
        textsMap[d.id] = { ...d.data(), id: d.id } as TextElement;
      });
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/texts`)
  );

  // 4. Stored Nodes
  const storedUnsub = onSnapshot(
    collection(db, 'projects', projectId, 'storedNodes'),
    (snap) => {
      storedNodesMap = {};
      snap.docs.forEach((d) => {
        storedNodesMap[d.id] = { ...d.data(), id: d.id } as WorkflowNode;
      });
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/storedNodes`)
  );

  return () => {
    nodesUnsub();
    connsUnsub();
    textsUnsub();
    storedUnsub();
  };
}

export async function saveNodeToFirestore(
  projectId: string,
  node: WorkflowNode
): Promise<void> {
  const path = `projects/${projectId}/nodes/${node.id}`;
  try {
    await setDoc(doc(db, 'projects', projectId, 'nodes', node.id), node, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteNodeFromFirestore(
  projectId: string,
  nodeId: string
): Promise<void> {
  const path = `projects/${projectId}/nodes/${nodeId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'nodes', nodeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function archiveNodeInFirestore(
  projectId: string,
  node: WorkflowNode
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'projects', projectId, 'nodes', node.id));
    batch.set(doc(db, 'projects', projectId, 'storedNodes', node.id), node);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/storedNodes/${node.id}`);
  }
}

export async function restoreNodeInFirestore(
  projectId: string,
  node: WorkflowNode
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'projects', projectId, 'storedNodes', node.id));
    batch.set(doc(db, 'projects', projectId, 'nodes', node.id), { ...node, containerId: null });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/nodes/${node.id}`);
  }
}

export async function deleteStoredNodeFromFirestore(
  projectId: string,
  nodeId: string
): Promise<void> {
  const path = `projects/${projectId}/storedNodes/${nodeId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'storedNodes', nodeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateStoredNodeNoteInFirestore(
  projectId: string,
  nodeId: string,
  note: string
): Promise<void> {
  const path = `projects/${projectId}/storedNodes/${nodeId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'storedNodes', nodeId), {
      storeNote: note,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveConnectionToFirestore(
  projectId: string,
  connection: Connection
): Promise<void> {
  const path = `projects/${projectId}/connections/${connection.id}`;
  try {
    await setDoc(doc(db, 'projects', projectId, 'connections', connection.id), connection);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteConnectionFromFirestore(
  projectId: string,
  connectionId: string
): Promise<void> {
  const path = `projects/${projectId}/connections/${connectionId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'connections', connectionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTextToFirestore(
  projectId: string,
  text: TextElement
): Promise<void> {
  const path = `projects/${projectId}/texts/${text.id}`;
  try {
    await setDoc(doc(db, 'projects', projectId, 'texts', text.id), text, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTextFromFirestore(
  projectId: string,
  textId: string
): Promise<void> {
  const path = `projects/${projectId}/texts/${textId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'texts', textId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==========================================
// 3. User & Admin Management
// ==========================================

export function subscribeUsers(callback: (users: UserProfile[]) => void) {
  const path = 'users';
  try {
    return onSnapshot(
      collection(db, path),
      (snap) => {
        const users = snap.docs.map((d) => ({
          ...d.data(),
          uid: d.id,
        })) as UserProfile[];
        callback(users);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

export async function updateUserRole(
  uid: string,
  newRole: 'Admin' | 'Editor' | 'Viewer'
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), { role: newRole });
    if (newRole === 'Admin') {
      await setDoc(doc(db, 'admins', uid), {
        grantedAt: new Date().toISOString(),
      });
    } else {
      await deleteDoc(doc(db, 'admins', uid)).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function inviteUserByEmail(
  email: string,
  role: 'Admin' | 'Editor' | 'Viewer'
): Promise<void> {
  const path = 'users';
  try {
    const safeId = email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    await setDoc(
      doc(db, 'users', safeId),
      {
        email: email.trim().toLowerCase(),
        name: email.split('@')[0],
        role: role,
        createdAt: new Date().toISOString(),
        isRegistered: false,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ==========================================
// 4. Web Image Database (No raw base64)
// ==========================================

export function subscribeImages(
  folder: string,
  callback: (images: ImageResource[]) => void
) {
  const path = 'images';
  try {
    const q = query(collection(db, path), where('folder', '==', folder));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as ImageResource[];
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

export async function registerImageInDb(image: ImageResource): Promise<void> {
  const path = `images/${image.id}`;
  try {
    await setDoc(doc(db, 'images', image.id), image);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteImageFromDb(imageId: string): Promise<void> {
  const path = `images/${imageId}`;
  try {
    await deleteDoc(doc(db, 'images', imageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==========================================
// 5. Global Video References
// ==========================================

export function subscribeGlobalVideos(callback: (videos: GlobalVideo[]) => void) {
  const path = 'globalVideos';
  try {
    return onSnapshot(
      collection(db, path),
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as GlobalVideo[];
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

export async function addGlobalVideoDoc(video: GlobalVideo): Promise<void> {
  const path = `globalVideos/${video.id}`;
  try {
    await setDoc(doc(db, 'globalVideos', video.id), video);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGlobalVideoDoc(videoId: string): Promise<void> {
  const path = `globalVideos/${videoId}`;
  try {
    await deleteDoc(doc(db, 'globalVideos', videoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
