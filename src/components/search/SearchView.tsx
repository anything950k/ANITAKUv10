import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, SlidersHorizontal, ChevronDown, Check, X } from 'lucide-react';
import { useApp, DEFAULT_FILTERS } from '../../context/AppContext';
import { searchAniList, searchMangaDexList, optimizeImageUrl } from '../../services/apiClient';
import { cacheGet, cacheGetSync, cacheSet, preloadMediaImages } from '../../services/cacheService';
import { MediaCategory, MediaItem, FilterOptions } from '../../types';
import { getRatingDisplay, sortByRatingDescending } from '../../utils/rating';
import { PosterImage } from '../common/PosterImage';

// Synchronous instant local filter matching helper
function applyLocalFilterMatching(
  items: MediaItem[],
  filterObj: FilterOptions,
  query: string
): MediaItem[] {
  const trimmedQ = query.trim().toLowerCase();
  const matched = items.filter((item) => {
    // Search query match if provided
    if (trimmedQ) {
      const matchTitle =
        item.title?.toLowerCase().includes(trimmedQ) ||
        item.romajiTitle?.toLowerCase().includes(trimmedQ) ||
        item.nativeTitle?.toLowerCase().includes(trimmedQ) ||
        item.genres?.some((g) => g.toLowerCase().includes(trimmedQ)) ||
        item.author?.toLowerCase().includes(trimmedQ) ||
        item.studio?.toLowerCase().includes(trimmedQ);
      if (!matchTitle) return false;
    }

    // Category
    if (filterObj.category) {
      if (filterObj.category === 'anime' && item.category !== 'anime') return false;
      if (filterObj.category === 'manga' && item.category !== 'manga') return false;
      if (filterObj.category === 'novel' && item.category !== 'novel') return false;
    }

    // Genres
    if (filterObj.genres && filterObj.genres.length > 0) {
      const hasGenres = filterObj.genres.every((g) =>
        item.genres?.some((ig) => ig.toLowerCase() === g.toLowerCase())
      );
      if (!hasGenres) return false;
    }

    // Advanced Tags
    if (filterObj.advancedTags && filterObj.advancedTags.length > 0) {
      const hasTags = filterObj.advancedTags.every(
        (t) =>
          item.genres?.some((ig) => ig.toLowerCase() === t.toLowerCase()) ||
          item.description?.toLowerCase().includes(t.toLowerCase())
      );
      if (!hasTags) return false;
    }

    // Format
    if (filterObj.format && filterObj.format.length > 0) {
      const itemFmt = (item.format || '').toUpperCase().replace(/\s+/g, '_');
      const hasFormat = filterObj.format.some((f) => {
        const target = f.toUpperCase().replace(/\s+/g, '_');
        if (target === 'TV') return itemFmt === 'TV' || itemFmt === 'TV_SHORT';
        if (target === 'MANGA') return itemFmt === 'MANGA' || itemFmt === 'ONE_SHOT';
        if (target === 'NOVEL') return itemFmt === 'NOVEL' || itemFmt === 'LIGHT_NOVEL';
        return itemFmt === target;
      });
      if (!hasFormat) return false;
    }

    // Status
    if (filterObj.status && filterObj.status.length > 0) {
      const itemSt = (item.status || '').toLowerCase();
      const hasStatus = filterObj.status.some((s) => {
        const sLow = s.toLowerCase();
        if (sLow.includes('releas')) return itemSt.includes('releas') || itemSt.includes('ongoing');
        if (sLow.includes('finish')) return itemSt.includes('finish') || itemSt.includes('complet');
        if (sLow.includes('upcom') || sLow.includes('not yet'))
          return itemSt.includes('upcom') || itemSt.includes('not yet');
        return itemSt.includes(sLow);
      });
      if (!hasStatus) return false;
    }

    // Min Score ('6+', '7+', '8+', '9+')
    if (filterObj.minScore && filterObj.minScore !== 'Any') {
      const min = parseFloat(filterObj.minScore);
      if (!isNaN(min) && (item.score || 0) < min) {
        return false;
      }
    }

    // Score Range
    if (filterObj.scoreRange) {
      const minScoreVal = filterObj.scoreRange[0] / 10;
      const maxScoreVal = filterObj.scoreRange[1] / 10;
      if (filterObj.scoreRange[0] > 0 && (item.score || 0) < minScoreVal) return false;
      if (filterObj.scoreRange[1] < 100 && (item.score || 0) > maxScoreVal) return false;
    }

    // Year chip
    if (filterObj.selectedYear && filterObj.selectedYear !== 'Any') {
      const yr = parseInt(filterObj.selectedYear, 10);
      if (!isNaN(yr)) {
        const itemYr = typeof item.year === 'number' ? item.year : parseInt(String(item.year), 10);
        const itemSeasonYr = item.seasonYear;
        if (itemYr !== yr && itemSeasonYr !== yr) {
          return false;
        }
      }
    }

    // Year Range
    if (filterObj.yearRange && (filterObj.yearRange[0] > 1940 || filterObj.yearRange[1] < 2028)) {
      const itemYr = typeof item.year === 'number' ? item.year : parseInt(String(item.year), 10);
      const itemSeasonYr = item.seasonYear;
      const yrToCheck = itemYr || itemSeasonYr;
      if (yrToCheck && (yrToCheck < filterObj.yearRange[0] || yrToCheck > filterObj.yearRange[1])) {
        return false;
      }
    }

    // Season
    if (filterObj.season && filterObj.season.length > 0) {
      const validSeasons = filterObj.season.filter((s) => s !== 'Any');
      if (validSeasons.length > 0) {
        if (!item.season || !validSeasons.some((s) => s.toLowerCase() === item.season?.toLowerCase())) {
          return false;
        }
      }
    }

    // Author / Studio
    if (filterObj.studio && filterObj.studio.trim()) {
      const q = filterObj.studio.trim().toLowerCase();
      const matchStudio = item.studio?.toLowerCase().includes(q);
      const matchAuthor = item.author?.toLowerCase().includes(q);
      if (!matchStudio && !matchAuthor) {
        return false;
      }
    }

    return true;
  });

  // Default content when user has not typed a search query is sorted by Ratings descending
  if (!trimmedQ) {
    return sortByRatingDescending(matched);
  }

  return matched;
}

