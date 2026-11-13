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
  Connection,
  GlobalVideo,
  ImageResource,
  Project,
  ProjectParticipant,
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
  const urlSet = new Set(deletedUrls.filter(Boolean));
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
          const hitMain = Boolean(data.image && urlSet.has(data.image));
          const hitMap = Boolean(data.mapImage && urlSet.has(data.mapImage));
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
