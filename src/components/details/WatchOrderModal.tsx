import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, Sparkles, Film, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WatchOrderItem, MediaItem } from '../../types';
import { fetchAnimeWatchOrder } from '../../services/apiClient';
import { DotPulseLoader } from '../common/DotPulseLoader';

const decodeHtml = (str?: string) => {
  if (!str) return '';
  return str
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
};

export const WatchOrderModal: React.FC = () => {
  const { selectedMedia, showWatchOrder, setShowWatchOrder, openMediaDetails } = useApp();

  const [watchOrderList, setWatchOrderList] = useState<WatchOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [source, setSource] = useState<'chiaki' | 'relations' | 'standalone'>('chiaki');

  useEffect(() => {
    if (!showWatchOrder || !selectedMedia) return;

    let isMounted = true;
    setIsLoading(true);

    async function loadWatchOrder() {
      try {
        // 1. Fetch live watch order from our backend (powered by Chiaki franchise engine)
        const orderData = await fetchAnimeWatchOrder({
          malId: selectedMedia?.idMal,
          title: selectedMedia?.title,
          anilistId: selectedMedia?.id,
        });

        if (!isMounted) return;

        if (orderData && orderData.length > 0) {
          setWatchOrderList(orderData);
          setSource('chiaki');
          setIsLoading(false);
          return;
        }

        // 2. Fallback: Build chronological order from selectedMedia relations
        if (selectedMedia?.relations && selectedMedia.relations.length > 0) {
          const animeRelations = selectedMedia.relations.filter((rel) => {
            const fmt = (rel.format || '').toUpperCase();
            return !fmt.includes('MANGA') && !fmt.includes('NOVEL');
          });

          if (animeRelations.length > 0) {
            const prequels = animeRelations.filter((r) =>
              r.relationType?.toLowerCase().includes('prequel')
            );
            const sequels = animeRelations.filter((r) =>
              r.relationType?.toLowerCase().includes('sequel')
            );
            const others = animeRelations.filter(
              (r) =>
                !r.relationType?.toLowerCase().includes('prequel') &&
                !r.relationType?.toLowerCase().includes('sequel')
            );

            const fallbackItems: WatchOrderItem[] = [];
            let orderCounter = 1;

            // Prequels first
            prequels.forEach((rel) => {
              fallbackItems.push({
                id: rel.id,
                orderNumber: orderCounter++,
                title: rel.title,
                franchiseTitle: rel.relationType,
                coverImage: rel.coverImage || rel.image || selectedMedia.coverImage,
                score: rel.score,
                anilistId: rel.id,
                type: rel.format || 'Anime',
              });
            });

            // Current show
            fallbackItems.push({
              id: selectedMedia.id,
              orderNumber: orderCounter++,
              title: selectedMedia.title,
              franchiseTitle: 'Main Story',
              coverImage: selectedMedia.coverImage,
              score: selectedMedia.score,
              anilistId: selectedMedia.id,
              type: selectedMedia.format || 'Anime',
            });

            // Sequels
            sequels.forEach((rel) => {
              fallbackItems.push({
                id: rel.id,
                orderNumber: orderCounter++,
                title: rel.title,
                franchiseTitle: rel.relationType,
                coverImage: rel.coverImage || rel.image || selectedMedia.coverImage,
                score: rel.score,
                anilistId: rel.id,
                type: rel.format || 'Anime',
              });
            });

            // Side stories, movies, spin-offs
            others.forEach((rel) => {
              fallbackItems.push({
                id: rel.id,
                orderNumber: orderCounter++,
                title: rel.title,
                franchiseTitle: rel.relationType || 'Side Story',
                coverImage: rel.coverImage || rel.image || selectedMedia.coverImage,
                score: rel.score,
                anilistId: rel.id,
                type: rel.format || 'Anime',
              });
            });

            setWatchOrderList(fallbackItems);
            setSource('relations');
            setIsLoading(false);
            return;
          }
        }

        // 3. Standalone show with no franchise sequels/prequels
        setWatchOrderList([
          {
            id: selectedMedia!.id,
            orderNumber: 1,
            title: selectedMedia!.title,
            franchiseTitle: 'Complete Standalone Story',
            score: selectedMedia!.score,
            coverImage: selectedMedia!.coverImage,
            anilistId: selectedMedia!.id,
            type: selectedMedia!.format || 'TV',
          },
        ]);
        setSource('standalone');
      } catch (err) {
        console.warn('Failed to load watch order:', err);
        setWatchOrderList([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadWatchOrder();

    return () => {
      isMounted = false;
    };
  }, [showWatchOrder, selectedMedia]);

  if (!showWatchOrder || !selectedMedia) return null;

  const handleSelectMedia = (item: WatchOrderItem) => {
    const targetId = item.anilistId || item.id;
    if (targetId && String(targetId) !== String(selectedMedia.id)) {
      openMediaDetails({
        id: targetId,
        title: item.title,
        romajiTitle: item.title,
        coverImage: item.coverImage || selectedMedia.coverImage,
        category: 'Anime',
        format: item.type || 'TV',
        status: 'Finished',
        score: item.score ? Number(item.score) : 0,
        year: item.year || 2020,
        genres: [],
        description: '',
        idMal: item.malId,
      } as unknown as MediaItem);
      setShowWatchOrder(false);
    }
  };

  return (
    <div
      id="watch-order-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowWatchOrder(false);
      }}
      className="fixed inset-0 z-[2000] bg-transparent flex flex-col justify-end"
    >
      {/* 95% Height bottom sheet panel leaving top 5% exposed with flat top edge matching screenshot */}
      <div
        id="watch-order-bottom-sheet"
        className="w-full h-[95dvh] max-h-[95dvh] bg-[#000000] text-white flex flex-col overflow-hidden rounded-none shadow-[0_-12px_40px_rgba(0,0,0,0.9)] animate-in slide-in-from-bottom duration-300"
      >
        {/* Top Header with ultra-thin horizontal divider line matching exact screenshot */}
        <div className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#000000] border-b border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <button
              id="watch-order-back-btn"
              onClick={() => setShowWatchOrder(false)}
              aria-label="Back"
              className="w-10 h-10 rounded-full bg-[#1c1c24] hover:bg-[#282834] text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Watch Order
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-3.5 sm:px-6 py-5 flex flex-col">
          <div className={`max-w-xl mx-auto w-full ${isLoading ? 'flex-1 flex flex-col items-center justify-center' : ''}`}>
            {/* Loading State: Custom Purple Dot Loading Animation */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 sm:py-32 text-center w-full">
                <DotPulseLoader size="lg" label="Loading watch order..." />
              </div>
            ) : watchOrderList.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/40 mb-3 border border-white/10">
                  <Film className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">কোনো ওয়াচ অর্ডার পাওয়া যায়নি</h3>
                <p className="text-xs sm:text-sm text-white/50 max-w-sm">
                  এই এনিমেটির জন্য কোনো সিক্যুয়েল বা বিশেষ ওয়াচ অর্ডার তালিকা এখনও নেই।
                </p>
              </div>
            ) : (
              /* Timeline List matching exact screenshot */
              <div className="relative space-y-4 pb-20 sm:pb-12">
                {source === 'standalone' && (
                  <div className="mb-4 p-3 rounded-xl bg-purple-900/20 border border-purple-500/30 text-xs text-purple-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-purple-400" />
                    <span>
                      এই সিরিজটি একটি স্বতন্ত্র গল্প (Standalone) — এর কোনো দীর্ঘ ফ্র্যাঞ্চাইজি ওয়াচ অর্ডারের প্রয়োজন নেই।
                    </span>
                  </div>
                )}

                {watchOrderList.map((item, index) => {
                  const isLast = index === watchOrderList.length - 1;
                  const displayTitle = decodeHtml(item.title);
                  const displayEnglish = decodeHtml(item.englishTitle);
                  const showEnglish = Boolean(
                    displayEnglish &&
                    displayEnglish.trim().toLowerCase() !== displayTitle.trim().toLowerCase()
                  );

                  let ratingDisplay = '';
                  if (item.ratingText) {
                    ratingDisplay = decodeHtml(item.ratingText);
                  } else if (item.score) {
                    ratingDisplay = `★${item.score}${item.memberCount ? ` (${item.memberCount})` : ''}`;
                  }

                  return (
                    <div
                      key={item.id || item.malId || index}
                      className="flex gap-3 sm:gap-4 items-start relative"
                    >
                      {/* Left Timeline: Number badge + Connecting line with symmetric gaps */}
                      <div className="relative flex flex-col items-center shrink-0 w-8 self-stretch">
                        {/* Connecting vertical line with a distinct gap from the circles above and below */}
                        {!isLast && (
                          <div className="absolute top-[43px] -bottom-[7px] left-1/2 -translate-x-1/2 w-[2px] bg-[#2a2a38] rounded-full z-0" />
                        )}

                        {/* Numbered purple circular badge matching exact screenshot */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[13px] text-black shrink-0 relative z-10 select-none shadow-md bg-[#a855f7]">
                          {item.orderNumber || index + 1}
                        </div>
                      </div>

                      {/* Right Card matching exact screenshot */}
                      <div
                        id={`watch-order-item-${item.orderNumber || index + 1}`}
                        onClick={() => handleSelectMedia(item)}
                        className="flex-1 min-w-0 bg-[#0f0f15] hover:bg-[#15151e] border border-white/[0.04] rounded-[22px] sm:rounded-[24px] p-3 sm:p-3.5 flex gap-3.5 sm:gap-4 items-center transition-all duration-200 cursor-pointer shadow-lg active:scale-[0.99]"
                      >
                        {/* Poster Thumbnail */}
                        <div className="w-[82px] sm:w-[92px] h-[116px] sm:h-[128px] rounded-[16px] sm:rounded-[18px] overflow-hidden shrink-0 bg-[#1a1a24] relative shadow-md">
                          {((item.coverImage || selectedMedia.coverImage)?.trim()) ? (
                            <img
                              src={(item.coverImage || selectedMedia.coverImage)!}
                              alt={displayTitle}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                // Fallback to selected media cover if custom chiaki cover fails
                                if (selectedMedia.coverImage) {
                                  (e.currentTarget as HTMLImageElement).src = selectedMedia.coverImage;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-[#1a1a24]" />
                          )}
                        </div>

                        {/* Text Information matching exact screenshot format */}
                        <div className="flex-1 min-w-0 py-0.5 space-y-1">
                          {/* Primary Title */}
                          <h2 className="text-[14.5px] sm:text-[15.5px] font-bold text-white line-clamp-2 leading-snug">
                            {displayTitle}
                          </h2>

                          {/* Secondary English Subtitle (if distinct) */}
                          {showEnglish && (
                            <p className="text-[12px] sm:text-[12.5px] text-[#8e8e9c] font-normal line-clamp-2 leading-snug">
                              {displayEnglish}
                            </p>
                          )}

                          {/* Rating matching screenshot format: ★6.69 (24,568) */}
                          {ratingDisplay && (
                            <div className="text-[12px] sm:text-[12.5px] font-medium text-[#b5b5c2] pt-0.5">
                              {ratingDisplay}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
