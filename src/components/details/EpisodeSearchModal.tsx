import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DotPulseLoader } from '../common/DotPulseLoader';
import { MediaItem, RelationItem } from '../../types';
import {
  searchAniList,
  searchMangaDexList,
  fetchMediaDetailsById,
  optimizeImageUrl,
} from '../../services/apiClient';
import { swrGetSync } from '../../services/swrCache';
import { PosterImage } from '../common/PosterImage';

interface SearchResultItem {
  id: string | number;
  title: string;
  englishTitle?: string;
  nativeTitle?: string;
  romajiTitle?: string;
  coverImage: string;
  category: 'anime' | 'manga' | 'novel';
  relationType?: string;
  format?: string;
  status?: string;
  score?: number;
  year?: number | string;
  genres?: string[];
  description?: string;
}

function cleanTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/\s*\((TV|Dub|Sub|Subbed|Dubbed|ONA|OVA|Movie|Special|Fan Colored|Official Colored)\)/gi, '')
    .replace(/\s*\[(TV|Dub|Sub|Subbed|Dubbed|ONA|OVA|Movie|Special)\]/gi, '')
    .trim();
}

export const EpisodeSearchModal: React.FC = () => {
  const {
    selectedMedia,
    showEpisodeSearch,
    setShowEpisodeSearch,
    openMediaDetails,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mediaId = selectedMedia?.id;
  const mediaTitle = selectedMedia ? cleanTitle(selectedMedia.title) : '';

  const placeholderText = useMemo(() => {
    if (!selectedMedia) return 'Search...';
    if (selectedMedia.category === 'anime') return 'Search anime';
    if (selectedMedia.category === 'novel') return 'Search novel';
    return 'Search manga';
  }, [selectedMedia?.category]);

  // Close on Escape key
  useEffect(() => {
    if (!showEpisodeSearch) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEpisodeSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEpisodeSearch, setShowEpisodeSearch]);

  // Whenever modal opens or mediaId changes, reset query and clear previous results immediately
  useEffect(() => {
    if (!showEpisodeSearch || !selectedMedia) {
      setSearchQuery('');
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Modal just opened or media switched: initialize query with current media title and reset results
    setResults([]);
    setIsLoading(true);
    setSearchQuery(mediaTitle);
  }, [showEpisodeSearch, mediaId, mediaTitle]);

  // Perform search (either franchise spin-offs for current media, or custom query when user types)
  useEffect(() => {
    if (!showEpisodeSearch || !selectedMedia) {
      return;
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    const isInitialTitle = trimmed.toLowerCase() === mediaTitle.toLowerCase();
    const delay = isInitialTitle ? 0 : 280;

    const timer = setTimeout(async () => {
      try {
        if (isInitialTitle) {
          // 1. Gather all immediate relations from selectedMedia or SWR cache
          const cached = swrGetSync<MediaItem>(`media_details_${selectedMedia.id}`);
          const mediaWithDetails = cached?.data || selectedMedia;
          const directRelations: RelationItem[] = mediaWithDetails.relations || selectedMedia.relations || [];

          let fetchedRelations: RelationItem[] = [];
          if (directRelations.length === 0 && selectedMedia.id) {
            try {
              const fresh = await fetchMediaDetailsById(selectedMedia.id);
              if (fresh?.relations) {
                fetchedRelations = fresh.relations;
              }
            } catch {
              // ignore
            }
          }

          const allDirectRelations = directRelations.length > 0 ? directRelations : fetchedRelations;

          const mappedRelations: SearchResultItem[] = allDirectRelations.map((rel: any) => ({
            id: rel.id,
            title: rel.title,
            englishTitle: rel.englishTitle,
            nativeTitle: rel.nativeTitle,
            romajiTitle: rel.romajiTitle,
            coverImage:
              optimizeImageUrl(rel.coverImage || rel.image || rel.bannerImage) ||
              selectedMedia.coverImage ||
              '',
            category: selectedMedia.category,
            format: rel.format || selectedMedia.format,
            relationType: rel.relationType,
            status: 'Finished',
            score: rel.score || 8.2,
            year: rel.year,
            genres: selectedMedia.genres,
            description: `Related ${rel.relationType || 'work'} in this franchise.`,
          }));

          // 2. Perform live search for the title (e.g. MangaDex for franchise spinoffs & AniList)
          let liveItems: SearchResultItem[] = [];
          const isMangaOrNovel = selectedMedia.category === 'manga' || selectedMedia.category === 'novel';

          try {
            const fetchPromises: Promise<any>[] = [];

            if (isMangaOrNovel) {
              fetchPromises.push(
                searchMangaDexList(trimmed, 20).catch(() => [] as MediaItem[])
              );
            }

            fetchPromises.push(
              searchAniList(trimmed, { category: selectedMedia.category }, 1, 20)
                .then((res) => res.items)
                .catch(() => [] as MediaItem[])
            );

            if (!isMangaOrNovel) {
              fetchPromises.push(
                searchMangaDexList(trimmed, 8).catch(() => [] as MediaItem[])
              );
            }

            const [primaryResults, secondaryResults, fallbackResults] = await Promise.all(fetchPromises);

            const combinedFromSearch: MediaItem[] = [
              ...(Array.isArray(primaryResults) ? primaryResults : []),
              ...(Array.isArray(secondaryResults) ? secondaryResults : []),
              ...(Array.isArray(fallbackResults) ? fallbackResults : []),
            ];

            liveItems = combinedFromSearch.map((item) => ({
              id: item.id,
              title: item.title,
              englishTitle: item.englishTitle,
              nativeTitle: item.nativeTitle,
              romajiTitle: item.romajiTitle,
              coverImage:
                optimizeImageUrl(item.coverImage || item.bannerImage) ||
                selectedMedia.coverImage ||
                '',
              category: item.category || selectedMedia.category,
              format: item.format,
              status: item.status,
              score: item.score,
              year: item.year,
              genres: item.genres,
              description: item.description,
            }));
          } catch (err) {
            console.warn('Initial franchise search error:', err);
          }

          if (isCancelled) return;

          // 3. Merge relations + live search results, with smart deduplication
          const combined = [...mappedRelations, ...liveItems];
          const seenTitles = new Set<string>();
          const seenIds = new Set<string>();
          const deduplicated: SearchResultItem[] = [];

          for (const item of combined) {
            const normTitle = item.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const idStr = String(item.id);

            if (!seenIds.has(idStr) && !seenTitles.has(normTitle)) {
              seenIds.add(idStr);
              seenTitles.add(normTitle);
              deduplicated.push(item);
            }
          }

          if (deduplicated.length === 0) {
            deduplicated.push({
              id: selectedMedia.id,
              title: selectedMedia.title,
              englishTitle: selectedMedia.englishTitle,
              nativeTitle: selectedMedia.nativeTitle,
              romajiTitle: selectedMedia.romajiTitle,
              coverImage:
                optimizeImageUrl(selectedMedia.coverImage || selectedMedia.bannerImage) ||
                '',
              category: selectedMedia.category,
              format: selectedMedia.format,
              status: selectedMedia.status,
              score: selectedMedia.score,
              year: selectedMedia.year,
              genres: selectedMedia.genres,
              description: selectedMedia.description,
            });
          }

          setResults(deduplicated);
        } else {
          // User typed a custom search query
          const isMangaOrNovel = selectedMedia.category === 'manga' || selectedMedia.category === 'novel';
          const fetchPromises: Promise<any>[] = [];

          if (isMangaOrNovel) {
            fetchPromises.push(
              searchMangaDexList(trimmed, 24).catch(() => [] as MediaItem[])
            );
          }

          fetchPromises.push(
            searchAniList(trimmed, { category: selectedMedia.category }, 1, 24)
              .then((res) => res.items)
              .catch(() => [] as MediaItem[])
          );

          if (!isMangaOrNovel) {
            fetchPromises.push(
              searchMangaDexList(trimmed, 10).catch(() => [] as MediaItem[])
            );
          }

          const [p1, p2, p3] = await Promise.all(fetchPromises);
          const combined = [
            ...(Array.isArray(p1) ? p1 : []),
            ...(Array.isArray(p2) ? p2 : []),
            ...(Array.isArray(p3) ? p3 : []),
          ];

          if (isCancelled) return;

          const seenTitles = new Set<string>();
          const seenIds = new Set<string>();
          const deduplicated: SearchResultItem[] = [];

          for (const it of combined) {
            const normTitle = (it.title || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const idStr = String(it.id);

            if (!seenIds.has(idStr) && !seenTitles.has(normTitle)) {
              seenIds.add(idStr);
              seenTitles.add(normTitle);
              deduplicated.push({
                id: it.id,
                title: it.title,
                englishTitle: it.englishTitle,
                nativeTitle: it.nativeTitle,
                romajiTitle: it.romajiTitle,
                coverImage:
                  optimizeImageUrl(it.coverImage || it.bannerImage) ||
                  selectedMedia.coverImage ||
                  '',
                category: it.category || selectedMedia.category,
                format: it.format,
                status: it.status,
                score: it.score,
                year: it.year,
                genres: it.genres,
                description: it.description,
              });
            }
          }

          setResults(deduplicated);
        }
      } catch (err) {
        console.warn('Episode search error:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, showEpisodeSearch, mediaId, mediaTitle]);

  if (!showEpisodeSearch || !selectedMedia) return null;

  const handleClear = () => {
    setSearchQuery('');
    setResults([]);
  };

  const handleSelectMedia = (item: SearchResultItem) => {
    setShowEpisodeSearch(false);
    openMediaDetails({
      id: item.id,
      title: item.title,
      coverImage: item.coverImage,
      category: item.category,
      format: (item.format as any) || (item.category === 'anime' ? 'TV' : 'Manga'),
      status: (item.status as any) || 'Finished',
      score: item.score || 8.0,
      year: item.year ? Number(item.year) : (selectedMedia.year ? Number(selectedMedia.year) : 2024),
      genres: item.genres || selectedMedia.genres,
      description: item.description || `Explore ${item.title}.`,
    });
  };

  const hasActiveQuery = searchQuery.trim().length > 0;

  return (
    <div
      id="franchise-search-modal-backdrop"
      className="fixed inset-0 z-[3000] flex items-center justify-center px-[14px] py-4 sm:px-4 bg-black/15 animate-in fade-in duration-150"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={() => setShowEpisodeSearch(false)} />

      {/* Centered Modal Card matching Search Aesthetic */}
      <div
        id="franchise-search-modal-card"
        className={`relative w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[26px] p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-10 flex flex-col ${
          hasActiveQuery ? 'max-h-[65vh] sm:max-h-[70vh]' : 'h-auto'
        } overflow-hidden transition-all duration-200 animate-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle Bar Pill */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2.5 shrink-0" />

        {/* Title: Search */}
        <h3 className="text-lg sm:text-xl font-bold text-white mb-2.5 px-0.5 tracking-tight shrink-0">
          Search
        </h3>

        {/* Search Input Box with Search Icon and × Clear Icon */}
        <div className="relative flex items-center bg-[#172029] border border-white/20 focus-within:border-white/40 rounded-2xl px-3.5 py-3 shrink-0 transition-all">
          <Search className="w-4 h-4 text-white/50 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholderText}
            className="bg-transparent text-white text-sm sm:text-[15px] placeholder-white/40 flex-1 focus:outline-none min-w-0 font-medium cursor-text"
          />
          {searchQuery && (
            <button
              id="clear-search-query-button"
              type="button"
              onClick={handleClear}
              className="p-0.5 text-white/60 hover:text-white transition-colors cursor-pointer rounded-full active:scale-90 shrink-0 ml-1.5"
              title="Clear to search manually"
              aria-label="Clear to search manually"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Grid (2 Columns) - Only shown when user has query or results */}
        {hasActiveQuery && (
          <div className="flex-1 overflow-y-auto no-scrollbar pr-0.5 mt-4 sm:mt-5 pb-0">
            {isLoading && (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-white/50">
                <DotPulseLoader size="sm" />
                <p className="text-xs font-medium text-white/60">Searching...</p>
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="py-5 text-center text-xs text-white/50 px-4">
                No matching content found for "{searchQuery}". Try typing another keyword.
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {results.map((item) => {
                  const mainTitle = item.englishTitle || item.title;
                  const secondaryTitle =
                    item.nativeTitle ||
                    (item.romajiTitle && item.romajiTitle.toLowerCase() !== mainTitle.toLowerCase()
                      ? item.romajiTitle
                      : null) ||
                    (item.englishTitle && item.title.toLowerCase() !== item.englishTitle.toLowerCase()
                      ? item.title
                      : null);

                  return (
                    <div
                      key={`${item.id}-${item.title}`}
                      id={`search-card-${item.id}`}
                      onClick={() => handleSelectMedia(item)}
                      className="group cursor-pointer flex flex-col"
                      title={mainTitle}
                    >
                      {/* Cover Image Container - Aspect Square (vertically 1x decreased), with Year Badge */}
                      <div className="aspect-square w-full rounded-2xl overflow-hidden bg-[#15151c] border border-white/10 group-hover:border-white/30 transition-all relative shadow-sm">
                        <PosterImage
                          src={item.coverImage}
                          alt={mainTitle}
                          className="w-full h-full"
                          imgClassName="group-hover:scale-105 transition-transform duration-300"
                        >
                          {/* Year capsule at bottom-left of image matching RatingPill capsule style and exact size */}
                          {item.year && (
                            <div className="absolute bottom-2.5 left-2.5 z-10 select-none pointer-events-none">
                              <div className="h-[27px] min-w-[42px] px-3 rounded-full bg-[#1e4ca6]/85 backdrop-blur-none border-2 border-white/70 text-white text-[12.5px] font-black shadow-md flex items-center justify-center leading-none tracking-tight">
                                {item.year}
                              </div>
                            </div>
                          )}
                        </PosterImage>
                      </div>

                      {/* Content Titles: English/Main Title on Line 1, Native/Romaji Title on Line 2 */}
                      <div className="mt-2 px-0.5 min-w-0">
                        <h4 className="text-xs sm:text-[13px] font-bold text-white truncate group-hover:text-white transition-colors leading-tight">
                          {mainTitle}
                        </h4>
                        {secondaryTitle && (
                          <p className="text-[11px] sm:text-xs text-[#8b9bb4] truncate mt-0.5 font-normal leading-snug">
                            {secondaryTitle}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