function getCategoryFallbackRecommendations(cat: MediaCategory): MediaItem[] {
  const allCached = getAllCachedMediaItems();
  const matchedCat = allCached.filter((item) => (item.category || 'anime') === cat);
  if (matchedCat.length > 0) {
    return sortByRatingDescending(matchedCat).slice(0, 50);
  }
  return [];
}

function getAllCachedMediaItems(): MediaItem[] {
  const keys = [
    'home_anime_popular_season_active_30',
    'home_anime_popular_season_30',
    'home_anime_popular_season_10',
    'home_anime_trending_15',
    'home_anime_trending_6',
    'home_anime_new_episodes_40',
    'home_anime_community_loved_30',
    'home_anime_recently_completed_30',
    'home_anime_movies_30',
    'home_anime_upcoming_50',
    'home_manga_popular_30',
    'home_manga_popular_10',
    'home_manga_trending_15',
    'home_manga_trending_6',
    'home_manga_releasing_30',
    'home_manga_community_loved_30',
    'home_novel_popular_30',
    'home_novel_popular_10',
    'home_novel_seasonal_30',
    'home_novel_seasonal_10',
    'home_novel_trending_30',
    'home_novel_fantasy_30',
  ];
  const items: MediaItem[] = [];
  const seen = new Set<string>();

  const addItems = (arr: any) => {
    if (Array.isArray(arr)) {
      for (const raw of arr) {
        if (!raw) continue;
        const item: MediaItem = (raw.media && raw.media.id && (raw.media.title || raw.media.englishTitle))
          ? raw.media
          : raw;
        if (item && item.id && (item.title || item.englishTitle || item.romajiTitle)) {
          const idStr = String(item.id).trim();
          if (!seen.has(idStr)) {
            seen.add(idStr);
            const rawCover =
              (typeof item.coverImage === 'string' && item.coverImage.trim()) ||
              (typeof item.bannerImage === 'string' && item.bannerImage.trim()) ||
              '';
            const cleanCover = optimizeImageUrl(rawCover) || '';
            items.push({
              ...item,
              coverImage: cleanCover,
            });
          }
        }
      }
    }
  };

  for (const k of keys) {
    addItems(cacheGetSync<MediaItem[]>(k));
  }

  // Also collect from all discovered and search caches in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const fullKey = window.localStorage.key(i);
        if (fullKey && fullKey.startsWith('satori_cache_')) {
          const raw = window.localStorage.getItem(fullKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && Array.isArray(parsed.data)) {
                addItems(parsed.data);
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  return items;
}

export const SearchView: React.FC = () => {
  const { filters, setFilters, setShowFilterModal, openMediaDetails, userLibrary } = useApp();
  const [searchInput, setSearchInput] = useState(filters.query || '');

  // Keep searchInput in sync when filters.query is changed externally (e.g. from pill clicks)
  useEffect(() => {
    setSearchInput(filters.query || '');
  }, [filters.query]);
  
  // Synchronous initial hydration from category cache or recommendations
  const [results, setResults] = useState<MediaItem[]>(() => {
    return getCategoryFallbackRecommendations(filters.category);
  });
  
  const [loading, setLoading] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchRequestIdRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const categoryCacheRef = useRef<Map<string, MediaItem[]>>(new Map());
  const allDiscoveredItemsRef = useRef<MediaItem[]>(getAllCachedMediaItems());

  const handleHeaderWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (contentScrollRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      contentScrollRef.current.scrollTop += e.deltaY;
    }
  };

  const mergeDiscoveredItems = useCallback((newItems: MediaItem[]) => {
    if (!newItems || newItems.length === 0) return;
    preloadMediaImages(newItems);
    const existingIds = new Set(allDiscoveredItemsRef.current.map((i) => String(i.id)));
    const toAdd = newItems.filter((i) => !existingIds.has(String(i.id)));
    if (toAdd.length > 0) {
      allDiscoveredItemsRef.current = [...allDiscoveredItemsRef.current, ...toAdd];
    }
  }, []);

  // Helper to generate consistent cache key
  const getCacheKey = useCallback(
    (cat: MediaCategory, query: string, filterObj: typeof filters) => {
      return `${cat}_${query.trim().toLowerCase()}_${JSON.stringify({
        g: filterObj.genres,
        f: filterObj.format,
        s: filterObj.status,
        lib: filterObj.libraryState,
        ms: filterObj.minScore,
        sr: filterObj.scoreRange,
        sy: filterObj.selectedYear,
        yr: filterObj.yearRange,
        se: filterObj.season,
        st: filterObj.studio,
        at: filterObj.advancedTags,
      })}`;
    },
    []
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Pre-load default initial search items for Anime, Manga, and Novel on mount for instant zero-latency switching
  useEffect(() => {
    const prefetchCategories = async () => {
      const categories: MediaCategory[] = ['anime', 'manga', 'novel'];
      for (const cat of categories) {
        const key = getCacheKey(cat, '', filters);
        if (!categoryCacheRef.current.has(key)) {
          searchAniList('', { ...filters, category: cat }, 1, 50)
            .then((res) => {
              if (res?.items && res.items.length > 0) {
                const sorted = sortByRatingDescending(res.items);
                mergeDiscoveredItems(sorted);
                categoryCacheRef.current.set(key, sorted);
                // If it matches currently selected category and results are still empty or showing fallback, set results
                if (cat === filters.category && (!results || results.length === 0 || !searchInput)) {
                  setResults(sorted);
                }
              }
            })
            .catch(() => {});
        }
      }
    };
    prefetchCategories();
  }, []);

  // Perform search when filters or searchInput changes
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const currentKey = getCacheKey(filters.category, searchInput, filters);
    const cachedItems = categoryCacheRef.current.get(currentKey) || cacheGetSync<MediaItem[]>(`search_${currentKey}`);

    let instantResultsShown = false;

    // 1. If exact cached results exist, display them instantly with ZERO latency
    if (cachedItems && cachedItems.length > 0) {
      setResults(cachedItems);
      setLoading(false);
      instantResultsShown = true;
    } else {
      // 2. Instant local filter matching from all discovered items so content updates instantly with 0ms delay
      const instantLocalMatches = applyLocalFilterMatching(
        allDiscoveredItemsRef.current,
        filters,
        searchInput
      );
      if (instantLocalMatches.length > 0) {
        setResults(instantLocalMatches);
        setLoading(false);
        instantResultsShown = true;
      } else if (!searchInput.trim()) {
        const fallbacks = getCategoryFallbackRecommendations(filters.category);
        const filteredFallbacks = applyLocalFilterMatching(fallbacks, filters, searchInput);
        if (filteredFallbacks.length > 0) {
          setResults(filteredFallbacks);
          setLoading(false);
          instantResultsShown = true;
        } else if (fallbacks.length > 0) {
          setResults(fallbacks);
        }
      }
    }

    // Debounce for text query changes; instant execution for category / filter shifts
    const isTyping = searchInput.trim() !== (filters.query || '').trim();
    const delay = isTyping ? 180 : 0;
    const reqId = ++searchRequestIdRef.current;

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        // Only show skeleton if no instant results are currently displayed
        if (!instantResultsShown) {
          setLoading(true);
        }
        let fetchedItems: MediaItem[] = [];
        try {
          const fetchLimit = !searchInput.trim() ? 50 : 40;
          const response = await searchAniList(searchInput, filters, 1, fetchLimit);
          if (Array.isArray(response?.items)) {
            fetchedItems = response.items;
          }
        } catch (e) {
          console.warn('AniList search failed:', e);
        }

        // If manga category and no items found or AniList errored, try MangaDex search
        if (fetchedItems.length === 0 && filters.category === 'manga' && searchInput.trim()) {
          try {
            const mdItems = await searchMangaDexList(searchInput.trim(), 25);
            if (Array.isArray(mdItems) && mdItems.length > 0) {
              fetchedItems = mdItems;
            }
          } catch (e) {
            console.warn('MangaDex fallback search failed:', e);
          }
        }

        if (reqId !== searchRequestIdRef.current) return;

        // Ensure all items have optimized and valid cover images from real API
        const sanitizedItems: MediaItem[] = fetchedItems.map((item) => ({
          ...item,
          coverImage: optimizeImageUrl(item.coverImage || item.bannerImage) || '',
        }));

        if (sanitizedItems.length > 0) {
          const finalItems = !searchInput.trim() ? sortByRatingDescending(sanitizedItems) : sanitizedItems;
          mergeDiscoveredItems(finalItems);
          categoryCacheRef.current.set(currentKey, finalItems);
          cacheSet(`search_${currentKey}`, finalItems);
          setResults(finalItems);
        } else if (!searchInput.trim()) {
          const fallbacks = getCategoryFallbackRecommendations(filters.category);
          const filteredFallbacks = applyLocalFilterMatching(fallbacks, filters, searchInput);
          if (filteredFallbacks.length > 0) {
            setResults(sortByRatingDescending(filteredFallbacks));
          } else if (fallbacks.length > 0) {
            setResults(sortByRatingDescending(fallbacks));
          }
        } else {
          // If live API returns no items for this query, try client-side local matching from all cached discovered items
          const localFallback = applyLocalFilterMatching(
            allDiscoveredItemsRef.current,
            filters,
            searchInput
          );
          if (localFallback.length > 0 || !instantResultsShown) {
            setResults(localFallback);
          }
        }
      } catch (err) {
        console.error('Error during search:', err);
        if (reqId === searchRequestIdRef.current) {
          const localFallback = applyLocalFilterMatching(
            allDiscoveredItemsRef.current,
            filters,
            searchInput
          );
          if (localFallback.length > 0 || !instantResultsShown) {
            setResults(localFallback);
          }
        }
      } finally {
        if (reqId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    }, delay);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    searchInput,
    filters.category,
    filters.genres,
    filters.format,
    filters.status,
    filters.libraryState,
    filters.minScore,
    filters.scoreRange,
    filters.selectedYear,
    filters.yearRange,
    filters.season,
    filters.studio,
    filters.advancedTags,
    getCacheKey,
    mergeDiscoveredItems,
  ]);

  const handleCategorySelect = (cat: MediaCategory) => {
    if (cat === filters.category) {
      setCategoryDropdownOpen(false);
      return;
    }

    // Immediately swap results from cache or fallbacks if present for instant zero-latency transition
    const targetKey = getCacheKey(cat, searchInput, { ...filters, category: cat });
    const cached = categoryCacheRef.current.get(targetKey) || cacheGetSync<MediaItem[]>(`search_${targetKey}`);
    if (cached && cached.length > 0) {
      setResults(cached);
      setLoading(false);
    } else {
      const instantMatches = applyLocalFilterMatching(
        allDiscoveredItemsRef.current,
        { ...filters, category: cat },
        searchInput
      );
      if (instantMatches.length > 0) {
        setResults(instantMatches);
        setLoading(false);
      } else {
        const fallbacks = getCategoryFallbackRecommendations(cat);
        if (fallbacks.length > 0) {
          setResults(fallbacks);
        }
      }
    }

    setFilters((prev) => ({ ...prev, category: cat }));
    setCategoryDropdownOpen(false);
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const removeFilter = (type: string, value?: string) => {
    setFilters((prev) => {
      switch (type) {
        case 'genre':
          return { ...prev, genres: prev.genres.filter((g) => g !== value) };
        case 'format':
          return { ...prev, format: prev.format.filter((f) => f !== value) };
        case 'status':
          return { ...prev, status: prev.status.filter((s) => s !== value) };
        case 'season':
          return { ...prev, season: prev.season.filter((s) => s !== value) };
        case 'libraryState':
          return { ...prev, libraryState: 'Any' };
        case 'minScore':
          return { ...prev, minScore: 'Any' };
        case 'scoreRange':
          return { ...prev, scoreRange: [0, 100] };
        case 'selectedYear':
          return { ...prev, selectedYear: 'Any' };
        case 'yearRange':
          return { ...prev, yearRange: [1940, 2028] };
        case 'studio':
          return { ...prev, studio: '' };
        case 'advancedTags':
          return { ...prev, advancedTags: prev.advancedTags.filter((t) => t !== value) };
        case 'all':
          return {
            ...DEFAULT_FILTERS,
            category: prev.category,
            query: prev.query,
          };
        default:
          return prev;
      }
    });
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const getCategoryLabel = (cat: MediaCategory) => {
    switch (cat) {
      case 'anime':
        return 'Anime';
      case 'manga':
        return 'Manga';
      case 'novel':
        return 'Novel';
      default:
        return 'Anime';
    }
  };

  const activeFiltersCount =
    filters.genres.length +
    filters.format.length +
    filters.status.length +
    (filters.libraryState !== 'Any' ? 1 : 0) +
    (filters.minScore !== 'Any' ? 1 : 0) +
    (filters.scoreRange[0] > 0 || filters.scoreRange[1] < 100 ? 1 : 0) +
    (filters.selectedYear !== 'Any' ? 1 : 0) +
    (filters.yearRange[0] > 1940 || filters.yearRange[1] < 2028 ? 1 : 0) +
    filters.season.length +
    (filters.studio ? 1 : 0) +
    filters.advancedTags.length;

  const displayResults = React.useMemo(() => {
    let list = results;
    if (filters.libraryState === 'In Library') {
      list = list.filter((item) =>
        userLibrary.some((entry) => String(entry.mediaId) === String(item.id))
      );
    } else if (filters.libraryState === 'Not In Library') {
      list = list.filter(
        (item) => !userLibrary.some((entry) => String(entry.mediaId) === String(item.id))
      );
    }
    const unique = Array.from(new Map(list.map((item) => [String(item.id), item])).values());
    // When showing default content (no search query typed), sort strictly by Ratings descending:
    // higher ratings at the top, lower ratings at the bottom
    if (!searchInput.trim()) {
      return sortByRatingDescending(unique).slice(0, 50);
    }
    return unique;
  }, [results, filters.libraryState, userLibrary, searchInput]);

  return (
    <div className="relative w-full h-screen sm:h-[100dvh] flex flex-col bg-black text-white select-none overflow-hidden">
      {/* Background Top GIF Canvas (Positioned at top in original size, vertically shifted 140px upwards, zero blur, zero darkening filter, smoothly fading to black at bottom starting 10px lower) */}
      <div className="absolute top-0 left-0 right-0 h-[490px] sm:h-[550px] pointer-events-none z-0 overflow-hidden">
        <img
          src="https://www.image2url.com/r2/default/gifs/1789824067096-d43b5f0a-426e-4384-bbf9-54c05fee493a.gif"
          alt="Search Background Canvas"
          className="w-full h-[calc(100%+140px)] object-cover object-top -translate-y-[140px]"
          referrerPolicy="no-referrer"
        />
        {/* Ultra-smooth multi-stop gradient transition to solid black at bottom edge, starting 10px lower */}
        <div className="absolute inset-x-0 bottom-0 h-36 [background:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.15)_30%,rgba(0,0,0,0.5)_60%,rgba(0,0,0,0.85)_85%,#000000_100%)] pointer-events-none" />
      </div>

      {/* 1. FIXED / STICKY TOP HEADER (Completely transparent overlay over GIF without blur or border) */}
      <header
        onWheel={handleHeaderWheel}
        className="flex-shrink-0 z-30 bg-transparent border-none"
      >
        <div className="w-full max-w-xl mx-auto px-4 sm:px-6 pt-5 pb-3">
          {/* 1.1 SEARCH SCREEN TITLE & CONTENT TYPE SELECTOR CAPSULE */}
          <div className="tab-header-row gap-2.5 relative">
            <h1 className="tab-title-text drop-shadow-md">
              Search
            </h1>

            {/* Anime / Manga / Novel Selection Capsule */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="flex items-center gap-2.5 pl-[77px] pr-[78px] py-[18px] rounded-2xl bg-[#141419]/80 border border-white/10 shadow-lg tab-title-text text-3xl sm:text-[32px] font-black text-white tracking-tight drop-shadow-md cursor-pointer hover:border-white/25 transition-all"
              >
                <span className="translate-x-2">{getCategoryLabel(filters.category)}</span>
                <ChevronDown className="w-3.5 h-3.5 text-white flex-shrink-0 translate-x-0" />
              </button>

              {/* Selection Dropdown Popup */}
              {categoryDropdownOpen && (
                <div className="absolute left-0 top-full mt-2.5 z-50 min-w-[150px] bg-[#141419]/95 border border-white/15 rounded-2xl p-2 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  {(['anime', 'manga', 'novel'] as MediaCategory[]).map((cat) => {
                    const isSelected = filters.category === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategorySelect(cat)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-base font-extrabold capitalize text-white hover:text-purple-300 cursor-pointer transition-colors"
                      >
                        <span>{getCategoryLabel(cat)}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#c084fc] stroke-[3]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 1.2 SEARCH INPUT BAR & FILTER BUTTON */}
          <div className="flex items-center gap-3 mb-2.5">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search"
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchInput(val);
                  contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                  // Instant 0ms local results matching while typing
                  const instant = applyLocalFilterMatching(allDiscoveredItemsRef.current, filters, val);
                  if (instant.length > 0) {
                    setResults(instant);
                    setLoading(false);
                  }
                }}
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[#141419]/80 border border-white/10 text-sm text-white placeholder-neutral-400 outline-none focus:outline-none focus:ring-0 focus:border-white/10 transition-colors shadow-lg"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setFilters((prev) => ({ ...prev, query: '' }));
                    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Action Button */}
            <button
              onClick={() => setShowFilterModal(true)}
              aria-label="Open Filters"
              className={`h-[48px] w-[48px] rounded-2xl border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all relative ${
                activeFiltersCount > 0
                  ? 'bg-[#a855f7] border-[#c084fc] text-white shadow-none'
                  : 'bg-[#141419]/80 border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 shadow-lg'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* 1.3 ACTIVE FILTER PILL OPTIONS (STICKY IN HEADER) */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-0.5 pb-1 no-scrollbar select-none -mx-1 px-1">
              {filters.genres.map((g) => (
                <button
                  key={`genre-${g}`}
                  onClick={() => removeFilter('genre', g)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">{g}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              ))}

              {filters.format.map((fmt) => (
                <button
                  key={`format-${fmt}`}
                  onClick={() => removeFilter('format', fmt)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">{fmt}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              ))}

              {filters.status.map((st) => (
                <button
                  key={`status-${st}`}
                  onClick={() => removeFilter('status', st)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">{st}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              ))}

              {filters.season.map((sn) => (
                <button
                  key={`season-${sn}`}
                  onClick={() => removeFilter('season', sn)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">{sn}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              ))}

              {filters.libraryState !== 'Any' && (
                <button
                  onClick={() => removeFilter('libraryState')}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">{filters.libraryState}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              )}

              {filters.minScore !== 'Any' && (
                <button
                  onClick={() => removeFilter('minScore')}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">Score: {filters.minScore}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              )}

              {filters.selectedYear !== 'Any' && (
                <button
                  onClick={() => removeFilter('selectedYear')}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">Year: {filters.selectedYear}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              )}

              {filters.studio && (
                <button
                  onClick={() => removeFilter('studio')}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">{filters.category === 'anime' ? 'Studio' : 'Author'}: {filters.studio}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              )}

              {filters.advancedTags.map((tag) => (
                <button
                  key={`tag-${tag}`}
                  onClick={() => removeFilter('advancedTags', tag)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-[#261942]/90 text-white border border-purple-500/50 hover:bg-[#34225a] hover:border-purple-400 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span className="text-white">{tag}</span>
                  <X className="w-3.5 h-3.5 text-white flex-shrink-0" />
                </button>
              ))}

              {activeFiltersCount > 1 && (
                <button
                  onClick={() => removeFilter('all')}
                  className="flex items-center justify-center px-3.5 py-1.5 rounded-full text-sm font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all flex-shrink-0 cursor-pointer shadow-sm"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 2. SCROLLABLE CONTENT AREA (ONLY SEARCH RESULTS SCROLL) */}
      <div
        ref={contentScrollRef}
        className="flex-1 w-full overflow-y-auto no-scrollbar overscroll-contain relative z-10"
      >
        <div className="w-full max-w-xl mx-auto px-4 sm:px-6 pt-4 pb-40">
          {/* 2.1 ANIME / MANGA / NOVEL SEARCH RESULT CARDS */}
          {loading && displayResults.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3.5 p-2 rounded-2xl bg-white/5 border border-white/5"
                >
                  {/* Empty static dark slate container (#1e232a) skeleton overlay exclusively for the image area */}
                  <div className="w-[84px] h-[115px] rounded-xl bg-[#1e232a] border border-white/5 flex-shrink-0" />
                  <div className="flex-1 space-y-2 pr-2">
                    <div className="w-2/3 h-4 bg-white/10 rounded" />
                    <div className="w-1/3 h-3 bg-white/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayResults.length > 0 ? (
            <div className="space-y-3">
              {displayResults.map((item) => {
                const displayScore = getRatingDisplay(item);
                let rawFormat = (
                  item.format ||
                  (filters.category === 'manga'
                    ? 'MANGA'
                    : filters.category === 'novel'
                    ? 'NOVEL'
                    : 'TV')
                ).toUpperCase();

                if (
                  rawFormat === 'LIGHT NOVEL' ||
                  rawFormat === 'LIGHT_NOVEL' ||
                  filters.category === 'novel' ||
                  item.category === 'novel'
                ) {
                  rawFormat = 'NOVEL';
                }

                const isMovie = rawFormat === 'MOVIE';
                const subtitle =
                  item.nativeTitle ||
                  item.romajiTitle ||
                  item.description?.slice(0, 45) ||
                  '';

                return (
                  <div
                    key={item.id}
                    onClick={() => openMediaDetails(item)}
                    className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors select-none group"
                  >
                    {/* Poster Thumbnail Dimensions: Exactly w-[84px] h-[115px] with isolated skeleton */}
                    <PosterImage
                      src={item.coverImage || item.bannerImage}
                      alt={item.title}
                      className="w-[84px] h-[115px] rounded-xl border border-white/10 flex-shrink-0 shadow-md"
                      imgClassName="group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Details Column */}
                    <div className="flex-1 min-w-0 pr-1">
                      <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                        {item.title}
                      </h3>

                      {subtitle && (
                        <p className="text-xs text-neutral-300 line-clamp-1 mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                          {subtitle}
                        </p>
                      )}

                      {/* Meta Row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs font-black text-purple-400 [text-shadow:0_0_8px_rgba(168,85,247,0.85)] tracking-tight">
                          {displayScore}
                        </span>
                        <span className="text-xs font-bold text-[#808080] select-none leading-none">
                          |
                        </span>
                        <span
                          className={`text-xs font-extrabold uppercase tracking-wide ${
                            isMovie ? 'text-[#E11D48]' : 'text-[#3B82F6]'
                          }`}
                        >
                          {rawFormat}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-neutral-400">
              <p className="text-sm font-medium">No results found.</p>
              <p className="text-xs text-neutral-500 mt-1">
                Try adjusting your keywords or filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
