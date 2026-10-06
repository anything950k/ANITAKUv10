import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, MediaCategory } from '../../types';
import { useHeroTrendingFeed } from '../../hooks/useHeroTrendingFeed';
import { fetchMediaLogo } from '../../services/logoService';

interface HeroCarouselProps {
  activeCategory: MediaCategory;
  onSelectMedia: (item: MediaItem) => void;
  passedItems?: MediaItem[];
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  activeCategory,
  onSelectMedia,
  passedItems = [],
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logoUrls, setLogoUrls] = useState<Record<string, string | null>>({});
  const [failedLogos, setFailedLogos] = useState<Set<number | string>>(new Set());

  // 10-Second Automatic Interval and Swipe/Drag State
  const AUTO_ROTATE_MS = 10000;
  const [timerResetKey, setTimerResetKey] = useState(0);

  // Real-time trending API feed with strict category matching & exact 10 deduplicated items
  const { displayItems } = useHeroTrendingFeed(activeCategory, passedItems);
  const carouselItems = displayItems.length > 0 ? displayItems : passedItems;

  const resetAutoRotateTimer = () => {
    setTimerResetKey((prev) => prev + 1);
  };

  // Instant Category Tab Switching & Index Reset
  useEffect(() => {
    setCurrentIndex(0);
    resetAutoRotateTimer();
  }, [activeCategory]);

  // Fetch dynamic title logos for current carousel items
  useEffect(() => {
    if (carouselItems.length === 0) return;
    let isCancelled = false;
    carouselItems.forEach((item) => {
      if (item && item.title && logoUrls[item.title] === undefined) {
        fetchMediaLogo(item.title, {
          englishTitle: item.englishTitle,
          romajiTitle: item.romajiTitle,
          category: item.category,
          idMal: item.idMal,
        })
          .then((url) => {
            if (!isCancelled) {
              setLogoUrls((prev) => ({ ...prev, [item.title]: url }));
            }
          })
          .catch(() => {});
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [carouselItems, logoUrls]);

  // Automatic slide rotation (10-Second Interval)
  useEffect(() => {
    if (!carouselItems || carouselItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
    }, AUTO_ROTATE_MS);

    return () => clearInterval(timer);
  }, [carouselItems.length, timerResetKey]);

  // Touch and Drag handling
  const touchStartX = useRef<number | null>(null);
  const dragDistance = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    dragDistance.current = 0;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    dragDistance.current = touchStartX.current - currentX;
  };

  const handleTouchEnd = () => {
    if (!isDragging.current || carouselItems.length <= 1) {
      isDragging.current = false;
      touchStartX.current = null;
      return;
    }
    const threshold = 40;
    if (dragDistance.current > threshold) {
      // Swiped Left -> Next Slide
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
      resetAutoRotateTimer();
    } else if (dragDistance.current < -threshold) {
      // Swiped Right -> Previous Slide
      setCurrentIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);
      resetAutoRotateTimer();
    }
    isDragging.current = false;
    touchStartX.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    dragDistance.current = 0;
    isDragging.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || touchStartX.current === null) return;
    dragDistance.current = touchStartX.current - e.clientX;
  };

  const handleMouseUp = () => {
    if (!isDragging.current || carouselItems.length <= 1) {
      isDragging.current = false;
      touchStartX.current = null;
      return;
    }
    const threshold = 40;
    if (dragDistance.current > threshold) {
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
      resetAutoRotateTimer();
    } else if (dragDistance.current < -threshold) {
      setCurrentIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);
      resetAutoRotateTimer();
    }
    isDragging.current = false;
    touchStartX.current = null;
  };

  const handleMouseLeave = () => {
    if (isDragging.current) {
      handleMouseUp();
    }
  };

  const handleItemClick = (item: MediaItem) => {
    if (Math.abs(dragDistance.current) < 10) {
      resetAutoRotateTimer();
      onSelectMedia(item);
    }
  };

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
    resetAutoRotateTimer();
  };

  const currentItem =
    carouselItems && carouselItems.length > 0
      ? carouselItems[currentIndex % carouselItems.length]
      : null;
  const rawCover = currentItem?.coverImage || currentItem?.bannerImage;
  const coverSrc =
    rawCover && typeof rawCover === 'string' && rawCover.trim() !== ''
      ? rawCover.trim()
      : null;
  const genresSubtitle = currentItem?.genres?.slice(0, 3).join(' • ') || '';
  const rawLogo = currentItem ? logoUrls[currentItem.title] || currentItem.logoImage : null;
  const activeLogoUrl =
    currentItem && !failedLogos.has(currentItem.id) && rawLogo && typeof rawLogo === 'string' && rawLogo.trim() !== ''
      ? rawLogo.trim()
      : null;

  return (
    <div
      className="relative w-full h-[460px] sm:h-[520px] min-h-[460px] sm:min-h-[520px] overflow-hidden select-none bg-[#1e232a] cursor-grab active:cursor-grabbing"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={() => currentItem && handleItemClick(currentItem)}
    >
      {/* 1. Backdrop Cover Image & Dual Gradients */}
      <div className="absolute inset-0 bg-[#1e232a]">
        {coverSrc ? (
          <img
            key={`cover-${currentItem?.id || coverSrc}`}
            src={coverSrc}
            alt={currentItem?.title || 'Cover'}
            className="w-full h-full object-cover object-[center_20%] opacity-90 pointer-events-none transition-opacity duration-300 ease-out"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[#1e232a]" />
        )}
        {/* Dual Gradients for seamless background transition */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black pointer-events-none" />
      </div>

      {/* 2. Centered Overlay: Logo/Title + Genres (Bottom-Aligned Content Container - Atomic Keyed) */}
      {currentItem && (
        <div
          key={`overlay-${currentItem.id}`}
          className="relative z-10 flex flex-col items-center justify-end h-full pb-10 px-4 text-center pointer-events-auto"
        >
          <div className="mb-2 sm:mb-3 w-3/4 max-w-[280px] sm:max-w-[360px] flex flex-col items-center justify-center min-h-[56px] sm:min-h-[72px]">
            {activeLogoUrl ? (
              <img
                key={`logo-${currentItem.id}-${activeLogoUrl}`}
                src={activeLogoUrl}
                alt={currentItem.title}
                className="w-full h-auto max-h-24 sm:max-h-32 object-contain filter brightness-110 my-1 drop-shadow-2xl pointer-events-none select-none"
                onError={() =>
                  setFailedLogos((prev) => new Set(prev).add(currentItem.id))
                }
              />
            ) : (
              <h1
                key={`title-${currentItem.id}`}
                className="text-2xl sm:text-4xl font-extrabold tracking-wide text-white uppercase text-center max-w-xs sm:max-w-md line-clamp-2 px-2 select-none drop-shadow-lg mb-2"
              >
                {currentItem.title}
              </h1>
            )}
          </div>

          {genresSubtitle && (
            <p
              key={`genres-${currentItem.id}`}
              className="text-xs sm:text-sm font-extrabold text-white/90 tracking-wider drop-shadow-md"
            >
              {genresSubtitle}
            </p>
          )}
        </div>
      )}

      {/* 3. Progress Indicators (Bottom-12px) */}
      {carouselItems.length > 1 && (
        <div
          className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {carouselItems.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(idx);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex % carouselItems.length
                  ? 'w-6 bg-white'
                  : 'w-1.5 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
