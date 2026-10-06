export type MediaCategory = 'anime' | 'manga' | 'novel';

export type NavTab = 'home' | 'profile' | 'community' | 'schedule' | 'search' | 'settings';

export type LibraryStatus = 'Watching' | 'Reading' | 'On Hold' | 'Planning' | 'Completed' | 'Dropped';

export type AccentColorKey = 'Purple' | 'Blue' | 'Teal' | 'Emerald' | 'Amber' | 'Coral' | 'Rose' | 'Red' | 'Lime';

export interface MediaItem {
  id: string | number;
  title: string;
  englishTitle?: string;
  nativeTitle?: string;
  romajiTitle?: string;
  coverImage: string;
  bannerImage?: string;
  logoImage?: string;
  category: MediaCategory;
  format: 'TV' | 'Movie' | 'ONA' | 'OVA' | 'Special' | 'Manga' | 'Novel' | 'Light Novel';
  status: 'Releasing' | 'Finished' | 'Upcoming' | 'Not Yet Released';
  score: number; // e.g. 8.8
  popularity?: number;
  communityHearts?: number; // e.g. 685, 548
  year: number | string;
  season?: 'Winter' | 'Spring' | 'Summer' | 'Fall';
  seasonYear?: number;
  studio?: string; // e.g. "PIERROT FILMS", "Bibury Animation Studios"
  author?: string; // e.g. "Tatsuki Fujimoto", "Nagatsuki Tappei"
  genres: string[];
  ageRating?: string; // e.g. "R-17+", "PG-13"
  description: string;
  sourceNote?: string; // e.g. "(Source: VIZ Media, edited)"
  totalEpisodes?: number;
  totalChapters?: number;
  totalVolumes?: number;
  duration?: number;
  latestEpisode?: number;
  lastReadChapter?: number;
  currentEpisodeBadge?: string; // e.g. "EP 19", "EP 6"
  nextEpisodeCountdown?: string;
  airingAt?: number;
  isReleased?: boolean;
  releasedTimeAgo?: string;
  baselineEpisode?: number;
  baselineChapter?: number;
  subscribedAt?: number;
  externalRatingCount?: number;
  nextAiringEpisode?: {
    airingTime?: string;
    episode: number;
    airingAt?: number;
    timeUntilAiring?: string | number;
  };
  characters?: Character[];
  voiceActors?: VoiceActor[];
  relations?: RelationItem[];
  recommendations?: RecommendationItem[];
  reviews?: ReviewItem[];
  watchOrder?: WatchOrderItem[];
  hasPrequel?: boolean;
  hasSequel?: boolean;
  idMal?: number | string;
  synonyms?: string[];
}

export interface Character {
  id: string | number;
  name: string;
  nativeName?: string;
  image: string;
  role: 'Main' | 'Supporting' | 'Background' | string;
  quote?: string;
  hearts?: number;
  gender?: string;
  age?: string;
  birthday?: string;
  bloodType?: string;
  race?: string;
  height?: string;
  relatives?: { name: string; relation: string }[];
  bio?: string;
  rawDescription?: string;
  favourites?: number;
  attributes?: { key: string; value: string }[];
  voiceActor?: {
    name: string;
    nativeName?: string;
    image?: string;
    language?: string;
  };
  appearedIn?: {
    id: string | number;
    title: string;
    image: string;
    year: string | number;
    format: string;
    type?: string;
  }[];
}

export interface VoiceActor {
  id: string | number;
  name: string;
  nativeName?: string;
  image: string;
  language?: string;
  characterRole?: string;
}

export interface RelationItem {
  id: string | number;
  title: string;
  relationType: 'Prequel' | 'Sequel' | 'Adaptation' | 'Source' | 'Spin-Off' | 'Side Story' | 'Other' | string;
  coverImage: string;
  bannerImage?: string;
  image?: string;
  format?: string;
  year?: string | number;
  score?: number;
}

export interface RecommendationItem {
  id: string | number;
  title: string;
  coverImage: string;
  score: number;
  category?: MediaCategory;
  format?: string;
  year?: string | number;
}

export interface ReviewItem {
  id: string | number;
  authorName: string;
  authorAvatar: string;
  score: number | string; // e.g. "9.8/10"
  helpfulCount: number;
  totalVotes: number;
  headline?: string;
  content: string;
  date?: string;
}

export interface EpisodeItem {
  id: string | number;
  number: number;
  title: string;
  thumbnail?: string;
  airDate?: string;
  duration?: string;
  filler?: boolean;
  providerId?: string;
  airingAt?: number;
  isReleased?: boolean;
}

export interface MangaChapterItem {
  id: string;
  chapterNumber: number;
  title: string;
  volume?: string;
  pages?: number;
  publishAt?: string;
  scanlationGroup?: string;
}

export interface NovelChapterItem {
  id: string;
  chapterNumber: number;
  title: string;
  volume?: number | string;
  coverImage?: string;
  updatedAt?: number;
  providerId?: string;
}

export interface WatchOrderItem {
  id: string | number;
  orderNumber: number;
  title: string;
  englishTitle?: string;
  franchiseTitle?: string;
  coverImage?: string;
  type?: string;
  score?: number | string;
  memberCount?: string;
  ratingText?: string;
  episodes?: number;
  malId?: number | string;
  anilistId?: number | string;
  year?: number | string;
}

