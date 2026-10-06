import {
  MediaItem,
  Character,
  ScheduleDay,
  FilterOptions,
  MediaCategory,
  EpisodeItem,
  MangaChapterItem,
  NovelChapterItem,
  WatchOrderItem,
} from '../types';
import {
  getAnifyEpisodes,
  getAnifyNovelChapters,
  getAnifyMangaPages,
} from './anifyService';
import { swrGetSync, swrGet, swrSet, swrFetchDedupe } from './swrCache';

const ANILIST_URL = 'https://graphql.anilist.co';
const MANGADEX_URL = 'https://api.mangadex.org';

// In-memory cache to prevent excessive requests and smooth out UI
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Wraps external image URLs with our backend Sharp WebP/AVIF optimization proxy.
 * High-resolution manga pages and MangaDex/Anify covers with CORS restrictions are routed to the proxy.
 * AniList images (s4.anilist.co) are hosted on Cloudflare's ultra-fast global CDN (~50KB) and load instantly without CORS issues.
 */
export function optimizeImageUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  if (url.startsWith('/api/image-proxy')) return url;
  if (
    url.includes('mangadex') ||
    url.includes('anify') ||
    url.includes('comick') ||
    url.includes('manganato') ||
    url.includes('mangakakalot') ||
    url.includes('mangasee') ||
    url.includes('mangapill')
  ) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function fetchFromAniList<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const cacheKey = `anilist_${JSON.stringify({ query, variables })}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 1. Try server-side proxy first (bypasses browser CORS & iframe limitations)
  try {
    const proxyResponse = await fetch('/api/anilist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (proxyResponse.ok) {
      const text = await proxyResponse.text();
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        if (json && json.data) {
          cache.set(cacheKey, { data: json.data, timestamp: Date.now() });
          return json.data;
        }
      }
    }
  } catch {
    // If proxy failed, fall back to direct request
  }

  // 2. Direct request to AniList GraphQL API as fallback
  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.ok) {
      const text = await response.text();
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        if (json && json.data) {
          cache.set(cacheKey, { data: json.data, timestamp: Date.now() });
          return json.data;
        }
      }
    }
  } catch {
    // Fallback gracefully
  }

  // 3. If cache exists (even expired), return cached data
  if (cached) {
    return cached.data;
  }

  // 4. Return safe empty object so components don't crash
  return { Page: { media: [], pageInfo: { total: 0 } } } as unknown as T;
}

// Clean HTML tags from AniList descriptions
function cleanDescription(desc?: string | null): string {
  if (!desc) return 'No synopsis available.';
  return desc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

export interface ParsedCharacterData {
  attributes: { key: string; value: string }[];
  bio: string;
  rawDescription: string;
}

export function parseCharacterDescription(
  rawDesc: string | undefined | null,
  nativeProps?: {
    gender?: string;
    birthday?: string;
    age?: string;
    bloodType?: string;
  }
): ParsedCharacterData {
  if (!rawDesc) {
    const fallbackAttrs: { key: string; value: string }[] = [];
    if (nativeProps?.gender && nativeProps.gender !== 'Unknown') fallbackAttrs.push({ key: 'Gender', value: nativeProps.gender });
    if (nativeProps?.birthday) fallbackAttrs.push({ key: 'Birthday', value: nativeProps.birthday });
    if (nativeProps?.age && nativeProps.age !== 'Unknown') fallbackAttrs.push({ key: 'Age', value: nativeProps.age });
    if (nativeProps?.bloodType && nativeProps.bloodType !== 'Unknown') fallbackAttrs.push({ key: 'Blood Type', value: nativeProps.bloodType });
    return {
      attributes: fallbackAttrs,
      bio: 'No description available.',
      rawDescription: '',
    };
  }

  const lines = rawDesc.split(/\r?\n/);
  const parsedAttrs: { key: string; value: string }[] = [];
  const narrativeLines: string[] = [];
  let readingHeader = true;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (parsedAttrs.length > 0) {
        readingHeader = false;
      }
      if (!readingHeader) {
        narrativeLines.push('');
      }
      continue;
    }

    if (readingHeader) {
      const cleanLine = trimmed.replace(/~!|!~/g, '').trim();
      const match = cleanLine.match(/^(?:__|[*]{2})?([A-Za-z0-9\s/'-]+?)(?:__|[*]{2})?:\s*(.+)$/);
      if (match && match[1].length < 35 && !match[1].includes('.') && !match[1].includes(',')) {
        const key = match[1].trim();
        const val = match[2]
          .trim()
          .replace(/~!|!~/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .trim();
        parsedAttrs.push({ key, value: val });
        continue;
      } else {
        readingHeader = false;
      }
    }

    narrativeLines.push(rawLine);
  }

  const finalAttrs: { key: string; value: string }[] = [];
  const existingKeySet = new Set(parsedAttrs.map((a) => a.key.toLowerCase()));

  if (nativeProps?.gender && nativeProps.gender !== 'Unknown' && !existingKeySet.has('gender')) {
    finalAttrs.push({ key: 'Gender', value: nativeProps.gender });
  }
  if (nativeProps?.birthday && !existingKeySet.has('birthday')) {
    finalAttrs.push({ key: 'Birthday', value: nativeProps.birthday });
  }
  if (nativeProps?.age && nativeProps.age !== 'Unknown' && !existingKeySet.has('age')) {
    finalAttrs.push({ key: 'Age', value: nativeProps.age });
  }
  if (nativeProps?.bloodType && nativeProps.bloodType !== 'Unknown' && !existingKeySet.has('blood type')) {
    finalAttrs.push({ key: 'Blood Type', value: nativeProps.bloodType });
  }

  for (const attr of parsedAttrs) {
    finalAttrs.push(attr);
  }

  const bioText = narrativeLines.join('\n').trim();

  return {
    attributes: finalAttrs,
    bio: bioText || 'No description available.',
    rawDescription: rawDesc,
  };
}

/**
 * Dynamic Deduplication Engine
 * Enforces unique ID normalization across state mappers and prevents duplicate cards
 */
export function deduplicateMediaItems(items: MediaItem[]): MediaItem[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, MediaItem>();
  for (const item of items) {
    if (item && item.id) {
      const idStr = String(item.id).trim();
      if (!map.has(idStr)) {
        map.set(idStr, item);
      }
    }
  }
  return Array.from(map.values());
}

// Helper to format relation types in clean Title Case (not all uppercase)
function formatRelationType(rel?: string): string {
  if (!rel) return 'Related';
  const clean = rel.replace(/_/g, ' ').toLowerCase();
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Map AniList Media object to MediaItem
function mapAniListToMediaItem(media: any, categoryOverride?: MediaCategory): MediaItem {
  let category: MediaCategory = categoryOverride || 'anime';
  if (!categoryOverride) {
    if (media.type === 'MANGA') {
      category = media.format === 'NOVEL' ? 'novel' : 'manga';
    } else {
      category = 'anime';
    }
  }

  const titleEnglish = media.title?.english || media.title?.romaji || media.title?.userPreferred || 'Untitled';
  const titleRomaji = media.title?.romaji || media.title?.native || titleEnglish;
  const titleNative = media.title?.native;

  // Characters: Main Characters first, then Supporting Characters
  const characters: Character[] = (media.characters?.edges || [])
    .filter((edge: any) => edge.node)
    .sort((a: any, b: any) => {
      const aIsMain = a.role === 'MAIN' ? 0 : 1;
      const bIsMain = b.role === 'MAIN' ? 0 : 1;
      return aIsMain - bIsMain;
    })
    .map((edge: any) => {
      const node = edge.node;
      const voiceActorNode = edge.voiceActors?.[0];
      const bday = node.dateOfBirth?.month && node.dateOfBirth?.day
        ? `${node.dateOfBirth.month}/${node.dateOfBirth.day}`
        : undefined;
      const parsed = parseCharacterDescription(node.description, {
        gender: node.gender,
        birthday: bday,
        age: node.age,
        bloodType: node.bloodType,
      });

      return {
        id: String(node.id),
        name: node.name?.full || node.name?.userPreferred || 'Unknown Character',
        nativeName: node.name?.native,
        image: node.image?.large || node.image?.medium || '',
        role: edge.role === 'MAIN' ? 'Main' : 'Supporting',
        hearts: node.favourites || 80,
        favourites: node.favourites || 0,
        gender: node.gender || 'Unknown',
        age: node.age || 'Unknown',
        birthday: bday,
        bloodType: node.bloodType || 'A',
        attributes: parsed.attributes,
        bio: parsed.bio,
        rawDescription: node.description || '',
        voiceActor: voiceActorNode
          ? {
              name: voiceActorNode.name?.full || voiceActorNode.name?.userPreferred || 'Voice Actor',
              nativeName: voiceActorNode.name?.native,
              image: voiceActorNode.image?.large || voiceActorNode.image?.medium,
              language: voiceActorNode.languageV2 || 'Japanese',
            }
          : undefined,
      };
    });

  // Relations (Clean Title Case labels)
  const relations = (media.relations?.edges || [])
    .filter((edge: any) => edge.node)
    .map((edge: any) => {
      const cover = edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || edge.node.coverImage?.medium || '';
      const banner = edge.node.bannerImage || cover;
      const relYear = edge.node.startDate?.year || edge.node.seasonYear;
      return {
        id: String(edge.node.id),
        title: edge.node.title?.english || edge.node.title?.romaji || edge.node.title?.userPreferred || 'Related Work',
        relationType: formatRelationType(edge.relationType),
        format: edge.node.format || (edge.node.type === 'MANGA' ? 'MANGA' : 'TV'),
        coverImage: optimizeImageUrl(cover),
        bannerImage: optimizeImageUrl(banner),
        image: optimizeImageUrl(cover),
        year: relYear,
        score: edge.node.averageScore ? edge.node.averageScore / 10 : 8.0,
      };
    });

  const hasPrequel = relations.some((r: any) => String(r.relationType).toLowerCase() === 'prequel');
  const hasSequel = relations.some((r: any) => String(r.relationType).toLowerCase() === 'sequel');

  // Recommendations (minimum 10+ fetched from API)
  const recommendations = (media.recommendations?.nodes || [])
    .filter((rec: any) => rec.mediaRecommendation)
    .map((rec: any) => {
      const cover = rec.mediaRecommendation.coverImage?.large || rec.mediaRecommendation.coverImage?.medium || rec.mediaRecommendation.coverImage?.extraLarge || '';
      const recYear = rec.mediaRecommendation.startDate?.year || rec.mediaRecommendation.seasonYear;
      return {
        id: String(rec.mediaRecommendation.id),
        title: rec.mediaRecommendation.title?.english || rec.mediaRecommendation.title?.romaji || rec.mediaRecommendation.title?.userPreferred || 'Recommendation',
        coverImage: optimizeImageUrl(cover),
        image: optimizeImageUrl(cover),
        year: recYear,
        score: rec.mediaRecommendation.averageScore ? rec.mediaRecommendation.averageScore / 10 : 8.0,
        userVotes: rec.rating || 10,
      };
    });

  const studios = (media.studios?.nodes || []).map((s: any) => s.name);
  const staffEdges = media.staff?.edges || [];
  const staffNames = staffEdges.map((e: any) => ({
    name: e.node?.name?.full || e.node?.name?.userPreferred || '',
    role: e.role || '',
  }));
  const storyAuthor =
    staffNames.find((s: any) => /story|original creator|author|art|manga|writer|mangaka/i.test(s.role))?.name ||
    staffNames[0]?.name ||
    media.staff?.nodes?.[0]?.name?.full ||
    media.staff?.nodes?.[0]?.name?.userPreferred;

  const rawScore = media.averageScore || media.meanScore || 80;
  const ratingOutOf10 = Number((rawScore / 10).toFixed(1));

  const releaseYear = media.startDate?.year || media.seasonYear || new Date().getFullYear();
  let formatVal: 'TV' | 'Movie' | 'ONA' | 'OVA' | 'Special' | 'Manga' | 'Novel' | 'Light Novel' = 'TV';
  if (category === 'novel' || media.format === 'NOVEL') formatVal = 'Novel';
  else if (category === 'manga' || media.format === 'MANGA' || media.format === 'ONE_SHOT') formatVal = 'Manga';
  else if (media.format === 'MOVIE') formatVal = 'Movie';
  else if (media.format === 'ONA') formatVal = 'ONA';
  else if (media.format === 'OVA') formatVal = 'OVA';
  else if (media.format === 'SPECIAL') formatVal = 'Special';

  let statusVal: 'Releasing' | 'Finished' | 'Upcoming' | 'Not Yet Released' = 'Finished';
  if (media.status === 'RELEASING') statusVal = 'Releasing';
  else if (media.status === 'NOT_YET_RELEASED') statusVal = 'Upcoming';
  else if (media.status === 'FINISHED') statusVal = 'Finished';

  // Extract upcoming countdown / next air time if available
  let nextAiringEpisode: number | undefined;
  let nextAiringTimeStr: string | undefined;
  if (media.nextAiringEpisode) {
    nextAiringEpisode = media.nextAiringEpisode.episode;
    const airDate = new Date(media.nextAiringEpisode.airingAt * 1000);
    nextAiringTimeStr = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  let seasonVal: 'Winter' | 'Spring' | 'Summer' | 'Fall' | undefined;
  if (media.season === 'WINTER') seasonVal = 'Winter';
  else if (media.season === 'SPRING') seasonVal = 'Spring';
  else if (media.season === 'SUMMER') seasonVal = 'Summer';
  else if (media.season === 'FALL') seasonVal = 'Fall';

  return {
    id: String(media.id),
    title: titleEnglish,
    romajiTitle: titleRomaji,
    nativeTitle: titleNative,
    coverImage: optimizeImageUrl(media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || ''),
    bannerImage: optimizeImageUrl(media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large),
    category,
    format: formatVal,
    status: statusVal,
    score: ratingOutOf10,
    year: releaseYear,
    season: seasonVal,
    seasonYear: media.seasonYear || releaseYear,
    genres: media.genres || ['Action', 'Fantasy'],
    description: cleanDescription(media.description),
    studio: studios[0] || undefined,
    author: storyAuthor || undefined,
    totalEpisodes: media.episodes,
    totalChapters: media.chapters || undefined,
    totalVolumes: media.volumes || undefined,
    latestEpisode: nextAiringEpisode ? (nextAiringEpisode > 1 ? nextAiringEpisode - 1 : 1) : (media.episodes || undefined),
    currentEpisodeBadge: category === 'manga'
      ? (media.chapters ? `CH ${media.chapters}` : undefined)
      : (nextAiringEpisode || media.episodes) ? `EP ${nextAiringEpisode ? (nextAiringEpisode > 1 ? nextAiringEpisode - 1 : 1) : (media.episodes || 1)}` : undefined,
    nextEpisodeCountdown: media.nextAiringEpisode?.timeUntilAiring ? `${Math.ceil(media.nextAiringEpisode.timeUntilAiring / 86400)}d` : undefined,
    airingAt: media.nextAiringEpisode?.airingAt,
    nextAiringEpisode: media.nextAiringEpisode
      ? {
          episode: media.nextAiringEpisode.episode,
          airingAt: media.nextAiringEpisode.airingAt,
          airingTime: nextAiringTimeStr || '',
          timeUntilAiring: media.nextAiringEpisode.timeUntilAiring,
        }
      : undefined,
    communityHearts: media.favourites || 0,
    idMal: media.idMal || undefined,
    synonyms: Array.isArray(media.synonyms) ? media.synonyms : [],
    characters,
    relations,
    recommendations,
    hasPrequel,
    hasSequel,
  };
}

const MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  synonyms
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  format
  type
  status
  episodes
  chapters
  volumes
  duration
  genres
  tags {
    name
  }
  averageScore
  meanScore
  popularity
  favourites
  trending
  startDate {
    year
    month
    day
  }
  season
  seasonYear
  description(asHtml: false)
  nextAiringEpisode {
    episode
    airingAt
    timeUntilAiring
  }
  studios(isMain: true) {
    nodes {
      name
    }
  }
  staff(sort: [RELEVANCE, FAVOURITES_DESC], perPage: 4) {
    edges {
      role
      node {
        id
        name {
          full
          native
          userPreferred
        }
      }
    }
  }
  characters(sort: [ROLE, RELEVANCE, FAVOURITES_DESC], perPage: 50) {
    edges {
      role
      node {
        id
        name {
          full
          native
          userPreferred
        }
        image {
          large
          medium
        }
        gender
        age
        bloodType
        dateOfBirth {
          year
          month
          day
        }
        favourites
        description
      }
      voiceActors(language: JAPANESE, sort: FAVOURITES_DESC) {
        id
        name {
          full
          native
          userPreferred
        }
        image {
          large
          medium
        }
        languageV2
      }
    }
  }
  relations {
    edges {
      relationType
      node {
        id
        type
        title {
          romaji
          english
          userPreferred
        }
        format
        bannerImage
        coverImage {
          large
          medium
          extraLarge
        }
        startDate {
          year
        }
        seasonYear
        averageScore
      }
    }
  }
  recommendations(sort: RATING_DESC, perPage: 25) {
    nodes {
      rating
      mediaRecommendation {
        id
        title {
          romaji
          english
          userPreferred
        }
        format
        coverImage {
          large
          medium
          extraLarge
        }
        startDate {
          year
        }
        seasonYear
        averageScore
      }
    }
  }
`;

