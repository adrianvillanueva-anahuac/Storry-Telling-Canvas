import { upload } from '@vercel/blob/client';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from './firebase';

export interface UploadImageResult {
  url: string;
  storagePath: string;
  storageProvider: 'vercel-blob' | 'firebase-storage' | 'local-ephemeral';
}

export class CloudStorageUnavailableError extends Error {
  constructor(message = 'Cloud storage is not configured in this environment.') {
    super(message);
    this.name = 'CloudStorageUnavailableError';
  }
}

let firebaseStorageUnavailable = false;

function fileToDataUrl(file: File): Promise<string> {
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

async function isVercelBlobConfigured(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
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
      timeoutId = setTimeout(() => reject(new Error('Firebase Storage upload timed out.')), 6000);
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
  options?: { allowLocalFallback?: boolean }
): Promise<UploadImageResult> {
  const safeName = (file.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${Date.now()}_${safeName}`;
  const allowLocalFallback = options?.allowLocalFallback !== false;

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

  if (!firebaseStorageUnavailable) {
    try {
      return await uploadViaFirebaseStorage(file, storagePath);
    } catch (firebaseErr) {
      console.warn('Firebase Storage unavailable:', firebaseErr);
    }
  }

  if (!allowLocalFallback) {
    throw new CloudStorageUnavailableError(
      'Cloud storage (Vercel Blob / Firebase Storage) is not configured in this environment.'
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
