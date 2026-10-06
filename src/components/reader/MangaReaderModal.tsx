import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  SkipBack,
  SkipForward,
  BookText,
  Settings as SettingsIcon,
  X,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AppToggleSwitch } from '../common/AppToggleSwitch';
import { DotPulseLoader } from '../common/DotPulseLoader';
import {
  NovelReaderSettingsSheet,
  NovelReaderSettings,
  DEFAULT_NOVEL_SETTINGS,
} from './NovelReaderSettingsSheet';
import { loadCustomFontFromStorage } from '../../utils/customFontHelper';
import { ZoomablePageWrapper } from './ZoomablePageWrapper';
import {
  getMangaPages,
  getNovelChapterContent,
  AnifyNovelChapterContent,
  fetchMangaDexChapters,
  searchMangaDex,
  fetchMediaMangaChapters,
  fetchMediaNovelChapters,
} from '../../services/apiClient';

export interface MangaBookmark {
  id: string;
  mediaId: string | number;
  chapterNumber: number;
  chapterId?: string;
  page: number;
  totalPages: number;
  textSnippet?: string;
  createdAt: number;
}

interface MangaPageItemProps {
  pageUrl: string;
  pageIndex: number;
  totalPages: number;
  pageScale?: 'Fit' | 'Fit Width' | 'Original' | 'Fill';
  cropBorders?: boolean;
  widePageZoom?: boolean;
  zoomStart?: 'Automatic' | 'Left' | 'Center' | 'Right';
  readingDirection?: 'ltr' | 'rtl';
  canvasBg?: string;
  textColor?: string;
  onVisible?: (pageIndex: number) => void;
}

// Helper to ensure proxy URLs are clean, non-nested, and support fresh reload
const formatPageSrc = (rawUrl: string, cacheBust = false): string => {
  if (!rawUrl) return '';
  let target = rawUrl;
  if (target.startsWith('/api/image-proxy')) {
    try {
      const parsed = new URL(target, window.location.origin);
      const inner = parsed.searchParams.get('url');
      if (inner) target = inner;
    } catch {
      // keep target
    }
  }
  if (target.includes('mangadex.network/data') || target.includes('mangadex.network/data-saver')) {
    const match = target.match(/\/(data(?:-saver)?\/[a-f0-9]+\/[^?#]+)/i);
    if (match && match[1]) {
      target = `https://uploads.mangadex.org/${match[1]}`;
    }
  }
  const timestamp = cacheBust ? `&t=${Date.now()}` : '';
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return `/api/image-proxy?url=${encodeURIComponent(target)}${timestamp}`;
  }
  return target;
};

const MangaPageItem: React.FC<MangaPageItemProps> = ({
  pageUrl,
  pageIndex,
  totalPages,
  pageScale = 'Fit',
  cropBorders = false,
  widePageZoom = true,
  zoomStart = 'Center',
  readingDirection = 'ltr',
  canvasBg,
  textColor,
  onVisible,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(() => formatPageSrc(pageUrl));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSrc(formatPageSrc(pageUrl));
    setLoaded(false);
    setError(false);
  }, [pageUrl]);

  useEffect(() => {
    if (!onVisible || !containerRef.current) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
          onVisible(pageIndex + 1);
        }
      },
      { threshold: [0.4, 0.7] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageIndex, onVisible]);

  const handleError = () => {
    if (!currentSrc.includes('/api/image-proxy')) {
      setCurrentSrc(formatPageSrc(pageUrl));
    } else {
      setError(true);
    }
  };

  const resolvedZoomClass =
    zoomStart === 'Left'
      ? 'object-left object-top'
      : zoomStart === 'Right'
      ? 'object-right object-top'
      : zoomStart === 'Automatic'
      ? readingDirection === 'rtl'
        ? 'object-right object-top'
        : 'object-left object-top'
      : 'object-center';

  const scaleClass =
    pageScale === 'Fit Width'
      ? 'w-full h-auto'
      : pageScale === 'Fill'
      ? 'w-full h-screen object-cover'
      : pageScale === 'Original'
      ? 'w-auto max-w-none'
      : 'w-full h-auto object-contain';

  return (
    <div
      id={`manga-page-${pageIndex + 1}`}
      data-page-index={pageIndex + 1}
      ref={containerRef}
      className={`relative w-full ${
        pageScale === 'Fit Width' || pageScale === 'Fill' ? 'max-w-none' : 'max-w-3xl'
      } mx-auto overflow-hidden flex items-center justify-center rounded-none border-0 shadow-none p-0 m-0 leading-none transition-colors duration-200 ${
        !loaded && !error ? 'min-h-[100dvh]' : 'min-h-0'
      }`}
      style={{
        backgroundColor: canvasBg || '#000000',
      }}
    >
      {/* Loading Skeleton: Matches chosen canvas background with Center Purple Dot Pulse Animation */}
      {!loaded && !error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 select-none z-10 min-h-[100dvh] transition-colors duration-200"
          style={{
            backgroundColor: canvasBg || '#000000',
            color: textColor || '#ffffff',
          }}
        >
          <div className="w-8 h-8 rounded-full bg-[#9d62f8] animate-dot-pulse shrink-0" />
          <p
            className="text-[13px] font-normal tracking-wide mt-3.5"
            style={{
              color: textColor ? `${textColor}99` : 'rgba(255,255,255,0.7)',
            }}
          >
            Loading page...
          </p>
        </div>
      )}

      {/* Error state */}
      {error ? (
        <div
          className="flex flex-col items-center justify-center p-8 text-center space-y-3 min-h-[50vh] w-full transition-colors duration-200"
          style={{
            backgroundColor: canvasBg || '#000000',
            color: textColor || '#ffffff',
          }}
        >
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p
            className="text-xs"
            style={{ color: textColor ? `${textColor}b3` : 'rgba(255,255,255,0.7)' }}
          >
            Failed to load Page {pageIndex + 1}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setError(false);
              setLoaded(false);
              setCurrentSrc(formatPageSrc(pageUrl, true));
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </button>
        </div>
      ) : currentSrc ? (
        <ZoomablePageWrapper className="w-full flex items-center justify-center">
          <img
            src={currentSrc}
            alt={`Page ${pageIndex + 1}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={`${scaleClass} block mx-auto transition-opacity duration-300 border-0 shadow-none rounded-none p-0 m-0 align-top leading-none ${
              cropBorders ? 'scale-[1.04] -my-1' : ''
            } ${resolvedZoomClass} ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </ZoomablePageWrapper>
      ) : null}
    </div>
  );
};

// Global in-memory cache for loaded novel cover images across drawer opens/closes
const globalLoadedCoverImages = new Set<string>();
// Global in-memory cache for reader chapter/volume lists by media id
const globalReaderChaptersCache = new Map<string | number, Array<{ id: string; chapter: string; title: string; coverImage?: string }>>();

interface NovelVolumeCardProps {
  ch: { id: string; chapter: string; title: string; coverImage?: string };
  isCurrent: boolean;
  mediaCover?: string;
  onClick: () => void;
}

const NovelVolumeCard: React.FC<NovelVolumeCardProps> = ({
  ch,
  isCurrent,
  mediaCover,
  onClick,
}) => {
  const rawCover = ch.coverImage || mediaCover;
  const coverSrc = rawCover && typeof rawCover === 'string' && rawCover.trim() !== '' ? rawCover.trim() : null;
  const [imgLoaded, setImgLoaded] = useState<boolean>(() => {
    return !!coverSrc && globalLoadedCoverImages.has(coverSrc);
  });

  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left cursor-pointer focus:outline-none"
    >
      {/* Volume Book Cover Box / Empty Skeleton */}
      <div
        className={`relative w-full aspect-[1/1.44] rounded-[14px] sm:rounded-[16px] overflow-hidden bg-[#1a1b26] flex items-center justify-center transition-all ${
          isCurrent
            ? 'ring-2 ring-[#b876fc] shadow-[0_0_14px_rgba(184,118,252,0.35)]'
            : 'border border-white/5 group-hover:border-white/20'
        }`}
      >
        {/* Empty Skeleton UI with Volumes option icon (No shimmer/shine animation) */}
        {(!imgLoaded || !coverSrc) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b26] z-0">
            <BookText
              className={`w-7 h-7 sm:w-8 sm:h-8 ${
                isCurrent ? 'text-[#b876fc]/60' : 'text-white/30'
              }`}
            />
          </div>
        )}

        {/* Real Cover Image if available */}
        {coverSrc && (
          <img
            src={coverSrc}
            alt={`Volume ${ch.chapter}`}
            onLoad={() => {
              if (coverSrc) globalLoadedCoverImages.add(coverSrc);
              setImgLoaded(true);
            }}
            ref={(imgEl) => {
              if (imgEl && imgEl.complete && imgEl.naturalWidth > 0 && !imgLoaded) {
                if (coverSrc) globalLoadedCoverImages.add(coverSrc);
                setImgLoaded(true);
              }
            }}
            className={`w-full h-full object-cover transition-opacity duration-150 group-hover:scale-105 z-10 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onError={(e) => {
              if (mediaCover && e.currentTarget.src !== mediaCover) {
                e.currentTarget.src = mediaCover;
              }
            }}
          />
        )}

        {isCurrent && imgLoaded && (
          <div className="absolute inset-0 bg-[#b876fc]/10 pointer-events-none z-20" />
        )}
      </div>

      {/* Volume Title Label */}
      <span
        className={`text-[13.5px] sm:text-[14px] font-semibold tracking-tight truncate mt-2 transition-colors ${
          isCurrent ? 'text-[#c084fc] font-bold' : 'text-white'
        }`}
      >
        Volume {ch.chapter}
      </span>
    </button>
  );
};

const PagedViewer: React.FC<{
  pageUrl: string;
  currentPage: number;
  totalPages: number;
  pageScale?: 'Fit' | 'Fit Width' | 'Original' | 'Fill';
  pageTurnAnim?: 'Off' | 'Default' | 'Book Flip';
  cropBorders?: boolean;
  zoomStart?: 'Automatic' | 'Left' | 'Center' | 'Right';
  readingDirection?: 'ltr' | 'rtl';
  isVertical?: boolean;
  canvasBg?: string;
  textColor?: string;
}> = ({
  pageUrl,
  currentPage,
  totalPages,
  pageScale = 'Fit',
  pageTurnAnim = 'Default',
  cropBorders = false,
  zoomStart = 'Automatic',
  readingDirection = 'ltr',
  isVertical = false,
  canvasBg,
  textColor,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(() => formatPageSrc(pageUrl));

  useEffect(() => {
    setCurrentSrc(formatPageSrc(pageUrl));
    setLoaded(false);
    setError(false);
  }, [pageUrl]);

  const handleError = () => {
    if (!currentSrc.includes('/api/image-proxy')) {
      setCurrentSrc(formatPageSrc(pageUrl));
    } else {
      setError(true);
    }
  };

  const resolvedZoomClass =
    zoomStart === 'Left'
      ? 'object-left object-top'
      : zoomStart === 'Right'
      ? 'object-right object-top'
      : zoomStart === 'Automatic'
      ? readingDirection === 'rtl'
        ? 'object-right object-top'
        : 'object-left object-top'
      : 'object-center';

  const animClass =
    pageTurnAnim === 'Off'
      ? 'duration-0 animate-none'
      : isVertical
      ? 'transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
      : pageTurnAnim === 'Book Flip'
      ? readingDirection === 'rtl'
        ? 'transition-all duration-500 [transform-origin:right_center] animate-in fade-in [transform:perspective(1200px)_rotateY(-12deg)_scale(0.98)]'
        : 'transition-all duration-500 [transform-origin:left_center] animate-in fade-in [transform:perspective(1200px)_rotateY(12deg)_scale(0.98)]'
      : readingDirection === 'rtl'
      ? 'transition-all duration-300 animate-in fade-in slide-in-from-left-4'
      : 'transition-all duration-300 animate-in fade-in slide-in-from-right-4';

  return (
    <div
      className="flex items-center justify-center w-full h-[100dvh] min-h-[100dvh] select-none [perspective:1400px] p-0 overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: canvasBg || '#000000',
      }}
    >
      <div
        className="relative w-full h-full min-h-[100dvh] flex items-center justify-center border-0 shadow-none rounded-none overflow-hidden transition-colors duration-200"
        style={{
          backgroundColor: canvasBg || '#000000',
        }}
      >
        {/* Loading Skeleton: Matches chosen canvas background with Center Purple Dot Pulse Animation */}
        {!loaded && !error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 select-none z-10 transition-colors duration-200"
            style={{
              backgroundColor: canvasBg || '#000000',
              color: textColor || '#ffffff',
            }}
          >
            <div className="w-8 h-8 rounded-full bg-[#9d62f8] animate-dot-pulse shrink-0" />
            <p
              className="text-[13px] font-normal tracking-wide mt-3.5"
              style={{
                color: textColor ? `${textColor}99` : 'rgba(255,255,255,0.7)',
              }}
            >
              Loading page...
            </p>
          </div>
        )}

        {error ? (
          <div
            className="flex flex-col items-center justify-center p-6 text-center space-y-3 z-10 transition-colors duration-200"
            style={{
              backgroundColor: canvasBg || '#000000',
              color: textColor || '#ffffff',
            }}
          >
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p
              className="text-xs"
              style={{
                color: textColor ? `${textColor}b3` : 'rgba(255,255,255,0.7)',
              }}
            >
              Failed to load Page {currentPage}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setError(false);
                setLoaded(false);
                setCurrentSrc(formatPageSrc(pageUrl, true));
              }}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : currentSrc ? (
          <ZoomablePageWrapper className="w-full h-full flex items-center justify-center">
            <img
              key={`page-${currentPage}`}
              src={currentSrc}
              alt={`Page ${currentPage}`}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={handleError}
              className={`block mx-auto select-none border-0 shadow-none rounded-none ${
                pageScale === 'Fill'
                  ? 'w-full h-full object-cover'
                  : pageScale === 'Fit Width'
                  ? 'w-full h-auto max-h-full object-contain object-center'
                  : pageScale === 'Original'
                  ? 'w-auto h-auto max-w-none max-h-none'
                  : 'max-h-full max-w-full w-auto h-auto object-contain'
              } ${cropBorders ? 'scale-[1.04]' : ''} ${resolvedZoomClass} ${animClass} ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </ZoomablePageWrapper>
        ) : null}
      </div>
    </div>
  );
};

