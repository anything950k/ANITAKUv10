import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchAiringScheduleWeek, fetchUpcomingAnime } from '../../services/api';
import { ScheduleDay, ScheduleDayItem, MediaItem } from '../../types';
import { UpcomingSection, UpcomingFormat, UPCOMING_FORMAT_OPTIONS } from './UpcomingSection';
import { PosterImage } from '../common/PosterImage';
import { useCachedApi } from '../../hooks/useCachedApi';

type SubTab = 'schedule' | 'upcoming';

interface WeekDateItem {
  dayLabel: string; // 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  dateNum: number | string; // 1-31
  dateKey: string; // 'YYYY-MM-DD'
  isToday: boolean;
  rawDay: ScheduleDay;
}

interface TimeGroup {
  time: string;
  items: ScheduleDayItem[];
  isPast: boolean;
}

// Synchronously generate the current week's 7 days on initial render so there is NEVER a skeleton UI on the week selector
const generateCurrentWeekDays = (): ScheduleDay[] => {
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayNamesShort: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[] = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];

  return dayNames.map((dayName, idx) => {
    const dayDate = new Date(monday.getTime() + idx * 86400 * 1000);
    const isToday =
      dayDate.getDate() === now.getDate() &&
      dayDate.getMonth() === now.getMonth() &&
      dayDate.getFullYear() === now.getFullYear();

    const dateString = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayNameShort = dayNamesShort[idx];
    const dateNum = dayDate.getDate();

    return {
      day: dayName,
      dayName: dayNameShort,
      date: dateString,
      dateNumber: dateNum,
      isToday,
      items: [],
    };
  });
};