export interface ScheduleDayItem {
  id: string | number;
  airingTime: string;
  airingAt?: number;
  episodeNumber: number;
  timeUntilAiring?: string;
  isReleased?: boolean;
  releasedTimeAgo?: string;
  media: MediaItem;
}

export interface ScheduleDay {
  day: string;
  date: string;
  dayName?: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  dateNumber?: number;
  isToday?: boolean;
  items: ScheduleDayItem[];
}

export interface ScheduleItem {
  id: string | number;
  animeId?: string | number;
  title?: string;
  coverImage?: string;
  episodeNumber: number;
  timeString?: string; // e.g. "5:30 AM", "6:26 AM"
  timeCategory?: string;
}

export interface UpcomingItem {
  id: string | number;
  title: string;
  coverImage: string;
  seasonYear: string; // e.g. "Fall 2026"
  format: 'TV' | 'Movie' | 'Special' | 'All';
  genres?: string[];
  score?: number;
}

export interface MangaReadingHistoryItem {
  id: string | number;
  mediaId: string | number;
  title: string;
  coverImage: string;
  bannerImage?: string;
  category: MediaCategory;
  lastReadChapter: number;
  lastReadChapterId?: string;
  lastReadPage?: number;
  lastReadTime: number;
  score?: number;
  genres?: string[];
  description?: string;
  totalChapters?: number;
}

export interface AnimeWatchHistoryItem {
  id: string | number;
  mediaId: string | number;
  title: string;
  coverImage: string;
  bannerImage?: string;
  category: MediaCategory;
  lastWatchedEpisode: number;
  lastWatchedTime?: number;
  currentTime?: number;
  duration?: number;
  progressPercent?: number;
  score?: number;
  genres?: string[];
  description?: string;
  totalEpisodes?: number;
}

export interface UserLibraryEntry {
  id: string | number;
  mediaId: string | number;
  title: string;
  coverImage: string;
  category: MediaCategory;
  status: LibraryStatus;
  currentProgress: number; // e.g. watched 13
  totalCount: number; // e.g. total 16
  lastUpdated: string;
  score?: number;
  isFavorite?: boolean;
}

export interface RecentActivityItem {
  id: string | number;
  mediaId: string | number;
  title: string;
  coverImage: string;
  type: 'READING' | 'WATCHING' | 'COMPLETED';
  progressText?: string;
  timeAgo: string; // e.g. "15 days ago"
}

export interface ReleaseNotification {
  id: string;
  mediaId: string | number;
  media: MediaItem;
  title: string;
  coverImage: string;
  episodeNumber: number;
  episodeText: string; // e.g. "Episode 19 has aired!"
  dateLabel: string; // e.g. "3 days ago", "August 19"
  timestamp: number;
}

export interface FilterOptions {
  category: MediaCategory;
  query: string;
  genres: string[];
  format: string[];
  status: string[];
  libraryState: 'Any' | 'In Library' | 'Not In Library';
  minScore: 'Any' | '6+' | '7+' | '8+' | '9+';
  scoreRange: [number, number]; // [0, 100]
  selectedYear: string; // 'Any' or specific year like '2026'
  yearRange: [number, number]; // [1940, 2028]
  season: string[];
  studio: string;
  tagCategory: 'Theme' | 'Demographic' | 'Setting' | 'Cast' | 'Technical';
  advancedTags: string[];
}

export interface SettingsState {
  // General
  appLanguage: string;
  appHaptics: boolean;
  deviceNotifications: boolean;
  dns: string;
  enableTrailers: boolean;
  trailersStartMuted: boolean;
  cacheLimit: string;

  // Appearance
  pureBlackMode: boolean;
  accentColor: AccentColorKey;
  enableLiquidGlass?: boolean;
  glassBlur: number;
  glassSaturation: number;
  glassRefraction: number;
  glassTint: number;

  // Content
  homepageMetadata: string;
  titleLanguage: string;
  ratingFormat: string;
  showLibraryProgress: boolean;
  fillerList: boolean;

  // Playback
  gestures: boolean;
  ambientLight: boolean;
  autoSkipFiller: boolean;
  sleepTimer: string;
  videoQuality: string;
  audioPreference: string;
  subtitleLanguage: string;
  subtitlePreference: string;
  subtitleFont: string;
  subtitleSize: number;
  subtitleElevation: number;
  subtitleTextColor?: string;
  subtitleEdgeStyle?: string;
  subtitleEdgeColor?: string;
  subtitleBackground?: string;
  playbackSpeed: string;

  // Reader
  mangaReaderMode: 'Automatic' | 'Paged' | 'Vertical' | 'Webtoon' | string;
  pageTurnAnimation: string;
  pagedReaderDirection: 'Left to Right' | 'Right to Left' | 'Vertical' | string;
  imageScale: 'Fit' | 'Width' | 'Fit Width' | 'Fit Height' | 'Original' | 'Original Size' | 'Fill' | 'Stretch' | string;
  zoomStart: 'Auto' | 'Left' | 'Center' | 'Right' | string;
  tapNavigation: 'Edges' | 'Disabled' | 'Default' | string;
  readerBackground: 'Black' | 'Dark' | 'Dark Gray' | 'Light' | 'White' | string;
  cropBorders: boolean;
  webtoonCropBorders: boolean;
  automaticWebtoon: boolean;
  widePageZoom: boolean;
  keepScreenOn: boolean;
  preloadPages: number;

  // Downloads
  downloadPath: string;
  downloadUri?: string;
  downloadPermissionGranted?: boolean;
  deleteFilesByDefault: boolean;
}