export const MangaReaderModal: React.FC = () => {
  const {
    activeReader,
    setActiveReader,
    settings,
    recordMangaReadingProgress,
    updateLibraryProgress,
    addToLibrary,
    removeFromLibrary,
    getLibraryEntry,
  } = useApp();

  // Toast notifications disabled/hidden inside Manga Reader as requested
  const showToast = (_msg?: any) => {};

  const [mangaSettingsToast, setMangaSettingsToast] = useState<string | null>(null);
  const mangaToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showMangaSettingsToast = (msg: string) => {
    if (mangaToastTimerRef.current) clearTimeout(mangaToastTimerRef.current);
    setMangaSettingsToast(msg);
    mangaToastTimerRef.current = setTimeout(() => {
      setMangaSettingsToast(null);
    }, 2500);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [draggingPage, setDraggingPage] = useState<number | null>(null);

  // Restore any imported custom font on mount
  useEffect(() => {
    loadCustomFontFromStorage();
  }, []);

  // Helper to load settings from storage (either per-manga or global)
  const getStoredSettings = useCallback(() => {
    const isPerManga =
      activeReader?.media?.id &&
      localStorage.getItem(`satori_manga_per_manga_${activeReader.media.id}`) === 'true';

    const storageKey =
      isPerManga && activeReader?.media?.id
        ? `satori_manga_custom_${activeReader.media.id}`
        : 'satori_manga_global_settings';

    let loaded: any = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) loaded = JSON.parse(raw);
    } catch {}

    const appDirection = settings.pagedReaderDirection === 'Right to Left' ? 'rtl' : 'ltr';
    const appLayout = (settings.mangaReaderMode as any) || 'Paged';
    const appAppearance =
      settings.readerBackground === 'White'
        ? 'light'
        : settings.readerBackground === 'Dark Gray'
        ? 'dark'
        : 'black';

    return {
      perManga: Boolean(isPerManga),
      layout: (loaded.layout || appLayout) as 'Automatic' | 'Paged' | 'Vertical' | 'Webtoon',
      direction: (loaded.direction || appDirection) as 'ltr' | 'rtl',
      scale: (loaded.scale || settings.imageScale || 'Fit') as 'Fit' | 'Fit Width' | 'Original' | 'Fill',
      zoom: (loaded.zoom || settings.zoomStart || 'Automatic') as 'Automatic' | 'Left' | 'Center' | 'Right',
      anim: (loaded.anim || settings.pageTurnAnimation || 'Default') as 'Off' | 'Default' | 'Book Flip',
      sound: (loaded.sound || 'Off') as 'Off' | '1' | '2' | '3' | '4',
      appearance: (loaded.appearance || appAppearance) as 'black' | 'dark' | 'light',
      crop: Boolean(loaded.crop ?? settings.cropBorders ?? false),
      autoWebtoon: Boolean(loaded.autoWebtoon ?? settings.automaticWebtoon ?? true),
      wideZoom: Boolean(loaded.wideZoom ?? settings.widePageZoom ?? true),
      keepScreen: Boolean(loaded.keepScreen ?? settings.keepScreenOn ?? true),
      preload: Math.max(0, Math.min(20, Number(loaded.preload ?? settings.preloadPages ?? 2))),
    };
  }, [activeReader?.media?.id, settings]);

  const initialSettings = useMemo(() => getStoredSettings(), [getStoredSettings]);

  // Advanced Reader Settings States
  const [perMangaSettings, setPerMangaSettings] = useState<boolean>(initialSettings.perManga);
  const [readerLayout, setReaderLayout] = useState<'Automatic' | 'Paged' | 'Vertical' | 'Webtoon'>(
    initialSettings.layout
  );
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>(initialSettings.direction);
  const [pageScale, setPageScale] = useState<'Fit' | 'Fit Width' | 'Original' | 'Fill'>(initialSettings.scale);
  const [zoomStart, setZoomStart] = useState<'Automatic' | 'Left' | 'Center' | 'Right'>(initialSettings.zoom);
  const [pageTurnAnim, setPageTurnAnim] = useState<'Off' | 'Default' | 'Book Flip'>(initialSettings.anim);
  const [pageTurnSound, setPageTurnSound] = useState<'Off' | '1' | '2' | '3' | '4'>(initialSettings.sound);
  const [pageAppearance, setPageAppearance] = useState<'black' | 'dark' | 'light'>(initialSettings.appearance);
  const [cropBorders, setCropBorders] = useState<boolean>(initialSettings.crop);
  const [autoWebtoon, setAutoWebtoon] = useState<boolean>(initialSettings.autoWebtoon);
  const [widePageZoom, setWidePageZoom] = useState<boolean>(initialSettings.wideZoom);
  const [keepScreenOn, setKeepScreenOn] = useState<boolean>(initialSettings.keepScreen);
  const [preloadPagesCount, setPreloadPagesCount] = useState<number>(initialSettings.preload);

  // Auto-sync settings to localStorage (Per-Manga vs Global)
  const saveActiveSettings = useCallback(
    (overrides: Partial<ReturnType<typeof getStoredSettings>> = {}) => {
      if (!activeReader?.media?.id) return;
      const isPer = overrides.perManga !== undefined ? overrides.perManga : perMangaSettings;
      const storageKey = isPer
        ? `satori_manga_custom_${activeReader.media.id}`
        : 'satori_manga_global_settings';

      const payload = {
        layout: overrides.layout ?? readerLayout,
        direction: overrides.direction ?? readingDirection,
        scale: overrides.scale ?? pageScale,
        zoom: overrides.zoom ?? zoomStart,
        anim: overrides.anim ?? pageTurnAnim,
        sound: overrides.sound ?? pageTurnSound,
        appearance: overrides.appearance ?? pageAppearance,
        crop: overrides.crop ?? cropBorders,
        autoWebtoon: overrides.autoWebtoon ?? autoWebtoon,
        wideZoom: overrides.wideZoom ?? widePageZoom,
        keepScreen: overrides.keepScreen ?? keepScreenOn,
        preload: overrides.preload ?? preloadPagesCount,
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
        localStorage.setItem(`satori_manga_per_manga_${activeReader.media.id}`, String(isPer));
      } catch {}
    },
    [
      activeReader?.media?.id,
      perMangaSettings,
      readerLayout,
      readingDirection,
      pageScale,
      zoomStart,
      pageTurnAnim,
      pageTurnSound,
      pageAppearance,
      cropBorders,
      autoWebtoon,
      widePageZoom,
      keepScreenOn,
      preloadPagesCount,
    ]
  );

  const handleMangaResetToDefaults = () => {
    setPerMangaSettings(false);
    setReaderLayout('Automatic');
    setReadingDirection('ltr');
    setPageScale('Fit');
    setZoomStart('Automatic');
    setPageTurnAnim('Default');
    setPageTurnSound('Off');
    setPageAppearance('black');
    setCropBorders(false);
    setAutoWebtoon(true);
    setWidePageZoom(true);
    setKeepScreenOn(true);
    setPreloadPagesCount(2);
    setNovelFontSize('base');
    saveActiveSettings({
      perManga: false,
      layout: 'Automatic',
      direction: 'ltr',
      scale: 'Fit',
      zoom: 'Automatic',
      anim: 'Default',
      sound: 'Off',
      appearance: 'black',
      crop: false,
      autoWebtoon: true,
      wideZoom: true,
      keepScreen: true,
      preload: 2,
    });
    try {
      localStorage.removeItem('satori_manga_global_settings');
      localStorage.removeItem('satori_manga_direction');
      localStorage.removeItem('satori_manga_layout_global');
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (
          k.startsWith('satori_manga_per_manga_') ||
          k.startsWith('satori_manga_layout_') ||
          k.startsWith('satori_manga_custom_')
        ) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
    showMangaSettingsToast('Reader settings reset to defaults');
  };

  // Effective layout resolving 'Automatic' based on autoWebtoon & page characteristics
  const effectiveLayout = useMemo<'Paged' | 'Vertical' | 'Webtoon'>(() => {
    if (readerLayout === 'Paged') return 'Paged';
    if (readerLayout === 'Vertical') return 'Vertical';
    if (readerLayout === 'Webtoon') return 'Webtoon';
    // 'Automatic': default to Webtoon if autoWebtoon is on and pages exist, else Paged
    return autoWebtoon ? 'Webtoon' : 'Paged';
  }, [readerLayout, autoWebtoon]);

  // Backward compatibility alias for existing mode checks
  const readerMode = effectiveLayout === 'Paged' ? 'Paged' : 'Webtoon';
  const readerBg = pageAppearance;

  // Sound generator using Web Audio API for zero-dependency realistic audio page turns
  const playPageSound = useCallback(
    (type: '1' | '2' | '3' | '4') => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === '1') {
          // Soft crisp paper rustle
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === '2') {
          // Deep book page flick
          osc.type = 'sine';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === '3') {
          // Light paper sweep
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.06);
        } else if (type === '4') {
          // Solid mechanical click/page
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        }
      } catch (err) {
        // audio policy fallback
      }
    },
    []
  );

  const isNovel = activeReader?.media?.category === 'novel';

  // Novel Reader Settings state (Strictly matching Novel Reader Settings Sheet)
  const [novelSettings, setNovelSettings] = useState<NovelReaderSettings>(() => {
    try {
      const mediaId = activeReader?.media?.id;
      if (mediaId) {
        const per = localStorage.getItem(`satori_novel_per_${mediaId}`);
        if (per) {
          return { ...DEFAULT_NOVEL_SETTINGS, ...JSON.parse(per) };
        }
      }
      const globalSettings = localStorage.getItem('satori_novel_settings_global');
      if (globalSettings) {
        return { ...DEFAULT_NOVEL_SETTINGS, ...JSON.parse(globalSettings) };
      }
    } catch {}
    return DEFAULT_NOVEL_SETTINGS;
  });

  const handleNovelSettingsChange = useCallback((newSettings: NovelReaderSettings) => {
    setNovelSettings(newSettings);
    try {
      const mediaId = activeReader?.media?.id;
      if (newSettings.perNovelSettings && mediaId) {
        localStorage.setItem(`satori_novel_per_${mediaId}`, JSON.stringify(newSettings));
      } else {
        localStorage.setItem('satori_novel_settings_global', JSON.stringify(newSettings));
        if (mediaId) {
          localStorage.removeItem(`satori_novel_per_${mediaId}`);
        }
      }
    } catch {}
  }, [activeReader?.media?.id]);

  // Keep screen awake using WakeLock API
  useEffect(() => {
    let wakeLock: any = null;
    const shouldKeep = isNovel ? novelSettings.keepScreenAwake : keepScreenOn;
    if (shouldKeep && 'wakeLock' in navigator) {
      (navigator as any).wakeLock
        ?.request('screen')
        .then((lock: any) => {
          wakeLock = lock;
        })
        .catch(() => {});
    }
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isNovel, novelSettings.keepScreenAwake, keepScreenOn]);

  // Novel dynamic canvas background & text styling strictly based on Novel Reader Page Color setting
  const novelColorStyles = useMemo(() => {
    switch (novelSettings.pageColor) {
      case 'paper':
        return { bg: '#FFFFFF', text: '#1a1a24', border: 'transparent' };
      case 'sepia':
        return { bg: '#F5EEDC', text: '#4a3b2c', border: 'transparent' };
      case 'dark':
        return { bg: '#222430', text: '#FFFFFF', border: 'transparent' };
      case 'amoled':
        return { bg: '#000000', text: '#FFFFFF', border: 'transparent' };
      case 'custom':
        return {
          bg: novelSettings.customColors?.background || '#171717',
          text: novelSettings.customColors?.text || '#ededed',
          border: 'transparent',
        };
      default:
        return { bg: '#FFFFFF', text: '#1a1a24', border: 'transparent' };
    }
  }, [novelSettings.pageColor, novelSettings.customColors]);

  // Manga dynamic canvas background & text styling strictly based on Manga Reader Page Appearance setting
  const mangaColorStyles = useMemo(() => {
    const app = (pageAppearance || '').toLowerCase();
    if (app === 'light' || app === 'white') {
      return { bg: '#ebe7e0', text: '#1a1a24', subtext: 'rgba(26, 26, 36, 0.7)', isDark: false };
    }
    if (app === 'dark' || app === 'dark gray') {
      return { bg: '#1e1e28', text: '#ffffff', subtext: 'rgba(255, 255, 255, 0.65)', isDark: true };
    }
    return { bg: '#000000', text: '#ffffff', subtext: 'rgba(255, 255, 255, 0.6)', isDark: true };
  }, [pageAppearance]);

  const novelFontFamily = useMemo(() => {
    switch (novelSettings.typography) {
      case 'Bookerly':
        return '"Literata", "Bookerly", "Merriweather", Georgia, serif';
      case 'EB Garamond':
        return '"EB Garamond", Garamond, "Times New Roman", serif';
      case 'Bembolz':
        return '"Bembo", "Palatino Linotype", "Book Antiqua", Palatino, serif';
      case 'Comic Sans':
        return '"Comic Sans MS", "Comic Sans", cursive, sans-serif';
      case 'System Serif':
        return 'serif';
      case 'System Sans':
        return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      case 'Monospace':
        return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      case 'Custom':
        return novelSettings.customFontName ? `"${novelSettings.customFontName}", serif` : 'serif';
      default:
        return 'serif';
    }
  }, [novelSettings.typography, novelSettings.customFontName]);

  const isNovelVertical = useMemo(() => {
    if (novelSettings.pageLayout === 'vertical') return true;
    if (novelSettings.pageLayout === 'paged') return false;
    return typeof window !== 'undefined' ? window.innerWidth < 768 : true;
  }, [novelSettings.pageLayout]);

  // Auto-hide controls state (3s timer)
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals / Drawers
  const [showChaptersDrawer, setShowChaptersDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Chapters list for drawer
  const [availableChapters, setAvailableChapters] = useState<Array<{ id: string; chapter: string; title: string; coverImage?: string }>>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chapterFilterQuery, setChapterFilterQuery] = useState('');
  const [drawerTab, setDrawerTab] = useState<'chapters' | 'bookmarks'>('chapters');
  const [chapterRangeFilter, setChapterRangeFilter] = useState<'All' | string>('All');
  const [bookmarks, setBookmarks] = useState<MangaBookmark[]>([]);

  // Load bookmarks from localStorage for current media
  useEffect(() => {
    if (!activeReader?.media?.id) return;
    try {
      const storageKey = `satori_manga_bookmarks_${activeReader.media.id}`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setBookmarks(JSON.parse(raw));
      } else {
        setBookmarks([]);
      }
    } catch (err) {
      console.warn('Failed to load bookmarks:', err);
      setBookmarks([]);
    }
  }, [activeReader?.media?.id]);

  const saveBookmarks = useCallback((newBookmarks: MangaBookmark[]) => {
    setBookmarks(newBookmarks);
    if (activeReader?.media?.id) {
      try {
        const storageKey = `satori_manga_bookmarks_${activeReader.media.id}`;
        localStorage.setItem(storageKey, JSON.stringify(newBookmarks));
      } catch (err) {
        console.warn('Failed to save bookmarks to localStorage:', err);
      }
    }
  }, [activeReader?.media?.id]);

  // Dynamic API content state
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mangaPages, setMangaPages] = useState<string[]>([]);
  const [novelData, setNovelData] = useState<AnifyNovelChapterContent | null>(null);
  const [novelFontSize, setNovelFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

  // Preload next N pages in browser cache
  useEffect(() => {
    if (!mangaPages || mangaPages.length === 0 || preloadPagesCount <= 0) return;
    const startIndex = currentPage;
    const endIndex = Math.min(mangaPages.length, currentPage + preloadPagesCount);
    for (let i = startIndex; i < endIndex; i++) {
      const pageUrl = mangaPages[i];
      if (pageUrl) {
        const src = formatPageSrc(pageUrl);
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.src = src;
      }
    }
  }, [currentPage, mangaPages, preloadPagesCount]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const programmaticScrollRef = useRef(false);
  const isSliderActiveRef = useRef(false);
  const pendingBookmarkPageRef = useRef<number | null>(null);

  // Touch Swipe Gesture Tracking for Mobile Paged Reading
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Horizontal swipe in Paged mode
    if (effectiveLayout === 'Paged' && Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const isSwipeLeft = deltaX < 0;
      const isSwipeRight = deltaX > 0;
      const goForward = readingDirection === 'ltr' ? isSwipeLeft : isSwipeRight;

      if (goForward) {
        if (currentPage < (mangaPages.length || 1)) {
          scrollToPage(currentPage + 1, false);
          if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
        } else if (hasNextChapter) {
          handleNextChapter();
        }
      } else {
        if (currentPage > 1) {
          scrollToPage(currentPage - 1, false);
          if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
        } else if (hasPrevChapter) {
          handlePrevChapter();
        }
      }
    }

    // Vertical swipe in Vertical mode (Single Page)
    if (effectiveLayout === 'Vertical' && Math.abs(deltaY) > 40 && Math.abs(deltaY) > Math.abs(deltaX)) {
      const isSwipeUp = deltaY < 0;
      const isSwipeDown = deltaY > 0;

      if (isSwipeUp) {
        if (currentPage < (mangaPages.length || 1)) {
          scrollToPage(currentPage + 1, false);
          if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
        } else if (hasNextChapter) {
          handleNextChapter();
        }
      } else if (isSwipeDown) {
        if (currentPage > 1) {
          scrollToPage(currentPage - 1, false);
          if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
        } else if (hasPrevChapter) {
          handlePrevChapter();
        }
      }
    }
  };

  // Clear hide timer
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  // Start 3s auto-hide timer
  const startHideTimer = useCallback(() => {
    clearHideTimer();
    if (showChaptersDrawer || showSettingsDrawer || isSliderActiveRef.current) return;
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [clearHideTimer, showChaptersDrawer, showSettingsDrawer]);

  // Reset timer (keeps controls shown and sets 3s timer)
  const resetActivityTimer = useCallback(() => {
    setShowControls(true);
    startHideTimer();
  }, [startHideTimer]);

  // Immediately hide controls when user scrolls reader canvas (ignored during programmatic scroll or active slider interaction)
  const handleScrollHide = useCallback(() => {
    if (programmaticScrollRef.current || isSliderActiveRef.current) return;
    if (showControls && !showChaptersDrawer && !showSettingsDrawer) {
      setShowControls(false);
      clearHideTimer();
    }
  }, [showControls, showChaptersDrawer, showSettingsDrawer, clearHideTimer]);

  // Toggle / appear controls manually only when tapping within the bottom 40% of the screen
  const handleReaderCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Determine the vertical click/touch position relative to the screen height
    let clientY = 0;
    if ('clientY' in e && typeof (e as React.MouseEvent).clientY === 'number') {
      clientY = (e as React.MouseEvent).clientY;
    } else if ('touches' in e && (e as React.TouchEvent).touches && (e as React.TouchEvent).touches[0]) {
      clientY = (e as React.TouchEvent).touches[0].clientY;
    } else if ('changedTouches' in e && (e as React.TouchEvent).changedTouches && (e as React.TouchEvent).changedTouches[0]) {
      clientY = (e as React.TouchEvent).changedTouches[0].clientY;
    }

    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    // Bottom 40% is Y >= 60% of viewport height
    const isBottom40Percent = clientY >= windowHeight * 0.60;

    // If clicked in the top 60% of the screen (0% to 60%), bars MUST NOT appear
    if (!isBottom40Percent) {
      if (showControls && !showChaptersDrawer && !showSettingsDrawer) {
        setShowControls(false);
        clearHideTimer();
      }
      return;
    }

    // If clicked in the bottom 40% of the screen (60% to 100%), appear / toggle bars
    setShowControls((prev) => {
      const next = !prev;
      if (next) {
        startHideTimer();
      } else {
        clearHideTimer();
      }
      return next;
    });
  };

  useEffect(() => {
    startHideTimer();
    return () => {
      clearHideTimer();
    };
  }, [startHideTimer, clearHideTimer, showChaptersDrawer, showSettingsDrawer]);

  // Auto-record progress in history & existing library
  useEffect(() => {
    if (activeReader) {
      recordMangaReadingProgress(
        activeReader.media,
        activeReader.chapterNumber,
        activeReader.chapterId,
        currentPage
      );
    }
  }, [activeReader?.media.id, activeReader?.chapterNumber, activeReader?.chapterId]);

  // Fetch real, complete Chapters list for the Chapters Drawer (no missing chapters)
  useEffect(() => {
    if (!activeReader?.media?.id) return;
    const media = activeReader.media;
    const mediaId = media.id;

    // Fast path: if chapters list is already cached, apply immediately without triggering skeleton loading
    if (globalReaderChaptersCache.has(mediaId)) {
      setAvailableChapters(globalReaderChaptersCache.get(mediaId)!);
      setLoadingChapters(false);
      return;
    }

    let isCancelled = false;
    async function loadChaptersList() {
      setLoadingChapters(true);
      try {
        const chapterNumber = activeReader?.chapterNumber || 1;
        if (media.category === 'novel') {
          const novelChapters = await fetchMediaNovelChapters(media);
          if (isCancelled) return;
          if (novelChapters && novelChapters.length > 0) {
            const mapped = novelChapters.map((c) => ({
              id: c.id,
              chapter: String(c.chapterNumber),
              title: c.title || `Volume ${c.chapterNumber}`,
              coverImage: c.coverImage,
            }));
            // Preload images into browser memory immediately
            if (typeof window !== 'undefined') {
              mapped.forEach((c) => {
                if (c.coverImage) {
                  const img = new Image();
                  img.src = c.coverImage;
                  img.onload = () => globalLoadedCoverImages.add(c.coverImage!);
                }
              });
            }
            globalReaderChaptersCache.set(mediaId, mapped);
            setAvailableChapters(mapped);
            return;
          }
        } else {
          // Manga: fetch complete sequence from MangaDex + AniList
          const chapters = await fetchMediaMangaChapters(media);
          if (isCancelled) return;
          if (chapters && chapters.length > 0) {
            const list = chapters.map((c) => ({
              id: c.id,
              chapter: String(c.chapterNumber),
              title: c.title || `Chapter ${c.chapterNumber}`,
            }));

            // If current active chapter is beyond returned list, ensure it's included up to max
            const maxKnown = Math.max(
              chapterNumber,
              media.totalChapters || 0,
              ...chapters.map((c) => c.chapterNumber)
            );
            if (maxKnown > list.length) {
              const existingNums = new Set(chapters.map((c) => c.chapterNumber));
              for (let i = 1; i <= maxKnown; i++) {
                if (!existingNums.has(i)) {
                  list.push({
                    id: `manga-ch-${media.id}-${i}`,
                    chapter: String(i),
                    title: `Chapter ${i}`,
                  });
                }
              }
              list.sort((a, b) => (parseFloat(a.chapter) || 0) - (parseFloat(b.chapter) || 0));
            }

            globalReaderChaptersCache.set(mediaId, list);
            setAvailableChapters(list);
            return;
          }
        }

        // Fallback: create complete list from totalChapters or current chapterNumber
        const total = Math.max(media.totalChapters || media.totalVolumes || 0, chapterNumber, 1);
        const generated = Array.from({ length: total }, (_, i) => ({
          id: `ch-${i + 1}`,
          chapter: String(i + 1),
          title: media.category === 'novel' ? `Volume ${i + 1}` : `Chapter ${i + 1}`,
          coverImage: media.coverImage,
        }));
        if (!isCancelled) {
          globalReaderChaptersCache.set(mediaId, generated);
          setAvailableChapters(generated);
        }
      } catch (err) {
        console.warn('Failed to load chapters list:', err);
      } finally {
        if (!isCancelled) setLoadingChapters(false);
      }
    }

    loadChaptersList();
    return () => {
      isCancelled = true;
    };
  }, [activeReader?.media?.id]);

  // Fetch real MangaDex pages or Anify Novel chapter text
  useEffect(() => {
    let isCancelled = false;

    async function loadChapter() {
      if (!activeReader) return;
      const { media, chapterNumber } = activeReader;
      const isNovel = media.category === 'novel';

      setIsLoading(true);
      setErrorMsg(null);
      setMangaPages([]);
      setNovelData(null);
      const targetStartPage = pendingBookmarkPageRef.current || 1;
      pendingBookmarkPageRef.current = null;
      setCurrentPage(targetStartPage);

      try {
        if (isNovel) {
          const content = await getNovelChapterContent(media.id, chapterNumber, {
            title: media.title,
          });

          if (isCancelled) return;
          if (content && content.content && content.content.length > 50) {
            setNovelData(content);
            if (targetStartPage > 1) {
              setTimeout(() => {
                scrollToPage(targetStartPage, true);
              }, 150);
            }
          } else {
            const desc = media.description || '';
            const rawParagraphs = desc.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

            const synthesizedParagraphs = [
              `[ Light Novel Volume ${chapterNumber} ]`,
              `Official Series: ${media.title}`,
              rawParagraphs.length > 0
                ? rawParagraphs[0]
                : `The epic journey continues in Volume ${chapterNumber} of ${media.title}.`,
              `PROLOGUE: The Dawning Chronicles`,
              rawParagraphs.length > 1
                ? rawParagraphs[1]
                : `New challenges arise as the protagonists confront unprecedented obstacles in their world.`,
              `CHAPTER 1: The Gathering Tempest`,
              rawParagraphs.length > 2
                ? rawParagraphs.slice(2).join('\n\n')
                : `Unfolding events lead to unexpected alliances and revelations across the realm. Every choice carries weight as the story deepens.`,
              `EPILOGUE: Footsteps Toward Tomorrow`,
              `With the close of Volume ${chapterNumber}, new paths unfold for what lies ahead in the upcoming volume.`,
            ];

            setNovelData({
              chapterNumber,
              title: `${media.title} — Volume ${chapterNumber}`,
              content: synthesizedParagraphs.join('\n\n'),
              paragraphs: synthesizedParagraphs,
              providerId: 'Anify & Satori Reader',
            });
            if (targetStartPage > 1) {
              setTimeout(() => {
                scrollToPage(targetStartPage, true);
              }, 150);
            }
          }
        } else {
          // Manga mode: fetch real pages with strict MAL ID & multi-strategy matching
          const { chapterId } = activeReader;
          const altTitles = [
            media.romajiTitle,
            media.nativeTitle,
            media.englishTitle,
            ...(media.synonyms || []),
          ].filter(Boolean) as string[];
          const pages = await getMangaPages(
            media.title,
            chapterNumber,
            chapterId,
            altTitles,
            media.id,
            media.idMal
          );
          if (isCancelled) return;

          if (pages && pages.length > 0) {
            setMangaPages(pages);
          } else {
            const fallbackPages = [
              media.coverImage,
              media.bannerImage || media.coverImage,
            ].filter(Boolean) as string[];
            setMangaPages(fallbackPages);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          if (isNovel) {
            const desc = media.description || '';
            const rawParagraphs = desc.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
            setNovelData({
              chapterNumber,
              title: `${media.title} — Volume ${chapterNumber}`,
              content: desc || `Light Novel Volume ${chapterNumber} of ${media.title}`,
              paragraphs: rawParagraphs.length > 0 ? rawParagraphs : [`Volume ${chapterNumber} for ${media.title}`],
              providerId: 'Satori Reader',
            });
          } else {
            const fallbackPages = [
              media.coverImage,
              media.bannerImage || media.coverImage,
            ].filter(Boolean) as string[];
            if (fallbackPages.length > 0) {
              setMangaPages(fallbackPages);
            } else {
              setErrorMsg(err?.message || 'Failed to load chapter content. Please try again.');
            }
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadChapter();

    return () => {
      isCancelled = true;
    };
  }, [activeReader?.media?.id, activeReader?.media?.title, activeReader?.chapterNumber, activeReader?.media?.category]);

  // Compute sorted chapters and boundary navigation flags
  const sortedChapters = useMemo(() => {
    if (!availableChapters || availableChapters.length === 0) return [];
    return [...availableChapters].sort((a, b) => {
      const numA = parseFloat(a.chapter) || 0;
      const numB = parseFloat(b.chapter) || 0;
      return numA - numB;
    });
  }, [availableChapters]);

  const currentChapterIdx = useMemo(() => {
    if (!activeReader || sortedChapters.length === 0) return -1;
    return sortedChapters.findIndex(
      (c) => parseFloat(c.chapter) === activeReader.chapterNumber || (activeReader.chapterId && c.id === activeReader.chapterId)
    );
  }, [activeReader, sortedChapters]);

  const hasPrevChapter = useMemo(() => {
    if (!activeReader) return false;
    if (sortedChapters.length > 0 && currentChapterIdx !== -1) {
      return currentChapterIdx > 0;
    }
    return activeReader.chapterNumber > 1;
  }, [activeReader, sortedChapters.length, currentChapterIdx]);

  const hasNextChapter = useMemo(() => {
    if (!activeReader) return false;
    const total = activeReader.media.totalChapters || activeReader.media.totalVolumes || 100;
    if (sortedChapters.length > 0 && currentChapterIdx !== -1) {
      return currentChapterIdx < sortedChapters.length - 1;
    }
    return activeReader.chapterNumber < total;
  }, [activeReader, sortedChapters.length, currentChapterIdx]);

  // Distinct base integer chapters count (e.g. chapters 8 and 8.5 both belong to base chapter 8, so 8.5 is included in list and group but not double-counted in base count)
  const { effectiveTotalChapters, maxChapterInteger } = useMemo(() => {
    if (!activeReader) return { effectiveTotalChapters: 0, maxChapterInteger: 0 };
    if (sortedChapters.length === 0) {
      const fallback = activeReader.media.totalChapters || activeReader.media.totalVolumes || (loadingChapters ? 0 : 1);
      return { effectiveTotalChapters: fallback, maxChapterInteger: fallback };
    }
    const uniqueInts = new Set<number>();
    let maxInt = 0;
    sortedChapters.forEach((c) => {
      const num = parseFloat(c.chapter);
      if (!isNaN(num)) {
        const baseInt = Math.floor(num);
        if (baseInt > 0) {
          uniqueInts.add(baseInt);
          if (baseInt > maxInt) maxInt = baseInt;
        }
      }
    });
    const distinctCount = uniqueInts.size > 0 ? uniqueInts.size : sortedChapters.length;
    const maxVal = maxInt > 0 ? maxInt : distinctCount;
    return { effectiveTotalChapters: distinctCount, maxChapterInteger: maxVal };
  }, [activeReader, sortedChapters, loadingChapters]);

  const chapterChunks = useMemo(() => {
    if (isNovel) return [];
    const total = maxChapterInteger || effectiveTotalChapters;
    if (total <= 0) return [];
    const chunkSize = 25;
    const chunks: string[] = [];
    const numChunks = Math.ceil(total / chunkSize);
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize + 1;
      const end = Math.min((i + 1) * chunkSize, total);
      chunks.push(`${start}-${end}`);
    }
    return chunks;
  }, [maxChapterInteger, effectiveTotalChapters, isNovel]);

  const displayChaptersList = useMemo(() => {
    let baseList = sortedChapters;
    if (baseList.length === 0 && effectiveTotalChapters > 0) {
      baseList = Array.from({ length: effectiveTotalChapters }, (_, i) => ({
        id: `ch-${i + 1}`,
        chapter: String(i + 1),
        title: isNovel ? `Volume ${i + 1}` : `Chapter ${i + 1}`,
        coverImage: activeReader?.media?.coverImage,
      }));
    }

    if (isNovel) {
      // In Novel mode, all volumes are displayed in a clean 3-column grid without grouping or chunking
      return baseList;
    }

    return baseList.filter((ch) => {
      const chNum = parseFloat(ch.chapter) || 0;
      if (chapterRangeFilter !== 'All') {
        const parts = chapterRangeFilter.split('-').map(Number);
        if (parts.length === 2) {
          const [start, end] = parts;
          const baseInt = Math.floor(chNum);
          if (start === 1) {
            if (baseInt > end) return false;
          } else {
            if (baseInt < start || baseInt > end) return false;
          }
        }
      }
      if (chapterFilterQuery.trim()) {
        const q = chapterFilterQuery.toLowerCase().trim();
        return ch.chapter.includes(q) || (ch.title && ch.title.toLowerCase().includes(q));
      }
      return true;
    });
  }, [sortedChapters, effectiveTotalChapters, chapterRangeFilter, chapterFilterQuery, isNovel, activeReader?.media?.coverImage]);

  // Format novel text into distinct, readable pages (2-3 paragraphs per page)
  const novelPages = useMemo(() => {
    if (!isNovel || !novelData || !activeReader) return [];
    const paras = novelData.paragraphs && novelData.paragraphs.length > 0
      ? novelData.paragraphs
      : (novelData.content || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    if (paras.length === 0) {
      return [
        {
          pageNumber: 1,
          paragraphs: [`${novelData.title || (activeReader.media.title + ' — Volume ' + activeReader.chapterNumber)}\n\nLoading text content from novel provider...`],
        },
      ];
    }

    const pages: Array<{ pageNumber: number; paragraphs: string[] }> = [];
    let currentGroup: string[] = [];
    let charCount = 0;

    for (const p of paras) {
      currentGroup.push(p);
      charCount += p.length;
      if (currentGroup.length >= 3 || charCount >= 650) {
        pages.push({
          pageNumber: pages.length + 1,
          paragraphs: currentGroup,
        });
        currentGroup = [];
        charCount = 0;
      }
    }
    if (currentGroup.length > 0) {
      pages.push({
        pageNumber: pages.length + 1,
        paragraphs: currentGroup,
      });
    }
    return pages;
  }, [isNovel, novelData, activeReader]);

  // Check if current chapter/page has a saved bookmark (Must be called before any early return to satisfy Rules of Hooks)
  const isBookmarked = useMemo(() => {
    if (!activeReader) return false;
    const chNum = activeReader.chapterNumber;
    return bookmarks.some(
      (b) => b.chapterNumber === chNum && b.page === currentPage
    );
  }, [bookmarks, activeReader, currentPage]);

  if (!activeReader) return null;

  const { media, chapterNumber } = activeReader;

  const totalChapters = media.totalChapters || media.totalVolumes || 100;
  const totalPages = isNovel ? (novelPages.length || 1) : (mangaPages.length || 1);
  const hasRevealedPages = !isLoading && !errorMsg && (isNovel ? (!!novelData && novelPages.length > 0) : mangaPages.length > 0);
  const canBookmark = hasRevealedPages && (isNovel ? novelPages.length > 0 : mangaPages.length > 0);

  const effectiveDisplayPage = draggingPage !== null ? draggingPage : currentPage;
  const effectiveTotalPages = totalPages;

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeReader || !canBookmark) return;

    const chNum = activeReader.chapterNumber;
    const mediaId = activeReader.media.id;

    if (isNovel) {
      if (isBookmarked) {
        // Remove bookmark for this specific volume and page
        const next = bookmarks.filter(
          (b) => !(b.chapterNumber === chNum && b.page === currentPage)
        );
        saveBookmarks(next);
        showToast(`Removed Bookmark (Volume ${chNum}, Page ${currentPage})`);
      } else {
        // Save bookmark for this specific volume and page with text snippet
        const pageParagraphs = novelPages[currentPage - 1]?.paragraphs;
        const pageSnippet =
          pageParagraphs && pageParagraphs.length > 0
            ? pageParagraphs.join(' ')
            : novelData?.content || media.description || '';
        const cleanedSnippet = pageSnippet.replace(/\s+/g, ' ').trim().slice(0, 260);

        const newBm: MangaBookmark = {
          id: `bm_${mediaId}_v${chNum}_p${currentPage}_${Date.now()}`,
          mediaId: mediaId,
          chapterNumber: chNum,
          chapterId: activeReader.chapterId,
          page: currentPage,
          totalPages: totalPages || 1,
          textSnippet: cleanedSnippet,
          createdAt: Date.now(),
        };
        const next = [
          newBm,
          ...bookmarks.filter((b) => !(b.chapterNumber === chNum && b.page === currentPage)),
        ];
        saveBookmarks(next);
        showToast(`Saved Bookmark: Volume ${chNum} (Page ${currentPage})`);
      }
    } else {
      // Manga mode: page-level toggle
      if (isBookmarked) {
        // Remove bookmark for this specific chapter and page
        const next = bookmarks.filter(
          (b) => !(b.chapterNumber === chNum && b.page === currentPage)
        );
        saveBookmarks(next);
        showToast(`Removed Bookmark (Chapter ${chNum}, Page ${currentPage})`);
      } else {
        // Save bookmark for this specific chapter and page
        const newBm: MangaBookmark = {
          id: `bm_${mediaId}_ch${chNum}_p${currentPage}_${Date.now()}`,
          mediaId: mediaId,
          chapterNumber: chNum,
          chapterId: activeReader.chapterId,
          page: currentPage,
          totalPages: totalPages || 1,
          createdAt: Date.now(),
        };
        const next = [
          newBm,
          ...bookmarks.filter((b) => !(b.chapterNumber === chNum && b.page === currentPage)),
        ];
        saveBookmarks(next);
        showToast(`Saved Bookmark: Chapter ${chNum} (Page ${currentPage})`);
      }
    }
  };

  const scrollToPage = (pageIdx: number, instant: boolean = false) => {
    const bounded = Math.max(1, Math.min(pageIdx, totalPages));
    setCurrentPage(bounded);
    programmaticScrollRef.current = true;
    setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 400);

    if (isNovel && isNovelVertical) {
      const targetEl = document.getElementById(`novel-page-${bounded}`);
      if (targetEl && scrollContainerRef.current) {
        targetEl.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
      }
    } else if (!isNovel && effectiveLayout === 'Webtoon') {
      const targetEl = document.getElementById(`manga-page-${bounded}`);
      if (targetEl && scrollContainerRef.current) {
        targetEl.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
      }
    }
  };

  const handleSliderStart = (val?: number) => {
    isSliderActiveRef.current = true;
    clearHideTimer();
    setShowControls(true);
    if (val !== undefined && !isNaN(val)) {
      setDraggingPage(val);
    }
  };

  const handleSliderMove = (val: number) => {
    isSliderActiveRef.current = true;
    clearHideTimer();
    setShowControls(true);
    setDraggingPage(val);
  };

  const handleSliderEnd = () => {
    isSliderActiveRef.current = false;
    if (draggingPage !== null) {
      scrollToPage(draggingPage, true);
      setDraggingPage(null);
    }
    startHideTimer();
  };

  const handleNextChapter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasNextChapter) return;

    if (sortedChapters.length > 0 && currentChapterIdx !== -1 && currentChapterIdx < sortedChapters.length - 1) {
      const next = sortedChapters[currentChapterIdx + 1];
      const nextNum = parseFloat(next.chapter) || (chapterNumber + 1);
      setActiveReader({ media, chapterNumber: nextNum, chapterId: next.id });
      setCurrentPage(1);
      setDraggingPage(null);
      showToast(isNovel ? `Switched to Volume ${next.chapter || nextNum}` : `Switched to Chapter ${next.chapter || nextNum}`);
    } else if (chapterNumber < totalChapters) {
      setActiveReader({ media, chapterNumber: chapterNumber + 1 });
      setCurrentPage(1);
      setDraggingPage(null);
      showToast(isNovel ? `Switched to Volume ${chapterNumber + 1}` : `Switched to Chapter ${chapterNumber + 1}`);
    }
    resetActivityTimer();
  };

  const handlePrevChapter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasPrevChapter) return;

    if (sortedChapters.length > 0 && currentChapterIdx > 0) {
      const prev = sortedChapters[currentChapterIdx - 1];
      const prevNum = parseFloat(prev.chapter) || (chapterNumber - 1);
      setActiveReader({ media, chapterNumber: prevNum, chapterId: prev.id });
      setCurrentPage(1);
      setDraggingPage(null);
      showToast(isNovel ? `Switched to Volume ${prev.chapter || prevNum}` : `Switched to Chapter ${prev.chapter || prevNum}`);
    } else if (chapterNumber > 1) {
      setActiveReader({ media, chapterNumber: chapterNumber - 1 });
      setCurrentPage(1);
      setDraggingPage(null);
      showToast(isNovel ? `Switched to Volume ${chapterNumber - 1}` : `Switched to Chapter ${chapterNumber - 1}`);
    }
    resetActivityTimer();
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      scrollToPage(currentPage + 1);
      handleScrollHide();
    } else if (hasNextChapter) {
      handleNextChapter();
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
      handleScrollHide();
    } else if (hasPrevChapter) {
      handlePrevChapter();
    }
  };

  const handleRetry = () => {
    if (!activeReader) return;
    setActiveReader({ ...activeReader });
    resetActivityTimer();
  };

  const toggleControls = () => {
    setShowControls((prev) => !prev);
    if (!showControls) {
      resetActivityTimer();
    } else if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
  };

  const displayPage = effectiveDisplayPage;
  const currentIndicatorPosition =
    effectiveTotalPages <= 1
      ? '50%'
      : `calc(10px + (100% - 20px) * ${Math.max(0, Math.min(1, (effectiveDisplayPage - 1) / (effectiveTotalPages - 1)))})`;
  const currentPreloadIndicatorPosition = `calc(10px + (100% - 20px) * ${Math.max(0, Math.min(20, preloadPagesCount)) / 20})`;

  return (
    <div
      onMouseMove={() => {
        if (showControls) resetActivityTimer();
      }}
      className="fixed inset-0 z-[5000] flex flex-col justify-between overflow-hidden select-none transition-colors duration-300"
      style={{
        backgroundColor: isNovel ? novelColorStyles.bg : mangaColorStyles.bg,
        color: isNovel ? novelColorStyles.text : mangaColorStyles.text,
      }}
    >
      {/* 1. TOP OVERLAY TOOLBAR (Exact screenshot layout: Translucent dark background revealing underlying artwork) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
          showControls ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="bg-black/60 py-3 px-4 sm:px-6 shadow-md">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {/* Left: Back & Title */}
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveReader(null);
                }}
                className="p-1.5 -ml-1 text-white hover:bg-white/15 active:scale-95 rounded-full transition-all cursor-pointer flex items-center justify-center"
                title="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate drop-shadow-sm">
                  {media.title}
                </h2>
                <p className="text-xs sm:text-[13px] text-white/70 font-normal leading-tight mt-0.5">
                  {isNovel ? `Volume ${chapterNumber}` : `Chapter ${chapterNumber}`}
                </p>
              </div>
            </div>

            {/* Right: Bookmark Button (Matches screenshot: No container, no border capsule, icon turns purple on click) */}
            <button
              onClick={toggleBookmark}
              disabled={!canBookmark}
              className={`p-2 -mr-1 text-white transition-all flex items-center justify-center focus:outline-none ${
                !canBookmark
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'opacity-100 hover:text-purple-300 active:scale-90 cursor-pointer'
              }`}
              title={!canBookmark ? 'Pages loading...' : isBookmarked ? 'Bookmarked' : 'Add to Bookmarks'}
            >
              <Bookmark
                className={`w-6 h-6 transition-all duration-200 ${
                  isBookmarked && canBookmark
                    ? 'fill-[#a855f7] text-[#a855f7] stroke-[#a855f7]'
                    : 'text-white stroke-white stroke-[2] fill-transparent'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN READER CANVAS / SCROLL CONTAINER */}
      <div
        ref={scrollContainerRef}
        onClick={handleReaderCanvasClick}
        onScroll={(e) => {
          handleScrollHide();
          if (isNovel && isNovelVertical && scrollContainerRef.current && novelPages.length > 1) {
            if (programmaticScrollRef.current) return;
            const container = scrollContainerRef.current;
            const thresholdY = container.scrollTop + 140;
            let visiblePage = 1;
            let minDiff = Infinity;
            for (let i = 1; i <= novelPages.length; i++) {
              const el = document.getElementById(`novel-page-${i}`);
              if (el) {
                const diff = Math.abs(el.offsetTop - thresholdY);
                if (diff < minDiff) {
                  minDiff = diff;
                  visiblePage = i;
                }
              }
            }
            if (visiblePage !== currentPage) {
              setCurrentPage(visiblePage);
            }
          }
        }}
        onTouchMove={handleScrollHide}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleScrollHide}
        className={`w-full h-full no-scrollbar cursor-pointer transition-colors duration-200 ${
          !isNovel && (effectiveLayout === 'Paged' || effectiveLayout === 'Vertical')
            ? 'overflow-hidden p-0 m-0'
            : isNovel && !isNovelVertical
            ? 'overflow-hidden p-0 m-0 flex items-center justify-center'
            : !isNovel && effectiveLayout === 'Webtoon'
            ? 'overflow-y-auto pt-0 pb-16'
            : 'overflow-y-auto pt-14 pb-36'
        }`}
        style={{
          backgroundColor: isNovel ? novelColorStyles.bg : mangaColorStyles.bg,
          color: isNovel ? novelColorStyles.text : mangaColorStyles.text,
        }}
      >
        {isLoading ? (
          <div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center select-none pointer-events-none transition-colors duration-200"
            style={{
              backgroundColor: isNovel ? novelColorStyles.bg : mangaColorStyles.bg,
              color: isNovel ? novelColorStyles.text : mangaColorStyles.text,
            }}
          >
            <p
              className="text-sm sm:text-base font-normal tracking-wide select-none"
              style={{
                color: isNovel ? `${novelColorStyles.text}99` : mangaColorStyles.subtext,
              }}
            >
              Loading chapter...
            </p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center max-w-md mx-auto space-y-4">
            <div className="p-3 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Content Unavailable</h3>
              <p className="text-xs text-white/60">{errorMsg}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        ) : isNovel && novelData ? (
          isNovelVertical ? (
            /* Novel Continuous Vertical Reading Mode - Directly on background canvas without box containers */
            <div
              className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6"
              style={{
                fontFamily: novelFontFamily,
              }}
            >
              <div className="border-b border-current/15 pb-4 mb-6">
                <span className="text-xs uppercase tracking-widest text-[#b876fc] font-sans font-bold">
                  LIGHT NOVEL
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold font-sans tracking-tight text-current mt-1">
                  {novelData.title || `${media.title} — Volume ${chapterNumber}`}
                </h1>
              </div>

              {novelPages.map((page) => (
                <ZoomablePageWrapper key={`novel-page-${page.pageNumber}`} className="w-full">
                  <div
                    id={`novel-page-${page.pageNumber}`}
                    className="w-full bg-transparent border-0 shadow-none rounded-none transition-colors"
                    style={{
                      paddingLeft: `${novelSettings.sideMargin}px`,
                      paddingRight: `${novelSettings.sideMargin}px`,
                      paddingTop: `${novelSettings.topMargin}px`,
                      paddingBottom: `${novelSettings.bottomMargin}px`,
                      fontSize: `${novelSettings.fontSize}px`,
                      fontWeight: novelSettings.fontWeight,
                      lineHeight: novelSettings.lineHeight,
                      textAlign: novelSettings.textAlignment === 'justified' ? 'justify' : 'left',
                      hyphens: novelSettings.hyphenation ? 'auto' : 'manual',
                    }}
                  >
                    <div className="flex items-center justify-between border-b pb-2 mb-5 border-current/15 opacity-40 text-xs font-sans font-semibold uppercase">
                      <span>Volume {chapterNumber}</span>
                      <span>Page {page.pageNumber} of {totalPages}</span>
                    </div>
                    <div className="space-y-4">
                      {page.paragraphs.map((para, paraIdx) => (
                        <p
                          key={paraIdx}
                          className="whitespace-pre-line"
                          style={{ marginBottom: `${novelSettings.paragraphSpacing}px` }}
                        >
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                </ZoomablePageWrapper>
              ))}

              {/* Bottom breathing space at the end of novel volume */}
              <div className="pb-16" />
            </div>
          ) : (
            /* Novel Paged / E-Reader Mode - Directly centered in the screen */
            <div
              className="relative w-full h-[100dvh] min-h-[100dvh] flex items-center justify-center p-3 sm:p-6 select-none overflow-hidden"
              onClick={(e) => {
                if (!novelSettings.edgeTapNavigation) return;
                const { clientX, currentTarget } = e;
                const rect = currentTarget.getBoundingClientRect();
                const clickX = clientX - rect.left;
                const isLeft = clickX < rect.width * 0.32;
                const isRight = clickX > rect.width * 0.68;

                if (isLeft || isRight) {
                  e.stopPropagation();
                  const isDouble = novelSettings.pageSpread === 'double' || (novelSettings.pageSpread === 'automatic' && typeof window !== 'undefined' && window.innerWidth >= 1024);
                  const step = isDouble ? 2 : 1;
                  const goForward = novelSettings.readingDirection === 'ltr' ? isRight : isLeft;
                  if (goForward) {
                    if (currentPage < totalPages) {
                      scrollToPage(Math.min(totalPages, currentPage + step), false);
                      if (novelSettings.pageTurnSound !== 'Off') playPageSound(novelSettings.pageTurnSound);
                    } else if (hasNextChapter) {
                      handleNextChapter(e);
                    }
                  } else {
                    if (currentPage > 1) {
                      scrollToPage(Math.max(1, currentPage - step), false);
                      if (novelSettings.pageTurnSound !== 'Off') playPageSound(novelSettings.pageTurnSound);
                    } else if (hasPrevChapter) {
                      handlePrevChapter(e);
                    }
                  }
                }
              }}
            >
              <ZoomablePageWrapper className="w-full max-w-3xl mx-auto flex items-center justify-center">
                <div
                  className={`w-full bg-transparent border-0 shadow-none rounded-none transition-all ${
                    novelSettings.pageTurn === 'slide' ? 'animate-in fade-in slide-in-from-right-2 duration-150' : ''
                  }`}
                  style={{
                    fontFamily: novelFontFamily,
                    paddingLeft: `${novelSettings.sideMargin}px`,
                    paddingRight: `${novelSettings.sideMargin}px`,
                    paddingTop: `${novelSettings.topMargin}px`,
                    paddingBottom: `${novelSettings.bottomMargin}px`,
                    fontSize: `${novelSettings.fontSize}px`,
                    fontWeight: novelSettings.fontWeight,
                    lineHeight: novelSettings.lineHeight,
                    textAlign: novelSettings.textAlignment === 'justified' ? 'justify' : 'left',
                    hyphens: novelSettings.hyphenation ? 'auto' : 'manual',
                  }}
                >
                  <div className="flex items-center justify-between border-b pb-3 mb-6 border-current/15 opacity-40 text-xs font-sans font-semibold tracking-wider uppercase">
                    <span>{media.title}</span>
                    <span>Vol {chapterNumber} • Page {currentPage}/{totalPages}</span>
                  </div>

                  <div className="min-h-[300px]">
                    {(novelPages[currentPage - 1]?.paragraphs || []).map((para, pIdx) => (
                      <p
                        key={pIdx}
                        className="whitespace-pre-line"
                        style={{ marginBottom: `${novelSettings.paragraphSpacing}px` }}
                      >
                        {para}
                      </p>
                    ))}
                  </div>

                  <div className="mt-8 pt-4 border-t border-current/15 opacity-40 flex items-center justify-between text-xs font-sans">
                    <span>{novelData.title || `Volume ${chapterNumber}`}</span>
                    <span>Page {currentPage} of {totalPages}</span>
                  </div>
                </div>
              </ZoomablePageWrapper>
            </div>
          )
        ) : !isNovel && effectiveLayout === 'Webtoon' ? (
          /* Webtoon Continuous Scrolling - Seamless long strip, no gaps between pages */
          <div
            className={`flex flex-col items-center mx-auto w-full space-y-0 gap-0 p-0 m-0 leading-none transition-colors duration-200 ${
              pageScale === 'Fit Width' || pageScale === 'Fill' ? 'max-w-none' : 'max-w-3xl'
            }`}
            style={{
              backgroundColor: mangaColorStyles.bg,
            }}
          >
            {mangaPages
              .filter((p) => Boolean(p && typeof p === 'string' && p.trim() !== ''))
              .map((pageUrl, idx) => (
                <MangaPageItem
                  key={`${pageUrl}-${idx}`}
                  pageUrl={pageUrl}
                  pageIndex={idx}
                  totalPages={mangaPages.length}
                  pageScale={pageScale}
                  cropBorders={cropBorders}
                  widePageZoom={widePageZoom}
                  zoomStart={zoomStart}
                  canvasBg={mangaColorStyles.bg}
                  textColor={mangaColorStyles.text}
                  onVisible={(visibleIdx) => setCurrentPage(visibleIdx)}
                />
              ))}

            {/* Bottom breathing space at the end of chapter */}
            <div className="pb-16" />
          </div>
        ) : (
          /* Paged & Vertical Single Page Viewer with dynamic canvas background */
          <div
            className="relative w-full h-[100dvh] min-h-[100dvh] flex items-center justify-center p-0 select-none overflow-hidden transition-colors duration-200"
            style={{
              backgroundColor: mangaColorStyles.bg,
            }}
            onClick={(e) => {
              const { clientX, clientY, currentTarget } = e;
              const rect = currentTarget.getBoundingClientRect();

              if (effectiveLayout === 'Vertical') {
                // Vertical layout: top 35% = prev page, bottom 35% = next page, center 30% = toggle controls
                const clickY = clientY - rect.top;
                const isTop = clickY < rect.height * 0.35;
                const isBottom = clickY > rect.height * 0.65;

                if (isTop || isBottom) {
                  e.stopPropagation();
                  if (isBottom) {
                    if (currentPage < (mangaPages.length || 1)) {
                      scrollToPage(currentPage + 1, false);
                      if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
                    } else if (hasNextChapter) {
                      handleNextChapter(e);
                    }
                  } else {
                    if (currentPage > 1) {
                      scrollToPage(currentPage - 1, false);
                      if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
                    } else if (hasPrevChapter) {
                      handlePrevChapter(e);
                    }
                  }
                }
              } else {
                // Paged layout: left/right 35% turns page according to reading direction
                const clickX = clientX - rect.left;
                const isLeft = clickX < rect.width * 0.35;
                const isRight = clickX > rect.width * 0.65;

                if (isLeft || isRight) {
                  e.stopPropagation();
                  const goForward = readingDirection === 'ltr' ? isRight : isLeft;
                  if (goForward) {
                    if (currentPage < (mangaPages.length || 1)) {
                      scrollToPage(currentPage + 1, false);
                      if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
                    } else if (hasNextChapter) {
                      handleNextChapter(e);
                    }
                  } else {
                    if (currentPage > 1) {
                      scrollToPage(currentPage - 1, false);
                      if (pageTurnSound !== 'Off') playPageSound(pageTurnSound);
                    } else if (hasPrevChapter) {
                      handlePrevChapter(e);
                    }
                  }
                }
              }
            }}
          >
            <PagedViewer
              pageUrl={mangaPages[currentPage - 1] || ''}
              currentPage={currentPage}
              totalPages={mangaPages.length || 1}
              pageScale={pageScale}
              pageTurnAnim={pageTurnAnim}
              readingDirection={readingDirection}
              cropBorders={cropBorders}
              zoomStart={zoomStart}
              isVertical={effectiveLayout === 'Vertical'}
              canvasBg={mangaColorStyles.bg}
              textColor={mangaColorStyles.text}
            />
          </div>
        )}
      </div>

      {/* 3. BOTTOM OVERLAY TOOLBAR (Exact screenshot layout: Translucent dark background revealing underlying artwork) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
          showControls ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="bg-black/65 pt-3.5 pb-6 px-4 sm:px-6 shadow-2xl">
          <div className="max-w-md mx-auto space-y-3">
            {/* 3a. Page Counter: e.g. "13 / 58", "Page 3 of 12" or "0 / 0" */}
            <div className="text-center">
              <span className="text-sm sm:text-base font-bold text-white tracking-wider">
                {hasRevealedPages ? (
                  isNovel ? `Page ${displayPage} of ${effectiveTotalPages}` : `${displayPage} / ${totalPages}`
                ) : (
                  '0 / 0'
                )}
              </span>
            </div>

            {/* 3b. Scrubber Row with SkipBack, Thick Dotted Progress Bar with Vertical Edge Line |, SkipForward */}
            <div className="flex items-center gap-3 px-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevChapter(e);
                }}
                disabled={!hasPrevChapter}
                className={`p-1.5 rounded-full text-white transition-all flex items-center justify-center ${
                  hasPrevChapter
                    ? 'hover:bg-white/15 active:scale-95 cursor-pointer opacity-100'
                    : 'opacity-25 cursor-not-allowed pointer-events-none'
                }`}
                title={hasPrevChapter ? (isNovel ? 'Previous Volume' : 'Previous Chapter') : (isNovel ? 'No previous volume' : 'No previous chapter')}
              >
                <SkipBack className="w-5 h-5 fill-white/90" />
              </button>

              {/* Scrubber Track matching exact screenshots */}
              <div className="relative flex-1 flex items-center h-12 sm:h-14 select-none mx-1 group touch-none">
                {/* 1. Track rendering with Edge Clipping and Clean Gaps */}
                {/* Left Progressed Purple Track (visible when pages are revealed and displayPage > 1) */}
                {hasRevealedPages && displayPage > 1 && (
                  <div
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 ${
                      isNovel ? 'bg-[#b876fc]' : 'bg-[#a855f7]'
                    } rounded-l-full rounded-r-[3.5px] overflow-hidden flex items-center z-[1]`}
                    style={{
                      width: `calc(${currentIndicatorPosition} - 5px)`,
                    }}
                  />
                )}

                {/* Right Unfilled Dark Track (visible when not revealed, or when displayPage < effectiveTotalPages) */}
                {!hasRevealedPages ? (
                  /* Initial unrevealed state: gap of 5px after vertical line at 0px, rounded-l-[3.5px] and rounded-r-full to right */
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#1e1e1e] rounded-l-[3.5px] rounded-r-full overflow-hidden flex items-center shadow-inner z-[1]"
                    style={{ left: '5px' }}
                  />
                ) : displayPage < effectiveTotalPages ? (
                  /* While not on last page: track starts 5px after vertical line with rounded-l-[3.5px] and extends to right-0 with rounded-r-full */
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#1e1e1e] rounded-l-[3.5px] rounded-r-full overflow-hidden flex items-center shadow-inner z-[1]"
                    style={{
                      left: `calc(${currentIndicatorPosition} + 5px)`,
                    }}
                  />
                ) : null}

                {/* 4. Dots behavior */}
                {!hasRevealedPages ? (
                  /* Initial State: Only a single Dot on the right end of the track, color #6b7276 */
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none z-[4] w-1.5 h-1.5 bg-[#6b7276]"
                    style={{ left: 'calc(100% - 10px)' }}
                  />
                ) : isNovel ? (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none transition-all duration-75 z-[4] ${
                      displayPage >= effectiveTotalPages ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                    } w-[7px] h-[7px] sm:w-2 sm:h-2 bg-white/35`}
                    style={{ left: 'calc(100% - 10px)' }}
                  />
                ) : (
                  <div className="absolute inset-0 pointer-events-none z-[4]">
                    {Array.from({ length: Math.max(effectiveTotalPages, 1) }).map((_, i) => {
                      const pageNum = i + 1;
                      const isCurrent = pageNum === displayPage;
                      const isPassed = pageNum < displayPage;
                      const dotPos =
                        effectiveTotalPages > 1
                          ? `calc(10px + (100% - 20px) * ${i / (effectiveTotalPages - 1)})`
                          : '50%';
                      return (
                        <div
                          key={pageNum}
                          style={{ left: dotPos }}
                          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full shrink-0 transition-opacity duration-75 ${
                            isCurrent
                              ? 'opacity-0 scale-0 pointer-events-none'
                              : isPassed
                              ? 'bg-[#000000] opacity-100'
                              : 'bg-[#a855f7] opacity-100'
                          } ${
                            effectiveTotalPages > 65
                              ? 'w-[2px] h-[2px]'
                              : effectiveTotalPages > 40
                              ? 'w-[2.5px] h-[2.5px]'
                              : 'w-1.5 h-1.5'
                          }`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* 5. Vertical Indicator Line | (at left 0 when not revealed, color #6b7276) */}
                <div
                  className="absolute top-1/2 pointer-events-none z-10"
                  style={{
                    left: !hasRevealedPages ? '0px' : currentIndicatorPosition,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div
                    className={`w-[3.5px] sm:w-[4px] h-[44px] sm:h-[48px] ${
                      !hasRevealedPages
                        ? 'bg-[#6b7276]'
                        : isNovel
                        ? 'bg-[#b876fc]'
                        : 'bg-[#a855f7]'
                    } rounded-full shadow-none`}
                  />
                </div>

                {/* Range Input for direct interactive touch/scrub with zero latency */}
                <input
                  type="range"
                  min={1}
                  max={Math.max(effectiveTotalPages, 1)}
                  value={hasRevealedPages ? displayPage : 1}
                  disabled={!hasRevealedPages}
                  onPointerDown={(e) => {
                    if (!hasRevealedPages) return;
                    e.stopPropagation();
                    const val = parseInt(e.currentTarget.value, 10);
                    handleSliderStart(isNaN(val) ? undefined : val);
                  }}
                  onMouseDown={(e) => {
                    if (!hasRevealedPages) return;
                    e.stopPropagation();
                    const val = parseInt(e.currentTarget.value, 10);
                    handleSliderStart(isNaN(val) ? undefined : val);
                  }}
                  onTouchStart={(e) => {
                    if (!hasRevealedPages) return;
                    e.stopPropagation();
                    const val = parseInt(e.currentTarget.value, 10);
                    handleSliderStart(isNaN(val) ? undefined : val);
                  }}
                  onInput={(e: any) => {
                    if (!hasRevealedPages) return;
                    e.stopPropagation();
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) handleSliderMove(val);
                  }}
                  onChange={(e) => {
                    if (!hasRevealedPages) return;
                    e.stopPropagation();
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) handleSliderMove(val);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    handleSliderEnd();
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    handleSliderEnd();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    handleSliderEnd();
                  }}
                  onPointerCancel={(e) => {
                    e.stopPropagation();
                    handleSliderEnd();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute inset-0 w-full h-full opacity-0 ${
                    hasRevealedPages ? 'cursor-pointer' : 'cursor-default pointer-events-none'
                  } z-20`}
                />
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextChapter(e);
                }}
                disabled={!hasNextChapter}
                className={`p-1.5 rounded-full text-white transition-all flex items-center justify-center ${
                  hasNextChapter
                    ? 'hover:bg-white/15 active:scale-95 cursor-pointer opacity-100'
                    : 'opacity-25 cursor-not-allowed pointer-events-none'
                }`}
                title={hasNextChapter ? (isNovel ? 'Next Volume' : 'Next Chapter') : (isNovel ? 'No next volume' : 'No next chapter')}
              >
                <SkipForward className="w-5 h-5 fill-white/90" />
              </button>
            </div>

            {/* 3c. Bottom 2 Action Buttons: [ 📖 Volumes / Chapters ] & [ ⚙ Settings ] */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChaptersDrawer(true);
                }}
                className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-[#ffffff]/75 hover:bg-white/90 active:scale-[0.98] border-0 outline-none text-black text-sm font-semibold shadow-lg transition-all cursor-pointer"
              >
                <BookText className="w-4.5 h-4.5 text-black" />
                <span>{isNovel ? 'Volumes' : 'Chapters'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsDrawer(true);
                }}
                className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-[#ffffff]/75 hover:bg-white/90 active:scale-[0.98] border-0 outline-none text-black text-sm font-semibold shadow-lg transition-all cursor-pointer"
              >
                <SettingsIcon className="w-4 h-4 text-black" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CHAPTERS / VOLUMES FULLSCREEN SHEET (Kept in DOM so covers don't re-render/re-load on reopen) */}
      <div
        className={`fixed inset-0 z-[6000] w-full h-full bg-[#0c0c14] flex flex-col overflow-hidden transition-all duration-200 ${
          showChaptersDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'
        }`}
      >
        {/* 4a. Title Header */}
          <div className="px-4.5 pt-4 pb-2.5 flex items-center justify-between shrink-0 border-b border-transparent">
            <h2 className="text-[17px] sm:text-xl font-bold text-white tracking-tight truncate pr-3">
              {media.title}
            </h2>
            <button
              onClick={() => setShowChaptersDrawer(false)}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* 4b. Sub-Tabs Bar: [ Volumes / Chapters (Count) ] | [ Bookmarks (Count) ] */}
          <div className="px-4.5 pt-0.5 pb-2.5 flex items-center gap-7 border-b border-white/5 shrink-0">
            {/* Chapters / Volumes Tab */}
            <button
              onClick={() => setDrawerTab('chapters')}
              className="relative flex flex-col items-center group cursor-pointer focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[15px] font-bold transition-colors ${
                    drawerTab === 'chapters' ? 'text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {isNovel ? 'Volumes' : 'Chapters'}
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-full transition-colors ${
                    drawerTab === 'chapters'
                      ? 'bg-[#291b3b] text-[#c084fc]'
                      : 'bg-[#1c1c28] text-white/60'
                  }`}
                >
                  {displayChaptersList.length || effectiveTotalChapters}
                </span>
              </div>
              {/* Purple Underline Indicator centered under label and number count pill */}
              <div
                className={`h-[2.5px] rounded-full mt-2 self-center transition-all duration-200 ${
                  drawerTab === 'chapters' ? 'w-8 sm:w-10 bg-[#a855f7]' : 'w-0 bg-transparent'
                }`}
              />
            </button>

            {/* Bookmarks Tab */}
            <button
              onClick={() => setDrawerTab('bookmarks')}
              className="relative flex flex-col items-center group cursor-pointer focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[15px] font-bold transition-colors ${
                    drawerTab === 'bookmarks' ? 'text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  Bookmarks
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-full transition-colors ${
                    drawerTab === 'bookmarks'
                      ? 'bg-[#291b3b] text-[#c084fc]'
                      : 'bg-[#1c1c28] text-white/60'
                  }`}
                >
                  {bookmarks.length}
                </span>
              </div>
              {/* Purple Underline Indicator centered under label and number count pill */}
              <div
                className={`h-[2.5px] rounded-full mt-2 self-center transition-all duration-200 ${
                  drawerTab === 'bookmarks' ? 'w-8 sm:w-10 bg-[#a855f7]' : 'w-0 bg-transparent'
                }`}
              />
            </button>
          </div>

          {/* 4c. Main Tab Content */}
          {drawerTab === 'chapters' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden max-w-4xl mx-auto w-full">
              {isNovel ? (
                /* === NOVEL VOLUMES: 3-Column Cover Grid with Empty Skeleton UI (No Shimmer) === */
                <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-16 no-scrollbar">
                  {loadingChapters ? (
                    <div className="grid grid-cols-3 gap-x-3.5 gap-y-5 sm:gap-x-5 sm:gap-y-6">
                      {Array.from({ length: effectiveTotalChapters > 0 ? effectiveTotalChapters : 15 }).map((_, idx) => {
                        const volNum = idx + 1;
                        const isCurrent = volNum === chapterNumber;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setActiveReader({ media, chapterNumber: volNum });
                              setCurrentPage(1);
                              setShowChaptersDrawer(false);
                              showToast(`Jumped to Volume ${volNum}`);
                            }}
                            className="group flex flex-col text-left cursor-pointer focus:outline-none"
                          >
                            <div
                              className={`relative w-full aspect-[1/1.44] rounded-[14px] sm:rounded-[16px] bg-[#1a1b26] flex items-center justify-center transition-all ${
                                isCurrent
                                  ? 'ring-2 ring-[#b876fc] shadow-[0_0_14px_rgba(184,118,252,0.35)]'
                                  : 'border border-white/5 group-hover:border-white/20 group-hover:bg-[#1f202e]'
                              }`}
                            >
                              <BookText
                                className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                                  isCurrent ? 'text-[#b876fc]/80' : 'text-white/30 group-hover:text-white/50'
                                }`}
                              />
                            </div>
                            <span
                              className={`text-[13.5px] sm:text-[14px] font-semibold tracking-tight truncate mt-2 transition-colors ${
                                isCurrent ? 'text-[#c084fc] font-bold' : 'text-white group-hover:text-purple-200'
                              }`}
                            >
                              Volume {volNum}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : displayChaptersList.length === 0 ? (
                    <div className="text-center py-20 text-xs text-white/40">
                      No volumes found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-x-3.5 gap-y-5 sm:gap-x-5 sm:gap-y-6">
                      {displayChaptersList.map((ch) => {
                        const chNum = parseFloat(ch.chapter) || 0;
                        const isCurrent = chNum === chapterNumber;

                        return (
                          <NovelVolumeCard
                            key={ch.id || ch.chapter}
                            ch={ch}
                            isCurrent={isCurrent}
                            mediaCover={media.coverImage}
                            onClick={() => {
                              setActiveReader({ media, chapterNumber: chNum, chapterId: ch.id });
                              setCurrentPage(1);
                              setShowChaptersDrawer(false);
                              showToast(`Jumped to Volume ${ch.chapter}`);
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* === MANGA CHAPTERS: Range Filter Chips & Chapter List === */
                <>
                  {/* Chapter Range Filter Chips */}
                  {chapterChunks.length > 0 && (
                    <div className="px-5 pt-3.5 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                      <button
                        id="manga-reader-chapter-chunk-all"
                        onClick={() => setChapterRangeFilter('All')}
                        className={`px-[12px] py-[8px] rounded-full text-[13px] sm:text-[14px] leading-none font-bold whitespace-nowrap transition-all cursor-pointer ${
                          chapterRangeFilter === 'All'
                            ? 'bg-[#8b5cf6] text-white shadow-md'
                            : 'bg-[#1c1c28] text-white/70 hover:text-white hover:bg-[#252535]'
                        }`}
                      >
                        All
                      </button>

                      {chapterChunks.map((chunk) => (
                        <button
                          key={chunk}
                          id={`manga-reader-chapter-chunk-${chunk}`}
                          onClick={() => setChapterRangeFilter(chunk)}
                          className={`px-[12px] py-[8px] rounded-full text-[13px] sm:text-[14px] leading-none font-bold whitespace-nowrap transition-all cursor-pointer ${
                            chapterRangeFilter === chunk
                              ? 'bg-[#8b5cf6] text-white shadow-md'
                              : 'bg-[#1c1c28] text-white/70 hover:text-white hover:bg-[#252535]'
                          }`}
                        >
                          {chunk}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Subtitle count: e.g. "75 Chapters" */}
                  <div className="px-5 pt-2 pb-2 text-xs font-medium text-white/50 shrink-0">
                    {displayChaptersList.length} Chapters
                  </div>

                  {/* Chapters Card List */}
                  <div className="flex-1 overflow-y-auto px-4 pb-12 space-y-2.5 no-scrollbar">
                    {loadingChapters ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3.5 text-white/60">
                        <DotPulseLoader size="md" />
                        <span className="text-xs">
                          Loading real chapters from MangaDex...
                        </span>
                      </div>
                    ) : displayChaptersList.length === 0 ? (
                      <div className="text-center py-16 text-xs text-white/40">
                        No chapters found in this range.
                      </div>
                    ) : (
                      displayChaptersList.map((ch) => {
                        const chNum = parseFloat(ch.chapter) || 0;
                        const isCurrent = chNum === chapterNumber;

                        return (
                          <button
                            key={ch.id || ch.chapter}
                            onClick={() => {
                              setActiveReader({ media, chapterNumber: chNum, chapterId: ch.id });
                              setCurrentPage(1);
                              setShowChaptersDrawer(false);
                              showToast(`Jumped to Chapter ${ch.chapter}`);
                            }}
                            className={`w-full flex items-center gap-3.5 p-2.5 sm:p-3 rounded-2xl text-left transition-all cursor-pointer select-none ${
                              isCurrent
                                ? 'bg-[#231737]'
                                : 'bg-[#13141f] hover:bg-[#1a1b28]'
                            }`}
                          >
                            {/* Number Badge */}
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[15px] shrink-0 transition-colors ${
                                isCurrent
                                  ? 'bg-[#4e2673] text-white'
                                  : 'bg-[#1e1f2d] text-white/70'
                              }`}
                            >
                              {ch.chapter}
                            </div>

                            {/* Chapter Name & Subtitle */}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[15px] font-bold text-white truncate leading-tight">
                                Chapter {ch.chapter}
                              </h4>
                              <p
                                className={`text-xs truncate leading-tight mt-0.5 transition-colors ${
                                  isCurrent ? 'text-[#9d8bb8]' : 'text-white/45'
                                }`}
                              >
                                {ch.title && ch.title !== `Chapter ${ch.chapter}`
                                  ? ch.title
                                  : `Chapter ${ch.chapter}`}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Bookmarks Tab View */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden max-w-4xl mx-auto w-full">
              {/* Subtitle count: e.g. "1 bookmark" or "2 bookmarks" */}
              <div className="px-5 pt-3 pb-2 text-xs font-medium text-white/50 shrink-0">
                {bookmarks.length} {isNovel ? (bookmarks.length === 1 ? 'bookmark' : 'bookmarks') : (bookmarks.length === 1 ? 'saved page' : 'saved pages')}
              </div>

              {/* Bookmarks List */}
              <div className="flex-1 overflow-y-auto px-4 pb-12 space-y-2 no-scrollbar">
                {bookmarks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center text-white/40 px-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3 text-white/20">
                      <Bookmark className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-white/70">No saved bookmarks</p>
                    <p className="text-xs text-white/40 mt-1 max-w-xs leading-relaxed">
                      Tap the bookmark icon in the top reader toolbar while reading to save pages here.
                    </p>
                  </div>
                ) : isNovel ? (
                  /* === NOVEL BOOKMARKS (Exact match for Screenshot_20260906_021822_Anify.jpg) === */
                  <div className="divide-y divide-white/5">
                    {bookmarks.map((bm) => {
                      const snippet =
                        bm.textSnippet ||
                        (bm.chapterNumber === chapterNumber && novelPages[bm.page - 1]?.paragraphs?.join(' ')) ||
                        media.description ||
                        `Saved position in Volume ${bm.chapterNumber} (Page ${bm.page}).`;

                      return (
                        <div
                          key={bm.id}
                          onClick={() => {
                            pendingBookmarkPageRef.current = bm.page;
                            if (
                              activeReader.chapterNumber !== bm.chapterNumber ||
                              (bm.chapterId && activeReader.chapterId !== bm.chapterId)
                            ) {
                              setActiveReader({
                                media,
                                chapterNumber: bm.chapterNumber,
                                chapterId: bm.chapterId,
                              });
                            }
                            setCurrentPage(bm.page);
                            scrollToPage(bm.page, false);
                            setShowChaptersDrawer(false);
                            showToast(`Jumped to Volume ${bm.chapterNumber} (Page ${bm.page})`);
                            if (effectiveLayout === 'Webtoon') {
                              setTimeout(() => {
                                const targetEl = document.getElementById(`novel-page-${bm.page}`);
                                if (targetEl && scrollContainerRef.current) {
                                  targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }, 250);
                            }
                          }}
                          className="w-full flex items-center justify-between gap-3 py-3.5 px-2 hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors cursor-pointer group select-none rounded-xl"
                        >
                          {/* Left: Bookmark Ribbon & Content Block */}
                          <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                            {/* Purple Ribbon Bookmark Icon positioned exactly between Volume title and Snippet on the left */}
                            <div className="shrink-0 mt-[21px]">
                              <Bookmark className="w-5 h-5 fill-[#a855f7] text-[#a855f7] stroke-[#a855f7]" />
                            </div>

                            {/* Volume Number & Content Text Snippet */}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[15px] sm:text-base font-bold text-white leading-tight">
                                Volume {bm.chapterNumber}
                              </h4>
                              <p className="text-[12.5px] sm:text-[13px] text-white/70 line-clamp-2 leading-relaxed mt-1 font-normal tracking-normal">
                                {snippet}
                              </p>
                            </div>
                          </div>

                          {/* Right: Close / Delete X Icon */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = bookmarks.filter((b) => b.id !== bm.id);
                              saveBookmarks(next);
                              showToast(`Removed Bookmark for Volume ${bm.chapterNumber}`);
                            }}
                            className="p-2 text-white/60 hover:text-white active:scale-90 transition-all cursor-pointer shrink-0 rounded-lg hover:bg-white/10 focus:outline-none"
                            title="Delete bookmark"
                          >
                            <X className="w-5 h-5 stroke-[2]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Manga Bookmarks list (matches Screenshot_20260910_011533_Anify.jpg) */
                  bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      onClick={() => {
                        pendingBookmarkPageRef.current = bm.page;
                        if (
                          activeReader.chapterNumber !== bm.chapterNumber ||
                          (bm.chapterId && activeReader.chapterId !== bm.chapterId)
                        ) {
                          setActiveReader({
                            media,
                            chapterNumber: bm.chapterNumber,
                            chapterId: bm.chapterId,
                          });
                        }
                        setCurrentPage(bm.page);
                        scrollToPage(bm.page, true);
                        setShowChaptersDrawer(false);
                        showToast(`Jumped to Chapter ${bm.chapterNumber} (Page ${bm.page})`);
                      }}
                      className="w-full bg-[#13141f] hover:bg-[#1a1b28] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3.5 transition-all cursor-pointer select-none group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Purple Bookmark Icon Box */}
                        <div className="w-10 h-10 rounded-xl bg-[#2e1e3e] flex items-center justify-center shrink-0">
                          <Bookmark className="w-5 h-5 fill-[#b876fc] text-[#b876fc] stroke-none" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-[15px] font-bold text-white truncate leading-tight">
                            Chapter {bm.chapterNumber}
                          </h4>
                          <p className="text-xs text-white/50 leading-tight mt-0.5">
                            Page {bm.page} of {bm.totalPages || totalPages || 1}
                          </p>
                        </div>
                      </div>

                      {/* Delete Bookmark Button (Exact filled trash bin icon from screenshot) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = bookmarks.filter((b) => b.id !== bm.id);
                          saveBookmarks(next);
                          showToast(`Removed Bookmark for Chapter ${bm.chapterNumber}`);
                        }}
                        className="p-2 text-zinc-400 hover:text-white active:scale-90 transition-all cursor-pointer shrink-0 rounded-lg hover:bg-white/5 focus:outline-none"
                        title="Delete bookmark"
                      >
                        <svg
                          className="w-4.5 h-4.5 fill-current"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      {/* 5. NOVEL SETTINGS FULLSCREEN SHEET (Rendered ONLY when reading a Novel) */}
      {showSettingsDrawer && isNovel && (
        <NovelReaderSettingsSheet
          settings={novelSettings}
          onChange={handleNovelSettingsChange}
          onClose={() => setShowSettingsDrawer(false)}
          onPlaySound={(snd) => playPageSound(snd)}
        />
      )}

      {/* 5. MANGA SETTINGS FULLSCREEN SHEET (Rendered ONLY when reading Manga) */}
      {showSettingsDrawer && !isNovel && (
        <div
          className="fixed inset-0 z-[6000] w-full h-full bg-[#0a0b10] flex flex-col overflow-hidden animate-in fade-in duration-200"
        >
          {/* Scrollable Settings Content Body - Header scrolls together with all content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-8 pt-7 pb-6 space-y-6 text-white no-scrollbar max-w-4xl mx-auto w-full">
            {/* Header: "Reader Settings" (Left) & "Done" (Right) - scrolls with content */}
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Reader Settings</h2>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                className="text-sm font-semibold text-white hover:text-white/80 transition-opacity cursor-pointer px-2 py-1"
              >
                Done
              </button>
            </div>

            {/* Section: Per-Manga Settings */}
            <div
              onClick={() => {
                const next = !perMangaSettings;
                setPerMangaSettings(next);
                try {
                  if (activeReader?.media?.id) {
                    localStorage.setItem(`satori_manga_per_manga_${activeReader.media.id}`, String(next));
                  }
                } catch {}
                showMangaSettingsToast(next ? 'Per-Manga settings enabled' : 'Global settings active');
              }}
              className="flex items-center justify-between py-2 px-3.5 -mx-3.5 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
            >
              <div>
                <h3 className="text-[15px] font-bold text-white">Per-Manga Settings</h3>
                <p className="text-xs text-white/50 mt-0.5">
                  {perMangaSettings
                    ? 'Custom settings are active for this manga'
                    : 'Changes apply to global Reader Settings'}
                </p>
              </div>
              <AppToggleSwitch
                checked={perMangaSettings}
                onChange={(next) => {
                  setPerMangaSettings(next);
                  try {
                    if (activeReader?.media?.id) {
                      localStorage.setItem(`satori_manga_per_manga_${activeReader.media.id}`, String(next));
                    }
                  } catch {}
                  showMangaSettingsToast(next ? 'Per-Manga settings enabled' : 'Global settings active');
                }}
              />
            </div>

            {/* Section: Reading Layout */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Reading Layout</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'Automatic',
                    title: 'Automatic',
                    subtitle: 'Adapts to each chapter',
                    renderIcon: (isSelected: boolean) => (
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className={`w-[13px] h-[17px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        <div className={`w-[13px] h-[17px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        <div className={`w-[13px] h-[17px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        <div className={`w-[13px] h-[17px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                      </div>
                    ),
                  },
                  {
                    id: 'Paged',
                    title: 'Paged',
                    subtitle: 'Swipe left or right',
                    renderIcon: (isSelected: boolean) => (
                      <div
                        className={`w-[29px] h-[41.5px] rounded-[3px] relative flex items-center justify-center overflow-hidden ${
                          isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                        }`}
                      >
                        <div className={`w-[2px] h-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                      </div>
                    ),
                  },
                  {
                    id: 'Vertical',
                    title: 'Vertical',
                    subtitle: 'Swipe up or down',
                    renderIcon: (isSelected: boolean) => (
                      <div className="flex flex-col gap-1 w-[25px] py-0.5">
                        <div className={`h-[11px] w-full rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        <div className={`h-[11px] w-full rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        <div className={`h-[11px] w-full rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                      </div>
                    ),
                  },
                  {
                    id: 'Webtoon',
                    title: 'Webtoon',
                    subtitle: 'Continuous long strip',
                    renderIcon: (isSelected: boolean) => (
                      <div
                        className={`w-[23px] h-[47px] rounded-[3px] flex flex-col justify-between py-1.5 px-0.5 ${
                          isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                        }`}
                      >
                        <div className={`h-[1.5px] w-full rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                        <div className={`h-[1.5px] w-full rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                        <div className={`h-[1.5px] w-full rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                        <div className={`h-[1.5px] w-full rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                      </div>
                    ),
                  },
                ].map((item) => {
                  const isSelected = readerLayout === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setReaderLayout(item.id as any);
                        saveActiveSettings({ layout: item.id as any });
                        try {
                          const key =
                            perMangaSettings && activeReader?.media?.id
                              ? `satori_manga_layout_${activeReader.media.id}`
                              : 'satori_manga_layout_global';
                          localStorage.setItem(key, item.id);
                        } catch {}
                        showToast(`Layout: ${item.title}`);
                      }}
                      className={`flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'bg-[#1d1430] border-[#b876fc] shadow-sm'
                          : 'bg-[#12131c] border-transparent hover:border-white/10'
                      }`}
                    >
                      <div
                        className={`w-[48px] h-[55px] rounded-[8px] flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                        }`}
                      >
                        {item.renderIcon(isSelected)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-white leading-tight">
                          {item.title}
                        </h4>
                        <p className="text-[12px] text-white/50 leading-tight mt-1">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: Reading Direction */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Reading Direction</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setReadingDirection('ltr');
                    saveActiveSettings({ direction: 'ltr' });
                    try {
                      localStorage.setItem('satori_manga_direction', 'ltr');
                    } catch {}
                    showToast('Direction: Left to Right');
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all cursor-pointer border-2 ${
                    readingDirection === 'ltr'
                      ? 'bg-[#1d1430] border-[#b876fc] text-white shadow-sm'
                      : 'bg-[#12131c] border-transparent text-white/80 hover:text-white hover:border-white/10'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      readingDirection === 'ltr' ? 'bg-[#b876fc]' : 'bg-[#20222e]'
                    }`}
                  >
                    <ArrowRight
                      className={`w-4 h-4 stroke-[2.8] ${
                        readingDirection === 'ltr' ? 'text-[#1a122e]' : 'text-white/70'
                      }`}
                    />
                  </div>
                  <span className="text-[14px] sm:text-[15px] font-bold text-white leading-tight">
                    Left to Right
                  </span>
                </button>

                <button
                  onClick={() => {
                    setReadingDirection('rtl');
                    saveActiveSettings({ direction: 'rtl' });
                    try {
                      localStorage.setItem('satori_manga_direction', 'rtl');
                    } catch {}
                    showToast('Direction: Right to Left');
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all cursor-pointer border-2 ${
                    readingDirection === 'rtl'
                      ? 'bg-[#1d1430] border-[#b876fc] text-white shadow-sm'
                      : 'bg-[#12131c] border-transparent text-white/80 hover:text-white hover:border-white/10'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      readingDirection === 'rtl' ? 'bg-[#b876fc]' : 'bg-[#20222e]'
                    }`}
                  >
                    <ArrowLeft
                      className={`w-4 h-4 stroke-[2.8] ${
                        readingDirection === 'rtl' ? 'text-[#1a122e]' : 'text-white/70'
                      }`}
                    />
                  </div>
                  <span className="text-[14px] sm:text-[15px] font-bold text-white leading-tight">
                    Right to Left
                  </span>
                </button>
              </div>
            </div>

            {/* Section: Page Scale */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Page Scale</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'Fit',
                    title: 'Fit',
                    subtitle: 'Whole page visible',
                    renderIcon: (isSelected: boolean) => (
                      <div className={`w-[29px] h-[41px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                    ),
                  },
                  {
                    id: 'Fit Width',
                    title: 'Fit Width',
                    subtitle: 'Match screen width',
                    renderIcon: (isSelected: boolean) => (
                      <div className={`w-[45.5px] h-[30.5px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                    ),
                  },
                  {
                    id: 'Original',
                    title: 'Original',
                    subtitle: 'Use natural size',
                    renderIcon: (isSelected: boolean) => (
                      <div className={`w-[23.5px] h-[31.5px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                    ),
                  },
                  {
                    id: 'Fill',
                    title: 'Fill',
                    subtitle: 'Cover the viewport',
                    renderIcon: (isSelected: boolean) => (
                      <div className={`w-[47px] h-[54px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                    ),
                  },
                ].map((s) => {
                  const isSelected = pageScale === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setPageScale(s.id as any);
                        saveActiveSettings({ scale: s.id as any });
                        showToast(`Scale: ${s.title}`);
                      }}
                      className={`flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'bg-[#1d1430] border-[#b876fc] shadow-sm'
                          : 'bg-[#12131c] border-transparent hover:border-white/10'
                      }`}
                    >
                      <div
                        className={`w-[48px] h-[55px] rounded-[8px] flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                        }`}
                      >
                        {s.renderIcon(isSelected)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-white leading-tight">{s.title}</h4>
                        <p className="text-[12px] text-white/50 leading-tight mt-1">{s.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: Zoom Start */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Zoom Start</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'Automatic',
                    title: 'Automatic',
                    subtitle: 'Follow reading direction',
                    renderIcon: (isSelected: boolean) => (
                      <div
                        className={`w-[27.5px] h-[37.5px] rounded-[3px] flex items-center justify-center ${
                          isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                        }`}
                      >
                        <div className={`w-[7px] h-[7px] rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                      </div>
                    ),
                  },
                  {
                    id: 'Left',
                    title: 'Left',
                    subtitle: 'Start at the left edge',
                    renderIcon: (isSelected: boolean) => (
                      <div
                        className={`w-[27.5px] h-[37.5px] rounded-[3px] relative flex items-center ${
                          isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                        }`}
                      >
                        <div className={`absolute left-0.5 w-[7px] h-[7px] rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                      </div>
                    ),
                  },
                  {
                    id: 'Center',
                    title: 'Center',
                    subtitle: 'Start in the middle',
                    renderIcon: (isSelected: boolean) => (
                      <div
                        className={`w-[27.5px] h-[37.5px] rounded-[3px] flex items-center justify-center ${
                          isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                        }`}
                      >
                        <div className={`w-[7px] h-[7px] rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                      </div>
                    ),
                  },
                  {
                    id: 'Right',
                    title: 'Right',
                    subtitle: 'Start at the right edge',
                    renderIcon: (isSelected: boolean) => (
                      <div
                        className={`w-[27.5px] h-[37.5px] rounded-[3px] relative flex items-center justify-end ${
                          isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                        }`}
                      >
                        <div className={`absolute right-0.5 w-[7px] h-[7px] rounded-full ${isSelected ? 'bg-[#1d1430]' : 'bg-[#282a36]'}`} />
                      </div>
                    ),
                  },
                ].map((z) => {
                  const isSelected = zoomStart === z.id;
                  return (
                    <button
                      key={z.id}
                      onClick={() => {
                        setZoomStart(z.id as any);
                        saveActiveSettings({ zoom: z.id as any });
                        showToast(`Zoom Start: ${z.title}`);
                      }}
                      className={`flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'bg-[#1d1430] border-[#b876fc] shadow-sm'
                          : 'bg-[#12131c] border-transparent hover:border-white/10'
                      }`}
                    >
                      <div
                        className={`w-[48px] h-[55px] rounded-[8px] flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                        }`}
                      >
                        {z.renderIcon(isSelected)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-white leading-tight">{z.title}</h4>
                        <p className="text-[12px] text-white/50 leading-tight mt-1">{z.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: Page Turn Animation */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Page Turn</h3>
              <div className="space-y-2.5">
                {[
                  {
                    id: 'Off',
                    title: 'Off',
                    subtitle: 'Change pages immediately',
                    renderIcon: (isSelected: boolean) => (
                      <div className="relative w-[27px] h-[32px] flex items-center justify-center">
                        {/* Back Card */}
                        <div className="absolute right-0 top-0.5 w-[22px] h-[30px] rounded-[3px] bg-[#3b2560]" />
                        {/* Front Card */}
                        <div className={`absolute left-0 top-0.5 w-[22px] h-[30px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        {/* Diagonal Slash */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 27 32" fill="none">
                          <line x1="2" y1="30" x2="25" y2="2" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </div>
                    ),
                  },
                  {
                    id: 'Default',
                    title: 'Default',
                    subtitle: 'Use the standard side animation',
                    renderIcon: (isSelected: boolean) => (
                      <div className="relative w-[27px] h-[32px] flex items-center justify-center">
                        {/* Back Card */}
                        <div className="absolute right-0 top-0.5 w-[22px] h-[30px] rounded-[3px] bg-[#3b2560]" />
                        {/* Front Card */}
                        <div className={`absolute left-0 top-0.5 w-[22px] h-[30px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        {/* Horizontal White Tab */}
                        <div className="absolute right-[0px] top-1/2 -translate-y-1/2 w-[7px] h-[2.5px] bg-white rounded-[0.5px]" />
                      </div>
                    ),
                  },
                  {
                    id: 'Book Flip',
                    title: 'Book Flip',
                    subtitle: 'Smooth realistic animation',
                    renderIcon: (isSelected: boolean) => (
                      <div className="relative w-[27px] h-[32px] flex items-center justify-center">
                        {/* Back Card */}
                        <div className="absolute right-0 top-0.5 w-[22px] h-[30px] rounded-[3px] bg-[#3b2560]" />
                        {/* Front Card */}
                        <div className={`absolute left-0 top-0.5 w-[22px] h-[30px] rounded-[3px] ${isSelected ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'}`} />
                        {/* Vertical Page Fold Line matching user image */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 27 32" fill="none">
                          <line x1="12" y1="2.5" x2="16" y2="29" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
                        </svg>
                      </div>
                    ),
                  },
                ].map((pt) => {
                  const isSelected = pageTurnAnim === pt.id;
                  return (
                    <button
                      key={pt.id}
                      onClick={() => {
                        setPageTurnAnim(pt.id as any);
                        saveActiveSettings({ anim: pt.id as any });
                        showToast(`Page Turn: ${pt.title}`);
                      }}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'bg-[#1d1430] border-[#b876fc] shadow-sm'
                          : 'bg-[#12131c] border-transparent hover:border-white/10'
                      }`}
                    >
                      <div
                        className={`w-[48px] h-[55px] rounded-[8px] flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                        }`}
                      >
                        {pt.renderIcon(isSelected)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-white leading-tight">{pt.title}</h4>
                        <p className="text-[12px] text-white/50 leading-tight mt-0.5">{pt.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: Page Turn Sound */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Page Turn Sound</h3>
              <div className="grid grid-cols-5 gap-2">
                {(['Off', '1', '2', '3', '4'] as const).map((snd) => {
                  const isSelected = pageTurnSound === snd;
                  return (
                    <button
                      key={snd}
                      onClick={() => {
                        setPageTurnSound(snd);
                        saveActiveSettings({ sound: snd });
                        if (snd !== 'Off') {
                          playPageSound(snd);
                          showToast(`Sound: Option ${snd}`);
                        } else {
                          showToast('Page Turn Sound Off');
                        }
                      }}
                      className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'bg-[#1d1430] border-[#b876fc] text-white shadow-sm'
                          : 'bg-[#12131c] border-transparent text-white/70 hover:text-white hover:border-white/10'
                      }`}
                    >
                      {snd}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: Page Appearance */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Page Appearance</h3>
              <div className="space-y-2.5">
                {[
                  {
                    id: 'black',
                    title: 'Pure Black',
                    subtitle: 'Best for OLED and dark rooms',
                    colorBg: 'bg-black border border-white/20',
                  },
                  {
                    id: 'dark',
                    title: 'Dark Gray',
                    subtitle: 'Softer contrast around pages',
                    colorBg: 'bg-[#1e1e28] border border-white/20',
                  },
                  {
                    id: 'light',
                    title: 'Light Gray',
                    subtitle: 'Bright neutral reading canvas',
                    colorBg: 'bg-[#ebe7e0] border border-black/20',
                  },
                ].map((app) => {
                  const isSelected = pageAppearance === app.id;
                  return (
                    <button
                      key={app.id}
                      onClick={() => {
                        setPageAppearance(app.id as any);
                        saveActiveSettings({ appearance: app.id as any });
                        showToast(`Appearance: ${app.title}`);
                      }}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'bg-[#1d1430] border-[#b876fc] shadow-sm'
                          : 'bg-[#12131c] border-transparent hover:border-white/10'
                      }`}
                    >
                      <div
                        className={`w-[48px] h-[55px] rounded-[8px] flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                        }`}
                      >
                        <div className={`w-[25px] h-[35.5px] rounded-[3px] ${app.colorBg}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-white leading-tight">{app.title}</h4>
                        <p className="text-[12px] text-white/50 leading-tight mt-0.5">{app.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: Crop Borders */}
            <div
              onClick={() => {
                const next = !cropBorders;
                setCropBorders(next);
                saveActiveSettings({ crop: next });
                showToast(next ? 'Border cropping enabled' : 'Border cropping disabled');
              }}
              className="flex items-center justify-between py-3 px-3.5 -mx-3.5 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
            >
              <div>
                <h3 className="text-sm font-bold text-white">Crop Borders</h3>
                <p className="text-xs text-white/50 mt-0.5">Trim plain black or white margins in paged modes</p>
              </div>
              <AppToggleSwitch
                checked={cropBorders}
                onChange={(next) => {
                  setCropBorders(next);
                  saveActiveSettings({ crop: next });
                  showToast(next ? 'Border cropping enabled' : 'Border cropping disabled');
                }}
              />
            </div>

            {/* Section: Reader Behavior */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Reader Behavior</h3>

              {/* Automatic Webtoon */}
              <div
                onClick={() => {
                  const next = !autoWebtoon;
                  setAutoWebtoon(next);
                  saveActiveSettings({ autoWebtoon: next });
                  showToast(next ? 'Automatic Webtoon enabled' : 'Automatic Webtoon disabled');
                }}
                className="flex items-center justify-between py-2 px-3.5 -mx-3.5 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
              >
                <div>
                  <h4 className="text-[14px] font-bold text-white">Automatic Webtoon</h4>
                  <p className="text-xs text-white/50 mt-0.5">Use long strip mode when pages are tall</p>
                </div>
                <AppToggleSwitch
                  checked={autoWebtoon}
                  onChange={(next) => {
                    setAutoWebtoon(next);
                    saveActiveSettings({ autoWebtoon: next });
                    showToast(next ? 'Automatic Webtoon enabled' : 'Automatic Webtoon disabled');
                  }}
                />
              </div>

              {/* Wide Page Zoom */}
              <div
                onClick={() => {
                  const next = !widePageZoom;
                  setWidePageZoom(next);
                  saveActiveSettings({ wideZoom: next });
                  showToast(next ? 'Wide Page Zoom enabled' : 'Wide Page Zoom disabled');
                }}
                className="flex items-center justify-between py-2 px-3.5 -mx-3.5 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
              >
                <div>
                  <h4 className="text-[14px] font-bold text-white">Wide Page Zoom</h4>
                  <p className="text-xs text-white/50 mt-0.5">Fill the width for landscape pages</p>
                </div>
                <AppToggleSwitch
                  checked={widePageZoom}
                  onChange={(next) => {
                    setWidePageZoom(next);
                    saveActiveSettings({ wideZoom: next });
                    showToast(next ? 'Wide Page Zoom enabled' : 'Wide Page Zoom disabled');
                  }}
                />
              </div>

              {/* Keep Screen On */}
              <div
                onClick={() => {
                  const next = !keepScreenOn;
                  setKeepScreenOn(next);
                  saveActiveSettings({ keepScreen: next });
                  showToast(next ? 'Keep screen on enabled' : 'Keep screen on disabled');
                }}
                className="flex items-center justify-between py-2 px-3.5 -mx-3.5 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
              >
                <div>
                  <h4 className="text-[14px] font-bold text-white">Keep Screen On</h4>
                  <p className="text-xs text-white/50 mt-0.5">Prevent sleep while reading</p>
                </div>
                <AppToggleSwitch
                  checked={keepScreenOn}
                  onChange={(next) => {
                    setKeepScreenOn(next);
                    saveActiveSettings({ keepScreen: next });
                    showToast(next ? 'Keep screen on enabled' : 'Keep screen on disabled');
                  }}
                />
              </div>
            </div>

            {/* Section: Preload Pages */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[17px] font-bold text-white tracking-tight">Preload Pages</h4>
                <span className="text-[17px] font-bold text-[#b876fc]">{preloadPagesCount}</span>
              </div>
              {/* Matching scrubber track with 21 dots and vertical indicator line (0 to 20 pages) */}
              <div className="relative flex items-center h-12 sm:h-14 select-none group touch-none">
                {/* 1. Left Progressed Purple Solid Bar */}
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#b876fc] rounded-l-full rounded-r-[3.5px] overflow-hidden flex items-center z-[2]"
                  style={{
                    width: preloadPagesCount > 0 ? `calc(${currentPreloadIndicatorPosition} - 6px)` : '0px',
                    display: preloadPagesCount > 0 ? 'block' : 'none',
                  }}
                />

                {/* 2. Right Unfilled Dark Track */}
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#181826] rounded-l-[3.5px] rounded-r-full overflow-hidden flex items-center shadow-inner z-[2]"
                  style={{
                    left: preloadPagesCount < 20 ? `calc(${currentPreloadIndicatorPosition} + 6px)` : '100%',
                    display: preloadPagesCount < 20 ? 'block' : 'none',
                  }}
                />

                {/* 3. 21 Fixed Stationary Dots Across the Entire Track (0 - 20 Pages) */}
                <div className="absolute inset-0 pointer-events-none z-[4]">
                  {Array.from({ length: 21 }).map((_, i) => {
                    const pageNum = i;
                    const isCurrent = pageNum === preloadPagesCount;
                    const isPassed = pageNum < preloadPagesCount;
                    const dotPos = `calc(10px + (100% - 20px) * ${i / 20})`;
                    return (
                      <div
                        key={pageNum}
                        style={{ left: dotPos }}
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full shrink-0 transition-opacity duration-75 ${
                          isCurrent
                            ? 'opacity-0 scale-0 pointer-events-none'
                            : isPassed
                            ? 'bg-[#000000] opacity-100'
                            : 'bg-[#b876fc] opacity-100'
                        } w-1.5 h-1.5`}
                      />
                    );
                  })}
                </div>

                {/* 4. Vertical Purple Indicator Line | */}
                <div
                  className="absolute top-1/2 pointer-events-none z-10"
                  style={{
                    left: currentPreloadIndicatorPosition,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="w-[3.5px] sm:w-[4px] h-[46px] sm:h-[50px] bg-[#b876fc] rounded-full shadow-none" />
                </div>

                {/* Range Input for direct interactive touch/scrub with zero latency */}
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={preloadPagesCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setPreloadPagesCount(val);
                      saveActiveSettings({ preload: val });
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>
            </div>

            {/* Reset to Defaults button matching Novel Reader settings sheet */}
            <div className="pt-2 pb-2">
              <button
                type="button"
                onClick={handleMangaResetToDefaults}
                className="w-full h-[52px] px-5 rounded-[14px] bg-[#11121c] hover:bg-[#181926] active:scale-[0.99] border border-white/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer group shadow-sm"
              >
                <svg
                  className="w-4 h-4 text-white group-hover:rotate-[-45deg] transition-transform duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                </svg>
                <span className="text-[15px] font-semibold text-white tracking-wide">
                  Reset to Defaults
                </span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {mangaSettingsToast && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[7500] px-4 py-2.5 rounded-full bg-[#1e2030]/95 text-white text-xs font-semibold shadow-2xl border border-white/15 backdrop-blur-md animate-fade-in pointer-events-none">
              {mangaSettingsToast}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
