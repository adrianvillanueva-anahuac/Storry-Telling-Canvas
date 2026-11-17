import { upload } from '@vercel/blob/client';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from './firebase';

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
  try {
    const res = await fetch('/api/blob-token', { method: 'GET' });
    if (res.ok) {
      const data = (await res.json()) as { configured?: boolean };
      if (data && data.configured === false) {
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

async function uploadViaLocalServer(
  file: File,
  safeName: string,
  folder: 'images' | 'maps' | 'objects'
): Promise<{ url: string; storagePath: string }> {
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Local upload failed (${res.status})`);
  }
  const data = (await res.json()) as { url?: string; filename?: string };
  if (!data.url) {
    throw new Error('Local upload did not return an image URL.');
  }
  return {
    url: data.url,
    storagePath: `${folder}/${data.filename || safeName}`,
  };
}

async function uploadViaFirebaseStorage(
  file: File,
  storagePath: string
): Promise<{ url: string; storagePath: string }> {
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'image/png',
  });
  const url = await getDownloadURL(storageRef);
  return { url, storagePath };
}

export async function uploadImageToStorage(
  file: File,
  folder: 'images' | 'maps' | 'objects' = 'images'
): Promise<{ url: string; storagePath: string }> {
  const safeName = (file.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${Date.now()}_${safeName}`;

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
      };
    } catch (blobErr) {
      console.warn('Vercel Blob upload unavailable, falling back to server/Firebase storage:', blobErr);
    }
  }

  try {
    return await uploadViaLocalServer(file, safeName, folder);
  } catch (localErr) {
    console.warn('Local /api/upload unavailable, falling back to Firebase Storage:', localErr);
    return await uploadViaFirebaseStorage(file, storagePath);
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
