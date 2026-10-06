import React from 'react';

export const RatingPill: React.FC<{
  score?: number | string | null;
  status?: string;
  className?: string;
}> = ({ score, status, className = '' }) => {
  // Format rating (e.g. 8.4, 8.2, 8.1, 8.8 or fallback to 'N/A')
  const formatRating = () => {
    if (status === 'Upcoming' || status === 'NOT_YET_RELEASED') return 'N/A';
    if (score === null || score === undefined || score === '' || score === 0 || score === '0') return 'N/A';

    const num = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(num) || num <= 0) return 'N/A';

    if (num > 10) {
      return (num / 10).toFixed(1);
    }
    return num.toFixed(1);
  };

  const ratingStr = formatRating();
  if (ratingStr === 'N/A') return null;

  return (
    <div className={`absolute bottom-2.5 left-2.5 z-10 select-none pointer-events-none ${className}`}>
      <div className="h-[27px] min-w-[42px] px-3 rounded-full bg-[#1e4ca6]/85 backdrop-blur-none border-2 border-white/70 text-white text-[12.5px] font-black shadow-md flex items-center justify-center leading-none tracking-tight">
        {ratingStr}
      </div>
    </div>
  );
};
