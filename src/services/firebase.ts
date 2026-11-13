import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocFromServer,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with configured database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on initialization
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection warning: client appears offline.');
    }
  }
}

// Google Login Popup
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const normalizedEmail = (user.email || '').trim().toLowerCase();

    // Check if user is super admin
    const isSuperAdmin = normalizedEmail === 'adrian.byakko@gmail.com';

    // Sync or create user profile document
    const userDocRef = doc(db, 'users', user.uid);
    const existing = await getDoc(userDocRef);

    let role: 'Admin' | 'Editor' | 'Viewer' = 'Viewer';
    if (isSuperAdmin) {
      role = 'Admin';
      // Ensure admin document exists
      await setDoc(doc(db, 'admins', user.uid), {
        email: normalizedEmail,
        grantedAt: new Date().toISOString(),
      });
    } else if (existing.exists()) {
      const existingRole = existing.data().role;
      role = existingRole === 'Admin' || existingRole === 'Editor' || existingRole === 'Viewer'
        ? existingRole
        : 'Viewer';
    } else if (normalizedEmail) {
      // Check if an Admin pre-invited this email
      const inviteRef = doc(db, 'invites', normalizedEmail);
      const inviteSnap = await getDoc(inviteRef).catch(() => null);
      if (inviteSnap && inviteSnap.exists()) {
        const invitedRole = inviteSnap.data().role;
        if (invitedRole === 'Admin' || invitedRole === 'Editor' || invitedRole === 'Viewer') {
          role = invitedRole;
        }
      }
    }

    const displayName = user.displayName || 'Team Member';
    await setDoc(
      userDocRef,
      {
        uid: user.uid,
        email: normalizedEmail,
        name: displayName,
        displayName,
        photoURL: user.photoURL || '',
        role,
        isRegistered: true,
        lastLoginAt: new Date().toISOString(),
        ...(!existing.exists() ? { createdAt: new Date().toISOString() } : {}),
      },
      { merge: true }
    );

    if (!isSuperAdmin && normalizedEmail) {
      await deleteDoc(doc(db, 'invites', normalizedEmail)).catch(() => {});
    }

    return user;
  } catch (err) {
    console.error('Sign-in error:', err);
    throw err;
  }
}

export async function logOut() {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { FirebaseUser };
