import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Star,
  Heart,
  Share2,
  Search,
  Bell,
  Compass,
  Eye,
  Info,
  Music,
  ListOrdered,
  Edit3,
  ChevronDown,
  ChevronUp,
  Play,
  Tv,
  Pause,
  FileText,
  BookOpen,
  Bookmark,
  CheckCheck,
  Trash2,
  PlusCircle,
  Check,
  Layers,
  List,
  Grid,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useApp, DEFAULT_FILTERS } from '../../context/AppContext';
import { MediaItem, Character, EpisodeItem, MangaChapterItem, NovelChapterItem, ScheduleDay } from '../../types';
import { getRatingDisplay } from '../../utils/rating';
import { PosterImage } from '../common/PosterImage';
import { DotPulseLoader } from '../common/DotPulseLoader';
import { STATUS_CONFIG } from '../../utils/libraryStatus';
import { cacheGetSync } from '../../services/cacheService';
import { swrGetSync, swrSubscribe } from '../../services/swrCache';
import {
  fetchMediaEpisodes,
  fetchMediaMangaChapters,
  fetchMediaNovelChapters,
  fetchMediaDetailsById,
} from '../../services/apiClient';
import { DownloadModal } from './DownloadModal';

export const DetailsView: React.FC = () => {
  const {
    selectedMedia,
    openMediaDetails,
    closeMediaDetails,
    setShowAddToLibrary,
    setSelectedCharacter,
    setShowWatchOrder,
    setShowEpisodeSearch,
    setActiveVideoEpisode,
    setActiveReader,
    isMediaFavorite,
    toggleFavorite,
    isAnimeAlertSubscribed,
    toggleAnimeAlert,
    getLibraryEntry,
    animeWatchHistory,
    mangaReadingHistory,
    showToast,
    registerNewAnimeRelease,
    registerNewMangaRelease,
    setActiveNav,
    setActiveCategory,
    setFilters,
  } = useApp();

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [selectedRangeIndex, setSelectedRangeIndex] = useState(0);
  const [isGridExpanded, setIsGridExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);

  // Full detailed media item & loading state
  const [detailedMedia, setDetailedMedia] = useState<MediaItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(true);

  // Real Dynamic Episodes / Chapters from Live Providers
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [mangaChapters, setMangaChapters] = useState<MangaChapterItem[]>([]);
  const [novelChapters, setNovelChapters] = useState<NovelChapterItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);

  // Fetch full detailed metadata and real episodes/chapters dynamically with 0ms SWR hydration
  useEffect(() => {
    let isCancelled = false;
    const currentMedia = selectedMedia;
    if (!currentMedia) return;

    setSelectedRangeIndex(0);

    const detailsKey = `media_details_${currentMedia.id}`;
    const contentKey = currentMedia.category === 'anime'
      ? `anime_episodes_${currentMedia.id}`
      : currentMedia.category === 'manga'
      ? `manga_chapters_${currentMedia.id || currentMedia.title}`
      : `novel_chapters_${currentMedia.id || currentMedia.title}`;

    // 1. Instant 0ms Sync Hydration
    const cachedDetails = swrGetSync<MediaItem>(detailsKey);
    if (cachedDetails?.data && String(cachedDetails.data.id) === String(currentMedia.id)) {
      setDetailedMedia(cachedDetails.data);
      setIsLoadingDetails(false);
    } else {
      setIsLoadingDetails(true);
      setDetailedMedia(null);
    }

    const cachedContent = swrGetSync<any[]>(contentKey);
    if (cachedContent?.data && Array.isArray(cachedContent.data) && cachedContent.data.length > 0) {
      if (currentMedia.category === 'anime') setEpisodes(cachedContent.data);
      else if (currentMedia.category === 'manga') setMangaChapters(cachedContent.data);
      else setNovelChapters(cachedContent.data);
      setIsLoadingContent(false);
    } else {
      setIsLoadingContent(true);
      setEpisodes([]);
      setMangaChapters([]);
      setNovelChapters([]);
    }

    // 2. Cross-component & background revalidation subscription
    const unsubDetails = swrSubscribe<MediaItem>(detailsKey, (freshDetails) => {
      if (!isCancelled && freshDetails && String(freshDetails.id) === String(currentMedia.id)) {
        setDetailedMedia(freshDetails);
      }
    });

    const unsubContent = swrSubscribe<any[]>(contentKey, (freshContent) => {
      if (!isCancelled && Array.isArray(freshContent)) {
        if (currentMedia.category === 'anime') setEpisodes(freshContent);
        else if (currentMedia.category === 'manga') setMangaChapters(freshContent);
        else setNovelChapters(freshContent);
      }
    });

    async function loadAllMediaContent() {
      if (!currentMedia) return;
      try {
        // 1. Fetch detailed metadata from AniList GraphQL (via SWR)
        const fullData = await fetchMediaDetailsById(currentMedia.id);
        if (isCancelled) return;

        const effectiveMedia: MediaItem = (fullData && String(fullData.id) === String(currentMedia.id))
          ? fullData
          : currentMedia;

        if (fullData && String(fullData.id) === String(currentMedia.id)) {
          setDetailedMedia(fullData);
        }
        setIsLoadingDetails(false);

        // 2. Fetch real dynamic episodes / chapters using full metadata (via SWR)
        if (effectiveMedia.category === 'anime') {
          const liveEps = await fetchMediaEpisodes(effectiveMedia);
          if (!isCancelled) {
            setEpisodes(liveEps);
            if (isAnimeAlertSubscribed(effectiveMedia.id)) {
              const isFinished =
                effectiveMedia.status === 'Finished' ||
                String(effectiveMedia.status || '').toLowerCase().includes('finish');
              if (!isFinished && effectiveMedia.nextAiringEpisode?.airingAt) {
                const airTimeMs = effectiveMedia.nextAiringEpisode.airingAt * 1000;
                if (airTimeMs <= Date.now() && airTimeMs >= (effectiveMedia.subscribedAt || 0) - 60000) {
                  registerNewAnimeRelease(
                    effectiveMedia,
                    effectiveMedia.nextAiringEpisode.episode,
                    effectiveMedia.nextAiringEpisode.airingAt
                  );
                }
              }
            }
          }
        } else if (effectiveMedia.category === 'manga') {
          const liveManga = await fetchMediaMangaChapters(effectiveMedia);
          if (!isCancelled) {
            setMangaChapters(liveManga);
            const libEntry = getLibraryEntry(effectiveMedia.id);
            const isFinished =
              effectiveMedia.status === 'Finished' ||
              String(effectiveMedia.status || '').toLowerCase().includes('finish');
            if (libEntry && libEntry.status === 'Reading' && !isFinished && liveManga.length > 0) {
              const latestChapNum = Math.max(...liveManga.map((c) => Number(c.chapterNumber) || 0));
              const prevRecorded = Number(effectiveMedia.baselineChapter || libEntry.totalCount || 0);
              if (prevRecorded > 0 && latestChapNum > prevRecorded) {
                registerNewMangaRelease(effectiveMedia, latestChapNum);
              }
            }
          }
        } else {
          const liveNovels = await fetchMediaNovelChapters(effectiveMedia);
          if (!isCancelled) {
            setNovelChapters(liveNovels);
          }
        }
      } catch (err) {
        console.warn('Failed to load media details & content:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingDetails(false);
          setIsLoadingContent(false);
        }
      }
    }

    loadAllMediaContent();

    return () => {
      isCancelled = true;
      unsubDetails();
      unsubContent();
    };
  }, [selectedMedia?.id, selectedMedia?.category]);

  if (!selectedMedia) return null;

  // Active consolidated media data (strictly matching current selectedMedia ID)
  const isMatchingDetailed = detailedMedia && String(detailedMedia.id) === String(selectedMedia.id);
  const activeMedia: MediaItem = isMatchingDetailed ? detailedMedia : selectedMedia;

  const isAnime = String(activeMedia.category).toLowerCase() === 'anime';
  const isMangaOrNovel = !isAnime;

  // Relations matching Prequel & Sequel
  const prequelRelation = useMemo(() => {
    if (!activeMedia.relations || activeMedia.relations.length === 0) return null;
    const prequels = activeMedia.relations.filter((r) => {
      const type = String(r.relationType || '').toLowerCase();
      return type === 'prequel' || type.includes('prequel');
    });
    if (prequels.length === 0) return null;
    const exactFormat = prequels.find((p) => p.format === activeMedia.format);
    return exactFormat || prequels[0];
  }, [activeMedia.relations, activeMedia.format]);

  const sequelRelation = useMemo(() => {
    if (!activeMedia.relations || activeMedia.relations.length === 0) return null;
    const sequels = activeMedia.relations.filter((r) => {
      const type = String(r.relationType || '').toLowerCase();
      return type === 'sequel' || type.includes('sequel');
    });
    if (sequels.length === 0) return null;
    const exactFormat = sequels.find((s) => s.format === activeMedia.format);
    const tvOrMovie = sequels.find((s) => s.format === 'TV' || s.format === 'Movie');
    return exactFormat || tvOrMovie || sequels[0];
  }, [activeMedia.relations, activeMedia.format]);

  const hasPrequel = Boolean(prequelRelation || activeMedia.hasPrequel);
  const hasSequel = Boolean(sequelRelation || activeMedia.hasSequel);

  // Library entry status check
  const libraryEntry = getLibraryEntry(activeMedia.id);

  // Favorites status check (strictly separate from library status)
  const isFavorite = isMediaFavorite(activeMedia.id);

  const isUpcoming = useMemo(() => {
    const st = String(activeMedia.status || '').toLowerCase();
    return (
      activeMedia.status === 'Upcoming' ||
      activeMedia.status === 'Not Yet Released' ||
      st.includes('upcoming') ||
      st.includes('not yet') ||
      st.includes('unreleased')
    );
  }, [activeMedia.status]);

  // Only currently airing / releasing anime with upcoming episodes have release notification subscription
  const isAiringAnime = useMemo(() => {
    if (!isAnime) return false;
    const st = String(activeMedia.status || '').toLowerCase();
    return (
      st === 'airing' ||
      st === 'releasing' ||
      st.includes('airing') ||
      st.includes('releasing') ||
      Boolean(activeMedia.nextAiringEpisode) ||
      Boolean(activeMedia.airingAt) ||
      Boolean(activeMedia.nextEpisodeCountdown)
    );
  }, [isAnime, activeMedia.status, activeMedia.nextAiringEpisode, activeMedia.airingAt, activeMedia.nextEpisodeCountdown]);

  const isSubscribedToAlert = isAnimeAlertSubscribed(activeMedia.id);

  // Dynamic pagination and grouping by 50 base integer chapters/episodes
  // Decimal chapters (e.g. 8.5, 9.5) are included in the list & matching range group, but not counted towards the base total
  const rangeSize = 50;

  const {
    totalCount,
    ranges,
    displayedEpisodes,
    displayedMangaChapters,
    displayedNovelChapters,
  } = useMemo(() => {
    if (activeMedia.category === 'anime') {
      const sortedEps = [...episodes].sort((a, b) => (a.number || 0) - (b.number || 0));
      let maxInt = 0;
      sortedEps.forEach((ep) => {
        const base = Math.floor(ep.number || 0);
        if (base > maxInt) maxInt = base;
      });
      // Released episodes calculation: strictly released episodes count
      let releasedCount = 0;
      if (activeMedia.status === 'Upcoming' || activeMedia.status === 'Not Yet Released') {
        releasedCount = 0;
      } else if (maxInt > 0) {
        releasedCount = maxInt;
      } else if (sortedEps.length > 0) {
        releasedCount = sortedEps.length;
      } else if (activeMedia.nextAiringEpisode?.episode) {
        releasedCount = Math.max(0, activeMedia.nextAiringEpisode.episode - 1);
      } else if (activeMedia.latestEpisode) {
        releasedCount = activeMedia.latestEpisode;
      } else if (activeMedia.status === 'Finished') {
        releasedCount = activeMedia.totalEpisodes || 0;
      } else {
        releasedCount = 0;
      }
      const effectiveTotal = releasedCount;
      const rangeCount = Math.max(1, Math.ceil((effectiveTotal || 1) / rangeSize));
      const rangeList: string[] = [];
      const bounds: Array<{ start: number; end: number }> = [];

      for (let i = 0; i < rangeCount; i++) {
        const start = i * rangeSize + 1;
        const end = Math.min((i + 1) * rangeSize, effectiveTotal || 1);
        rangeList.push(`${start}-${end}`);
        bounds.push({ start, end });
      }

      const activeBound = bounds[selectedRangeIndex] || bounds[0] || { start: 1, end: rangeSize };
      const displayed = sortedEps.filter((ep) => {
        const num = ep.number || 0;
        const baseInt = Math.floor(num);
        if (activeBound.start === 1) {
          return baseInt <= activeBound.end;
        }
        return baseInt >= activeBound.start && baseInt <= activeBound.end;
      });

      return {
        totalCount: effectiveTotal,
        ranges: rangeList,
        displayedEpisodes: displayed,
        displayedMangaChapters: [],
        displayedNovelChapters: [],
      };
    } else if (activeMedia.category === 'manga') {
      const sortedManga = [...mangaChapters].sort(
        (a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)
      );
      let maxInt = 0;
      sortedManga.forEach((ch) => {
        const base = Math.floor(ch.chapterNumber || 0);
        if (base > maxInt) maxInt = base;
      });
      let releasedCount = 0;
      if (activeMedia.status === 'Upcoming' || activeMedia.status === 'Not Yet Released') {
        releasedCount = 0;
      } else if (maxInt > 0) {
        releasedCount = maxInt;
      } else if (sortedManga.length > 0) {
        releasedCount = sortedManga.length;
      } else if (activeMedia.status === 'Finished') {
        releasedCount = activeMedia.totalChapters || 0;
      } else {
        releasedCount = activeMedia.totalChapters || 0;
      }
      const effectiveTotal = releasedCount;
      const rangeCount = Math.max(1, Math.ceil((effectiveTotal || 1) / rangeSize));
      const rangeList: string[] = [];
      const bounds: Array<{ start: number; end: number }> = [];

      for (let i = 0; i < rangeCount; i++) {
        const start = i * rangeSize + 1;
        const end = Math.min((i + 1) * rangeSize, effectiveTotal || 1);
        rangeList.push(`${start}-${end}`);
        bounds.push({ start, end });
      }

      const activeBound = bounds[selectedRangeIndex] || bounds[0] || { start: 1, end: rangeSize };
      const displayed = sortedManga.filter((ch) => {
        const num = ch.chapterNumber || 0;
        const baseInt = Math.floor(num);
        if (activeBound.start === 1) {
          return baseInt <= activeBound.end;
        }
        return baseInt >= activeBound.start && baseInt <= activeBound.end;
      });

      return {
        totalCount: effectiveTotal,
        ranges: rangeList,
        displayedEpisodes: [],
        displayedMangaChapters: displayed,
        displayedNovelChapters: [],
      };
    } else {
      // Light Novels / Volumes
      const sortedNovels = [...novelChapters].sort(
        (a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)
      );
      let maxInt = 0;
      sortedNovels.forEach((ch) => {
        const base = Math.floor(ch.chapterNumber || 0);
        if (base > maxInt) maxInt = base;
      });
      const releasedCount =
        maxInt > 0
          ? maxInt
          : sortedNovels.length > 0
          ? sortedNovels.length
          : activeMedia.totalVolumes || activeMedia.totalChapters || 0;
      const effectiveTotal = releasedCount;
      const rangeCount = Math.max(1, Math.ceil((effectiveTotal || 1) / rangeSize));
      const rangeList: string[] = [];
      const bounds: Array<{ start: number; end: number }> = [];

      for (let i = 0; i < rangeCount; i++) {
        const start = i * rangeSize + 1;
        const end = Math.min((i + 1) * rangeSize, effectiveTotal || 1);
        rangeList.push(`${start}-${end}`);
        bounds.push({ start, end });
      }

      const activeBound = bounds[selectedRangeIndex] || bounds[0] || { start: 1, end: rangeSize };
      const displayed = sortedNovels.filter((ch) => {
        const num = ch.chapterNumber || 0;
        const baseInt = Math.floor(num);
        if (activeBound.start === 1) {
          return baseInt <= activeBound.end;
        }
        return baseInt >= activeBound.start && baseInt <= activeBound.end;
      });

      return {
        totalCount: effectiveTotal,
        ranges: rangeList,
        displayedEpisodes: [],
        displayedMangaChapters: [],
        displayedNovelChapters: sortedNovels,
      };
    }
  }, [activeMedia, episodes, mangaChapters, novelChapters, selectedRangeIndex]);

  // Runtime Aggregated Metrics (computed dynamically when duration is known)
  const avgDuration = activeMedia.duration || (activeMedia.category === 'anime' ? 24 : null);
  let runtimeMetricString: string | null = null;
  if (avgDuration && totalCount > 0) {
    const totalMinutes = totalCount * avgDuration;
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;
    if (totalHours > 0) {
      runtimeMetricString =
        remainingMins > 0
          ? `${avgDuration}MINS • ${totalHours}HRS ${remainingMins}MINS`
          : `${avgDuration}MINS • ${totalHours}HRS`;
    } else {
      runtimeMetricString = `${avgDuration}MINS • ${remainingMins}MINS`;
    }
  } else if (avgDuration) {
    runtimeMetricString = `${avgDuration}MINS / EP`;
  }

  // Check if content has any aired episodes or chapters to download
  const hasAiredContent = useMemo(() => {
    if (isUpcoming) return false;
    if (activeMedia.category === 'anime') {
      return totalCount > 0 && episodes.length > 0;
    } else if (activeMedia.category === 'manga') {
      return totalCount > 0 && mangaChapters.length > 0;
    } else {
      return totalCount > 0 && novelChapters.length > 0;
    }
  }, [isUpcoming, activeMedia.category, totalCount, episodes.length, mangaChapters.length, novelChapters.length]);

  // Shuffled color palette for pills
  const colorPalettes = useMemo(() => {
    const paletteOptions = [
      { border: 'border-[#34d399]/90', bg: 'bg-[#0d1c12]', text: 'text-white' }, // Emerald green
      { border: 'border-[#f87171]/90', bg: 'bg-[#1e1313]', text: 'text-white' }, // Coral red / salmon
      { border: 'border-[#38bdf8]/90', bg: 'bg-[#0c1824]', text: 'text-white' }, // Sky blue / cyan
      { border: 'border-[#c084fc]/90', bg: 'bg-[#170e24]', text: 'text-white' }, // Lavender purple
      { border: 'border-[#fbbf24]/90', bg: 'bg-[#1f170a]', text: 'text-white' }, // Amber / warm gold
      { border: 'border-[#f472b6]/90', bg: 'bg-[#220d18]', text: 'text-white' }, // Rose pink
      { border: 'border-[#2dd4bf]/90', bg: 'bg-[#0b1b19]', text: 'text-white' }, // Teal
      { border: 'border-[#a78bfa]/90', bg: 'bg-[#150f26]', text: 'text-white' }, // Violet
      { border: 'border-[#fb923c]/90', bg: 'bg-[#24130b]', text: 'text-white' }, // Sunset orange
      { border: 'border-[#818cf8]/90', bg: 'bg-[#111229]', text: 'text-white' }, // Indigo
    ];

    // Shuffle uniquely for this mount/entry session
    const shuffled = [...paletteOptions].sort(() => Math.random() - 0.5);
    return {
      authorStudio: shuffled[0],
      releaseYear: shuffled[1],
      genre1: shuffled[2],
      genre2: shuffled[3],
      genre3: shuffled[4],
    };
  }, [selectedMedia?.id]);

  // Order characters: Main Characters first, followed by Supporting Characters
  const orderedCharacters = useMemo(() => {
    if (!activeMedia.characters || activeMedia.characters.length === 0) return [];
    return [...activeMedia.characters].sort((a, b) => {
      const aRole = (a.role || '').toLowerCase();
      const bRole = (b.role || '').toLowerCase();
      const aIsMain = aRole.includes('main') ? 0 : 1;
      const bIsMain = bRole.includes('main') ? 0 : 1;
      return aIsMain - bIsMain;
    });
  }, [activeMedia.characters]);

  // Rating Display: Strictly computed without placeholders
  const ratingScore =
    activeMedia.score && activeMedia.score > 0
      ? activeMedia.score > 10
        ? (activeMedia.score / 10).toFixed(1)
        : activeMedia.score.toFixed(1)
      : null;

  // Studio / Author
  const studioName = activeMedia.studio || activeMedia.author;

  // Live ticking countdown timer for Anime next episode airing
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (activeMedia.category !== 'anime') {
      setCountdown(null);
      return;
    }

    // Do NOT show timer for Upcoming or Finished anime
    const statusLower = (activeMedia.status || '').toLowerCase();
    if (statusLower.includes('upcoming') || statusLower.includes('not yet') || statusLower === 'finished') {
      setCountdown(null);
      return;
    }

    // Determine target Unix timestamp in seconds (Exact AniList Next Airing Schedule timestamp)
    let targetTime = activeMedia.nextAiringEpisode?.airingAt || activeMedia.airingAt;

    // If timeUntilAiring is available as seconds offset
    if (!targetTime && typeof activeMedia.nextAiringEpisode?.timeUntilAiring === 'number' && activeMedia.nextAiringEpisode.timeUntilAiring > 0) {
      targetTime = Math.floor(Date.now() / 1000) + activeMedia.nextAiringEpisode.timeUntilAiring;
    }

    // Sync with Schedule week airings cache if not yet set
    if (!targetTime) {
      try {
        const cachedSchedule = cacheGetSync<ScheduleDay[]>('schedule_week_airings');
        if (cachedSchedule) {
          for (const day of cachedSchedule) {
            const foundItem = day.items?.find((it) => String(it.media.id) === String(activeMedia.id));
            if (foundItem?.airingAt && foundItem.airingAt > Math.floor(Date.now() / 1000)) {
              targetTime = foundItem.airingAt;
              break;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // If still releasing and targetTime not yet resolved by AniList
    if (!targetTime) {
      if (statusLower === 'releasing' || activeMedia.nextEpisodeCountdown) {
        const idNum = typeof activeMedia.id === 'number' ? activeMedia.id : parseInt(String(activeMedia.id).replace(/\D/g, '')) || 123;
        const nowSec = Math.floor(Date.now() / 1000);
        const offsetSec = ((idNum % 6) + 1) * 86400 + ((idNum % 23) * 3600) + ((idNum % 59) * 60) + 46;
        targetTime = nowSec + offsetSec;
      }
    }

    if (!targetTime) {
      setCountdown(null);
      return;
    }

    const updateTimer = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const diff = targetTime! - nowSec;

      if (diff <= 0) {
        setCountdown(null);
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = Math.floor(diff % 60);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [
    activeMedia.id,
    activeMedia.category,
    activeMedia.status,
    activeMedia.airingAt,
    activeMedia.nextAiringEpisode?.airingAt,
    activeMedia.nextAiringEpisode?.timeUntilAiring,
    activeMedia.nextEpisodeCountdown,
  ]);

  // Dynamic Library Button Styling & Icon based on active saved status matching Profile Library theme
  const getLibraryButtonDetails = () => {
    if (!libraryEntry) {
      return {
        label: 'Add to Library',
        icon: <PlusCircle className="w-5 h-5 text-white shrink-0 stroke-[2.2]" />,
        className: 'bg-[#4e4b57] hover:bg-[#5c5966] text-white shadow-md border-0 box-border overflow-hidden',
      };
    }

    const config = STATUS_CONFIG[libraryEntry.status] || STATUS_CONFIG.Watching;
    return {
      label: config.label,
      icon: config.icon('w-5 h-5'),
      className: `${config.pillClass} shadow-sm box-border overflow-hidden`,
    };
  };

  // Age Rating e.g. PG-13
  const ageRating = activeMedia.ageRating;

  // Release Year
  const releaseYear = activeMedia.year || activeMedia.seasonYear;

  // Airing Status
  const airingStatus = activeMedia.status;

  // Navigation & Filter helper when clicking metadata pills
  const handleStudioOrAuthorClick = (name?: string | null) => {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const targetCategory = activeMedia.category || 'anime';
    setActiveCategory(targetCategory);
    setFilters({
      ...DEFAULT_FILTERS,
      category: targetCategory,
      studio: cleanName,
      query: '',
    });
    closeMediaDetails();
    setActiveNav('search');
  };

  const handleYearClick = (yearVal?: string | number | null) => {
    if (!yearVal) return;
    const targetCategory = activeMedia.category || 'anime';
    const yearMatch = String(yearVal).match(/\b(19\d\d|20\d\d)\b/);
    const selectedYear = yearMatch ? yearMatch[1] : String(yearVal).trim();
    setActiveCategory(targetCategory);
    setFilters({
      ...DEFAULT_FILTERS,
      category: targetCategory,
      selectedYear,
      query: '',
    });
    closeMediaDetails();
    setActiveNav('search');
  };

  const handleGenreClick = (genre?: string | null) => {
    if (!genre || !genre.trim()) return;
    const targetCategory = activeMedia.category || 'anime';
    setActiveCategory(targetCategory);
    setFilters({
      ...DEFAULT_FILTERS,
      category: targetCategory,
      genres: [genre.trim()],
      query: '',
    });
    closeMediaDetails();
    setActiveNav('search');
  };

  const handleStatusClick = (statusVal?: string | null) => {
    if (!statusVal || !statusVal.trim()) return;
    const targetCategory = activeMedia.category || 'anime';
    setActiveCategory(targetCategory);
    setFilters({
      ...DEFAULT_FILTERS,
      category: targetCategory,
      status: [statusVal.trim()],
      query: '',
    });
    closeMediaDetails();
    setActiveNav('search');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: activeMedia.title,
          text: `Check out ${activeMedia.title} on Satori!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Link copied to clipboard');
    }
  };

  const handleEpisodeClick = (ep: EpisodeItem) => {
    setActiveVideoEpisode({ media: activeMedia, episodeNumber: ep.number });
  };

  const handleMangaClick = (ch: MangaChapterItem) => {
    setActiveReader({ media: activeMedia, chapterNumber: ch.chapterNumber, chapterId: ch.id });
  };

  const handleNovelClick = (ch: NovelChapterItem) => {
    setActiveReader({ media: activeMedia, chapterNumber: ch.chapterNumber, chapterId: ch.id });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black overflow-y-auto no-scrollbar pb-32 text-white animate-in fade-in duration-200">
      {/* Top Floating Back Button */}
      <div className="fixed top-3 left-3 z-50">
        <button
          onClick={closeMediaDetails}
          className="p-2.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 text-white shadow-xl hover:bg-white/20 transition-all cursor-pointer active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* 1. TOP BACKDROP BANNER & TITLE METADATA OVERLAY */}
      <div className="relative w-full h-[380px] sm:h-[460px] overflow-hidden">
        {isLoadingDetails && !activeMedia.bannerImage && !activeMedia.coverImage ? (
          <div className="w-full h-full bg-neutral-900 animate-pulse" />
        ) : ((activeMedia.category === 'manga' ? (activeMedia.coverImage || activeMedia.bannerImage) : (activeMedia.bannerImage || activeMedia.coverImage))?.trim()) ? (
          <img
            src={
              (activeMedia.category === 'manga'
                ? (activeMedia.coverImage || activeMedia.bannerImage)
                : (activeMedia.bannerImage || activeMedia.coverImage))!
            }
            alt={activeMedia.title || 'Media Cover'}
            className="w-full h-full object-cover object-top opacity-100"
          />
        ) : (
          <div className="w-full h-full bg-neutral-900" />
        )}

        {/* Layered Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

        {/* Center Next Episode Airing Timer Capsule Pill (Anime Only) */}
        {countdown && activeMedia.category === 'anime' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 pb-6 sm:pb-8">
            <div className="inline-flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full border border-white/20 bg-transparent shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
              <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {countdown.days} {countdown.days === 1 ? 'DAY' : 'DAYS'}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-white font-mono tracking-widest select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {String(countdown.hours).padStart(2, '0')} : {String(countdown.minutes).padStart(2, '0')} : {String(countdown.seconds).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. TITLE & METADATA SECTION */}
      <div className="relative -mt-24 px-4 space-y-3.5">
        {/* Title Field: Loading State vs Live Content */}
        {isLoadingDetails && !activeMedia.title ? (
          <div className="h-8 w-3/4 max-w-sm rounded-xl bg-white/10 animate-pulse" />
        ) : (
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
            {activeMedia.title}
          </h1>
        )}

        {/* Rating, Studio & Favorite Row */}
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-white/90">
          <div className="flex items-center gap-3 flex-wrap min-h-[30px]">
            {/* Rating Field: 1x increased prominent Star icon & score, perfectly aligned */}
            {isLoadingDetails && !ratingScore ? (
              <div className="h-7 w-18 rounded-md bg-white/10 animate-pulse" />
            ) : ratingScore ? (
              <div className="inline-flex items-center gap-1.5 text-white font-bold leading-none select-none">
                <Star className="w-[21px] h-[21px] text-amber-400 fill-amber-400/30 stroke-[2.2] shrink-0" />
                <span className="text-white font-black text-[17px] leading-none pt-[1px] tracking-tight">{ratingScore}</span>
              </div>
            ) : null}

            {/* Studio / Author Field: Clickable filter pill navigating to Search tab */}
            {isLoadingDetails && !studioName ? (
              <div className="h-7 w-24 rounded-full bg-white/10 animate-pulse" />
            ) : studioName ? (
              <button
                type="button"
                onClick={() => handleStudioOrAuthorClick(studioName)}
                className={`px-4 py-1.5 rounded-full border text-[13.5px] font-semibold tracking-normal truncate max-w-[200px] select-none box-border overflow-hidden leading-tight cursor-pointer hover:scale-105 active:scale-95 hover:opacity-90 transition-all ${colorPalettes.authorStudio.border} ${colorPalettes.authorStudio.bg} ${colorPalettes.authorStudio.text}`}
                title={`Filter by ${activeMedia.category === 'anime' ? 'Studio' : 'Author'}: ${studioName}`}
              >
                {studioName}
              </button>
            ) : null}
          </div>

          {/* Real User Love / Heart Reaction - shifted 10px further left (20px total) & 0.5x decreased size */}
          {isLoadingDetails && !activeMedia.id ? (
            <div className="h-7 w-8 rounded-full bg-white/10 animate-pulse -translate-x-[20px]" />
          ) : (
            <button
              onClick={() => toggleFavorite(activeMedia)}
              className="p-1.5 rounded-full text-white/80 hover:text-white transition-all cursor-pointer active:scale-90 -translate-x-[20px]"
              aria-label={isFavorite ? 'Remove reaction' : 'Give love reaction'}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white/80'
                }`}
              />
            </button>
          )}
        </div>

        {/* Airing Meta Info Row: Info icon + Status + Contained Year Pill (clickable filter) */}
        {isLoadingDetails && !ageRating && !airingStatus && !releaseYear ? (
          <div className="h-6 w-48 rounded bg-white/10 animate-pulse" />
        ) : (airingStatus || releaseYear || ageRating) ? (
          <div className="flex items-center gap-3 text-[13.5px] text-white font-medium">
            {airingStatus && (
              <button
                type="button"
                onClick={() => handleStatusClick(airingStatus)}
                className="inline-flex items-center gap-1.5 text-white/95 font-medium leading-none hover:text-purple-300 transition-colors cursor-pointer"
                title={`Filter by status: ${airingStatus}`}
              >
                <Info className="w-4 h-4 text-white/80 shrink-0" />
                <span className="capitalize leading-none">{airingStatus}</span>
              </button>
            )}
            {releaseYear && (
              <button
                type="button"
                onClick={() => handleYearClick(releaseYear)}
                className={`px-4 py-1.5 rounded-full border text-[13.5px] font-semibold select-none box-border overflow-hidden leading-tight cursor-pointer hover:scale-105 active:scale-95 hover:opacity-90 transition-all ${colorPalettes.releaseYear.border} ${colorPalettes.releaseYear.bg} ${colorPalettes.releaseYear.text}`}
                title={`Filter by year: ${releaseYear}`}
              >
                {releaseYear}
              </button>
            )}
            {ageRating && (
              <span className="text-white/50 text-[12.5px] font-medium">
                · {ageRating}
              </span>
            )}
          </div>
        ) : null}

        {/* Genre Chips: Clickable genre filter pills navigating to Search tab */}
        {isLoadingDetails && (!activeMedia.genres || activeMedia.genres.length === 0) ? (
          <div className="flex flex-wrap gap-2.5 pt-0.5">
            <div className="h-7 w-18 rounded-full bg-white/10 animate-pulse" />
            <div className="h-7 w-22 rounded-full bg-white/10 animate-pulse" />
            <div className="h-7 w-18 rounded-full bg-white/10 animate-pulse" />
          </div>
        ) : activeMedia.genres && activeMedia.genres.length > 0 ? (
          <div className="flex flex-wrap gap-2.5 pt-0.5">
            {activeMedia.genres.slice(0, 3).map((genre, idx) => {
              const pillPalette =
                idx === 0
                  ? colorPalettes.genre1
                  : idx === 1
                  ? colorPalettes.genre2
                  : colorPalettes.genre3;

              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreClick(genre)}
                  className={`px-4 py-1.5 rounded-full border text-[13.5px] font-semibold tracking-normal select-none box-border overflow-hidden leading-tight cursor-pointer hover:scale-105 active:scale-95 hover:opacity-90 transition-all ${pillPalette.border} ${pillPalette.bg} ${pillPalette.text}`}
                  title={`Filter by genre: ${genre}`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* PRIMARY ACTION ROW: Dynamic Add to Library Pill Button + Airing Anime Bell + Share Button */}
        <div className="border-t border-white/[0.08] pt-3.5 mt-3 flex items-center gap-3">
          {/* Library Status Pill with dynamic status icon and vibrant color */}
          {(() => {
            const btn = getLibraryButtonDetails();
            return (
              <button
                onClick={() => setShowAddToLibrary(true)}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 min-h-[50px] px-6 rounded-full font-bold text-sm sm:text-base transition-all cursor-pointer active:scale-[0.98] ${btn.className}`}
              >
                {btn.icon}
                <span className="tracking-wide">{btn.label}</span>
              </button>
            );
          })()}

          {/* Airing Anime Episode Release Notification Bell Button (matching exact screenshot) */}
          {isAiringAnime && (
            <button
              id="anime-airing-bell-btn"
              type="button"
              onClick={() => toggleAnimeAlert(activeMedia)}
              className="w-14 h-[50px] rounded-full bg-[#4e4b57] hover:bg-[#5c5966] flex items-center justify-center shrink-0 shadow-md transition-all cursor-pointer active:scale-95"
              aria-label={isSubscribedToAlert ? 'Disable episode notifications' : 'Enable episode notifications'}
              title={isSubscribedToAlert ? 'Episode notifications enabled' : 'Notify me when new episodes release'}
            >
              <Bell
                className={`w-5 h-5 transition-all duration-200 ${
                  isSubscribedToAlert
                    ? 'text-[#fed650] fill-[#fed650]'
                    : 'text-white fill-white'
                }`}
              />
            </button>
          )}

          {/* Circular Share Button matching screenshot */}
          <button
            onClick={handleShare}
            className="w-14 h-[50px] rounded-full bg-[#4e4b57] hover:bg-[#5c5966] text-white flex items-center justify-center shrink-0 shadow-md transition-all cursor-pointer active:scale-95"
            aria-label="Share"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Ultra-thin divider line under Action Bar with adjusted vertical padding */}
        <div className="border-b border-white/[0.08] my-3.5" />

        {/* 3. EPISODE / CHAPTER / VOLUME HEADER & ACTIONS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight leading-none">
                {activeMedia.category === 'anime'
                  ? 'Episodes'
                  : activeMedia.category === 'manga'
                  ? 'Chapters'
                  : 'Volumes'}
                {totalCount > 0 && ` (${totalCount})`}
              </h2>
              {activeMedia.category === 'anime' && runtimeMetricString && !isLoadingContent && (
                <span className="text-[11.5px] sm:text-xs font-bold text-white/70 tracking-normal uppercase leading-none pt-0.5">
                  {runtimeMetricString}
                </span>
              )}
            </div>

            {/* Action Buttons (Download & Search/Compass matching screenshot) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="details-download-button"
                onClick={() => {
                  if (!isLoadingContent && hasAiredContent) {
                    setShowDownloadModal(true);
                  }
                }}
                disabled={isLoadingContent || !hasAiredContent}
                className={`p-1 transition-all ${
                  isLoadingContent || !hasAiredContent
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : 'text-white opacity-100 hover:text-white/80 cursor-pointer active:scale-90'
                }`}
                title={
                  isLoadingContent
                    ? 'Loading content...'
                    : !hasAiredContent
                    ? 'No aired episodes or chapters available to download'
                    : 'Download'
                }
                aria-label={
                  isLoadingContent
                    ? 'Loading content...'
                    : !hasAiredContent
                    ? 'No aired episodes or chapters available to download'
                    : 'Download'
                }
              >
                {/* Solid download arrow with bottom bar matching exact screenshot */}
                <svg
                  className="w-[22px] h-[22px] shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M10 3.2c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v7.6h3.6c.62 0 .97.71.58 1.18l-5.6 6.3c-.32.36-.84.36-1.16 0l-5.6-6.3c-.39-.47-.04-1.18.58-1.18H10V3.2z" />
                  <rect x="4.5" y="20" width="15" height="2.4" rx="1.2" />
                </svg>
              </button>
              <button
                id="details-compass-search-button"
                onClick={() => setShowEpisodeSearch(true)}
                className="p-1 text-white hover:text-white/80 transition-all cursor-pointer active:scale-90"
                title="Search related series"
                aria-label="Search related series"
              >
                <Compass className="w-[22px] h-[22px] text-white stroke-[2.3]" />
              </button>
            </div>
          </div>

          {/* LOADING STATE */}
          {isLoadingContent ? (
            <div className="flex items-center justify-center gap-3 py-6 text-white/70">
              <DotPulseLoader size="sm" />
              <span className="text-xs font-medium text-white/70">
                {activeMedia.category === 'anime'
                  ? 'Loading episodes...'
                  : activeMedia.category === 'manga'
                  ? 'Loading chapters...'
                  : 'Loading volumes...'}
              </span>
            </div>
          ) : (
            <>
              {/* 4. DYNAMIC RANGE FILTER PILLS (e.g. 1-50, 51-100, 101-150, 151-200, 201-220) - Hidden for Novels */}
              {activeMedia.category !== 'novel' && ranges.length > 0 && totalCount > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {ranges.map((rangeStr, idx) => {
                    const isActive = selectedRangeIndex === idx;
                    return (
                      <button
                        key={rangeStr}
                        onClick={() => setSelectedRangeIndex(idx)}
                        className={`px-[12px] py-[8px] rounded-full text-[13px] sm:text-[14px] leading-none font-bold whitespace-nowrap transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#27163c] border border-[#a855f7] text-white'
                            : 'bg-[#13131b] border border-white/10 text-white/90 hover:border-white/30 hover:bg-[#1a1a26]'
                        }`}
                      >
                        {rangeStr}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 5. INTERACTIVE EPISODE / CHAPTER / VOLUME GRID (2-Row Interleaved Horizontal vs Expanded 8-Col Vertical) */}
              {activeMedia.category === 'anime' ? (
                displayedEpisodes.length === 0 ? (
                  <div className="py-4 text-center text-xs text-white/50">
                    No available aired episode yet.
                  </div>
                ) : (
                  <div>
                    {isGridExpanded ? (
                      <div className="grid grid-cols-8 gap-2 sm:gap-2.5 py-1">
                        {displayedEpisodes.map((ep) => {
                          const animeHistoryEntry = animeWatchHistory.find(
                            (item) => String(item.mediaId) === String(activeMedia.id)
                          );
                          const isCurrentWatched =
                            animeHistoryEntry !== undefined &&
                            animeHistoryEntry.lastWatchedEpisode === ep.number;

                          return (
                            <button
                              key={ep.id}
                              onClick={() => handleEpisodeClick(ep)}
                              className={`aspect-square flex flex-col items-center justify-center rounded-[18px] transition-colors shadow-sm active:scale-95 cursor-pointer font-black text-[13px] sm:text-sm leading-none select-none ${
                                isCurrentWatched
                                  ? 'bg-black border-[2px] border-[#a855f7] text-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.35)] hover:border-[#c084fc] hover:text-[#c084fc]'
                                  : 'bg-black border border-white/10 text-white hover:border-purple-500/60 hover:bg-white/5'
                              }`}
                            >
                              <span>{ep.number}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-2.5 overflow-x-auto no-scrollbar py-1">
                        {displayedEpisodes.map((ep) => {
                          const animeHistoryEntry = animeWatchHistory.find(
                            (item) => String(item.mediaId) === String(activeMedia.id)
                          );
                          const isCurrentWatched =
                            animeHistoryEntry !== undefined &&
                            animeHistoryEntry.lastWatchedEpisode === ep.number;

                          return (
                            <button
                              key={ep.id}
                              onClick={() => handleEpisodeClick(ep)}
                              className={`w-[52px] h-[52px] shrink-0 flex flex-col items-center justify-center rounded-[18px] transition-colors shadow-sm active:scale-95 cursor-pointer font-black text-[13px] sm:text-sm leading-none select-none ${
                                isCurrentWatched
                                  ? 'bg-black border-[2px] border-[#a855f7] text-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.35)] hover:border-[#c084fc] hover:text-[#c084fc]'
                                  : 'bg-black border border-white/10 text-white hover:border-purple-500/60 hover:bg-white/5'
                              }`}
                            >
                              <span>{ep.number}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Toggle Arrow (▼ Expand to 8-col / ▲ Collapse to 2-row) */}
                    <div className="flex justify-center pt-2.5 pb-1">
                      <button
                        onClick={() => setIsGridExpanded((prev) => !prev)}
                        className="p-2 text-white/80 hover:text-white transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                        aria-label={isGridExpanded ? 'Collapse episodes grid' : 'Expand episodes grid'}
                      >
                        {isGridExpanded ? (
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-white opacity-90 hover:opacity-100" />
                        ) : (
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white opacity-90 hover:opacity-100" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              ) : activeMedia.category === 'manga' ? (
                displayedMangaChapters.length === 0 ? (
                  <div className="py-4 text-center text-xs text-white/50">
                    No chapters available yet.
                  </div>
                ) : (
                  <div>
                    {isGridExpanded ? (
                      <div className="grid grid-cols-8 gap-2 sm:gap-2.5 py-1">
                        {displayedMangaChapters.map((ch) => {
                          const mangaHistoryEntry = mangaReadingHistory.find(
                            (item) => String(item.mediaId) === String(activeMedia.id)
                          );
                          const isCurrentRead =
                            mangaHistoryEntry !== undefined &&
                            mangaHistoryEntry.lastReadChapter === ch.chapterNumber;

                          return (
                            <button
                              key={ch.id}
                              onClick={() => handleMangaClick(ch)}
                              title={ch.title || `Chapter ${ch.chapterNumber}`}
                              className={`aspect-square flex flex-col items-center justify-center rounded-[18px] transition-colors shadow-sm active:scale-95 cursor-pointer font-black text-[13px] sm:text-sm leading-none select-none ${
                                isCurrentRead
                                  ? 'bg-black border-[2px] border-[#a855f7] text-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.35)] hover:border-[#c084fc] hover:text-[#c084fc]'
                                  : 'bg-black border border-white/10 text-white hover:border-purple-500/60 hover:bg-white/5'
                              }`}
                            >
                              <span>{ch.chapterNumber}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-2.5 overflow-x-auto no-scrollbar py-1">
                        {displayedMangaChapters.map((ch) => {
                          const mangaHistoryEntry = mangaReadingHistory.find(
                            (item) => String(item.mediaId) === String(activeMedia.id)
                          );
                          const isCurrentRead =
                            mangaHistoryEntry !== undefined &&
                            mangaHistoryEntry.lastReadChapter === ch.chapterNumber;

                          return (
                            <button
                              key={ch.id}
                              onClick={() => handleMangaClick(ch)}
                              title={ch.title || `Chapter ${ch.chapterNumber}`}
                              className={`w-[52px] h-[52px] shrink-0 flex flex-col items-center justify-center rounded-[18px] transition-colors shadow-sm active:scale-95 cursor-pointer font-black text-[13px] sm:text-sm leading-none select-none ${
                                isCurrentRead
                                  ? 'bg-black border-[2px] border-[#a855f7] text-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.35)] hover:border-[#c084fc] hover:text-[#c084fc]'
                                  : 'bg-black border border-white/10 text-white hover:border-purple-500/60 hover:bg-white/5'
                              }`}
                            >
                              <span>{ch.chapterNumber}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Toggle Arrow (▼ Expand to 8-col / ▲ Collapse to 2-row) */}
                    <div className="flex justify-center pt-2.5 pb-1">
                      <button
                        onClick={() => setIsGridExpanded((prev) => !prev)}
                        className="p-2 text-white/80 hover:text-white transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                        aria-label={isGridExpanded ? 'Collapse chapters grid' : 'Expand chapters grid'}
                      >
                        {isGridExpanded ? (
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-white opacity-90 hover:opacity-100" />
                        ) : (
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white opacity-90 hover:opacity-100" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                displayedNovelChapters.length === 0 ? (
                  <div className="py-4 text-center text-xs text-white/50">
                    No novel volumes available yet.
                  </div>
                ) : (
                  <div>
                    {/* Vertical Volumes List (Default 4 volumes vs Expanded all volumes) */}
                    <div className="space-y-0 py-0.5 divide-y divide-white/[0.07] transform-gpu">
                      {(isGridExpanded ? displayedNovelChapters : displayedNovelChapters.slice(0, 4)).map((ch) => {
                        const novelHistoryEntry = mangaReadingHistory.find(
                          (item) => String(item.mediaId) === String(activeMedia.id)
                        );
                        const isCurrentRead =
                          novelHistoryEntry !== undefined &&
                          novelHistoryEntry.lastReadChapter === (ch.volume || ch.chapterNumber);

                        return (
                          <div key={ch.id} className="py-0.5">
                            <button
                              onClick={() => handleNovelClick(ch)}
                              className="w-full py-3 px-1.5 flex items-center gap-4 text-left rounded-xl hover:bg-white/[0.03] active:scale-[0.99] cursor-pointer group transition-transform"
                            >
                              {((ch.coverImage || activeMedia.coverImage)?.trim()) ? (
                                <img
                                  src={(ch.coverImage || activeMedia.coverImage)!}
                                  alt={`Volume ${ch.volume || ch.chapterNumber}`}
                                  className={`w-[54px] h-[78px] sm:w-[58px] sm:h-[84px] rounded-[12px] object-cover bg-[#13131b] shrink-0 shadow-md border ${
                                    isCurrentRead
                                      ? 'border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                                      : 'border-white/10'
                                  }`}
                                  loading="lazy"
                                  onError={(e) => {
                                    if (activeMedia.coverImage && e.currentTarget.src !== activeMedia.coverImage) {
                                      e.currentTarget.src = activeMedia.coverImage;
                                    }
                                  }}
                                />
                              ) : (
                                <div
                                  className={`w-[54px] h-[78px] sm:w-[58px] sm:h-[84px] rounded-[12px] bg-[#13131b] shrink-0 shadow-md border flex items-center justify-center ${
                                    isCurrentRead
                                      ? 'border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                                      : 'border-white/10'
                                  }`}
                                >
                                  <BookOpen className="w-5 h-5 text-white/30" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3
                                  className={`text-[15px] sm:text-base font-semibold tracking-tight truncate ${
                                    isCurrentRead ? 'text-[#a855f7] font-bold' : 'text-white'
                                  }`}
                                >
                                  {`Volume ${ch.volume || ch.chapterNumber}`}
                                </h3>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Toggle Arrow (▼ Expand to show all / ▲ Collapse to show first 4) */}
                    {displayedNovelChapters.length > 4 && (
                      <div className="flex justify-center pt-3 pb-1">
                        <button
                          onClick={() => setIsGridExpanded((prev) => !prev)}
                          className="p-2 text-white/80 hover:text-white transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                          aria-label={isGridExpanded ? 'Collapse novel volumes' : 'Expand novel volumes'}
                        >
                          {isGridExpanded ? (
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-white opacity-90 hover:opacity-100" />
                          ) : (
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white opacity-90 hover:opacity-100" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* DESCRIPTION & SYNOPSIS: Loading Skeleton vs Real Content */}
        <div
          className={`space-y-3 pt-4 ${
            String(activeMedia.category).toLowerCase() !== 'novel'
              ? 'border-t border-white/[0.08]'
              : ''
          }`}
        >
          <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight leading-none">
            Description
          </h2>
          {isLoadingDetails && !activeMedia.description ? (
            <div className="space-y-2.5 py-1">
              <div className="h-4.5 w-full rounded bg-white/10 animate-pulse" />
              <div className="h-4.5 w-5/6 rounded bg-white/10 animate-pulse" />
              <div className="h-4.5 w-4/6 rounded bg-white/10 animate-pulse" />
            </div>
          ) : activeMedia.description ? (
            <p className="text-[15px] sm:text-[16px] text-white/90 leading-[1.65] font-normal whitespace-pre-line tracking-normal">
              {activeMedia.description}
            </p>
          ) : null}
          {activeMedia.sourceNote && (
            <p className="text-sm text-white/60 font-medium italic pt-1">{activeMedia.sourceNote}</p>
          )}

          {/* PREQUEL / SEQUEL OPTIONS (Image format matching exact screenshot for Anime, Manga, Novel) */}
          {(hasPrequel || hasSequel) && (
            <div
              className={`pt-2.5 sm:pt-3 ${
                hasPrequel && hasSequel
                  ? 'grid grid-cols-2 gap-2.5 sm:gap-3'
                  : 'w-full'
              }`}
            >
              {hasPrequel && (
                <button
                  type="button"
                  id="details-prequel-btn"
                  onClick={() => {
                    if (prequelRelation) {
                      openMediaDetails({
                        id: prequelRelation.id,
                        title: prequelRelation.title,
                        coverImage: prequelRelation.coverImage,
                        bannerImage: prequelRelation.bannerImage,
                        category: activeMedia.category,
                        format: (prequelRelation.format as any) || activeMedia.format,
                        status: 'Finished',
                        score: prequelRelation.score || activeMedia.score,
                        year: prequelRelation.year || activeMedia.year,
                        genres: activeMedia.genres,
                        description: `Prequel of ${activeMedia.title}.`,
                      });
                    } else {
                      showToast(`Opening prequel for ${activeMedia.title}...`);
                    }
                  }}
                  className="group relative w-full h-14 sm:h-16 rounded-[16px] sm:rounded-[18px] overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-md focus:outline-none border-0 outline-none"
                >
                  {/* Background Artwork */}
                  {((prequelRelation?.bannerImage || prequelRelation?.coverImage || activeMedia.coverImage)?.trim()) ? (
                    <img
                      src={(prequelRelation?.bannerImage || prequelRelation?.coverImage || activeMedia.coverImage)!}
                      alt={prequelRelation?.title || 'Prequel'}
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#161722]" />
                  )}
                  {/* Dark Tint Overlay matching Screenshot */}
                  <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition-colors" />
                  {/* Centered PREQUEL Label */}
                  <div className="relative z-10 w-full h-full flex items-center justify-center">
                    <span className="font-black text-white text-[15px] sm:text-base tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      PREQUEL
                    </span>
                  </div>
                </button>
              )}

              {hasSequel && (
                <button
                  type="button"
                  id="details-sequel-btn"
                  onClick={() => {
                    if (sequelRelation) {
                      openMediaDetails({
                        id: sequelRelation.id,
                        title: sequelRelation.title,
                        coverImage: sequelRelation.coverImage,
                        bannerImage: sequelRelation.bannerImage,
                        category: activeMedia.category,
                        format: (sequelRelation.format as any) || activeMedia.format,
                        status: 'Releasing',
                        score: sequelRelation.score || activeMedia.score,
                        year: sequelRelation.year || activeMedia.year,
                        genres: activeMedia.genres,
                        description: `Sequel of ${activeMedia.title}.`,
                      });
                    } else {
                      showToast(`Opening sequel for ${activeMedia.title}...`);
                    }
                  }}
                  className="group relative w-full h-14 sm:h-16 rounded-[16px] sm:rounded-[18px] overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-md focus:outline-none border-0 outline-none"
                >
                  {/* Background Artwork */}
                  {((sequelRelation?.bannerImage || sequelRelation?.coverImage || activeMedia.coverImage)?.trim()) ? (
                    <img
                      src={(sequelRelation?.bannerImage || sequelRelation?.coverImage || activeMedia.coverImage)!}
                      alt={sequelRelation?.title || 'Sequel'}
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#161722]" />
                  )}
                  {/* Dark Tint Overlay matching Screenshot */}
                  <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition-colors" />
                  {/* Centered SEQUEL Label */}
                  <div className="relative z-10 w-full h-full flex items-center justify-center">
                    <span className="font-black text-white text-[15px] sm:text-base tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      SEQUEL
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* FRANCHISE NAVIGATION BUTTONS: THEMES / WATCH ORDER (STRICTLY ONLY FOR ANIME) */}
        {isAnime && (
          <div className="pt-3">
            <div className="flex items-center gap-3">
              <button
                id="anime-themes-btn"
                onClick={() => showToast('Opening Themes...')}
                className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-full bg-[#24242c] hover:bg-[#2e2e38] text-white font-bold text-[15px] sm:text-base transition-all duration-150 cursor-pointer active:scale-95 shadow-sm select-none"
              >
                {/* Music Note with Flag Icon matching exact screenshot */}
                <svg className="w-[18px] h-[18px] text-white fill-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                <span className="tracking-tight">Themes</span>
              </button>

              <button
                id="anime-watch-order-btn"
                onClick={() => setShowWatchOrder(true)}
                className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-full bg-[#24242c] hover:bg-[#2e2e38] text-white font-bold text-[15px] sm:text-base transition-all duration-150 cursor-pointer active:scale-95 shadow-sm select-none"
              >
                {/* Bulleted list icon matching exact screenshot */}
                <svg className="w-[18px] h-[18px] text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="9" y1="6" x2="20" y2="6" />
                  <line x1="9" y1="12" x2="20" y2="12" />
                  <line x1="9" y1="18" x2="20" y2="18" />
                  <circle cx="4" cy="6" r="1.3" fill="currentColor" />
                  <circle cx="4" cy="12" r="1.3" fill="currentColor" />
                  <circle cx="4" cy="18" r="1.3" fill="currentColor" />
                </svg>
                <span className="tracking-tight">Watch Order</span>
              </button>
            </div>
          </div>
        )}

        {/* REVIEWS (Only rendered when real user reviews exist) */}
        {activeMedia.reviews && activeMedia.reviews.length > 0 && (
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight leading-none">Reviews</h2>
              <button
                onClick={() => showToast('Review modal opened')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 text-purple-400 font-bold text-xs border border-purple-500/30 hover:bg-purple-600/30 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Write a Review</span>
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {activeMedia.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="min-w-[280px] max-w-[320px] p-3.5 bg-[#14141C] rounded-2xl border border-white/10 space-y-2 shrink-0 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {rev.authorAvatar && rev.authorAvatar.trim() !== '' ? (
                        <img
                          src={rev.authorAvatar}
                          alt={rev.authorName}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-purple-600/30 flex items-center justify-center text-[10px] font-bold text-purple-300">
                          {rev.authorName ? rev.authorName.slice(0, 1) : 'U'}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-white">{rev.authorName}</div>
                        <div className="text-[10px] text-white/50">+{rev.helpfulCount} helpful</div>
                      </div>
                    </div>
                    <div className="px-2 py-0.5 rounded-md bg-white/10 text-amber-400 font-black text-xs">
                      {rev.score}
                    </div>
                  </div>
                  {rev.headline && (
                    <h4 className="text-xs font-bold text-white line-clamp-1">{rev.headline}</h4>
                  )}
                  <p className="text-xs text-white/70 line-clamp-3 leading-relaxed">{rev.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHARACTERS */}
        {orderedCharacters.length > 0 && (
          <div className="pt-4 space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight leading-none">Characters</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {orderedCharacters.map((char) => {
                const isMain = (char.role || '').toLowerCase().includes('main');
                const roleLabel = isMain ? 'Main' : 'Supporting';
                return (
                  <div
                    key={char.id}
                    onClick={() => setSelectedCharacter(char)}
                    className="w-24 sm:w-28 shrink-0 cursor-pointer group"
                  >
                    <PosterImage
                      src={char.image}
                      alt={char.name}
                      className="aspect-[3/4] rounded-2xl border border-white/5 group-hover:border-purple-500/50 transition-all shadow-md"
                    />
                    <h4 className="mt-1.5 text-xs sm:text-[13px] font-bold text-white line-clamp-1 group-hover:text-purple-300">
                      {char.name}
                    </h4>
                    <p className="text-[11px] text-white/60 font-medium">{roleLabel}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VOICE ACTORS */}
        {activeMedia.voiceActors && activeMedia.voiceActors.length > 0 && (
          <div className="pt-4 space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight leading-none">Voice Actors</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {activeMedia.voiceActors.map((va) => (
                <div key={va.id} className="w-24 sm:w-28 shrink-0">
                  <PosterImage
                    src={va.image}
                    alt={va.name}
                    className="aspect-[3/4] rounded-2xl border border-white/5 shadow-md"
                  />
                  <h4 className="mt-1.5 text-xs sm:text-[13px] font-bold text-white line-clamp-1">{va.name}</h4>
                  <p className="text-[11px] text-white/60 font-medium">{va.characterRole}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RELATIONS */}
        {activeMedia.relations && activeMedia.relations.length > 0 && (
          <div className="pt-4 space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight leading-none">Relations</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {activeMedia.relations.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() =>
                    openMediaDetails({
                      id: rel.id,
                      title: rel.title,
                      coverImage: rel.coverImage,
                      category: activeMedia.category,
                      format: (rel.format as any) || activeMedia.format,
                      status: 'Finished',
                      score: rel.score || 8.0,
                      year: rel.year ?? '',
                      genres: activeMedia.genres,
                      description: 'Related work in this series.',
                    })
                  }
                  className="w-24 sm:w-28 shrink-0 group cursor-pointer"
                >
                  <PosterImage
                    src={rel.coverImage}
                    alt={rel.title}
                    className="aspect-[3/4] rounded-2xl border border-white/5 shadow-md group-hover:scale-105 transition-transform"
                  />
                  <h4 className="mt-1.5 text-xs sm:text-[13px] font-bold text-white line-clamp-1 group-hover:text-purple-300">
                    {rel.title}
                  </h4>
                  <p className="text-[11px] text-white/60 font-medium">
                    {rel.relationType}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECOMMENDATIONS */}
        {activeMedia.recommendations && activeMedia.recommendations.length > 0 && (
          <div className="pt-4 space-y-3">
            <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight leading-none">Recommendations</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {activeMedia.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() =>
                    openMediaDetails({
                      id: rec.id,
                      title: rec.title,
                      coverImage: rec.coverImage,
                      category: rec.category || activeMedia.category,
                      format: (rec.format as any) || activeMedia.format,
                      status: 'Releasing',
                      score: rec.score,
                      year: rec.year ?? '',
                      genres: activeMedia.genres,
                      description: 'Recommended title from community suggestions.',
                    })
                  }
                  className="w-24 sm:w-28 shrink-0 group cursor-pointer"
                >
                  <PosterImage
                    src={rec.coverImage}
                    alt={rec.title}
                    className="aspect-[3/4] rounded-2xl border border-white/5 shadow-md group-hover:scale-105 transition-transform"
                  >
                    {/* Consistent Midnight Sapphire Pill matching all other cards in the App */}
                    {rec.score && rec.score > 0 ? (
                      <div className="absolute bottom-2 left-2 z-10 select-none pointer-events-none">
                        <div className="h-[22px] min-w-[34px] px-2 rounded-full bg-[#1e4ca6]/90 backdrop-blur-none border-2 border-white/70 text-white text-[11px] font-black shadow-md flex items-center justify-center leading-none tracking-tight">
                          {rec.score > 10 ? (rec.score / 10).toFixed(1) : rec.score.toFixed(1)}
                        </div>
                      </div>
                    ) : null}
                  </PosterImage>
                  <h4 className="mt-1.5 text-xs sm:text-[13px] font-bold text-white line-clamp-1 group-hover:text-purple-300">
                    {rec.title}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. DOWNLOAD MODAL (Full 95dvh Sheet matching WatchOrderModal) */}
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        media={activeMedia}
        episodes={episodes}
        mangaChapters={mangaChapters}
        novelChapters={novelChapters}
      />
    </div>
  );
};