export const ScheduleView: React.FC = () => {
  const { openMediaDetails, activeNav } = useApp();

  // Active Sub-Tab: 'schedule' or 'upcoming'
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('schedule');

  // Schedule Tab States - Synchronously initialized with 7 calendar days to prevent skeleton UI on week cards
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');

  // Upcoming Tab Filter State - sticky in header
  const [upcomingFilter, setUpcomingFilter] = useState<UpcomingFormat>('All');

  // 1. Cached Airing Schedule Hook with SWR and 1-minute background polling
  const {
    data: cachedWeekDays = [],
    loading: scheduleLoading,
  } = useCachedApi<ScheduleDay[]>('schedule_week_airings', fetchAiringScheduleWeek, {
    pollingInterval: 60000,
    fallbackData: generateCurrentWeekDays(),
  });

  const weekDays = useMemo(() => {
    if (cachedWeekDays && cachedWeekDays.length > 0) {
      return cachedWeekDays;
    }
    return generateCurrentWeekDays();
  }, [cachedWeekDays]);

  // Check if real schedule airings have loaded into weekDays
  const hasLoadedWeekSchedule = useMemo(() => {
    return weekDays.some((d) => d.items && d.items.length > 0);
  }, [weekDays]);

  const isScheduleLoading = scheduleLoading || !hasLoadedWeekSchedule;

  const initialTodayIdx = useMemo(() => {
    const idx = weekDays.findIndex((d) => d.isToday);
    return idx >= 0 ? idx : 0;
  }, [weekDays]);

  // Set default selected date once weekDays is loaded
  useEffect(() => {
    if (!selectedDateKey && weekDays.length > 0) {
      const initialDay = weekDays[initialTodayIdx] || weekDays[0];
      if (initialDay) {
        setSelectedDateKey(`${initialDay.day.toLowerCase()}-${initialDay.date.replace(/\s+/g, '-').toLowerCase()}-${initialTodayIdx}`);
      }
    }
  }, [weekDays, initialTodayIdx, selectedDateKey]);

  // Ribbon auto-centering refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // 2. Cached Upcoming Anime Hook with SWR and background polling - Always enabled so switching tabs is instant!
  const {
    data: upcomingMedia = [],
    loading: upcomingLoading,
  } = useCachedApi<MediaItem[]>('schedule_upcoming_anime_all', () => fetchUpcomingAnime(60, 'All'), {
    pollingInterval: 120000,
    enabled: true,
  });

  // Calculate dynamic upcoming season string
  const upcomingSeasonTitle = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let seasonName = 'Spring';
    let seasonYear = year;

    if (month >= 1 && month <= 3) {
      seasonName = 'Spring';
      seasonYear = year;
    } else if (month >= 4 && month <= 6) {
      seasonName = 'Summer';
      seasonYear = year;
    } else if (month >= 7 && month <= 9) {
      seasonName = 'Fall';
      seasonYear = year;
    } else {
      seasonName = 'Winter';
      seasonYear = year + 1;
    }

    return `${seasonName} ${seasonYear}`;
  }, []);

  // Map 7 days with robust dateKey identification
  const weekDateItems: WeekDateItem[] = useMemo(() => {
    return weekDays.map((d, index) => ({
      dayLabel: d.dayName || d.day?.slice(0, 3) || 'Mon',
      dateNum: d.dateNumber ?? (index + 1),
      dateKey: `${d.day.toLowerCase()}-${d.date.replace(/\s+/g, '-').toLowerCase()}-${index}`,
      isToday: !!d.isToday,
      rawDay: d,
    }));
  }, [weekDays]);

  const activeDay = useMemo(() => {
    const found = weekDateItems.find((d) => d.dateKey === selectedDateKey);
    return found ? found.rawDay : weekDays[initialTodayIdx] || weekDays[0];
  }, [weekDateItems, selectedDateKey, weekDays, initialTodayIdx]);

  const todayItem = useMemo(() => {
    return weekDateItems.find((d) => d.isToday);
  }, [weekDateItems]);

  // Smooth centering glide math for selected date card
  const centerCard = (key: string, behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    const card = cardRefs.current[key];
    if (!container || !card) {
      return;
    }

    let targetScrollLeft = (card.offsetLeft + card.offsetWidth / 2) - (container.clientWidth / 2);

    if (card.offsetParent !== container) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const relativeLeft = cardRect.left - containerRect.left + container.scrollLeft;
      targetScrollLeft = (relativeLeft + cardRect.width / 2) - (container.clientWidth / 2);
    }

    container.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior,
    });
  };

  const contentScrollRef = useRef<HTMLDivElement>(null);

  const handleDateSelect = (key: string) => {
    setSelectedDateKey(key);

    const cardIndex = weekDateItems.findIndex((d) => d.dateKey === key);
    const isFirstTwoOrLastTwo =
      cardIndex >= 0 && (cardIndex <= 1 || cardIndex >= weekDateItems.length - 2);

    if (!isFirstTwoOrLastTwo) {
      centerCard(key, 'smooth');
    }

    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubTabChange = (tab: SubTab) => {
    setActiveSubTab(tab);
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleHeaderWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (contentScrollRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      contentScrollRef.current.scrollTop += e.deltaY;
    }
  };

  useEffect(() => {
    if (activeNav === 'schedule' && activeSubTab === 'schedule' && todayItem) {
      const targetKey = selectedDateKey || todayItem.dateKey;
      const timer = setTimeout(() => {
        centerCard(targetKey, 'smooth');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeNav, activeSubTab, todayItem]);

  // Group anime schedule items by airing time
  const timeGroups: TimeGroup[] = useMemo(() => {
    if (!activeDay || !activeDay.items || activeDay.items.length === 0) {
      return [];
    }

    const groups: { [time: string]: ScheduleDayItem[] } = {};
    activeDay.items.forEach((item) => {
      const t = item.airingTime || '12:00 AM';
      if (!groups[t]) {
        groups[t] = [];
      }
      groups[t].push(item);
    });

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const selectedItem = weekDateItems.find((d) => d.dateKey === selectedDateKey);
    const isDayToday = selectedItem?.isToday ?? false;

    // Check if the selected day is in the past relative to today
    const selectedIdx = weekDateItems.findIndex((d) => d.dateKey === selectedDateKey);
    const todayIdx = weekDateItems.findIndex((d) => d.isToday);
    const isPastDay = selectedIdx !== -1 && todayIdx !== -1 && selectedIdx < todayIdx;

    return Object.entries(groups).map(([time, items]) => {
      let isPast = isPastDay;

      if (isDayToday) {
        if (items.length > 0 && items[0].airingAt) {
          const nowUnix = Math.floor(Date.now() / 1000);
          isPast = items[0].airingAt <= nowUnix;
        } else {
          try {
            const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (match) {
              let h = parseInt(match[1], 10);
              const m = parseInt(match[2], 10);
              const ampm = match[3].toUpperCase();
              if (ampm === 'PM' && h < 12) h += 12;
              if (ampm === 'AM' && h === 12) h = 0;
              if (h < currentHour || (h === currentHour && m <= currentMinute)) {
                isPast = true;
              }
            }
          } catch {
            isPast = false;
          }
        }
      }

      return {
        time,
        items,
        isPast,
      };
    });
  }, [activeDay, selectedDateKey, weekDateItems]);

  return (
    <div className="relative w-full h-screen sm:h-[100dvh] flex flex-col bg-black text-white select-none overflow-hidden">
      {/* Background Top GIF Canvas (Positioned at top, vertically shifted 200px upwards, original sharpness, zero blur, smoothly fading to black at bottom starting 10px lower) */}
      <div className="absolute top-0 left-0 right-0 h-[490px] sm:h-[550px] pointer-events-none z-0 overflow-hidden">
        <img
          src="https://www.image2url.com/r2/default/gifs/1789558430922-112255c0-d284-4ff6-8d3b-67660513d194.gif"
          alt="Schedule Background Canvas"
          className="w-full h-[calc(100%+200px)] object-cover object-top -translate-y-[200px]"
          referrerPolicy="no-referrer"
        />
        {/* Ultra-smooth multi-stop gradient transition to solid black at bottom edge, starting 10px lower */}
        <div className="absolute inset-x-0 bottom-0 h-36 [background:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.15)_30%,rgba(0,0,0,0.5)_60%,rgba(0,0,0,0.85)_85%,#000000_100%)] pointer-events-none" />
      </div>

      {/* 1. FIXED / STICKY TOP HEADER (Schedule Title, Sub-tabs & Week Date Row) */}
      <header
        onWheel={handleHeaderWheel}
        className="flex-shrink-0 z-30 bg-transparent border-none"
      >
        <div className="w-full max-w-xl mx-auto px-4 sm:px-6 pt-5 pb-1">
          {/* 1.1 SCREEN HEADER */}
          <div className="tab-header-row justify-between">
            <h1 className="tab-title-text drop-shadow-md">
              Schedule
            </h1>
          </div>

          {/* 1.2 SUB-TABS HEADER ("Schedule" | "Upcoming") */}
          <div className="flex items-center justify-center gap-20 sm:gap-24 mb-3 pb-1">
            <button
              onClick={() => handleSubTabChange('schedule')}
              className={`text-base sm:text-lg font-extrabold tracking-wide pb-2.5 relative cursor-pointer select-none transition-colors ${
                activeSubTab === 'schedule' ? 'text-white' : 'text-neutral-400 hover:text-white/80'
              }`}
            >
              <span>Schedule</span>
              {/* Active indicator line matching DownloadManagerSheet exact style and switching behavior */}
              <div
                className={`h-[2.5px] rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 transition-all duration-200 ${
                  activeSubTab === 'schedule' ? 'w-8 sm:w-10 bg-[#a855f7]' : 'w-0 bg-transparent'
                }`}
              />
            </button>

            <button
              onClick={() => handleSubTabChange('upcoming')}
              className={`text-base sm:text-lg font-extrabold tracking-wide pb-2.5 relative cursor-pointer select-none transition-colors ${
                activeSubTab === 'upcoming' ? 'text-white' : 'text-neutral-400 hover:text-white/80'
              }`}
            >
              <span>Upcoming</span>
              {/* Active indicator line matching DownloadManagerSheet exact style and switching behavior */}
              <div
                className={`h-[2.5px] rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 transition-all duration-200 ${
                  activeSubTab === 'upcoming' ? 'w-8 sm:w-10 bg-[#a855f7]' : 'w-0 bg-transparent'
                }`}
              />
            </button>
          </div>

          {/* 1.3 WEEK & DATE SELECTION ROW (Only in Schedule sub-tab) */}
          {activeSubTab === 'schedule' && (
            <div
              ref={containerRef}
              className="relative flex items-center gap-3 sm:gap-3.5 justify-start overflow-x-auto pt-2 pb-3 px-3 sm:px-4 -mx-2 sm:-mx-3 min-h-[124px] sm:min-h-[136px] no-scrollbar scroll-smooth"
            >
              {weekDateItems.map((item) => {
                const isSelected = selectedDateKey === item.dateKey;

                return (
                  <button
                    key={item.dateKey}
                    ref={(el) => {
                      cardRefs.current[item.dateKey] = el;
                    }}
                    onClick={() => handleDateSelect(item.dateKey)}
                    className={
                      isSelected
                        ? 'min-w-[84px] sm:min-w-[94px] h-[98px] sm:h-[108px] rounded-2xl flex-shrink-0 bg-[#a855f7] border border-purple-400 scale-105 z-10 text-white shadow-[inset_0_0_12px_rgba(255,255,255,0.25)] transition-all duration-200 relative overflow-hidden flex flex-col items-center justify-center cursor-pointer box-border'
                        : 'min-w-[84px] sm:min-w-[94px] h-[98px] sm:h-[108px] rounded-2xl flex-shrink-0 bg-[#141419]/80 border border-white/10 shadow-lg hover:border-white/20 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer box-border'
                    }
                  >
                    {/* Internal Contained Gradient Overlay (Zero Outer Bleed) */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-b from-purple-400/25 via-transparent to-purple-900/40 rounded-2xl pointer-events-none" />
                    )}

                    {/* Day Text */}
                    <span
                      className={
                        isSelected
                          ? 'text-xs sm:text-sm font-extrabold text-white mb-1 relative z-10'
                          : item.isToday
                          ? 'text-xs sm:text-sm font-semibold mb-1 text-[#a855f7] font-extrabold'
                          : 'text-xs sm:text-sm font-semibold mb-1 text-neutral-400'
                      }
                    >
                      {item.dayLabel}
                    </span>

                    {/* Date Number */}
                    <span
                      className={
                        isSelected
                          ? 'text-xl sm:text-2xl font-black text-white relative z-10'
                          : 'text-xl sm:text-2xl font-black text-white'
                      }
                    >
                      {item.dateNum}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 1.4 UPCOMING SUB-TAB STICKY HEADER (Season Title & Filter Pills) */}
          {activeSubTab === 'upcoming' && (
            <div className="pt-2 pb-1.5">
              {/* Dynamic Season Header */}
              <div className="mb-3 text-left">
                {upcomingSeasonTitle.includes(' ') ? (
                  <h2 className="flex items-center gap-1 sm:gap-1.5 text-lg sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
                    <span>{upcomingSeasonTitle.split(' ')[0]}</span>
                    <span>{upcomingSeasonTitle.split(' ').slice(1).join(' ')}</span>
                  </h2>
                ) : (
                  <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
                    {upcomingSeasonTitle}
                  </h2>
                )}
              </div>

              {/* Format Filter Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
                {UPCOMING_FORMAT_OPTIONS.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setUpcomingFilter(fmt);
                      contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      upcomingFilter === fmt
                        ? 'bg-[#a855f7] text-white border-[#a855f7] shadow-sm shadow-purple-900/40'
                        : 'bg-[#141419]/80 border-white/10 text-neutral-300 hover:text-white hover:border-white/25 shadow-sm'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. SCROLLABLE CONTENT AREA (ONLY CONTENT BELOW SCROLLS) */}
      <div
        ref={contentScrollRef}
        className="flex-1 w-full overflow-y-auto no-scrollbar overscroll-contain relative z-10"
      >
        <div className={`w-full max-w-xl mx-auto px-4 sm:px-6 pb-40 ${activeSubTab === 'upcoming' ? 'pt-3' : 'pt-5'}`}>
          {/* ======================================================== */}
          {/* SUB-TAB 1: SCHEDULE TIMELINE CONTENT                    */}
          {/* ======================================================== */}
          {activeSubTab === 'schedule' && (
            <div className="relative pl-6 sm:pl-7 pt-1">
              {isScheduleLoading ? (
                <div className="space-y-7">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="relative">
                      <div className="w-16 h-3 bg-white/10 rounded mb-3" />
                      <div className="flex items-center gap-4 py-1.5">
                        <div className="w-[74px] h-[96px] sm:w-[82px] sm:h-[106px] rounded-2xl bg-[#1e232a] border border-white/5 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="w-3/4 h-4 bg-white/10 rounded" />
                          <div className="w-1/4 h-3 bg-white/5 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : timeGroups.length === 0 ? (
                <div className="py-20 text-center space-y-2">
                  <p className="text-sm font-bold text-white/70">No scheduled airings found for this day</p>
                  <p className="text-xs text-neutral-400">Select another day in the ribbon above to explore anime releases.</p>
                </div>
              ) : (
                <div className="space-y-7">
                  {timeGroups.map((group, groupIdx) => {
                    const isLastGroup = groupIdx === timeGroups.length - 1;

                    return (
                      <div key={group.time} className="relative">
                        {/* Vertical Connecting Line */}
                        {!isLastGroup && (
                          <div className="w-[2px] bg-purple-500/40 absolute left-[-17px] sm:left-[-19px] top-[13px] bottom-[-41px]" />
                        )}

                        {/* Milestone Indicator Dot */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full absolute -left-[23px] sm:-left-[25px] top-1.5 ${
                            group.isPast
                              ? 'bg-[#a855f7] shadow-md shadow-purple-500/40'
                              : 'border-2 border-[#a855f7] bg-black'
                          }`}
                        />

                        {/* Time Slot Header */}
                        <h2 className="text-xs font-black tracking-wider text-purple-400 uppercase mb-3 font-mono">
                          {group.time}
                        </h2>

                        {/* Items in Time Group */}
                        <div className="space-y-3">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => openMediaDetails(item.media)}
                              className="flex items-center gap-4 py-1.5 group cursor-pointer"
                            >
                              <PosterImage
                                src={item.media.coverImage}
                                alt={item.media.title}
                                className="w-[74px] h-[96px] sm:w-[82px] sm:h-[106px] rounded-2xl flex-shrink-0 shadow-md"
                                imgClassName="group-hover:scale-105 transition-transform"
                              />

                              <div className="flex-1 min-w-0 pr-2">
                                <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-300 transition-colors">
                                  {item.media.title}
                                </h3>
                                <p className="text-xs font-medium text-neutral-400 mt-1.5">
                                  Episode {item.episodeNumber}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-TAB 2: UPCOMING ANIME (SEASON & FILTER PILLS)       */}
          {/* ======================================================== */}
          {activeSubTab === 'upcoming' && (
            <UpcomingSection
              seasonTitle={upcomingSeasonTitle}
              items={upcomingMedia}
              onSelectMedia={(item) => openMediaDetails(item as MediaItem)}
              isLoading={upcomingLoading}
              activeFilter={upcomingFilter}
              onFilterChange={setUpcomingFilter}
              hideHeader={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};