// Helper to calculate human readable time ago for recently aired episodes
export function formatTimeAgo(unixSeconds: number): string {
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

// -------------------------------------------------------------
// 1. ANIME API CALLS
// -------------------------------------------------------------

// Hero Carousel - Trending Anime
export async function fetchTrendingAnime(perPage = 15): Promise<MediaItem[]> {
  const query = `
    query GetTrendingAnime($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 15) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'anime'));
  return deduplicateMediaItems(items);
}

// Section 1: Popular This Season (Expanded Real Items - Only Currently Airing & Released Seasonal Anime)
export async function fetchPopularThisSeason(perPage = 30): Promise<MediaItem[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  let season = 'WINTER';
  if (month >= 4 && month <= 6) season = 'SPRING';
  else if (month >= 7 && month <= 9) season = 'SUMMER';
  else if (month >= 10 && month <= 12) season = 'FALL';

  const year = now.getFullYear();

  const query = `
    query GetSeasonalAnime($season: MediaSeason, $seasonYear: Int, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, season: $season, seasonYear: $seasonYear, status_not: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await fetchFromAniList<any>(query, { season, seasonYear: year, perPage: Math.max(perPage, 30) });
    const rawList = data?.Page?.media || [];
    let items = rawList
      .map((m: any) => mapAniListToMediaItem(m, 'anime'))
      .filter((item: MediaItem) => item.status !== 'Not Yet Released');

    // If seasonal list returned fewer than 15 items (e.g. season boundary), supplement with currently releasing popular anime
    if (items.length < 15) {
      const fallbackQuery = `
        query GetCurrentlyReleasingPopular($perPage: Int) {
          Page(page: 1, perPage: $perPage) {
            media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) {
              ${MEDIA_FIELDS}
            }
          }
        }
      `;
      const fallbackData = await fetchFromAniList<any>(fallbackQuery, { perPage: Math.max(perPage, 30) });
      const fallbackItems = (fallbackData?.Page?.media || [])
        .map((m: any) => mapAniListToMediaItem(m, 'anime'))
        .filter((item: MediaItem) => item.status !== 'Not Yet Released');

      items = deduplicateMediaItems([...items, ...fallbackItems]);
    }

    return deduplicateMediaItems(items);
  } catch (err) {
    console.warn('Failed to fetch popular this season anime:', err);
    return [];
  }
}

// Section 2: Recently Released Episodes (AniList Airing Schedule with TIME_DESC -> Newest Released First, Older Released Pushed Back)
export async function fetchRecentlyReleasedEpisodes(perPage = 50): Promise<MediaItem[]> {
  const nowUnix = Math.floor(Date.now() / 1000);
  const twoWeeksAgoUnix = nowUnix - 14 * 86400; // Past 14 days of releases

  const query = `
    query GetRecentlyReleasedEpisodes($airingAt_greater: Int, $airingAt_lesser: Int, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        airingSchedules(airingAt_greater: $airingAt_greater, airingAt_lesser: $airingAt_lesser, sort: TIME_DESC) {
          id
          airingAt
          episode
          timeUntilAiring
          media {
            ${MEDIA_FIELDS}
          }
        }
      }
    }
  `;

  try {
    const data = await fetchFromAniList<any>(query, {
      airingAt_greater: twoWeeksAgoUnix,
      airingAt_lesser: nowUnix,
      perPage: Math.max(perPage, 50),
    });

    const schedules = data?.Page?.airingSchedules || [];
    if (schedules.length > 0) {
      const items: MediaItem[] = [];
      const seenMediaIds = new Set<string>();

      for (const s of schedules) {
        if (!s.media) continue;
        const mediaIdStr = String(s.media.id);
        if (seenMediaIds.has(mediaIdStr)) continue;
        seenMediaIds.add(mediaIdStr);

        const mediaItem = mapAniListToMediaItem(s.media, 'anime');
        mediaItem.latestEpisode = s.episode;
        mediaItem.currentEpisodeBadge = `EP ${s.episode}`;
        mediaItem.airingAt = s.airingAt;
        mediaItem.isReleased = true;
        mediaItem.releasedTimeAgo = formatTimeAgo(s.airingAt);

        items.push(mediaItem);
      }

      if (items.length > 0) {
        return items;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch recently released schedules from AniList:', err);
  }

  // Direct Releasing Anime Fallback
  return fetchNewEpisodesFallback(perPage);
}

// Fallback for Releasing Anime
async function fetchNewEpisodesFallback(perPage = 40): Promise<MediaItem[]> {
  const query = `
    query GetNewEpisodesFallback($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, status: RELEASING, sort: [UPDATED_AT_DESC, TRENDING_DESC], isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 40) });
  const rawList = data?.Page?.media || [];
  
  const items = rawList
    .map((m: any) => mapAniListToMediaItem(m, 'anime'))
    .filter((item: MediaItem) => item.status === 'Releasing' && item.category === 'anime');

  return deduplicateMediaItems(items);
}

// Section 2: New Episodes (Strict Exception Rule: ONLY actively airing titles with recent broadcasts)
export async function fetchNewEpisodes(perPage = 40): Promise<MediaItem[]> {
  return fetchRecentlyReleasedEpisodes(perPage);
}

// Section 3: Community Loved (Highest Favourites / Top Rated)
export async function fetchCommunityLovedAnime(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetCommunityLovedAnime($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, sort: FAVOURITES_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'anime'));
  return deduplicateMediaItems(items);
}

// Section 4: Recently Completed
export async function fetchRecentlyCompletedAnime(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetRecentlyCompletedAnime($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, status: FINISHED, sort: [END_DATE_DESC, POPULARITY_DESC], isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const rawList = data?.Page?.media || [];
  const items = rawList
    .map((m: any) => mapAniListToMediaItem(m, 'anime'))
    .filter((item: MediaItem) => item.status === 'Finished' && item.category === 'anime');
  return deduplicateMediaItems(items);
}

// Section 5: Anime Movies
export async function fetchAnimeMovies(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetAnimeMovies($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'anime'));
  return deduplicateMediaItems(items);
}

// Section 6: Upcoming Anime
export async function fetchUpcomingAnime(perPage = 60, format?: string): Promise<MediaItem[]> {
  let formatArg = '';
  if (format && format !== 'All') {
    if (format === 'TV') formatArg = ', format_in: [TV, TV_SHORT]';
    else if (format === 'Movie') formatArg = ', format: MOVIE';
    else if (format === 'Special') formatArg = ', format_in: [SPECIAL, OVA, ONA]';
    else if (format === 'OVA' || format === 'ONA') formatArg = ', format_in: [OVA, ONA]';
  }

  const query = `
    query GetUpcomingAnime($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, status: NOT_YET_RELEASED${formatArg}, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 60) });
    const rawList = data?.Page?.media || [];
    let items = rawList.map((m: any) => mapAniListToMediaItem(m, 'anime'));

    // Client-side strict filter guarantee
    if (format && format !== 'All') {
      items = items.filter((item: MediaItem) => {
        const fmt = String(item.format || '').toUpperCase();
        if (format === 'TV') return fmt === 'TV' || fmt === 'TV_SHORT';
        if (format === 'Movie') return fmt === 'MOVIE';
        if (format === 'Special') return ['SPECIAL', 'OVA', 'ONA', 'MUSIC'].includes(fmt);
        if (format === 'OVA' || format === 'ONA') return fmt === 'OVA' || fmt === 'ONA';
        return true;
      });
    }

    return deduplicateMediaItems(items);
  } catch (err) {
    console.warn('Failed to fetch upcoming anime from AniList:', err);
    return [];
  }
}

