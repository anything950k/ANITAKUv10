import { useState, useEffect, useMemo, useCallback } from 'react';
import { MediaItem, MediaCategory } from '../types';
import { fetchAniListMedia } from '../services/api';
import { fetchMediaLogo } from '../services/logoService';

const HERO_CACHE_MAX_AGE = 180000; // 3 minutes fresh cache window
const heroCategoryCache = new Map<string, { items: MediaItem[]; timestamp: number }>();
const loadedBannerUrls = new Set<string>();

// Strict category validator
function isItemMatchingCategory(media: any, cat: string): boolean {
  if (!media) return false;
  const format = String(media.format || '').toLowerCase();
  const type = String(media.type || '').toLowerCase();
  const category = String(media.category || '').toLowerCase();

  const isNovel =
    category === 'novel' ||
    type === 'novel' ||
    format === 'novel' ||
    format === 'light novel';

  const isManga =
    !isNovel &&
    (category === 'manga' ||
      type === 'manga' ||
      format === 'manga' ||
      format === 'manhwa' ||
      format === 'manhua');

  const isAnime =
    !isNovel &&
    !isManga &&
    (category === 'anime' ||
      type === 'anime' ||
      ['tv', 'movie', 'ona', 'ova', 'special'].includes(format));

  if (cat === 'anime') return isAnime;
  if (cat === 'manga') return isManga;
  if (cat === 'novel') return isNovel;
  return true;
}

// Background prewarm helper for all categories
async function fetchTrendingForCategory(cat: MediaCategory): Promise<MediaItem[]> {
  try {
    let data: MediaItem[] = [];
    if (cat === 'anime') {
      data = await fetchAniListMedia('ANIME', undefined, ['TRENDING_DESC', 'POPULARITY_DESC'], 25);
    } else if (cat === 'manga') {
      data = await fetchAniListMedia('MANGA', undefined, ['TRENDING_DESC', 'POPULARITY_DESC'], 25, undefined, undefined, 'MANGA');
    } else if (cat === 'novel') {
      data = await fetchAniListMedia('MANGA', undefined, ['TRENDING_DESC', 'POPULARITY_DESC'], 25, undefined, undefined, 'NOVEL');
      // If fewer than 10 novels returned with trending sort, fetch popular novels
      if (!data || data.length < 10) {
        const fallbackNovels = await fetchAniListMedia('MANGA', undefined, ['POPULARITY_DESC'], 25, undefined, undefined, 'NOVEL');
        data = [...(data || []), ...(fallbackNovels || [])];
      }
    }

    const uniqueMap = new Map<string | number, MediaItem>();
    (data || []).forEach((item) => {
      if (item && item.id && isItemMatchingCategory(item, cat)) {
        uniqueMap.set(item.id, item);
      }
    });

    const validated = Array.from(uniqueMap.values()).slice(0, 10);
    if (validated.length > 0) {
      heroCategoryCache.set(cat, {
        items: validated,
        timestamp: Date.now(),
      });

      // Background pre-fetch images & logos for zero lag
      validated.forEach((item) => {
        const src = item.coverImage || item.bannerImage;
        if (src && !loadedBannerUrls.has(src)) {
          try {
            const img = new Image();
            img.src = src;
            img.onload = () => loadedBannerUrls.add(src);
          } catch {
            // Ignore
          }
        }
        // Eagerly pre-fetch logo
        if (item.title) {
          fetchMediaLogo(item.title, {
            englishTitle: item.englishTitle,
            romajiTitle: item.romajiTitle,
            category: item.category,
            idMal: item.idMal,
          }).catch(() => {});
        }
      });
    }
    return validated;
  } catch (err) {
    console.warn(`Failed to fetch trending for category ${cat}:`, err);
    return [];
  }
}

export function useHeroTrendingFeed(
  activeCategory: MediaCategory,
  passedItems: MediaItem[] = []
) {
  const [trendingItems, setTrendingItems] = useState<MediaItem[]>(() => {
    const cached = heroCategoryCache.get(activeCategory);
    return cached && cached.items.length >= 10 ? cached.items : [];
  });
  const [isLoading, setIsLoading] = useState(false);

  // Synchronous Instant Zero-Flicker Memory Cache Switch on Category Change
  useEffect(() => {
    const cached = heroCategoryCache.get(activeCategory);
    if (cached && cached.items && cached.items.length > 0) {
      setTrendingItems(cached.items);
    }
  }, [activeCategory]);

  // Prewarm all categories once on initial mount
  useEffect(() => {
    const categories: MediaCategory[] = ['anime', 'manga', 'novel'];
    categories.forEach((cat) => {
      const cached = heroCategoryCache.get(cat);
      if (!cached || cached.items.length < 10 || Date.now() - cached.timestamp >= HERO_CACHE_MAX_AGE) {
        fetchTrendingForCategory(cat);
      }
    });
  }, []);

  // Real-time trending API Fetch with 3-minute Cache-Control & Fallback Replenishment
  useEffect(() => {
    let isMounted = true;

    async function loadTrending() {
      const cached = heroCategoryCache.get(activeCategory);
      const isFresh =
        cached &&
        Date.now() - cached.timestamp < HERO_CACHE_MAX_AGE &&
        cached.items.length >= 10;

      if (isFresh) {
        if (isMounted) {
          setTrendingItems(cached.items);
        }
        return;
      }

      setIsLoading(true);
      try {
        const validated = await fetchTrendingForCategory(activeCategory);

        if (isMounted && validated && validated.length > 0) {
          // If fewer than 10 items, replenish from passed items
          const uniqueMap = new Map<string | number, MediaItem>();
          validated.forEach((item) => uniqueMap.set(item.id, item));

          if (uniqueMap.size < 10 && passedItems && passedItems.length > 0) {
            passedItems.forEach((item) => {
              if (item && item.id && isItemMatchingCategory(item, activeCategory)) {
                uniqueMap.set(item.id, item);
              }
            });
          }

          const finalList = Array.from(uniqueMap.values()).slice(0, 10);
          heroCategoryCache.set(activeCategory, {
            items: finalList,
            timestamp: Date.now(),
          });
          setTrendingItems(finalList);
        }
      } catch (err) {
        console.warn('Failed to load hero trending feed:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadTrending();
    return () => {
      isMounted = false;
    };
  }, [activeCategory, passedItems]);

  // Combine & Lock Exactly 10 Unique Items
  const displayItems = useMemo(() => {
    const uniqueMap = new Map<string | number, MediaItem>();
    
    // First fill from trending feed
    (trendingItems || []).forEach((item) => {
      if (item?.id && isItemMatchingCategory(item, activeCategory)) {
        uniqueMap.set(item.id, item);
      }
    });

    // If needed to reach 10, fill from passed seasonal/popular items
    (passedItems || []).forEach((item) => {
      if (item?.id && uniqueMap.size < 10 && isItemMatchingCategory(item, activeCategory)) {
        uniqueMap.set(item.id, item);
      }
    });

    return Array.from(uniqueMap.values()).slice(0, 10);
  }, [passedItems, trendingItems, activeCategory]);

  return { displayItems, isLoading };
}
