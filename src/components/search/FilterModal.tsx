import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useApp, DEFAULT_FILTERS } from '../../context/AppContext';
import { FilterOptions } from '../../types';

// Dotted Range Slider matching the Manga Reader design with left & right vertical lines and dots
const MangaDottedSlider: React.FC<{
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (val: [number, number]) => void;
  dotCount?: number;
}> = ({ min, max, step, value, onChange, dotCount }) => {
  const currentMin = value[0];
  const currentMax = value[1];

  const minPct = Math.min(Math.max(((currentMin - min) / (max - min)) * 100, 0), 100);
  const maxPct = Math.min(Math.max(((currentMax - min) / (max - min)) * 100, 0), 100);

  const numDots = dotCount || Math.min(Math.round((max - min) / step) + 1, 60);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();

    const clientX = e.clientX;
    const rawPct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const rawVal = min + rawPct * (max - min);
    const snapped = Math.round(rawVal / step) * step;

    const distToMin = Math.abs(snapped - currentMin);
    const distToMax = Math.abs(snapped - currentMax);
    const movingMin = distToMin <= distToMax;

    const update = (x: number) => {
      const p = Math.min(Math.max((x - rect.left) / rect.width, 0), 1);
      const v = Math.round((min + p * (max - min)) / step) * step;
      if (movingMin) {
        const nextMin = Math.min(Math.max(v, min), currentMax);
        onChange([nextMin, currentMax]);
      } else {
        const nextMax = Math.max(Math.min(v, max), currentMin);
        onChange([currentMin, nextMax]);
      }
    };

    update(clientX);

    const onPointerMove = (moveEvt: PointerEvent) => {
      update(moveEvt.clientX);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className="relative flex items-center h-14 select-none touch-none cursor-pointer group px-0.5"
    >
      {/* 1. Left Unfilled Dark Track (Ends 6px before left vertical line with rounded-r-[3.5px], matching Manga Reader slider) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#181826] rounded-l-full rounded-r-[3.5px] overflow-hidden shadow-inner z-[2]"
        style={{
          left: '4px',
          width: `calc((100% - 8px) * ${minPct / 100} - 6px)`,
          display: minPct > 2 ? 'block' : 'none',
        }}
      />

      {/* 2. Middle Active Purple Solid Bar (Starts 6px after left line, ends 6px before right line with rounded-[3.5px], matching Manga Reader slider) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#a855f7] rounded-[3.5px] overflow-hidden z-[2]"
        style={{
          left: `calc(4px + (100% - 8px) * ${minPct / 100} + 6px)`,
          width: `calc((100% - 8px) * ${(maxPct - minPct) / 100} - 12px)`,
          display: maxPct - minPct > 3 ? 'block' : 'none',
        }}
      />

      {/* 3. Right Unfilled Dark Track (Starts 6px after right vertical line with rounded-l-[3.5px], matching Manga Reader slider) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#181826] rounded-l-[3.5px] rounded-r-full overflow-hidden shadow-inner z-[2]"
        style={{
          left: `calc(4px + (100% - 8px) * ${maxPct / 100} + 6px)`,
          right: '4px',
          display: maxPct < 98 ? 'block' : 'none',
        }}
      />

      {/* 4. Fixed Dots Across the Entire Track (1st & last dot hidden; dots inside the 6px indicator gap hidden) */}
      <div className="absolute inset-0 pointer-events-none z-[4]">
        {Array.from({ length: numDots }).map((_, i) => {
          // Hide first dot and last dot
          if (i === 0 || i === numDots - 1) return null;

          const dotPct = numDots > 1 ? (i / (numDots - 1)) * 100 : 50;

          // Hide dots in or near the 6px indicator gap (matching MangaReaderModal isCurrent)
          const isNearMin = Math.abs(dotPct - minPct) <= (100 / (numDots - 1)) * 0.7;
          const isNearMax = Math.abs(dotPct - maxPct) <= (100 / (numDots - 1)) * 0.7;
          if (isNearMin || isNearMax) return null;

          const isInside = dotPct > minPct && dotPct < maxPct;
          return (
            <div
              key={i}
              style={{ left: `calc(4px + (100% - 8px) * ${dotPct / 100})` }}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full shrink-0 ${
                isInside
                  ? 'bg-black w-[3.5px] h-[3.5px] sm:w-[4px] sm:h-[4px]'
                  : 'bg-[#a855f7]/50 w-[2.5px] h-[2.5px]'
              }`}
            />
          );
        })}
      </div>

      {/* 5. Left Vertical Purple Indicator Line | (Matches Manga Reader Slider Indicator) */}
      <div
        className="absolute top-1/2 pointer-events-none z-10"
        style={{
          left: `calc(4px + (100% - 8px) * ${minPct / 100})`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="w-[3.5px] sm:w-[4px] h-[46px] sm:h-[50px] bg-[#a855f7] rounded-full shadow-[0_0_12px_rgba(168,85,247,0.95)]" />
      </div>

      {/* 6. Right Vertical Purple Indicator Line | (Matches Manga Reader Slider Indicator) */}
      <div
        className="absolute top-1/2 pointer-events-none z-10"
        style={{
          left: `calc(4px + (100% - 8px) * ${maxPct / 100})`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="w-[3.5px] sm:w-[4px] h-[46px] sm:h-[50px] bg-[#a855f7] rounded-full shadow-[0_0_12px_rgba(168,85,247,0.95)]" />
      </div>
    </div>
  );
};

export const FilterModal: React.FC = () => {
  const { filters, setFilters, showFilterModal, setShowFilterModal } = useApp();
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [advancedTagsOpen, setAdvancedTagsOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Sync draft state whenever the modal opens
  useEffect(() => {
    if (showFilterModal) {
      setLocalFilters(filters);
      setTagSearchQuery('');
      setAdvancedTagsOpen(false);
    }
  }, [showFilterModal, filters]);

  if (!showFilterModal) return null;

  const genresList = [
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Ecchi',
    'Horror',
    'Fantasy',
    'Mahou Shoujo',
    'Mecha',
    'Music',
    'Mystery',
    'Psychological',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Sports',
    'Supernatural',
    'Thriller',
    'Harem',
    'Reverse Harem',
    "Girls' Love",
    "Boys' Love",
    'Gourmet',
    'Isekai',
    'School',
    'Military',
    'Vampire',
    'Shounen',
    'Shoujo',
    'Seinen',
    'Josei',
    'Kids',
  ];

  const isMangaOrNovel = localFilters.category === 'manga' || localFilters.category === 'novel';
  const formatList = isMangaOrNovel
    ? ['Manga', 'One Shot']
    : ['TV', 'Movie', 'ONA', 'OVA', 'Special'];
  const statusList = ['Releasing', 'Finished', 'Upcoming'];
  const libraryOptions = ['Any', 'In Library', 'Not In Library'] as const;
  const minScoreOptions = ['Any', '6+', '7+', '8+', '9+'] as const;
  const yearChips = ['Any', '2028', '2027', '2026', '2025', '2024', '2023', '2022', '2021', '2020'];
  const seasonOptions = ['Any', 'Winter', 'Spring', 'Summer', 'Fall'];
  const tagCategoryOptions: ('Theme' | 'Demographic' | 'Setting' | 'Cast' | 'Technical')[] = [
    'Theme',
    'Demographic',
    'Setting',
    'Cast',
    'Technical',
  ];

  const getPillClass = (isSelected: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[15px] font-medium transition-all cursor-pointer select-none ${
      isSelected
        ? 'bg-[#221438] text-white border border-[#8b5cf6]'
        : 'border border-[#2d3040] bg-[#13151f] text-white hover:border-white/25'
    }`;

  const advancedTagGroups = {
    Cast: [
      'Female Protagonist',
      'Male Protagonist',
      'Ensemble Cast',
      'Anti-Hero',
      'Villainess',
      'Primarily Female Cast',
      'Primarily Male Cast',
      'Chibi',
      'Kemonomimi',
    ],
    Setting: [
      'Work',
      'College',
      'Urban',
      'Rural',
      'Historical',
      'Space',
      'Post-Apocalyptic',
      'Cyberpunk',
      'Dystopian',
      'Kingdom Management',
    ],
    Story: [
      'Coming of Age',
      'Tragedy',
      'Revenge',
      'Survival',
      'Politics',
      'War',
      'Time Manipulation',
      'Travel',
      'Detective',
      'Mystery',
      'Conspiracy',
    ],
    Action: [
      'Magic',
      'Super Power',
      'Martial Arts',
      'Swordplay',
      'Guns',
      'Tanks',
      'Archery',
      'Espionage',
      'Assassins',
      'Battle Royale',
    ],
    Tone: [
      'Iyashikei',
      'Cute Girls Doing Cute Things',
      'Parody',
      'Satire',
      'Philosophy',
      'Psychosexual',
      'Denpa',
      'Noir',
      'Slapstick',
    ],
    Culture: [
      'Video Games',
      'Idol',
      'Music',
      'Mythology',
      'Youkai',
      'Samurai',
      'Ninja',
      'Otaku Culture',
      'Fashion',
      'Photography',
    ],
  };

  const toggleGenre = (genre: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre],
    }));
  };

  const toggleFormat = (fmt: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      format: prev.format.includes(fmt)
        ? prev.format.filter((f) => f !== fmt)
        : [...prev.format, fmt],
    }));
  };

  const toggleStatus = (st: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      status: prev.status.includes(st)
        ? prev.status.filter((s) => s !== st)
        : [...prev.status, st],
    }));
  };

  const handleLibraryChange = (lib: 'Any' | 'In Library' | 'Not In Library') => {
    setLocalFilters((prev) => ({ ...prev, libraryState: lib }));
  };

  const handleMinScoreChange = (score: 'Any' | '6+' | '7+' | '8+' | '9+') => {
    setLocalFilters((prev) => ({ ...prev, minScore: score }));
  };

  const handleYearChip = (year: string) => {
    setLocalFilters((prev) => ({ ...prev, selectedYear: year }));
  };

  const toggleSeason = (season: string) => {
    if (season === 'Any') {
      setLocalFilters((prev) => ({ ...prev, season: [] }));
      return;
    }
    setLocalFilters((prev) => ({
      ...prev,
      season: prev.season.includes(season)
        ? prev.season.filter((s) => s !== season)
        : [...prev.season, season],
    }));
  };

  const toggleAdvancedTag = (tag: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      advancedTags: prev.advancedTags.includes(tag)
        ? prev.advancedTags.filter((t) => t !== tag)
        : [...prev.advancedTags, tag],
    }));
  };

  const handleReset = () => {
    const resetState = {
      ...DEFAULT_FILTERS,
      category: filters.category,
      query: filters.query,
    };
    setLocalFilters(resetState);
    setFilters(resetState);
    setShowFilterModal(false);
  };

  const handleApply = () => {
    setFilters(localFilters);
    setShowFilterModal(false);
  };

  const handleClose = () => {
    setShowFilterModal(false);
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black overflow-y-auto no-scrollbar text-white animate-in fade-in duration-200 select-none flex flex-col justify-between">
      {/* 1. SCROLLABLE TOP HEADER (Scrolls naturally with content, no divider border) */}
      <div className="w-full px-4 pt-5 pb-3 max-w-xl mx-auto flex items-center gap-2">
        <button
          onClick={handleClose}
          className="p-2 -ml-2 rounded-full text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Back to Search"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="tab-title-text drop-shadow-md">Filters</h1>
      </div>

      {/* 2. FILTER SECTIONS CONTAINER */}
      <div className="px-4 py-4 max-w-xl mx-auto w-full space-y-6 flex-1 pb-10">
        {/* GENRES */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Genres</h3>
          <div className="flex flex-wrap gap-2">
            {genresList.map((genre) => {
              const isSelected = localFilters.genres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={getPillClass(isSelected)}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* FORMAT */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Format</h3>
          <div className="flex flex-wrap gap-2">
            {formatList.map((fmt) => {
              const isSelected = localFilters.format.includes(fmt);
              return (
                <button
                  key={fmt}
                  onClick={() => toggleFormat(fmt)}
                  className={getPillClass(isSelected)}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </div>

        {/* STATUS */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Status</h3>
          <div className="flex flex-wrap gap-2">
            {statusList.map((st) => {
              const isSelected = localFilters.status.includes(st);
              return (
                <button
                  key={st}
                  onClick={() => toggleStatus(st)}
                  className={getPillClass(isSelected)}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* LIBRARY */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Library</h3>
          <div className="flex flex-wrap gap-2">
            {libraryOptions.map((lib) => {
              const isSelected = localFilters.libraryState === lib;
              return (
                <button
                  key={lib}
                  onClick={() => handleLibraryChange(lib)}
                  className={getPillClass(isSelected)}
                >
                  {lib}
                </button>
              );
            })}
          </div>
        </div>

        {/* MINIMUM SCORE */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Minimum score</h3>
          <div className="flex flex-wrap gap-2">
            {minScoreOptions.map((score) => {
              const isSelected = localFilters.minScore === score;
              return (
                <button
                  key={score}
                  onClick={() => handleMinScoreChange(score)}
                  className={getPillClass(isSelected)}
                >
                  {score}
                </button>
              );
            })}
          </div>
        </div>

        {/* SCORE RANGE */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-1">Score range</h3>
          <p className="text-[15px] text-white font-medium mb-2.5">
            {localFilters.scoreRange[0]} - {localFilters.scoreRange[1]}
          </p>
          <MangaDottedSlider
            min={0}
            max={100}
            step={5}
            value={localFilters.scoreRange}
            onChange={(val) =>
              setLocalFilters((prev) => ({
                ...prev,
                scoreRange: val,
              }))
            }
            dotCount={21}
          />
        </div>

        {/* YEAR */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Year</h3>
          <div className="flex flex-wrap gap-2">
            {yearChips.map((year) => {
              const isSelected = localFilters.selectedYear === year;
              return (
                <button
                  key={year}
                  onClick={() => handleYearChip(year)}
                  className={getPillClass(isSelected)}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>

        {/* YEAR RANGE */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-1">Year range</h3>
          <p className="text-[15px] text-white font-medium mb-2.5">
            {localFilters.yearRange[0]} - {localFilters.yearRange[1]}
          </p>
          <MangaDottedSlider
            min={1940}
            max={2028}
            step={1}
            value={localFilters.yearRange}
            onChange={(val) =>
              setLocalFilters((prev) => ({
                ...prev,
                yearRange: val,
              }))
            }
            dotCount={65}
          />
        </div>

        {/* SEASON */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Season</h3>
          <div className="flex flex-wrap gap-2">
            {seasonOptions.map((season) => {
              const isSelected =
                season === 'Any'
                  ? localFilters.season.length === 0
                  : localFilters.season.includes(season);

              return (
                <button
                  key={season}
                  onClick={() => toggleSeason(season)}
                  className={getPillClass(isSelected)}
                >
                  {season}
                </button>
              );
            })}
          </div>
        </div>

        {/* AUTHOR */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Author</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Author name"
              value={localFilters.studio || ''}
              onChange={(e) =>
                setLocalFilters((prev) => ({ ...prev, studio: e.target.value }))
              }
              className="w-full h-12 bg-black border border-neutral-600 rounded-lg px-4 pr-10 py-3 text-[15px] text-white placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors"
            />
            {localFilters.studio && (
              <button
                type="button"
                onClick={() => setLocalFilters((prev) => ({ ...prev, studio: '' }))}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* TAG CATEGORIES */}
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-2.5">Tag categories</h3>
          <div className="flex flex-wrap gap-2">
            {tagCategoryOptions.map((cat) => {
              const isSelected = localFilters.tagCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() =>
                    setLocalFilters((prev) => ({ ...prev, tagCategory: cat }))
                  }
                  className={getPillClass(isSelected)}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* ADVANCED TAGS */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setAdvancedTagsOpen(!advancedTagsOpen)}
            className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl bg-[#141520] border border-white/5 text-[15px] font-semibold text-white cursor-pointer hover:bg-[#1a1c2a] transition-colors"
          >
            <span>Advanced Tags</span>
            {advancedTagsOpen ? (
              <ChevronUp className="w-5 h-5 text-[#a855f7]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#a855f7]" />
            )}
          </button>

          {advancedTagsOpen && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-150">
              {/* Search Tags Input - strictly inside Advanced Tags dropdown */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search tags"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  className="w-full h-12 bg-black border border-neutral-600 rounded-lg pl-11 pr-10 py-3 text-[15px] text-white placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors"
                />
                {tagSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTagSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Tag Groups */}
              {Object.entries(advancedTagGroups).map(([groupName, tags]) => {
                const filteredTags = tagSearchQuery
                  ? tags.filter((t) =>
                      t.toLowerCase().includes(tagSearchQuery.toLowerCase())
                    )
                  : tags;

                if (filteredTags.length === 0) return null;

                return (
                  <div key={groupName} className="space-y-2">
                    <h4 className="text-[15px] font-semibold text-white mb-2">{groupName}</h4>
                    <div className="flex flex-wrap gap-2">
                      {filteredTags.map((tag) => {
                        const isSelected = localFilters.advancedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleAdvancedTag(tag)}
                            className={getPillClass(isSelected)}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM STICKY ACTION BAR */}
      <div className="sticky bottom-0 z-50 px-4 py-4 bg-black/95 backdrop-blur-xl">
        <div className="max-w-xl mx-auto w-full flex items-center justify-between gap-3 sm:gap-4 px-1">
          <button
            onClick={handleReset}
            className="ml-6 sm:ml-10 w-[40%] sm:w-[35%] max-w-[180px] py-4 sm:py-[18px] text-purple-400 hover:text-purple-300 text-sm sm:text-base font-bold transition-colors cursor-pointer select-none active:scale-[0.98] text-center bg-transparent border-0"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="w-[52%] sm:w-[46%] max-w-[220px] bg-[#a855f7] hover:bg-[#9333ea] text-white text-sm sm:text-base font-bold py-4 sm:py-[18px] rounded-full transition-all border border-purple-400/20 text-center cursor-pointer active:scale-[0.98] shadow-sm shadow-purple-900/30"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