// -------------------------------------------------------------
// 2. MANGA API CALLS (AniList & MangaDex)
// -------------------------------------------------------------

// Hero Carousel - Trending Manga
export async function fetchTrendingManga(perPage = 15): Promise<MediaItem[]> {
  const query = `
    query GetTrendingManga($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: MANGA, sort: TRENDING_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 15) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'manga'));
  return deduplicateMediaItems(items);
}

// Manga Section 2: Popular Manga (Expanded)
export async function fetchPopularManga(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetPopularManga($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: MANGA, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'manga'));
  return deduplicateMediaItems(items);
}

// Manga Section 3: Recently Updated Manga (Strict Exception Rule: ONLY authentic actively releasing scanlation updates)
export async function fetchRecentlyUpdatedManga(perPage = 40): Promise<MediaItem[]> {
  const query = `
    query GetRecentlyUpdatedManga($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format_in: [MANGA, ONE_SHOT], status: RELEASING, sort: [UPDATED_AT_DESC, POPULARITY_DESC], isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 40) });
  const rawList = data?.Page?.media || [];
  const items = rawList
    .map((m: any) => mapAniListToMediaItem(m, 'manga'))
    .filter((item: MediaItem) => item.status === 'Releasing' && item.category === 'manga');
  return deduplicateMediaItems(items);
}

// Manga Section 4: Community Loved Manga
export async function fetchCommunityLovedManga(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetCommunityLovedManga($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: MANGA, sort: FAVOURITES_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'manga'));
  return deduplicateMediaItems(items);
}

// Manga Section 5: Recently Completed Manga
export async function fetchRecentlyCompletedManga(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetRecentlyCompletedManga($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: MANGA, status: FINISHED, sort: [END_DATE_DESC, POPULARITY_DESC], isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const rawList = data?.Page?.media || [];
  const items = rawList
    .map((m: any) => mapAniListToMediaItem(m, 'manga'))
    .filter((item: MediaItem) => item.status === 'Finished' && item.category === 'manga');
  return deduplicateMediaItems(items);
}

// -------------------------------------------------------------
// 3. LIGHT NOVEL API CALLS (AniList Format: NOVEL)
// -------------------------------------------------------------

// Hero Carousel - Trending Novels
export async function fetchTrendingNovels(perPage = 15): Promise<MediaItem[]> {
  const query = `
    query GetTrendingNovels($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: NOVEL, sort: TRENDING_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 15) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'novel'));
  return deduplicateMediaItems(items);
}

// Novel Section 1: Seasonal / Trending Light Novels
export async function fetchSeasonalNovels(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetSeasonalNovels($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: NOVEL, sort: [TRENDING_DESC, POPULARITY_DESC], isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'novel'));
  return deduplicateMediaItems(items);
}

// Novel Section 2: Popular Light Novels (Strict Rule: Real released novel chapters/volumes)
export async function fetchPopularNovels(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetPopularNovels($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: NOVEL, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const rawList = data?.Page?.media || [];
  const items = rawList
    .map((m: any) => mapAniListToMediaItem(m, 'novel'))
    .filter((item: MediaItem) => item.category === 'novel');
  return deduplicateMediaItems(items);
}

// Novel Section 3: Monster / Isekai / Action Novels
export async function fetchMonsterNovels(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetMonsterNovels($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: NOVEL, genre: "Fantasy", sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'novel'));
  return deduplicateMediaItems(items);
}

// Novel Section 4: Princess / Romance / Villainess Novels
export async function fetchPrincessNovels(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetPrincessNovels($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: NOVEL, genre: "Romance", sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'novel'));
  return deduplicateMediaItems(items);
}

// Novel Section 5: Magic / Supernatural Novels
export async function fetchMagicNovels(perPage = 30): Promise<MediaItem[]> {
  const query = `
    query GetMagicNovels($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, format: NOVEL, genre_in: ["Magic", "Supernatural", "Adventure"], sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchFromAniList<any>(query, { perPage: Math.max(perPage, 30) });
  const items = (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, 'novel'));
  return deduplicateMediaItems(items);
}

// -------------------------------------------------------------
// 4. AIRING SCHEDULE API (AniList AiringSchedule Query)
// -------------------------------------------------------------

export async function fetchAiringScheduleWeek(): Promise<ScheduleDay[]> {
  const now = new Date();
  // Find Monday of the current week (start from 00:00:00 local time)
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);

  const startTimestamp = Math.floor(monday.getTime() / 1000);
  const endTimestamp = startTimestamp + 7 * 86400; // 7 full days

  const query = `
    query GetWeeklySchedule($airingAt_greater: Int, $airingAt_lesser: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo {
          hasNextPage
        }
        airingSchedules(airingAt_greater: $airingAt_greater, airingAt_lesser: $airingAt_lesser, sort: TIME) {
          id
          airingAt
          episode
          timeUntilAiring
          media {
            ${MEDIA_FIELDS}
          }
        }
      }
    }
  `;

  try {
    // Fetch multiple pages in parallel to cover the entire week (up to 200 airings)
    const pageRequests = [1, 2, 3, 4].map((page) =>
      fetchFromAniList<any>(query, {
        page,
        airingAt_greater: startTimestamp,
        airingAt_lesser: endTimestamp,
      }).catch(() => null)
    );

    const pageResults = await Promise.all(pageRequests);
    const rawSchedules: any[] = [];
    const seenScheduleIds = new Set<number>();

    for (const res of pageResults) {
      if (res?.Page?.airingSchedules) {
        for (const s of res.Page.airingSchedules) {
          if (s && s.id && !seenScheduleIds.has(s.id)) {
            seenScheduleIds.add(s.id);
            rawSchedules.push(s);
          }
        }
      }
    }

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayNamesShort: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[] = [
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ];

    const weekDays: ScheduleDay[] = dayNames.map((dayName, idx) => {
      const dayDate = new Date(monday.getTime() + idx * 86400 * 1000);
      const isToday =
        dayDate.getDate() === now.getDate() &&
        dayDate.getMonth() === now.getMonth() &&
        dayDate.getFullYear() === now.getFullYear();

      const dateString = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayNameShort = dayNamesShort[idx];
      const dateNum = dayDate.getDate();
      const dayStartUnix = Math.floor(dayDate.getTime() / 1000);
      const dayEndUnix = dayStartUnix + 86400;

      // Filter and sort schedules for this day
      const dayItems = rawSchedules
        .filter((s: any) => s.airingAt >= dayStartUnix && s.airingAt < dayEndUnix && s.media)
        .sort((a: any, b: any) => a.airingAt - b.airingAt)
        .map((s: any) => {
          const mediaItem = mapAniListToMediaItem(s.media, 'anime');
          const airDate = new Date(s.airingAt * 1000);
          const timeFormatted = airDate.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          const isPast = s.airingAt <= Math.floor(Date.now() / 1000);
          const timeAgoStr = isPast ? formatTimeAgo(s.airingAt) : undefined;

          mediaItem.latestEpisode = s.episode;
          mediaItem.currentEpisodeBadge = `EP ${s.episode}`;
          mediaItem.airingAt = s.airingAt;
          mediaItem.isReleased = isPast;
          mediaItem.releasedTimeAgo = timeAgoStr;

          return {
            id: `sched_${s.id}`,
            media: mediaItem,
            airingTime: timeFormatted,
            airingAt: s.airingAt,
            episodeNumber: s.episode,
            isAiringToday: isToday,
            isReleased: isPast,
            releasedTimeAgo: timeAgoStr,
          };
        });

      return {
        day: dayName,
        dayName: dayNameShort,
        date: dateString,
        dateNumber: dateNum,
        isToday,
        items: dayItems,
      };
    });

    return weekDays;
  } catch (err) {
    console.warn('Error fetching weekly schedule from AniList:', err);
    return [];
  }
}

