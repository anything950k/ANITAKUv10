import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Heart,
  BookOpen,
  Bookmark,
  CheckCheck,
  Trash2,
  Tv,
  Pause,
  FileText,
  ChevronRight,
  ArrowLeft,
  Search,
  Plus,
  X,
  UserCheck,
  Sparkles,
  Star,
  Download,
  RotateCw,
  Check,
  Pencil,
  Camera,
  Image as ImageIcon,
  Info,
  Lock,
  Upload,
  Coins,
  Quote,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LibraryStatus, MediaCategory, MediaItem, UserLibraryEntry } from '../../types';
import { PosterImage } from '../common/PosterImage';
import { STATUS_CONFIG } from '../../utils/libraryStatus';
import { safeGetItem, safeSetItem } from '../../utils/storage';
import { AppToggleSwitch } from '../common/AppToggleSwitch';
import { ProfileStatusPills } from './ProfileStatusPills';
import { DownloadManagerSheet } from './DownloadManagerSheet';

// Avatar Frame definitions matching screenshot styling
export interface AvatarFrameOption {
  id: string;
  name: string;
  shortName: string;
  frameClasses: string;
  previewRing: string;
}

export const AVATAR_FRAMES: AvatarFrameOption[] = [
  {
    id: 'none',
    name: 'No Frame',
    shortName: 'No Frame',
    frameClasses: 'border-2 border-white/20',
    previewRing: 'border-2 border-white/20',
  },
  {
    id: 'king-crown',
    name: 'King Crown Avatar',
    shortName: 'King Crown',
    frameClasses: 'p-1 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 shadow-[0_0_20px_rgba(234,179,8,0.9)] ring-2 ring-amber-300/60',
    previewRing: 'p-1 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 shadow-[0_0_12px_rgba(234,179,8,0.7)]',
  },
  {
    id: 'sakura-flower',
    name: 'Sakura flower Avatar',
    shortName: 'Sakura flower',
    frameClasses: 'p-1 rounded-full bg-gradient-to-tr from-rose-600 via-pink-400 to-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.9)] ring-2 ring-pink-300/60',
    previewRing: 'p-1 rounded-full bg-gradient-to-tr from-rose-600 via-pink-400 to-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.7)]',
  },
  {
    id: 'fire-ring',
    name: 'Fire Ring Avatar',
    shortName: 'Fire Ring',
    frameClasses: 'p-1 rounded-full bg-gradient-to-tr from-red-600 via-orange-500 to-amber-300 shadow-[0_0_22px_rgba(249,115,22,0.95)] ring-2 ring-orange-400/60 animate-pulse',
    previewRing: 'p-1 rounded-full bg-gradient-to-tr from-red-600 via-orange-500 to-amber-300 shadow-[0_0_12px_rgba(249,115,22,0.7)] animate-pulse',
  },
  {
    id: 'frozen-ring',
    name: 'Frozen Ring Avatar',
    shortName: 'Frozen Ring',
    frameClasses: 'p-1 rounded-full bg-gradient-to-tr from-cyan-600 via-sky-400 to-blue-200 shadow-[0_0_20px_rgba(6,182,212,0.9)] ring-2 ring-cyan-300/60',
    previewRing: 'p-1 rounded-full bg-gradient-to-tr from-cyan-600 via-sky-400 to-blue-200 shadow-[0_0_12px_rgba(6,182,212,0.7)]',
  },
];

