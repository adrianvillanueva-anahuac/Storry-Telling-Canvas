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
export const firebaseProjectId = firebaseConfig.projectId;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export class AuthSignInError extends Error {
  code: string;
  hostname?: string;
  projectId?: string;

  constructor(message: string, code: string, hostname?: string, projectId?: string) {
    super(message);
    this.name = 'AuthSignInError';
    this.code = code;
    this.hostname = hostname;
    this.projectId = projectId;
  }
}

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
    const rawMessage = err instanceof Error ? err.message : String(err || 'Sign-in error');
    const rawCode =
      typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
        ? (err as { code: string }).code
        : '';
    let resolvedCode = rawCode;
    if (!resolvedCode) {
      if (rawMessage.includes('auth/unauthorized-domain')) resolvedCode = 'auth/unauthorized-domain';
      else if (rawMessage.includes('auth/popup-blocked')) resolvedCode = 'auth/popup-blocked';
      else if (rawMessage.includes('auth/popup-closed-by-user')) resolvedCode = 'auth/popup-closed-by-user';
      else if (rawMessage.includes('auth/cancelled-popup-request')) resolvedCode = 'auth/cancelled-popup-request';
      else if (rawMessage.includes('auth/network-request-failed')) resolvedCode = 'auth/network-request-failed';
      else resolvedCode = 'auth/unknown';
    }
    const hostname = typeof window !== 'undefined' ? window.location.hostname : undefined;
    throw new AuthSignInError(rawMessage, resolvedCode, hostname, firebaseConfig.projectId);
  }
}

export async function logOut() {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { FirebaseUser };
