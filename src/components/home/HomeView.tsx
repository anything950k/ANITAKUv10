import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TopCategoryHeader } from '../layout/TopCategoryHeader';
import { HeroCarousel } from './HeroCarousel';
import {
  fetchTrendingAnime,
  fetchPopularThisSeason,
  fetchNewEpisodes,
  fetchCommunityLovedAnime,
  fetchRecentlyCompletedAnime,
  fetchAnimeMovies,
  fetchUpcomingAnime,
  fetchTrendingManga,
  fetchPopularManga,
  fetchRecentlyUpdatedManga,
  fetchCommunityLovedManga,
  fetchRecentlyCompletedManga,
  fetchTrendingNovels,
  fetchSeasonalNovels,
  fetchPopularNovels,
  fetchMonsterNovels,
  fetchPrincessNovels,
  fetchMagicNovels,
} from '../../services/api';
import { MediaItem } from '../../types';
import { MediaHorizontalList, MediaRow } from './MediaHorizontalList';
import { useCachedApi } from '../../hooks/useCachedApi';

export const HomeView: React.FC = () => {
  const {
    activeCategory,
    openMediaDetails,
    setActiveReader,
    setActiveVideoEpisode,
    mangaReadingHistory,
    removeFromMangaHistory,
    animeWatchHistory,
    removeFromAnimeHistory,
  } = useApp();

  // ================= 1. ANIME DYNAMIC SECTIONS (ALL 6 PRESERVED - EXPANDED LIMITLESS FETCH) =================
  const { data: trendingAnime = [] } = useCachedApi('home_anime_trending_15', () => fetchTrendingAnime(15));
  const { data: popularSeason = [], loading: loadingSeason } = useCachedApi('home_anime_popular_season_active_30', () => fetchPopularThisSeason(30));
  const { data: newEpisodes = [], loading: loadingNewEps } = useCachedApi('home_anime_new_episodes_40', () => fetchNewEpisodes(40));
  const { data: communityLovedAnime = [], loading: loadingLovedAnime } = useCachedApi('home_anime_community_loved_30', () => fetchCommunityLovedAnime(30));
  const { data: recentlyCompletedAnime = [], loading: loadingCompletedAnime } = useCachedApi('home_anime_recently_completed_30', () => fetchRecentlyCompletedAnime(30));
  const { data: animeMovies = [], loading: loadingMovies } = useCachedApi('home_anime_movies_30', () => fetchAnimeMovies(30));
  const { data: upcomingAnime = [], loading: loadingUpcomingAnime } = useCachedApi('home_anime_upcoming_50', () => fetchUpcomingAnime(50));

  // ================= 2. MANGA DYNAMIC SECTIONS (ALL PRESERVED - EXPANDED LIMITLESS FETCH) =================
  const { data: trendingManga = [] } = useCachedApi('home_manga_trending_15', () => fetchTrendingManga(15));
  const { data: popularManga = [], loading: loadingPopManga } = useCachedApi('home_manga_popular_30', () => fetchPopularManga(30));
  const { data: recentlyUpdatedManga = [], loading: loadingUpdatedManga } = useCachedApi('home_manga_recently_updated_40', () => fetchRecentlyUpdatedManga(40));
  const { data: communityLovedManga = [], loading: loadingLovedManga } = useCachedApi('home_manga_community_loved_30', () => fetchCommunityLovedManga(30));
  const { data: recentlyCompletedManga = [], loading: loadingCompletedManga } = useCachedApi('home_manga_recently_completed_30', () => fetchRecentlyCompletedManga(30));

  // ================= 3. NOVEL DYNAMIC SECTIONS (ALL 6 PRESERVED - EXPANDED LIMITLESS FETCH) =================
  const { data: trendingNovels = [] } = useCachedApi('home_novel_trending_15', () => fetchTrendingNovels(15));
  const { data: seasonalNovels = [], loading: loadingSeasonalNovels } = useCachedApi('home_novel_seasonal_30', () => fetchSeasonalNovels(30));
  const { data: popularNovels = [], loading: loadingPopNovels } = useCachedApi('home_novel_popular_30', () => fetchPopularNovels(30));
  const { data: monsterNovels = [], loading: loadingMonsterNovels } = useCachedApi('home_novel_monsters_30', () => fetchMonsterNovels(30));
  const { data: princessNovels = [], loading: loadingPrincessNovels } = useCachedApi('home_novel_princess_30', () => fetchPrincessNovels(30));
  const { data: magicNovels = [], loading: loadingMagicNovels } = useCachedApi('home_novel_magic_30', () => fetchMagicNovels(30));

  // Filter history per media category
  const mangaHistoryOnly = useMemo(() => {
    return mangaReadingHistory.filter((entry) => entry.category !== 'novel');
  }, [mangaReadingHistory]);

  const novelReadingHistory = useMemo(() => {
    return mangaReadingHistory.filter((entry) => entry.category === 'novel');
  }, [mangaReadingHistory]);

  // Dynamic hero items selection based on active category
  const heroItems = useMemo(() => {
    if (activeCategory === 'anime') return trendingAnime;
    if (activeCategory === 'manga') return trendingManga;
    if (activeCategory === 'novel') return trendingNovels;
    return [];
  }, [activeCategory, trendingAnime, trendingManga, trendingNovels]);

  // Combined loading indicator per category
  const loading = useMemo(() => {
    if (activeCategory === 'anime') {
      return loadingSeason && popularSeason.length === 0;
    }
    if (activeCategory === 'manga') {
      return loadingPopManga && popularManga.length === 0;
    }
    if (activeCategory === 'novel') {
      return loadingSeasonalNovels && seasonalNovels.length === 0;
    }
    return false;
  }, [
    activeCategory,
    loadingSeason,
    popularSeason.length,
    loadingPopManga,
    popularManga.length,
    loadingSeasonalNovels,
    seasonalNovels.length,
  ]);

  return (
    <div className="w-full min-h-screen bg-black text-white pb-28 select-none">
      {/* 1. HERO CAROUSEL BANNER & GRADIENT FADE */}
      <HeroCarousel
        activeCategory={activeCategory}
        onSelectMedia={openMediaDetails}
        passedItems={heroItems}
      />

      {/* 2. CATEGORY SWITCHER CAPSULE PILLS (ANIME / MANGA / NOVEL) */}
      <div className="px-4 mt-3 mb-2">
        <TopCategoryHeader />
      </div>

      {/* 3. DYNAMIC CONTENT SECTIONS BY CATEGORY (Zero-Latency Persistent Mount) */}
      <div className="px-4 mt-4">
        {/* ===================== ANIME TAB (ALL 6 SECTIONS INTACT) ===================== */}
        <div className={activeCategory === 'anime' ? 'space-y-6 block' : 'hidden'}>
          {/* Continue Watching Card (Dedicated Real Watch History) */}
          {animeWatchHistory.length > 0 && (
            <div className="space-y-2">
              <SectionHeader firstWord="Continue" secondWord="Watching" highlight="first" />
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
                {animeWatchHistory.map((entry) => (
                  <div
                    key={entry.mediaId}
                    onClick={() => {
                      const mItem: MediaItem = {
                        id: entry.mediaId,
                        title: entry.title,
                        coverImage: entry.coverImage,
                        bannerImage: entry.bannerImage,
                        category: 'anime',
                        format: 'TV',
                        status: 'Releasing',
                        score: entry.score || 8.5,
                        year: 2026,
                        genres: entry.genres || ['Action', 'Fantasy'],
                        description: entry.description || 'Continue watching anime.',
                        totalEpisodes: entry.totalEpisodes,
                      };
                      setActiveVideoEpisode({
                        media: mItem,
                        episodeNumber: entry.lastWatchedEpisode || 1,
                      });
                    }}
                    className="relative w-[440px] sm:w-[500px] min-h-[116px] sm:min-h-[126px] shrink-0 bg-[#131419] rounded-3xl p-3.5 sm:p-4 border border-white/10 flex items-center gap-3.5 cursor-pointer hover:border-white/20 transition-all shadow-lg select-none group"
                  >
                    {entry.coverImage && entry.coverImage.trim() !== '' ? (
                      <img
                        src={entry.coverImage}
                        alt={entry.title}
                        className="w-[84px] h-[92px] sm:w-[92px] sm:h-[100px] object-cover rounded-2xl shadow-md shrink-0 group-hover:scale-[1.02] transition-transform"
                      />
                    ) : (
                      <div className="w-[84px] h-[92px] sm:w-[92px] sm:h-[100px] bg-[#1a1b26] rounded-2xl shadow-md shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 pr-6 flex flex-col justify-center">
                      <h3 className="text-[14.5px] sm:text-[15.5px] font-bold text-white line-clamp-2 leading-snug">{entry.title}</h3>
                      <div className="mt-2.5 inline-flex items-center self-start px-3.5 py-1 rounded-full text-xs font-medium bg-white/[0.08] text-white/85 border border-white/10">
                        Episode {entry.lastWatchedEpisode}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromAnimeHistory(entry.mediaId);
                      }}
                      title="Remove from history"
                      className="absolute top-3.5 right-3.5 p-1 rounded-full text-white hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <X className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. Popular This Season */}
          <SectionHeader firstWord="Popular" secondWord="This Season" highlight="first" />
          <MediaRow items={popularSeason} loading={loading} showScore />

          {/* 2. New Episodes */}
          <SectionHeader firstWord="New" secondWord="Episodes" highlight="second" />
          <MediaRow items={newEpisodes} loading={loading} showEpisodeBadge />

          {/* 3. Community Loved */}
          <SectionHeader firstWord="Community" secondWord="Loved" highlight="first" />
          <MediaRow items={communityLovedAnime} loading={loading} showScore={false} showHeartCount={false} />

          {/* 4. Recently Completed */}
          <SectionHeader firstWord="Recently" secondWord="Completed" highlight="first" />
          <MediaRow items={recentlyCompletedAnime} loading={loading} showScore />

          {/* 5. Movies */}
          <SectionHeader firstWord="Movies" highlight="first" />
          <MediaRow items={animeMovies} loading={loading} showScore />

          {/* 6. Upcoming Anime */}
          <SectionHeader firstWord="Upcoming" secondWord="Anime" highlight="first" />
          <MediaRow items={upcomingAnime} loading={loading} isUpcoming showScore={false} />
        </div>

        {/* ===================== MANGA TAB (ALL DYNAMIC SECTIONS INTACT) ===================== */}
        <div className={activeCategory === 'manga' ? 'space-y-6 block' : 'hidden'}>
          {/* 1. Continue Reading Card (Dedicated Real Manga Reading History) */}
          {mangaHistoryOnly.length > 0 && (
            <div className="space-y-2">
              <SectionHeader firstWord="Continue" secondWord="Reading" highlight="first" />
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
                {mangaHistoryOnly.map((entry) => (
                  <div
                    key={entry.mediaId}
                    onClick={() => {
                      const mItem: MediaItem = {
                        id: entry.mediaId,
                        title: entry.title,
                        coverImage: entry.coverImage,
                        bannerImage: entry.bannerImage,
                        category: 'manga',
                        format: 'Manga',
                        status: 'Releasing',
                        score: entry.score || 8.5,
                        year: 2026,
                        genres: entry.genres || ['Action', 'Adventure'],
                        description: entry.description || 'Continue reading manga.',
                        totalChapters: entry.totalChapters,
                      };
                      setActiveReader({
                        media: mItem,
                        chapterNumber: entry.lastReadChapter,
                        chapterId: entry.lastReadChapterId,
                      });
                    }}
                    className="relative w-[440px] sm:w-[500px] min-h-[116px] sm:min-h-[126px] shrink-0 bg-[#131419] rounded-3xl p-3.5 sm:p-4 border border-white/10 flex items-center gap-3.5 cursor-pointer hover:border-white/20 transition-all shadow-lg select-none group"
                  >
                    {entry.coverImage && entry.coverImage.trim() !== '' ? (
                      <img
                        src={entry.coverImage}
                        alt={entry.title}
                        className="w-[84px] h-[92px] sm:w-[92px] sm:h-[100px] object-cover rounded-2xl shadow-md shrink-0 group-hover:scale-[1.02] transition-transform"
                      />
                    ) : (
                      <div className="w-[84px] h-[92px] sm:w-[92px] sm:h-[100px] bg-[#1a1b26] rounded-2xl shadow-md shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 pr-6 flex flex-col justify-center">
                      <h3 className="text-[14.5px] sm:text-[15.5px] font-bold text-white line-clamp-2 leading-snug">{entry.title}</h3>
                      <div className="mt-2.5 inline-flex items-center self-start px-3.5 py-1 rounded-full text-xs font-medium bg-white/[0.08] text-white/85 border border-white/10">
                        Chapter {entry.lastReadChapter}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromMangaHistory(entry.mediaId);
                      }}
                      title="Remove from history"
                      className="absolute top-3.5 right-3.5 p-1 rounded-full text-white hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <X className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Popular Manga */}
          <SectionHeader firstWord="Popular" secondWord="Manga" highlight="first" />
          <MediaRow items={popularManga} loading={loading} showScore />

          {/* 3. Recently Updated */}
          <SectionHeader firstWord="Recently" secondWord="Updated" highlight="second" />
          <MediaRow items={recentlyUpdatedManga} loading={loading} showScore />

          {/* 4. Community Loved Manga */}
          <SectionHeader firstWord="Community" secondWord="Loved" highlight="first" />
          <MediaRow items={communityLovedManga} loading={loading} showScore={false} showHeartCount={false} />

          {/* 5. Recently Completed */}
          <SectionHeader firstWord="Recently" secondWord="Completed" highlight="first" />
          <MediaRow items={recentlyCompletedManga} loading={loading} showScore />
        </div>

        {/* ===================== NOVEL TAB (ALL 6 SECTIONS INTACT) ===================== */}
        <div className={activeCategory === 'novel' ? 'space-y-6 block' : 'hidden'}>
          {/* Continue Reading Card (Dedicated Real Novel Reading History) */}
          {novelReadingHistory.length > 0 && (
            <div className="space-y-2">
              <SectionHeader firstWord="Continue" secondWord="Reading" highlight="first" />
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
                {novelReadingHistory.map((entry) => (
                  <div
                    key={entry.mediaId}
                    onClick={() => {
                      const mItem: MediaItem = {
                        id: entry.mediaId,
                        title: entry.title,
                        coverImage: entry.coverImage,
                        bannerImage: entry.bannerImage,
                        category: 'novel',
                        format: 'Novel',
                        status: 'Releasing',
                        score: entry.score || 8.5,
                        year: 2026,
                        genres: entry.genres || ['Fantasy', 'Adventure'],
                        description: entry.description || 'Continue reading novel.',
                        totalChapters: entry.totalChapters,
                        totalVolumes: entry.totalChapters,
                      };
                      setActiveReader({
                        media: mItem,
                        chapterNumber: entry.lastReadChapter,
                        chapterId: entry.lastReadChapterId,
                      });
                    }}
                    className="relative w-[440px] sm:w-[500px] min-h-[116px] sm:min-h-[126px] shrink-0 bg-[#131419] rounded-3xl p-3.5 sm:p-4 border border-white/10 flex items-center gap-3.5 cursor-pointer hover:border-white/20 transition-all shadow-lg select-none group"
                  >
                    {entry.coverImage && entry.coverImage.trim() !== '' ? (
                      <img
                        src={entry.coverImage}
                        alt={entry.title}
                        className="w-[84px] h-[92px] sm:w-[92px] sm:h-[100px] object-cover rounded-2xl shadow-md shrink-0 group-hover:scale-[1.02] transition-transform"
                      />
                    ) : (
                      <div className="w-[84px] h-[92px] sm:w-[92px] sm:h-[100px] bg-[#1a1b26] rounded-2xl shadow-md shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 pr-6 flex flex-col justify-center">
                      <h3 className="text-[14.5px] sm:text-[15.5px] font-bold text-white line-clamp-2 leading-snug">{entry.title}</h3>
                      <div className="mt-2.5 inline-flex items-center self-start px-3.5 py-1 rounded-full text-xs font-medium bg-white/[0.08] text-white/85 border border-white/10">
                         Volume {entry.lastReadChapter}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromMangaHistory(entry.mediaId);
                      }}
                      title="Remove from history"
                      className="absolute top-3.5 right-3.5 p-1 rounded-full text-white hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <X className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. Top Seasonal Banner: Summer 2026 Novels */}
          <SectionHeader firstWord="Summer 2026" secondWord="Novels" highlight="first" />
          <MediaRow items={seasonalNovels} loading={loading} showScore />

          {/* 2. Popular Novels */}
          <SectionHeader firstWord="Popular" secondWord="Novels" highlight="first" />
          <MediaRow items={popularNovels} loading={loading} showScore />

          {/* 3. Monsters Section */}
          <SectionHeader firstWord="Monsters" highlight="first" />
          <MediaRow items={monsterNovels} loading={loading} showScore />

          {/* 4. Princess Section */}
          <SectionHeader firstWord="Princess" highlight="first" />
          <MediaRow items={princessNovels} loading={loading} showScore />

          {/* 5. Magic Section */}
          <SectionHeader firstWord="Magic" highlight="first" />
          <MediaRow items={magicNovels} loading={loading} showScore />
        </div>
      </div>
    </div>
  );
};

// Section header with green/white accents
interface SectionHeaderProps {
  firstWord: string;
  secondWord?: string;
  highlight?: 'first' | 'second';
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  firstWord,
  secondWord,
  highlight = 'first',
}) => {
  return (
    <div className="flex items-center justify-between mb-1">
      <h2 className="text-[17px] sm:text-lg font-bold tracking-tight">
        {highlight === 'first' ? (
          <>
            <span className="text-[#4ade80] font-bold">{firstWord}</span>{' '}
            {secondWord && <span className="text-white font-bold">{secondWord}</span>}
          </>
        ) : (
          <>
            <span className="text-white font-bold">{firstWord}</span>{' '}
            {secondWord && <span className="text-[#4ade80] font-bold">{secondWord}</span>}
          </>
        )}
      </h2>
    </div>
  );
};

