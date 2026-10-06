import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { MediaItem, EpisodeItem, MangaChapterItem, NovelChapterItem } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  addDownloadItem,
  addBatchDownloadItems,
  getEstimatedFileSize,
  subscribeToDownloads,
  getAllDownloads,
} from '../../services/downloadService';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem;
  episodes: EpisodeItem[];
  mangaChapters: MangaChapterItem[];
  novelChapters: NovelChapterItem[];
}

interface DisplayItem {
  id: string;
  itemNumber: number;
  formattedNumber: string;
  title: string;
  fileSize: string;
  fileSizeBytes: number;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  media,
  episodes,
  mangaChapters,
  novelChapters,
}) => {
  const { showToast } = useApp();
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number>(0);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  // Synchronize downloaded state from downloadService
  useEffect(() => {
    if (!isOpen) return;

    const refreshDownloadedState = () => {
      const all = getAllDownloads();
      const completedMap: Record<string, boolean> = {};
      const downloadingMap: Record<string, boolean> = {};

      all.forEach((item) => {
        if (String(item.mediaId) === String(media.id)) {
          if (item.status === 'completed') {
            completedMap[item.id] = true;
          } else if (item.status === 'downloading' || item.status === 'queued') {
            downloadingMap[item.id] = true;
          }
        }
      });

      setCompletedIds(completedMap);
      setDownloadingIds(downloadingMap);
    };

    refreshDownloadedState();
    const unsubscribe = subscribeToDownloads(refreshDownloadedState);
    return () => unsubscribe();
  }, [isOpen, media.id]);

  // Determine media category and label
  const category = (media.category || 'anime').toLowerCase() as 'anime' | 'manga' | 'novel';
  const itemTypeLabel =
    category === 'anime' ? 'Episodes' : category === 'novel' ? 'Volumes' : 'Chapters';

  // Build sorted full item list based on media category
  const allItems: DisplayItem[] = useMemo(() => {
    if (category === 'anime') {
      const sorted = [...episodes].sort((a, b) => (a.number || 0) - (b.number || 0));
      // If episodes array is empty but we know totalEpisodes or latestEpisode, generate fallback numbers
      const count =
        sorted.length > 0
          ? sorted.length
          : media.totalEpisodes || media.latestEpisode || 24;

      if (sorted.length === 0) {
        return Array.from({ length: count }, (_, i) => {
          const num = i + 1;
          const { text, bytes } = getEstimatedFileSize('anime', num);
          return {
            id: `${media.id}_anime_${num}`,
            itemNumber: num,
            formattedNumber: String(num).padStart(2, '0'),
            title: `Episode ${String(num).padStart(2, '0')}`,
            fileSize: text,
            fileSizeBytes: bytes,
          };
        });
      }

      return sorted.map((ep, idx) => {
        const num = ep.number || idx + 1;
        const formattedNum = String(num).padStart(2, '0');
        const displayTitle = `Episode ${num}`;
        const { text, bytes } = getEstimatedFileSize('anime', num);

        return {
          id: `${media.id}_anime_${num}`,
          itemNumber: num,
          formattedNumber: formattedNum,
          title: displayTitle,
          fileSize: text,
          fileSizeBytes: bytes,
        };
      });
    } else if (category === 'manga') {
      const sorted = [...mangaChapters].sort(
        (a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)
      );
      const count =
        sorted.length > 0
          ? sorted.length
          : media.totalEpisodes || 50;

      if (sorted.length === 0) {
        return Array.from({ length: count }, (_, i) => {
          const num = i + 1;
          const { text, bytes } = getEstimatedFileSize('manga', num);
          return {
            id: `${media.id}_manga_${num}`,
            itemNumber: num,
            formattedNumber: String(num).padStart(2, '0'),
            title: `Chapter ${num}`,
            fileSize: text,
            fileSizeBytes: bytes,
          };
        });
      }

      return sorted.map((ch, idx) => {
        const num = ch.chapterNumber || idx + 1;
        const formattedNum = String(num).padStart(2, '0');
        const displayTitle = `Chapter ${num}`;
        const { text, bytes } = getEstimatedFileSize('manga', num);

        return {
          id: `${media.id}_manga_${num}`,
          itemNumber: num,
          formattedNumber: formattedNum,
          title: displayTitle,
          fileSize: text,
          fileSizeBytes: bytes,
        };
      });
    } else {
      // Novel
      const sorted = [...novelChapters].sort(
        (a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)
      );
      const count = sorted.length > 0 ? sorted.length : 12;

      if (sorted.length === 0) {
        return Array.from({ length: count }, (_, i) => {
          const num = i + 1;
          const { text, bytes } = getEstimatedFileSize('novel', num);
          return {
            id: `${media.id}_novel_${num}`,
            itemNumber: num,
            formattedNumber: String(num).padStart(2, '0'),
            title: `Volume ${num}`,
            fileSize: text,
            fileSizeBytes: bytes,
          };
        });
      }

      return sorted.map((ch, idx) => {
        const num = typeof ch.chapterNumber === 'number' ? ch.chapterNumber : idx + 1;
        const formattedNum = String(num).padStart(2, '0');
        const displayTitle = `Volume ${num}`;
        const { text, bytes } = getEstimatedFileSize('novel', num);

        return {
          id: `${media.id}_novel_${num}`,
          itemNumber: num,
          formattedNumber: formattedNum,
          title: displayTitle,
          fileSize: text,
          fileSizeBytes: bytes,
        };
      });
    }
  }, [category, episodes, mangaChapters, novelChapters, media]);

  // Batch Range generation (chunks of 50 items)
  const rangeSize = 50;
  const { ranges, currentBatchItems } = useMemo(() => {
    const total = allItems.length;
    if (total === 0) {
      return { ranges: [], currentBatchItems: [] };
    }

    const numRanges = Math.max(1, Math.ceil(total / rangeSize));
    const rangeList: string[] = [];

    for (let i = 0; i < numRanges; i++) {
      const start = i * rangeSize + 1;
      const end = Math.min((i + 1) * rangeSize, total);
      rangeList.push(`${start}-${end}`);
    }

    const safeIndex = Math.min(selectedRangeIndex, rangeList.length - 1);
    const startIdx = safeIndex * rangeSize;
    const endIdx = Math.min(startIdx + rangeSize, total);
    const currentItems = allItems.slice(startIdx, endIdx);

    return {
      ranges: rangeList,
      currentBatchItems: currentItems,
    };
  }, [allItems, selectedRangeIndex]);

  if (!isOpen) return null;

  // Single Item Download Handler
  const handleDownloadSingle = (item: DisplayItem) => {
    if (completedIds[item.id]) {
      showToast(`${item.title} is already downloaded`);
      return;
    }

    if (downloadingIds[item.id]) {
      showToast(`Downloading ${item.title}...`);
      return;
    }

    // Mark as downloading immediately
    setDownloadingIds((prev) => ({ ...prev, [item.id]: true }));
    showToast(`Downloading ${item.title} (${item.fileSize})...`);

    // Add to persistent queue
    addDownloadItem({
      id: item.id,
      mediaId: media.id,
      mediaTitle: media.title,
      mediaCategory: category,
      coverImage: media.coverImage,
      bannerImage: media.bannerImage || media.coverImage,
      itemNumber: item.itemNumber,
      formattedNumber: item.formattedNumber,
      title: item.title,
      fileSize: item.fileSize,
      fileSizeBytes: item.fileSizeBytes,
      status: 'downloading',
      progress: 30,
    });

    // Simulate completion with realistic fast progress
    setTimeout(() => {
      addDownloadItem({
        id: item.id,
        mediaId: media.id,
        mediaTitle: media.title,
        mediaCategory: category,
        coverImage: media.coverImage,
        bannerImage: media.bannerImage || media.coverImage,
        itemNumber: item.itemNumber,
        formattedNumber: item.formattedNumber,
        title: item.title,
        fileSize: item.fileSize,
        fileSizeBytes: item.fileSizeBytes,
        status: 'completed',
        progress: 100,
      });

      setDownloadingIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setCompletedIds((prev) => ({ ...prev, [item.id]: true }));
      showToast(`Downloaded ${item.title} successfully!`);
    }, 1200);
  };

  // Download All (Batch Download Handler)
  const handleDownloadAll = () => {
    // Download all items in current batch or all items if none downloaded
    const targetItems = currentBatchItems.length > 0 ? currentBatchItems : allItems;
    const uncompleted = targetItems.filter((item) => !completedIds[item.id]);

    if (uncompleted.length === 0) {
      showToast(`All items in this range are already downloaded!`);
      return;
    }

    showToast(`Queueing ${uncompleted.length} items for download...`);

    // Mark items as downloading
    const newDownloadingMap: Record<string, boolean> = { ...downloadingIds };
    uncompleted.forEach((item) => {
      newDownloadingMap[item.id] = true;
    });
    setDownloadingIds(newDownloadingMap);

    // Save batch to persistent storage
    const itemsToAdd = uncompleted.map((item) => ({
      id: item.id,
      mediaId: media.id,
      mediaTitle: media.title,
      mediaCategory: category,
      coverImage: media.coverImage,
      bannerImage: media.bannerImage || media.coverImage,
      itemNumber: item.itemNumber,
      formattedNumber: item.formattedNumber,
      title: item.title,
      fileSize: item.fileSize,
      fileSizeBytes: item.fileSizeBytes,
      status: 'completed' as const,
      progress: 100,
    }));

    setTimeout(() => {
      addBatchDownloadItems(itemsToAdd);

      const newCompleted: Record<string, boolean> = { ...completedIds };
      uncompleted.forEach((item) => {
        newCompleted[item.id] = true;
      });
      setCompletedIds(newCompleted);
      setDownloadingIds((prev) => {
        const next = { ...prev };
        uncompleted.forEach((item) => {
          delete next[item.id];
        });
        return next;
      });

      showToast(`Downloaded ${uncompleted.length} items to Downloads!`);
    }, 1500);
  };

  // Header Cover Banner Artwork
  const headerCoverImage = media.bannerImage || media.coverImage;

  return (
    <div
      id="download-modal-backdrop"
      className="fixed inset-0 z-[3000] flex items-center justify-center px-[14px] py-4 sm:px-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Centered Modal Card matching Search Option Card Size & Aesthetic */}
      <div
        id="download-modal-card"
        className="relative w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[26px] p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-10 flex flex-col max-h-[65vh] sm:max-h-[70vh] overflow-hidden transition-all duration-200 animate-in zoom-in-95 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle Bar Pill */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2.5 shrink-0" />

        {/* 1. Header Bar: Title + Close Icon */}
        <div className="flex items-center justify-between mb-2.5 px-0.5 shrink-0">
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Download
          </h3>
          <button
            id="download-modal-close-button"
            type="button"
            onClick={onClose}
            className="p-1 -mr-1 text-white/60 hover:text-white transition-colors cursor-pointer rounded-full active:scale-95"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* 2. Media Preview Banner Thumbnail + Title */}
        <div className="relative w-full h-[96px] sm:h-[110px] rounded-2xl overflow-hidden border border-white/10 shadow-md bg-[#121218] shrink-0 mb-3">
          <img
            src={headerCoverImage}
            alt={media.title}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              if (media.coverImage && e.currentTarget.src !== media.coverImage) {
                e.currentTarget.src = media.coverImage;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex items-end p-2.5">
            <span className="text-xs sm:text-[13px] font-bold text-white truncate drop-shadow">
              {media.title}
            </span>
          </div>
        </div>

        {/* 3. Controls: Chapters/Episodes Count & Batch Download Button */}
        <div className="flex items-center justify-between px-0.5 pb-2 shrink-0">
          <h4 className="text-xs sm:text-sm font-bold text-white/90 tracking-tight">
            {itemTypeLabel} ({allItems.length})
          </h4>

          {/* Download All Button */}
          <button
            id="download-modal-download-all-button"
            type="button"
            onClick={handleDownloadAll}
            className="px-3 py-1.5 rounded-full bg-gradient-to-b from-[#352345] via-[#251b30] to-[#1a1522] hover:from-[#3e2b52] hover:via-[#2b1f37] hover:to-[#201a2a] border border-[#52386d]/60 text-white flex items-center gap-1.5 text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
          >
            {/* Solid download arrow matching exact Details page */}
            <svg
              className="w-3.5 h-3.5 text-white shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M10 3.2c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v7.6h3.6c.62 0 .97.71.58 1.18l-5.6 6.3c-.32.36-.84.36-1.16 0l-5.6-6.3c-.39-.47-.04-1.18.58-1.18H10V3.2z" />
              <rect x="4.5" y="20" width="15" height="2.4" rx="1.2" />
            </svg>
            <span>Download All</span>
          </button>
        </div>

        {/* 4. Batch Range Filter Pills (1-50, 51-100, 101-150...) */}
        {ranges.length > 1 && allItems.length > 0 && (
          <div className="pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {ranges.map((rangeStr, idx) => {
              const isActive = selectedRangeIndex === idx;
              return (
                <button
                  key={rangeStr}
                  id={`download-range-pill-${rangeStr}`}
                  type="button"
                  onClick={() => setSelectedRangeIndex(idx)}
                  className={`px-3 py-1 rounded-full text-xs leading-none font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#27163c] border border-[#a855f7] text-white'
                      : 'bg-[#13131b] border border-white/10 text-white/90 hover:border-white/30 hover:bg-[#1a1a26]'
                  }`}
                >
                  {rangeStr}
                </button>
              );
            })}
          </div>
        )}

        {/* 5. Scrollable Container: Individual Episode / Chapter / Volume Rows */}
        <div className="flex-1 overflow-y-auto no-scrollbar pr-0.5 space-y-1">
          {currentBatchItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-white/50">
              No {itemTypeLabel.toLowerCase()} available for download.
            </div>
          ) : (
            currentBatchItems.map((item) => {
              const isDownloaded = Boolean(completedIds[item.id]);
              const isDownloading = Boolean(downloadingIds[item.id]);

              return (
                <div
                  key={item.id}
                  id={`download-item-row-${item.id}`}
                  className="flex items-center justify-between py-2 px-2 hover:bg-white/[0.04] transition-colors rounded-xl group"
                >
                  {/* Left: Sequence Number + Title & File Size */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {/* Index Sequence Number (e.g. 01, 02) */}
                    <span className="text-sm font-extrabold text-white w-8 shrink-0 text-left font-mono">
                      {item.formattedNumber}
                    </span>

                    {/* Title & File Size Metadata */}
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-xs sm:text-[13px] font-bold text-white tracking-wide truncate max-w-[190px] sm:max-w-[240px]"
                        title={item.title}
                      >
                        {item.title}
                      </span>
                      <span className="text-[11px] text-white/50 font-medium mt-0.5 tracking-normal">
                        {item.fileSize}
                      </span>
                    </div>
                  </div>

                  {/* Right Action Button (Download Icon -> White Checkmark) */}
                  <button
                    id={`download-btn-${item.id}`}
                    type="button"
                    onClick={() => handleDownloadSingle(item)}
                    disabled={isDownloading}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90 ${
                      isDownloaded || isDownloading
                        ? 'bg-[#14141e] border-white/25 text-white shadow-sm'
                        : 'bg-[#14141e] border-white/15 text-white hover:text-white hover:bg-[#20202e] hover:border-white/30'
                    }`}
                    title={
                      isDownloaded
                        ? 'Downloaded'
                        : isDownloading
                        ? 'Downloading...'
                        : 'Download'
                    }
                    aria-label={`Download ${item.title}`}
                  >
                    {isDownloading || isDownloaded ? (
                      /* White checkmark */
                      <Check className="w-3.5 h-3.5 stroke-[2.8] text-white shrink-0" />
                    ) : (
                      /* Solid download arrow */
                      <svg
                        className="w-3.5 h-3.5 text-white shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M10 3.2c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v7.6h3.6c.62 0 .97.71.58 1.18l-5.6 6.3c-.32.36-.84.36-1.16 0l-5.6-6.3c-.39-.47-.04-1.18.58-1.18H10V3.2z" />
                        <rect x="4.5" y="20" width="15" height="2.4" rx="1.2" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
