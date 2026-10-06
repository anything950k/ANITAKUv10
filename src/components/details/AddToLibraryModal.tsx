import React from 'react';
import { MinusCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getAvailableStatusesForCategory, STATUS_CONFIG } from '../../utils/libraryStatus';

export const AddToLibraryModal: React.FC = () => {
  const {
    selectedMedia,
    showAddToLibrary,
    setShowAddToLibrary,
    addToLibrary,
    removeFromLibrary,
    getLibraryEntry,
  } = useApp();

  if (!showAddToLibrary || !selectedMedia) return null;

  // Actual current user library entry from persistent state
  const currentEntry = getLibraryEntry(selectedMedia.id);
  const currentStatus = currentEntry?.status;

  // Dynamic available statuses strictly based on media category (Anime: Watching, Manga/Novel: Reading)
  const availableStatuses = getAvailableStatusesForCategory(selectedMedia.category);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/15 animate-in fade-in duration-150">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={() => setShowAddToLibrary(false)} />

      {/* Centered Modal Card matching Reference Screenshots */}
      <div className="relative w-full max-w-[329px] sm:max-w-[349px] bg-[#0e0e10] border-0 outline-none rounded-[26px] py-5 px-[22px] space-y-2.5 z-10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-150">
        {/* Title */}
        <h3 className="text-xl font-bold text-white tracking-tight pb-1">Add to Library</h3>

        {/* Status Option List */}
        <div className="space-y-2 pt-1">
          {availableStatuses.map((statusKey) => {
            const config = STATUS_CONFIG[statusKey];
            const isCurrent = currentStatus === statusKey;

            return (
              <button
                key={statusKey}
                onClick={() => addToLibrary(selectedMedia, statusKey)}
                className={`w-full flex items-center justify-between px-4 py-3.5 min-h-[50px] rounded-2xl border transition-all cursor-pointer text-left active:scale-[0.98] ${config.pillClass}`}
              >
                <div className="flex items-center gap-3">
                  {config.icon('w-[18px] h-[18px] sm:w-5 sm:h-5')}
                  <span className="text-sm font-bold">{config.label}</span>
                </div>

                {isCurrent && (
                  <span className="text-xs font-semibold text-white/90">
                    Current
                  </span>
                )}
              </button>
            );
          })}

          {/* Remove from Library option (Rendered strictly when an existing status is present) */}
          {currentEntry && (
            <button
              onClick={() => removeFromLibrary(selectedMedia.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[50px] rounded-2xl border border-white/20 bg-[#15151c] text-white hover:bg-white/10 transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <MinusCircle className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-white/80 shrink-0" />
              <span className="text-sm font-bold text-white">Remove from Library</span>
            </button>
          )}
        </div>

        {/* Cancel Button */}
        <div className="pt-2 text-center">
          <button
            onClick={() => setShowAddToLibrary(false)}
            className="text-sm font-bold text-white/80 hover:text-white transition-colors cursor-pointer py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

