import React, { useMemo } from 'react';
import { MediaItem } from '../../types';
import { MediaCard } from '../common/MediaCard';

export interface MediaHorizontalListProps {
  items: MediaItem[];
  loading: boolean;
  showScore?: boolean;
  showEpisodeBadge?: boolean;
  showHeartCount?: boolean;
  isUpcoming?: boolean;
}

export const MediaHorizontalList: React.FC<MediaHorizontalListProps> = ({
  items,
  loading,
  showScore,
  showEpisodeBadge,
  showHeartCount,
  isUpcoming,
}) => {
  // Deduplicate items at the presentation layer
  const uniqueItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    return Array.from(new Map(items.map((item) => [String(item.id), item])).values());
  }, [items]);

  if (loading && uniqueItems.length === 0) {
    return (
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[114px] sm:w-[124px] md:w-[136px] select-none">
            <div className="aspect-[2/3] rounded-2xl bg-[#1e232a] border border-white/5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
      {uniqueItems.map((item) => (
        <MediaCard
          key={item.id}
          item={item}
          layout="vertical"
          showScore={showScore}
          showEpisodeBadge={showEpisodeBadge}
          showHeartCount={showHeartCount}
          isUpcoming={isUpcoming}
        />
      ))}
    </div>
  );
};

// Also export as MediaRow for seamless backward compatibility
export const MediaRow = MediaHorizontalList;


