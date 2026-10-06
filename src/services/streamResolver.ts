export type AnimeStreamServer = 'vidplay' | 'pahe' | 'koto';

export interface VideoStreamSource {
  url: string;
  rawUrl?: string;
  quality?: string;
  isM3U8?: boolean;
  server?: string;
  serverId?: string;
}

export interface SubtitleTrack {
  url: string;
  lang: string;
  label?: string;
  default?: boolean;
}

export interface ServerManifest {
  server: string;
  sources: VideoStreamSource[];
  embedUrl?: string;
  subtitles?: SubtitleTrack[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export interface ResolvedStreamPayload {
  success: boolean;
  servers: Record<AnimeStreamServer, ServerManifest>;
  activeServer: AnimeStreamServer;
  sources: VideoStreamSource[];
  embedUrl?: string;
  subtitles?: SubtitleTrack[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export const SERVER_METADATA: Record<
  AnimeStreamServer,
  { name: string; tag: string; desc: string; description?: string }
> = {
  vidplay: {
    name: 'Vidplay',
    tag: 'Primary CDN',
    desc: 'Fast HLS Adaptive Stream',
    description: 'Fast HLS Adaptive Stream',
  },
  pahe: {
    name: 'Pahe',
    tag: 'Secondary Mirror',
    desc: 'High Quality Stream',
    description: 'High Quality Stream',
  },
  koto: {
    name: 'Koto',
    tag: 'Tertiary Mirror',
    desc: 'Ultra 1080p Stream',
    description: 'Ultra 1080p Stream',
  },
};

export async function resolveStreamWithFallbacks(
  anilistId: string | number,
  episodeNumber: number,
  title: string,
  audioTrack: 'sub' | 'dub' = 'sub',
  preferredServer: AnimeStreamServer = 'vidplay'
): Promise<ResolvedStreamPayload> {
  try {
    const params = new URLSearchParams({
      anilistId: String(anilistId),
      episode: String(episodeNumber),
      title: title || '',
      subType: audioTrack,
      server: preferredServer,
    });

    const res = await fetch(`/api/anime/sources?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.servers) {
        const activeManifest =
          data.servers[preferredServer] || data.servers.vidplay || Object.values(data.servers)[0];
        return {
          success: true,
          servers: data.servers,
          activeServer: (data.activeServer as AnimeStreamServer) || preferredServer,
          sources: activeManifest?.sources || [],
          embedUrl: activeManifest?.embedUrl,
          subtitles: activeManifest?.subtitles || [],
          intro: activeManifest?.intro,
          outro: activeManifest?.outro,
        };
      }
    }
  } catch (err) {
    console.warn('[streamResolver] Failed to fetch server sources, falling back to direct embed:', err);
  }

  // Fallback direct embed manifest if server endpoint fails
  const fallbackEmbeds: Record<AnimeStreamServer, string> = {
    vidplay: `https://vidsrc.me/embed/anime?anilist=${anilistId}&ep=${episodeNumber}`,
    pahe: `https://www.2embed.cc/embed/anime/${anilistId}/${episodeNumber}`,
    koto: `https://vidsrc.pm/embed/anime/${anilistId}/${episodeNumber}`,
  };

  const fallbackServers: Record<AnimeStreamServer, ServerManifest> = {
    vidplay: {
      server: 'vidplay',
      sources: [],
      embedUrl: fallbackEmbeds.vidplay,
      subtitles: [{ url: '', lang: 'English', label: 'English [CC]', default: true }],
    },
    pahe: {
      server: 'pahe',
      sources: [],
      embedUrl: fallbackEmbeds.pahe,
      subtitles: [{ url: '', lang: 'English', label: 'English [CC]', default: true }],
    },
    koto: {
      server: 'koto',
      sources: [],
      embedUrl: fallbackEmbeds.koto,
      subtitles: [{ url: '', lang: 'English', label: 'English [CC]', default: true }],
    },
  };

  return {
    success: true,
    servers: fallbackServers,
    activeServer: preferredServer,
    sources: [],
    embedUrl: fallbackEmbeds[preferredServer],
    subtitles: [{ url: '', lang: 'English', label: 'English [CC]', default: true }],
  };
}
