import { AppState, GalleryImage, UserProfile } from '../types/workflow';

export async function fetchState(): Promise<AppState> {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error('Failed to fetch state');
  return res.json();
}

export async function saveState(state: AppState): Promise<boolean> {
  const res = await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error('Failed to save state');
  const data = await res.json();
  return data.success;
}

export async function loginUser(username: string, pin: string): Promise<UserProfile> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  const data = await res.json();
  return data.user;
}

export async function uploadImageApi(
  base64Data: string,
  filename: string,
  folder = 'images'
): Promise<{ url: string; id: string }> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, filename, folder }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function getGalleryImages(folder = 'images'): Promise<GalleryImage[]> {
  const res = await fetch(`/api/gallery/${folder}`);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteGalleryImages(fileIds: string[], folder = 'images'): Promise<boolean> {
  const res = await fetch('/api/gallery/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, folder }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.success;
}
