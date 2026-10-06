import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isImagePreloaded, markImageLoaded } from '../../services/cacheService';

export interface PosterImageProps {
  src?: string | null;
  alt: string;
  className?: string; // Container classes (e.g. "aspect-[2/3] rounded-2xl")
  imgClassName?: string; // Image classes (e.g. "group-hover:scale-[1.03]")
  containerClassName?: string;
  children?: React.ReactNode; // Overlays (e.g. Score badge, Episode pill, Heart count)
  loading?: 'lazy' | 'eager';
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const PosterImage: React.FC<PosterImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  containerClassName = '',
  children,
  loading = 'lazy',
  referrerPolicy = 'no-referrer',
  onClick,
}) => {
  // Normalize source: trim whitespace and upgrade any insecure http:// to https://
  const normalizeUrl = (url?: string | null): string | null => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://')) {
      return trimmed.replace('http://', 'https://');
    }
    return trimmed;
  };

  const initialUrl = normalizeUrl(src);
  const [currentSrc, setCurrentSrc] = useState<string | null>(initialUrl);
  const [isLoaded, setIsLoaded] = useState<boolean>(() => (initialUrl ? isImagePreloaded(initialUrl) : false));
  const [hasError, setHasError] = useState<boolean>(false);
  const [hasRetriedProxy, setHasRetriedProxy] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync state when src prop updates
  useEffect(() => {
    const nextUrl = normalizeUrl(src);
    setCurrentSrc(nextUrl);
    setHasError(false);
    setHasRetriedProxy(false);

    if (nextUrl && isImagePreloaded(nextUrl)) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }

    if (nextUrl && imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      markImageLoaded(nextUrl);
      setIsLoaded(true);
    }
  }, [src]);

  const handleLoad = useCallback(() => {
    if (currentSrc) {
      markImageLoaded(currentSrc);
    }
    setIsLoaded(true);
    setHasError(false);
  }, [currentSrc]);

  const handleError = useCallback(() => {
    // If the real image failed due to hotlinking or CORS, attempt to fetch the same real image through the proxy once
    if (!hasRetriedProxy && currentSrc) {
      setHasRetriedProxy(true);
      if (currentSrc.startsWith('/api/image-proxy')) {
        // If proxy failed, try direct original URL
        try {
          const parsed = new URL(currentSrc, 'http://localhost:3000');
          const original = parsed.searchParams.get('url');
          if (original && original !== currentSrc) {
            setCurrentSrc(original);
            return;
          }
        } catch {}
      } else if (currentSrc.startsWith('http://') || currentSrc.startsWith('https://')) {
        // If direct failed, try proxying the exact real image URL
        setCurrentSrc(`/api/image-proxy?url=${encodeURIComponent(currentSrc)}`);
        return;
      }
    }

    // If both direct and proxy fail, mark error (do not use fake SVG or mock images)
    setHasError(true);
    setIsLoaded(false);
  }, [currentSrc, hasRetriedProxy]);

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-[#1e232a] border border-white/5 ${className} ${containerClassName}`}
    >
      {/* 1. SKELETON / MATTE BOX PLACEHOLDER (Solid clean matte slate, zero shimmer) */}
      {(!isLoaded || hasError || !currentSrc) && (
        <div className="absolute inset-0 bg-[#1e232a] z-0 pointer-events-none" />
      )}

      {/* 2. REAL API IMAGE (Smooth opacity transition when loaded from real API) */}
      {currentSrc && !hasError && (
        <img
          ref={imgRef}
          key={currentSrc}
          src={currentSrc}
          alt={alt}
          loading={loading}
          referrerPolicy={referrerPolicy}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
        />
      )}

      {/* 3. OVERLAYS (Scores, badges, tags) - Rendered on top */}
      {children && <div className="absolute inset-0 pointer-events-none z-10">{children}</div>}
    </div>
  );
};
