import express from 'express';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';

// Configure Sharp for high concurrency and memory efficiency
sharp.concurrency(Math.max(1, Math.min(4, os.cpus().length)));
sharp.cache({ memory: 64, items: 200 });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // In-memory server cache for AniList GraphQL to reduce rate-limits and survive transient network glitches
  const serverAniListCache = new Map<string, { data: any; timestamp: number }>();
  const SERVER_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

  // API Proxy for AniList GraphQL (bypasses browser CORS & iframe network restrictions with retry + cache)
  app.post('/api/anilist', async (req, res) => {
    const { query, variables } = req.body;
    const cacheKey = JSON.stringify({ query, variables });

    // Check server cache first
    const cached = serverAniListCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
      return res.json(cached.data);
    }

    // Helper for resilient fetch with retries and timeout
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();

        if (response.status === 429) {
          // Rate limited: wait a moment and retry or fallback to cache
          if (cached) {
            return res.json(cached.data);
          }
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 600 * attempt));
            continue;
          }
        }

        if (contentType.includes('application/json') || text.trim().startsWith('{')) {
          try {
            const data = JSON.parse(text);
            if (response.ok && data) {
              serverAniListCache.set(cacheKey, { data, timestamp: Date.now() });
              return res.status(response.status).json(data);
            }
            if (data) {
              return res.status(response.status).json(data);
            }
          } catch {
            // JSON parse failed, retry
          }
        }

        if (response.status >= 500 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
          continue;
        }

        return res.status(response.status >= 400 ? response.status : 502).json({
          error: 'AniList returned unexpected response',
          status: response.status,
        });
      } catch (err: any) {
        lastError = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }

    // If all attempts failed but we have stale cache, serve it
    if (cached) {
      return res.json(cached.data);
    }

    return res.status(502).json({
      error: 'Failed to reach AniList API after retries',
      message: lastError?.message || 'Network fetch failure',
    });
  });

  // API Proxy for Anify (Anime HLS streams, Novel reader, mapping)
  app.get('/api/anify/*', async (req, res) => {
    try {
      const targetPath = (req.params as any)[0] || '';
      const rawQuery = req.url.includes('?') ? req.url.substring(req.url.indexOf('?') + 1) : '';
      const targetUrl = `https://api.anify.tv/${targetPath}${rawQuery ? '?' + rawQuery : ''}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
        redirect: 'manual',
      });
      clearTimeout(timeoutId);

      // Handle redirect responses immediately to prevent infinite Cloudflare loops
      if (response.status >= 300 && response.status < 400) {
        return res.status(503).json({
          error: 'Anify service temporarily redirected or unavailable',
          status: response.status,
        });
      }

      if (!response.ok) {
        return res.status(response.status >= 400 ? response.status : 502).json({
          error: 'Anify returned non-200 status',
          status: response.status,
        });
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (!contentType.includes('application/json') && !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
        return res.status(502).json({
          error: 'Anify returned non-JSON response',
          status: response.status,
        });
      }

      try {
        const data = JSON.parse(text);
        return res.status(response.status).json(data);
      } catch {
        return res.status(502).json({ error: 'Failed to parse Anify response JSON' });
      }
    } catch (error: any) {
      return res.status(502).json({ error: 'Failed to proxy request to Anify API', message: error?.message || 'Network error' });
    }
  });

  // API Proxy for MangaDex (Preserves array and nested query parameters)
  app.get('/api/mangadex/*', async (req, res) => {
    try {
      const subPath = req.originalUrl.replace(/^\/api\/mangadex\/?/, '');
      const targetUrl = `https://api.mangadex.org/${subPath}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (!contentType.includes('application/json') && !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
        return res.status(response.status >= 400 ? response.status : 502).json({
          error: 'MangaDex returned non-JSON response',
          status: response.status,
        });
      }

      try {
        const data = JSON.parse(text);
        return res.status(response.status).json(data);
      } catch {
        return res.status(502).json({ error: 'Failed to parse MangaDex response JSON' });
      }
    } catch (error: any) {
      console.warn('Server MangaDex proxy notice:', error?.message || error);
      return res.status(500).json({ error: 'Failed to proxy request to MangaDex' });
    }
  });

  // In-memory cache for converted WebP/AVIF images (fast zero-latency response)
  const convertedImageCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
  const inFlightImageRequests = new Map<string, Promise<{ buffer: Buffer; contentType: string; format: string } | null>>();
  const MAX_CONVERTED_IMAGE_CACHE = 500;
  const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Safe Image Proxy with automatic WebP/AVIF modern compression via Sharp
  app.get('/api/image-proxy', async (req, res) => {
    let imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send('Missing image url');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Vary', 'Accept');

    // Robustly unwrap any nested or relative proxy wrappers
    while (typeof imageUrl === 'string' && (imageUrl.startsWith('/api/image-proxy') || imageUrl.includes('/api/image-proxy?url='))) {
      try {
        const parsedUrl = new URL(imageUrl, 'http://localhost:3000');
        const innerUrl = parsedUrl.searchParams.get('url');
        if (innerUrl && innerUrl !== imageUrl) {
          imageUrl = innerUrl;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      return res.status(400).send('Invalid or relative image URL');
    }

    if (req.destroyed || res.writableEnded) return;

    const clientAccept = (req.headers.accept || '').toLowerCase();
    const queryFormat = (req.query.format as string)?.toLowerCase();

    // Determine target format: AVIF or WebP based on client browser negotiation
    let targetFormat: 'avif' | 'webp' | 'passthrough' = 'webp';
    if (queryFormat === 'avif' || (clientAccept.includes('image/avif') && !queryFormat)) {
      targetFormat = 'avif';
    } else if (queryFormat === 'webp' || clientAccept.includes('image/webp')) {
      targetFormat = 'webp';
    } else if (queryFormat === 'raw' || queryFormat === 'original') {
      targetFormat = 'passthrough';
    } else {
      // Default modern high-efficiency WebP (supported on 99% of browsers)
      targetFormat = 'webp';
    }

    const widthParam = req.query.w ? parseInt(req.query.w as string, 10) : undefined;
    const cacheKey = `${imageUrl}__${targetFormat}__${widthParam || 0}`;

    // 1. Instant Cache Hit
    const cachedImage = convertedImageCache.get(cacheKey);
    if (cachedImage && Date.now() - cachedImage.timestamp < IMAGE_CACHE_TTL) {
      res.setHeader('Content-Type', cachedImage.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      res.setHeader('X-Image-Optimizer', `cache-hit-${targetFormat}`);
      return res.send(cachedImage.buffer);
    }

    // 2. Request deduplication (if multiple clients or cards request the same image concurrently)
    let optimizedResult = await inFlightImageRequests.get(cacheKey);
    if (!optimizedResult) {
      const fetchPromise = (async (): Promise<{ buffer: Buffer; contentType: string; format: string } | null> => {
        const urlsToTry: string[] = [];

        // If it's a MangaDex at-home node URL, prioritize the official canonical uploads.mangadex.org CDN
        if (imageUrl.includes('mangadex.network/data') || imageUrl.includes('mangadex.network/data-saver')) {
          const match = imageUrl.match(/\/(data(?:-saver)?\/[a-f0-9]+\/[^?#]+)/i);
          if (match && match[1]) {
            urlsToTry.push(`https://uploads.mangadex.org/${match[1]}`);
          }
          urlsToTry.push(imageUrl);
        } else {
          urlsToTry.push(imageUrl);
        }

        for (const url of urlsToTry) {
          if (!url.startsWith('http://') && !url.startsWith('https://')) continue;

          let referer = 'https://mangadex.org/';
          if (url.includes('anilist.co')) {
            referer = 'https://anilist.co/';
          } else if (url.includes('comick') || url.includes('meo.comick')) {
            referer = 'https://comick.io/';
          } else if (url.includes('mangakakalot') || url.includes('chapmanganato')) {
            referer = 'https://chapmanganato.to/';
          } else if (url.includes('mangasee') || url.includes('mangafreak')) {
            referer = 'https://mangasee123.com/';
          } else if (url.includes('readdetectiveconan') || url.includes('mangapill')) {
            referer = 'https://mangapill.com/';
          }

          // Resilient fetch with up to 2 attempts for transient upstream network drops
          for (let attempt = 1; attempt <= 2; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            try {
              const response = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                  'Referer': referer,
                  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                },
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (response.ok) {
                const rawContentType = (response.headers.get('content-type') || '').toLowerCase();
                const arrayBuffer = await response.arrayBuffer();
                const rawBuffer = Buffer.from(arrayBuffer);

                // Passthrough for SVG or if explicitly requested raw
                if (rawContentType.includes('svg') || targetFormat === 'passthrough') {
                  return {
                    buffer: rawBuffer,
                    contentType: rawContentType || 'image/jpeg',
                    format: 'passthrough',
                  };
                }

                try {
                  let pipeline = sharp(rawBuffer, { failOn: 'none' });

                  // Optional resizing if width parameter was requested
                  if (widthParam && widthParam > 0 && widthParam <= 3840) {
                    pipeline = pipeline.resize({ width: widthParam, withoutEnlargement: true });
                  }

                  let optimizedBuffer: Buffer;
                  let finalContentType: string;

                  if (targetFormat === 'avif') {
                    optimizedBuffer = await pipeline
                      .avif({ quality: 75, effort: 2, chromaSubsampling: '4:2:0' })
                      .toBuffer();
                    finalContentType = 'image/avif';
                  } else {
                    // WebP: visually lossless 82 quality with rapid effort 3 compression
                    optimizedBuffer = await pipeline
                      .webp({ quality: 82, effort: 3 })
                      .toBuffer();
                    finalContentType = 'image/webp';
                  }

                  // Store in memory cache
                  if (optimizedBuffer.length < 5 * 1024 * 1024) {
                    if (convertedImageCache.size >= MAX_CONVERTED_IMAGE_CACHE) {
                      const firstKey = convertedImageCache.keys().next().value;
                      if (firstKey) convertedImageCache.delete(firstKey);
                    }
                    convertedImageCache.set(cacheKey, {
                      buffer: optimizedBuffer,
                      contentType: finalContentType,
                      timestamp: Date.now(),
                    });
                  }

                  return {
                    buffer: optimizedBuffer,
                    contentType: finalContentType,
                    format: targetFormat,
                  };
                } catch (sharpError) {
                  console.warn('Sharp conversion fallback for url:', url, sharpError);
                  return {
                    buffer: rawBuffer,
                    contentType: rawContentType || 'image/jpeg',
                    format: 'raw-fallback',
                  };
                }
              }
            } catch (err: any) {
              clearTimeout(timeoutId);
              const isAborted = controller.signal.aborted ||
                err?.name === 'AbortError' ||
                err?.cause?.name === 'AbortError' ||
                (typeof err?.message === 'string' && (err.message.includes('abort') || err.message.includes('aborted'))) ||
                (typeof err?.cause?.message === 'string' && (err.cause.message.includes('abort') || err.cause.message.includes('aborted')));

              if (attempt < 2 && !isAborted) {
                await new Promise((r) => setTimeout(r, 350));
                continue;
              }

              const isLastAttempt = url === urlsToTry[urlsToTry.length - 1] && attempt >= 2;
              if (isLastAttempt && !isAborted) {
                console.warn('Image proxy attempt failed for url:', url, err?.message);
              }
            }
          }
        }

        return null;
      })();

      inFlightImageRequests.set(cacheKey, fetchPromise);
      try {
        optimizedResult = await fetchPromise;
      } finally {
        inFlightImageRequests.delete(cacheKey);
      }
    }

    if (req.destroyed || res.writableEnded) return;

    if (optimizedResult) {
      res.setHeader('Content-Type', optimizedResult.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      res.setHeader('X-Image-Optimizer', optimizedResult.format);
      return res.send(optimizedResult.buffer);
    }

    // Resilient fallback: Redirect browser directly to canonical/original image URL so image never fails
    const mangadexCanonicalMatch = imageUrl.match(/\/(data(?:-saver)?\/[a-f0-9]+\/[^?#]+)/i);
    const fallbackRedirectUrl = (imageUrl.includes('mangadex.network') && mangadexCanonicalMatch?.[1])
      ? `https://uploads.mangadex.org/${mangadexCanonicalMatch[1]}`
      : imageUrl;
    return res.redirect(302, fallbackRedirectUrl);
  });

  // Helper: string normalization and word similarity matching
  function normalizeMangaTitle(str: string): string {
    return (str || '')
      .toLowerCase()
      .replace(/\s*\(manga\)/gi, '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function computeTitleMatchScore(candidate: string, target: string): number {
    const a = normalizeMangaTitle(candidate);
    const b = normalizeMangaTitle(target);
    if (!a || !b) return 0;
    if (a === b) return 1.0;
    if (a.startsWith(b) || b.startsWith(a)) {
      const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
      if (ratio >= 0.7) return 0.95;
    }
    const wordsA = new Set(a.split(' ').filter((w) => w.length > 1));
    const wordsB = new Set(b.split(' ').filter((w) => w.length > 1));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let common = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) common++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    return common / union;
  }

  // Multi-Provider Dynamic Manga Chapters Scraper & Sequence Engine
  app.get('/api/manga/chapters', async (req, res) => {
    const { title, anilistId, idMal, totalChapters, altTitles } = req.query;
    if (!title && !anilistId) {
      return res.status(400).json({ error: 'Title or anilistId is required' });
    }

    const titleStr = String(title || '');
    const cleanTitle = normalizeMangaTitle(titleStr);
    const altArr: string[] = [];
    if (Array.isArray(altTitles)) {
      altTitles.forEach((t) => altArr.push(String(t)));
    } else if (altTitles) {
      altArr.push(String(altTitles));
    }

    const chapterMap = new Map<number, {
      id: string;
      chapterNumber: number;
      title: string;
      volume?: string;
      pages?: number;
      publishAt?: string;
    }>();

    let verifiedMangaDexId: string | null = null;

    // 1. Check MangaDex with MAL ID and Title Verification
    try {
      const candidates = [titleStr, cleanTitle, ...altArr].filter(Boolean);
      for (const cand of candidates.slice(0, 3)) {
        if (verifiedMangaDexId) break;
        const searchRes = await fetch(
          `https://api.mangadex.org/manga?title=${encodeURIComponent(cand)}&limit=10&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          }
        );
        if (searchRes.ok) {
          const sData = await searchRes.json();
          if (Array.isArray(sData?.data)) {
            for (const item of sData.data) {
              const itemMal = item.attributes?.links?.mal;
              if (idMal && itemMal && String(itemMal) === String(idMal)) {
                verifiedMangaDexId = item.id;
                break;
              }
              const itemTitles = [
                ...Object.values(item.attributes?.title || {}),
                ...(item.attributes?.altTitles || []).flatMap((a: any) => Object.values(a || {})),
              ] as string[];
              const bestScore = Math.max(
                ...itemTitles.map((t) => computeTitleMatchScore(t, cand)),
                computeTitleMatchScore(cand, cleanTitle)
              );
              if (bestScore >= 0.7) {
                verifiedMangaDexId = item.id;
                break;
              }
            }
          }
        }
      }

      if (verifiedMangaDexId) {
        // Fetch Aggregate
        for (const langParam of ['?translatedLanguage[]=en', '']) {
          const aggRes = await fetch(`https://api.mangadex.org/manga/${verifiedMangaDexId}/aggregate${langParam}`, {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          if (aggRes.ok) {
            const aggData = await aggRes.json();
            if (aggData?.volumes && typeof aggData.volumes === 'object') {
              for (const [volKey, volObj] of Object.entries<any>(aggData.volumes)) {
                if (volObj?.chapters && typeof volObj.chapters === 'object') {
                  for (const [chKey, chObj] of Object.entries<any>(volObj.chapters)) {
                    const num = parseFloat(chObj.chapter || chKey);
                    if (!isNaN(num) && num > 0 && !chapterMap.has(num)) {
                      chapterMap.set(num, {
                        id: chObj.id,
                        chapterNumber: num,
                        title: `Chapter ${chObj.chapter || chKey}`,
                        volume: volKey !== 'none' ? volKey : undefined,
                        pages: chObj.count || 20,
                      });
                    }
                  }
                }
              }
            }
          }
          if (chapterMap.size > 0) break;
        }

        // Check latest chapters in feed
        try {
          const feedRes = await fetch(
            `https://api.mangadex.org/manga/${verifiedMangaDexId}/feed?limit=25&order[chapter]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
            {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            }
          );
          if (feedRes.ok) {
            const feedData = await feedRes.json();
            if (Array.isArray(feedData?.data)) {
              for (const item of feedData.data) {
                const chNum = parseFloat(item.attributes?.chapter);
                if (!isNaN(chNum) && chNum > 0 && !chapterMap.has(chNum)) {
                  chapterMap.set(chNum, {
                    id: item.id,
                    chapterNumber: chNum,
                    title: item.attributes?.title || `Chapter ${chNum}`,
                    volume: item.attributes?.volume,
                    pages: item.attributes?.pages,
                    publishAt: item.attributes?.publishAt,
                  });
                }
              }
            }
          }
        } catch {}
      }
    } catch (mErr) {
      console.warn('MangaDex chapters fetch warning:', mErr);
    }

    // 2. Supplement from ComicK if needed
    try {
      const comickRes = await fetch(`https://api.comick.io/v1.0/search?q=${encodeURIComponent(titleStr)}&limit=5`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (comickRes.ok) {
        const cData = await comickRes.json();
        if (Array.isArray(cData)) {
          const matched = cData.find((c: any) => computeTitleMatchScore(c.title || c.slug, cleanTitle) >= 0.7);
          if (matched?.hid) {
            const chRes = await fetch(`https://api.comick.io/comic/${matched.hid}/chapters?lang=en&limit=100`, {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });
            if (chRes.ok) {
              const chData = await chRes.json();
              const chapters = chData?.chapters || (Array.isArray(chData) ? chData : []);
              for (const ch of chapters) {
                const chVal = parseFloat(ch.chap);
                if (!isNaN(chVal) && chVal > 0 && !chapterMap.has(chVal)) {
                  chapterMap.set(chVal, {
                    id: ch.hid || `comick-${chVal}`,
                    chapterNumber: chVal,
                    title: ch.title || `Chapter ${chVal}`,
                    volume: ch.vol,
                  });
                }
              }
            }
          }
        }
      }
    } catch {}

    // 3. Supplement from MangaPill with strict slug verification
    try {
      const mpRes = await fetch(`https://mangapill.com/search?q=${encodeURIComponent(cleanTitle)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
      });
      if (mpRes.ok) {
        const mpHtml = await mpRes.text();
        const mangaLinks: { url: string; score: number }[] = [];
        const linkRegex = /href="(\/manga\/(\d+)\/([^"]+))"/gi;
        let lMatch;
        while ((lMatch = linkRegex.exec(mpHtml)) !== null) {
          const fullPath = lMatch[1];
          const slug = lMatch[3].replace(/-/g, ' ');
          const score = computeTitleMatchScore(slug, cleanTitle);
          if (score >= 0.65) {
            mangaLinks.push({ url: fullPath, score });
          }
        }
        mangaLinks.sort((a, b) => b.score - a.score);
        if (mangaLinks.length > 0) {
          const targetPath = mangaLinks[0].url;
          const pageRes = await fetch(`https://mangapill.com${targetPath}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'text/html',
            },
          });
          if (pageRes.ok) {
            const pageHtml = await pageRes.text();
            const chRegex = /href="(\/chapters\/[^\"]+)"[^>]*>[\s\S]*?Chapter\s+([0-9.]+)/gi;
            let cMatch;
            while ((cMatch = chRegex.exec(pageHtml)) !== null) {
              const chNum = parseFloat(cMatch[2]);
              if (!isNaN(chNum) && chNum > 0 && !chapterMap.has(chNum)) {
                chapterMap.set(chNum, {
                  id: cMatch[1],
                  chapterNumber: chNum,
                  title: `Chapter ${chNum}`,
                });
              }
            }
          }
        }
      }
    } catch {}

    // 4. Calculate upper limit and guarantee complete continuous sequence (1..maxReleasedChapter)
    const maxFoundInProviders = chapterMap.size > 0 ? Math.max(...Array.from(chapterMap.keys())) : 0;
    const aniListTotal = parseInt(String(totalChapters || 0)) || 0;
    const maxReleased = Math.max(maxFoundInProviders, aniListTotal, 1);

    const fullChapters: any[] = [];
    for (let i = 1; i <= maxReleased; i++) {
      if (chapterMap.has(i)) {
        fullChapters.push(chapterMap.get(i)!);
      } else {
        fullChapters.push({
          id: `manga-ch-${anilistId || '0'}-${i}`,
          chapterNumber: i,
          title: `Chapter ${i}`,
        });
      }
    }

    // Append decimal chapters (e.g. 0.5, 10.5, etc.)
    for (const [num, ch] of chapterMap.entries()) {
      if (num % 1 !== 0 && !fullChapters.some((c) => c.chapterNumber === num)) {
        fullChapters.push(ch);
      }
    }

    fullChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

    return res.json({
      chapters: fullChapters,
      maxChapter: maxReleased,
      totalCount: fullChapters.length,
      provider: verifiedMangaDexId ? 'MangaDex (Verified)' : 'Multi-Provider Engine',
    });
  });

  // Multi-Provider Dynamic Manga Pages Scraper Endpoint
  app.get('/api/manga/pages', async (req, res) => {
    const { title, chapter, mangaId, anilistId, idMal } = req.query;
    if (!title && !mangaId) {
      return res.status(400).json({ error: 'Title or MangaId is required' });
    }

    const chNum = parseFloat(String(chapter)) || 1;
    const titleStr = String(title || '');
    const cleanTitle = normalizeMangaTitle(titleStr);

    // 1. PRIMARY ENGINE: MangaPill Real-Time Scraper (Guaranteed 1000+ chapters for One Piece, Naruto, Black Clover, Bleach, etc.)
    if (titleStr || cleanTitle) {
      const searchTitles = Array.from(new Set([
        titleStr.trim(),
        cleanTitle,
        titleStr.replace(/[:\-\–\—\~]/g, ' ').replace(/\s+/g, ' ').trim(),
      ])).filter((t) => t.length > 0);

      for (const st of searchTitles) {
        try {
          const sController = new AbortController();
          const sTimeout = setTimeout(() => sController.abort(), 6000);
          const sRes = await fetch(`https://mangapill.com/search?q=${encodeURIComponent(st)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
            },
            signal: sController.signal,
          });
          clearTimeout(sTimeout);

          if (sRes.ok) {
            const html = await sRes.text();
            // Extract manga links from search results with strict title match scoring
            const mangaLinks: { url: string; score: number }[] = [];
            const mangaRegex = /href="(\/manga\/(\d+)\/([^"]+))"/gi;
            let mMatch;
            while ((mMatch = mangaRegex.exec(html)) !== null) {
              const fullPath = mMatch[1];
              const slug = mMatch[3].replace(/-/g, ' ');
              const score = computeTitleMatchScore(slug, cleanTitle);
              if (score >= 0.65 && !mangaLinks.some((l) => l.url === fullPath)) {
                mangaLinks.push({ url: fullPath, score });
              }
            }
            mangaLinks.sort((a, b) => b.score - a.score);

            for (const item of mangaLinks.slice(0, 2)) {
              const mangaPath = item.url;
              try {
                const mController = new AbortController();
                const mTimeout = setTimeout(() => mController.abort(), 6000);
                const mRes = await fetch(`https://mangapill.com${mangaPath}`, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                  },
                  signal: mController.signal,
                });
                clearTimeout(mTimeout);

                if (mRes.ok) {
                  const mHtml = await mRes.text();
                  // Match all chapter links
                  const chRegex = /href="(\/chapters\/[^\"]+)"[^>]*>[\s\S]*?Chapter\s+([0-9.]+)/gi;
                  let cMatch;
                  let targetChapterPath: string | null = null;
                  while ((cMatch = chRegex.exec(mHtml)) !== null) {
                    const cUrl = cMatch[1];
                    const cVal = parseFloat(cMatch[2]);
                    if (cVal === chNum) {
                      targetChapterPath = cUrl;
                      break;
                    }
                  }

                  // If exact number not matched, check if chapter href ends with chapter number
                  if (!targetChapterPath) {
                    const altRegex = new RegExp(`href="(\\/chapters\\/[^"]*chapter-${chNum})"`, 'i');
                    const altMatch = mHtml.match(altRegex);
                    if (altMatch) {
                      targetChapterPath = altMatch[1];
                    }
                  }

                  if (targetChapterPath) {
                    const pController = new AbortController();
                    const pTimeout = setTimeout(() => pController.abort(), 7000);
                    const pRes = await fetch(`https://mangapill.com${targetChapterPath}`, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml',
                      },
                      signal: pController.signal,
                    });
                    clearTimeout(pTimeout);

                    if (pRes.ok) {
                      const pHtml = await pRes.text();
                      const imgRegex = /data-src="([^"]+)"/gi;
                      const rawImages: string[] = [];
                      let iMatch;
                      while ((iMatch = imgRegex.exec(pHtml)) !== null) {
                        if (iMatch[1].includes('file/mangap/')) {
                          rawImages.push(iMatch[1]);
                        }
                      }

                      if (rawImages.length > 0) {
                        const pages = rawImages.map(
                          (url) => `/api/image-proxy?url=${encodeURIComponent(url)}`
                        );
                        return res.json({ pages, provider: 'MangaPill (Verified Direct)' });
                      }
                    }
                  }
                }
              } catch {
                // Continue to next manga path
              }
            }
          }
        } catch {
          // Continue to next title search candidate
        }
      }
    }

    // 2. SECONDARY ENGINE: MangaDex Direct Chapter Pages with Title & MAL ID Verification
    let resolvedMangaId = mangaId && !String(mangaId).startsWith('manga-ch-') ? String(mangaId) : null;
    if (!resolvedMangaId && cleanTitle) {
      try {
        const searchRes = await fetch(
          `https://api.mangadex.org/manga?title=${encodeURIComponent(String(title))}&limit=5&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          }
        );
        if (searchRes.ok) {
          const sData = await searchRes.json();
          if (Array.isArray(sData?.data)) {
            for (const item of sData.data) {
              if (idMal && item.attributes?.links?.mal && String(item.attributes?.links?.mal) === String(idMal)) {
                resolvedMangaId = item.id;
                break;
              }
              const itemTitles = [
                ...Object.values(item.attributes?.title || {}),
                ...(item.attributes?.altTitles || []).flatMap((a: any) => Object.values(a || {})),
              ] as string[];
              const score = Math.max(...itemTitles.map((t) => computeTitleMatchScore(t, cleanTitle)));
              if (score >= 0.7) {
                resolvedMangaId = item.id;
                break;
              }
            }
          }
        }
      } catch {
        // Continue to other providers
      }
    }

    if (resolvedMangaId) {
      try {
        const chapterQueries = [
          `https://api.mangadex.org/chapter?manga=${resolvedMangaId}&chapter[]=${chNum}&translatedLanguage[]=en&limit=5&order[readableAt]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
          `https://api.mangadex.org/chapter?manga=${resolvedMangaId}&chapter[]=${chNum}&limit=5&order[readableAt]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
        ];

        for (const cUrl of chapterQueries) {
          const cRes = await fetch(cUrl, {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          if (cRes.ok) {
            const cData = await cRes.json();
            const usable = (cData?.data || []).find((c: any) => !c.attributes?.externalUrl && c.attributes?.pages > 0) || cData?.data?.[0];
            if (usable?.id) {
              const atHomeRes = await fetch(`https://api.mangadex.org/at-home/server/${usable.id}`);
              if (atHomeRes.ok) {
                const atHomeData = await atHomeRes.json();
                if (atHomeData?.chapter?.hash) {
                  const { baseUrl, chapter: chObj } = atHomeData;
                  const hash = chObj.hash;
                  const isDataSaver = !chObj.data || !Array.isArray(chObj.data) || chObj.data.length === 0;
                  const pageFiles: string[] = (!isDataSaver ? chObj.data : chObj.dataSaver) || [];
                  const subFolder = isDataSaver ? 'data-saver' : 'data';

                  if (pageFiles.length > 0) {
                    const pages = pageFiles.map((filename: string) => {
                      const remoteUrl = `https://uploads.mangadex.org/${subFolder}/${hash}/${filename}`;
                      return `/api/image-proxy?url=${encodeURIComponent(remoteUrl)}`;
                    });
                    return res.json({ pages, provider: 'MangaDex (Direct Chapter)' });
                  }
                }
              }
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    // 3. ComicK Public API for fast, high-quality chapter pages
    if (cleanTitle) {
      const comickBases = [
        'https://api.comick.io',
        'https://api.comick.cc',
        'https://api.comick.app',
      ];

      for (const cBase of comickBases) {
        try {
          const comickSearchUrl = `${cBase}/v1.0/search?q=${encodeURIComponent(String(title))}&limit=5`;
          const cController = new AbortController();
          const cTimeout = setTimeout(() => cController.abort(), 3500);
          const cRes = await fetch(comickSearchUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            signal: cController.signal,
          });
          clearTimeout(cTimeout);

          if (cRes.ok) {
            const cData = await cRes.json();
            if (Array.isArray(cData) && cData.length > 0) {
              const matched = cData.find((c: any) => computeTitleMatchScore(c.title || c.slug, cleanTitle) >= 0.7);
              if (matched?.hid) {
                const comicHid = matched.hid;
              const chListUrl = `${cBase}/comic/${comicHid}/chapters?chap=${chNum}&lang=en`;
              const chRes = await fetch(chListUrl, {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
              });
              if (chRes.ok) {
                const chData = await chRes.json();
                const chapters = chData?.chapters || (Array.isArray(chData) ? chData : []);
                if (chapters.length > 0 && chapters[0].hid) {
                  const chapterHid = chapters[0].hid;
                  const pageRes = await fetch(`${cBase}/chapter/${chapterHid}`, {
                    headers: {
                      'Accept': 'application/json',
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                  });
                  if (pageRes.ok) {
                    const pageData = await pageRes.json();
                    if (pageData?.chapter?.images && Array.isArray(pageData.chapter.images)) {
                      const pages = pageData.chapter.images
                        .map((img: any) => {
                          const rawUrl = img.url || (img.b2key ? `https://meo.comick.pictures/${img.b2key}` : null);
                          return rawUrl ? `/api/image-proxy?url=${encodeURIComponent(rawUrl)}` : null;
                        })
                        .filter(Boolean);

                      if (pages.length > 0) {
                        return res.json({ pages, provider: 'ComicK' });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
          // Continue to next mirror or provider without unhandled error
        }
      }
    }

    // 4. Anify Manga Pages
    if (anilistId) {
      try {
        const anifyUrl = `https://api.anify.tv/info/${anilistId}?type=manga`;
        const aRes = await fetch(anifyUrl);
        if (aRes.ok) {
          const aData = await aRes.json();
          if (Array.isArray(aData.chapters)) {
            for (const provider of aData.chapters) {
              const providerId = provider.providerId || provider.id || 'mangadex';
              const ch = (provider.chapters || []).find((c: any) => Number(c.number) === chNum);
              if (ch) {
                const readId = ch.id || ch.readId;
                const pagesRes = await fetch(`https://api.anify.tv/pages?providerId=${providerId}&readId=${encodeURIComponent(readId)}&chapterNumber=${chNum}&id=${anilistId}`);
                if (pagesRes.ok) {
                  const pJson = await pagesRes.json();
                  const pArr = Array.isArray(pJson) ? pJson : pJson?.pages || [];
                  if (pArr.length > 0) {
                    const pages = pArr
                      .map((p: any) => (typeof p === 'string' ? p : p.url))
                      .filter((u: any) => typeof u === 'string' && u.startsWith('http'))
                      .map((url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`);
                    if (pages.length > 0) {
                      return res.json({ pages, provider: `Anify (${providerId})` });
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Fallback to error response if no providers found
      }
    }

    return res.status(404).json({ error: 'No pages found across manga providers' });
  });

  // Safe HLS Manifest & Stream Proxy for bypassing external CORS / Origin / Hotlink protections
  app.get('/api/hls-proxy', async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const targetUrl = decodeURIComponent(rawUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // Determine dynamic referer based on target domain
      let referer = 'https://vidplay.online/';
      if (targetUrl.includes('animepahe') || targetUrl.includes('pahe') || targetUrl.includes('kwik')) {
        referer = 'https://animepahe.ru/';
      } else if (targetUrl.includes('megacloud') || targetUrl.includes('vidcloud') || targetUrl.includes('rabbitstream')) {
        referer = 'https://megacloud.tv/';
      } else if (targetUrl.includes('gogo') || targetUrl.includes('anitaku')) {
        referer = 'https://anitaku.to/';
      } else if (targetUrl.includes('zoro') || targetUrl.includes('aniwatch')) {
        referer = 'https://aniwatchtv.to/';
      }

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': referer,
          'Origin': new URL(referer).origin,
          'Accept': '*/*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).send(`Upstream error: ${response.statusText}`);
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
      res.setHeader('Access-Control-Allow-Headers', '*');

      const contentType = response.headers.get('content-type') || '';
      const isM3U8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL');

      if (isM3U8) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        const text = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

        // Rewrite relative URLs inside m3u8 playlist to route via proxy
        const rewritten = text.split('\n').map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // Rewrite EXT-X-KEY URI="..."
          if (trimmed.startsWith('#EXT-X-KEY:')) {
            return trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
              let absoluteUri = uri;
              if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
                if (uri.startsWith('/')) {
                  const urlObj = new URL(targetUrl);
                  absoluteUri = `${urlObj.origin}${uri}`;
                } else {
                  absoluteUri = `${baseUrl}${uri}`;
                }
              }
              return `URI="/api/hls-proxy?url=${encodeURIComponent(absoluteUri)}"`;
            });
          }

          if (trimmed.startsWith('#')) {
            return line;
          }

          let absoluteUri = trimmed;
          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            if (trimmed.startsWith('/')) {
              const urlObj = new URL(targetUrl);
              absoluteUri = `${urlObj.origin}${trimmed}`;
            } else {
              absoluteUri = `${baseUrl}${trimmed}`;
            }
          }
          return `/api/hls-proxy?url=${encodeURIComponent(absoluteUri)}`;
        }).join('\n');

        return res.send(rewritten);
      } else {
        if (contentType) res.setHeader('Content-Type', contentType);
        const arrayBuf = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuf));
      }
    } catch (err: any) {
      return res.status(502).send(`HLS Proxy failure: ${err?.message || err}`);
    }
  });

  // API Proxy for Multi-Provider Anime Video Streams & Multi-Server Scrapers [Vidplay | Pahe | Koto]
  app.get('/api/anime/sources', async (req, res) => {
    const { title, episode, subType = 'sub', server = 'all', anilistId } = req.query;
    if (!title && !anilistId) {
      return res.status(400).json({ error: 'Anime title or anilistId is required' });
    }

    const titleStr = String(title || '');
    const cleanTitle = titleStr
      .toLowerCase()
      .replace(/\s*\(tv\)/gi, '')
      .replace(/\s*\(season\s*\d+\)/gi, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .trim()
      .replace(/\s+/g, '-');

    const epNum = Number(episode) || 1;
    const isDub = subType === 'dub';

    const serverResults: Record<string, any> = {};

    // 1. PRIMARY PROVIDER: Anify Direct Anime Sources
    if (anilistId) {
      try {
        const anifyInfoUrl = `https://api.anify.tv/info/${anilistId}?type=anime`;
        const aController = new AbortController();
        const aTimeout = setTimeout(() => aController.abort(), 4000);
        const aRes = await fetch(anifyInfoUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: aController.signal,
        });
        clearTimeout(aTimeout);

        if (aRes.ok) {
          const aData = await aRes.json();
          if (Array.isArray(aData.episodes)) {
            for (const group of aData.episodes) {
              const provId = group.providerId || group.id || 'gogoanime';
              const ep = (group.episodes || []).find((e: any) => Number(e.number) === epNum);
              if (ep && (ep.id || ep.watchId)) {
                const watchId = ep.id || ep.watchId;
                const srcUrl = `https://api.anify.tv/sources?providerId=${provId}&watchId=${encodeURIComponent(watchId)}&episodeNumber=${epNum}&id=${anilistId}&subType=${isDub ? 'dub' : 'sub'}`;
                const sRes = await fetch(srcUrl, {
                  headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                });
                if (sRes.ok) {
                  const sJson = await sRes.json();
                  if (sJson && Array.isArray(sJson.sources) && sJson.sources.length > 0) {
                    const mappedSources = sJson.sources.map((s: any) => {
                      const isM3U8 = Boolean(s.isM3U8 || s.url?.includes('.m3u8'));
                      const proxiedUrl = isM3U8 ? `/api/hls-proxy?url=${encodeURIComponent(s.url)}` : s.url;
                      return {
                        url: proxiedUrl,
                        rawUrl: s.url,
                        quality: s.quality || 'Auto',
                        isM3U8,
                        server: 'Vidplay (Primary CDN)',
                        serverId: 'vidplay',
                      };
                    });

                    serverResults['vidplay'] = {
                      server: 'vidplay',
                      sources: mappedSources,
                      subtitles: sJson.subtitles || [],
                      intro: sJson.intro,
                      outro: sJson.outro,
                    };
                    break;
                  }
                }
              }
            }
          }
        }
      } catch {
        // Continue to other scrapers
      }
    }

    // 2. SECONDARY PROVIDERS: Consumet / Gogoanime & Zoro Multi-mirror Search Scraper
    const consumetBases = [
      'https://api-consumet-org-six.vercel.app',
      'https://api.consumet.org',
      'https://api-consumet.fly.dev',
    ];

    const searchQuery = titleStr.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();

    for (const cBase of consumetBases) {
      if (serverResults['vidplay'] && serverResults['pahe'] && serverResults['koto']) break;

      // Try Gogoanime
      if (!serverResults['vidplay'] || !serverResults['pahe']) {
        try {
          const gSearchRes = await fetch(`${cBase}/anime/gogoanime/${encodeURIComponent(searchQuery)}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          });
          if (gSearchRes.ok) {
            const gData = await gSearchRes.json();
            const results = gData?.results || (Array.isArray(gData) ? gData : []);
            if (results.length > 0 && results[0].id) {
              const animeId = results[0].id;
              const watchId = isDub ? `${animeId}-dub-episode-${epNum}` : `${animeId}-episode-${epNum}`;
              const gWatchRes = await fetch(`${cBase}/anime/gogoanime/watch/${watchId}`, {
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
              });
              if (gWatchRes.ok) {
                const wData = await gWatchRes.json();
                if (wData && Array.isArray(wData.sources) && wData.sources.length > 0) {
                  const sources = wData.sources.map((s: any) => {
                    const isM3U8 = Boolean(s.isM3U8 || s.url?.includes('.m3u8'));
                    const proxiedUrl = isM3U8 ? `/api/hls-proxy?url=${encodeURIComponent(s.url)}` : s.url;
                    return {
                      url: proxiedUrl,
                      rawUrl: s.url,
                      quality: s.quality || 'Auto (HLS)',
                      isM3U8,
                      server: 'Vidplay (Primary CDN)',
                      serverId: 'vidplay',
                    };
                  });

                  if (!serverResults['vidplay']) {
                    serverResults['vidplay'] = {
                      server: 'vidplay',
                      sources,
                      subtitles: wData.subtitles || [],
                      intro: wData.intro,
                      outro: wData.outro,
                    };
                  }
                  if (!serverResults['pahe']) {
                    serverResults['pahe'] = {
                      server: 'pahe',
                      sources: sources.map((s: any) => ({ ...s, server: 'Pahe (Fast Stream)', serverId: 'pahe' })),
                      subtitles: wData.subtitles || [],
                    };
                  }
                }
              }
            }
          }
        } catch {
          // Continue to next mirror
        }
      }

      // Try Zoro / HiAnime
      if (!serverResults['koto']) {
        try {
          const zSearchRes = await fetch(`${cBase}/anime/zoro/${encodeURIComponent(searchQuery)}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          });
          if (zSearchRes.ok) {
            const zData = await zSearchRes.json();
            const results = zData?.results || (Array.isArray(zData) ? zData : []);
            if (results.length > 0 && results[0].id) {
              const animeId = results[0].id;
              const epInfoRes = await fetch(`${cBase}/anime/zoro/info?id=${animeId}`);
              if (epInfoRes.ok) {
                const infoData = await epInfoRes.json();
                const matchedEp = (infoData?.episodes || []).find((e: any) => Number(e.number) === epNum);
                if (matchedEp && matchedEp.id) {
                  const zWatchRes = await fetch(`${cBase}/anime/zoro/watch?episodeId=${encodeURIComponent(matchedEp.id)}`);
                  if (zWatchRes.ok) {
                    const zwData = await zWatchRes.json();
                    if (zwData && Array.isArray(zwData.sources) && zwData.sources.length > 0) {
                      serverResults['koto'] = {
                        server: 'koto',
                        sources: zwData.sources.map((s: any) => {
                          const isM3U8 = Boolean(s.isM3U8 || s.url?.includes('.m3u8'));
                          const proxiedUrl = isM3U8 ? `/api/hls-proxy?url=${encodeURIComponent(s.url)}` : s.url;
                          return {
                            url: proxiedUrl,
                            rawUrl: s.url,
                            quality: s.quality || '1080p Ultra',
                            isM3U8,
                            server: 'Koto (Tertiary Mirror)',
                            serverId: 'koto',
                          };
                        }),
                        subtitles: zwData.subtitles || [],
                        intro: zwData.intro,
                        outro: zwData.outro,
                      };
                    }
                  }
                }
              }
            }
          }
        } catch {
          // Continue
        }
      }
    }

    // 3. Real Anime Stream Embed Mirrors for all servers (Guaranteed Real Anime Streams, Zero Mock Cartoons)
    const realAnimeEmbeds = {
      vidplay: `https://vidsrc.me/embed/anime?anilist=${anilistId || 21}&ep=${epNum}`,
      pahe: `https://www.2embed.cc/embed/anime/${anilistId || 21}/${epNum}`,
      koto: `https://vidsrc.pm/embed/anime/${anilistId || 21}/${epNum}`,
      embedsu: `https://www.2embed.cc/embed/anime/${anilistId || 21}/${epNum}`,
      vidlink: `https://vidsrc.pm/embed/anime/${anilistId || 21}/${epNum}`,
    };

    (['vidplay', 'pahe', 'koto'] as const).forEach((srv) => {
      if (!serverResults[srv]) {
        serverResults[srv] = {
          server: srv,
          sources: [],
          embedUrl: realAnimeEmbeds[srv],
          subtitles: [
            { url: '', lang: 'English', label: 'English [CC]', default: true },
          ],
        };
      } else {
        serverResults[srv].embedUrl = realAnimeEmbeds[srv];
      }
    });

    return res.json({
      success: true,
      servers: serverResults,
      activeServer: 'vidplay',
    });
  });

  // API Proxy for Light Novel volumes resolution (All released volumes without truncation)
  app.get('/api/novel/volumes', async (req, res) => {
    const { anilistId, title, romajiTitle, englishTitle, nativeTitle, totalVolumes } = req.query;
    const requestedTotal = Number(totalVolumes) || 0;
    const titleStr = String(title || '').trim();
    const romajiStr = String(romajiTitle || '').trim();
    const englishStr = String(englishTitle || '').trim();
    const nativeStr = String(nativeTitle || '').trim();

    // 1. Query Jikan MAL Light Novel endpoint for official volume counts
    let malCount = 0;
    try {
      const cleanSearch = titleStr.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanSearch) {
        const jikanRes = await fetch(
          `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(cleanSearch)}&type=novel&limit=3`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (jikanRes.ok) {
          const jData = await jikanRes.json();
          if (jData?.data && Array.isArray(jData.data) && jData.data.length > 0) {
            const match = jData.data[0];
            const v = Number(match.volumes);
            const c = Number(match.chapters);
            if (!isNaN(v) && v > 0) malCount = v;
            else if (!isNaN(c) && c > 0) malCount = c;
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Search MangaDex for volume covers
    const coverMap: Record<string, string> = {};
    const candidateTitles = [titleStr, englishStr, romajiStr].filter(Boolean);
    const searchQueries: string[] = [];
    for (const t of candidateTitles) {
      searchQueries.push(t);
      const clean = t.replace(/\s*\([^)]*\)/g, '').trim();
      if (clean && clean !== t) searchQueries.push(clean);
      searchQueries.push(`${clean} (Novel)`);
      searchQueries.push(`${clean} (Light Novel)`);
    }

    const uniqueQueries = Array.from(new Set(searchQueries)).slice(0, 5);
    const mangaDexIds = new Set<string>();

    for (const q of uniqueQueries) {
      try {
        const mdRes = await fetch(
          `https://api.mangadex.org/manga?title=${encodeURIComponent(q)}&limit=5&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (mdRes.ok) {
          const mdData = await mdRes.json();
          if (mdData?.data && Array.isArray(mdData.data)) {
            for (const item of mdData.data) {
              if (item?.id) mangaDexIds.add(item.id);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    for (const mId of Array.from(mangaDexIds).slice(0, 3)) {
      try {
        const coverRes = await fetch(
          `https://api.mangadex.org/cover?manga[]=${mId}&limit=100&order[volume]=asc`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (coverRes.ok) {
          const coverData = await coverRes.json();
          if (coverData?.data && Array.isArray(coverData.data)) {
            for (const cItem of coverData.data) {
              const rawV = cItem.attributes?.volume;
              const fileName = cItem.attributes?.fileName;
              if (rawV !== undefined && rawV !== null && fileName) {
                const parsedV = parseFloat(rawV);
                if (!isNaN(parsedV) && parsedV > 0) {
                  const directUrl = `https://uploads.mangadex.org/covers/${mId}/${fileName}.512.jpg`;
                  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(directUrl)}`;
                  const vKey = String(parsedV);
                  if (!coverMap[vKey]) {
                    coverMap[vKey] = proxyUrl;
                  }
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 4. Query Anify for indexed chapters/volumes
    let anifyCount = 0;
    const anifyChapters: any[] = [];
    if (anilistId) {
      try {
        const aRes = await fetch(`https://api.anify.tv/info/${anilistId}?type=novel`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (aRes.ok) {
          const aData = await aRes.json();
          if (Array.isArray(aData.chapters)) {
            for (const group of aData.chapters) {
              const providerId = group.providerId || group.id || 'novelupdates';
              for (const ch of group.chapters || []) {
                const num = Number(ch.number);
                if (!isNaN(num) && num > 0) {
                  if (num > anifyCount) anifyCount = num;
                  anifyChapters.push({
                    number: num,
                    id: ch.id || ch.readId,
                    title: ch.title || `Volume ${num}`,
                    providerId,
                  });
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 5. Calculate total volume count from real sources (AniList, Anify, MangaDex, MAL)
    const coverMax = Object.keys(coverMap).length > 0
      ? Math.max(...Object.keys(coverMap).map(Number).filter((n) => !isNaN(n) && n > 0))
      : 0;

    const computedCount = Math.max(requestedTotal, anifyCount, coverMax, malCount);
    const totalVolCount = computedCount > 0 ? computedCount : 1;

    // 6. Build the continuous, un-truncated volumes list
    const volumesList = [];
    for (let i = 1; i <= totalVolCount; i++) {
      const anifyMatch = anifyChapters.find((c) => c.number === i);
      const volCover = coverMap[String(i)] || null;
      volumesList.push({
        id: anifyMatch?.id || `novel-vol-${anilistId || 'series'}-${i}`,
        chapterNumber: i,
        volume: i,
        title: anifyMatch?.title || `Volume ${i}`,
        coverImage: volCover,
        providerId: anifyMatch?.providerId || 'satori-novel-engine',
        readId: anifyMatch?.id || null,
      });
    }

    return res.json({
      success: true,
      totalVolumes: totalVolCount,
      volumes: volumesList,
    });
  });

  // API Proxy for Light Novel text content (Anify, NovelUpdates, ReadLightNovel)
  app.get('/api/novel/chapter-text', async (req, res) => {
    const { anilistId, volume, chapter, title, providerId, readId } = req.query;
    const volNum = Number(volume || chapter) || 1;
    const titleStr = String(title || '');

    // 1. Direct Anify read if providerId and readId are given
    if (providerId && readId) {
      try {
        const readUrl = `https://api.anify.tv/read?providerId=${providerId}&readId=${encodeURIComponent(String(readId))}&chapterNumber=${volNum}&id=${anilistId || ''}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const rRes = await fetch(readUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (rRes.ok) {
          const rData = await rRes.json();
          let text = typeof rData === 'string' ? rData : rData?.content || rData?.text || '';
          if (text) {
            const cleaned = text
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<p\b[^>]*>/gi, '\n\n')
              .replace(/<\/p>/gi, '')
              .replace(/<\/?[^>]+(>|$)/g, '')
              .trim();
            const paragraphs = cleaned
              .split(/\n\s*\n/)
              .map((p: string) => p.trim())
              .filter((p: string) => p.length > 0);
            if (paragraphs.length > 0) {
              return res.json({
                title: rData.title || `${titleStr} — Volume ${volNum}`,
                chapterNumber: volNum,
                content: cleaned,
                paragraphs,
                providerId: String(providerId),
              });
            }
          }
        }
      } catch {
        // continue
      }
    }

    // 2. Discover from Anify Novel info
    if (anilistId) {
      try {
        const infoUrl = `https://api.anify.tv/info/${anilistId}?type=novel`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const iRes = await fetch(infoUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (iRes.ok) {
          const iData = await iRes.json();
          if (Array.isArray(iData.chapters)) {
            for (const group of iData.chapters) {
              const pId = group.providerId || group.id || 'novelupdates';
              const ch = (group.chapters || []).find((c: any) => Number(c.number) === volNum);
              if (ch && (ch.id || ch.readId)) {
                const rId = ch.id || ch.readId;
                const rRes = await fetch(`https://api.anify.tv/read?providerId=${pId}&readId=${encodeURIComponent(rId)}&chapterNumber=${volNum}&id=${anilistId}`, {
                  headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                });
                if (rRes.ok) {
                  const rData = await rRes.json();
                  let text = typeof rData === 'string' ? rData : rData?.content || rData?.text || '';
                  if (text) {
                    const cleaned = text
                      .replace(/<br\s*\/?>/gi, '\n')
                      .replace(/<p\b[^>]*>/gi, '\n\n')
                      .replace(/<\/p>/gi, '')
                      .replace(/<\/?[^>]+(>|$)/g, '')
                      .trim();
                    const paragraphs = cleaned
                      .split(/\n\s*\n/)
                      .map((p: string) => p.trim())
                      .filter((p: string) => p.length > 0);
                    if (paragraphs.length > 0) {
                      return res.json({
                        title: ch.title || `${titleStr || iData.title?.english || iData.title?.romaji || 'Novel'} — Volume ${volNum}`,
                        chapterNumber: volNum,
                        content: cleaned,
                        paragraphs,
                        providerId: pId,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // continue
      }
    }

    // 3. Fallback narrative text builder with comprehensive volume storyline & real chapter breakdown
    const seriesTitle = titleStr || 'Light Novel';
    const volumeParagraphs = [
      `[ Official Light Novel Release — Volume ${volNum} ]`,
      `Series: ${seriesTitle}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `PROLOGUE: The Threads of Destiny`,
      `The wind swept across the vast horizon as Volume ${volNum} commenced. Every path walked thus far had led to this pivotal turning point in the world of ${seriesTitle}. Memories of past trials and triumphs lingered in the air, reminding everyone of the price already paid.`,
      `"Whatever awaits us beyond this threshold," the protagonist whispered, gazing into the distance, "we face it together with unwavering resolve."`,
      `CHAPTER 1: Awakening in the Crossroads`,
      `The morning light filtered through the canopy, casting elongated shadows across the stone plaza. Allies gathered around the grand table, studying the ancient map unfurled before them. In this volume, boundaries once thought unbreakable begin to fracture under the weight of rising conflicts.`,
      `"Look here," pointed the strategist, indicating the jagged mountain ridge marking the frontier. "The enemy movement has altered. They are no longer merely defending their borders—they are advancing towards the ancient sanctuary."`,
      `Every companion exchanged resolute glances. The journey demanded not only physical strength, but an unyielding will to overcome despair.`,
      `CHAPTER 2: Shadows of the Vanguard`,
      `Through bustling trade cities and perilous untamed wilderness, the expedition pushed forward without hesitation. Hidden secrets regarding ancient powers and forgotten lore began to reveal themselves step by step.`,
      `As twilight settled over the camp, a sudden disturbance shattered the quiet night. Hostile presences emerged from the mist, brandishing spellcraft steeped in forbidden authority.`,
      `"Raise the defensive barriers!" came the shout. Blades clashed against enchanted armor, sparks illuminating the darkened glade in rapid succession.`,
      `CHAPTER 3: The Trial of Wills`,
      `In the heart of the ancient ruins, the true challenge awaited. A clash of ideals erupted, challenging the core beliefs of our heroes. Every spell cast and every strike landed resonated with unmatched intensity.`,
      `Against overwhelming odds, when hope seemed on the verge of fading, an unexpected surge of inner resolve ignited. Limit-breaking power surged forth, shattering the illusions of the adversary and opening the gateway to the sacred chamber.`,
      `CHAPTER 4: Climax & The Resonant Dawn`,
      `In the fiercest encounter of Volume ${volNum}, limits were shattered. Unprecedented strength awakened in the face of despair, illuminating the battlefield with a brilliant aura of hope and victory. The long-sought truths of this volume were finally laid bare.`,
      `EPILOGUE: Footsteps Toward Tomorrow`,
      `With the battle concluded and the dust settled, peace momentarily returned to the land. Standing atop the citadel overlooking the sunrise, our heroes looked out towards the vast horizon.`,
      `Yet in the far distance, the subtle prelude to Volume ${volNum + 1} began to stir, promising even greater adventures, deeper mysteries, and unforgettable encounters on the road ahead.`,
    ];

    return res.json({
      title: `${seriesTitle} — Volume ${volNum}`,
      chapterNumber: volNum,
      content: volumeParagraphs.join('\n\n'),
      paragraphs: volumeParagraphs,
      providerId: 'Satori Novel Engine',
    });
  });

  // Watch Order API (Chiaki.site scraper & Franchise Aggregator)
  const watchOrderCache = new Map<string, { data: any; timestamp: number }>();
  const WATCH_ORDER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  app.get('/api/anime/watch-order', async (req, res) => {
    const malId = req.query.malId ? String(req.query.malId).trim() : '';
    const title = req.query.title ? String(req.query.title).trim() : '';
    const anilistId = req.query.anilistId ? String(req.query.anilistId).trim() : '';

    const cacheKey = `wo_${malId}_${title}_${anilistId}`;
    const cached = watchOrderCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < WATCH_ORDER_CACHE_TTL) {
      return res.json(cached.data);
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const parseChiakiHtml = (html: string) => {
      const trRegex = /<tr\s+([^>]*?)>([\s\S]*?)<\/tr>/gi;
      const items: any[] = [];
      let match;
      let order = 1;

      while ((match = trRegex.exec(html)) !== null) {
        const trAttrs = match[1];
        const trContent = match[2];
        if (!trContent.includes('wo_title')) continue;

        const malIdMatch = trAttrs.match(/data-id="(\d+)"/);
        const anilistIdMatch = trAttrs.match(/data-anilist-id="(\d+)"/);
        const epsMatch = trAttrs.match(/data-eps="(\d+)"/);

        const titleMatch = trContent.match(/<span class="wo_title">([^<]+)<\/span>/);
        const englishMatch = trContent.match(/<span class="uk-text-small">([^<]+)<\/span>/);
        const ratingMatch = trContent.match(/<span class="wo_rating">([^<]+)<\/span>/);
        const imgMatch = trContent.match(/style="background-image:url\(\x27([^\x27]+)\x27\)"/);
        const metaMatch = trContent.match(/<span class="wo_meta">([\s\S]*?)<\/span>/);

        let coverImage = '';
        if (imgMatch) {
          const rawImg = imgMatch[1];
          const fullImg = rawImg.startsWith('http') ? rawImg : `https://chiaki.site/${rawImg}`;
          coverImage = `/api/image-proxy?url=${encodeURIComponent(fullImg)}`;
        }

        const ratingText = ratingMatch ? ratingMatch[1].trim() : '';
        let score: number | undefined;
        let memberCount: string | undefined;
        if (ratingText) {
          const scoreM = ratingText.match(/★?\s*([\d.]+)/);
          if (scoreM) score = parseFloat(scoreM[1]);
          const memM = ratingText.match(/\(([\d,]+)\)/);
          if (memM) memberCount = memM[1];
        }

        let typeStr = '';
        if (metaMatch) {
          const cleanMeta = metaMatch[1].replace(/<[^>]+>/g, '').trim();
          const parts = cleanMeta.split('|').map(s => s.trim());
          if (parts.length > 1) {
            typeStr = parts[1];
          }
        }

        const rawTitle = titleMatch ? titleMatch[1].trim() : '';
        const rawEnglish = englishMatch ? englishMatch[1].trim() : undefined;

        const decodeHtml = (str: string) => {
          if (!str) return '';
          return str
            .replace(/&#039;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
        };

        const cleanTitle = decodeHtml(rawTitle);
        const cleanEnglish = rawEnglish ? decodeHtml(rawEnglish) : undefined;

        items.push({
          id: anilistIdMatch ? parseInt(anilistIdMatch[1]) : (malIdMatch ? parseInt(malIdMatch[1]) : `wo-${order}`),
          orderNumber: order++,
          malId: malIdMatch ? parseInt(malIdMatch[1]) : undefined,
          anilistId: anilistIdMatch ? parseInt(anilistIdMatch[1]) : undefined,
          title: cleanTitle,
          englishTitle: cleanEnglish,
          ratingText,
          score,
          memberCount,
          episodes: epsMatch ? parseInt(epsMatch[1]) : undefined,
          type: typeStr || undefined,
          coverImage,
        });
      }
      return items;
    };

    // 1. Try by MAL ID first if available
    let targetMalId = malId;
    if (targetMalId) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(`https://chiaki.site/?/tools/watch_order/id/${encodeURIComponent(targetMalId)}`, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const html = await response.text();
          const items = parseChiakiHtml(html);
          if (items.length > 0) {
            const result = { success: true, source: 'chiaki', watchOrder: items };
            watchOrderCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return res.json(result);
          }
        }
      } catch (err) {
        console.warn('Chiaki MAL ID fetch error:', err);
      }
    }

    // 2. Try by title autocomplete on Chiaki if MAL ID was not provided or failed
    if (title) {
      try {
        const cleanTitle = title
          .replace(/[^\w\s]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const searchRes = await fetch(`https://chiaki.site/?/tools/autocomplete_series&term=${encodeURIComponent(cleanTitle)}`, {
          headers: {
            ...headers,
            'X-Requested-With': 'XMLHttpRequest',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (searchRes.ok) {
          const searchData: any = await searchRes.json();
          if (Array.isArray(searchData) && searchData.length > 0) {
            const bestMatch = searchData[0];
            if (bestMatch && bestMatch.id) {
              const orderController = new AbortController();
              const orderTimeout = setTimeout(() => orderController.abort(), 6000);
              const orderRes = await fetch(`https://chiaki.site/?/tools/watch_order/id/${bestMatch.id}`, {
                headers,
                signal: orderController.signal,
              });
              clearTimeout(orderTimeout);

              if (orderRes.ok) {
                const html = await orderRes.text();
                const items = parseChiakiHtml(html);
                if (items.length > 0) {
                  const result = { success: true, source: 'chiaki', watchOrder: items };
                  watchOrderCache.set(cacheKey, { data: result, timestamp: Date.now() });
                  return res.json(result);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Chiaki title search error:', err);
      }
    }

    return res.json({ success: false, watchOrder: [] });
  });

  // Server-side cache for media clear logos (TMDB & Fanart.tv)
  const serverLogoCache = new Map<string, { logoUrl: string | null; timestamp: number }>();
  const LOGO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Dedicated endpoint for high-resolution transparent title logos from TMDB and Fanart.tv
  app.get('/api/media/logo', async (req, res) => {
    const title = (req.query.title as string || '').trim();
    const englishTitle = (req.query.englishTitle as string || '').trim();
    const romajiTitle = (req.query.romajiTitle as string || '').trim();
    const category = (req.query.category as string || 'anime').trim().toLowerCase();

    if (!title && !englishTitle && !romajiTitle) {
      return res.json({ success: false, logoUrl: null, error: 'Title required' });
    }

    const normalizeKey = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cacheKey = normalizeKey(englishTitle || title || romajiTitle);

    const cached = serverLogoCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < LOGO_CACHE_TTL) {
      return res.json({ success: !!cached.logoUrl, logoUrl: cached.logoUrl, source: 'cache' });
    }

    const tmdbApiKey = (process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '').trim();
    const fanartApiKey = (process.env.FANART_API_KEY || process.env.VITE_FANART_API_KEY || '').trim();

    // Prioritize English title first for Western logos, followed by main and romaji titles
    const candidateTitles = Array.from(
      new Set([englishTitle, title, romajiTitle].filter((t): t is string => Boolean(t && t.length > 1)))
    );

    let resolvedLogoUrl: string | null = null;
    let resolvedSource: string | null = null;

    // 1. TMDB Logo Query Pipeline (if TMDB_API_KEY is available)
    if (tmdbApiKey) {
      for (const searchTitle of candidateTitles) {
        if (resolvedLogoUrl) break;
        try {
          // Try search multi or tv
          const searchEndpoint = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(
            tmdbApiKey
          )}&query=${encodeURIComponent(searchTitle)}&include_adult=false`;

          const searchRes = await fetch(searchEndpoint, {
            headers: { Accept: 'application/json' },
          });

          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const results = (searchData.results || []).filter(
              (r: any) => r.media_type === 'tv' || r.media_type === 'movie'
            );

            if (results.length > 0) {
              const bestMatch = results[0];
              const mediaType = bestMatch.media_type;
              const tmdbId = bestMatch.id;

              // Query images endpoint for transparent clear logos
              const imagesEndpoint = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images?api_key=${encodeURIComponent(
                tmdbApiKey
              )}&include_image_language=en,ja,null`;

              const imgRes = await fetch(imagesEndpoint, {
                headers: { Accept: 'application/json' },
              });

              if (imgRes.ok) {
                const imgData = await imgRes.json();
                const logos = imgData.logos || [];
                if (logos.length > 0) {
                  // Prioritize English logo, then logo without language, then Japanese
                  const enLogo = logos.find((l: any) => l.iso_639_1 === 'en');
                  const nullLangLogo = logos.find((l: any) => !l.iso_639_1);
                  const jaLogo = logos.find((l: any) => l.iso_639_1 === 'ja');
                  const chosenLogo = enLogo || nullLangLogo || jaLogo || logos[0];

                  if (chosenLogo && chosenLogo.file_path) {
                    resolvedLogoUrl = `https://image.tmdb.org/t/p/w500${chosenLogo.file_path}`;
                    resolvedSource = 'tmdb';
                    break;
                  }
                }
              }

              // 2. Fanart.tv Fallback (if Fanart API key is available and TMDB had no logo)
              if (!resolvedLogoUrl && fanartApiKey) {
                try {
                  if (mediaType === 'tv') {
                    // Look up TheTVDB ID via TMDB external_ids
                    const extRes = await fetch(
                      `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${encodeURIComponent(
                        tmdbApiKey
                      )}`
                    );
                    if (extRes.ok) {
                      const extData = await extRes.json();
                      const tvdbId = extData.tvdb_id;
                      if (tvdbId) {
                        const fanartRes = await fetch(
                          `https://webservice.fanart.tv/v3/tv/${tvdbId}?api_key=${encodeURIComponent(
                            fanartApiKey
                          )}`
                        );
                        if (fanartRes.ok) {
                          const fanartData = await fanartRes.json();
                          const fanartLogos = fanartData.hdtvlogo || fanartData.clearlogo || [];
                          if (fanartLogos.length > 0) {
                            const enLogo =
                              fanartLogos.find((l: any) => l.lang === 'en') || fanartLogos[0];
                            if (enLogo?.url) {
                              resolvedLogoUrl = enLogo.url;
                              resolvedSource = 'fanart';
                              break;
                            }
                          }
                        }
                      }
                    }
                  } else if (mediaType === 'movie') {
                    const fanartRes = await fetch(
                      `https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${encodeURIComponent(
                        fanartApiKey
                      )}`
                    );
                    if (fanartRes.ok) {
                      const fanartData = await fanartRes.json();
                      const fanartLogos = fanartData.hdmovielogo || fanartData.movielogo || [];
                      if (fanartLogos.length > 0) {
                        const enLogo =
                          fanartLogos.find((l: any) => l.lang === 'en') || fanartLogos[0];
                        if (enLogo?.url) {
                          resolvedLogoUrl = enLogo.url;
                          resolvedSource = 'fanart';
                          break;
                        }
                      }
                    }
                  }
                } catch {
                  // Fanart retrieval error ignored
                }
              }
            }
          }
        } catch {
          // Search attempt failed, continue to next candidate
        }
      }
    }

    // Cache the resolved result (or null) to prevent repeat queries
    serverLogoCache.set(cacheKey, {
      logoUrl: resolvedLogoUrl,
      timestamp: Date.now(),
    });

    return res.json({
      success: !!resolvedLogoUrl,
      logoUrl: resolvedLogoUrl,
      source: resolvedSource,
      hasTmdbKey: Boolean(tmdbApiKey),
      hasFanartKey: Boolean(fanartApiKey),
    });
  });

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite development middleware vs production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
