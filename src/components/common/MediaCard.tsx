import React, { useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MediaItem } from '../../types';
import { PosterImage } from './PosterImage';
import { RatingPill } from './RatingPill';
import { prefetchMediaDetails } from '../../services/cacheService';

export interface MediaCardProps {
  item: MediaItem;
  layout?: 'vertical' | 'horizontal' | 'compact';
  showScore?: boolean;
  showEpisodeBadge?: boolean;
  showHeartCount?: boolean;
  isUpcoming?: boolean;
  className?: string;
  widthClassName?: string;
  imageClassName?: string;
  aspectRatio?: string; // e.g. "aspect-[2/3]" or "w-14 h-20"
  subtitle?: React.ReactNode;
  customBadge?: React.ReactNode;
  onClick?: (item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  layout = 'vertical',
  showScore = true,
  showEpisodeBadge = false,
  showHeartCount = false,
  isUpcoming = false,
  className = '',
  widthClassName = 'w-[114px] sm:w-[124px] md:w-[136px]',
  imageClassName = '',
  aspectRatio = 'aspect-[2/3]',
  subtitle,
  customBadge,
  onClick,
}) => {
  const { openMediaDetails } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);

  // Predictive Viewport Intersection Prefetching
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !item?.id || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          prefetchMediaDetails(item.id, item.category || 'anime');
          observer.disconnect();
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [item?.id, item?.category]);

  const handleClick = () => {
    if (onClick) {
      onClick(item);
    } else {
      openMediaDetails(item);
    }
  };

  // ================= HORIZONTAL / LIST ROW LAYOUT =================
  if (layout === 'horizontal') {
    return (
      <div
        ref={cardRef}
        onClick={handleClick}
        className={`flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors select-none group ${className}`}
      >
        {/* Poster Image with isolated #1e232a skeleton */}
        <PosterImage
          src={item.coverImage}
          alt={item.title}
          className={`rounded-xl border border-white/10 flex-shrink-0 shadow-md ${
            aspectRatio === 'aspect-[2/3]' ? 'w-[84px] h-[115px]' : aspectRatio
          }`}
          imgClassName="group-hover:scale-105 transition-transform duration-300"
        />

        {/* Real Metadata & Title (Zero Latency) */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {/* Format Pill */}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/90">
              {item.format || 'TV'}
            </span>

            {/* Release / Status */}
            {item.year && (
              <span className="text-[11px] font-semibold text-neutral-400">
                {item.year}
              </span>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-300 transition-colors">
            {item.title}
          </h3>

          {subtitle ? (
            subtitle
          ) : item.genres && item.genres.length > 0 ? (
            <p className="text-xs text-neutral-400 line-clamp-1 mt-1">
              {item.genres.slice(0, 3).join(' • ')}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // ================= COMPACT / THUMBNAIL LIST LAYOUT =================
  if (layout === 'compact') {
    return (
      <div
        ref={cardRef}
        onClick={handleClick}
        className={`flex items-center gap-3.5 p-3 bg-[#11131A] rounded-2xl border border-white/10 hover:border-purple-500/40 transition-all cursor-pointer shadow-lg group ${className}`}
      >
        <PosterImage
          src={item.coverImage}
          alt={item.title}
          className="w-14 h-20 rounded-xl shadow-md shrink-0"
          imgClassName="group-hover:scale-105 transition-transform"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
            {item.title}
          </h3>
          {subtitle}
        </div>
      </div>
    );
  }

  // ================= VERTICAL / GRID / RAIL CARD LAYOUT (DEFAULT) =================
  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      className={`group relative flex-shrink-0 cursor-pointer select-none ${widthClassName} ${className}`}
    >
      {/* Poster Image Container with static dark slate #1e232a Skeleton Overlay */}
      <PosterImage
        src={item.coverImage}
        alt={item.title}
        className={`${aspectRatio} rounded-2xl border border-white/5 shadow-md group-hover:scale-[1.03] transition-transform duration-200 ${imageClassName}`}
      >
        {/* Rating Score Badge (Bottom-Left Midnight Sapphire Pill - Rendered Immediately with real API score) */}
        {showScore && !isUpcoming && !showEpisodeBadge && !showHeartCount && (
          <RatingPill score={item.score} status={item.status} />
        )}

        {/* Episode Badge (Bottom-Left Royal Blue Pill e.g. EP 44, EP 30, EP 8) */}
        {showEpisodeBadge && (
          <div className="absolute bottom-2.5 left-2.5 z-10 select-none pointer-events-none">
            <div className="h-[27px] px-3.5 rounded-full bg-[#1e4ca6]/85 backdrop-blur-none border-2 border-white/70 text-white text-[12.5px] font-black shadow-md flex items-center justify-center leading-none tracking-tight">
              {item.currentEpisodeBadge ||
                (item.category === 'manga'
                  ? `CH ${item.latestEpisode || 1}`
                  : `EP ${item.latestEpisode || 1}`)}
            </div>
          </div>
        )}

        {/* Community Real Love / Heart react count badge */}
        {showHeartCount && Boolean(item.communityHearts) && (
          <div className="absolute bottom-2.5 left-2.5 z-10 select-none pointer-events-none">
            <div className="px-3 py-1 rounded-full bg-[#7c3aed]/95 backdrop-blur-md border border-white/40 text-white text-xs font-black flex items-center gap-1.5 shadow-md leading-none tracking-tight">
              <Heart className="w-3.5 h-3.5 fill-current text-pink-300" />
              <span>
                {item.communityHearts! > 999
                  ? `${(item.communityHearts! / 1000).toFixed(1)}k`
                  : item.communityHearts}
              </span>
            </div>
          </div>
        )}

        {/* Upcoming N/A badge */}
        {isUpcoming && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white font-bold text-[10px] leading-none">
            {item.nextEpisodeCountdown ? item.nextEpisodeCountdown : 'UPCOMING'}
          </div>
        )}

        {/* Custom Overlay Badge if passed */}
        {customBadge}
      </PosterImage>

      {/* Real Title displayed immediately in crisp typography without any skeleton UI (Zero Latency) */}
      <h3 className="mt-2 text-xs sm:text-[13px] font-semibold text-white line-clamp-2 leading-[1.25] text-left group-hover:text-[#4ade80] transition-colors">
        {item.title}
      </h3>

      {subtitle}
    </div>
  );
};
