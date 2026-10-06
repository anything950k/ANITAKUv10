import React from 'react';
import { LibraryStatus, MediaCategory } from '../types';

export interface StatusConfigItem {
  label: string;
  icon: (className?: string) => React.ReactNode;
  pillClass: string;
  textColor: string;
}

/**
 * Exact replica of the Anime/Manga Profile Library status icons & color palettes
 */
export const STATUS_CONFIG: Record<LibraryStatus | 'Favorites', StatusConfigItem> = {
  Favorites: {
    label: 'Favorites',
    icon: (className = 'w-[18px] h-[18px] sm:w-5 sm:h-5') => (
      <svg
        viewBox="0 0 24 24"
        className={`${className} fill-[#ff3366] text-[#ff3366] shrink-0`}
        aria-hidden="true"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
    pillClass: 'border-[#e84393] bg-[#351020] text-[#ff4b72] hover:bg-[#e84393]/20',
    textColor: 'text-[#ff4b72]',
  },
  Watching: {
    label: 'Watching',
    icon: (className = 'w-[18px] h-[18px] sm:w-5 sm:h-5') => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} text-[#2ecc71] shrink-0`}
        aria-hidden="true"
      >
        <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
        <path d="M7 21l3.5-4" />
        <path d="M17 21l-3.5-4" />
      </svg>
    ),
    pillClass: 'border-[#2ecc71] bg-[#0e2716] text-[#2ecc71] hover:bg-[#2ecc71]/20',
    textColor: 'text-[#2ecc71]',
  },
  Reading: {
    label: 'Reading',
    icon: (className = 'w-[18px] h-[18px] sm:w-5 sm:h-5') => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} text-white shrink-0`}
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="6.5" y1="9" x2="9" y2="9" strokeWidth="1.8" />
        <line x1="6.5" y1="13" x2="9" y2="13" strokeWidth="1.8" />
        <line x1="15" y1="9" x2="17.5" y2="9" strokeWidth="1.8" />
        <line x1="15" y1="13" x2="17.5" y2="13" strokeWidth="1.8" />
      </svg>
    ),
    pillClass: 'border-[#7f8c8d] bg-[#25282f] text-white hover:bg-white/20',
    textColor: 'text-white',
  },
  'On Hold': {
    label: 'On Hold',
    icon: (className = 'w-[18px] h-[18px] sm:w-5 sm:h-5') => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} text-[#c084fc] shrink-0`}
        aria-hidden="true"
      >
        <rect x="5.5" y="4.5" width="4.5" height="15" rx="1.5" />
        <rect x="14" y="4.5" width="4.5" height="15" rx="1.5" />
      </svg>
    ),
    pillClass: 'border-[#9b59b6] bg-[#26133a] text-[#c084fc] hover:bg-[#9b59b6]/20',
    textColor: 'text-[#c084fc]',
  },
  Planning: {
    label: 'Planning',
    icon: (className = 'w-[18px] h-[18px] sm:w-5 sm:h-5') => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} text-[#f39c12] shrink-0`}
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <line x1="8" y1="9" x2="13" y2="9" />
        <line x1="8" y1="13" x2="16" y2="13" />
      </svg>
    ),
    pillClass: 'border-[#f39c12] bg-[#2d1e08] text-[#f39c12] hover:bg-[#f39c12]/20',
    textColor: 'text-[#f39c12]',
  },
  Completed: {
    label: 'Completed',
    icon: (className = 'w-[18px] h-[18px] sm:w-5 sm:h-5') => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} text-[#4ea8de] shrink-0`}
        aria-hidden="true"
      >
        <path d="M2.5 13.5l4 4L15 6.5" />
        <path d="M8.5 13.5l4 4L21 6.5" />
      </svg>
    ),
    pillClass: 'border-[#3880b8] bg-[#0c2238] text-[#4ea8de] hover:bg-[#3880b8]/20',
    textColor: 'text-[#4ea8de]',
  },
  Dropped: {
    label: 'Dropped',
    icon: (className = 'w-[18px] h-[18px] sm:w-5 sm:h-5') => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} text-[#ff7675] shrink-0`}
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
    pillClass: 'border-[#d63031] bg-[#2f1115] text-[#ff7675] hover:bg-[#d63031]/20',
    textColor: 'text-[#ff7675]',
  },
};

export function getAvailableStatusesForCategory(category: MediaCategory): LibraryStatus[] {
  if (category === 'anime') {
    return ['Watching', 'On Hold', 'Planning', 'Completed', 'Dropped'];
  }
  return ['Reading', 'On Hold', 'Planning', 'Completed', 'Dropped'];
}

export function normalizeMediaStatus(category: MediaCategory, status?: any): LibraryStatus {
  if (!status) {
    return category === 'anime' ? 'Watching' : 'Reading';
  }
  if (category === 'anime' && status === 'Reading') {
    return 'Watching';
  }
  if ((category === 'manga' || category === 'novel') && status === 'Watching') {
    return 'Reading';
  }
  const validStatuses: LibraryStatus[] = ['Watching', 'Reading', 'On Hold', 'Planning', 'Completed', 'Dropped'];
  if (validStatuses.includes(status)) {
    return status;
  }
  return category === 'anime' ? 'Watching' : 'Reading';
}

