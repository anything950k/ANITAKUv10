import React, { useState, useMemo } from 'react';
import { PosterImage } from '../common/PosterImage';

export type UpcomingFormat = 'All' | 'TV' | 'Movie' | 'Special';
export const UPCOMING_FORMAT_OPTIONS: UpcomingFormat[] = ['All', 'TV', 'Movie', 'Special'];

export interface UpcomingItem {
  id: string | number;
  title: string;
  coverImage: string;
  format?: string;
}

interface UpcomingSectionProps {
  seasonTitle?: string;
  items: UpcomingItem[];
  onSelectMedia: (item: UpcomingItem) => void;
  isLoading?: boolean;
  activeFilter?: UpcomingFormat;
  onFilterChange?: (filter: UpcomingFormat) => void;
  hideHeader?: boolean;
}

export const UpcomingSection: React.FC<UpcomingSectionProps> = ({
  seasonTitle = 'Fall 2026',
  items = [],
  onSelectMedia,
  isLoading = false,
  activeFilter: controlledFilter,
  onFilterChange,
  hideHeader = false,
}) => {
  const [internalFilter, setInternalFilter] = useState<UpcomingFormat>('All');
  const activeFilter = controlledFilter !== undefined ? controlledFilter : internalFilter;

  const handleFilterSelect = (fmt: UpcomingFormat) => {
    if (controlledFilter === undefined) {
      setInternalFilter(fmt);
    }
    onFilterChange?.(fmt);
  };

  const filteredItems = useMemo(() => {
    const unique = Array.from(new Map(items.map((i) => [String(i.id), i])).values());
    return unique.filter((item) => {
      if (activeFilter === 'All') return true;
      const fmt = String(item.format || '').toUpperCase();
      if (activeFilter === 'TV') return fmt === 'TV' || fmt === 'TV_SHORT';
      if (activeFilter === 'Movie') return fmt === 'MOVIE';
      if (activeFilter === 'Special') return ['SPECIAL', 'OVA', 'ONA', 'MUSIC'].includes(fmt);
      return true;
    });
  }, [items, activeFilter]);

  return (
    <div className="w-full">
      {/* 1. Dynamic Season Header (Rendered only if not hidden by sticky header) */}
      {!hideHeader && (
        <>
          <div className="mb-4 text-left">
            {seasonTitle.includes(' ') ? (
              <h2 className="flex items-center gap-1 sm:gap-1.5 text-lg sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
                <span>{seasonTitle.split(' ')[0]}</span>
                <span>{seasonTitle.split(' ').slice(1).join(' ')}</span>
              </h2>
            ) : (
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
                {seasonTitle}
              </h2>
            )}
          </div>

          {/* 2. Format Filter Pills */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar select-none">
            {UPCOMING_FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => handleFilterSelect(fmt)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  activeFilter === fmt
                    ? 'bg-[#a855f7] text-white border-[#a855f7] shadow-sm shadow-purple-900/40'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 3. Upcoming Media List */}
      {isLoading || items.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 py-1.5">
              {/* Empty static dark slate container (#1e232a) skeleton overlay exclusively for the image area */}
              <div className="w-[74px] h-[96px] sm:w-[82px] sm:h-[106px] rounded-2xl bg-[#1e232a] border border-white/5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-4 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 text-xs text-neutral-400 backdrop-blur-md">
          No upcoming {activeFilter} anime found in this category.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectMedia(item)}
              className="flex items-center gap-4 py-1.5 cursor-pointer transition-colors group"
            >
              {/* 74px x 96px Thumbnail with Poster Skeleton only during image load */}
              <PosterImage
                src={item.coverImage}
                alt={item.title}
                className="w-[74px] h-[96px] sm:w-[82px] sm:h-[106px] rounded-2xl flex-shrink-0 shadow-md"
                imgClassName="group-hover:scale-105 transition-transform"
              />

              {/* Title displayed immediately without any skeleton bars */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-300 transition-colors">
                  {item.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

