import { upload } from '@vercel/blob/client';
import { auth } from './firebase';

export async function uploadImageToStorage(
  file: File,
  folder: 'images' | 'maps' | 'objects' = 'images'
): Promise<{ url: string; storagePath: string }> {
  const safeName = (file.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${Date.now()}_${safeName}`;

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
}

export async function deleteImageFromStorage(urlOrPath?: string): Promise<void> {
  if (!urlOrPath || !urlOrPath.includes('.blob.vercel-storage.com')) return;
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
}
