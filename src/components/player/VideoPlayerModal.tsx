import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Play,
  Pause,
  Lock,
  Unlock,
  Keyboard,
  LayoutGrid,
  Grid2X2,
  Gauge,
  Maximize,
  Minimize,
  Maximize2,
  SkipForward,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Sliders,
  Tv,
  Server,
  Subtitles,
  Search,
  Radio,
  Zap,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import Hls from 'hls.js';
import { useApp } from '../../context/AppContext';
import { DotPulseLoader } from '../common/DotPulseLoader';
import { fetchMediaEpisodes } from '../../services/apiClient';
import {
  resolveStreamWithFallbacks,
  ResolvedStreamPayload,
  AnimeStreamServer,
  SERVER_METADATA,
  VideoStreamSource,
} from '../../services/streamResolver';
import { EpisodeItem } from '../../types';

type ActiveDrawer = 'subtitles' | 'episodes' | 'quality' | 'speed' | null;

export const VideoPlayerModal: React.FC = () => {
  const {
    activeVideoEpisode,
    setActiveVideoEpisode,
    settings,
    updateLibraryProgress,
    recordAnimeWatchProgress,
    showToast,
  } = useApp();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimestampRef = useRef<number>(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Landscape-first layout mode (defaults to true for widescreen anime streaming)
  const [landscapeFirst, setLandscapeFirst] = useState(true);
  const isScrubbingRef = useRef(false);

  // Auto-lock to landscape orientation on mount for landscape-first streaming
  useEffect(() => {
    if (window.screen && 'orientation' in window.screen) {
      const orientation = window.screen.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch(() => {});
      }
    }
    return () => {
      if (window.screen && 'orientation' in window.screen) {
        const orientation = window.screen.orientation as any;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        }
      }
    };
  }, []);

  // Drawers state
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');

  // Audio, Subtitle, Speed, Quality
  const [audioTrack, setAudioTrack] = useState<'sub' | 'dub'>('sub');
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('English');
  const [subtitleServerIndex, setSubtitleServerIndex] = useState<number>(1);
  const [audioServerIndex, setAudioServerIndex] = useState<number>(1);
  const [subDelayMs, setSubDelayMs] = useState<number>(0);
  const [showSubDelay, setShowSubDelay] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<string>(settings.playbackSpeed || '1.00x');
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto (HLS)');
  const [availableQualities, setAvailableQualities] = useState<string[]>([
    'Auto (HLS)',
    '1080p',
    '720p',
    '480p',
    '360p',
  ]);

  // Multi-Server Architecture State [Vidplay (Primary) | Pahe (Secondary) | Koto (Tertiary)]
  const [selectedServer, setSelectedServer] = useState<AnimeStreamServer>('vidplay');
  const [playerMode, setPlayerMode] = useState<'direct' | 'embed'>('direct');
  const [ambientLightEnabled, setAmbientLightEnabled] = useState<boolean>(settings.ambientLight || false);

  // Stream data from resolver
  const [streamData, setStreamData] = useState<ResolvedStreamPayload | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [isLoadingStream, setIsLoadingStream] = useState(true);

  // Exact Opening & Ending Skip Times (AniSkip database)
  const [aniSkipTimes, setAniSkipTimes] = useState<{
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function fetchAniSkip() {
      const malId = activeVideoEpisode?.media?.idMal || activeVideoEpisode?.media?.id;
      const epNum = activeVideoEpisode?.episodeNumber;
      if (!malId || !epNum) return;

      try {
        const res = await fetch(
          `https://api.aniskip.com/v2/skip-times/${malId}/${epNum}?types[]=op&types[]=ed&episodeLength=0`
        );
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.found && Array.isArray(json.results)) {
            const op = json.results.find((r: any) => r.skipType === 'op');
            const ed = json.results.find((r: any) => r.skipType === 'ed');
            setAniSkipTimes({
              intro: op ? { start: op.interval.startTime, end: op.interval.endTime } : undefined,
              outro: ed ? { start: ed.interval.startTime, end: ed.interval.endTime } : undefined,
            });
            return;
          }
        }
      } catch {
        // Ignore network errors silently
      }
      if (!isCancelled) {
        setAniSkipTimes(null);
      }
    }

    fetchAniSkip();
    return () => {
      isCancelled = true;
    };
  }, [activeVideoEpisode?.media?.idMal, activeVideoEpisode?.media?.id, activeVideoEpisode?.episodeNumber]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [liveEpisodes, setLiveEpisodes] = useState<EpisodeItem[]>([]);

  // Keep saved timestamp in sync
  useEffect(() => {
    savedTimestampRef.current = currentTime;
  }, [currentTime]);

  // Update library progress & anime watch history when opening episode
  useEffect(() => {
    if (activeVideoEpisode) {
      updateLibraryProgress(activeVideoEpisode.media.id, activeVideoEpisode.episodeNumber);
      recordAnimeWatchProgress(
        activeVideoEpisode.media,
        activeVideoEpisode.episodeNumber,
        currentTime,
        duration
      );
    }
  }, [activeVideoEpisode?.media.id, activeVideoEpisode?.episodeNumber]);

  // Load real aired episodes
  useEffect(() => {
    let isCancelled = false;
    async function loadEpisodes() {
      if (!activeVideoEpisode?.media) return;
      try {
        const eps = await fetchMediaEpisodes(activeVideoEpisode.media);
        if (!isCancelled && eps.length > 0) {
          setLiveEpisodes(eps);
        }
      } catch (err) {
        console.warn('Failed to fetch aired episodes:', err);
      }
    }
    loadEpisodes();
    return () => {
      isCancelled = true;
    };
  }, [activeVideoEpisode?.media?.id]);

  // Auto-request landscape fullscreen on open
  useEffect(() => {
    const triggerLandscapeMode = async () => {
      try {
        if (containerRef.current && !document.fullscreenElement) {
          await containerRef.current.requestFullscreen().catch(() => {});
        }
        if (window.screen && 'orientation' in window.screen) {
          const orientation = window.screen.orientation as any;
          if (orientation && typeof orientation.lock === 'function') {
            await orientation.lock('landscape').catch(() => {});
          }
        }
      } catch {
        // Safe fallback
      }
    };

    triggerLandscapeMode();

    return () => {
      try {
        if (window.screen && 'orientation' in window.screen) {
          const orientation = window.screen.orientation as any;
          if (orientation && typeof orientation.unlock === 'function') {
            orientation.unlock();
          }
        }
      } catch {}
    };
  }, []);

  // Fetch real stream sources across all servers
  useEffect(() => {
    let isCancelled = false;

    async function loadStream() {
      if (!activeVideoEpisode) return;
      setIsLoadingStream(true);
      setStreamError(null);

      try {
        const data = await resolveStreamWithFallbacks(
          activeVideoEpisode.media.id,
          activeVideoEpisode.episodeNumber,
          activeVideoEpisode.media.title,
          audioTrack,
          selectedServer
        );

        if (isCancelled) return;

        if (data && data.servers) {
          setStreamData(data);
          
          // Determine available qualities for active server
          const currentManifest = data.servers[selectedServer] || data.servers.vidplay;
          const currentSources = currentManifest?.sources || data.sources;

          if (currentSources.length > 0) {
            setPlayerMode('direct');
          } else {
            setPlayerMode('embed');
          }

          const distinctQualities = new Set<string>(['Auto (HLS)']);
          currentSources.forEach((s) => {
            if (s.quality && s.quality.toLowerCase() !== 'default') {
              const cleanQ = s.quality.replace(/[^0-9a-zA-Z]/g, '');
              const qStr = cleanQ.toLowerCase().includes('p') || cleanQ.toLowerCase() === 'auto'
                ? cleanQ
                : `${cleanQ}p`;
              distinctQualities.add(qStr);
            }
          });

          // Ensure standard resolution choices are always available
          ['1080p', '720p', '480p', '360p'].forEach((q) => distinctQualities.add(q));
          setAvailableQualities(Array.from(distinctQualities));
        } else {
          setPlayerMode('embed');
        }
      } catch (err: any) {
        if (!isCancelled) {
          setPlayerMode('embed');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingStream(false);
        }
      }
    }

    loadStream();

    return () => {
      isCancelled = true;
    };
  }, [activeVideoEpisode?.media?.id, activeVideoEpisode?.episodeNumber, audioTrack]);

  // Automatic Failover and Fallback Handler
  const triggerAutoFailover = useCallback(
    (reason: string) => {
      const currentPos = videoRef.current ? videoRef.current.currentTime : savedTimestampRef.current;
      savedTimestampRef.current = currentPos;

      // If direct stream fails, seamlessly failover to high-speed embed stream for the real anime!
      setPlayerMode('embed');
      showToast('Switched to Real Anime Mirror');

      // Clean up existing stall timer and HLS
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    },
    [showToast]
  );

  // Manual Server Switcher (preserves current timestamp)
  const handleServerSelect = (serverKey: AnimeStreamServer) => {
    if (serverKey === selectedServer) return;
    const currentPos = videoRef.current ? videoRef.current.currentTime : savedTimestampRef.current;
    savedTimestampRef.current = currentPos;

    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setSelectedServer(serverKey);
    setActiveSourceIndex(0);
    showToast(`Switched to ${SERVER_METADATA[serverKey].name} (${SERVER_METADATA[serverKey].tag})`);
  };

  // Mount video source and initialize HLS.js engine with manifest switching
  useEffect(() => {
    if (!videoRef.current || !streamData) return;

    const video = videoRef.current;
    const currentManifest = streamData.servers[selectedServer] || streamData.servers.vidplay;
    const currentSources = currentManifest?.sources || streamData.sources || [];
    
    if (currentSources.length === 0) return;

    const safeIndex = Math.min(activeSourceIndex, currentSources.length - 1);
    
    // Check if there is an exact manifest URL corresponding to the selected quality
    const cleanSelectedQ = selectedQuality.toLowerCase().replace(/[^0-9]/g, '');
    const matchingSource =
      selectedQuality !== 'Auto (HLS)' && cleanSelectedQ
        ? currentSources.find((s) => s.quality?.toLowerCase().replace(/[^0-9]/g, '') === cleanSelectedQ)
        : null;

    const activeSource: VideoStreamSource = matchingSource || currentSources[safeIndex] || currentSources[0];
    const streamUrl = activeSource.url;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const restoreTimestamp = () => {
      if (savedTimestampRef.current > 0 && video) {
        video.currentTime = savedTimestampRef.current;
      }
    };

    if (Hls.isSupported() && (activeSource.isM3U8 || streamUrl.includes('.m3u8'))) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        capLevelToPlayerSize: false,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferLength: 30,
        xhrSetup: (xhr, url) => {
          // Add CORS bypass if needed
          xhr.withCredentials = false;
        },
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (data.levels && data.levels.length > 0) {
          const parsedQualities = ['Auto (HLS)', ...data.levels.map((lvl) => `${lvl.height}p`)];
          const uniqueQualities = Array.from(new Set(parsedQualities)).sort((a, b) => {
            if (a.includes('Auto')) return -1;
            if (b.includes('Auto')) return 1;
            return parseInt(b) - parseInt(a);
          });
          setAvailableQualities(uniqueQualities);

          // Apply selected quality level
          if (selectedQuality === 'Auto (HLS)') {
            hls.currentLevel = -1; // Auto ABR
          } else {
            const targetHeight = parseInt(selectedQuality.replace(/[^0-9]/g, ''));
            const targetLevelIndex = data.levels.findIndex((lvl) => lvl.height === targetHeight);
            if (targetLevelIndex !== -1) {
              hls.currentLevel = targetLevelIndex;
            }
          }
        }

        restoreTimestamp();
        video.play().catch(() => {});
        setIsPlaying(true);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('Fatal network error in HLS, attempting recovery...', data);
              if (data.response?.code !== undefined && (data.response.code >= 400 || data.response.code === 0)) {
                // If it's a 404/500/CORS error, try failover
                triggerAutoFailover(`Network HTTP ${data.response.code || 'Error'}`);
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Media error in HLS, attempting recovery...', data);
              hls.recoverMediaError();
              break;
            default:
              console.warn('Unrecoverable HLS stream error, recovering...', data);
              hls.destroy();
              triggerAutoFailover('Unrecoverable stream error');
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !streamUrl.includes('.m3u8')) {
      // Native HLS support (Safari) or direct MP4/stream
      video.src = streamUrl;
      restoreTimestamp();
      video.onerror = () => {
        console.warn('Native video error event, attempting auto-failover...');
        triggerAutoFailover('Native video playback error');
      };
      video.play().catch(() => {});
      setIsPlaying(true);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamData, selectedServer, selectedQuality, activeSourceIndex, triggerAutoFailover]);

  // Handle dynamic resolution level change directly on active HLS instance
  const handleQualityChange = (quality: string) => {
    setSelectedQuality(quality);
    showToast(`Quality: ${quality}`);

    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      if (quality.includes('Auto')) {
        hlsRef.current.currentLevel = -1; // Adaptive Bitrate
      } else {
        const targetHeight = parseInt(quality.replace(/[^0-9]/g, ''));
        const levelIdx = hlsRef.current.levels.findIndex((lvl) => lvl.height === targetHeight);
        if (levelIdx !== -1) {
          hlsRef.current.currentLevel = levelIdx;
        }
      }
    }
  };

  // Sync volume, mute & speed to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
      const speedNum = parseFloat(playbackSpeed.replace('x', '')) || 1.0;
      videoRef.current.playbackRate = speedNum;
    }
  }, [volume, isMuted, playbackSpeed]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Controls auto-hide timer (3 seconds of inactivity)
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      // Auto-hide controls overlay after 3 seconds of inactivity
      if (!activeDrawer && !isLocked && !isScrubbingRef.current) {
        setShowControls(false);
      }
    }, 3000);
  }, [activeDrawer, isLocked]);

  // Start auto-hide timer on mount or episode change
  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimer, activeVideoEpisode?.episodeNumber]);

  // When drawer closes or opens, manage auto-hide timer
  useEffect(() => {
    if (!activeDrawer) {
      resetControlsTimer();
    } else {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
    }
  }, [activeDrawer, resetControlsTimer]);

  const handleScreenTap = () => {
    if (isLocked) {
      setShowUnlockPrompt(true);
      setTimeout(() => setShowUnlockPrompt(false), 3000);
      return;
    }

    if (activeDrawer) {
      setActiveDrawer(null);
      resetControlsTimer();
      return;
    }

    // Toggle controls on screen tap: re-appear on tap if hidden, or dismiss if already visible
    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      resetControlsTimer();
    }
  };

  const togglePlay = () => {
    if (isLocked) return;
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
    resetControlsTimer();
  };

  const handleSeek = (newTime: number) => {
    if (isLocked) return;
    setCurrentTime(newTime);
    savedTimestampRef.current = newTime;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    resetControlsTimer();
  };

  const handleRewind10 = () => {
    if (isLocked) return;
    handleSeek(Math.max(currentTime - 10, 0));
    showToast('-10s');
  };

  const handleForward10 = () => {
    if (isLocked) return;
    handleSeek(Math.min(currentTime + 10, duration || 1440));
    showToast('+10s');
  };

  const formatTime = (secs: number) => {
    const safeSecs = Math.max(0, isNaN(secs) ? 0 : secs);
    const m = Math.floor(safeSecs / 60);
    const s = Math.floor(safeSecs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Dynamic Opening (Intro) & Ending (Outro) calculation
  const currentManifest = streamData?.servers[selectedServer] || streamData?.servers.vidplay;
  const activeIntro = currentManifest?.intro || streamData?.intro || aniSkipTimes?.intro;
  const activeOutro = currentManifest?.outro || streamData?.outro || aniSkipTimes?.outro;

  const isWithinIntro = Boolean(
    activeIntro &&
    activeIntro.start !== undefined &&
    activeIntro.end !== undefined &&
    activeIntro.end > activeIntro.start &&
    currentTime >= activeIntro.start &&
    currentTime < activeIntro.end
  );

  const isWithinOutro = Boolean(
    activeOutro &&
    activeOutro.start !== undefined &&
    activeOutro.end !== undefined &&
    activeOutro.end > activeOutro.start &&
    currentTime >= activeOutro.start &&
    currentTime < activeOutro.end
  );

  // Show Skip Opening / Skip Outro ONLY when Opening or Outro is actively playing!
  const shouldShowSkipButton = isWithinIntro || isWithinOutro;
  const dynamicSkipLabel = isWithinIntro ? 'Skip Opening' : isWithinOutro ? 'Skip Outro' : '';

  const handleDynamicSkip = () => {
    if (isLocked) return;
    if (isWithinIntro && activeIntro) {
      handleSeek(activeIntro.end);
      showToast('Skipped Opening');
    } else if (isWithinOutro && activeOutro) {
      handleSeek(activeOutro.end);
      showToast('Skipped Outro');
    }
  };

  const toggleLock = () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    if (nextLocked) {
      setShowControls(false);
      setActiveDrawer(null);
      showToast('Screen Locked');
    } else {
      setShowControls(true);
      showToast('Screen Unlocked');
      resetControlsTimer();
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        if (window.screen && 'orientation' in window.screen) {
          const orientation = window.screen.orientation as any;
          if (orientation && typeof orientation.lock === 'function') {
            await orientation.lock('landscape').catch(() => {});
          }
        }
      } else {
        await document.exitFullscreen();
        if (window.screen && 'orientation' in window.screen) {
          const orientation = window.screen.orientation as any;
          if (orientation && typeof orientation.unlock === 'function') {
            orientation.unlock();
          }
        }
      }
    } catch {
      setLandscapeFirst((prev) => !prev);
    }
  };

  const toggleLandscapeRotation = () => {
    setLandscapeFirst((prev) => !prev);
    showToast(landscapeFirst ? 'Portrait Mode' : 'Landscape-First Mode');
  };

  if (!activeVideoEpisode) return null;

  const { media, episodeNumber } = activeVideoEpisode;
  const maxLiveEpisode =
    liveEpisodes.length > 0
      ? Math.max(...liveEpisodes.map((e) => e.number))
      : media.latestEpisode || media.totalEpisodes || 24;
  const totalEpisodeCount = liveEpisodes.length > 0 ? liveEpisodes.length : maxLiveEpisode;

  // Filtered episodes for drawer
  const filteredEpisodes = (liveEpisodes.length > 0
    ? liveEpisodes
    : Array.from({ length: totalEpisodeCount }, (_, i) => ({
        id: `ep-${i + 1}`,
        number: i + 1,
        title: `Episode ${i + 1}`,
      }))
  ).filter((ep) =>
    episodeSearchQuery
      ? String(ep.number).includes(episodeSearchQuery) ||
        (ep.title && ep.title.toLowerCase().includes(episodeSearchQuery.toLowerCase()))
      : true
  );

  const speedOptions = [
    '0.25x',
    '0.50x',
    '0.75x',
    '1.00x',
    '1.25x',
    '1.50x',
    '1.75x',
    '2.00x',
    '2.25x',
    '2.50x',
    '2.75x',
    '3.00x',
  ];

  // Available Subtitle Languages (matching screenshot: English, Indonesian, Thai, plus dynamic tracks)
  const subtitleLanguages = Array.from(
    new Set([
      'English',
      'Indonesian',
      'Thai',
      ...(streamData?.subtitles?.map((s) => s.label || s.lang).filter(Boolean) || []),
      'Spanish',
      'French',
      'German',
      'Portuguese',
      'Arabic',
    ])
  ).filter((l) => l.toLowerCase() !== 'off');

  const currentSources = currentManifest?.sources || streamData?.sources || [];
  const activeSource = currentSources[activeSourceIndex] || currentSources[0];

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onTouchMove={resetControlsTimer}
      onClick={handleScreenTap}
      className={`fixed z-[5000] bg-black flex flex-col justify-between overflow-hidden select-none transition-all duration-300 ${
        landscapeFirst
          ? 'portrait:top-1/2 portrait:left-1/2 portrait:w-[100dvh] portrait:h-[100dvw] portrait:-translate-x-1/2 portrait:-translate-y-1/2 portrait:rotate-90 portrait:origin-center landscape:inset-0 landscape:w-full landscape:h-full landscape:transform-none'
          : 'inset-0 w-full h-full transform-none'
      }`}
    >
      {/* Ambient Glow Background Effect */}
      {ambientLightEnabled && (
        <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl scale-125 bg-gradient-to-tr from-purple-700/50 via-blue-700/40 to-cyan-500/50" />
      )}

      {/* 1. VIDEO SURFACE STAGE */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#07070A]">
        {isLoadingStream ? (
          <div className="flex items-center justify-center z-10">
            <DotPulseLoader size="2xl" color="bg-[#9d62f8]" />
          </div>
        ) : streamError && playerMode === 'direct' ? (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4 z-10 bg-[#181a22]/90 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-md">
            <div className="p-3 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Tv className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Switch to Anime Mirror Stream</h3>
              <p className="text-xs text-white/60">Direct stream source is unavailable. Load high-speed anime mirror?</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPlayerMode('embed');
                  setStreamError(null);
                  showToast('Switched to Anime Mirror Stream');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all cursor-pointer shadow-lg"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Play via Mirror</span>
              </button>
              <button
                onClick={() => {
                  setStreamError(null);
                  setIsLoadingStream(true);
                  if (activeVideoEpisode) {
                    setActiveVideoEpisode({ ...activeVideoEpisode });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : playerMode === 'embed' || currentSources.length === 0 ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
            <iframe
              key={`embed-${activeVideoEpisode.media.id}-${activeVideoEpisode.episodeNumber}-${selectedServer}-${audioTrack}`}
              src={
                selectedServer === 'vidplay'
                  ? `https://vidsrc.me/embed/anime?anilist=${media.id}&ep=${episodeNumber}`
                  : selectedServer === 'pahe'
                  ? `https://www.2embed.cc/embed/anime/${media.id}/${episodeNumber}`
                  : `https://vidsrc.pm/embed/anime/${media.id}/${episodeNumber}`
              }
              className="w-full h-full border-0 bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              className="w-full h-full object-contain bg-black"
              playsInline
              autoPlay
              onTimeUpdate={() => {
                if (videoRef.current) {
                  const t = videoRef.current.currentTime;
                  if (!isScrubbingRef.current) {
                    setCurrentTime(t);
                  }
                  setDuration(videoRef.current.duration || 0);

                  if (stallTimerRef.current) {
                    clearTimeout(stallTimerRef.current);
                    stallTimerRef.current = null;
                  }
                }
              }}
              onWaiting={() => {
                // Buffering gracefully without interrupting user
              }}
              onStalled={() => {
                // Stalled warning
              }}
              onPlaying={() => {
                setIsPlaying(true);
                if (stallTimerRef.current) {
                  clearTimeout(stallTimerRef.current);
                  stallTimerRef.current = null;
                }
              }}
              onPause={() => {
                setIsPlaying(false);
                if (videoRef.current && activeVideoEpisode) {
                  recordAnimeWatchProgress(
                    activeVideoEpisode.media,
                    activeVideoEpisode.episodeNumber,
                    videoRef.current.currentTime,
                    videoRef.current.duration
                  );
                }
              }}
              onError={() => {
                console.warn('Video element onError triggered, auto-failing over...');
                triggerAutoFailover('Video playback error');
              }}
              onEnded={() => {
                if (episodeNumber < maxLiveEpisode) {
                  setActiveVideoEpisode({ media, episodeNumber: episodeNumber + 1 });
                  showToast(`Playing Episode ${episodeNumber + 1}`);
                }
              }}
            >
              {streamData?.subtitles
                ?.filter((sub) => Boolean(sub.url && typeof sub.url === 'string' && sub.url.trim() !== ''))
                ?.map((sub, idx) => (
                  <track
                    key={idx}
                    kind="subtitles"
                    src={sub.url}
                    srcLang={sub.lang}
                    label={sub.label || sub.lang}
                    default={sub.default}
                  />
                ))}
            </video>
          </div>
        )}
      </div>

      {/* LOCK SCREEN UNLOCK PROMPT */}
      {isLocked && (
        <div
          className={`absolute bottom-6 left-6 z-50 transition-opacity duration-200 ${
            showUnlockPrompt ? 'opacity-100' : 'opacity-40 hover:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={toggleLock}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#181a22]/90 border border-purple-500/40 text-purple-300 backdrop-blur-md shadow-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span className="text-xs font-bold">Tap to Unlock Screen</span>
          </button>
        </div>
      )}

      {/* 2. TOP OVERLAY HEADER */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          resetControlsTimer();
        }}
        className={`relative z-20 flex items-center justify-between gap-3 p-4 sm:p-5 bg-gradient-to-b from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
          showControls && !isLocked ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Back Action Button + Dynamic Metadata Label */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setActiveVideoEpisode(null)}
            className="w-10 h-10 rounded-full bg-[#181a22]/90 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white cursor-pointer shadow-lg transition-all active:scale-95 shrink-0"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight tracking-tight drop-shadow-md truncate">
              Episode {episodeNumber}
            </h1>
            <p className="text-xs sm:text-sm text-white/70 font-normal truncate leading-tight mt-0.5 drop-shadow-sm max-w-[260px] sm:max-w-xl">
              {media.title}
            </p>
          </div>
        </div>
      </div>

      {/* 3. CENTER PLAYBACK CONTROLS (-10s, Play/Pause, +10s) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          resetControlsTimer();
        }}
        className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
          showControls && !isLocked ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-8 sm:gap-14 pointer-events-auto select-none">
          {/* -10s Rewind Button */}
          <button
            onClick={handleRewind10}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:scale-110 active:scale-90 transition-all cursor-pointer"
            aria-label="Rewind 10 seconds"
          >
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <text
                x="12"
                y="15.5"
                fontSize="7.5"
                fontWeight="900"
                textAnchor="middle"
                fill="currentColor"
                stroke="none"
              >
                10
              </text>
            </svg>
          </button>

          {/* Dynamic Play / Pause Button */}
          <button
            onClick={togglePlay}
            className="w-14 h-14 sm:w-18 sm:h-18 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all cursor-pointer drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-9 h-9 sm:w-11 sm:h-11 fill-current" />
            ) : (
              <Play className="w-9 h-9 sm:w-11 sm:h-11 fill-current ml-1" />
            )}
          </button>

          {/* +10s Forward Button */}
          <button
            onClick={handleForward10}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:scale-110 active:scale-90 transition-all cursor-pointer"
            aria-label="Forward 10 seconds"
          >
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <text
                x="12"
                y="15.5"
                fontSize="7.5"
                fontWeight="900"
                textAnchor="middle"
                fill="currentColor"
                stroke="none"
              >
                10
              </text>
            </svg>
          </button>
        </div>
      </div>

      {/* 4. TIMELINE & BOTTOM NAVIGATION TOOLBAR */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          resetControlsTimer();
        }}
        className={`relative z-20 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-3 transition-opacity duration-300 ${
          showControls && !isLocked ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* A. FLOATING BADGES (Above Timeline) */}
        <div className="flex items-center justify-between px-1">
          {/* Left Badges: Lock Screen & Audio SUB/DUB Pill */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleLock}
              className="p-1.5 rounded-xl text-white hover:text-white/80 transition-colors cursor-pointer active:scale-95"
              title="Lock Screen"
              aria-label="Lock Screen"
            >
              <Lock className="w-5 h-5 stroke-[2]" />
            </button>

            <button
              onClick={() => {
                const nextAudio = audioTrack === 'sub' ? 'dub' : 'sub';
                setAudioTrack(nextAudio);
                showToast(`Switched Audio: ${nextAudio.toUpperCase()}`);
              }}
              className="px-2.5 py-0.5 rounded-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[11px] font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(139,92,246,0.5)] border border-purple-400/40 transition-all cursor-pointer active:scale-95"
              title="Toggle Audio Sub / Dub"
            >
              {audioTrack}
            </button>
          </div>

          {/* Right Floating Badge: Skip Opening / Skip Outro (Only rendered during Opening or Outro) */}
          {shouldShowSkipButton && (
            <button
              onClick={handleDynamicSkip}
              className="px-4 py-1.5 rounded-full bg-[#181a22]/90 hover:bg-[#222530] border border-white/20 text-white font-bold text-xs shadow-xl transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 backdrop-blur-md animate-in fade-in"
              title={dynamicSkipLabel}
            >
              <span>{dynamicSkipLabel}</span>
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>

        {/* B. TIMELINE PROGRESS SCRUBBER */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs font-bold text-white/90 font-mono tracking-tight shrink-0">
            {formatTime(currentTime)}
          </span>

          <div className="relative flex-1 flex items-center h-6 select-none group touch-none cursor-pointer">
            {/* 1. Background Unwatched Track */}
            <div className="absolute inset-x-0 h-[3.5px] sm:h-1 bg-white/20 rounded-full overflow-hidden">
              {/* 2. Watched Purple Track */}
              <div
                className="h-full bg-[#b876fc] rounded-full transition-[width] duration-75"
                style={{
                  width: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
                }}
              />
            </div>

            {/* 3. Full-width Range Slider for Touch & Drag Seeking */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onPointerDown={() => {
                isScrubbingRef.current = true;
                if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
                setShowControls(true);
              }}
              onInput={(e: any) => {
                const val = Number(e.target.value);
                setCurrentTime(val);
                if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
                setShowControls(true);
              }}
              onChange={(e) => {
                const val = Number(e.target.value);
                handleSeek(val);
                isScrubbingRef.current = false;
                resetControlsTimer();
              }}
              onPointerUp={(e: any) => {
                const val = Number(e.currentTarget.value);
                handleSeek(val);
                isScrubbingRef.current = false;
                resetControlsTimer();
              }}
              onPointerCancel={() => {
                isScrubbingRef.current = false;
                resetControlsTimer();
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer focus:outline-none z-10 touch-none"
            />
          </div>

          <span className="text-xs font-bold text-white/90 font-mono tracking-tight shrink-0">
            {formatTime(duration || 0)}
          </span>
        </div>

        {/* C. BOTTOM NAVIGATION TOOLBAR (Left & Right Capsules matching exact screenshot) */}
        <div className="flex items-center justify-between pt-1 px-1">
          {/* Left Controls Group: Subtitles & Audio + Episode List */}
          <div className="flex items-center gap-1.5 p-1 bg-[#181a22]/90 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md">
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'subtitles' ? null : 'subtitles')}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
                activeDrawer === 'subtitles' ? 'bg-purple-600 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Subtitles & Audio"
              aria-label="Subtitles & Audio"
            >
              <Keyboard className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveDrawer(activeDrawer === 'episodes' ? null : 'episodes')}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
                activeDrawer === 'episodes' ? 'bg-purple-600 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Episode List"
              aria-label="Episode List"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>

          {/* Right Controls Group: Quality Selector ("HD") + Speedometer + Fullscreen */}
          <div className="flex items-center gap-1.5 p-1 bg-[#181a22]/90 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md">
            {/* Quality Selector Button ("HD" Icon) */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'quality' ? null : 'quality')}
              className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer font-bold text-xs flex items-center justify-center ${
                activeDrawer === 'quality'
                  ? 'bg-purple-600 text-white shadow-lg border border-purple-400'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Stream Quality & Server Selector"
              aria-label="Stream Quality & Server Selector"
            >
              <span className="border border-current px-1 py-0.5 rounded leading-none text-[10px] tracking-wider font-mono font-black">
                HD
              </span>
            </button>

            {/* Playback Speed Button (Speedometer Icon) */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'speed' ? null : 'speed')}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
                activeDrawer === 'speed' ? 'bg-purple-600 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Playback Speed"
              aria-label="Playback Speed"
            >
              <Gauge className="w-5 h-5" />
            </button>

            {/* Fullscreen Toggle Button (Frame Expand Icon) */}
            <button
              onClick={toggleFullscreen}
              className="p-2 sm:p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Toggle Fullscreen"
              aria-label="Toggle Fullscreen"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. MODAL BOTTOM DRAWERS / SHEETS */}

      {/* DRAWER 1: SUBTITLES & AUDIO (Matching exact screenshot) */}
      {activeDrawer === 'subtitles' && (
        <div
          onClick={() => setActiveDrawer(null)}
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#000000] border-t border-white/10 rounded-t-[28px] sm:rounded-t-[32px] px-6 sm:px-8 pt-4 pb-6 max-h-[85%] text-white shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col"
          >
            {/* Pull Bar Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 shrink-0" />

            {/* Header: Title on Left, SubDelay & Apply Buttons on Right */}
            <div className="flex items-center justify-between gap-4 mb-3.5 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Subtitles & Audio
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSubDelay(!showSubDelay)}
                  className={`px-4 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                    showSubDelay || subDelayMs !== 0
                      ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                      : 'bg-[#181a24] border-white/10 text-white/90 hover:bg-white/10'
                  }`}
                >
                  SubDelay {subDelayMs !== 0 ? `(${subDelayMs > 0 ? '+' : ''}${subDelayMs}ms)` : ''}
                </button>

                <button
                  onClick={() => {
                    setActiveDrawer(null);
                    showToast(`Applied: ${selectedSubtitle} Sub / ${audioTrack === 'sub' ? 'Japanese' : 'English'} Audio`);
                  }}
                  className="px-5 py-1.5 rounded-xl bg-[#9333ea] hover:bg-[#8b5cf6] text-white text-xs font-bold shadow-[0_0_15px_rgba(147,51,234,0.4)] transition-all cursor-pointer active:scale-95"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* SubDelay Offset Bar (when SubDelay button is toggled) */}
            {showSubDelay && (
              <div className="mb-3.5 p-2.5 rounded-2xl bg-[#12141c] border border-purple-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <span className="text-white/70 font-medium">Subtitle Offset:</span>
                <div className="flex items-center gap-1.5">
                  {[-1000, -500, -250, 0, 250, 500, 1000].map((ms) => (
                    <button
                      key={ms}
                      onClick={() => {
                        setSubDelayMs(ms);
                        showToast(`Subtitle Delay: ${ms === 0 ? '0s' : (ms / 1000).toFixed(1) + 's'}`);
                      }}
                      className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                        subDelayMs === ms
                          ? 'bg-purple-600 text-white shadow'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {ms === 0 ? '0s' : `${ms > 0 ? '+' : ''}${ms / 1000}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2-Column Side-by-Side Content with Ultra-Thin Divider and Individual Scrollbars */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6 pt-1">
              {/* LEFT COLUMN: SUBTITLES (Independent scroll container) */}
              <div className="flex flex-col min-w-0 pr-3 sm:pr-4 border-r border-white/10">
                <span className="block text-[11px] font-bold text-white/50 tracking-wider uppercase mb-2 shrink-0">
                  SUBTITLES
                </span>

                <div className="space-y-2 overflow-y-auto max-h-52 sm:max-h-60 pr-1.5 overscroll-contain scrollbar-thin scrollbar-thumb-white/20">
                  {/* Subtitle Off */}
                  <div
                    onClick={() => setSelectedSubtitle('Off')}
                    className={`h-11 sm:h-12 px-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-98 select-none ${
                      selectedSubtitle === 'Off'
                        ? 'border-[#a855f7] bg-[#241335]/70 text-white'
                        : 'border-white/10 bg-[#0c0d12] text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold">Off</span>
                  </div>

                  {/* Subtitle Languages */}
                  {subtitleLanguages.map((lang) => {
                    const isSelected = selectedSubtitle.toLowerCase() === lang.toLowerCase();
                    return (
                      <div
                        key={lang}
                        onClick={() => setSelectedSubtitle(lang)}
                        className={`h-11 sm:h-12 px-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-98 select-none ${
                          isSelected
                            ? 'border-[#a855f7] bg-[#241335]/70 text-white'
                            : 'border-white/10 bg-[#0c0d12] text-white/80 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-semibold truncate pr-2">{lang}</span>

                        {/* Server/Track Pills: 1, 2, 3 */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {[1, 2, 3].map((trackNum) => (
                            <button
                              key={trackNum}
                              onClick={() => {
                                setSelectedSubtitle(lang);
                                setSubtitleServerIndex(trackNum);
                              }}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                                isSelected && subtitleServerIndex === trackNum
                                  ? 'bg-[#7e22ce] text-white shadow-sm'
                                  : 'bg-[#14161f] border border-white/10 text-white/60 hover:text-white'
                              }`}
                            >
                              {trackNum}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN: AUDIO (Independent scroll container) */}
              <div className="flex flex-col min-w-0 pl-1 sm:pl-2">
                <span className="block text-[11px] font-bold text-white/50 tracking-wider uppercase mb-2 shrink-0">
                  AUDIO
                </span>

                <div className="space-y-2 overflow-y-auto max-h-52 sm:max-h-60 pr-1.5 overscroll-contain scrollbar-thin scrollbar-thumb-white/20">
                  {/* Japanese (Sub) */}
                  <div
                    onClick={() => setAudioTrack('sub')}
                    className={`h-11 sm:h-12 px-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-98 select-none ${
                      audioTrack === 'sub'
                        ? 'border-[#a855f7] bg-[#241335]/70 text-white'
                        : 'border-white/10 bg-[#0c0d12] text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold truncate pr-2">Japanese</span>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3].map((audioNum) => (
                        <button
                          key={audioNum}
                          onClick={() => {
                            setAudioTrack('sub');
                            setAudioServerIndex(audioNum);
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            audioTrack === 'sub' && audioServerIndex === audioNum
                              ? 'bg-[#7e22ce] text-white shadow-sm'
                              : 'bg-[#14161f] border border-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          {audioNum}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* English (Dub) */}
                  <div
                    onClick={() => setAudioTrack('dub')}
                    className={`h-11 sm:h-12 px-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-98 select-none ${
                      audioTrack === 'dub'
                        ? 'border-[#a855f7] bg-[#241335]/70 text-white'
                        : 'border-white/10 bg-[#0c0d12] text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold truncate pr-2">English</span>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3].map((audioNum) => (
                        <button
                          key={audioNum}
                          onClick={() => {
                            setAudioTrack('dub');
                            setAudioServerIndex(audioNum);
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            audioTrack === 'dub' && audioServerIndex === audioNum
                              ? 'bg-[#7e22ce] text-white shadow-sm'
                              : 'bg-[#14161f] border border-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          {audioNum}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 2: EPISODE LIST DRAWER (Matching exact screenshot) */}
      {activeDrawer === 'episodes' && (
        <div
          onClick={() => setActiveDrawer(null)}
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#000000] border-t border-white/10 rounded-t-[28px] sm:rounded-t-[32px] px-5 sm:px-8 pt-3 pb-6 max-h-[85%] text-white shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col"
          >
            {/* Pull Bar Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 shrink-0" />

            {/* Header: "Episodes" on Left, Search Bar Capsule on Right */}
            <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Episodes
              </h3>

              {/* Capsule Search Input */}
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  value={episodeSearchQuery}
                  onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                  placeholder="Search episodes"
                  className="w-48 sm:w-64 bg-[#14161f] border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/60 transition-colors"
                />
              </div>
            </div>

            {/* Episode Number Pills Grid (Row of 12 in landscape) */}
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2 sm:gap-2.5 overflow-y-auto max-h-56 sm:max-h-64 pt-1 pr-1 pb-2">
              {filteredEpisodes.map((ep) => {
                const isCurrent = episodeNumber === ep.number;
                return (
                  <button
                    key={ep.id || ep.number}
                    onClick={() => {
                      setActiveVideoEpisode({ media, episodeNumber: ep.number });
                      setActiveDrawer(null);
                      showToast(`Playing Episode ${ep.number}`);
                    }}
                    className={`h-10 sm:h-11 rounded-[14px] text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center select-none active:scale-95 ${
                      isCurrent
                        ? 'bg-[#241335] border-2 border-[#a855f7] text-[#d8b4fe] font-black shadow-[0_0_15px_rgba(168,85,247,0.35)]'
                        : 'bg-[#0a0a0c] border border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{ep.number}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 3: PLAYER QUALITY & SERVER SELECTOR DRAWER (Matching exact screenshot) */}
      {activeDrawer === 'quality' && (
        <div
          onClick={() => setActiveDrawer(null)}
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#000000] border-t border-white/10 rounded-t-[28px] sm:rounded-t-[32px] px-6 sm:px-8 pt-4 pb-6 max-h-[85%] text-white shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col"
          >
            {/* Pull Bar Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 shrink-0" />

            {/* Header: Title on Left, Apply Button on Right */}
            <div className="flex items-center justify-between gap-4 mb-3.5 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Video Quality
              </h3>

              <button
                onClick={() => {
                  setActiveDrawer(null);
                  const currentSrvName =
                    selectedServer === 'vidplay'
                      ? 'Kaa - CatStream'
                      : selectedServer === 'pahe'
                      ? 'Phos'
                      : 'Koto';
                  showToast(`Applied: ${selectedQuality.replace(' (HLS)', '')} • ${currentSrvName}`);
                }}
                className="px-5 py-1.5 rounded-xl bg-[#9333ea] hover:bg-[#8b5cf6] text-white text-xs font-bold shadow-[0_0_15px_rgba(147,51,234,0.4)] transition-all cursor-pointer active:scale-95"
              >
                Apply
              </button>
            </div>

            {/* 2-Column Side-by-Side Content with Ultra-Thin Divider and Individual Scrollbars */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6 pt-1 min-h-0">
              {/* LEFT COLUMN: QUALITY */}
              <div className="flex flex-col min-w-0 pr-3 sm:pr-4 border-r border-white/10">
                <span className="block text-[11px] font-bold text-white/50 tracking-wider uppercase mb-2 shrink-0">
                  QUALITY
                </span>

                <div className="space-y-2 overflow-y-auto max-h-52 sm:max-h-60 pr-1.5 scrollbar-thin scrollbar-thumb-white/20 overscroll-contain">
                  {/* Quality Options: Auto, 1080p, 720p, 480p, 360p */}
                  {['Auto', '1080p', '720p', '480p', '360p'].map((qLabel) => {
                    const mappedInternal = qLabel === 'Auto' ? 'Auto (HLS)' : qLabel;
                    const isSelected =
                      selectedQuality.toLowerCase().includes(qLabel.toLowerCase()) ||
                      (qLabel === 'Auto' && selectedQuality.includes('Auto'));

                    return (
                      <div
                        key={qLabel}
                        onClick={() => handleQualityChange(mappedInternal)}
                        className={`h-11 sm:h-12 px-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-98 select-none ${
                          isSelected
                            ? 'border-[#a855f7] bg-[#241335]/70 text-white'
                            : 'border-white/10 bg-[#0c0d12] text-white/80 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-semibold">{qLabel}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#a855f7]" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN: SERVERS */}
              <div className="flex flex-col min-w-0 pl-1 sm:pl-2">
                <span className="block text-[11px] font-bold text-white/50 tracking-wider uppercase mb-2 shrink-0">
                  SERVERS
                </span>

                <div className="space-y-2 overflow-y-auto max-h-52 sm:max-h-60 pr-1.5 scrollbar-thin scrollbar-thumb-white/20 overscroll-contain">
                  {[
                    { key: 'vidplay' as AnimeStreamServer, name: 'Kaa - CatStream' },
                    { key: 'pahe' as AnimeStreamServer, name: 'Phos' },
                    { key: 'koto' as AnimeStreamServer, name: 'Koto' },
                  ].map((srv) => {
                    const isSelected = selectedServer === srv.key;

                    return (
                      <div
                        key={srv.key}
                        onClick={() => handleServerSelect(srv.key)}
                        className={`h-11 sm:h-12 px-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-98 select-none ${
                          isSelected
                            ? 'border-[#a855f7] bg-[#241335]/70 text-white'
                            : 'border-white/10 bg-[#0c0d12] text-white/80 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-xs sm:text-sm font-semibold text-white leading-tight">
                            {srv.name}
                          </span>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold leading-tight mt-0.5">
                            SOFT SUBTITLES
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#a855f7]" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 4: PLAYBACK SPEED DRAWER (Matching exact screenshot) */}
      {activeDrawer === 'speed' && (
        <div
          onClick={() => setActiveDrawer(null)}
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#000000] border-t border-white/10 rounded-t-[28px] sm:rounded-t-[32px] px-6 sm:px-10 pt-3 pb-8 text-white shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col"
          >
            {/* Pull Bar Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 shrink-0" />

            {/* Header: Playback Speed on Left */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Playback Speed
              </h3>
            </div>

            {/* Current Speed Display in Center (Purple Text) */}
            <div className="text-center my-3 shrink-0">
              <span className="text-2xl sm:text-3xl font-black text-[#a855f7] tracking-wider font-mono">
                {parseFloat(playbackSpeed.replace('x', '') || '1').toFixed(2)}x
              </span>
            </div>

            {/* Speed Range Slider */}
            <div className="w-full max-w-2xl mx-auto px-2 py-3">
              <input
                type="range"
                min="0.25"
                max="3.00"
                step="0.05"
                value={parseFloat(playbackSpeed.replace('x', '') || '1')}
                onInput={(e: any) => {
                  const val = parseFloat(e.target.value);
                  const speedStr = `${val.toFixed(2)}x`;
                  setPlaybackSpeed(speedStr);
                }}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const speedStr = `${val.toFixed(2)}x`;
                  setPlaybackSpeed(speedStr);
                }}
                className="w-full h-1.5 bg-[#272732] rounded-lg appearance-none cursor-pointer accent-[#a855f7] focus:outline-none touch-none"
                style={{
                  background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${
                    ((parseFloat(playbackSpeed.replace('x', '') || '1') - 0.25) / (3.00 - 0.25)) * 100
                  }%, #272732 ${
                    ((parseFloat(playbackSpeed.replace('x', '') || '1') - 0.25) / (3.00 - 0.25)) * 100
                  }%, #272732 100%)`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
