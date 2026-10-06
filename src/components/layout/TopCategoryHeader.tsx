import React from 'react';
import { useApp } from '../../context/AppContext';
import { MediaCategory } from '../../types';

export const TopCategoryHeader: React.FC = () => {
  const { activeCategory, setActiveCategory } = useApp();

  const categories: { key: MediaCategory; label: string }[] = [
    { key: 'anime', label: 'Anime' },
    { key: 'manga', label: 'Manga' },
    { key: 'novel', label: 'Novel' },
  ];

  return (
    <div className="w-full grid grid-cols-3 gap-2.5 sm:gap-3.5 pointer-events-auto select-none">
      {categories.map((cat) => {
        const isActive = activeCategory === cat.key;
        return (
          <button
            key={cat.key}
            id={`top-cat-${cat.key}`}
            onClick={() => setActiveCategory(cat.key)}
            className={`w-full h-11 sm:h-12 flex items-center justify-center rounded-full text-sm sm:text-base font-bold transition-colors duration-150 cursor-pointer text-center select-none box-border border ${
              isActive
                ? 'bg-white text-black border-white shadow-[0_4px_16px_rgba(255,255,255,0.2)]'
                : 'bg-[#1c2127]/80 hover:bg-[#252b33] text-white/90 border-white/10 backdrop-blur-md'
            }`}
          >
            <span className="leading-none">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};