// Preset Anime Avatars & Banners
const PRESET_AVATARS = [
  { id: 'md-blue', name: 'Default Blue MD', type: 'initials', color: '#0091FF' },
  { id: 'purple-neon-md', name: 'Neon Purple MD', type: 'initials', color: '#8B5CF6' },
  { id: 'crimson-md', name: 'Crimson Flame MD', type: 'initials', color: '#EF4444' },
  { id: 'emerald-md', name: 'Emerald Sage MD', type: 'initials', color: '#10B981' },
  { id: 'anime-protag', name: 'Anime Protagonist', type: 'image', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80' },
  { id: 'starlight-heroine', name: 'Starlight Heroine', type: 'image', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80' },
  { id: 'cyber-hunter', name: 'Cyber Hunter', type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80' },
  { id: 'celestial-spirit', name: 'Celestial Spirit', type: 'image', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80' },
];

const PRESET_BANNERS = [
  { id: 'starry-sky', name: 'Starry Sky Library (Default)', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80' },
  { id: 'celestial-galaxy', name: 'Celestial Deep Cosmos', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&auto=format&fit=crop&q=80' },
  { id: 'neon-city', name: 'Neon Cyberpunk Metropolis', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&auto=format&fit=crop&q=80' },
  { id: 'sunset-shrine', name: 'Sunset Shrine Horizon', url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=1200&auto=format&fit=crop&q=80' },
  { id: 'aurora-lights', name: 'Emerald Aurora Horizon', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&auto=format&fit=crop&q=80' },
];

export const ProfileView: React.FC = () => {
  const {
    userLibrary,
    userFavorites,
    recentActivity,
    openMediaDetails,
    activeLibraryStatus,
    setActiveLibraryStatus,
    removeFromLibrary,
    updateLibraryProgress,
    isMediaFavorite,
    toggleFavorite,
    showToast,
    setIsProfileSheetOpen,
    setActiveNav,
  } = useApp();

  // Search filter inside status subpage
  const [subpageSearch, setSubpageSearch] = useState('');

  // Fullscreen Profile Options Sheet & Edit Profile Sheet state
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [showEditProfileSheet, setShowEditProfileSheet] = useState(false);
  const [showDownloadManager, setShowDownloadManager] = useState(false);
  const [showAvatarPickerModal, setShowAvatarPickerModal] = useState(false);
  const [showBannerPickerModal, setShowBannerPickerModal] = useState(false);

  // Sync sheet open state with global bottom nav visibility
  useEffect(() => {
    setIsProfileSheetOpen(
      Boolean(
        showOptionsSheet ||
        showEditProfileSheet ||
        showAvatarPickerModal ||
        showBannerPickerModal ||
        showDownloadManager
      )
    );
    return () => {
      setIsProfileSheetOpen(false);
    };
  }, [
    showOptionsSheet,
    showEditProfileSheet,
    showAvatarPickerModal,
    showBannerPickerModal,
    showDownloadManager,
    setIsProfileSheetOpen,
  ]);

  const [isGoogleConnected, setIsGoogleConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Profile data state (persisted in LocalStorage)
  const [profileName, setProfileName] = useState(() => {
    return safeGetItem('satori_profile_name', 'MD');
  });
  const [profileBio, setProfileBio] = useState(() => {
    return safeGetItem('satori_profile_bio', '');
  });
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(() => {
    return safeGetItem('satori_profile_avatar', '');
  });
  const [profileBannerUrl, setProfileBannerUrl] = useState(() => {
    return safeGetItem(
      'satori_profile_banner',
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80'
    );
  });
  const [profileAvatarFrame, setProfileAvatarFrame] = useState(() => {
    return safeGetItem('satori_profile_avatar_frame', 'none');
  });
  const [isProfileLocked, setIsProfileLocked] = useState(() => {
    return safeGetItem<string>('satori_profile_locked', 'false') === 'true';
  });
  const [profileSource, setProfileSource] = useState(() => {
    return safeGetItem('satori_profile_source', 'Google library');
  });
  const [profileLevel, setProfileLevel] = useState(() => {
    return safeGetItem('satori_profile_level', '2');
  });

  // Draft States for Edit Profile Sheet
  const [draftName, setDraftName] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftAvatarUrl, setDraftAvatarUrl] = useState('');
  const [draftBannerUrl, setDraftBannerUrl] = useState('');
  const [draftAvatarFrame, setDraftAvatarFrame] = useState('none');
  const [draftIsLocked, setDraftIsLocked] = useState(false);

  // Custom Image URL / Upload inputs in pickers
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [customBannerInput, setCustomBannerInput] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  // Immediate synchronous sheet actions for 0ms bottom bar hiding/restoring
  const handleOpenOptionsSheet = () => {
    setIsProfileSheetOpen(true);
    setShowOptionsSheet(true);
  };

  const handleCloseOptionsSheet = () => {
    setShowOptionsSheet(false);
    setShowDownloadManager(false);
    setShowEditProfileSheet(false);
    setShowAvatarPickerModal(false);
    setShowBannerPickerModal(false);
    setIsProfileSheetOpen(false);
  };

  // Open Edit Profile Sheet with current values (instant 0ms)
  const handleOpenEditProfileSheet = () => {
    setDraftName(profileName);
    setDraftBio(profileBio);
    setDraftAvatarUrl(profileAvatarUrl);
    setDraftBannerUrl(profileBannerUrl);
    setDraftAvatarFrame(profileAvatarFrame);
    setDraftIsLocked(isProfileLocked);
    setIsProfileSheetOpen(true);
    setShowOptionsSheet(false);
    setShowEditProfileSheet(true);
  };

  const handleCloseEditProfileSheet = () => {
    setShowEditProfileSheet(false);
    setShowOptionsSheet(true);
    setIsProfileSheetOpen(true);
  };

  const handleOpenDownloadManager = () => {
    setIsProfileSheetOpen(true);
    setShowDownloadManager(true);
  };

  const handleCloseDownloadManager = () => {
    setShowDownloadManager(false);
    // When exiting Download Manager sheet, stay on Profile Options sheet with nav bar strictly hidden (None)
    setShowOptionsSheet(true);
    setIsProfileSheetOpen(true);
  };

  const handleBackToLibrary = () => {
    setShowDownloadManager(false);
    setShowOptionsSheet(false);
    setShowEditProfileSheet(false);
    setShowAvatarPickerModal(false);
    setShowBannerPickerModal(false);
    setIsProfileSheetOpen(false);
    setActiveLibraryStatus(null);
    setActiveNav('profile');

    // Smooth scroll directly to the profile library tabs
    setTimeout(() => {
      const libraryTabsEl = document.getElementById('profile-library-tabs');
      if (libraryTabsEl) {
        libraryTabsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Save all profile changes
  const handleSaveProfileChanges = () => {
    const finalName = draftName.trim() || 'MD';
    setProfileName(finalName);
    setProfileBio(draftBio);
    setProfileAvatarUrl(draftAvatarUrl);
    setProfileBannerUrl(draftBannerUrl);
    setProfileAvatarFrame(draftAvatarFrame);
    setIsProfileLocked(draftIsLocked);

    safeSetItem('satori_profile_name', finalName, false);
    safeSetItem('satori_profile_bio', draftBio, false);
    safeSetItem('satori_profile_avatar', draftAvatarUrl, false);
    safeSetItem('satori_profile_banner', draftBannerUrl, false);
    safeSetItem('satori_profile_avatar_frame', draftAvatarFrame, false);
    safeSetItem('satori_profile_locked', draftIsLocked ? 'true' : 'false', false);

    setShowEditProfileSheet(false);
    setShowOptionsSheet(false);
    setShowDownloadManager(false);
    setShowAvatarPickerModal(false);
    setShowBannerPickerModal(false);
    setIsProfileSheetOpen(false);
    showToast('Profile updated successfully');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isBanner: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (isBanner) {
          setDraftBannerUrl(reader.result);
          setShowBannerPickerModal(false);
          showToast('Custom banner loaded');
        } else {
          setDraftAvatarUrl(reader.result);
          setShowAvatarPickerModal(false);
          showToast('Custom avatar loaded');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSyncGoogle = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    showToast('Syncing with Google library...');
    setTimeout(() => {
      setIsSyncing(false);
      showToast('Google library synced successfully');
    }, 1200);
  };

  const handleToggleGoogle = () => {
    if (isGoogleConnected) {
      setIsGoogleConnected(false);
      showToast('Google account disconnected');
    } else {
      setIsGoogleConnected(true);
      showToast('Google account connected');
    }
  };

  const renderAvatarWithFrame = (
    frameId: string,
    name: string,
    avatarUrl?: string,
    sizeClass = 'w-16 h-16 sm:w-18 sm:h-18',
    textClass = 'text-2xl sm:text-3xl'
  ) => {
    const frame = AVATAR_FRAMES.find((f) => f.id === frameId) || AVATAR_FRAMES[0];
    const initials = (name || 'MD').slice(0, 2).toUpperCase();

    const innerAvatar = avatarUrl && avatarUrl.trim() !== '' ? (
      <img
        src={avatarUrl.trim()}
        alt={name || 'Avatar'}
        className="w-full h-full rounded-full object-cover object-center"
      />
    ) : (
      <div className={`w-full h-full rounded-full bg-[#0091FF] text-white flex items-center justify-center font-black ${textClass}`}>
        {initials}
      </div>
    );

    if (frame.id === 'none') {
      return (
        <div className={`${sizeClass} rounded-full border-2 border-white/20 shadow-[0_0_25px_rgba(0,145,255,0.4)] shrink-0 overflow-hidden`}>
          {innerAvatar}
        </div>
      );
    }

    return (
      <div className={`${sizeClass} shrink-0 flex items-center justify-center ${frame.frameClasses}`}>
        <div className="w-full h-full rounded-full overflow-hidden bg-black/60 p-0.5">
          {innerAvatar}
        </div>
      </div>
    );
  };

  const getMediaForEntry = (
    mediaId: string | number,
    fallbackTitle: string,
    fallbackCover: string,
    category?: MediaCategory
  ): MediaItem => {
    return {
      id: String(mediaId),
      title: fallbackTitle,
      coverImage: fallbackCover,
      category: category || 'anime',
      format: category === 'manga' ? 'Manga' : category === 'novel' ? 'Light Novel' : 'TV',
      status: 'Releasing',
      score: 8.5,
      year: 2026,
      genres: ['Action', 'Adventure'],
      description: 'Media in your personal library collection.',
    };
  };

  // Real Dynamic Status Counts derived directly from user activity
  const favoritesCount = userFavorites.length;
  const watchingCount = userLibrary.filter((i) => i.status === 'Watching' && i.category === 'anime').length;
  const readingCount = userLibrary.filter((i) => i.status === 'Reading' && (i.category === 'manga' || i.category === 'novel')).length;
  const onHoldCount = userLibrary.filter((i) => i.status === 'On Hold').length;
  const planningCount = userLibrary.filter((i) => i.status === 'Planning').length;
  const completedCount = userLibrary.filter((i) => i.status === 'Completed').length;
  const droppedCount = userLibrary.filter((i) => i.status === 'Dropped').length;

  // Active watching items (only anime episodes)
  const activeWatchingEntries = userLibrary.filter((i) => i.status === 'Watching' && i.category === 'anime');
  const watchingGridItems = activeWatchingEntries.slice(0, 4);

  // Active reading items (only manga & novel chapters)
  const activeReadingEntries = userLibrary.filter((i) => i.status === 'Reading' && (i.category === 'manga' || i.category === 'novel'));
  const readingGridItems = activeReadingEntries.slice(0, 4);

  // Filter items for subpage view
  const filteredFavorites = userFavorites.filter((i) =>
    i.title.toLowerCase().includes(subpageSearch.toLowerCase())
  );

  const filteredLibraryItems = userLibrary
    .filter((i) => {
      if (activeLibraryStatus === 'Watching') {
        return i.status === 'Watching' && i.category === 'anime';
      }
      if (activeLibraryStatus === 'Reading') {
        return i.status === 'Reading' && (i.category === 'manga' || i.category === 'novel');
      }
      return i.status === activeLibraryStatus;
    })
    .filter((i) => i.title.toLowerCase().includes(subpageSearch.toLowerCase()));

  return (
    <div className="w-full min-h-screen bg-black text-white pb-32 select-none">
      {/* If subpage is active, render category subview */}
      {activeLibraryStatus ? (
        <div className="w-full max-w-xl mx-auto px-4 sm:px-6 pt-5 space-y-4">
          {/* Subpage Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveLibraryStatus(null);
                  setSubpageSearch('');
                }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="tab-title-text drop-shadow-md">
                  {activeLibraryStatus}
                </h1>
                <p className="text-xs text-white/50">
                  {activeLibraryStatus === 'Favorites'
                    ? `${filteredFavorites.length} favorite titles in your profile`
                    : `${filteredLibraryItems.length} items in your collection`}
                </p>
              </div>
            </div>
          </div>

          {/* Status switcher pills in subpage */}
          <div className="-mx-4 sm:-mx-6 mb-2">
            <ProfileStatusPills
              activeStatus={activeLibraryStatus}
              onSelectStatus={(status) => {
                setActiveLibraryStatus(status as LibraryStatus | 'Favorites');
                setSubpageSearch('');
              }}
              counts={{
                favorites: favoritesCount,
                watching: watchingCount,
                reading: readingCount,
                onHold: onHoldCount,
                planning: planningCount,
                completed: completedCount,
                dropped: droppedCount,
              }}
            />
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={subpageSearch}
              onChange={(e) => setSubpageSearch(e.target.value)}
              placeholder={`Search in ${activeLibraryStatus}...`}
              className="w-full bg-[#12141C] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* List items */}
          <div className="space-y-3 pt-1">
            {activeLibraryStatus === 'Favorites' ? (
              filteredFavorites.length === 0 ? (
                <div className="py-20 text-center space-y-2">
                  <Heart className="w-8 h-8 text-rose-500/40 mx-auto" />
                  <p className="text-sm font-semibold text-white/60">No favorites added yet</p>
                  <p className="text-xs text-white/40">
                    Tap the Heart icon on any title details page to save it to your Favorites.
                  </p>
                </div>
              ) : (
                filteredFavorites.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => openMediaDetails(item)}
                    className="flex items-center gap-3.5 p-3 bg-[#11131A] rounded-2xl border border-white/10 hover:border-pink-500/40 transition-all cursor-pointer shadow-lg group"
                  >
                    <PosterImage
                      src={item.coverImage}
                      alt={item.title}
                      className="w-14 h-20 rounded-xl shadow-md shrink-0"
                      imgClassName="group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-pink-300 transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-white/60">
                        <span className="capitalize px-2 py-0.5 rounded-full bg-white/10 font-bold text-[10px] text-white/80">
                          {item.category}
                        </span>
                        {item.score && (
                          <div className="flex items-center gap-1 text-amber-400 font-bold text-[11px]">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{item.score}</span>
                          </div>
                        )}
                        {item.year && <span className="text-[10px] text-white/40">{item.year}</span>}
                      </div>
                      <p className="text-[10px] text-white/40 mt-1 capitalize">
                        {item.format || 'Media'} · {item.status || 'Active'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleFavorite(item)}
                        className="p-2.5 rounded-full transition-colors cursor-pointer text-rose-500 bg-rose-500/10 hover:bg-rose-500/20"
                        title="Remove from favorites"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              filteredLibraryItems.length === 0 ? (
                <div className="py-20 text-center space-y-2">
                  <p className="text-sm font-semibold text-white/60">No items found in {activeLibraryStatus}</p>
                  <p className="text-xs text-white/40">Explore media from the Home tab and add them to your library.</p>
                </div>
              ) : (
                filteredLibraryItems.map((entry) => {
                  const fullMedia = getMediaForEntry(entry.mediaId, entry.title, entry.coverImage, entry.category);
                  const isFav = isMediaFavorite(entry.mediaId);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => openMediaDetails(fullMedia)}
                      className="flex items-center gap-3.5 p-3 bg-[#11131A] rounded-2xl border border-white/10 hover:border-purple-500/40 transition-all cursor-pointer shadow-lg group"
                    >
                      <PosterImage
                        src={entry.coverImage}
                        alt={entry.title}
                        className="w-14 h-20 rounded-xl shadow-md shrink-0"
                        imgClassName="group-hover:scale-105 transition-transform"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                          {entry.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-white/60">
                          <span className="capitalize px-2 py-0.5 rounded-full bg-white/10 font-bold text-[10px] text-white/80">
                            {entry.category}
                          </span>
                          <span>
                            {entry.category === 'anime' ? 'Ep' : 'Ch'} {entry.currentProgress} / {entry.totalCount}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-1">Updated {entry.lastUpdated}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleFavorite(fullMedia)}
                          className={`p-2 rounded-full transition-colors cursor-pointer ${
                            isFav ? 'text-rose-500 bg-rose-500/10' : 'text-white/40 hover:text-white bg-white/5'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => removeFromLibrary(entry.mediaId)}
                          className="p-2 rounded-full text-white/40 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 1. USER HEADER SECTION WITH ARTWORK BACKDROP */}
          <div className="relative w-full h-[320px] sm:h-[360px] overflow-hidden">
            {/* Backdrop Artwork */}
            <div className="absolute inset-0">
              <img
                src={profileBannerUrl || "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80"}
                alt="Profile Backdrop"
                className="w-full h-full object-cover object-center opacity-85"
              />
              {/* Dark Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 via-40% to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
            </div>

            {/* Top-Left Level Indicator Badge */}
            <div className="absolute top-6 left-6 z-10 flex flex-col items-start select-none">
              <span className="text-4xl sm:text-5xl font-black text-white leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] tracking-tight">
                {profileLevel}
              </span>
              <span className="text-[10px] font-extrabold text-white/90 uppercase tracking-[0.2em] leading-none mt-1 drop-shadow-md">
                LEVEL
              </span>
            </div>

            {/* User Identity Row & Edit Profile Button */}
            <div className="absolute bottom-4 left-0 right-0 px-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3.5 min-w-0 pr-3">
                {/* Circular Avatar with Applied Frame */}
                {renderAvatarWithFrame(
                  profileAvatarFrame,
                  profileName,
                  profileAvatarUrl,
                  'w-[82px] h-[82px] sm:w-[92px] sm:h-[92px]',
                  'text-[30px] sm:text-[35px]'
                )}

                <div className="flex flex-col min-w-0 justify-center">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[20.5px] sm:text-[23px] font-black text-white leading-tight drop-shadow-md truncate">
                      {profileName}
                    </h1>
                  </div>
                  <span className="text-[12px] sm:text-[12.5px] text-white/70 font-medium drop-shadow-sm mt-0.5 truncate">
                    {profileSource}
                  </span>
                  {profileBio && (
                    <p className="text-xs sm:text-sm text-white/90 font-medium mt-0.5 line-clamp-1 italic text-purple-200/90 drop-shadow-sm">
                      "{profileBio}"
                    </p>
                  )}
                </div>
              </div>

              {/* Top-Right Profile Edit Icon Button matching Screenshot */}
              <button
                onClick={handleOpenOptionsSheet}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-white/20 backdrop-blur-md border-[2.2px] border-[#e2e5ea] flex items-center justify-center text-white cursor-pointer shadow-lg transition-all active:scale-95 shrink-0"
                aria-label="Edit Profile Options"
              >
                <Pencil className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white" strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* 2. HORIZONTAL SLIDING CATEGORY CAPSULES */}
          <div id="profile-library-tabs" className="w-full mt-3 scroll-mt-20">
            <ProfileStatusPills
              activeStatus={activeLibraryStatus}
              onSelectStatus={(status) => setActiveLibraryStatus(status as LibraryStatus | 'Favorites')}
              counts={{
                favorites: favoritesCount,
                watching: watchingCount,
                reading: readingCount,
                onHold: onHoldCount,
                planning: planningCount,
                completed: completedCount,
                dropped: droppedCount,
              }}
            />
          </div>

          {/* 3. WATCHING & READING ACTIVE CONTAINER BOXES MATCHING SCREENSHOT */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 px-4 mt-5">
            {/* Watching Container */}
            <div className="space-y-2">
              <div
                onClick={() => setActiveLibraryStatus('Watching')}
                className="flex items-center gap-1.5 cursor-pointer group select-none"
              >
                <span className="font-extrabold text-[18px] sm:text-[20px] text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                  Watching
                </span>
                <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/60 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Dynamic Auto-sizing Card */}
              <div 
                onClick={() => {
                  if (watchingGridItems.length === 0) setActiveLibraryStatus('Watching');
                }}
                className="bg-[#10131c] rounded-[22px] sm:rounded-[26px] p-2 sm:p-2.5 border-[2px] border-[#252b3b] shadow-xl hover:border-[#353e54] transition-all"
              >
                {watchingGridItems.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {watchingGridItems.map((entry) => {
                      const media = getMediaForEntry(entry.mediaId, entry.title, entry.coverImage, entry.category);
                      return (
                        <div
                          key={entry.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openMediaDetails(media);
                          }}
                          className="aspect-square rounded-[14px] sm:rounded-[16px] overflow-hidden cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 bg-[#1c2230] shadow-sm relative group"
                        >
                          <PosterImage
                            src={entry.coverImage}
                            alt={entry.title}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover group-hover:brightness-110 transition-all"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors pointer-events-none" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Clean Empty Box Container matching user reference */
                  <div
                    onClick={() => setActiveLibraryStatus('Watching')}
                    className="min-h-[92px] sm:min-h-[102px] rounded-[16px] flex items-center justify-center cursor-pointer group hover:bg-white/[0.02] transition-colors"
                  />
                )}
              </div>
            </div>

            {/* Reading Container */}
            <div className="space-y-2">
              <div
                onClick={() => setActiveLibraryStatus('Reading')}
                className="flex items-center gap-1.5 cursor-pointer group select-none"
              >
                <span className="font-extrabold text-[18px] sm:text-[20px] text-white tracking-tight group-hover:text-cyan-400 transition-colors">
                  Reading
                </span>
                <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/60 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Dynamic Auto-sizing Card */}
              <div 
                onClick={() => {
                  if (readingGridItems.length === 0) setActiveLibraryStatus('Reading');
                }}
                className="bg-[#10131c] rounded-[22px] sm:rounded-[26px] p-2 sm:p-2.5 border-[2px] border-[#252b3b] shadow-xl hover:border-[#353e54] transition-all"
              >
                {readingGridItems.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {readingGridItems.map((entry) => {
                      const media = getMediaForEntry(entry.mediaId, entry.title, entry.coverImage, entry.category);
                      return (
                        <div
                          key={entry.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openMediaDetails(media);
                          }}
                          className="aspect-square rounded-[14px] sm:rounded-[16px] overflow-hidden cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 bg-[#1c2230] shadow-sm relative group"
                        >
                          <PosterImage
                            src={entry.coverImage}
                            alt={entry.title}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover group-hover:brightness-110 transition-all"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors pointer-events-none" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Clean Empty Box Container matching user reference */
                  <div
                    onClick={() => setActiveLibraryStatus('Reading')}
                    className="min-h-[92px] sm:min-h-[102px] rounded-[16px] flex items-center justify-center cursor-pointer group hover:bg-white/[0.02] transition-colors"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 4. RECENT ACTIVITY FEED */}
          <div className="space-y-3 px-4 mt-6">
            <h2 className="text-base sm:text-lg font-bold text-white">
              Recent Activity
            </h2>

            <div className="space-y-2.5">
              {recentActivity.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/40 bg-[#0e1118]/60 border border-white/5 rounded-2xl">
                  No recent activity logged yet.
                </div>
              ) : (
                recentActivity.map((act) => {
                  const media = getMediaForEntry(act.mediaId, act.title, act.coverImage);
                  const isWatching = act.type === 'WATCHING';
                  const isReading = act.type === 'READING';
                  const isCompleted = act.type === 'COMPLETED';

                  return (
                    <div
                      key={act.id}
                      onClick={() => openMediaDetails(media)}
                      className="flex items-center gap-3.5 p-3 bg-[#0e1118]/90 hover:bg-[#141822] border border-white/10 rounded-2xl transition-all duration-150 cursor-pointer shadow-md group"
                    >
                      {/* Thumbnail Poster */}
                      <PosterImage
                        src={act.coverImage}
                        alt={act.title}
                        className="w-12 h-14 rounded-xl shrink-0 shadow-sm"
                        imgClassName="group-hover:scale-105 transition-transform"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isWatching && (
                            <span className="text-[#4ade80] font-extrabold text-[11px] uppercase tracking-wider shrink-0">
                              WATCHING
                            </span>
                          )}
                          {isReading && (
                            <span className="text-white font-extrabold text-[11px] uppercase tracking-wider shrink-0">
                              READING
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[#38bdf8] font-extrabold text-[11px] uppercase tracking-wider shrink-0">
                              COMPLETED
                            </span>
                          )}
                          {!isWatching && !isReading && !isCompleted && (
                            <span className="text-[#f43f5e] font-extrabold text-[11px] uppercase tracking-wider shrink-0">
                              {act.type}
                            </span>
                          )}

                          <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                            {act.title}
                          </h3>
                        </div>

                        <p className="text-xs text-white/50 font-medium mt-1">
                          {act.timeAgo}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* FULL-SCREEN PROFILE OPTIONS SHEET MATCHING SCREENSHOT */}
      {showOptionsSheet && (
        <div className="fixed inset-0 z-[1500] bg-black text-white p-5 sm:p-7 flex flex-col justify-start animate-in slide-in-from-bottom duration-250 overflow-y-auto">
          {/* Top Bar with Back Button */}
          <div className="flex items-center justify-between pt-2 pb-1">
            <button
              onClick={handleCloseOptionsSheet}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          {/* Profile Header Title */}
          <div className="mt-3">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {profileName || 'MD'}
            </h1>
            <p className="text-sm font-medium text-white/50 mt-1">
              Profile
            </p>
          </div>

          {/* Thin Divider Line */}
          <div className="w-full h-px bg-white/15 my-4" />

          {/* Action Buttons List */}
          <div className="space-y-3">
            {/* Edit Profile Button */}
            <button
              onClick={handleOpenEditProfileSheet}
              className="w-full flex items-center gap-3.5 px-4 py-4 rounded-[18px] bg-[#111319] hover:bg-[#181b24] border border-[#232734] transition-all text-left text-white active:scale-[0.99] cursor-pointer shadow-md group"
            >
              <div className="w-5 h-5 flex items-center justify-center text-white shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </div>
              <span className="font-bold text-[16px] text-white tracking-wide">Edit Profile</span>
            </button>

            {/* Download Manager Button */}
            <button
              onClick={handleOpenDownloadManager}
              className="w-full flex items-center gap-3.5 px-4 py-4 rounded-[18px] bg-[#111319] hover:bg-[#181b24] border border-[#232734] transition-all text-left text-white active:scale-[0.99] cursor-pointer shadow-md group"
            >
              <div className="w-5 h-5 flex items-center justify-center text-white shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <span className="font-bold text-[16px] text-white tracking-wide">Download Manager</span>
            </button>
          </div>

          {/* Accounts Section */}
          <div className="mt-6 space-y-2">
            <span className="text-sm font-semibold text-white/70 block px-1">Accounts</span>

            <div className="w-full flex items-center justify-between px-4 py-3.5 rounded-[18px] bg-[#111319] border border-[#232734] shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                {/* Google G Logo - Solid White */}
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="white" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="white" />
                  </svg>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[15px] text-white truncate">Google Connected</span>
                  <span className="text-xs text-white/50">{isGoogleConnected ? 'Active account' : 'Disconnected'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5 shrink-0">
                {/* Green Check Status Badge with exact color #33cf80 */}
                {isGoogleConnected ? (
                  <div className="w-5 h-5 rounded-full bg-[#33cf80] flex items-center justify-center text-black shrink-0">
                    <svg className="w-3.5 h-3.5 stroke-[3] text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white/40 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                )}

                {/* Sync Button */}
                <button
                  onClick={handleSyncGoogle}
                  disabled={!isGoogleConnected || isSyncing}
                  className={`p-1 text-white/70 hover:text-white transition-colors cursor-pointer ${isSyncing ? 'animate-spin text-cyan-400' : ''}`}
                  title="Sync Google Account"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Disconnect / Remove Button */}
                <button
                  onClick={handleToggleGoogle}
                  className="p-1 text-[#ef4444] hover:text-[#f87171] transition-colors cursor-pointer"
                  title={isGoogleConnected ? "Disconnect Account" : "Connect Account"}
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN EDIT PROFILE SHEET MATCHING SCREENSHOT */}
      {showEditProfileSheet && (
        <div className="fixed inset-0 z-[1600] bg-black text-white p-4 sm:p-6 flex flex-col justify-start animate-in slide-in-from-bottom duration-250 overflow-y-auto">
          <div className="w-full max-w-lg mx-auto flex flex-col pb-8">
            {/* Top Bar with Title and Close 'X' button */}
            <div className="flex items-center justify-between pt-2 pb-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Edit Profile
              </h1>
              <button
                onClick={handleCloseEditProfileSheet}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>

            {/* Circular Profile Avatar in Center */}
            <div className="flex flex-col items-center justify-center mt-3 select-none">
              <div
                onClick={() => setShowAvatarPickerModal(true)}
                className="relative cursor-pointer group"
                title="Change Profile Avatar"
              >
                {renderAvatarWithFrame(
                  draftAvatarFrame,
                  draftName,
                  draftAvatarUrl,
                  'w-20 h-20 sm:w-24 sm:h-24',
                  'text-3xl sm:text-4xl'
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAvatarPickerModal(true);
                  }}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-[#a855f7] hover:bg-[#9333ea] text-white shadow-lg border-2 border-black transition-transform active:scale-95 cursor-pointer group-hover:scale-105"
                  title="Change Avatar"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAvatarPickerModal(true)}
                className="mt-2.5 text-xs font-bold text-white/80 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Profile Image</span>
              </button>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                {draftName || 'MD'}
              </h2>
            </div>

              {/* Banner Image Preview with Pill */}
              <div
                onClick={() => setShowBannerPickerModal(true)}
                className="relative w-full aspect-[21/9] sm:aspect-[2.5/1] rounded-[20px] overflow-hidden border border-white/10 mt-5 bg-[#0e1017] shadow-lg cursor-pointer group"
                title="Change Banner Image"
              >
                <img
                  src={draftBannerUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80'}
                  alt="Banner Preview"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors pointer-events-none" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBannerPickerModal(true);
                  }}
                  className="absolute bottom-3 left-3 bg-black/70 hover:bg-black/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 flex items-center gap-2 text-xs font-bold text-white transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Banner Image</span>
                </button>
              </div>

              {/* Display Name Input Card */}
              <div className="w-full bg-[#0e1017] rounded-[18px] p-3.5 sm:p-4 border border-[#202534] mt-4 shadow-md">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-white/70 text-xs font-bold">
                    <Pencil className="w-3.5 h-3.5 text-purple-400" />
                    <span>Display Name</span>
                  </div>
                  <span className="text-xs font-medium text-white/40">{Math.min(draftName.length, 10)}/10</span>
                </div>
                <input
                  type="text"
                  maxLength={10}
                  value={draftName.slice(0, 10)}
                  onChange={(e) => setDraftName(e.target.value.slice(0, 10))}
                  className="w-full bg-transparent text-white font-medium text-sm outline-none border-none focus:ring-0 placeholder-white/30"
                  placeholder="Display Name"
                />
              </div>

              {/* Short Bio Input Card */}
              <div className="w-full bg-[#0e1017] rounded-[18px] p-3.5 sm:p-4 border border-[#202534] mt-3 shadow-md">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-white/70 text-xs font-bold">
                    <Info className="w-3.5 h-3.5 text-purple-400" />
                    <span>Short Bio</span>
                  </div>
                  <span className="text-xs font-medium text-white/40">{Math.min(draftBio.length, 35)}/35</span>
                </div>
                <input
                  type="text"
                  maxLength={35}
                  value={draftBio.slice(0, 35)}
                  onChange={(e) => setDraftBio(e.target.value.slice(0, 35))}
                  className="w-full bg-transparent text-white font-medium text-sm outline-none border-none focus:ring-0 placeholder-white/30"
                  placeholder="Add a short profile intro"
                />
              </div>

              {/* Avatar Frame Section */}
              <div className="w-full mt-5">
                <h3 className="text-[15px] font-bold text-white tracking-wide mb-3 px-1">Avatar Frame</h3>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                  {AVATAR_FRAMES.map((frame) => {
                    const isSelected = draftAvatarFrame === frame.id;
                    return (
                      <div
                        key={frame.id}
                        className={`w-[110px] shrink-0 bg-[#0e1017] rounded-[20px] p-3 flex flex-col items-center gap-2.5 transition-all border ${
                          isSelected
                            ? 'border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.35)]'
                            : 'border-[#202534]'
                        }`}
                      >
                        {/* Mini preview with frame */}
                        <div className="w-12 h-12 flex items-center justify-center">
                          {renderAvatarWithFrame(frame.id, draftName || 'A', draftAvatarUrl, 'w-11 h-11', 'text-base')}
                        </div>
                        <span className="text-xs font-bold text-white text-center truncate w-full" title={frame.name}>
                          {frame.shortName}
                        </span>
                        {isSelected ? (
                          <button
                            disabled
                            className="w-full py-1.5 rounded-xl bg-[#181b24] text-white/40 font-bold text-xs cursor-default"
                          >
                            Using
                          </button>
                        ) : (
                          <button
                            onClick={() => setDraftAvatarFrame(frame.id)}
                            className="w-full py-1.5 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] text-white font-bold text-xs transition-colors cursor-pointer active:scale-95"
                          >
                            Use
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lock Profile Row - Clean uncontained row, fully clickable */}
              <div
                onClick={() => setDraftIsLocked(!draftIsLocked)}
                className="flex items-center justify-between mt-5 px-1 py-1 cursor-pointer select-none group"
              >
                <div className="flex flex-col pr-4">
                  <span className="text-[15px] font-bold text-white group-hover:text-white/90 transition-colors">Lock Profile</span>
                  <p className="text-xs text-white/50 leading-relaxed mt-0.5 max-w-[280px] sm:max-w-none">
                    When enabled, other users only see your banner, avatar, name, and bio.
                  </p>
                </div>
                <AppToggleSwitch
                  checked={draftIsLocked}
                  onChange={(v) => setDraftIsLocked(v)}
                />
              </div>

              {/* Save Changes Button */}
              <button
                onClick={handleSaveProfileChanges}
                className="w-full py-4 rounded-full bg-[#a855f7] hover:bg-[#9333ea] text-white font-black text-base tracking-wide shadow-xl shadow-purple-600/30 transition-all active:scale-[0.98] cursor-pointer mt-7 mb-4"
              >
                Save Changes
              </button>
          </div>
        </div>
      )}

      {/* AVATAR PICKER MODAL */}
      {showAvatarPickerModal && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#12141C] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                <span>Select Profile Avatar</span>
              </h3>
              <button
                onClick={() => setShowAvatarPickerModal(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Presets</span>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      if (preset.type === 'image' && preset.url) {
                        setDraftAvatarUrl(preset.url);
                      } else {
                        setDraftAvatarUrl('');
                      }
                      setShowAvatarPickerModal(false);
                      showToast(`Selected ${preset.name}`);
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-black/40 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border border-white/20 shadow-sm">
                      {preset.type === 'image' && preset.url ? (
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: preset.color || '#0091FF' }}
                        >
                          {(draftName || 'MD').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-white/70 text-center font-medium line-clamp-1 group-hover:text-white">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL or Upload */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Custom Image</span>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste image URL (https://...)"
                  value={customAvatarInput}
                  onChange={(e) => setCustomAvatarInput(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                />
                <button
                  onClick={() => {
                    if (customAvatarInput.trim()) {
                      setDraftAvatarUrl(customAvatarInput.trim());
                      setCustomAvatarInput('');
                      setShowAvatarPickerModal(false);
                      showToast('Custom avatar applied');
                    }
                  }}
                  disabled={!customAvatarInput.trim()}
                  className="px-3.5 py-2 bg-[#a855f7] hover:bg-[#9333ea] disabled:opacity-40 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Apply
                </button>
              </div>

              {/* Upload file */}
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, false)}
                className="hidden"
              />
              <button
                onClick={() => avatarFileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center gap-2 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload From Device</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER PICKER MODAL */}
      {showBannerPickerModal && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#12141C] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                <span>Select Profile Banner</span>
              </h3>
              <button
                onClick={() => setShowBannerPickerModal(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets Banner List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Presets</span>
              <div className="space-y-2">
                {PRESET_BANNERS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setDraftBannerUrl(preset.url);
                      setShowBannerPickerModal(false);
                      showToast(`Selected ${preset.name}`);
                    }}
                    className="w-full relative h-20 rounded-2xl overflow-hidden border border-white/15 hover:border-purple-400 group cursor-pointer transition-all active:scale-[0.99] text-left"
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-2.5">
                      <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL or Upload */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Custom Banner</span>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste banner image URL (https://...)"
                  value={customBannerInput}
                  onChange={(e) => setCustomBannerInput(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                />
                <button
                  onClick={() => {
                    if (customBannerInput.trim()) {
                      setDraftBannerUrl(customBannerInput.trim());
                      setCustomBannerInput('');
                      setShowBannerPickerModal(false);
                      showToast('Custom banner applied');
                    }
                  }}
                  disabled={!customBannerInput.trim()}
                  className="px-3.5 py-2 bg-[#a855f7] hover:bg-[#9333ea] disabled:opacity-40 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Apply
                </button>
              </div>

              {/* Upload file */}
              <input
                ref={bannerFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, true)}
                className="hidden"
              />
              <button
                onClick={() => bannerFileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center gap-2 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload From Device</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL 100% SCREEN DOWNLOAD MANAGER BOTTOM SHEET */}
      <DownloadManagerSheet
        isOpen={showDownloadManager}
        onClose={handleCloseDownloadManager}
        onBackToLibrary={handleBackToLibrary}
      />
    </div>
  );
};
