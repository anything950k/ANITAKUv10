import React from 'react';
import { STATUS_CONFIG } from '../../utils/libraryStatus';

export type ProfileLibraryStatus =
  | 'Favorites'
  | 'Watching'
  | 'Reading'
  | 'On Hold'
  | 'Planning'
  | 'Completed'
  | 'Dropped';

export interface ProfileStatusCounts {
  favorites?: number;
  watching?: number;
  reading?: number;
  onHold?: number;
  planning?: number;
  completed?: number;
  dropped?: number;
  [key: string]: number | undefined;
}

export interface ProfileStatusPillsProps {
  activeStatus?: ProfileLibraryStatus | string | null;
  onSelectStatus?: (status: ProfileLibraryStatus) => void;
  counts?: ProfileStatusCounts;
  className?: string;
  statuses?: ProfileLibraryStatus[];
}

interface StatusItemDefinition {
  id: ProfileLibraryStatus;
  label: string;
  countKey: keyof ProfileStatusCounts;
  capsuleClass: string;
  renderIcon: () => React.ReactNode;
}

export const PROFILE_STATUS_DEFINITIONS: StatusItemDefinition[] = [
  {
    id: 'Favorites',
    label: STATUS_CONFIG.Favorites.label,
    countKey: 'favorites',
    capsuleClass: STATUS_CONFIG.Favorites.pillClass,
    renderIcon: () => STATUS_CONFIG.Favorites.icon('w-[18px] h-[18px] sm:w-5 sm:h-5'),
  },
  {
    id: 'Watching',
    label: STATUS_CONFIG.Watching.label,
    countKey: 'watching',
    capsuleClass: STATUS_CONFIG.Watching.pillClass,
    renderIcon: () => STATUS_CONFIG.Watching.icon('w-[18px] h-[18px] sm:w-5 sm:h-5'),
  },
  {
    id: 'Reading',
    label: STATUS_CONFIG.Reading.label,
    countKey: 'reading',
    capsuleClass: STATUS_CONFIG.Reading.pillClass,
    renderIcon: () => STATUS_CONFIG.Reading.icon('w-[18px] h-[18px] sm:w-5 sm:h-5'),
  },
  {
    id: 'On Hold',
    label: STATUS_CONFIG['On Hold'].label,
    countKey: 'onHold',
    capsuleClass: STATUS_CONFIG['On Hold'].pillClass,
    renderIcon: () => STATUS_CONFIG['On Hold'].icon('w-[18px] h-[18px] sm:w-5 sm:h-5'),
  },
  {
    id: 'Planning',
    label: STATUS_CONFIG.Planning.label,
    countKey: 'planning',
    capsuleClass: STATUS_CONFIG.Planning.pillClass,
    renderIcon: () => STATUS_CONFIG.Planning.icon('w-[18px] h-[18px] sm:w-5 sm:h-5'),
  },
  {
    id: 'Completed',
    label: STATUS_CONFIG.Completed.label,
    countKey: 'completed',
    capsuleClass: STATUS_CONFIG.Completed.pillClass,
    renderIcon: () => STATUS_CONFIG.Completed.icon('w-[18px] h-[18px] sm:w-5 sm:h-5'),
  },
  {
    id: 'Dropped',
    label: STATUS_CONFIG.Dropped.label,
    countKey: 'dropped',
    capsuleClass: STATUS_CONFIG.Dropped.pillClass,
    renderIcon: () => STATUS_CONFIG.Dropped.icon('w-[18px] h-[18px] sm:w-5 sm:h-5'),
  },
];

export const ProfileStatusPills: React.FC<ProfileStatusPillsProps> = ({
  activeStatus,
  onSelectStatus,
  counts = {},
  className = '',
  statuses,
}) => {
  const itemsToRender = statuses
    ? PROFILE_STATUS_DEFINITIONS.filter((item) => statuses.includes(item.id))
    : PROFILE_STATUS_DEFINITIONS;

  const getCount = (def: StatusItemDefinition): number => {
    if (counts[def.countKey] !== undefined) {
      return counts[def.countKey]!;
    }
    if (counts[def.id] !== undefined) {
      return counts[def.id]!;
    }
    if (counts[def.id.toLowerCase()] !== undefined) {
      return counts[def.id.toLowerCase()]!;
    }
    return 0;
  };

  return (
    <div
      className={`flex items-center gap-3 overflow-x-auto no-scrollbar py-2.5 px-4 scroll-smooth touch-pan-x ${className}`}
    >
      {itemsToRender.map((item) => {
        const count = getCount(item);
        const isActive = activeStatus === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectStatus?.(item.id)}
            className={`flex items-center gap-2.5 px-4.5 sm:px-5 py-2.5 sm:py-3 rounded-[15px] sm:rounded-[18px] border-[1.8px] text-[14px] sm:text-[15px] font-bold tracking-tight whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 active:scale-95 ${item.capsuleClass} ${
              isActive ? 'ring-2 ring-white/50 shadow-md scale-[1.02]' : ''
            }`}
          >
            {item.renderIcon()}
            <span className="flex items-center gap-1.5 leading-none">
              <span className="font-extrabold text-[15px] sm:text-base">{count}</span>
              <span className="font-bold">{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ProfileStatusPills;
