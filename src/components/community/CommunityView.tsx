import React, { useState, useMemo, useEffect } from 'react';
import { Bell, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReleaseNotification } from '../../types';
import { formatTimeAgo } from '../../services/apiClient';

type CommunityMainTab = 'leaderboards' | 'notifications';
type NotificationSubTab = 'news' | 'releases' | 'system';

export const CommunityView: React.FC = () => {
  const {
    subscribedAnimeAlerts,
    releaseNotifications,
    dismissedNotificationIds,
    deleteReleaseNotification,
    openMediaDetails,
    markCommunityAsRead,
    userLibrary,
  } = useApp();

  useEffect(() => {
    markCommunityAsRead();
  }, [markCommunityAsRead]);

  const [mainTab, setMainTab] = useState<CommunityMainTab>('notifications');
  const [subTab, setSubTab] = useState<NotificationSubTab>('releases');

  // Displayed notifications: Airing anime releases + Strictly 'Reading' status Ongoing Manga chapter releases
  const displayedNotifications = useMemo<ReleaseNotification[]>(() => {
    const list: ReleaseNotification[] = [];

    // 1. Airing Anime releases (from releaseNotifications for currently subscribed anime)
    const animeNotifs = releaseNotifications.filter(
      (n) => n.media?.category === 'anime' && !String(n.id).includes('manga') && !dismissedNotificationIds.includes(n.id)
    );
    animeNotifs.forEach((n) => {
      const isSubbed = subscribedAnimeAlerts.some((a) => String(a.id) === String(n.mediaId));
      if (isSubbed && !list.some((existing) => existing.id === n.id)) {
        list.push(n);
      }
    });

    // 2. Reading Manga chapter releases (strictly ONLY status === 'Reading' AND NOT Finished)
    const mangaNotifs = releaseNotifications.filter(
      (n) => (n.media?.category === 'manga' || String(n.id).includes('manga')) && !dismissedNotificationIds.includes(n.id)
    );
    mangaNotifs.forEach((n) => {
      const libEntry = userLibrary.find((item) => String(item.mediaId) === String(n.mediaId));
      const isFinished =
        n.media?.status === 'Finished' ||
        String(n.media?.status || '').toLowerCase().includes('finish');
      if (libEntry && libEntry.status === 'Reading' && !isFinished) {
        if (!list.some((existing) => existing.id === n.id)) {
          list.push(n);
        }
      }
    });

    // Sort by timestamp descending so newest releases appear at top
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return list;
  }, [releaseNotifications, dismissedNotificationIds, subscribedAnimeAlerts, userLibrary]);

  const hasReleases = mainTab === 'notifications' && subTab === 'releases' && displayedNotifications.length > 0;

  return (
    <div className="relative w-full h-screen sm:h-[100dvh] flex flex-col bg-black text-white select-none overflow-hidden">
      {/* Background Top GIF Canvas (Positioned at top in original size, vertically shifted 185px upwards, zero blur, smoothly fading to black at bottom starting 10px lower) */}
      <div className="absolute top-0 left-0 right-0 h-[490px] sm:h-[550px] pointer-events-none z-0 overflow-hidden">
        <img
          src="https://www.image2url.com/r2/default/gifs/1789557803774-8ff4bb92-3d4a-4eca-bf25-62dbfba9096a.gif"
          alt="Community Background Canvas"
          className="w-full h-[calc(100%+185px)] object-cover object-top -translate-y-[185px]"
          referrerPolicy="no-referrer"
        />
        {/* Ultra-smooth multi-stop gradient transition to solid black at bottom edge, starting 10px lower */}
        <div className="absolute inset-x-0 bottom-0 h-36 [background:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.15)_30%,rgba(0,0,0,0.5)_60%,rgba(0,0,0,0.85)_85%,#000000_100%)] pointer-events-none" />
      </div>

      {/* Top Fixed Header */}
      <header className="relative z-10 flex-shrink-0 w-full max-w-xl mx-auto px-4 sm:px-6 pt-5">
        {/* Screen Title */}
        <div className="tab-header-row mb-3">
          <h1 className="tab-title-text drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
            Community
          </h1>
        </div>

        {/* 1. Leaderboards vs Notifications Segmented Switcher */}
        <div className="w-[calc(100%-150px)] max-w-[340px] mx-auto flex items-center p-1 rounded-[8px] bg-[#141419]/80 border-[2px] border-white/15 shadow-lg">
          <button
            onClick={() => setMainTab('leaderboards')}
            className={`flex-1 py-[11px] sm:py-[13px] px-2.5 rounded-[5px] text-[15px] sm:text-[17px] font-semibold transition-all cursor-pointer whitespace-nowrap border-0 outline-none ${
              mainTab === 'leaderboards'
                ? 'bg-[#2b1f4a] text-white font-bold shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Leaderboards
          </button>
          <button
            onClick={() => setMainTab('notifications')}
            className={`flex-1 py-[11px] sm:py-[13px] px-2.5 rounded-[5px] text-[15px] sm:text-[17px] font-semibold transition-all cursor-pointer whitespace-nowrap border-0 outline-none ${
              mainTab === 'notifications'
                ? 'bg-[#2b1f4a] text-white font-bold shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Notifications
          </button>
        </div>

        {/* 2. Sub-Tabs: News | Releases | System (when Notifications is selected) */}
        {mainTab === 'notifications' && (
          <div className="relative mt-3.5 border-b border-white/10">
            <div className="grid grid-cols-3 text-center">
              {(
                [
                  { key: 'news', label: 'News' },
                  { key: 'releases', label: 'Releases' },
                  { key: 'system', label: 'System' },
                ] as const
              ).map((tab) => {
                const isActive = subTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSubTab(tab.key)}
                    className="flex flex-col items-center justify-center py-2 text-[15px] sm:text-[17px] font-semibold transition-colors cursor-pointer"
                  >
                    <span className={isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'}>
                      {tab.label}
                    </span>
                    {/* Active purple indicator underline */}
                    <div
                      className={`h-[2.5px] rounded-full mt-1.5 transition-all duration-200 ${
                        isActive ? 'w-9 sm:w-10 bg-[#a855f7]' : 'w-0 bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main
        className={`relative z-10 flex-1 flex flex-col pb-28 ${
          hasReleases
            ? 'items-center justify-start pt-4 px-4 sm:px-6 overflow-y-auto no-scrollbar'
            : 'items-center justify-center px-6 text-center'
        }`}
      >
        {mainTab === 'notifications' ? (
          <>
            {subTab === 'news' && (
              <div className="flex flex-col items-center max-w-sm animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3">
                  <Bell className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  No news right now
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1 leading-relaxed">
                  Editorial updates, announcements, and community news will appear here.
                </p>
              </div>
            )}

            {subTab === 'releases' && (
              displayedNotifications.length > 0 ? (
                <div className="w-full max-w-xl mx-auto space-y-3.5 text-left animate-in fade-in duration-200">
                  {displayedNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => openMediaDetails(notif.media)}
                      className="w-full p-4 sm:p-5 rounded-[22px] sm:rounded-[24px] bg-[#121217]/95 border border-white/[0.08] flex items-start gap-4 transition-all cursor-pointer hover:bg-[#181822] shadow-xl group active:scale-[0.99]"
                    >
                      {/* Left: Artwork Thumbnail (+15px vertical size) */}
                      {notif.coverImage ? (
                        <img
                          src={notif.coverImage}
                          alt={notif.title}
                          className="w-16 h-[79px] sm:w-20 sm:h-[95px] rounded-[16px] sm:rounded-[18px] object-cover shrink-0 shadow-md group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-[79px] sm:w-20 sm:h-[95px] rounded-[16px] sm:rounded-[18px] bg-neutral-800 shrink-0" />
                      )}

                      {/* Right: Notification Info matching exact screenshot format */}
                      <div className="flex-1 min-w-0 flex flex-col justify-start">
                        {/* Relative Date Header: real relative timestamp */}
                        <span className="text-[12px] sm:text-[13px] text-neutral-400 font-medium leading-none">
                          {notif.timestamp ? formatTimeAgo(Math.floor(notif.timestamp / 1000)) : (notif.dateLabel || 'Just now')}
                        </span>

                        {/* Anime Series Title: Purple color as requested */}
                        <h3 className="text-[15px] sm:text-[16.5px] font-bold text-[#b06cf7] group-hover:text-[#c084fc] transition-colors leading-snug line-clamp-2 mt-1.5">
                          {notif.title}
                        </h3>

                        {/* Episode Aired Text */}
                        <p className="text-[13px] sm:text-[14px] text-neutral-200 font-normal mt-1 leading-normal">
                          {notif.episodeText}
                        </p>

                        {/* Delete Button: Purple color as requested */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteReleaseNotification(notif.id);
                          }}
                          className="text-[13px] sm:text-[14px] font-bold text-[#b06cf7] hover:text-[#c084fc] transition-colors mt-2.5 text-left cursor-pointer inline-block w-fit"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center max-w-sm animate-in fade-in duration-200 text-center px-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3">
                    <Bell className="w-8 h-8 text-neutral-400" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    No releases yet
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-1 leading-relaxed">
                    Episode alerts from shows you track will appear here the moment they air.
                  </p>
                </div>
              )
            )}

            {subTab === 'system' && (
              <div className="flex flex-col items-center max-w-sm animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3">
                  <Bell className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  No system notices
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1 leading-relaxed">
                  Important app notices and account-related updates will show up here.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center max-w-sm animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3">
              <Trophy className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Leaderboards
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 leading-relaxed">
              Top anime watchers, seasonal rankings, and community contributors will be displayed here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
