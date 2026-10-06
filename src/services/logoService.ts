const logoCache = new Map<string, string | null>();

export interface LogoFetchOptions {
  englishTitle?: string;
  romajiTitle?: string;
  category?: string;
  idMal?: number | string;
}

/**
 * Fetch transparent title logo (clearlogo / hdtvlogo) for Hero carousel
 * Queries TMDB (The Movie Database) and Fanart.tv via secure backend proxy
 */
export async function fetchMediaLogo(
  title: string,
  options?: LogoFetchOptions
): Promise<string | null> {
  const primaryTitle = (title || options?.englishTitle || options?.romajiTitle || '').trim();
  if (!primaryTitle) return null;

  const cacheKey = (options?.englishTitle || primaryTitle).toLowerCase().trim();
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) ?? null;
  }

  try {
    const params = new URLSearchParams();
    if (title) params.append('title', title.trim());
    if (options?.englishTitle) params.append('englishTitle', options.englishTitle.trim());
    if (options?.romajiTitle) params.append('romajiTitle', options.romajiTitle.trim());
    if (options?.category) params.append('category', options.category.trim());

    const res = await fetch(`/api/media/logo?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.logoUrl) {
        logoCache.set(cacheKey, data.logoUrl);
        return data.logoUrl;
      }
    }
  } catch (err) {
    // Graceful fallback to text title on network/fetch failure
  }

  logoCache.set(cacheKey, null);
  return null;
}
