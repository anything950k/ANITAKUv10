import {
  MediaItem,
  ScheduleDay,
  UserLibraryEntry,
  RecentActivityItem,
} from '../types';
import * as apiClient from './apiClient';

export * from './apiClient';
export * from './cacheService';
export * from './anifyService';
export * from './logoService';

// Initial User Library (empty by default until user saves/bookmarks)
export const INITIAL_USER_LIBRARY: UserLibraryEntry[] = [];

// Initial starter recent activity (empty by default until user starts watching/reading)
export const INITIAL_RECENT_ACTIVITY: RecentActivityItem[] = [];
