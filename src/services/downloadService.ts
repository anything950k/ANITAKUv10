import { safeGetItem, safeSetItem } from '../utils/storage';

export interface AppDownloadItem {
  id: string; // e.g. `${mediaId}_${category}_${number}`
  mediaId: string | number;
  mediaTitle: string;
  mediaCategory: 'anime' | 'manga' | 'novel';
  coverImage?: string;
  bannerImage?: string;
  itemNumber: number;
  formattedNumber: string; // e.g. "01", "02"
  title: string;
  fileSize: string; // e.g. "47.1MB"
  fileSizeBytes: number;
  status: 'completed' | 'downloading' | 'queued';
  progress: number; // 0-100
  createdAt: number;
}

const DOWNLOADS_STORAGE_KEY = 'satori_app_downloads_list_v1';
const DOWNLOADS_EVENT = 'satori-downloads-updated';

// Helper to compute deterministic realistic file size
export function getEstimatedFileSize(category: 'anime' | 'manga' | 'novel', itemNumber: number): { text: string; bytes: number } {
  // Base numbers seeded deterministically by item number
  const seed = (Math.sin(itemNumber * 997) + 1) / 2; // 0 to 1
  if (category === 'anime') {
    // 44MB to 54MB
    const mbStr = (44 + seed * 10).toFixed(1);
    return { text: `${mbStr}MB`, bytes: Math.round(parseFloat(mbStr) * 1024 * 1024) };
  } else if (category === 'manga') {
    // 26MB to 38MB
    const mbStr = (26 + seed * 12).toFixed(1);
    return { text: `${mbStr}MB`, bytes: Math.round(parseFloat(mbStr) * 1024 * 1024) };
  } else {
    // 3.2MB to 6.8MB
    const mbStr = (3.2 + seed * 3.6).toFixed(1);
    return { text: `${mbStr}MB`, bytes: Math.round(parseFloat(mbStr) * 1024 * 1024) };
  }
}

export function getAllDownloads(): AppDownloadItem[] {
  return safeGetItem<AppDownloadItem[]>(DOWNLOADS_STORAGE_KEY, [], true);
}

export function saveAllDownloads(items: AppDownloadItem[]): void {
  safeSetItem(DOWNLOADS_STORAGE_KEY, items, true);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DOWNLOADS_EVENT, { detail: items }));
  }
}

export function isItemDownloaded(mediaId: string | number, category: string, itemNumber: number): boolean {
  const all = getAllDownloads();
  const targetId = `${mediaId}_${category}_${itemNumber}`;
  return all.some((item) => item.id === targetId && item.status === 'completed');
}

export function isItemDownloading(mediaId: string | number, category: string, itemNumber: number): boolean {
  const all = getAllDownloads();
  const targetId = `${mediaId}_${category}_${itemNumber}`;
  return all.some((item) => item.id === targetId && (item.status === 'downloading' || item.status === 'queued'));
}

export function addDownloadItem(item: Omit<AppDownloadItem, 'createdAt'>): void {
  const all = getAllDownloads();
  const index = all.findIndex((i) => i.id === item.id);
  const newItem: AppDownloadItem = {
    ...item,
    createdAt: Date.now(),
  };

  if (index >= 0) {
    all[index] = newItem;
  } else {
    all.unshift(newItem);
  }

  saveAllDownloads(all);
}

export function addBatchDownloadItems(items: Omit<AppDownloadItem, 'createdAt'>[]): void {
  const all = getAllDownloads();
  const now = Date.now();

  items.forEach((item, idx) => {
    const existingIdx = all.findIndex((i) => i.id === item.id);
    const newItem: AppDownloadItem = {
      ...item,
      createdAt: now + idx,
    };
    if (existingIdx >= 0) {
      all[existingIdx] = newItem;
    } else {
      all.unshift(newItem);
    }
  });

  saveAllDownloads(all);
}

export function removeDownloadItem(id: string): void {
  const all = getAllDownloads();
  const filtered = all.filter((i) => i.id !== id);
  saveAllDownloads(filtered);
}

export function clearAllDownloads(): void {
  saveAllDownloads([]);
}

export function subscribeToDownloads(callback: (items: AppDownloadItem[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    callback(getAllDownloads());
  };

  window.addEventListener(DOWNLOADS_EVENT, handler);
  return () => {
    window.removeEventListener(DOWNLOADS_EVENT, handler);
  };
}
