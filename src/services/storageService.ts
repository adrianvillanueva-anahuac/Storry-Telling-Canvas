import { upload } from '@vercel/blob/client';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import {
  evictMediaCache,
  parseFirestoreMediaUrl,
  primeMediaCache,
  toFirestoreMediaUrl,
} from './mediaCache';

export interface UploadImageResult {
  url: string;
  storagePath: string;
  storageProvider: 'vercel-blob' | 'firebase-storage' | 'firestore-media' | 'local-ephemeral';
}

export class CloudStorageUnavailableError extends Error {
  constructor(message = 'Cloud storage is not configured in this environment.') {
    super(message);
    this.name = 'CloudStorageUnavailableError';
  }
}

let firebaseStorageUnavailable = false;
const MAX_FIRESTORE_MEDIA_CHARS = 850_000;

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode file as base64 data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElementFromFile(file: File): Promise<{ img: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode image file for cloud compression.'));
    };
    img.src = objectUrl;
  });
}

async function compressImageForFirestore(
  file: File
): Promise<{ dataUrl: string; mimeType: 'image/webp' | 'image/jpeg' | 'image/png' }> {
  // Keep small PNG/JPEG/WebP files untouched when already compact
  if (
    (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp') &&
    file.size <= 550_000
  ) {
    const rawDataUrl = await fileToDataUrl(file);
    if (
      rawDataUrl.length <= MAX_FIRESTORE_MEDIA_CHARS &&
      /^data:image\/(webp|jpeg|png);base64,.+$/.test(rawDataUrl)
    ) {
      return {
        dataUrl: rawDataUrl,
        mimeType: file.type as 'image/webp' | 'image/jpeg' | 'image/png',
      };
    }
  }

  const { img, objectUrl } = await loadImageElementFromFile(file);
  try {
    const naturalW = img.naturalWidth || 1280;
    const naturalH = img.naturalHeight || 720;
    const maxDimensions = [1600, 1280, 960, 720];
    const mimeCandidates: Array<'image/webp' | 'image/jpeg'> = ['image/webp', 'image/jpeg'];
    const qualities = [0.85, 0.72, 0.58, 0.45];

    for (const maxDim of maxDimensions) {
      const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
      const width = Math.max(1, Math.round(naturalW * scale));
      const height = Math.max(1, Math.round(naturalH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      for (const mime of mimeCandidates) {
        for (const quality of qualities) {
          const encoded = canvas.toDataURL(mime, quality);
          if (
            encoded.startsWith(`data:${mime};base64,`) &&
            encoded.length <= MAX_FIRESTORE_MEDIA_CHARS
          ) {
            return { dataUrl: encoded, mimeType: mime };
          }
        }
      }
    }

    throw new CloudStorageUnavailableError(
      'Image exceeds the cloud database asset limit after compression. Configure BLOB_READ_WRITE_TOKEN for full-resolution storage.'
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadViaFirestoreMedia(
  file: File,
  projectId: string
): Promise<UploadImageResult> {
  if (!auth.currentUser) {
    throw new CloudStorageUnavailableError('Sign in required to save images to cloud storage.');
  }

  const { dataUrl, mimeType } = await compressImageForFirestore(file);
  const mediaId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `projects/${projectId}/media/${mediaId}`;

  await setDoc(doc(db, 'projects', projectId, 'media', mediaId), {
    id: mediaId,
    projectId,
    mimeType,
    dataUrl,
    sizeBytes: dataUrl.length,
    createdBy: auth.currentUser.uid,
    createdAt: new Date().toISOString(),
  });

  const url = toFirestoreMediaUrl(projectId, mediaId);
  primeMediaCache(url, dataUrl);

  return {
    url,
    storagePath,
    storageProvider: 'firestore-media',
  };
}

async function isVercelBlobConfigured(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch('/api/blob-token', {
      method: 'GET',
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return false;
    }
    const data = (await res.json()) as { configured?: boolean };
    return data?.configured === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadViaLocalServer(
  file: File,
  safeName: string,
  folder: 'images' | 'maps' | 'objects'
): Promise<UploadImageResult> {
  const base64Data = await fileToDataUrl(file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Data,
      filename: safeName,
      folder,
    }),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Local upload endpoint is not available in this published environment.');
  }
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    filename?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || `Local upload failed (${res.status})`);
  }
  return {
    url: data.url,
    storagePath: `${folder}/${data.filename || safeName}`,
    storageProvider: 'local-ephemeral',
  };
}

async function uploadViaFirebaseStorage(
  file: File,
  storagePath: string
): Promise<UploadImageResult> {
  if (firebaseStorageUnavailable) {
    throw new Error('Firebase Storage is unavailable in this project.');
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const storageRef = ref(storage, storagePath);
    const uploadPromise = (async () => {
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/png',
      });
      return getDownloadURL(storageRef);
    })();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Firebase Storage upload timed out.')), 3500);
    });
    const url = await Promise.race([uploadPromise, timeoutPromise]);
    return { url, storagePath, storageProvider: 'firebase-storage' };
  } catch (err) {
    firebaseStorageUnavailable = true;
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function uploadImageToStorage(
  file: File,
  folder: 'images' | 'maps' | 'objects' = 'images',
  options?: { allowLocalFallback?: boolean; projectId?: string | null }
): Promise<UploadImageResult> {
  const safeName = (file.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${Date.now()}_${safeName}`;
  const allowLocalFallback = options?.allowLocalFallback === true;
  const projectId = options?.projectId?.trim() || null;

  // Tier 1: Vercel Blob (production & Vercel-linked servers)
  const shouldTryVercelBlob = await isVercelBlobConfigured();
  if (shouldTryVercelBlob) {
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const blob = await upload(storagePath, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-token',
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });

      return {
        url: blob.url,
        storagePath: blob.pathname || storagePath,
        storageProvider: 'vercel-blob',
      };
    } catch (blobErr) {
      console.warn('Vercel Blob upload failed, checking fallback storage:', blobErr);
    }
  }

  // Tier 2: Firebase Storage (when bucket is provisioned/enabled)
  if (!firebaseStorageUnavailable) {
    try {
      return await uploadViaFirebaseStorage(file, storagePath);
    } catch (firebaseErr) {
      console.warn('Firebase Storage unavailable:', firebaseErr);
    }
  }

  // Tier 3: Firestore Cloud Media Asset (cross-environment persistent storage across Preview, AI Studio Published, and Vercel)
  if (projectId) {
    try {
      return await uploadViaFirestoreMedia(file, projectId);
    } catch (firestoreMediaErr) {
      console.warn('Firestore media asset fallback failed:', firestoreMediaErr);
      if (!allowLocalFallback) {
        throw firestoreMediaErr instanceof Error
          ? firestoreMediaErr
          : new CloudStorageUnavailableError();
      }
    }
  }

  if (!allowLocalFallback) {
    throw new CloudStorageUnavailableError(
      'Cloud storage (Vercel Blob / Firebase Storage / Firestore Media) is not available for this upload.'
    );
  }

  try {
    return await uploadViaLocalServer(file, safeName, folder);
  } catch (localErr) {
    throw new CloudStorageUnavailableError(
      localErr instanceof Error
        ? `${localErr.message} Configure BLOB_READ_WRITE_TOKEN to upload local files in the published app.`
        : 'Cloud storage is not configured in the published app.'
    );
  }
}

export async function deleteImageFromStorage(urlOrPath?: string): Promise<void> {
  if (!urlOrPath) return;

  const fsMedia = parseFirestoreMediaUrl(urlOrPath);
  if (fsMedia) {
    evictMediaCache(urlOrPath);
    try {
      await deleteDoc(doc(db, 'projects', fsMedia.projectId, 'media', fsMedia.mediaId));
    } catch (err) {
      console.warn('Could not delete Firestore media asset:', err);
    }
    return;
  }

  if (urlOrPath.includes('.blob.vercel-storage.com')) {
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      await fetch('/api/blob-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ url: urlOrPath }),
      });
    } catch (err) {
      console.warn('Could not delete file from Vercel Blob:', err);
    }
    return;
  }

  const localMatch = urlOrPath.match(/^\/uploads\/(images|maps|objects)\/([^/?#]+)/);
  if (localMatch) {
    try {
      await fetch('/api/gallery/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: localMatch[1],
          fileIds: [decodeURIComponent(localMatch[2])],
        }),
      });
    } catch (err) {
      console.warn('Could not delete file from local uploads:', err);
    }
    return;
  }

  if (
    urlOrPath.includes('firebasestorage.googleapis.com') ||
    /^(images|maps|objects)\//.test(urlOrPath)
  ) {
    try {
      await deleteObject(ref(storage, urlOrPath));
    } catch (err) {
      console.warn('Could not delete file from Firebase Storage:', err);
    }
  }
}