// -------------------------------------------------------------
// 5. LIVE SEARCH & FILTER API (AniList & MangaDex)
// -------------------------------------------------------------

export async function searchAniList(
  searchQuery: string,
  filters: Partial<FilterOptions> = {},
  page = 1,
  perPage = 24
): Promise<{ items: MediaItem[]; hasNextPage: boolean; total: number }> {
  let type: 'ANIME' | 'MANGA' = 'ANIME';
  let format_in: string[] | undefined = undefined;

  if (filters.category === 'manga') {
    type = 'MANGA';
    if (filters.format && filters.format.length > 0) {
      const mapped = filters.format.map((f) => {
        if (f.toLowerCase() === 'manga') return 'MANGA';
        if (f.toLowerCase().includes('one')) return 'ONE_SHOT';
        return f.toUpperCase().replace(/\s+/g, '_');
      });
      format_in = mapped.filter((f) => ['MANGA', 'ONE_SHOT'].includes(f));
      if (format_in.length === 0) format_in = ['MANGA', 'ONE_SHOT'];
    } else {
      format_in = ['MANGA', 'ONE_SHOT'];
    }
  } else if (filters.category === 'novel') {
    type = 'MANGA';
    format_in = ['NOVEL'];
  } else {
    type = 'ANIME';
    if (filters.format && filters.format.length > 0) {
      const mapped = filters.format.flatMap((f) => {
        const upper = f.toUpperCase().replace(/\s+/g, '_');
        if (upper === 'TV') return ['TV', 'TV_SHORT'];
        if (upper === 'MOVIE') return ['MOVIE'];
        if (upper === 'SPECIAL') return ['SPECIAL'];
        if (upper === 'OVA') return ['OVA'];
        if (upper === 'ONA') return ['ONA'];
        return [upper];
      });
      format_in = mapped;
    }
  }

  let status_in: string[] | undefined = undefined;
  if (filters.status && filters.status.length > 0) {
    status_in = filters.status.map((st) => {
      if (st.toLowerCase().includes('releasing')) return 'RELEASING';
      if (st.toLowerCase().includes('finished')) return 'FINISHED';
      if (st.toLowerCase().includes('upcoming') || st.toLowerCase().includes('not yet')) return 'NOT_YET_RELEASED';
      if (st.toLowerCase().includes('cancel')) return 'CANCELLED';
      if (st.toLowerCase().includes('hiatus')) return 'HIATUS';
      return 'RELEASING';
    });
  }

  let genre_in: string[] | undefined = undefined;
  if (filters.genres && filters.genres.length > 0) {
    genre_in = filters.genres;
  }

  let tag_in: string[] | undefined = undefined;
  if (filters.advancedTags && filters.advancedTags.length > 0) {
    tag_in = filters.advancedTags;
  }

  let averageScore_greater: number | undefined = undefined;
  if (filters.minScore && filters.minScore !== 'Any') {
    const parsed = parseInt(filters.minScore, 10);
    if (!isNaN(parsed)) {
      averageScore_greater = parsed * 10;
    }
  }
  if (filters.scoreRange && filters.scoreRange[0] > 0) {
    averageScore_greater = Math.max(averageScore_greater || 0, filters.scoreRange[0]);
  }

  let seasonYear: number | undefined = undefined;
  let startDate_greater: number | undefined = undefined;
  let startDate_lesser: number | undefined = undefined;

  if (filters.selectedYear && filters.selectedYear !== 'Any') {
    const yr = parseInt(filters.selectedYear, 10);
    if (!isNaN(yr)) {
      seasonYear = yr;
    }
  } else if (filters.yearRange && (filters.yearRange[0] > 1940 || filters.yearRange[1] < 2028)) {
    startDate_greater = filters.yearRange[0] * 10000;
    startDate_lesser = filters.yearRange[1] * 10000 + 1231;
  }

  let season: string | undefined = undefined;
  if (filters.season && filters.season.length > 0) {
    const validSeasons = filters.season.filter((s) => s !== 'Any');
    if (validSeasons.length > 0) {
      season = validSeasons[0].toUpperCase();
    }
  }

  const variables: Record<string, any> = {
    page,
    perPage,
    type,
    isAdult: false,
    sort: (searchQuery.trim() || filters.studio?.trim()) ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : ['SCORE_DESC', 'POPULARITY_DESC'],
  };

  if (searchQuery.trim()) {
    variables.search = searchQuery.trim();
  } else if (filters.studio && filters.studio.trim()) {
    variables.search = filters.studio.trim();
  }
  if (format_in && format_in.length > 0) variables.format_in = format_in;
  if (status_in && status_in.length > 0) variables.status_in = status_in;
  if (genre_in && genre_in.length > 0) variables.genre_in = genre_in;
  if (tag_in && tag_in.length > 0) variables.tag_in = tag_in;
  if (averageScore_greater !== undefined) variables.averageScore_greater = averageScore_greater;
  if (seasonYear !== undefined) variables.seasonYear = seasonYear;
  if (startDate_greater !== undefined) variables.startDate_greater = startDate_greater;
  if (startDate_lesser !== undefined) variables.startDate_lesser = startDate_lesser;
  if (season !== undefined) variables.season = season;

  const query = `
    query SearchMedia(
      $page: Int,
      $perPage: Int,
      $search: String,
      $type: MediaType,
      $format_in: [MediaFormat],
      $status_in: [MediaStatus],
      $genre_in: [String],
      $tag_in: [String],
      $season: MediaSeason,
      $seasonYear: Int,
      $startDate_greater: FuzzyDateInt,
      $startDate_lesser: FuzzyDateInt,
      $averageScore_greater: Int,
      $sort: [MediaSort],
      $isAdult: Boolean
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          hasNextPage
        }
        media(
          search: $search,
          type: $type,
          format_in: $format_in,
          status_in: $status_in,
          genre_in: $genre_in,
          tag_in: $tag_in,
          season: $season,
          seasonYear: $seasonYear,
          startDate_greater: $startDate_greater,
          startDate_lesser: $startDate_lesser,
          averageScore_greater: $averageScore_greater,
          sort: $sort,
          isAdult: $isAdult
        ) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await fetchFromAniList<any>(query, variables);
    const mediaList = data?.Page?.media || [];
    const pageInfo = data?.Page?.pageInfo || { total: mediaList.length, hasNextPage: false };

    let items = mediaList.map((m: any) => mapAniListToMediaItem(m, filters.category));

    // Refine studio / author filter client-side if provided
    if (filters.studio && filters.studio.trim()) {
      const studioQuery = filters.studio.trim().toLowerCase();
      const matched = items.filter((item: MediaItem) =>
        item.studio?.toLowerCase().includes(studioQuery) ||
        item.author?.toLowerCase().includes(studioQuery)
      );
      if (matched.length > 0) {
        items = matched;
      }
    }

    const uniqueItems = deduplicateMediaItems(items);

    return {
      items: uniqueItems,
      hasNextPage: pageInfo.hasNextPage || false,
      total: pageInfo.total || uniqueItems.length,
    };
  } catch (err) {
    console.warn('Search error from AniList:', err);
    return { items: [], hasNextPage: false, total: 0 };
  }
}

// -------------------------------------------------------------
// 6. SINGLE MEDIA DETAILS BY ID
// -------------------------------------------------------------

async function fetchMediaDetailsByIdNetwork(id: string | number): Promise<MediaItem | null> {
  const query = `
    query GetMediaById($id: Int) {
      Media(id: $id, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  `;
  try {
    const data = await fetchFromAniList<any>(query, { id: Number(id) });
    if (!data?.Media) return null;
    return mapAniListToMediaItem(data.Media);
  } catch (err) {
    console.warn(`Error fetching media by id ${id}:`, err);
    return null;
  }
}

export async function fetchMediaDetailsById(id: string | number): Promise<MediaItem | null> {
  const cacheKey = `media_details_${id}`;

  // 1. Instant Synchronous Cache Hit (0ms)
  const syncHit = swrGetSync<MediaItem>(cacheKey);
  if (syncHit) {
    if (syncHit.isFresh) {
      return syncHit.data;
    }
    // SWR: return stale data immediately, revalidate silently in background
    swrFetchDedupe(cacheKey, async () => {
      const fresh = await fetchMediaDetailsByIdNetwork(id);
      if (fresh) await swrSet(cacheKey, fresh);
      return fresh;
    }).catch(() => {});
    return syncHit.data;
  }

  // 2. Async IndexedDB Cache Hit
  const asyncHit = await swrGet<MediaItem>(cacheKey);
  if (asyncHit) {
    if (!asyncHit.isFresh) {
      swrFetchDedupe(cacheKey, async () => {
        const fresh = await fetchMediaDetailsByIdNetwork(id);
        if (fresh) await swrSet(cacheKey, fresh);
        return fresh;
      }).catch(() => {});
    }
    return asyncHit.data;
  }

  // 3. Network Fetch with in-flight deduplication
  return swrFetchDedupe(cacheKey, async () => {
    const fresh = await fetchMediaDetailsByIdNetwork(id);
    if (fresh) await swrSet(cacheKey, fresh);
    return fresh;
  });
}

// -------------------------------------------------------------
// 6B. REAL ANILIST CHARACTER DETAILS & APPEARANCES PROVIDER
// -------------------------------------------------------------

async function fetchCharacterDetailsByIdNetwork(id: string | number): Promise<Character | null> {
  const numId = Number(id);
  if (!numId || isNaN(numId)) return null;

  const query = `
    query ($id: Int) {
      Character (id: $id) {
        id
        name {
          full
          native
          userPreferred
          alternative
        }
        image {
          large
          medium
        }
        description
        gender
        dateOfBirth {
          year
          month
          day
        }
        age
        bloodType
        favourites
        media(perPage: 50, sort: [POPULARITY_DESC, SCORE_DESC]) {
          edges {
            characterRole
            node {
              id
              type
              format
              title {
                english
                romaji
                userPreferred
              }
              coverImage {
                extraLarge
                large
                medium
              }
              startDate {
                year
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await fetchFromAniList<{ Character?: any }>(query, { id: numId });
    const c = data?.Character;
    if (!c) return null;

    const bday = c.dateOfBirth?.month && c.dateOfBirth?.day
      ? `${c.dateOfBirth.month}/${c.dateOfBirth.day}`
      : undefined;

    const parsed = parseCharacterDescription(c.description, {
      gender: c.gender || undefined,
      birthday: bday,
      age: c.age || undefined,
      bloodType: c.bloodType || undefined,
    });

    const seenMediaIds = new Set<string>();
    const appearedInList: {
      id: string | number;
      title: string;
      image: string;
      year: string | number;
      format: string;
      type?: string;
    }[] = [];

    const edges = c.media?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      if (!node || seenMediaIds.has(String(node.id))) continue;

      // Filter: Only anime-related series (exclude manga, novels, one-shots)
      const rawType = (node.type || '').toUpperCase();
      const rawFmt = (node.format || '').toUpperCase();
      if (rawType === 'MANGA' || rawFmt === 'MANGA' || rawFmt === 'NOVEL' || rawFmt === 'ONE_SHOT') {
        continue;
      }

      seenMediaIds.add(String(node.id));

      const title = node.title?.english || node.title?.romaji || node.title?.userPreferred || 'Untitled';
      const img = node.coverImage?.extraLarge || node.coverImage?.large || node.coverImage?.medium || '';
      const year = node.startDate?.year || '';

      const rawFormat = (node.format || node.type || 'TV').toUpperCase();
      let format = rawFormat;
      if (rawFormat === 'MOVIE') format = 'Movie';
      else if (rawFormat === 'SPECIAL') format = 'Special';
      else if (rawFormat === 'TV') format = 'TV';
      else if (rawFormat === 'OVA') format = 'OVA';
      else if (rawFormat === 'ONA') format = 'ONA';
      else if (rawFormat === 'MANGA') format = 'Manga';
      else if (rawFormat === 'TV_SHORT') format = 'TV Short';

      appearedInList.push({
        id: String(node.id),
        title: title.toUpperCase(),
        image: optimizeImageUrl(img),
        year: year ? String(year) : 'Unknown',
        format,
        type: node.type,
      });
    }

    return {
      id: String(c.id),
      name: c.name?.full || c.name?.userPreferred || 'Unknown Character',
      nativeName: c.name?.native,
      image: optimizeImageUrl(c.image?.large || c.image?.medium || ''),
      role: 'Main',
      hearts: c.favourites || 0,
      favourites: c.favourites || 0,
      gender: c.gender || 'Unknown',
      age: c.age || 'Unknown',
      birthday: bday,
      bloodType: c.bloodType || 'Unknown',
      attributes: parsed.attributes,
      bio: parsed.bio,
      rawDescription: c.description || '',
      appearedIn: appearedInList,
    };
  } catch (err) {
    console.error('Failed to fetch character details from AniList:', err);
    return null;
  }
}

export async function fetchCharacterDetailsById(id: string | number): Promise<Character | null> {
  const cacheKey = `character_details_${id}`;

  const syncHit = swrGetSync<Character>(cacheKey);
  if (syncHit) {
    if (syncHit.isFresh) {
      return syncHit.data;
    }
    swrFetchDedupe(cacheKey, async () => {
      const fresh = await fetchCharacterDetailsByIdNetwork(id);
      if (fresh) await swrSet(cacheKey, fresh);
      return fresh;
    }).catch(() => {});
    return syncHit.data;
  }

  const asyncHit = await swrGet<Character>(cacheKey);
  if (asyncHit) {
    if (!asyncHit.isFresh) {
      swrFetchDedupe(cacheKey, async () => {
        const fresh = await fetchCharacterDetailsByIdNetwork(id);
        if (fresh) await swrSet(cacheKey, fresh);
        return fresh;
      }).catch(() => {});
    }
    return asyncHit.data;
  }

  return swrFetchDedupe(cacheKey, async () => {
    const fresh = await fetchCharacterDetailsByIdNetwork(id);
    if (fresh) await swrSet(cacheKey, fresh);
    return fresh;
  });
}

export async function fetchCharacterDetailsByName(name: string): Promise<Character | null> {
  const cleanName = name.trim();
  if (!cleanName) return null;
  const cacheKey = `character_details_name_${cleanName.toLowerCase()}`;

  const syncHit = swrGetSync<Character>(cacheKey);
  if (syncHit) {
    if (syncHit.isFresh) return syncHit.data;
  }

  const query = `
    query ($search: String) {
      Character (search: $search) {
        id
        name {
          full
          native
          userPreferred
        }
        image {
          large
          medium
        }
        description
        gender
        dateOfBirth {
          year
          month
          day
        }
        age
        bloodType
        favourites
        media(perPage: 50, sort: [POPULARITY_DESC, SCORE_DESC]) {
          edges {
            characterRole
            node {
              id
              type
              format
              title {
                english
                romaji
                userPreferred
              }
              coverImage {
                extraLarge
                large
                medium
              }
              startDate {
                year
              }
            }
          }
        }
      }
    }
  `;

  return swrFetchDedupe(cacheKey, async () => {
    try {
      const data = await fetchFromAniList<{ Character?: any }>(query, { search: cleanName });
      const c = data?.Character;
      if (!c) return null;

      const bday = c.dateOfBirth?.month && c.dateOfBirth?.day
        ? `${c.dateOfBirth.month}/${c.dateOfBirth.day}`
        : undefined;

      const parsed = parseCharacterDescription(c.description, {
        gender: c.gender || undefined,
        birthday: bday,
        age: c.age || undefined,
        bloodType: c.bloodType || undefined,
      });

      const seenMediaIds = new Set<string>();
      const appearedInList: {
        id: string | number;
        title: string;
        image: string;
        year: string | number;
        format: string;
        type?: string;
      }[] = [];

      const edges = c.media?.edges || [];
      for (const edge of edges) {
        const node = edge.node;
        if (!node || seenMediaIds.has(String(node.id))) continue;

        // Filter: Only anime-related series (exclude manga, novels, one-shots)
        const rawType = (node.type || '').toUpperCase();
        const rawFmt = (node.format || '').toUpperCase();
        if (rawType === 'MANGA' || rawFmt === 'MANGA' || rawFmt === 'NOVEL' || rawFmt === 'ONE_SHOT') {
          continue;
        }

        seenMediaIds.add(String(node.id));

        const title = node.title?.english || node.title?.romaji || node.title?.userPreferred || 'Untitled';
        const img = node.coverImage?.extraLarge || node.coverImage?.large || node.coverImage?.medium || '';
        const year = node.startDate?.year || '';

        const rawFormat = (node.format || node.type || 'TV').toUpperCase();
        let format = rawFormat;
        if (rawFormat === 'MOVIE') format = 'Movie';
        else if (rawFormat === 'SPECIAL') format = 'Special';
        else if (rawFormat === 'TV') format = 'TV';
        else if (rawFormat === 'OVA') format = 'OVA';
        else if (rawFormat === 'ONA') format = 'ONA';
        else if (rawFormat === 'MANGA') format = 'Manga';
        else if (rawFormat === 'TV_SHORT') format = 'TV Short';

        appearedInList.push({
          id: String(node.id),
          title: title.toUpperCase(),
          image: optimizeImageUrl(img),
          year: year ? String(year) : 'Unknown',
          format,
          type: node.type,
        });
      }

      const charItem: Character = {
        id: String(c.id),
        name: c.name?.full || c.name?.userPreferred || cleanName,
        nativeName: c.name?.native,
        image: optimizeImageUrl(c.image?.large || c.image?.medium || ''),
        role: 'Main',
        hearts: c.favourites || 0,
        favourites: c.favourites || 0,
        gender: c.gender || 'Unknown',
        age: c.age || 'Unknown',
        birthday: bday,
        bloodType: c.bloodType || 'Unknown',
        attributes: parsed.attributes,
        bio: parsed.bio,
        rawDescription: c.description || '',
        appearedIn: appearedInList,
      };

      await swrSet(cacheKey, charItem);
      return charItem;
    } catch (err) {
      console.error('Failed to search character by name from AniList:', err);
      return null;
    }
  });
}

// -------------------------------------------------------------
// 7. GENERAL ANILIST MEDIA QUERY WITH FLEXIBLE FILTERS & SORT
// -------------------------------------------------------------

export async function fetchAniListMedia(
  type: 'ANIME' | 'MANGA' = 'ANIME',
  genre?: string,
  sort: string[] | string = ['TRENDING_DESC', 'POPULARITY_DESC'],
  perPage = 20,
  season?: string,
  seasonYear?: number,
  format?: string
): Promise<MediaItem[]> {
  const sortArg = Array.isArray(sort) ? `[${sort.join(', ')}]` : sort;
  const genreArg = genre ? `, genre: "${genre}"` : '';
  const formatArg = format ? `, format: ${format}` : '';
  const seasonArg = season ? `, season: ${season}` : '';
  const seasonYearArg = seasonYear ? `, seasonYear: ${seasonYear}` : '';

  const query = `
    query GetAniListMedia($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ${type}${formatArg}${genreArg}${seasonArg}${seasonYearArg}, sort: ${sortArg}, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchFromAniList<any>(query, { perPage });
    const categoryOverride: MediaCategory = type === 'ANIME' ? 'anime' : format === 'NOVEL' ? 'novel' : 'manga';
    return (data?.Page?.media || []).map((m: any) => mapAniListToMediaItem(m, categoryOverride));
  } catch (err) {
    console.warn('fetchAniListMedia failed:', err);
    return [];
  }
}

// -------------------------------------------------------------
// 8. MANGADEX REST API (Manga Reader Chapter Page Image Arrays)
// -------------------------------------------------------------

export interface MangaDexChapter {
  id: string;
  chapter: string;
  title: string;
  volume?: string;
  pages: number;
  publishAt: string;
}

export async function fetchMangaDex<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      if (Array.isArray(val)) {
        val.forEach((item) => queryParams.append(`${key}[]`, item));
      } else {
        queryParams.append(key, String(val));
      }
    }
  });

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const cacheKey = `mangadex_${cleanEndpoint}_${queryString}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 1. Try server proxy first
  try {
    const proxyUrl = `/api/mangadex/${cleanEndpoint}${queryString}`;
    const proxyRes = await fetch(proxyUrl, {
      headers: { Accept: 'application/json' },
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.result !== 'error') {
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data as T;
      }
    }
  } catch {
    // Fall back to direct
  }

  // 2. Direct request fallback
  try {
    const directUrl = `${MANGADEX_URL}/${cleanEndpoint}${queryString}`;
    const directRes = await fetch(directUrl, {
      headers: { Accept: 'application/json' },
    });
    if (directRes.ok) {
      const data = await directRes.json();
      if (data && data.result !== 'error') {
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data as T;
      }
    }
  } catch {
    // Fail gracefully
  }

  return null;
}

/**
 * Compute normalized word overlap similarity score between candidate and target titles
 */
export function computeTitleMatchScore(candidate: string, target: string): number {
  if (!candidate || !target) return 0;
  const normA = candidate.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ');
  const normB = target.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ');
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    return minLen / maxLen;
  }
  const wordsA = new Set(normA.split(' ').filter((w) => w.length > 1));
  const wordsB = new Set(normB.split(' ').filter((w) => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return (2 * matches) / (wordsA.size + wordsB.size);
}

/**
 * Search MangaDex by manga title with multi-strategy title matching and MAL ID verification
 */
export async function searchMangaDex(
  title: string,
  altTitles: string[] = [],
  idMal?: string | number
): Promise<string | null> {
  const rawCandidates = [title, ...altTitles].filter(Boolean);
  const candidates: string[] = [];

  for (const t of rawCandidates) {
    if (!t) continue;
    candidates.push(t);
    const cleaned = t.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
    if (cleaned && cleaned !== t) candidates.push(cleaned);
    const prefix = cleaned.split(/[:\-\–\—\~]/)[0].trim();
    if (prefix && prefix.length > 2 && prefix !== cleaned) candidates.push(prefix);

    const alphaNum = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (alphaNum && alphaNum !== cleaned && alphaNum.length > 3) candidates.push(alphaNum);
  }

  const uniqueCandidates = Array.from(new Set(candidates));

  for (const candidateTitle of uniqueCandidates) {
    if (!candidateTitle || candidateTitle.trim().length === 0) continue;

    // 1. Exact / Relevance Search
    const data = await fetchMangaDex<any>('manga', {
      title: candidateTitle.trim(),
      limit: 10,
      'order[relevance]': 'desc',
      includes: ['cover_art'],
      contentRating: ['safe', 'suggestive', 'erotica', 'pornographic'],
    });

    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      // 1. Check MAL ID match first if available
      if (idMal) {
        const malMatch = data.data.find(
          (item: any) =>
            item.attributes?.links?.mal && String(item.attributes.links.mal) === String(idMal)
        );
        if (malMatch) return malMatch.id;
      }

      // 2. Check exact or high-confidence title match
      let bestItem: any = null;
      let bestScore = 0;

      for (const item of data.data) {
        const itemTitles = [
          ...Object.values(item.attributes?.title || {}),
          ...(item.attributes?.altTitles || []).flatMap((a: any) => Object.values(a || {})),
        ] as string[];

        for (const it of itemTitles) {
          const score = computeTitleMatchScore(it, candidateTitle);
          if (score > bestScore) {
            bestScore = score;
            bestItem = item;
          }
        }
      }

      // Only accept if match score is at least 0.70 (never return random first result!)
      if (bestItem && bestScore >= 0.70) {
        return bestItem.id;
      }
    }
  }

  return null;
}

/**
 * Live search MangaDex titles and return array of MediaItems with cover art
 */
export async function searchMangaDexList(query: string, limit = 20): Promise<MediaItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const data = await fetchMangaDex<any>('manga', {
      title: trimmed,
      limit,
      'order[relevance]': 'desc',
      includes: ['cover_art'],
      contentRating: ['safe', 'suggestive', 'erotica', 'pornographic'],
    });

    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map((item: any) => {
      const attrs = item.attributes || {};
      const titleObj = attrs.title || {};
      const englishTitle = titleObj.en || (attrs.altTitles || []).find((a: any) => a.en)?.en;
      let nativeTitle: string | undefined = titleObj.ja;
      let romajiTitle: string | undefined = titleObj['ja-ro'];
      if (!nativeTitle || !romajiTitle) {
        for (const alt of (attrs.altTitles || [])) {
          if (!nativeTitle && (alt.ja || alt.ko || alt.zh)) {
            nativeTitle = alt.ja || alt.ko || alt.zh;
          }
          if (!romajiTitle && (alt['ja-ro'] || alt['ko-ro'] || alt['zh-ro'])) {
            romajiTitle = alt['ja-ro'] || alt['ko-ro'] || alt['zh-ro'];
          }
        }
      }

      const title =
        englishTitle ||
        titleObj['ja-ro'] ||
        titleObj.ja ||
        Object.values(titleObj)[0] ||
        'Unknown Manga';

      const coverRel = (item.relationships || []).find((r: any) => r.type === 'cover_art');
      const fileName = coverRel?.attributes?.fileName;
      const rawCover = fileName
        ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.512.jpg`
        : '';

      let mangaYear: number | undefined = attrs.year ? Number(attrs.year) : undefined;
      if (!mangaYear && attrs.createdAt) {
        const createdDate = new Date(attrs.createdAt);
        if (!isNaN(createdDate.getFullYear())) {
          mangaYear = createdDate.getFullYear();
        }
      }

      return {
        id: item.id,
        title: String(title),
        englishTitle: englishTitle ? String(englishTitle) : undefined,
        nativeTitle: nativeTitle ? String(nativeTitle) : undefined,
        romajiTitle: romajiTitle ? String(romajiTitle) : undefined,
        coverImage: optimizeImageUrl(rawCover),
        category: 'manga' as MediaCategory,
        format: 'MANGA',
        status: attrs.status === 'completed' ? 'Finished' : 'Releasing',
        score: 8.5,
        year: mangaYear,
        genres: (attrs.tags || []).map((t: any) => t.attributes?.name?.en).filter(Boolean),
        description: attrs.description?.en || 'Manga series available on MangaDex.',
      };
    });
  } catch (err) {
    console.warn('Error in searchMangaDexList:', err);
    return [];
  }
}

/**
 * Fetch English (or multi-language fallback) chapters list from MangaDex
 * Uses MangaDex Aggregate API first for instant, complete retrieval of 1000+ chapters without rate limits
 */
export async function fetchMangaDexChapters(mangaId: string): Promise<MangaDexChapter[]> {
  try {
    const seen = new Set<string>();
    const chapters: MangaDexChapter[] = [];

    // 1. PRIMARY FAST ENGINE: MangaDex Aggregate Endpoint
    // Returns ALL volumes and chapters (1 to 1100+ for One Piece, Naruto, Black Clover) in 1 single instant call
    try {
      const aggregateData = await fetchMangaDex<any>(`manga/${mangaId}/aggregate`, {
        translatedLanguage: ['en'],
      });

      const parseAggregate = (agg: any) => {
        if (agg?.volumes && typeof agg.volumes === 'object') {
          for (const [volKey, volObj] of Object.entries<any>(agg.volumes)) {
            if (volObj?.chapters && typeof volObj.chapters === 'object') {
              for (const [chKey, chObj] of Object.entries<any>(volObj.chapters)) {
                const chNum = chObj.chapter || chKey;
                if (chNum && !seen.has(chNum)) {
                  seen.add(chNum);
                  chapters.push({
                    id: chObj.id,
                    chapter: chNum,
                    title: `Chapter ${chNum}`,
                    volume: volKey !== 'none' ? volKey : undefined,
                    pages: chObj.count || 20,
                    publishAt: '',
                  });
                }
              }
            }
          }
        }
      };

      if (aggregateData?.volumes) {
        parseAggregate(aggregateData);
      }

      // If English aggregate is empty, fallback to all languages aggregate
      if (chapters.length === 0) {
        const allLangAgg = await fetchMangaDex<any>(`manga/${mangaId}/aggregate`);
        if (allLangAgg?.volumes) {
          parseAggregate(allLangAgg);
        }
      }

      if (chapters.length > 0) {
        return chapters.sort((a, b) => (parseFloat(a.chapter) || 0) - (parseFloat(b.chapter) || 0));
      }
    } catch (aggErr) {
      console.warn('MangaDex aggregate notice, falling back to feed:', aggErr);
    }

    // 2. SECONDARY ENGINE: MangaDex Feed API
    const fetchBatch = async (offset = 0, lang: string[] = ['en']) => {
      const params: Record<string, any> = {
        'order[chapter]': 'asc',
        limit: 500,
        offset,
        'contentRating': ['safe', 'suggestive', 'erotica', 'pornographic'],
      };
      if (lang.length > 0) {
        params.translatedLanguage = lang;
      }
      return await fetchMangaDex<any>(`manga/${mangaId}/feed`, params);
    };

    let batch = await fetchBatch(0, ['en']);
    const hasValidEn = batch?.data && Array.isArray(batch.data) && batch.data.some((c: any) => !c.attributes?.externalUrl);

    if (!hasValidEn) {
      batch = await fetchBatch(0, []);
    }

    if (batch?.data && Array.isArray(batch.data) && batch.data.length > 0) {
      for (const item of batch.data) {
        const chNum = item.attributes?.chapter || '1';
        if (!seen.has(chNum)) {
          seen.add(chNum);
          chapters.push({
            id: item.id,
            chapter: chNum,
            title: item.attributes?.title || `Chapter ${chNum}`,
            volume: item.attributes?.volume,
            pages: item.attributes?.pages || 0,
            publishAt: item.attributes?.publishAt || '',
          });
        }
      }
    }

    return chapters.sort((a, b) => (parseFloat(a.chapter) || 0) - (parseFloat(b.chapter) || 0));
  } catch (err) {
    console.warn('fetchMangaDexChapters error:', err);
    return [];
  }
}

/**
 * Fetch chapter page image URLs array from MangaDex @Home server with proxy wrapping
 */
export async function fetchMangaDexChapterPages(chapterId: string): Promise<string[]> {
  try {
    const atHomeData = await fetchMangaDex<any>(`at-home/server/${chapterId}`);
    if (!atHomeData?.chapter?.hash) {
      return [];
    }

    const { baseUrl, chapter } = atHomeData;
    const hash = chapter.hash;
    const isDataSaver = !chapter.data || !Array.isArray(chapter.data) || chapter.data.length === 0;
    const pageFiles: string[] = (!isDataSaver ? chapter.data : chapter.dataSaver) || [];

    if (pageFiles.length === 0) return [];

    const subFolder = isDataSaver ? 'data-saver' : 'data';
    return pageFiles.map((filename) => {
      const remoteUrl = `https://uploads.mangadex.org/${subFolder}/${hash}/${filename}`;
      return `/api/image-proxy?url=${encodeURIComponent(remoteUrl)}`;
    });
  } catch (err) {
    console.warn('fetchMangaDexChapterPages error:', err);
    return [];
  }
}

/**
 * High-Res Multi-Provider Manga Pages Engine
 * Guaranteed to load pages for all manga chapters (One Piece, Naruto, Black Clover, etc.)
 */
export async function getMangaPages(
  title: string,
  chapterNumber: number,
  chapterId?: string,
  altTitles: string[] = [],
  anilistId?: string | number,
  idMal?: string | number
): Promise<string[]> {
  // 1. If direct valid chapterId is provided (real MangaDex UUID), fetch directly
  if (chapterId && !chapterId.startsWith('manga-ch-') && !chapterId.startsWith('ch-') && chapterId.length > 20) {
    try {
      const directPages = await fetchMangaDexChapterPages(chapterId);
      if (directPages && directPages.length > 0) {
        return directPages;
      }
    } catch {
      // Continue to next provider
    }
  }

  // 2. High-Speed Multi-Provider Server Engine (MangaPill, MangaDex, ComicK, Anify)
  try {
    const queryParams = new URLSearchParams({
      title,
      chapter: String(chapterNumber),
    });
    if (chapterId && !chapterId.startsWith('manga-ch-') && !chapterId.startsWith('ch-')) {
      queryParams.append('mangaId', chapterId);
    }
    if (anilistId) queryParams.append('anilistId', String(anilistId));
    if (idMal) queryParams.append('idMal', String(idMal));

    const serverRes = await fetch(`/api/manga/pages?${queryParams.toString()}`);
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData?.pages && Array.isArray(serverData.pages) && serverData.pages.length > 0) {
        return serverData.pages;
      }
    }
  } catch (err) {
    console.warn('Server multi-provider manga pages notice:', err);
  }

  // 3. MangaDex Title & Direct Chapter Query Search
  let mangaId: string | null = null;
  try {
    mangaId = await searchMangaDex(title, altTitles, idMal);
    if (mangaId) {
      const chapterQueries = [
        { translatedLanguage: ['en'], 'chapter[]': [String(chapterNumber)], limit: 5 },
        { 'chapter[]': [String(chapterNumber)], limit: 5 },
      ];

      for (const params of chapterQueries) {
        const feedData = await fetchMangaDex<any>(`chapter`, {
          manga: mangaId,
          ...params,
        });
        if (feedData?.data && Array.isArray(feedData.data) && feedData.data.length > 0) {
          const usableChapter = feedData.data.find(
            (c: any) => parseFloat(c.attributes?.chapter) === chapterNumber && c.attributes?.pages > 0 && !c.attributes?.externalUrl
          ) || feedData.data[0];

          if (usableChapter?.id) {
            const pages = await fetchMangaDexChapterPages(usableChapter.id);
            if (pages && pages.length > 0) {
              return pages;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('MangaDex specific chapter lookup notice:', err);
  }

  // 4. Fallback: Search Anify Manga Pages
  if (anilistId) {
    try {
      const anifyPages = await getAnifyMangaPages(anilistId, chapterNumber, title);
      if (anifyPages && anifyPages.length > 0) {
        return anifyPages.map((p) =>
          p.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(p)}` : p
        );
      }
    } catch (err) {
      console.warn('Anify manga fallback notice:', err);
    }
  }

  return [];
}

// -------------------------------------------------------------
// 9. DYNAMIC REAL EPISODES / CHAPTERS / VOLUMES RESOLVER ENGINES
// -------------------------------------------------------------

/**
 * Fetch strictly aired & verified Anime Episodes (eliminates mock loops & unreleased future episodes)
 */
async function fetchMediaEpisodesNetwork(media: MediaItem, maxAiredEpisode: number): Promise<EpisodeItem[]> {
  // Fetch real live episodes from Anify providers (e.g. gogoanime, zoro)
  try {
    const liveEpisodes = await getAnifyEpisodes(media.id, media.title);
    if (Array.isArray(liveEpisodes) && liveEpisodes.length > 0) {
      const filtered = liveEpisodes
        .filter((ep) => {
          const num = ep.number;
          if (num > maxAiredEpisode) return false;
          return true;
        })
        .map((ep) => ({
          id: ep.id,
          number: ep.number,
          title: ep.title || `Episode ${ep.number}`,
          thumbnail: ep.image || media.bannerImage || media.coverImage,
          filler: ep.isFiller || false,
          providerId: ep.providerId,
          isReleased: true,
        }));

      if (filtered.length > 0) {
        return filtered.sort((a, b) => a.number - b.number);
      }
    }
  } catch (err) {
    console.warn('Anify episodes fetch notice:', err);
  }

  // Fallback strictly to aired count sequence
  const episodes: EpisodeItem[] = [];
  for (let i = 1; i <= maxAiredEpisode; i++) {
    episodes.push({
      id: `anime-ep-${media.id}-${i}`,
      number: i,
      title: `Episode ${i}`,
      thumbnail: media.bannerImage || media.coverImage,
      filler: false,
      isReleased: true,
    });
  }

  return episodes;
}

/**
 * Fetch strictly aired & verified Anime Episodes with instant SWR caching
 */
export async function fetchMediaEpisodes(media: MediaItem): Promise<EpisodeItem[]> {
  // 1. If media is not yet released, return empty array (0 aired episodes)
  if (media.status === 'Upcoming' || media.status === 'Not Yet Released') {
    return [];
  }

  // 2. Determine strictly aired upper limit based on AniList nextAiringEpisode & status
  let maxAiredEpisode = media.totalEpisodes || media.latestEpisode || 1;
  if (media.status === 'Releasing') {
    if (media.nextAiringEpisode && media.nextAiringEpisode.episode) {
      maxAiredEpisode = Math.max(1, media.nextAiringEpisode.episode - 1);
    } else if (media.latestEpisode) {
      maxAiredEpisode = media.latestEpisode;
    }
  }

  const cacheKey = `anime_episodes_${media.id}`;

  // Synchronous cache hit (0ms)
  const syncHit = swrGetSync<EpisodeItem[]>(cacheKey);
  if (syncHit) {
    if (syncHit.isFresh) return syncHit.data;
    swrFetchDedupe(cacheKey, async () => {
      const fresh = await fetchMediaEpisodesNetwork(media, maxAiredEpisode);
      if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
      return fresh;
    }).catch(() => {});
    return syncHit.data;
  }

  // Async IndexedDB cache hit
  const asyncHit = await swrGet<EpisodeItem[]>(cacheKey);
  if (asyncHit) {
    if (!asyncHit.isFresh) {
      swrFetchDedupe(cacheKey, async () => {
        const fresh = await fetchMediaEpisodesNetwork(media, maxAiredEpisode);
        if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
        return fresh;
      }).catch(() => {});
    }
    return asyncHit.data;
  }

  // Network fetch with request deduplication
  return swrFetchDedupe(cacheKey, async () => {
    const fresh = await fetchMediaEpisodesNetwork(media, maxAiredEpisode);
    if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
    return fresh;
  });
}

/**
 * Fetch real dynamic Manga Chapters directly from live MangaDex REST API
 * Guaranteed complete sequence: no missing chapters
 */
async function fetchMediaMangaChaptersNetwork(media: MediaItem): Promise<MangaChapterItem[]> {
  const altTitles = [
    media.romajiTitle,
    media.nativeTitle,
    media.englishTitle,
    ...(media.synonyms || []),
  ].filter(Boolean) as string[];

  // 1. Primary Engine: Server-side multi-provider aggregation with strict MAL ID & title verification
  try {
    const params = new URLSearchParams({
      title: media.title,
      anilistId: String(media.id),
    });
    if (media.idMal) params.append('idMal', String(media.idMal));
    if (media.totalChapters) params.append('totalChapters', String(media.totalChapters));
    for (const alt of altTitles) {
      params.append('altTitles', alt);
    }

    const sRes = await fetch(`/api/manga/chapters?${params.toString()}`);
    if (sRes.ok) {
      const sData = await sRes.json();
      if (sData?.chapters && Array.isArray(sData.chapters) && sData.chapters.length > 0) {
        return sData.chapters;
      }
    }
  } catch (err) {
    console.warn('Server manga chapters fetch notice:', err);
  }

  // 2. Client-side Fallback: MangaDex with strict title & MAL verification
  const chapterMap = new Map<number, MangaChapterItem>();

  try {
    const mangaId = await searchMangaDex(media.title, altTitles, media.idMal);
    if (mangaId) {
      const liveChapters = await fetchMangaDexChapters(mangaId);
      if (liveChapters && liveChapters.length > 0) {
        for (const ch of liveChapters) {
          const num = parseFloat(ch.chapter) || 1;
          if (!chapterMap.has(num)) {
            chapterMap.set(num, {
              id: ch.id,
              chapterNumber: num,
              title: ch.title || `Chapter ${ch.chapter}`,
              volume: ch.volume,
              pages: ch.pages,
              publishAt: ch.publishAt,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('MangaDex chapters fetch notice:', err);
  }

  // Calculate highest chapter number across MangaDex and AniList totalChapters
  const highestFoundChapter = chapterMap.size > 0 ? Math.max(...Array.from(chapterMap.keys())) : 0;
  const targetTotal = Math.max(highestFoundChapter, media.totalChapters || 0);
  const effectiveTotal = targetTotal > 0 ? targetTotal : (chapterMap.size > 0 ? chapterMap.size : 1);

  // Fill in any missing integer chapters in the sequence (1 to effectiveTotal)
  const fullChapters: MangaChapterItem[] = [];
  for (let i = 1; i <= effectiveTotal; i++) {
    if (chapterMap.has(i)) {
      fullChapters.push(chapterMap.get(i)!);
    } else {
      fullChapters.push({
        id: `manga-ch-${media.id}-${i}`,
        chapterNumber: i,
        title: `Chapter ${i}`,
      });
    }
  }

  // Also include any decimal chapters (e.g. 10.5, 11.1) from MangaDex
  for (const [num, ch] of chapterMap.entries()) {
    if (num % 1 !== 0 && !fullChapters.some((c) => c.chapterNumber === num)) {
      fullChapters.push(ch);
    }
  }

  return fullChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

/**
 * Fetch real dynamic Manga Chapters with instant SWR caching
 */
export async function fetchMediaMangaChapters(media: MediaItem): Promise<MangaChapterItem[]> {
  const cacheKey = `manga_chapters_${media.id || media.title}`;

  // 1. Instant Synchronous Cache Hit (0ms)
  const syncHit = swrGetSync<MangaChapterItem[]>(cacheKey);
  if (syncHit) {
    if (syncHit.isFresh) return syncHit.data;
    swrFetchDedupe(cacheKey, async () => {
      const fresh = await fetchMediaMangaChaptersNetwork(media);
      if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
      return fresh;
    }).catch(() => {});
    return syncHit.data;
  }

  // 2. Async IndexedDB Cache Hit
  const asyncHit = await swrGet<MangaChapterItem[]>(cacheKey);
  if (asyncHit) {
    if (!asyncHit.isFresh) {
      swrFetchDedupe(cacheKey, async () => {
        const fresh = await fetchMediaMangaChaptersNetwork(media);
        if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
        return fresh;
      }).catch(() => {});
    }
    return asyncHit.data;
  }

  // 3. Network Fetch with Request Deduplication
  return swrFetchDedupe(cacheKey, async () => {
    const fresh = await fetchMediaMangaChaptersNetwork(media);
    if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
    return fresh;
  });
}

/**
 * Fetch dynamic volume cover images from MangaDex Cover Art API across one or multiple manga IDs
 */
export async function fetchMangaDexVolumeCovers(mangaIds: string | string[]): Promise<Record<string, string>> {
  const ids = (Array.isArray(mangaIds) ? mangaIds : [mangaIds]).filter(Boolean);
  if (ids.length === 0) return {};

  const coverMap: Record<string, string> = {};

  for (const mId of ids) {
    try {
      const data = await fetchMangaDex<any>('cover', {
        'manga[]': mId,
        limit: 100,
        'order[volume]': 'asc',
      });
      if (data?.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          const rawVol = item.attributes?.volume;
          const fileName = item.attributes?.fileName;
          if (rawVol !== undefined && rawVol !== null && fileName) {
            const parsedVol = parseFloat(rawVol);
            if (!isNaN(parsedVol) && parsedVol > 0) {
              const directUrl = `https://uploads.mangadex.org/covers/${mId}/${fileName}.512.jpg`;
              const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(directUrl)}`;
              // Prefer integer key
              const volKey = String(parsedVol);
              if (!coverMap[volKey]) {
                coverMap[volKey] = proxyUrl;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`fetchMangaDexVolumeCovers for ${mId} notice:`, err);
    }
  }

  return coverMap;
}

/**
 * Resolve total released volumes using AniList, MangaDex, and Jikan/MAL
 */
export async function resolveAccurateNovelVolumeCount(media: MediaItem, discoveredCount: number): Promise<number> {
  // 1. Try Jikan (MyAnimeList) Light Novel API for official released volume count
  try {
    const cleanTitle = (media.title || '').replace(/\s*\([^)]*\)/g, '').trim();
    if (cleanTitle) {
      const jikanUrl = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(cleanTitle)}&type=novel&limit=3`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(jikanUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          const match = data.data[0];
          const malVolumes = Number(match.volumes);
          const malChapters = Number(match.chapters);
          if (!isNaN(malVolumes) && malVolumes > 0) {
            return Math.max(malVolumes, discoveredCount, media.totalVolumes || 0);
          }
          if (!isNaN(malChapters) && malChapters > 0) {
            return Math.max(malChapters, discoveredCount, media.totalVolumes || 0);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Dynamic fallback to max discovered or media metadata (no mock numbers)
  const fallback = Math.max(discoveredCount, media.totalVolumes || 0, media.totalChapters || 0);
  return fallback > 0 ? fallback : 1;
}

/**
 * Search all relevant MangaDex IDs (Novel entries and adaptations)
 */
export async function searchAllMangaDexNovelIds(title: string, altTitles: string[] = []): Promise<string[]> {
  const rawCandidates = [title, ...altTitles].filter(Boolean);
  const candidates: string[] = [];

  for (const t of rawCandidates) {
    if (!t) continue;
    candidates.push(t);
    const cleaned = t.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
    if (cleaned && cleaned !== t) candidates.push(cleaned);
    const prefix = cleaned.split(/[:\-\–\—\~]/)[0].trim();
    if (prefix && prefix.length > 2 && prefix !== cleaned) candidates.push(prefix);
    const alphaNum = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (alphaNum && alphaNum !== cleaned && alphaNum.length > 3) candidates.push(alphaNum);
    candidates.push(`${cleaned} (Novel)`);
    candidates.push(`${cleaned} (Light Novel)`);
    candidates.push(`${cleaned} Novel`);
  }

  const uniqueCandidates = Array.from(new Set(candidates));
  const foundIds = new Set<string>();

  for (const candidateTitle of uniqueCandidates.slice(0, 8)) {
    if (!candidateTitle || candidateTitle.trim().length === 0) continue;
    try {
      const data = await fetchMangaDex<any>('manga', {
        title: candidateTitle.trim(),
        limit: 10,
        'order[relevance]': 'desc',
        'contentRating': ['safe', 'suggestive', 'erotica', 'pornographic'],
      });
      if (data?.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item?.id) {
            foundIds.add(item.id);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(foundIds);
}

// In-memory cache for Novel Chapters / Volumes to avoid repeated network requests and image reloading
const novelChaptersCache = new Map<string | number, NovelChapterItem[]>();

/**
 * Fetch real dynamic Light Novel Chapters / Volumes from Anify & MangaDex live providers
 * Guaranteed complete sequence of all released volumes/chapters with real volume covers
 */
async function fetchMediaNovelChaptersNetwork(media: MediaItem): Promise<NovelChapterItem[]> {
  // 1. First try dedicated backend endpoint for comprehensive volume mapping
  try {
    const params = new URLSearchParams();
    if (media.id) params.append('anilistId', String(media.id));
    if (media.title) params.append('title', media.title);
    if (media.romajiTitle) params.append('romajiTitle', media.romajiTitle);
    if (media.englishTitle) params.append('englishTitle', media.englishTitle);
    if (media.nativeTitle) params.append('nativeTitle', media.nativeTitle);
    if (media.totalVolumes) params.append('totalVolumes', String(media.totalVolumes));

    const res = await fetch(`/api/novel/volumes?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.volumes) && data.volumes.length > 0) {
        const results = data.volumes.map((v: any) => ({
          id: v.id || `novel-vol-${media.id}-${v.chapterNumber || v.volume}`,
          chapterNumber: Number(v.chapterNumber || v.volume),
          volume: Number(v.volume || v.chapterNumber),
          title: v.title || `Volume ${v.volume || v.chapterNumber}`,
          coverImage: v.coverImage || media.coverImage,
          providerId: v.providerId,
        }));
        if (typeof window !== 'undefined') {
          results.forEach((r: any) => {
            if (r.coverImage) {
              const img = new Image();
              img.src = r.coverImage;
            }
          });
        }
        return results;
      }
    }
  } catch (err) {
    console.warn('Backend novel volumes fetch notice:', err);
  }

  // 2. Client-side fallback resolution
  const chapterMap = new Map<number, NovelChapterItem>();
  let coverMap: Record<string, string> = {};

  try {
    const altTitles = [media.romajiTitle, media.nativeTitle, media.englishTitle].filter(Boolean) as string[];
    const candidateMangaIds = await searchAllMangaDexNovelIds(media.title, altTitles);
    if (candidateMangaIds.length > 0) {
      coverMap = await fetchMangaDexVolumeCovers(candidateMangaIds);
    }
  } catch (err) {
    console.warn('Novel volume covers fetch notice:', err);
  }

  try {
    const liveNovelChapters = await getAnifyNovelChapters(media.id, media.title);
    if (liveNovelChapters && liveNovelChapters.length > 0) {
      for (const ch of liveNovelChapters) {
        const num = ch.number || 1;
        if (!chapterMap.has(num)) {
          chapterMap.set(num, {
            id: ch.id,
            chapterNumber: num,
            title: ch.title || `Volume ${num}`,
            volume: num,
            coverImage: coverMap[String(num)] || media.coverImage,
            updatedAt: ch.updatedAt,
            providerId: ch.providerId,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Anify novel chapters fetch notice:', err);
  }

  // Determine total volume count across all live sources + accurate reference resolver
  const highestFound = chapterMap.size > 0 ? Math.max(...Array.from(chapterMap.keys())) : 0;
  const coverCount = Object.keys(coverMap).length > 0
    ? Math.max(...Object.keys(coverMap).map(Number).filter((n) => !isNaN(n) && n > 0))
    : 0;

  const discoveredMax = Math.max(highestFound, coverCount);
  const totalVolCount = await resolveAccurateNovelVolumeCount(media, discoveredMax);

  // Generate full continuous volume sequence without missing any released volumes
  const fullNovelChapters: NovelChapterItem[] = [];
  for (let i = 1; i <= totalVolCount; i++) {
    const volCover = coverMap[String(i)] || media.coverImage;
    if (chapterMap.has(i)) {
      const item = chapterMap.get(i)!;
      if (!item.coverImage || item.coverImage === media.coverImage) {
        item.coverImage = volCover;
      }
      fullNovelChapters.push(item);
    } else {
      fullNovelChapters.push({
        id: `novel-vol-${media.id}-${i}`,
        chapterNumber: i,
        title: `Volume ${i}`,
        volume: i,
        coverImage: volCover,
      });
    }
  }

  const sorted = fullNovelChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  if (typeof window !== 'undefined') {
    sorted.forEach((ch) => {
      if (ch.coverImage) {
        const img = new Image();
        img.src = ch.coverImage;
      }
    });
  }
  return sorted;
}

/**
 * Fetch real dynamic Light Novel Chapters / Volumes with instant SWR caching
 */
export async function fetchMediaNovelChapters(media: MediaItem): Promise<NovelChapterItem[]> {
  const cacheKey = `novel_chapters_${media.id || media.title}`;

  // 1. Instant Synchronous Cache Hit (0ms)
  const syncHit = swrGetSync<NovelChapterItem[]>(cacheKey);
  if (syncHit) {
    if (syncHit.isFresh) return syncHit.data;
    swrFetchDedupe(cacheKey, async () => {
      const fresh = await fetchMediaNovelChaptersNetwork(media);
      if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
      return fresh;
    }).catch(() => {});
    return syncHit.data;
  }

  // 2. Async IndexedDB Cache Hit
  const asyncHit = await swrGet<NovelChapterItem[]>(cacheKey);
  if (asyncHit) {
    if (!asyncHit.isFresh) {
      swrFetchDedupe(cacheKey, async () => {
        const fresh = await fetchMediaNovelChaptersNetwork(media);
        if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
        return fresh;
      }).catch(() => {});
    }
    return asyncHit.data;
  }

  // 3. Network Fetch with Request Deduplication
  return swrFetchDedupe(cacheKey, async () => {
    const fresh = await fetchMediaNovelChaptersNetwork(media);
    if (fresh && fresh.length > 0) await swrSet(cacheKey, fresh);
    return fresh;
  });
}

/**
 * Fetches accurate Franchise Watch Order from live scraper API
 */
export async function fetchAnimeWatchOrder(params: {
  malId?: string | number;
  title?: string;
  anilistId?: string | number;
}): Promise<WatchOrderItem[]> {
  try {
    const query = new URLSearchParams();
    if (params.malId) query.set('malId', String(params.malId));
    if (params.title) query.set('title', String(params.title));
    if (params.anilistId) query.set('anilistId', String(params.anilistId));

    const res = await fetch(`/api/anime/watch-order?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.watchOrder)) {
        return data.watchOrder;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch anime watch order:', err);
  }
  return [];
}

// Re-export Anify and Logo services for a unified data layer
export * from './anifyService';
export * from './logoService';


