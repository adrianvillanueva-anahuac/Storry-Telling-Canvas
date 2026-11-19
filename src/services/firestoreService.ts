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
import { deleteImageFromStorage } from './storageService';
import {
  ActorItem,
  Connection,
  GlobalVideo,
  ImageResource,
  LabelItem,
  Project,
  ProjectParticipant,
  TextElement,
  UserProfile,
  WorkflowNode,
} from '../types/workflow';

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const cleaned: Record<string, unknown> = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned as T;
}

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
  ownerId: string,
  ownerEmail?: string,
  ownerName?: string
): Promise<string> {
  const path = 'projects';
  try {
    const projectId = `proj-${Date.now()}`;
    const cleanEmail = (ownerEmail || '').trim().toLowerCase();
    const initialParticipants: Record<string, ProjectParticipant> = {};
    if (cleanEmail) {
      initialParticipants[cleanEmail] = {
        email: cleanEmail,
        role: 'Admin',
        uid: ownerId,
        name: ownerName || cleanEmail.split('@')[0],
        assignedAt: new Date().toISOString(),
      };
    }

    const newProject: Project = {
      id: projectId,
      title: title.trim() || 'New Storyboard Project',
      description: description.trim() || '',
      ownerId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants: initialParticipants,
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
      actors: [],
      pinCounter: 0,
      containerId: null,
    });

    // Seed starter color-coded labels for immediate visual grouping
    const nowIso = new Date().toISOString();
    const starterLabels: Array<LabelItem & { id: string }> = [
      { id: 'lbl-1', projectId, name: 'Act I', color: '#2563eb', createdAt: nowIso, updatedAt: nowIso },
      { id: 'lbl-2', projectId, name: 'Needs Review', color: '#dc2626', createdAt: nowIso, updatedAt: nowIso },
      { id: 'lbl-3', projectId, name: 'Approved', color: '#059669', createdAt: nowIso, updatedAt: nowIso },
    ];
    await Promise.all(
      starterLabels.map((lbl) =>
        setDoc(doc(db, path, projectId, 'labels', lbl.id), lbl)
      )
    );

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
    labels: Record<string, LabelItem>;
  }) => void
) {
  let nodesMap: Record<string, WorkflowNode> = {};
  let connectionsList: Connection[] = [];
  let textsMap: Record<string, TextElement> = {};
  let storedNodesMap: Record<string, WorkflowNode> = {};
  let labelsMap: Record<string, LabelItem> = {};

  const emit = () => {
    callback({
      nodes: { ...nodesMap },
      connections: [...connectionsList],
      texts: { ...textsMap },
      storedNodes: { ...storedNodesMap },
      labels: { ...labelsMap },
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

  // 5. Project Labels
  const labelsUnsub = onSnapshot(
    collection(db, 'projects', projectId, 'labels'),
    (snap) => {
      labelsMap = {};
      snap.docs.forEach((d) => {
        labelsMap[d.id] = { ...d.data(), id: d.id } as LabelItem;
      });
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/labels`)
  );

  return () => {
    nodesUnsub();
    connsUnsub();
    textsUnsub();
    storedUnsub();
    labelsUnsub();
  };
}

export async function saveNodeToFirestore(
  projectId: string,
  node: WorkflowNode
): Promise<void> {
  const path = `projects/${projectId}/nodes/${node.id}`;
  try {
    await setDoc(
      doc(db, 'projects', projectId, 'nodes', node.id),
      stripUndefined(node as unknown as Record<string, unknown>),
      { merge: true }
    );
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
    batch.set(
      doc(db, 'projects', projectId, 'storedNodes', node.id),
      stripUndefined(node as unknown as Record<string, unknown>)
    );
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
    batch.set(
      doc(db, 'projects', projectId, 'nodes', node.id),
      stripUndefined({ ...node, containerId: null } as unknown as Record<string, unknown>)
    );
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
    await setDoc(
      doc(db, 'projects', projectId, 'connections', connection.id),
      stripUndefined(connection as unknown as Record<string, unknown>)
    );
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
    await setDoc(
      doc(db, 'projects', projectId, 'texts', text.id),
      stripUndefined(text as unknown as Record<string, unknown>),
      { merge: true }
    );
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

export async function saveCanvasPositionsBatch(
  projectId: string,
  nodes: WorkflowNode[],
  texts: TextElement[]
): Promise<void> {
  if (nodes.length === 0 && texts.length === 0) return;
  const path = `projects/${projectId}/nodes`;
  try {
    let batch = writeBatch(db);
    let opCount = 0;

    const flushIfNeeded = async (force = false) => {
      if (opCount >= 400 || (force && opCount > 0)) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const node of nodes) {
      batch.set(
        doc(db, 'projects', projectId, 'nodes', node.id),
        stripUndefined(node as unknown as Record<string, unknown>),
        { merge: true }
      );
      opCount += 1;
      await flushIfNeeded(false);
    }

    for (const text of texts) {
      batch.set(
        doc(db, 'projects', projectId, 'texts', text.id),
        stripUndefined(text as unknown as Record<string, unknown>),
        { merge: true }
      );
      opCount += 1;
      await flushIfNeeded(false);
    }

    await flushIfNeeded(true);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCanvasItemsBatch(
  projectId: string,
  nodeIds: string[],
  textIds: string[],
  connectionIds: string[],
  unlinkedUpdates?: { nodes: WorkflowNode[]; texts: TextElement[] }
): Promise<void> {
  if (
    nodeIds.length === 0 &&
    textIds.length === 0 &&
    connectionIds.length === 0 &&
    !unlinkedUpdates?.nodes.length &&
    !unlinkedUpdates?.texts.length
  ) {
    return;
  }
  const path = `projects/${projectId}/nodes`;
  try {
    let batch = writeBatch(db);
    let opCount = 0;

    const flushIfNeeded = async (force = false) => {
      if (opCount >= 400 || (force && opCount > 0)) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const nid of nodeIds) {
      batch.delete(doc(db, 'projects', projectId, 'nodes', nid));
      opCount += 1;
      await flushIfNeeded(false);
    }

    for (const tid of textIds) {
      batch.delete(doc(db, 'projects', projectId, 'texts', tid));
      opCount += 1;
      await flushIfNeeded(false);
    }

    for (const cid of connectionIds) {
      batch.delete(doc(db, 'projects', projectId, 'connections', cid));
      opCount += 1;
      await flushIfNeeded(false);
    }

    if (unlinkedUpdates) {
      for (const n of unlinkedUpdates.nodes) {
        batch.set(doc(db, 'projects', projectId, 'nodes', n.id), n, { merge: true });
        opCount += 1;
        await flushIfNeeded(false);
      }
      for (const t of unlinkedUpdates.texts) {
        batch.set(doc(db, 'projects', projectId, 'texts', t.id), t, { merge: true });
        opCount += 1;
        await flushIfNeeded(false);
      }
    }

    await flushIfNeeded(true);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function archiveNodesBatch(
  projectId: string,
  nodesToArchive: WorkflowNode[]
): Promise<void> {
  if (nodesToArchive.length === 0) return;
  const path = `projects/${projectId}/storedNodes`;
  try {
    let batch = writeBatch(db);
    let opCount = 0;

    const flushIfNeeded = async (force = false) => {
      if (opCount >= 400 || (force && opCount > 0)) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const node of nodesToArchive) {
      batch.delete(doc(db, 'projects', projectId, 'nodes', node.id));
      batch.set(doc(db, 'projects', projectId, 'storedNodes', node.id), node);
      opCount += 2;
      await flushIfNeeded(false);
    }

    await flushIfNeeded(true);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function sanitizeLabelDoc(
  projectId: string,
  labelId: string,
  label: LabelItem
): {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
} {
  const safeName = (label.name || 'Label').trim().slice(0, 60) || 'Label';
  const rawColor = (label.color || '#2563eb').trim();
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : '#2563eb';
  const nowIso = new Date().toISOString().slice(0, 64);
  return {
    id: labelId,
    projectId,
    name: safeName,
    color: safeColor,
    createdAt: (label.createdAt || nowIso).slice(0, 64),
    updatedAt: nowIso,
  };
}

export async function saveLabelToFirestore(
  projectId: string,
  labelId: string,
  label: LabelItem,
  updatedTexts?: TextElement[]
): Promise<void> {
  const path = `projects/${projectId}/labels/${labelId}`;
  try {
    const payload = sanitizeLabelDoc(projectId, labelId, label);
    if (updatedTexts && updatedTexts.length > 0) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'projects', projectId, 'labels', labelId), payload);
      for (const textEl of updatedTexts) {
        batch.set(
          doc(db, 'projects', projectId, 'texts', textEl.id),
          stripUndefined(textEl as unknown as Record<string, unknown>),
          { merge: true }
        );
      }
      await batch.commit();
    } else {
      await setDoc(doc(db, 'projects', projectId, 'labels', labelId), payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLabelFromFirestore(
  projectId: string,
  labelId: string,
  clearedNodes: WorkflowNode[] = [],
  clearedTexts: TextElement[] = []
): Promise<void> {
  const path = `projects/${projectId}/labels/${labelId}`;
  try {
    let batch = writeBatch(db);
    let opCount = 0;

    const flushIfNeeded = async (force = false) => {
      if (opCount >= 400 || (force && opCount > 0)) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    batch.delete(doc(db, 'projects', projectId, 'labels', labelId));
    opCount += 1;

    for (const node of clearedNodes) {
      batch.set(
        doc(db, 'projects', projectId, 'nodes', node.id),
        stripUndefined(node as unknown as Record<string, unknown>),
        { merge: true }
      );
      opCount += 1;
      await flushIfNeeded(false);
    }

    for (const textEl of clearedTexts) {
      batch.set(
        doc(db, 'projects', projectId, 'texts', textEl.id),
        stripUndefined(textEl as unknown as Record<string, unknown>),
        { merge: true }
      );
      opCount += 1;
      await flushIfNeeded(false);
    }

    await flushIfNeeded(true);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface CanvasSnapshotData {
  nodes: Record<string, WorkflowNode>;
  connections: Connection[];
  texts: Record<string, TextElement>;
  storedNodes: Record<string, WorkflowNode>;
  labels?: Record<string, LabelItem>;
}

export async function syncCanvasSnapshotDiffToFirestore(
  projectId: string,
  prevSnapshot: CanvasSnapshotData,
  nextSnapshot: CanvasSnapshotData
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    let batch = writeBatch(db);
    let opCount = 0;

    const flushIfNeeded = async (force = false) => {
      if (opCount >= 400 || (force && opCount > 0)) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    const syncRecordCollection = async <T extends { id: string }>(
      subcollection: 'nodes' | 'texts' | 'storedNodes',
      prevMap: Record<string, T>,
      nextMap: Record<string, T>
    ) => {
      for (const id of Object.keys(prevMap)) {
        if (!(id in nextMap)) {
          batch.delete(doc(db, 'projects', projectId, subcollection, id));
          opCount += 1;
          await flushIfNeeded(false);
        }
      }
      for (const [id, nextDoc] of Object.entries(nextMap)) {
        const prevDoc = prevMap[id];
        if (!prevDoc || JSON.stringify(prevDoc) !== JSON.stringify(nextDoc)) {
          batch.set(doc(db, 'projects', projectId, subcollection, id), nextDoc);
          opCount += 1;
          await flushIfNeeded(false);
        }
      }
    };

    await syncRecordCollection('nodes', prevSnapshot.nodes, nextSnapshot.nodes);
    await syncRecordCollection('texts', prevSnapshot.texts, nextSnapshot.texts);
    await syncRecordCollection('storedNodes', prevSnapshot.storedNodes, nextSnapshot.storedNodes);

    if (prevSnapshot.labels && nextSnapshot.labels) {
      for (const id of Object.keys(prevSnapshot.labels)) {
        if (!(id in nextSnapshot.labels)) {
          batch.delete(doc(db, 'projects', projectId, 'labels', id));
          opCount += 1;
          await flushIfNeeded(false);
        }
      }
      for (const [id, nextLbl] of Object.entries(nextSnapshot.labels)) {
        const prevLbl = prevSnapshot.labels[id];
        if (!prevLbl || prevLbl.name !== nextLbl.name || prevLbl.color !== nextLbl.color) {
          batch.set(
            doc(db, 'projects', projectId, 'labels', id),
            sanitizeLabelDoc(projectId, id, nextLbl)
          );
          opCount += 1;
          await flushIfNeeded(false);
        }
      }
    }

    const prevConnsMap: Record<string, Connection> = {};
    prevSnapshot.connections.forEach((c) => {
      prevConnsMap[c.id] = c;
    });
    const nextConnsMap: Record<string, Connection> = {};
    nextSnapshot.connections.forEach((c) => {
      nextConnsMap[c.id] = c;
    });

    for (const id of Object.keys(prevConnsMap)) {
      if (!(id in nextConnsMap)) {
        batch.delete(doc(db, 'projects', projectId, 'connections', id));
        opCount += 1;
        await flushIfNeeded(false);
      }
    }
    for (const [id, nextConn] of Object.entries(nextConnsMap)) {
      const prevConn = prevConnsMap[id];
      if (!prevConn || JSON.stringify(prevConn) !== JSON.stringify(nextConn)) {
        batch.set(doc(db, 'projects', projectId, 'connections', id), nextConn);
        opCount += 1;
        await flushIfNeeded(false);
      }
    }

    await flushIfNeeded(true);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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

export function subscribeUserProfile(
  uid: string,
  callback: (profile: Partial<UserProfile> | null) => void
) {
  const path = `users/${uid}`;
  try {
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const data = snap.data();
        callback({
          uid: snap.id,
          name: data.name || data.displayName || 'Team Member',
          email: data.email || '',
          photoURL: data.photoURL || '',
          role: data.role || 'Viewer',
          isRegistered: data.isRegistered !== false,
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, path)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return () => {};
  }
}

export async function updateUserRole(
  uid: string,
  newRole: 'Admin' | 'Editor' | 'Viewer'
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    await updateDoc(userRef, { role: newRole });

    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.isRegistered === false && typeof data.email === 'string' && data.email) {
        await setDoc(
          doc(db, 'invites', data.email.trim().toLowerCase()),
          {
            email: data.email.trim().toLowerCase(),
            role: newRole,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

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
  const cleanEmail = email.trim().toLowerCase();
  const path = `invites/${cleanEmail}`;
  try {
    const safeId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const now = new Date().toISOString();

    await setDoc(
      doc(db, 'invites', cleanEmail),
      {
        email: cleanEmail,
        role,
        createdAt: now,
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'users', safeId),
      {
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        role,
        createdAt: now,
        isRegistered: false,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function setProjectParticipantRole(
  project: Project,
  email: string,
  role: 'Admin' | 'Editor' | 'Viewer',
  meta?: { uid?: string; name?: string }
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  const path = `projects/${project.id}`;
  try {
    const current = { ...(project.participants || {}) };
    const prev = current[cleanEmail];
    current[cleanEmail] = {
      email: cleanEmail,
      role,
      uid: meta?.uid ?? prev?.uid ?? '',
      name: meta?.name ?? prev?.name ?? cleanEmail.split('@')[0],
      assignedAt: prev?.assignedAt || new Date().toISOString(),
    };
    await updateDoc(doc(db, 'projects', project.id), {
      participants: current,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeProjectParticipant(
  project: Project,
  email: string
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  const path = `projects/${project.id}`;
  try {
    const current = { ...(project.participants || {}) };
    delete current[cleanEmail];
    await updateDoc(doc(db, 'projects', project.id), {
      participants: current,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setUserProjectAssignments(
  user: UserProfile,
  assignments: Record<string, 'Admin' | 'Editor' | 'Viewer' | null>,
  projects: Project[]
): Promise<void> {
  const cleanEmail = (user.email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let hasChanges = false;

    for (const proj of projects) {
      if (!(proj.id in assignments)) continue;
      const desiredRole = assignments[proj.id];
      const currentMap = { ...(proj.participants || {}) };
      const existingEntry = currentMap[cleanEmail];

      if (desiredRole === null) {
        if (existingEntry) {
          delete currentMap[cleanEmail];
          batch.update(doc(db, 'projects', proj.id), {
            participants: currentMap,
            updatedAt: now,
          });
          hasChanges = true;
        }
      } else {
        if (!existingEntry || existingEntry.role !== desiredRole) {
          currentMap[cleanEmail] = {
            email: cleanEmail,
            role: desiredRole,
            uid: user.uid || existingEntry?.uid || '',
            name: user.name || existingEntry?.name || cleanEmail.split('@')[0],
            assignedAt: existingEntry?.assignedAt || now,
          };
          batch.update(doc(db, 'projects', proj.id), {
            participants: currentMap,
            updatedAt: now,
          });
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects');
  }
}

export async function deleteUserCompletely(
  user: UserProfile,
  projects: Project[]
): Promise<void> {
  const cleanEmail = (user.email || '').trim().toLowerCase();
  if (cleanEmail === 'adrian.byakko@gmail.com') return;

  const targetUid = user.uid || cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const path = `users/${targetUid}`;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    if (targetUid) {
      batch.delete(doc(db, 'users', targetUid));
      batch.delete(doc(db, 'admins', targetUid));
    }
    if (cleanEmail) {
      const safeId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      if (safeId !== targetUid) {
        batch.delete(doc(db, 'users', safeId));
      }
      batch.delete(doc(db, 'invites', cleanEmail));

      for (const proj of projects) {
        if (proj.participants && cleanEmail in proj.participants) {
          const nextMap = { ...proj.participants };
          delete nextMap[cleanEmail];
          batch.update(doc(db, 'projects', proj.id), {
            participants: nextMap,
            updatedAt: now,
          });
        }
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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

export function subscribeAllImages(callback: (images: ImageResource[]) => void) {
  const path = 'images';
  try {
    return onSnapshot(
      collection(db, path),
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

export async function deleteImageFromDb(imageId: string, storageUrlOrPath?: string): Promise<void> {
  const path = `images/${imageId}`;
  try {
    let resolvedTarget = storageUrlOrPath;
    if (!resolvedTarget || !resolvedTarget.includes('.blob.vercel-storage.com')) {
      const snap = await getDoc(doc(db, 'images', imageId)).catch(() => null);
      if (snap?.exists()) {
        resolvedTarget = snap.data().url || snap.data().storagePath || resolvedTarget;
      }
    }
    await deleteDoc(doc(db, 'images', imageId));
    if (resolvedTarget) {
      await deleteImageFromStorage(resolvedTarget);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearDeletedImagesFromProjectNodes(
  deletedUrls: string[],
  projectIds: string[]
): Promise<void> {
  const normalizeUrl = (u?: string | null) => (u ? u.split('?')[0].trim() : '');
  const urlSet = new Set(deletedUrls.map(normalizeUrl).filter(Boolean));
  const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)));
  if (urlSet.size === 0 || uniqueProjectIds.length === 0) return;

  try {
    let batch = writeBatch(db);
    let opCount = 0;

    const commitIfNeeded = async (force = false) => {
      if (opCount >= 400 || (force && opCount > 0)) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const pid of uniqueProjectIds) {
      for (const subcol of ['nodes', 'storedNodes'] as const) {
        const snap = await getDocs(collection(db, 'projects', pid, subcol));
        for (const d of snap.docs) {
          const data = d.data() as WorkflowNode;
          const hitMain = Boolean(data.image && urlSet.has(normalizeUrl(data.image)));
          const hitMap = Boolean(data.mapImage && urlSet.has(normalizeUrl(data.mapImage)));
          if (hitMain || hitMap) {
            batch.update(doc(db, 'projects', pid, subcol, d.id), {
              ...(hitMain ? { image: null, imageDeletedFromAdmin: true } : {}),
              ...(hitMap ? { mapImage: null, mapName: '', mapImageDeletedFromAdmin: true } : {}),
            });
            opCount += 1;
            await commitIfNeeded(false);
          }
        }
      }
    }

    await commitIfNeeded(true);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects/nodes');
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

export function subscribeProjectVideos(
  projectId: string,
  callback: (videos: GlobalVideo[]) => void
) {
  const path = `projects/${projectId}/videos`;
  try {
    return onSnapshot(
      collection(db, 'projects', projectId, 'videos'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
          projectId,
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

export async function addProjectVideoDoc(
  projectId: string,
  video: GlobalVideo
): Promise<void> {
  const path = `projects/${projectId}/videos/${video.id}`;
  try {
    await setDoc(doc(db, 'projects', projectId, 'videos', video.id), {
      ...video,
      projectId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteProjectVideoDoc(
  projectId: string,
  videoId: string
): Promise<void> {
  const path = `projects/${projectId}/videos/${videoId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'videos', videoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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

// ==========================================
// 6. Private Per-User Gemini API Key Config
// ==========================================

export interface GeminiApiKeyEntry {
  id: string;
  label: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserGeminiApiConfig {
  keys: GeminiApiKeyEntry[];
  activeKeyId: string | null;
  activeApiKey: string | null;
}

function sanitizeKeyEntryId(rawId: string, fallbackIndex: number): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `key-${Date.now()}-${fallbackIndex}`;
}

export function subscribeUserGeminiApiConfig(
  uid: string,
  callback: (config: UserGeminiApiConfig) => void
) {
  const path = `users/${uid}/private/geminiConfig`;
  try {
    return onSnapshot(
      doc(db, 'users', uid, 'private', 'geminiConfig'),
      (snap) => {
        if (!snap.exists()) {
          callback({ keys: [], activeKeyId: null, activeApiKey: null });
          return;
        }
        const data = snap.data();
        const fallbackNow =
          typeof data?.updatedAt === 'string' && data.updatedAt.trim()
            ? data.updatedAt.trim().slice(0, 64)
            : new Date().toISOString();

        if (Array.isArray(data?.keys)) {
          const seenIds = new Set<string>();
          const parsedKeys: GeminiApiKeyEntry[] = [];

          for (let i = 0; i < data.keys.length && parsedKeys.length < 20; i++) {
            const raw = data.keys[i];
            if (!raw || typeof raw !== 'object') continue;
            const rawKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
            if (rawKey.length < 10 || rawKey.length > 256) continue;
            let entryId = sanitizeKeyEntryId(
              typeof raw.id === 'string' ? raw.id : `key-${i + 1}`,
              i + 1
            );
            while (seenIds.has(entryId)) {
              entryId = `${entryId.slice(0, 110)}-${parsedKeys.length + 1}`;
            }
            seenIds.add(entryId);
            const rawLabel =
              typeof raw.label === 'string' && raw.label.trim()
                ? raw.label.trim().slice(0, 60)
                : `API Key ${parsedKeys.length + 1}`;
            const createdAt =
              typeof raw.createdAt === 'string' && raw.createdAt.trim()
                ? raw.createdAt.trim().slice(0, 64)
                : fallbackNow;
            const updatedAt =
              typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
                ? raw.updatedAt.trim().slice(0, 64)
                : fallbackNow;

            parsedKeys.push({
              id: entryId,
              label: rawLabel,
              apiKey: rawKey,
              createdAt,
              updatedAt,
            });
          }

          const rawActiveId = typeof data?.activeKeyId === 'string' ? data.activeKeyId : null;
          const activeEntry = rawActiveId
            ? parsedKeys.find((entry) => entry.id === rawActiveId) ?? null
            : null;

          callback({
            keys: parsedKeys,
            activeKeyId: activeEntry ? activeEntry.id : null,
            activeApiKey: activeEntry ? activeEntry.apiKey : null,
          });
          return;
        }

        // Legacy single-key compatibility
        const legacyKey =
          typeof data?.apiKey === 'string' && data.apiKey.trim() ? data.apiKey.trim() : null;
        if (legacyKey) {
          const legacyEntry: GeminiApiKeyEntry = {
            id: 'key-default',
            label: 'Gemini API',
            apiKey: legacyKey.slice(0, 256),
            createdAt: fallbackNow,
            updatedAt: fallbackNow,
          };
          callback({
            keys: [legacyEntry],
            activeKeyId: legacyEntry.id,
            activeApiKey: legacyEntry.apiKey,
          });
          return;
        }

        callback({ keys: [], activeKeyId: null, activeApiKey: null });
      },
      (err) => handleFirestoreError(err, OperationType.GET, path)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return () => {};
  }
}

export async function saveUserGeminiApiConfig(
  uid: string,
  keys: GeminiApiKeyEntry[],
  activeKeyId: string | null
): Promise<void> {
  if (keys.length > 20) {
    throw new Error('Maximum of 20 saved API keys reached.');
  }
  const now = new Date().toISOString();
  const seenIds = new Set<string>();
  const sanitizedKeys: GeminiApiKeyEntry[] = [];

  for (let i = 0; i < keys.length; i++) {
    const item = keys[i];
    const trimmedKey = (item.apiKey || '').trim();
    if (trimmedKey.length < 10 || trimmedKey.length > 256) {
      throw new Error('Please enter a valid Gemini API key (10–256 characters).');
    }
    let id = sanitizeKeyEntryId(item.id || `key-${Date.now()}-${i + 1}`, i + 1);
    while (seenIds.has(id)) {
      id = `${id.slice(0, 110)}-${i + 1}`;
    }
    seenIds.add(id);

    const label = (item.label || `API Key ${i + 1}`).trim().slice(0, 60) || `API Key ${i + 1}`;
    const createdAt = (item.createdAt || now).trim().slice(0, 64) || now;
    const updatedAt = (item.updatedAt || now).trim().slice(0, 64) || now;

    sanitizedKeys.push({
      id,
      label,
      apiKey: trimmedKey,
      createdAt,
      updatedAt,
    });
  }

  const activeEntry = activeKeyId
    ? sanitizedKeys.find((entry) => entry.id === activeKeyId) ?? null
    : null;

  const path = `users/${uid}/private/geminiConfig`;
  try {
    await setDoc(doc(db, 'users', uid, 'private', 'geminiConfig'), {
      userId: uid,
      apiKey: activeEntry ? activeEntry.apiKey : '',
      activeKeyId: activeEntry ? activeEntry.id : null,
      keys: sanitizedKeys,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserGeminiApiKey(
  uid: string,
  callback: (apiKey: string | null) => void
) {
  return subscribeUserGeminiApiConfig(uid, (config) => callback(config.activeApiKey));
}

export async function saveUserGeminiApiKey(uid: string, apiKey: string): Promise<void> {
  const now = new Date().toISOString();
  const entry: GeminiApiKeyEntry = {
    id: 'key-default',
    label: 'Gemini API',
    apiKey: apiKey.trim(),
    createdAt: now,
    updatedAt: now,
  };
  await saveUserGeminiApiConfig(uid, [entry], entry.id);
}

export async function deleteUserGeminiApiKey(uid: string): Promise<void> {
  const path = `users/${uid}/private/geminiConfig`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'private', 'geminiConfig'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==========================================
// 7. Project Actor / 3D Element Library
// ==========================================

export function subscribeProjectActors(
  projectId: string,
  callback: (actors: ActorItem[]) => void
) {
  const path = `projects/${projectId}/actors`;
  try {
    const q = query(collection(db, 'projects', projectId, 'actors'), orderBy('name', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
          projectId,
        })) as ActorItem[];
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

export async function saveProjectActor(
  projectId: string,
  actor: ActorItem
): Promise<void> {
  const path = `projects/${projectId}/actors/${actor.id}`;
  try {
    const sanitized: ActorItem = {
      id: actor.id,
      projectId,
      name: (actor.name || 'Actor').trim().slice(0, 150),
      category: (actor.category || '').trim().slice(0, 80),
      description: (actor.description || '').trim().slice(0, 2000),
      thumbnailUrl: actor.thumbnailUrl || null,
      ...(actor.thumbnailPath ? { thumbnailPath: actor.thumbnailPath.slice(0, 512) } : {}),
      states: (actor.states || []).slice(0, 50),
      tags: Array.from(new Set((actor.tags || []).map((t) => t.trim()).filter(Boolean))).slice(0, 50),
      author: (actor.author || '').trim().slice(0, 120),
      createdAt: (actor.createdAt || new Date().toISOString()).slice(0, 64),
      updatedAt: new Date().toISOString().slice(0, 64),
    };
    await setDoc(doc(db, 'projects', projectId, 'actors', actor.id), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProjectActor(
  projectId: string,
  actorId: string,
  thumbnailUrlOrPath?: string | null
): Promise<void> {
  const path = `projects/${projectId}/actors/${actorId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'actors', actorId));
    if (thumbnailUrlOrPath) {
      await deleteImageFromStorage(thumbnailUrlOrPath).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

