import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Heart,
  ChevronDown,
  ChevronRight,
  X,
  Folder,
  HardDrive,
  Search,
} from 'lucide-react';
import { useApp, ACCENT_COLOR_MAP } from '../../context/AppContext';
import { AccentColorKey } from '../../types';
import { safeRemoveItem } from '../../utils/storage';
import { AppToggleSwitch } from '../common/AppToggleSwitch';
import { loadCustomFontFromStorage, registerAndSaveCustomFont } from '../../utils/customFontHelper';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSetting,
    showToast,
    settingsSubPage,
    setSettingsSubPage,
    settingsActiveModal,
    setSettingsActiveModal,
  } = useApp();

  const activeModal = settingsActiveModal as
    | 'subscription'
    | 'report'
    | 'faqs'
    | 'inviteKey'
    | null;
  const setActiveModal = (modal: 'subscription' | 'report' | 'faqs' | 'inviteKey' | null) => {
    setSettingsActiveModal(modal);
  };

  // State for Report to Dev
  const [reportType, setReportType] = useState('Anime');
  const [issueType, setIssueType] = useState('Choose an issue');
  const [affectedAnime, setAffectedAnime] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [showReportTypePicker, setShowReportTypePicker] = useState(false);
  const [showIssueTypePicker, setShowIssueTypePicker] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // State for Subscription tab (Anime vs Manga & Novels)
  const [subscriptionTab, setSubscriptionTab] = useState<'anime' | 'manga_novels'>('anime');

  // State for FAQs accordion
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // State for General sheet pickers (Language, DNS, Cache)
  const [generalPicker, setGeneralPicker] = useState<'language' | 'dns' | 'cache' | null>(null);

  // State for Appearance sheet pickers (Accent, Glass)
  const [appearancePicker, setAppearancePicker] = useState<'accent' | 'glass' | null>(null);

  // State for Content sheet pickers (Metadata, Title Language, Rating Format)
  const [contentPicker, setContentPicker] = useState<'metadata' | 'titleLanguage' | 'ratingFormat' | null>(null);

  // State for Playback sheet pickers
  const [playbackPicker, setPlaybackPicker] = useState<
    | 'sleepTimer'
    | 'videoQuality'
    | 'audioPreference'
    | 'subtitleLanguage'
    | 'subtitlePreference'
    | 'subtitleAppearance'
    | 'playbackSpeed'
    | null
  >(null);
  const [showCustomSleepTimer, setShowCustomSleepTimer] = useState(false);
  const [customSleepMinutes, setCustomSleepMinutes] = useState('');

  // State for Reader sheet pickers
  const [readerPicker, setReaderPicker] = useState<
    | 'mangaReaderMode'
    | 'pageTurnAnimation'
    | 'pagedReaderDirection'
    | 'imageScale'
    | 'zoomStart'
    | 'tapNavigation'
    | 'readerBackground'
    | 'preloadPages'
    | null
  >(null);

  // Hidden native folder/directory picker ref
  const folderPickerInputRef = useRef<HTMLInputElement>(null);

  // Directly open device's native file/storage manager
  const handleOpenNativeStorageManager = async () => {
    // Priority 1: Window showDirectoryPicker (Chrome / Chromium on Android & PC - triggers real OS directory picker)
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          id: 'anify_downloads',
          mode: 'readwrite',
        });
        if (dirHandle && dirHandle.name) {
          const folderName = dirHandle.name;
          const formatted = folderName.startsWith('Internal storage/')
            ? folderName
            : `Internal storage/${folderName}`;
          updateSetting('downloadPath', formatted);
          updateSetting(
            'downloadUri',
            `content://com.android.externalstorage.documents/tree/primary%3A${encodeURIComponent(folderName)}`
          );
          updateSetting('downloadPermissionGranted', true);
          showToast(`Download path set: ${formatted}`);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled in system file manager
          return;
        }
        console.warn('showDirectoryPicker unavailable or cancelled, falling back to input:', err);
      }
    }

    // Priority 2: Native HTML input webkitdirectory that invokes the user's OS file/storage manager
    folderPickerInputRef.current?.click();
  };

  const accentColors: AccentColorKey[] = [
    'Purple',
    'Blue',
    'Teal',
    'Emerald',
    'Amber',
    'Coral',
    'Rose',
    'Red',
    'Lime',
  ];

  // Dynamic subtitles matching screenshot defaults
  const generalSubtitle = `${
    settings.appLanguage === 'System Default' ? 'System' : settings.appLanguage
  } / ${settings.cacheLimit || 'Balanced'} Cache`;

  const appearanceSubtitle = `${settings.accentColor || 'Purple'} Accent / ${
    settings.pureBlackMode ? 'Pure Black' : 'Dark'
  }`;

  const contentSubtitle = settings.homepageMetadata || 'Auto';

  const playbackSubtitle = `Auto / ${settings.audioPreference || 'Japanese'}`;

  const readerSubtitle = `${
    settings.mangaReaderMode || 'Automatic'
  } / ${settings.pagedReaderDirection || 'Left to Right'}`;

  // Top-level 10 settings items matching the screenshot
  const settingsItems = [
    {
      id: 'general',
      title: 'General',
      subtitle: generalSubtitle,
      icon: (
        <svg className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current" viewBox="0 0 24 24">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      ),
      action: () => setSettingsSubPage('general'),
    },
    {
      id: 'appearance',
      title: 'Appearance',
      subtitle: appearanceSubtitle,
      icon: (
        <svg
          className="w-[23.5px] h-[23.5px] text-[#b876fc]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <line x1="3" y1="6" x2="8" y2="6" />
          <line x1="12" y1="6" x2="21" y2="6" />
          <line x1="8" y1="3.5" x2="8" y2="8.5" />

          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="19" y1="12" x2="21" y2="12" />
          <line x1="15" y1="9.5" x2="15" y2="14.5" />

          <line x1="3" y1="18" x2="10" y2="18" />
          <line x1="14" y1="18" x2="21" y2="18" />
          <line x1="10" y1="15.5" x2="10" y2="20.5" />
        </svg>
      ),
      action: () => setSettingsSubPage('appearance'),
    },
    {
      id: 'content',
      title: 'Content',
      subtitle: contentSubtitle,
      icon: (
        <svg className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current" viewBox="0 0 24 24">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      ),
      action: () => setSettingsSubPage('content'),
    },
    {
      id: 'playback',
      title: 'Playback',
      subtitle: playbackSubtitle,
      icon: (
        <svg className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current" viewBox="0 0 24 24">
          <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
        </svg>
      ),
      action: () => setSettingsSubPage('playback'),
    },
    {
      id: 'reader',
      title: 'Reader',
      subtitle: readerSubtitle,
      icon: (
        <svg className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current" viewBox="0 0 24 24">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
        </svg>
      ),
      action: () => setSettingsSubPage('reader'),
    },
    {
      id: 'downloads',
      title: 'Downloads',
      subtitle: 'Queued downloads',
      icon: (
        <svg className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current" viewBox="0 0 24 24">
          <path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z" />
        </svg>
      ),
      action: () => setSettingsSubPage('downloads'),
    },
    {
      id: 'subscription',
      title: 'Subscription',
      subtitle: 'Support Development',
      icon: (
        <svg className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ),
      action: () => setActiveModal('subscription'),
    },
    {
      id: 'report',
      title: 'Report to Dev',
      subtitle: 'Anime, manga, performance, feedback, and suggestions',
      icon: (
        <svg className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current" viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      ),
      action: () => {
        setReportSubmitted(false);
        setActiveModal('report');
      },
    },
    {
      id: 'faqs',
      title: 'FAQs',
      subtitle: 'Frequently Asked Questions',
      icon: (
        <svg
          className="w-[27px] h-[27px] text-[#b876fc] fill-current"
          viewBox="0 -960 960 960"
        >
          <path d="M584-637q0-43-28.5-69T480-732q-29 0-52.5 12.5T387-683q-16 23-43.5 26.5T296-671q-14-13-15.5-32t9.5-36q32-48 81.5-74.5T480-840q97 0 157.5 55T698-641q0 45-19 81t-70 85q-37 35-50 54.5T542-376q-4 24-20.5 40T482-320q-23 0-39.5-15.5T426-374q0-39 17-71.5t57-68.5q51-45 67.5-69.5T584-637ZM480-80q-33 0-56.5-23.5T400-160q0-33 23.5-56.5T480-240q33 0 56.5 23.5T560-160q0 33-23.5 56.5T480-80Z" />
        </svg>
      ),
      action: () => setActiveModal('faqs'),
    },
    {
      id: 'inviteKey',
      title: 'Manage Invite Key',
      subtitle: undefined, // Screenshot shows no subtitle for Manage Invite Key!
      icon: (
        <svg
          className="w-[23.5px] h-[23.5px] text-[#b876fc] fill-current"
          viewBox="0 0 24 24"
        >
          <g transform="rotate(-45 12 12) translate(24 0) scale(-1 1)">
            <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
          </g>
        </svg>
      ),
      action: () => setActiveModal('inviteKey'),
    },
  ];

  const faqsList = [
    {
      q: 'How to report issues on anime or manga?',
      a: 'You can report broken video streams, missing subtitles, or incorrect manga chapters directly from the player or details menu by tapping "Report an Issue", or reach out in our Community channel.',
    },
    {
      q: 'How about reducing ads?',
      a: 'The app is completely free and has zero built-in advertisements! For external third-party streaming embeds with popups, we recommend enabling Clean Stream mode in Settings or using an ad-blocking DNS.',
    },
    {
      q: "Why isn't the dubbed version available?",
      a: 'Dubbed audio availability depends on public licensed provider streams. If a dub is available for an episode, you can easily toggle between Sub and Dub in the player audio tracks menu.',
    },
    {
      q: 'Why are some episodes orange colored?',
      a: 'Orange-colored episode badges indicate filler episodes, special movie/OVA releases, or your currently active watch progress so you never lose track of where you left off.',
    },
    {
      q: 'What platform does Anify support?',
      a: 'The app supports all modern mobile, tablet, and desktop web browsers. You can also install it as a Progressive Web App (PWA) directly onto your Android, iOS, or Windows home screen.',
    },
    {
      q: 'What happened to Rooms?',
      a: 'Watch Party and Reading Rooms let you sync playback and live chat in real time with friends! You can create or join an open room anytime from the Community tab.',
    },
    {
      q: 'How can I support Anify?',
      a: 'You can support the project by sharing the app with other anime and manga fans, reporting bugs, suggesting improvements, and starring our open-source project repository.',
    },
    {
      q: 'How does the Leaderboard works?',
      a: 'The Leaderboard ranks users based on total anime episodes watched, manga chapters completed, active daily streaks, and community achievements across weekly and all-time leaderboards.',
    },
    {
      q: 'How does the leveling system work?',
      a: 'You earn EXP every time you complete an episode, finish a manga chapter, or maintain your daily login streak. Leveling up unlocks custom titles, animated profile rings, and perks.',
    },
    {
      q: 'Some media have no episodes/chapters?',
      a: 'Upcoming anime titles, unreleased manga, or newly licensed series may not have active streaming mirrors yet. Once third-party mirror sources release content, it appears automatically.',
    },
  ];

  return (
    <div className="w-full min-h-screen bg-black text-white pt-5 pb-32 select-none">
      <div className="w-full max-w-xl mx-auto px-4 sm:px-6">
        {/* ================= SUBPAGE VIEW ================= */}
        {settingsSubPage && settingsSubPage !== 'downloads' && settingsSubPage !== 'general' && settingsSubPage !== 'appearance' && settingsSubPage !== 'content' && settingsSubPage !== 'playback' && settingsSubPage !== 'reader' ? (
          <div className="space-y-6">
            <div className="tab-header-row gap-3.5 pb-2 border-b border-white/10">
              <button
                onClick={() => setSettingsSubPage(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer text-white active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="tab-title-text capitalize">
                {settingsSubPage}
              </h1>
            </div>
          </div>
        ) : (
          /* ================= MAIN SETTINGS HUB (PIXEL-PERFECT TO SCREENSHOT) ================= */
          <div>
            {/* Top Heading */}
            <div className="tab-header-row justify-between">
              <h1 className="tab-title-text drop-shadow-md">
                Settings
              </h1>
            </div>

            {/* Flat List of 10 Options */}
            <div className="flex flex-col space-y-4 sm:space-y-4.5">
              {settingsItems.map((item) => (
                <button
                  key={item.id}
                  id={`settings-item-${item.id}`}
                  type="button"
                  onClick={item.action}
                  className="group flex items-center gap-4 w-full text-left cursor-pointer transition-opacity active:opacity-70 focus:outline-none select-none"
                >
                  {/* Purple squircle container (increased 0.1x from 38px to 42px) */}
                  <div className="w-[42px] h-[42px] rounded-[13px] bg-[#1e132b] flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#261737]">
                    {item.icon}
                  </div>

                  {/* Text labels */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] sm:text-[17px] font-bold text-white tracking-[-0.01em] leading-tight">
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div className="text-[13px] text-[#8e8e98] tracking-normal leading-tight mt-1 truncate">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Bottom Footer */}
            <div className="pt-12 pb-6 text-center space-y-1.5 flex flex-col items-center justify-center">
              <div className="text-[14px] font-semibold text-white/75 tracking-normal">
                Satori 1.8
              </div>
              <div className="text-[13px] flex items-center justify-center gap-1.5">
                <span className="text-white/60">Made with</span>
                <svg
                  className="w-[14px] h-[14px] text-[#b876fc] opacity-85 fill-current inline-block shrink-0"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= FULL SCREEN GENERAL SHEET (Exact pixel-accurate reproduction of Screenshot_20260905_193022_Anify.jpg) ================= */}
      {settingsSubPage === 'general' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-5 sm:px-6">
            {/* Top Bar: Clean ArrowLeft & "General" Header matching screenshot */}
            <div className="flex items-center gap-5 pt-8 pb-7">
              <button
                type="button"
                onClick={() => setSettingsSubPage(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-[22px] sm:text-[24px] font-bold text-white tracking-normal">
                General
              </h1>
            </div>

            {/* List of options matching Screenshot_20260905_193022_Anify.jpg */}
            <div className="flex flex-col space-y-7 pt-1">
              {/* Option 1: App Language */}
              <div
                onClick={() => setGeneralPicker('language')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    App Language
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.appLanguage
                      ? `Use ${settings.appLanguage} for the app interface`
                      : 'Use English for the app interface'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 2: App Haptics */}
              <div
                onClick={() => {
                  const nextVal = !settings.appHaptics;
                  updateSetting('appHaptics', nextVal);
                  if (nextVal && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(25);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    App Haptics
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Configure app-wide haptic vibration
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.appHaptics}
                    onChange={(v) => {
                      updateSetting('appHaptics', v);
                      if (v && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(25);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 3: DNS */}
              <div
                onClick={() => setGeneralPicker('dns')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    DNS
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.dns === 'Off'
                      ? 'Direct DNS connection'
                      : `Resolve source requests with ${settings.dns || 'Cloudflare'}`}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 4: Enable Trailers */}
              <div
                onClick={() => {
                  const nextVal = !settings.enableTrailers;
                  updateSetting('enableTrailers', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Enable Trailers
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Play trailers automatically on details pages
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.enableTrailers}
                    onChange={(v) => {
                      updateSetting('enableTrailers', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(15);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 5: Trailers Start Muted */}
              <div
                onClick={() => {
                  const nextVal = !settings.trailersStartMuted;
                  updateSetting('trailersStartMuted', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Trailers Start Muted
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Keep autoplay trailers silent by default
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.trailersStartMuted}
                    onChange={(v) => {
                      updateSetting('trailersStartMuted', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(15);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 6: Cache Limit */}
              <div
                onClick={() => setGeneralPicker('cache')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Cache Limit
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.cacheLimit || 'Balanced'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Modal Picker for Language */}
          {generalPicker === 'language' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setGeneralPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">App Language</h3>

                {/* Language Options List */}
                <div className="space-y-1 max-h-[calc(60vh-150px)] overflow-y-auto no-scrollbar px-[5px]">
                  {[
                    'System Default',
                    'English',
                    'বাংলা - Bengali',
                    'Deutsch - German',
                    'Español - Spanish',
                    'فارسی - Persian',
                    'Français - French',
                    'हिन्दी - Hindi',
                    'Bahasa Indonesia - Indonesian',
                    'Italiano - Italian',
                    '日本語 - Japanese',
                    '한국어 - Korean',
                    'Bahasa Melayu - Malay',
                    'Nederlands - Dutch',
                    'Polski - Polish',
                    'Português - Portuguese',
                    'Русский - Russian',
                    'ไทย - Thai',
                    'Türkçe - Turkish',
                    'Українська - Ukrainian',
                    'اردو - Urdu',
                    'Tiếng Việt - Vietnamese',
                    '简体中文 - Chinese (Simplified)',
                    '繁體中文 - Chinese (Traditional)',
                  ].map((lang) => {
                    const isSelected = (settings.appLanguage || 'English') === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          updateSetting('appLanguage', lang);
                          setGeneralPicker(null);
                          showToast(`Language set to ${lang}`);
                        }}
                        className={`w-full flex items-center justify-between py-2.5 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{lang}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setGeneralPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for DNS */}
          {generalPicker === 'dns' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setGeneralPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">DNS</h3>

                {/* DNS Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Off',
                    'Cloudflare',
                    'Google',
                    'AdGuard',
                    'Quad9',
                  ].map((dnsName) => {
                    const isSelected = (settings.dns || 'Cloudflare') === dnsName;
                    return (
                      <button
                        key={dnsName}
                        type="button"
                        onClick={() => {
                          updateSetting('dns', dnsName);
                          setGeneralPicker(null);
                          showToast(`DNS set to ${dnsName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2.5 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{dnsName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setGeneralPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Cache Limit */}
          {generalPicker === 'cache' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setGeneralPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Cache Limit</h3>

                {/* Cache Limit Options List */}
                <div className="space-y-1 max-h-[60vh] overflow-y-auto no-scrollbar px-[5px]">
                  {[
                    'None',
                    'Tiny',
                    'Low',
                    'Balanced',
                    'Large',
                    'Very large',
                    'Max',
                    'Unlimited',
                  ].map((limit) => {
                    const isSelected = (settings.cacheLimit || 'Balanced') === limit;
                    return (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => {
                          updateSetting('cacheLimit', limit);
                          setGeneralPicker(null);
                          showToast(`Cache limit set to ${limit}`);
                        }}
                        className={`w-full flex items-center justify-between py-2.5 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{limit}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setGeneralPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= FULL SCREEN APPEARANCE SHEET (Exact pixel-accurate reproduction of Screenshot_20260905_193215_Anify.jpg) ================= */}
      {settingsSubPage === 'appearance' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-5 sm:px-6">
            {/* Top Bar: Clean ArrowLeft & "Appearance" Header matching screenshot */}
            <div className="flex items-center gap-5 pt-8 pb-7">
              <button
                type="button"
                onClick={() => setSettingsSubPage(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-[22px] sm:text-[24px] font-bold text-white tracking-normal">
                Appearance
              </h1>
            </div>

            {/* List of options matching Screenshot_20260905_193215_Anify.jpg */}
            <div className="flex flex-col space-y-7 pt-1">
              {/* Option 1: Pure Black Mode */}
              <div
                onClick={() => {
                  const nextVal = !settings.pureBlackMode;
                  updateSetting('pureBlackMode', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(20);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Pure Black Mode
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Use pitch black app theme
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.pureBlackMode}
                    onChange={(v) => {
                      updateSetting('pureBlackMode', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(20);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 2: Accent Color */}
              <div
                onClick={() => setAppearancePicker('accent')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Accent Color
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.accentColor || 'Purple'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 3: Glass Effect */}
              <div
                onClick={() => setAppearancePicker('glass')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Glass Effect
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Blur {settings.glassBlur ?? 0}dp, Saturation {settings.glassSaturation ?? 75}%, Refraction {settings.glassRefraction ?? 0}dp, Tint {settings.glassTint ?? 12}%
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Modal Picker for Accent Color */}
          {appearancePicker === 'accent' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setAppearancePicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Accent Color</h3>

                {/* Accent Color Options List */}
                <div className="space-y-1 max-h-[60vh] overflow-y-auto no-scrollbar px-[5px]">
                  {accentColors.map((colorKey) => {
                    const item = ACCENT_COLOR_MAP[colorKey];
                    const isSelected = (settings.accentColor || 'Purple') === colorKey;
                    return (
                      <button
                        key={colorKey}
                        type="button"
                        onClick={() => {
                          updateSetting('accentColor', colorKey);
                          setAppearancePicker(null);
                          showToast(`Accent color set to ${colorKey}`);
                        }}
                        className={`w-full flex items-center justify-between py-2.5 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                        style={{ color: isSelected ? item.hex : undefined }}
                      >
                        <div className="flex items-center min-w-0">
                          {/* Color Dot on Left */}
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 mr-3.5"
                            style={{ backgroundColor: item.hex }}
                          />
                          <span className="truncate">{colorKey}</span>
                        </div>
                        {isSelected && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2"
                            style={{ backgroundColor: item.hex }}
                          >
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setAppearancePicker(null)}
                    className="hover:opacity-80 font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                    style={{ color: ACCENT_COLOR_MAP[settings.accentColor || 'Purple']?.hex || '#a755f7' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal for Glass Effect */}
          {appearancePicker === 'glass' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setAppearancePicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] max-h-[85vh] h-[520px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl flex flex-col select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight shrink-0 mb-3">Glass Effect</h3>

                {/* Scrollable Options List - preserves card size unchanged */}
                <div className="overflow-y-auto flex-1 pr-1 space-y-4 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {/* Enable Liquid Glass Toggle Row */}
                  <div
                    className="flex items-center justify-between cursor-pointer py-1 select-none px-[5px]"
                    onClick={() => updateSetting('enableLiquidGlass', !(settings.enableLiquidGlass ?? true))}
                  >
                    <div className="pr-4">
                      <div className="text-[15px] font-bold text-white tracking-tight leading-tight">
                        Enable Liquid Glass
                      </div>
                      <div className="text-[13px] text-white/60 font-normal mt-0.5 leading-snug">
                        Use backdrop blur and refraction effects
                      </div>
                    </div>
                    <AppToggleSwitch
                      checked={settings.enableLiquidGlass ?? true}
                      onChange={(val) => updateSetting('enableLiquidGlass', val)}
                    />
                  </div>

                  {/* Glass Blur Slider */}
                  <div className="px-[5px]">
                    <DiscreteDotSlider
                      label="Glass Blur"
                      sublabel={`${settings.glassBlur ?? 0}dp backdrop blur`}
                      value={settings.glassBlur ?? 0}
                      min={0}
                      max={28}
                      steps={15}
                      accentColorHex={ACCENT_COLOR_MAP[settings.accentColor || 'Purple']?.hex || '#a755f7'}
                      onChange={(val) => updateSetting('glassBlur', val)}
                    />
                  </div>

                  {/* Glass Saturation Slider */}
                  <div className="px-[5px]">
                    <DiscreteDotSlider
                      label="Glass Saturation"
                      sublabel={`${settings.glassSaturation ?? 75}% color intensity`}
                      value={settings.glassSaturation ?? 75}
                      min={75}
                      max={160}
                      steps={18}
                      accentColorHex={ACCENT_COLOR_MAP[settings.accentColor || 'Purple']?.hex || '#a755f7'}
                      onChange={(val) => updateSetting('glassSaturation', val)}
                    />
                  </div>

                  {/* Glass Refraction Slider */}
                  <div className="px-[5px]">
                    <DiscreteDotSlider
                      label="Glass Refraction"
                      sublabel={`${settings.glassRefraction ?? 0}dp edge bending`}
                      value={settings.glassRefraction ?? 0}
                      min={0}
                      max={32}
                      steps={17}
                      accentColorHex={ACCENT_COLOR_MAP[settings.accentColor || 'Purple']?.hex || '#a755f7'}
                      onChange={(val) => updateSetting('glassRefraction', val)}
                    />
                  </div>

                  {/* Glass Tint Slider (New Option) */}
                  <div className="px-[5px]">
                    <DiscreteDotSlider
                      label="Glass Tint"
                      sublabel={`${settings.glassTint ?? 12}% dark surface tint`}
                      value={settings.glassTint ?? 12}
                      min={12}
                      max={72}
                      steps={13}
                      accentColorHex={ACCENT_COLOR_MAP[settings.accentColor || 'Purple']?.hex || '#a755f7'}
                      onChange={(val) => updateSetting('glassTint', val)}
                    />
                  </div>
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-3 px-[5px] shrink-0">
                  <button
                    type="button"
                    onClick={() => setAppearancePicker(null)}
                    className="hover:opacity-80 font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                    style={{ color: ACCENT_COLOR_MAP[settings.accentColor || 'Purple']?.hex || '#a755f7' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= FULL SCREEN CONTENT SHEET (Exact pixel-accurate reproduction of Screenshot_20260905_194552_Anify.jpg) ================= */}
      {settingsSubPage === 'content' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-5 sm:px-6">
            {/* Top Bar: Clean ArrowLeft & "Content" Header matching screenshot */}
            <div className="flex items-center gap-5 pt-8 pb-7">
              <button
                type="button"
                onClick={() => setSettingsSubPage(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-[22px] sm:text-[24px] font-bold text-white tracking-normal">
                Content
              </h1>
            </div>

            {/* List of options matching Screenshot_20260905_194552_Anify.jpg */}
            <div className="flex flex-col space-y-7 pt-1">
              {/* Option 1: Metadata */}
              <div
                onClick={() => setContentPicker('metadata')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Metadata
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.homepageMetadata || 'Auto'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 2: Title Language */}
              <div
                onClick={() => setContentPicker('titleLanguage')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Title Language
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.titleLanguage || 'English'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 3: Rating Format */}
              <div
                onClick={() => setContentPicker('ratingFormat')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Rating Format
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.ratingFormat || '10-Point · 1 Decimal Place'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 4: Show Library Progress */}
              <div
                onClick={() => {
                  const nextVal = !settings.showLibraryProgress;
                  updateSetting('showLibraryProgress', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(20);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Show Library Progress
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Show watched episodes or read chapters on library posters
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.showLibraryProgress}
                    onChange={(v) => {
                      updateSetting('showLibraryProgress', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(20);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 5: Filler List */}
              <div
                onClick={() => {
                  const nextVal = !settings.fillerList;
                  updateSetting('fillerList', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(20);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Filler List
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Mark known filler episodes when data is available
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.fillerList}
                    onChange={(v) => {
                      updateSetting('fillerList', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(20);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Picker for Metadata */}
          {contentPicker === 'metadata' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setContentPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Metadata</h3>

                {/* Metadata Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Auto',
                    'AniList',
                    'MAL',
                  ].map((metaName) => {
                    const isSelected = (settings.homepageMetadata || 'Auto') === metaName;
                    return (
                      <button
                        key={metaName}
                        type="button"
                        onClick={() => {
                          updateSetting('homepageMetadata', metaName);
                          setContentPicker(null);
                          showToast(`Metadata set to ${metaName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2.5 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{metaName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setContentPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Title Language */}
          {contentPicker === 'titleLanguage' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setContentPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Title Language</h3>

                {/* Title Language Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'English',
                    'Romaji',
                  ].map((langName) => {
                    const isSelected = (settings.titleLanguage || 'English') === langName;
                    return (
                      <button
                        key={langName}
                        type="button"
                        onClick={() => {
                          updateSetting('titleLanguage', langName as any);
                          setContentPicker(null);
                          showToast(`Title language set to ${langName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2.5 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{langName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setContentPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Rating Format */}
          {contentPicker === 'ratingFormat' && (
            <RatingFormatPickerModal
              currentFormat={settings.ratingFormat || '10-Point · 1 Decimal Place'}
              onApply={(newFormat) => {
                updateSetting('ratingFormat', newFormat);
                setContentPicker(null);
                showToast(`Rating format set to ${newFormat}`);
              }}
              onClose={() => setContentPicker(null)}
            />
          )}
        </div>
      )}

      {/* ================= FULL SCREEN PLAYBACK SHEET (Exact pixel-accurate reproduction of Screenshot_20260905_195124_Anify.jpg) ================= */}
      {settingsSubPage === 'playback' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-5 sm:px-6">
            {/* Top Bar: Clean ArrowLeft & "Playback" Header matching screenshot */}
            <div className="flex items-center gap-5 pt-8 pb-7">
              <button
                type="button"
                onClick={() => setSettingsSubPage(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-[22px] sm:text-[24px] font-bold text-white tracking-normal">
                Playback
              </h1>
            </div>

            {/* List of options matching Screenshot_20260905_195124_Anify.jpg */}
            <div className="flex flex-col space-y-7 pt-1 pb-16">
              {/* Option 1: Gestures */}
              <div
                onClick={() => {
                  const nextVal = !settings.gestures;
                  updateSetting('gestures', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(20);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Gestures
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Enable seek, volume, and brightness gestures
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.gestures}
                    onChange={(v) => {
                      updateSetting('gestures', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(20);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 2: Ambient Light */}
              <div
                onClick={() => {
                  const nextVal = !settings.ambientLight;
                  updateSetting('ambientLight', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(20);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Ambient Light
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Let video colors softly illuminate the player background
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.ambientLight}
                    onChange={(v) => {
                      updateSetting('ambientLight', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(20);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 3: Auto Skip Filler */}
              <div
                onClick={() => {
                  const nextVal = !settings.autoSkipFiller;
                  updateSetting('autoSkipFiller', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(20);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Auto Skip Filler
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    Prefer canon episodes when playback data supports it
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.autoSkipFiller}
                    onChange={(v) => {
                      updateSetting('autoSkipFiller', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(20);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Option 4: Sleep Timer */}
              <div
                onClick={() => setPlaybackPicker('sleepTimer')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Sleep Timer
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.sleepTimer || 'Off'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 5: Video Quality */}
              <div
                onClick={() => setPlaybackPicker('videoQuality')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Video Quality
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.videoQuality || 'Auto'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 6: Audio Preference */}
              <div
                onClick={() => setPlaybackPicker('audioPreference')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Audio Preference
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.audioPreference || 'Japanese'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 7: Subtitle Language */}
              <div
                onClick={() => setPlaybackPicker('subtitleLanguage')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Subtitle Language
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.subtitleLanguage || 'English'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 8: Subtitle Preference */}
              <div
                onClick={() => setPlaybackPicker('subtitlePreference')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Subtitle Preference
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.subtitlePreference || 'Automatic'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 9: Subtitle Appearance */}
              <div
                onClick={() => setPlaybackPicker('subtitleAppearance')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Subtitle Appearance
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.subtitleFont || 'Netflix Sans'}, {settings.subtitleSize ?? 15}sp, {settings.subtitleElevation ?? -10}% elevation
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* Option 10: Playback Speed */}
              <div
                onClick={() => setPlaybackPicker('playbackSpeed')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                    Playback Speed
                  </h2>
                  <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight leading-normal">
                    {settings.playbackSpeed || '1x'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Modal Picker for Sleep Timer */}
          {playbackPicker === 'sleepTimer' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setPlaybackPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Sleep Timer</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Off',
                    '15 minutes',
                    '30 minutes',
                    '45 minutes',
                    '60 minutes',
                    'End of Episode',
                    'Custom',
                  ].map((timerName) => {
                    const standardTimers = [
                      'off',
                      '15 minutes',
                      '30 minutes',
                      '45 minutes',
                      '60 minutes',
                      'end of episode',
                    ];
                    const currentLower = (settings.sleepTimer || 'Off').toLowerCase();
                    const isSelected =
                      timerName === 'Custom'
                        ? !standardTimers.includes(currentLower)
                        : currentLower === timerName.toLowerCase();

                    return (
                      <button
                        key={timerName}
                        type="button"
                        onClick={() => {
                          if (timerName === 'Custom') {
                            setPlaybackPicker(null);
                            const existingMatch = (settings.sleepTimer || '').match(/^(\d+)\s*minutes?$/i);
                            setCustomSleepMinutes(existingMatch ? existingMatch[1] : '');
                            setShowCustomSleepTimer(true);
                          } else {
                            updateSetting('sleepTimer', timerName);
                            setPlaybackPicker(null);
                            showToast(`Sleep timer set to ${timerName}`);
                          }
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{timerName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setPlaybackPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Sleep Timer Modal (Exact reproduction of Screenshot_20260924_182427_Anify.jpg) */}
          {showCustomSleepTimer && (
            <div
              className="fixed inset-0 z-[7500] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setShowCustomSleepTimer(false)}
            >
              <div
                className="w-full max-w-[340px] sm:max-w-[370px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-4 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Custom Sleep Timer</h3>

                {/* Minutes Input Box matching Screenshot */}
                <div>
                  <div className="relative rounded-lg border border-[#3e4c5b] focus-within:border-[#a855f7] bg-transparent transition-colors px-3.5 py-3">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={customSleepMinutes}
                      onChange={(e) => setCustomSleepMinutes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const num = parseInt(customSleepMinutes, 10);
                          if (!isNaN(num) && num >= 1 && num <= 720) {
                            updateSetting('sleepTimer', `${num} minutes`);
                            setShowCustomSleepTimer(false);
                            showToast(`Sleep timer set to ${num} minutes`);
                          }
                        }
                      }}
                      placeholder="Minutes"
                      autoFocus
                      className="w-full bg-transparent text-white text-[15px] outline-none placeholder:text-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-normal"
                    />
                  </div>
                  <p className="text-[12px] sm:text-[12.5px] text-white/60 mt-1.5 leading-snug px-1">
                    Enter 1–720 minutes. Interaction restarts the countdown.
                  </p>
                </div>

                {/* Action Buttons Cancel & Start */}
                <div className="flex items-center justify-end gap-6 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomSleepTimer(false)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-1 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      isNaN(parseInt(customSleepMinutes, 10)) ||
                      parseInt(customSleepMinutes, 10) < 1 ||
                      parseInt(customSleepMinutes, 10) > 720
                    }
                    onClick={() => {
                      const num = parseInt(customSleepMinutes, 10);
                      if (!isNaN(num) && num >= 1 && num <= 720) {
                        updateSetting('sleepTimer', `${num} minutes`);
                        setShowCustomSleepTimer(false);
                        showToast(`Sleep timer set to ${num} minutes`);
                      }
                    }}
                    className={`font-semibold text-sm transition-colors px-1 py-1 ${
                      !isNaN(parseInt(customSleepMinutes, 10)) &&
                      parseInt(customSleepMinutes, 10) >= 1 &&
                      parseInt(customSleepMinutes, 10) <= 720
                        ? 'text-[#a855f7] hover:text-[#c084fc] cursor-pointer'
                        : 'text-[#a855f7]/40 cursor-not-allowed'
                    }`}
                  >
                    Start
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Video Quality */}
          {playbackPicker === 'videoQuality' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setPlaybackPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Video Quality</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Auto',
                    '1080p',
                    '720p',
                    '480p',
                    '360p',
                  ].map((qualityName) => {
                    const isSelected = (settings.videoQuality || 'Auto').toLowerCase() === qualityName.toLowerCase();
                    return (
                      <button
                        key={qualityName}
                        type="button"
                        onClick={() => {
                          updateSetting('videoQuality', qualityName);
                          setPlaybackPicker(null);
                          showToast(`Video quality set to ${qualityName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{qualityName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setPlaybackPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Audio Preference */}
          {playbackPicker === 'audioPreference' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setPlaybackPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Audio Preference</h3>

                {/* Options List */}
                <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
                  {[
                    'Hindi',
                    'Tamil',
                    'Spanish (Latin America)',
                    'Portuguese (Brazilian)',
                    'Spanish',
                    'German',
                    'Japanese',
                    'French',
                    'English',
                    'Italian',
                  ].map((audioName) => {
                    const isSelected = (settings.audioPreference || 'Japanese').toLowerCase() === audioName.toLowerCase();
                    return (
                      <button
                        key={audioName}
                        type="button"
                        onClick={() => {
                          updateSetting('audioPreference', audioName);
                          setPlaybackPicker(null);
                          showToast(`Audio preference set to ${audioName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{audioName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 shrink-0 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setPlaybackPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Subtitle Language */}
          {playbackPicker === 'subtitleLanguage' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setPlaybackPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Subtitle Language</h3>

                {/* Options List */}
                <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
                  {[
                    'English',
                    'Arabic',
                    'Bengali',
                    'German',
                    'Spanish',
                    'Spanish (Latin America)',
                    'Spanish (European)',
                    'French',
                    'Filipino',
                    'Hindi',
                    'Indonesian',
                    'Italian',
                    'Japanese',
                    'Malay',
                    'Dutch',
                    'Korean',
                    'Polish',
                    'Portuguese',
                    'Romanian',
                    'Russian',
                    'Swedish',
                    'Thai',
                    'Turkish',
                    'Ukrainian',
                    'Vietnamese',
                    'Chinese',
                    'Chinese (Simplified)',
                    'Chinese (Traditional)',
                  ].map((langName) => {
                    const isSelected = (settings.subtitleLanguage || 'English').toLowerCase() === langName.toLowerCase();
                    return (
                      <button
                        key={langName}
                        type="button"
                        onClick={() => {
                          updateSetting('subtitleLanguage', langName);
                          setPlaybackPicker(null);
                          showToast(`Subtitle language set to ${langName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{langName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 shrink-0 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setPlaybackPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Subtitle Preference */}
          {playbackPicker === 'subtitlePreference' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setPlaybackPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Subtitle Preference</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Automatic',
                    'Soft Sub',
                    'Hard Sub',
                  ].map((prefName) => {
                    const currentVal = settings.subtitlePreference || 'Automatic';
                    const isSelected =
                      currentVal.toLowerCase() === prefName.toLowerCase() ||
                      (prefName === 'Soft Sub' && currentVal.toLowerCase().startsWith('soft')) ||
                      (prefName === 'Hard Sub' && currentVal.toLowerCase().startsWith('hard'));
                    return (
                      <button
                        key={prefName}
                        type="button"
                        onClick={() => {
                          updateSetting('subtitlePreference', prefName);
                          setPlaybackPicker(null);
                          showToast(`Subtitle preference set to ${prefName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{prefName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setPlaybackPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Subtitle Appearance */}
          {playbackPicker === 'subtitleAppearance' && (
            <SubtitleAppearanceModal
              settings={settings}
              updateSetting={updateSetting}
              showToast={showToast}
              onClose={() => setPlaybackPicker(null)}
            />
          )}

          {/* Modal Picker for Playback Speed */}
          {playbackPicker === 'playbackSpeed' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setPlaybackPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Playback Speed</h3>

                {/* Speed Options List */}
                <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
                  {[
                    '0.25x',
                    '0.50x',
                    '0.75x',
                    '1x',
                    '1.25x',
                    '1.50x',
                    '1.75x',
                    '2x',
                    '2.25x',
                    '2.50x',
                    '2.75x',
                    '3.00x',
                  ].map((spd) => {
                    const currentSpd = settings.playbackSpeed || '1x';
                    const isSelected =
                      currentSpd === spd ||
                      (spd === '0.50x' && currentSpd === '0.5x') ||
                      (spd === '1.50x' && currentSpd === '1.5x') ||
                      (spd === '1x' && currentSpd === '1.00x') ||
                      (spd === '2x' && currentSpd === '2.00x') ||
                      (spd === '2.50x' && currentSpd === '2.5x') ||
                      (spd === '3.00x' && currentSpd === '3x');
                    return (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          updateSetting('playbackSpeed', spd);
                          setPlaybackPicker(null);
                          showToast(`Playback speed set to ${spd}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{spd}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 shrink-0 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setPlaybackPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= FULL SCREEN READER SHEET (Exact pixel-accurate reproduction of Screenshot_20260905_195354_Anify.jpg) ================= */}
      {settingsSubPage === 'reader' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-5 sm:px-6 pb-28">
            {/* Top Bar: Clean ArrowLeft & "Reader" Header matching screenshot */}
            <div className="flex items-center gap-5 pt-8 pb-7">
              <button
                type="button"
                onClick={() => setSettingsSubPage(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-[22px] sm:text-[24px] font-bold text-white tracking-normal">
                Reader
              </h1>
            </div>

            {/* List of 12 options matching Screenshot_20260905_195354_Anify.jpg */}
            <div className="flex flex-col space-y-6 pt-1">
              {/* 1. Manga Reader Mode */}
              <div
                onClick={() => setReaderPicker('mangaReaderMode')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Manga Reader Mode
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.mangaReaderMode || 'Automatic'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* 2. Page Turn Animation */}
              <div
                onClick={() => setReaderPicker('pageTurnAnimation')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Page Turn Animation
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.pageTurnAnimation || 'Default'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* 3. Paged Reader Direction */}
              <div
                onClick={() => setReaderPicker('pagedReaderDirection')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Paged Reader Direction
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.pagedReaderDirection || 'Left to Right'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* 4. Image Scale */}
              <div
                onClick={() => setReaderPicker('imageScale')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Image Scale
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.imageScale || 'Fit'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* 5. Zoom Start */}
              <div
                onClick={() => setReaderPicker('zoomStart')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Zoom Start
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.zoomStart || 'Auto'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* 6. Tap Navigation */}
              <div
                onClick={() => setReaderPicker('tapNavigation')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Tap Navigation
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.tapNavigation || 'Edges'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* 7. Reader Background */}
              <div
                onClick={() => setReaderPicker('readerBackground')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Reader Background
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.readerBackground || 'Black'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>

              {/* 8. Crop Borders */}
              <div
                onClick={() => {
                  const nextVal = !settings.cropBorders;
                  updateSetting('cropBorders', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Crop Borders
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    Trim plain page margins in paged modes
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={!!settings.cropBorders}
                    onChange={(v) => {
                      updateSetting('cropBorders', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(15);
                      }
                    }}
                  />
                </div>
              </div>

              {/* 9. Automatic Webtoon */}
              <div
                onClick={() => {
                  const nextVal = !settings.automaticWebtoon;
                  updateSetting('automaticWebtoon', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Automatic Webtoon
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    Use long strip mode when decoded pages are tall
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.automaticWebtoon ?? true}
                    onChange={(v) => {
                      updateSetting('automaticWebtoon', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(15);
                      }
                    }}
                  />
                </div>
              </div>

              {/* 10. Wide Page Zoom */}
              <div
                onClick={() => {
                  const nextVal = !settings.widePageZoom;
                  updateSetting('widePageZoom', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Wide Page Zoom
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    Fit wide landscape pages to screen width
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.widePageZoom ?? true}
                    onChange={(v) => {
                      updateSetting('widePageZoom', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(15);
                      }
                    }}
                  />
                </div>
              </div>

              {/* 11. Keep Screen On */}
              <div
                onClick={() => {
                  const nextVal = !settings.keepScreenOn;
                  updateSetting('keepScreenOn', nextVal);
                  if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                }}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Keep Screen On
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    Prevent sleep while the manga reader is open
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AppToggleSwitch
                    checked={settings.keepScreenOn ?? true}
                    onChange={(v) => {
                      updateSetting('keepScreenOn', v);
                      if (settings.appHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(15);
                      }
                    }}
                  />
                </div>
              </div>

              {/* 12. Preload Pages */}
              <div
                onClick={() => setReaderPicker('preloadPages')}
                className="flex items-center justify-between cursor-pointer group py-1.5 transition-colors"
              >
                <div className="pr-4">
                  <h2 className="text-[16.5px] font-bold text-white tracking-normal leading-tight">
                    Preload Pages
                  </h2>
                  <p className="text-[13.5px] text-[#8e8e98] mt-1 font-normal tracking-normal leading-normal">
                    {settings.preloadPages !== undefined
                      ? `${settings.preloadPages} pages around current page`
                      : '2 pages around current page'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#b876fc] shrink-0 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Modal Picker for Manga Reader Mode */}
          {readerPicker === 'mangaReaderMode' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Manga Reader Mode</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Automatic',
                    'Paged',
                    'Vertical',
                    'Webtoon',
                  ].map((modeName) => {
                    const currentMode = settings.mangaReaderMode || 'Automatic';
                    const isSelected = currentMode.toLowerCase() === modeName.toLowerCase();
                    return (
                      <button
                        key={modeName}
                        type="button"
                        onClick={() => {
                          updateSetting('mangaReaderMode', modeName as any);
                          setReaderPicker(null);
                          showToast(`Reader mode set to ${modeName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{modeName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Page Turn Animation */}
          {readerPicker === 'pageTurnAnimation' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Page Turn Animation</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Off',
                    'Default',
                    'Book Flip',
                  ].map((animName) => {
                    const currentAnim = settings.pageTurnAnimation || 'Default';
                    const isSelected =
                      currentAnim.toLowerCase() === animName.toLowerCase() ||
                      (animName === 'Off' && currentAnim === 'None') ||
                      (animName === 'Book Flip' && (currentAnim === 'Curl' || currentAnim === 'Slide'));
                    return (
                      <button
                        key={animName}
                        type="button"
                        onClick={() => {
                          updateSetting('pageTurnAnimation', animName);
                          setReaderPicker(null);
                          showToast(`Page animation set to ${animName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{animName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Paged Reader Direction */}
          {readerPicker === 'pagedReaderDirection' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Paged Reader Direction</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Left to Right',
                    'Right to Left',
                  ].map((dirName) => {
                    const currentDir = settings.pagedReaderDirection || 'Left to Right';
                    const isSelected = currentDir.toLowerCase() === dirName.toLowerCase();
                    return (
                      <button
                        key={dirName}
                        type="button"
                        onClick={() => {
                          updateSetting('pagedReaderDirection', dirName as any);
                          setReaderPicker(null);
                          showToast(`Direction set to ${dirName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{dirName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Image Scale */}
          {readerPicker === 'imageScale' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Image Scale</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Fit',
                    'Width',
                    'Original',
                    'Fill',
                  ].map((scaleName) => {
                    const currentScale = settings.imageScale || 'Fit';
                    const isSelected =
                      currentScale.toLowerCase() === scaleName.toLowerCase() ||
                      (scaleName === 'Width' && currentScale === 'Fit Width') ||
                      (scaleName === 'Original' && currentScale === 'Original Size') ||
                      (scaleName === 'Fill' && currentScale === 'Stretch');
                    return (
                      <button
                        key={scaleName}
                        type="button"
                        onClick={() => {
                          updateSetting('imageScale', scaleName as any);
                          setReaderPicker(null);
                          showToast(`Image scale set to ${scaleName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{scaleName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Zoom Start */}
          {readerPicker === 'zoomStart' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Zoom Start</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Auto',
                    'Left',
                    'Center',
                    'Right',
                  ].map((zoomMode) => {
                    const currentZoom = settings.zoomStart || 'Auto';
                    const isSelected = currentZoom.toLowerCase() === zoomMode.toLowerCase();
                    return (
                      <button
                        key={zoomMode}
                        type="button"
                        onClick={() => {
                          updateSetting('zoomStart', zoomMode as any);
                          setReaderPicker(null);
                          showToast(`Zoom start set to ${zoomMode}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{zoomMode}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Tap Navigation */}
          {readerPicker === 'tapNavigation' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Tap Navigation</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Edges',
                    'Disabled',
                  ].map((tapMode) => {
                    const currentMode = settings.tapNavigation || 'Edges';
                    const isSelected = currentMode.toLowerCase() === tapMode.toLowerCase();
                    return (
                      <button
                        key={tapMode}
                        type="button"
                        onClick={() => {
                          updateSetting('tapNavigation', tapMode as any);
                          setReaderPicker(null);
                          showToast(`Tap navigation set to ${tapMode}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{tapMode}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Reader Background */}
          {readerPicker === 'readerBackground' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight">Reader Background</h3>

                {/* Options List */}
                <div className="space-y-1 px-[5px]">
                  {[
                    'Black',
                    'Dark',
                    'Light',
                  ].map((bgName) => {
                    const currentBg = settings.readerBackground || 'Black';
                    const isSelected =
                      currentBg.toLowerCase() === bgName.toLowerCase() ||
                      (bgName === 'Dark' && currentBg === 'Dark Gray') ||
                      (bgName === 'Light' && currentBg === 'White');
                    return (
                      <button
                        key={bgName}
                        type="button"
                        onClick={() => {
                          updateSetting('readerBackground', bgName as any);
                          setReaderPicker(null);
                          showToast(`Reader background set to ${bgName}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{bgName}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Picker for Preload Pages */}
          {readerPicker === 'preloadPages' && (
            <div
              className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
              onClick={() => setReaderPicker(null)}
            >
              <div
                className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Preload Pages</h3>

                {/* Options List */}
                <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
                  {Array.from({ length: 21 }, (_, i) => i).map((pageCount) => {
                    const currentCount = settings.preloadPages ?? 2;
                    const isSelected = Number(currentCount) === pageCount;
                    return (
                      <button
                        key={pageCount}
                        type="button"
                        onClick={() => {
                          updateSetting('preloadPages', pageCount);
                          setReaderPicker(null);
                          showToast(`Preload pages set to ${pageCount}`);
                        }}
                        className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#a855f7] font-bold'
                            : 'text-white font-medium hover:text-white/80'
                        }`}
                      >
                        <span>{pageCount}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Close Button at bottom right */}
                <div className="flex justify-end pt-2 shrink-0 px-[5px]">
                  <button
                    type="button"
                    onClick={() => setReaderPicker(null)}
                    className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= FULL SCREEN DOWNLOADS SHEET (Exact pixel-accurate reproduction of Screenshot_20260903_235720_Anify.jpg) ================= */}
      {settingsSubPage === 'downloads' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black flex flex-col overflow-y-auto animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-5 sm:px-6">
            {/* Top Bar: Clean ArrowLeft & "Downloads" Header */}
            <div className="flex items-center gap-5 pt-8 pb-7">
              <button
                onClick={() => setSettingsSubPage(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-[22px] sm:text-[24px] font-bold text-white tracking-normal">
                Downloads
              </h1>
            </div>

            {/* List of options matching Screenshot_20260904_071937_Anify.jpg and Screenshot_20260904_072829_Anify.jpg */}
            {(() => {
              const isCustomFolderConnected = Boolean(
                settings.downloadPermissionGranted &&
                settings.downloadPath &&
                settings.downloadPath !== 'Downloads/Anify/Downloaded'
              );

              return (
                <div className="flex flex-col space-y-7 pt-1">
                  {/* Option 1: Download Path */}
                  <div
                    onClick={handleOpenNativeStorageManager}
                    className="cursor-pointer group py-1.5 transition-colors"
                  >
                    <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                      Download Path
                    </h2>
                    <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight">
                      {isCustomFolderConnected
                        ? (settings.downloadPath.startsWith('Internal storage/')
                            ? settings.downloadPath
                            : `Internal storage/${settings.downloadPath}`)
                        : 'Downloads/Anify/Downloaded'}
                    </p>
                  </div>

                  {/* Option 2: App Private Storage (Shown ONLY when a custom folder is connected) */}
                  {isCustomFolderConnected && (
                    <div
                      onClick={() => {
                        updateSetting('downloadPath', 'Downloads/Anify/Downloaded');
                        updateSetting('downloadUri', undefined);
                        updateSetting('downloadPermissionGranted', false);
                        safeRemoveItem('satori_saf_persistable_uri');
                        safeRemoveItem('satori_saf_persistable_timestamp');
                        showToast('Download path reset to App Private Storage');
                      }}
                      className="cursor-pointer group py-1.5 transition-colors"
                    >
                      <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                        App Private Storage
                      </h2>
                      <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight">
                        Reset download path
                      </p>
                    </div>
                  )}

                  {/* Option 3: Delete Files By Default toggle */}
                  <div
                    onClick={() => {
                      updateSetting('deleteFilesByDefault', !settings.deleteFilesByDefault);
                    }}
                    style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
                    className="flex items-center justify-between cursor-pointer select-none py-1.5 px-2 -mx-2 rounded-xl"
                  >
                    <div className="pr-4 select-none">
                      <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                        Delete Files By Default
                      </h2>
                      <p className="text-[13.5px] text-white/60 mt-1 font-normal tracking-tight">
                        Preselect file deletion when removing downloads
                      </p>
                    </div>

                    {/* Toggle switch identical to other setting toggles */}
                    <AppToggleSwitch
                      checked={settings.deleteFilesByDefault}
                      onChange={(next) => {
                        updateSetting('deleteFilesByDefault', next);
                      }}
                    />
                  </div>

                  {/* Hidden native input triggering the user's real OS File/Storage Manager */}
                  <input
                    type="file"
                    ref={folderPickerInputRef}
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        const firstFile = files[0];
                        const relativePath = (firstFile as any).webkitRelativePath || '';
                        const folderName = relativePath.split('/')[0] || firstFile.name || 'Selected Folder';
                        const formatted = folderName.startsWith('Internal storage/')
                          ? folderName
                          : `Internal storage/${folderName}`;
                        updateSetting('downloadPath', formatted);
                        updateSetting(
                          'downloadUri',
                          `content://com.android.externalstorage.documents/tree/primary%3A${encodeURIComponent(folderName)}`
                        );
                        updateSetting('downloadPermissionGranted', true);
                        showToast(`Download path set: ${formatted}`);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================= FULL SCREEN BOTTOM SHEET: SUBSCRIPTION (Exact replica of Screenshot_20260905_184148_Anify.jpg and Screenshot_20260905_184212_Anify.jpg) ================= */}
      {activeModal === 'subscription' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-4 sm:px-6 pb-12">
            {/* Top Bar: Back Arrow & Subscription */}
            <div className="flex items-center gap-5 pt-8 pb-5">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.3]" />
              </button>
              <h1 className="text-[21px] sm:text-[23px] font-bold text-white tracking-tight">
                Subscription
              </h1>
            </div>

            {/* Top Purple Banner */}
            <div className="bg-[#28153e] rounded-[22px] p-5 mb-5 text-white">
              <h2 className="text-[19px] sm:text-[20px] font-bold tracking-tight mb-1">
                Subscription
              </h2>
              <p className="text-[13px] text-white/80 font-normal">
                Cancel anytime in Google Play.
              </p>
              <p className="text-[14px] font-semibold text-white/95 mt-0.5">
                {subscriptionTab === 'anime'
                  ? 'No active anime subscription.'
                  : 'No active manga and novel subscription.'}
              </p>
            </div>

            {/* Tabs: Anime | Manga & Novels */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSubscriptionTab('anime')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
                  subscriptionTab === 'anime'
                    ? 'bg-[#351854] text-[#cf8aff] border border-[#a259ff]/30 font-semibold'
                    : 'bg-transparent text-white/60 hover:text-white'
                }`}
              >
                Anime
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionTab('manga_novels')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
                  subscriptionTab === 'manga_novels'
                    ? 'bg-[#351854] text-[#cf8aff] border border-[#a259ff]/30 font-semibold'
                    : 'bg-transparent text-white/60 hover:text-white'
                }`}
              >
                Manga & Novels
              </button>
            </div>

            {/* Plan Cards Container */}
            <div className="flex flex-col space-y-4">
              {subscriptionTab === 'anime' ? (
                /* === ANIME TAB PLANS === */
                <>
                  {/* Plan 1: Lite Anime */}
                  <div className="bg-[#0e0e13] border border-white/[0.09] rounded-[20px] p-5 flex flex-col space-y-3.5 shadow-lg">
                    <div>
                      <h3 className="text-[14px] font-bold text-white tracking-tight">Lite Anime</h3>
                      <div className="text-[26px] font-extrabold text-white tracking-tight mt-0.5">
                        $2.99<span className="text-[15px] font-medium text-white/70">/mo</span>
                      </div>
                      <p className="text-[12px] text-white/50 font-normal mt-0.5">
                        Auto-renews monthly. Cancel anytime.
                      </p>
                    </div>

                    <p className="text-[13.5px] font-bold text-white leading-snug">
                      Ad-free anime playback for everyday watching.
                    </p>

                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Ad-free anime streaming</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/40">
                        <X className="w-4 h-4 text-white/30 shrink-0 stroke-[2]" />
                        <span>Picture-in-Picture mode</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/40">
                        <X className="w-4 h-4 text-white/30 shrink-0 stroke-[2]" />
                        <span>Anime downloads</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast('Redirecting to Google Play subscription...')}
                      className="w-full py-3 rounded-full bg-[#1c1c24] hover:bg-[#252530] active:scale-[0.99] text-white/60 hover:text-white font-semibold text-[13.5px] transition-all cursor-pointer mt-1"
                    >
                      Choose Lite Anime
                    </button>
                  </div>

                  {/* Plan 2: Pro Anime */}
                  <div className="bg-[#0e0e13] border border-white/[0.09] rounded-[20px] p-5 flex flex-col space-y-3.5 shadow-lg">
                    <div>
                      <h3 className="text-[14px] font-bold text-white tracking-tight">Pro Anime</h3>
                      <div className="text-[26px] font-extrabold text-white tracking-tight mt-0.5">
                        $4.99<span className="text-[15px] font-medium text-white/70">/mo</span>
                      </div>
                      <p className="text-[12px] text-white/50 font-normal mt-0.5">
                        Auto-renews monthly. Cancel anytime.
                      </p>
                    </div>

                    <p className="text-[13.5px] font-bold text-white leading-snug">
                      Ad-free anime playback, Picture-in-Picture mode, and anime downloads.
                    </p>

                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Ad-free anime streaming</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Picture-in-Picture mode</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Anime downloads</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast('Redirecting to Google Play subscription...')}
                      className="w-full py-3 rounded-full bg-[#1c1c24] hover:bg-[#252530] active:scale-[0.99] text-white/60 hover:text-white font-semibold text-[13.5px] transition-all cursor-pointer mt-1"
                    >
                      Go Pro Anime
                    </button>
                  </div>

                  {/* Plan 3: Pro Annual Anime */}
                  <div className="bg-[#0e0e13] border border-white/[0.09] rounded-[20px] p-5 flex flex-col space-y-3.5 shadow-lg">
                    <div>
                      <div className="inline-block px-3 py-1 rounded-[8px] bg-white/[0.07] border border-white/10 text-[11.5px] font-semibold text-white/70 mb-2">
                        Best value
                      </div>
                      <h3 className="text-[14px] font-bold text-white tracking-tight">
                        Pro Annual Anime
                      </h3>
                      <div className="text-[26px] font-extrabold text-white tracking-tight mt-0.5">
                        $3.99<span className="text-[15px] font-medium text-white/70">/mo</span>
                      </div>
                      <p className="text-[12px] text-white/50 font-normal mt-0.5">
                        Billed once per year and renews annually.
                      </p>
                      <p className="text-[12.5px] font-bold text-[#bd85f8] mt-1">
                        Save 20%% vs Pro Monthly
                      </p>
                    </div>

                    <p className="text-[13.5px] font-bold text-white leading-snug">
                      All Pro anime perks with the lowest monthly equivalent.
                    </p>

                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Ad-free anime streaming</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Picture-in-Picture mode</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Anime downloads</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast('Redirecting to Google Play subscription...')}
                      className="w-full py-3 rounded-full bg-[#1c1c24] hover:bg-[#252530] active:scale-[0.99] text-white/60 hover:text-white font-semibold text-[13.5px] transition-all cursor-pointer mt-1"
                    >
                      Go Pro Annual Anime
                    </button>
                  </div>
                </>
              ) : (
                /* === MANGA & NOVELS TAB PLANS === */
                <>
                  {/* Plan 1: Lite Manga & Novels */}
                  <div className="bg-[#0e0e13] border border-white/[0.09] rounded-[20px] p-5 flex flex-col space-y-3.5 shadow-lg">
                    <div>
                      <h3 className="text-[14px] font-bold text-white tracking-tight">
                        Lite Manga & Novels
                      </h3>
                      <div className="text-[26px] font-extrabold text-white tracking-tight mt-0.5">
                        $2.99<span className="text-[15px] font-medium text-white/70">/mo</span>
                      </div>
                      <p className="text-[12px] text-white/50 font-normal mt-0.5">
                        Auto-renews monthly. Cancel anytime.
                      </p>
                    </div>

                    <p className="text-[13.5px] font-bold text-white leading-snug">
                      Ad-free manga and novel reading for everyday sessions.
                    </p>

                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Ad-free manga and novel reading</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/40">
                        <X className="w-4 h-4 text-white/30 shrink-0 stroke-[2]" />
                        <span>Manga and novel downloads</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast('Redirecting to Google Play subscription...')}
                      className="w-full py-3 rounded-full bg-[#1c1c24] hover:bg-[#252530] active:scale-[0.99] text-white/60 hover:text-white font-semibold text-[13.5px] transition-all cursor-pointer mt-1"
                    >
                      Choose Lite Manga & Novels
                    </button>
                  </div>

                  {/* Plan 2: Pro Manga & Novels */}
                  <div className="bg-[#0e0e13] border border-white/[0.09] rounded-[20px] p-5 flex flex-col space-y-3.5 shadow-lg">
                    <div>
                      <h3 className="text-[14px] font-bold text-white tracking-tight">
                        Pro Manga & Novels
                      </h3>
                      <div className="text-[26px] font-extrabold text-white tracking-tight mt-0.5">
                        $4.99<span className="text-[15px] font-medium text-white/70">/mo</span>
                      </div>
                      <p className="text-[12px] text-white/50 font-normal mt-0.5">
                        Auto-renews monthly. Cancel anytime.
                      </p>
                    </div>

                    <p className="text-[13.5px] font-bold text-white leading-snug">
                      Ad-free manga and novel reading with downloads for both.
                    </p>

                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Ad-free manga and novel reading</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Manga and novel downloads</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast('Redirecting to Google Play subscription...')}
                      className="w-full py-3 rounded-full bg-[#1c1c24] hover:bg-[#252530] active:scale-[0.99] text-white/60 hover:text-white font-semibold text-[13.5px] transition-all cursor-pointer mt-1"
                    >
                      Go Pro Manga & Novels
                    </button>
                  </div>

                  {/* Plan 3: Pro Annual Manga & Novels */}
                  <div className="bg-[#0e0e13] border border-white/[0.09] rounded-[20px] p-5 flex flex-col space-y-3.5 shadow-lg">
                    <div>
                      <div className="inline-block px-3 py-1 rounded-[8px] bg-white/[0.07] border border-white/10 text-[11.5px] font-semibold text-white/70 mb-2">
                        Best value
                      </div>
                      <h3 className="text-[14px] font-bold text-white tracking-tight">
                        Pro Annual Manga & Novels
                      </h3>
                      <div className="text-[26px] font-extrabold text-white tracking-tight mt-0.5">
                        $3.99<span className="text-[15px] font-medium text-white/70">/mo</span>
                      </div>
                      <p className="text-[12px] text-white/50 font-normal mt-0.5">
                        Billed once per year and renews annually.
                      </p>
                      <p className="text-[12.5px] font-bold text-[#bd85f8] mt-1">
                        Save 20%% vs Pro Monthly
                      </p>
                    </div>

                    <p className="text-[13.5px] font-bold text-white leading-snug">
                      All Pro manga and novel perks with the lowest monthly equivalent.
                    </p>

                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Ad-free manga and novel reading</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-white/90">
                        <div className="w-4 h-4 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span>Manga and novel downloads</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast('Redirecting to Google Play subscription...')}
                      className="w-full py-3 rounded-full bg-[#1c1c24] hover:bg-[#252530] active:scale-[0.99] text-white/60 hover:text-white font-semibold text-[13.5px] transition-all cursor-pointer mt-1"
                    >
                      Go Pro Annual Manga & Novels
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Actions: Restore & Manage in Play */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => showToast('Checking Google Play purchase receipts...')}
                className="py-3.5 rounded-full bg-[#101015] border border-white/20 hover:border-white/40 active:scale-[0.98] text-white font-bold text-[14px] transition-all cursor-pointer text-center"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => showToast('Opening Google Play Subscriptions...')}
                className="py-3.5 rounded-full bg-[#101015] border border-white/20 hover:border-white/40 active:scale-[0.98] text-white font-bold text-[14px] transition-all cursor-pointer text-center"
              >
                Manage in Play
              </button>
            </div>

            {/* Bottom Disclaimer */}
            <p className="text-[11.5px] text-white/50 text-left leading-relaxed mt-4">
              Subscriptions auto-renew unless canceled at least 24 hours before renewal. Manage or cancel anytime in Google Play.
            </p>
          </div>
        </div>
      )}


      {/* ================= FULL SCREEN BOTTOM SHEET: REPORT TO DEV (Exact replica of Screenshot_20260905_183812_Anify.jpg) ================= */}
      {activeModal === 'report' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-4 sm:px-6 pb-12">
            {/* Top Bar: Back Arrow & Title */}
            <div className="flex items-center gap-5 pt-8 pb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setShowReportTypePicker(false);
                  setShowIssueTypePicker(false);
                }}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.3]" />
              </button>
              <h1 className="text-[21px] sm:text-[23px] font-bold text-white tracking-tight">
                Report to Dev
              </h1>
            </div>

            {/* Container 1: Report Type & Issue Type */}
            <div className="bg-[#101014] border border-white/[0.08] rounded-[18px] divide-y divide-white/[0.08] shadow-lg mb-5 overflow-hidden">
              {/* Row 1: Report Type */}
              <button
                type="button"
                onClick={() => {
                  setShowIssueTypePicker(false);
                  setShowReportTypePicker(!showReportTypePicker);
                }}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <div className="space-y-0.5">
                  <h2 className="text-[15px] font-bold text-white tracking-tight">Report Type</h2>
                  <p className="text-[13px] text-white/70 font-medium">{reportType}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#a259ff] stroke-[2.5]" />
              </button>

              {/* Row 2: Issue Type */}
              <button
                type="button"
                onClick={() => {
                  setShowReportTypePicker(false);
                  setShowIssueTypePicker(!showIssueTypePicker);
                }}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <div className="space-y-0.5">
                  <h2 className="text-[15px] font-bold text-white tracking-tight">Issue Type</h2>
                  <p
                    className={`text-[13px] font-medium ${
                      issueType === 'Choose an issue' ? 'text-white/50' : 'text-[#bd85f8]'
                    }`}
                  >
                    {issueType}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#a259ff] stroke-[2.5]" />
              </button>
            </div>

            {/* Report Type Picker Dropdown Modal / Sheet */}
            {showReportTypePicker && (
              <div className="bg-[#15151c] border border-white/10 rounded-[18px] p-2 mb-4 space-y-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-bold text-white/50 uppercase tracking-wider">
                  Select Report Type
                </div>
                {['Anime', 'Manga', 'Novel', 'Application'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setReportType(type);
                      setShowReportTypePicker(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-left text-[14px] font-medium transition-colors flex items-center justify-between cursor-pointer ${
                      reportType === type
                        ? 'bg-[#8c52ff]/20 text-purple-300 font-bold'
                        : 'text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span>{type}</span>
                    {reportType === type && <Check className="w-4 h-4 text-[#bd85f8]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Issue Type Picker Dropdown Modal / Sheet */}
            {showIssueTypePicker && (
              <div className="bg-[#15151c] border border-white/10 rounded-[18px] p-2 mb-4 space-y-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[260px] overflow-y-auto">
                <div className="px-3 py-2 text-[11px] font-bold text-white/50 uppercase tracking-wider">
                  Select Issue
                </div>
                {[
                  'Playback Buffering / Loading error',
                  'Missing Episode / Chapter',
                  'Broken Video Stream or Mirror',
                  'Subtitles Out of Sync / Missing',
                  'Audio Track Mismatch / Missing Dub',
                  'Incorrect Metadata / Thumbnail',
                  'Page Load or Reader glitch',
                  'App Crash / UI bug',
                  'Other feedback',
                ].map((iss) => (
                  <button
                    key={iss}
                    type="button"
                    onClick={() => {
                      setIssueType(iss);
                      setShowIssueTypePicker(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-left text-[13.5px] font-medium transition-colors flex items-center justify-between cursor-pointer ${
                      issueType === iss
                        ? 'bg-[#8c52ff]/20 text-purple-300 font-bold'
                        : 'text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span>{iss}</span>
                    {issueType === iss && <Check className="w-4 h-4 text-[#bd85f8]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Section: Affected Anime */}
            <div className="space-y-3.5">
              <h3 className="text-[15px] sm:text-[16px] font-bold text-white tracking-tight">
                Affected {reportType === 'Manga' ? 'Manga' : reportType === 'Novel' ? 'Novel' : 'Anime'}
              </h3>

              {/* Search Anime Field */}
              <div className="border border-white/20 rounded-[14px] px-4 py-3 sm:py-3.5 flex items-center gap-3 bg-transparent focus-within:border-white/50 transition-colors">
                <Search className="w-5 h-5 text-white/60 shrink-0" />
                <input
                  type="text"
                  value={affectedAnime}
                  onChange={(e) => setAffectedAnime(e.target.value)}
                  placeholder={`Search ${
                    reportType === 'Manga' ? 'Manga' : reportType === 'Novel' ? 'Novel' : 'Anime'
                  }`}
                  className="w-full bg-transparent text-[14.5px] text-white placeholder:text-white/60 outline-none font-medium"
                />
              </div>

              {/* Episode Field */}
              <div className="border border-white/20 rounded-[14px] px-4 py-3 sm:py-3.5 flex items-center bg-transparent focus-within:border-white/50 transition-colors">
                <input
                  type="text"
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(e.target.value)}
                  placeholder={
                    reportType === 'Manga' || reportType === 'Novel' ? 'Chapter' : 'Episode'
                  }
                  className="w-full bg-transparent text-[14.5px] text-white placeholder:text-white/60 outline-none font-medium"
                />
              </div>

              {/* Details Field */}
              <div className="border border-white/20 rounded-[14px] p-4 bg-transparent focus-within:border-white/50 transition-colors min-h-[160px]">
                <textarea
                  rows={5}
                  value={reportDetails}
                  onChange={(e) => {
                    if (e.target.value.length <= 4000) {
                      setReportDetails(e.target.value);
                    }
                  }}
                  placeholder="Details"
                  className="w-full bg-transparent text-[14.5px] text-white placeholder:text-white/60 outline-none resize-none font-medium min-h-[125px]"
                />
              </div>

              {/* Character counter right under Details box */}
              <div className="text-[13px] font-normal text-white/60 pl-0.5 -mt-1">
                {reportDetails.length} / 4000
              </div>

              {/* Note text */}
              <p className="text-[13px] text-white/60 leading-normal pt-1">
                App version and device details are attached automatically.
              </p>

              {/* Submit Report button */}
              <button
                type="button"
                onClick={() => {
                  if (!reportDetails.trim() && issueType === 'Choose an issue' && !affectedAnime.trim()) {
                    showToast('Please provide details or select an issue.');
                    return;
                  }
                  showToast('Report submitted successfully! Thank you.');
                  setTimeout(() => {
                    setActiveModal(null);
                    setReportDetails('');
                    setAffectedAnime('');
                    setEpisodeNumber('');
                    setIssueType('Choose an issue');
                  }, 1200);
                }}
                className="w-full py-3.5 sm:py-4 rounded-[16px] bg-[#9d4edd] hover:bg-[#8e3ee0] active:scale-[0.99] text-white font-bold text-[15px] tracking-wide transition-all shadow-lg cursor-pointer mt-3"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FULL SCREEN BOTTOM SHEET: FAQS (Exact replica of Screenshot_20260905_182920_Anify.jpg) ================= */}
      {activeModal === 'faqs' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-4 sm:px-6 pb-12">
            {/* Top Bar: Back Arrow & FAQs */}
            <div className="flex items-center gap-5 pt-8 pb-6">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.3]" />
              </button>
              <h1 className="text-[21px] sm:text-[23px] font-bold text-white tracking-tight">
                FAQs
              </h1>
            </div>

            {/* List of 10 Cards with 01..10 Purple Pill Badges */}
            <div className="flex flex-col space-y-3 pt-1">
              {faqsList.map((item, idx) => {
                const isOpen = expandedFaq === idx;
                const paddedIndex = String(idx + 1).padStart(2, '0');
                return (
                  <div
                    key={idx}
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="bg-[#101014] border border-white/[0.08] rounded-[18px] p-3.5 sm:p-4 shadow-lg transition-all cursor-pointer hover:border-white/15"
                  >
                    <div className="flex items-center gap-3.5 justify-between">
                      {/* Purple Index Pill */}
                      <div className="w-8 h-8 rounded-xl bg-[#261539] border border-[#8c52ff]/25 text-[#bd85f8] flex items-center justify-center text-[12.5px] font-extrabold shrink-0">
                        {paddedIndex}
                      </div>
                      {/* Question Title */}
                      <h3 className="text-[14px] sm:text-[14.5px] font-bold text-white tracking-tight leading-snug flex-1">
                        {item.q}
                      </h3>
                      {/* Right Chevron */}
                      <ChevronRight
                        className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-90 text-purple-400' : ''
                        }`}
                      />
                    </div>
                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-white/[0.08] text-[13px] sm:text-[13.5px] text-white/70 leading-[1.6] pl-[44px]">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= FULL SCREEN BOTTOM SHEET: MANAGE INVITE KEY (Exact replica of Screenshot_20260905_182649_Anify.jpg) ================= */}
      {activeModal === 'inviteKey' && (
        <div className="fixed inset-0 z-[6000] w-full h-full bg-black text-white flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none">
          <div className="w-full max-w-xl mx-auto flex flex-col flex-1 px-4 sm:px-6">
            {/* Top Bar: Back Arrow & Manage Invite Key */}
            <div className="flex items-center gap-5 pt-8 pb-6">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer p-1 -ml-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.3]" />
              </button>
              <h1 className="text-[21px] sm:text-[23px] font-bold text-white tracking-tight">
                Manage Invite Key
              </h1>
            </div>

            {/* Main Cards List matching Screenshot */}
            <div className="flex flex-col space-y-3.5 pt-1">
              {/* Card 1: Invite Key status */}
              <div className="bg-[#101014] border border-white/[0.08] rounded-[18px] p-4 sm:p-5 space-y-2 shadow-lg">
                <h2 className="text-[15px] font-bold text-white tracking-tight">
                  Invite Key
                </h2>
                <div className="flex items-center gap-2.5 text-[14px] text-white/95 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff7675] shrink-0" />
                  <span>Not eligible to generate a key</span>
                </div>
              </div>

              {/* Card 2: ONLY INVITE PEOPLE YOU TRUST */}
              <div className="bg-[#101014] border border-white/[0.08] rounded-[18px] p-4 sm:p-5 space-y-3 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#8c52ff] flex items-center justify-center shrink-0">
                    <span className="text-white text-[12px] font-black italic select-none">i</span>
                  </div>
                  <span className="text-[13.5px] sm:text-[14px] font-bold text-white tracking-wide uppercase">
                    ONLY INVITE PEOPLE YOU TRUST
                  </span>
                </div>
                <p className="text-[13px] sm:text-[13.5px] text-white/70 leading-[1.6] font-normal">
                  If someone you directly invite is suspended or banned, the same penalty is automatically applied to your account. It affects only the direct inviter, does not continue to another inviter, and cannot be reversed once applied.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Subcomponents for Settings
const SettingCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-4 bg-[#121218] rounded-2xl border border-white/10 space-y-2.5">
    <label className="text-xs font-bold text-white/70 uppercase tracking-wider block">{title}</label>
    {children}
  </div>
);

const SettingToggle: React.FC<{
  title: string;
  desc: string;
  value: boolean;
  onChange: (val: boolean) => void;
}> = ({ title, desc, value, onChange }) => (
  <div
    onClick={() => onChange(!value)}
    className="flex items-center justify-between p-4 bg-[#121218] rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-all"
  >
    <div className="flex-1 pr-4">
      <h4 className="text-xs sm:text-sm font-bold text-white">{title}</h4>
      <p className="text-[11px] text-white/50 mt-0.5">{desc}</p>
    </div>
    <AppToggleSwitch checked={value} onChange={onChange} />
  </div>
);

const SettingSlider: React.FC<{
  title: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}> = ({ title, value, unit, min, max, step, onChange }) => (
  <div className="p-4 bg-[#121218] rounded-2xl border border-white/10 space-y-2">
    <div className="flex justify-between items-center text-xs font-bold">
      <span className="text-white/70 uppercase">{title}</span>
      <span className="text-purple-400 font-mono font-extrabold">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
    />
  </div>
);

const DiscreteDotSlider: React.FC<{
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  steps?: number;
  accentColorHex?: string;
  onChange: (val: number) => void;
}> = ({
  label,
  sublabel,
  value,
  min,
  max,
  steps = 16,
  accentColorHex = '#a755f7',
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureRef = useRef<'undecided' | 'scrolling' | 'sliding' | null>(null);
  const isMouseDownRef = useRef(false);

  const safeValue = Math.min(max, Math.max(min, value));
  const ratio = max > min ? (safeValue - min) / (max - min) : 0;
  const activeIndex = Math.min(steps - 1, Math.max(0, Math.round(ratio * (steps - 1))));
  const stepRatio = steps > 1 ? activeIndex / (steps - 1) : 0;
  const currentIndicatorPosition = `calc(10px + (100% - 20px) * ${stepRatio})`;

  const getValueFromX = (clientX: number) => {
    if (!trackRef.current) return safeValue;
    const rect = trackRef.current.getBoundingClientRect();
    const innerWidth = Math.max(1, rect.width - 20);
    const relativeX = clientX - rect.left - 10;
    const clampedRatio = Math.max(0, Math.min(1, relativeX / innerWidth));
    const targetIndex = Math.round(clampedRatio * (steps - 1));
    const stepVal = (max - min) / (steps - 1);
    const rawVal = min + targetIndex * stepVal;
    return Math.min(max, Math.max(min, Math.round(rawVal)));
  };

  const handleUpdate = (clientX: number) => {
    const newVal = getValueFromX(clientX);
    if (newVal !== safeValue) {
      onChange(newVal);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    handleUpdate(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      handleUpdate(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    gestureRef.current = 'undecided';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    if (gestureRef.current === 'scrolling') return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = Math.abs(currentX - touchStartRef.current.x);
    const dy = Math.abs(currentY - touchStartRef.current.y);

    if (gestureRef.current === 'undecided') {
      if (dy > dx && dy > 7) {
        gestureRef.current = 'scrolling';
        return;
      } else if (dx > dy && dx > 7) {
        gestureRef.current = 'sliding';
      } else {
        return;
      }
    }

    if (gestureRef.current === 'sliding') {
      handleUpdate(currentX);
    }
  };

  const handleTouchEnd = () => {
    if (gestureRef.current === 'undecided' && touchStartRef.current) {
      handleUpdate(touchStartRef.current.x);
    }
    touchStartRef.current = null;
    gestureRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const stepVal = (max - min) / (steps - 1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, safeValue + stepVal));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(min, safeValue - stepVal));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div className="space-y-1 select-none py-1">
      <div>
        <div className="text-[15px] font-bold text-white tracking-tight leading-tight">{label}</div>
        <div className="text-[13px] text-white/60 font-normal mt-0.5 leading-snug">{sublabel}</div>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeValue}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onKeyDown={handleKeyDown}
        className="relative flex items-center w-full h-12 sm:h-14 select-none mx-0 group touch-pan-y cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-lg"
      >
        {/* 1. Left Progressed Solid Bar (rounded-l-full on outer left, rounded-r-[3.5px] with 6px gap before vertical line) */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 rounded-l-full rounded-r-[3.5px] overflow-hidden flex items-center z-[2]"
          style={{
            backgroundColor: accentColorHex,
            width: activeIndex > 0 ? `calc(${currentIndicatorPosition} - 6px)` : '0px',
            display: activeIndex > 0 ? 'block' : 'none',
          }}
        />

        {/* 2. Right Unfilled Dark Track (rounded-l-[3.5px] with 6px gap after vertical line, rounded-r-full on outer right) */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 bg-[#181826] rounded-l-[3.5px] rounded-r-full overflow-hidden flex items-center shadow-inner z-[2]"
          style={{
            left: activeIndex < steps - 1 ? `calc(${currentIndicatorPosition} + 6px)` : '100%',
            display: activeIndex < steps - 1 ? 'block' : 'none',
          }}
        />

        {/* 3. Stationary Dots Across the Entire Track */}
        <div className="absolute inset-0 pointer-events-none z-[4]">
          {Array.from({ length: steps }).map((_, i) => {
            const isCurrent = i === activeIndex;
            const isPassed = i < activeIndex;
            const dotPos = steps > 1 ? `calc(10px + (100% - 20px) * ${i / (steps - 1)})` : '50%';

            return (
              <div
                key={i}
                style={{
                  left: dotPos,
                  ...(isCurrent
                    ? {}
                    : isPassed
                    ? {}
                    : { backgroundColor: accentColorHex }),
                }}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full shrink-0 transition-opacity duration-75 ${
                  isCurrent
                    ? 'opacity-0 scale-0 pointer-events-none'
                    : isPassed
                    ? 'bg-[#172029] opacity-100'
                    : 'opacity-100'
                } ${
                  steps > 25
                    ? 'w-[2.5px] h-[2.5px]'
                    : 'w-[3.5px] h-[3.5px] sm:w-[4px] sm:h-[4px]'
                }`}
              />
            );
          })}
        </div>

        {/* 4. Vertical Indicator Line | (Taller prominent rounded pill with 6px left & right gaps matching Manga Reader) */}
        <div
          className="absolute top-1/2 pointer-events-none z-10"
          style={{
            left: currentIndicatorPosition,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="w-[3.5px] sm:w-[4px] h-[46px] sm:h-[50px] rounded-full shadow-none"
            style={{ backgroundColor: accentColorHex }}
          />
        </div>
      </div>
    </div>
  );
};

type RatingDecimalOption =
  | 'Whole Numbers'
  | '1 Decimal Place'
  | '2 Decimal Places'
  | '3 Decimal Places';

const getScoreForFormat = (
  scale: '10-Point' | '100-Point' | '5-Point' | '3-Point',
  decimal: RatingDecimalOption
) => {
  if (scale === '10-Point') {
    if (decimal === 'Whole Numbers') return '8';
    if (decimal === '1 Decimal Place') return '8.0';
    if (decimal === '2 Decimal Places') return '8.00';
    return '8.000';
  }
  if (scale === '100-Point') {
    if (decimal === 'Whole Numbers') return '80';
    if (decimal === '1 Decimal Place') return '80.0';
    if (decimal === '2 Decimal Places') return '80.00';
    return '80.000';
  }
  if (scale === '5-Point') {
    if (decimal === 'Whole Numbers') return '4';
    if (decimal === '1 Decimal Place') return '4.0';
    if (decimal === '2 Decimal Places') return '4.00';
    return '4.000';
  }
  // 3-Point
  if (decimal === 'Whole Numbers') return '2';
  if (decimal === '1 Decimal Place') return '2.4';
  if (decimal === '2 Decimal Places') return '2.40';
  return '2.400';
};

const RatingFormatPickerModal: React.FC<{
  currentFormat: string;
  onApply: (newFormat: string) => void;
  onClose: () => void;
}> = ({ currentFormat, onApply, onClose }) => {
  const initialScale = currentFormat.includes('100-Point')
    ? '100-Point'
    : currentFormat.includes('5-Point') || currentFormat.includes('5-Star')
    ? '5-Point'
    : currentFormat.includes('3-Point')
    ? '3-Point'
    : '10-Point';

  const initialDecimal: RatingDecimalOption = currentFormat.includes('Whole')
    ? 'Whole Numbers'
    : currentFormat.includes('3 Decimal')
    ? '3 Decimal Places'
    : currentFormat.includes('2 Decimal')
    ? '2 Decimal Places'
    : '1 Decimal Place';

  const [selectedScale, setSelectedScale] = useState<'10-Point' | '100-Point' | '5-Point' | '3-Point'>(initialScale);
  const [selectedDecimal, setSelectedDecimal] = useState<RatingDecimalOption>(initialDecimal);

  const previewScore = getScoreForFormat(selectedScale, selectedDecimal);
  const previewDesc =
    selectedScale === '10-Point'
      ? 'An 8 out of 10 score will appear like this'
      : selectedScale === '100-Point'
      ? 'An 80 out of 100 score will appear like this'
      : selectedScale === '5-Point'
      ? 'A 4 out of 5 score will appear like this'
      : 'A 2.4 out of 3 score will appear like this';

  const scaleOptions = [
    { id: '10-Point', label: '10-Point' },
    { id: '100-Point', label: '100-Point' },
    { id: '5-Point', label: '5-Point' },
    { id: '3-Point', label: '3-Point' },
  ];

  const decimalOptions: RatingDecimalOption[] = [
    'Whole Numbers',
    '1 Decimal Place',
    '2 Decimal Places',
    '3 Decimal Places',
  ];

  return (
    <div
      className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[432px] sm:max-w-[482px] max-h-[85vh] h-[530px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl flex flex-col select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h3 className="text-xl font-bold text-white tracking-tight shrink-0 mb-3">Rating Format</h3>

        {/* Scrollable Options List - preserves card size unchanged */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Preview Container */}
          <div className="bg-[#11171f] rounded-2xl p-4 space-y-1 mx-[5px]">
            <span className="text-xs font-semibold text-white/50 block">Preview</span>
            <span className="text-3xl font-extrabold text-white tracking-tight block">
              {previewScore}
            </span>
            <span className="text-[12.5px] text-white/60 font-normal block leading-tight">
              {previewDesc}
            </span>
          </div>

          {/* Scale Section */}
          <div className="px-[5px]">
            <div className="text-[13px] font-bold text-white/70 mb-1">Scale</div>
            <div className="space-y-0.5">
              {scaleOptions.map((opt) => {
                const isSelected = selectedScale === opt.id;
                const displayVal = getScoreForFormat(opt.id as any, selectedDecimal);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedScale(opt.id as any)}
                    className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'text-[#a855f7] font-bold'
                        : 'text-white font-medium hover:text-white/80'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={isSelected ? 'text-[#a855f7] font-bold' : 'text-white font-medium'}>
                        {displayVal}
                      </span>
                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 pt-2 mx-[5px]" />

          {/* Decimal Places Section */}
          <div className="px-[5px] pb-1">
            <div className="text-[13px] font-bold text-white/70 mb-1">Decimal Places</div>
            <div className="space-y-0.5">
              {decimalOptions.map((decOpt) => {
                const isSelected = selectedDecimal === decOpt;
                const displayVal = getScoreForFormat(selectedScale, decOpt);
                return (
                  <button
                    key={decOpt}
                    type="button"
                    onClick={() => setSelectedDecimal(decOpt)}
                    className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'text-[#a855f7] font-bold'
                        : 'text-white font-medium hover:text-white/80'
                    }`}
                  >
                    <span>{decOpt}</span>
                    <div className="flex items-center gap-2">
                      <span className={isSelected ? 'text-[#a855f7] font-bold' : 'text-white font-medium'}>
                        {displayVal}
                      </span>
                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons: Cancel and Apply */}
        <div className="flex items-center justify-end gap-6 pt-3 px-[5px] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-1 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const formatted = `${selectedScale} · ${selectedDecimal}`;
              onApply(formatted);
            }}
            className="text-[#a855f7] hover:text-[#c084fc] font-bold text-sm transition-colors cursor-pointer px-1 py-1"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const CapsuleDotSlider: React.FC<{
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  steps: number;
  accentColorHex?: string;
  onChange: (val: number) => void;
}> = (props) => <DiscreteDotSlider {...props} />;

export const getSubtitleFontFamily = (fontName: string): string => {
  switch (fontName) {
    case 'System':
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    case 'Netflix Sans':
      return '"Netflix Sans", "Montserrat", "Helvetica Neue", -apple-system, BlinkMacSystemFont, sans-serif';
    case 'Montserrat':
      return '"Montserrat", sans-serif';
    case 'Satoshi':
      return '"Satoshi", "Outfit", "Plus Jakarta Sans", sans-serif';
    case 'Inter':
      return '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';
    case 'Google Sans':
      return '"Google Sans", "Product Sans", "Plus Jakarta Sans", system-ui, sans-serif';
    case 'Chakra Petch':
      return '"Chakra Petch", sans-serif';
    case 'Bebas Neue':
      return '"Bebas Neue", cursive, sans-serif';
    case 'Poppins':
      return '"Poppins", sans-serif';
    case 'EB Garamond':
      return '"EB Garamond", Garamond, Georgia, serif';
    default:
      return fontName ? `"${fontName}", sans-serif` : 'sans-serif';
  }
};

export const getSubtitleTextColorHex = (name?: string): string => {
  switch (name) {
    case 'Warm Yellow':
    case 'Yellow':
      return '#ffe880';
    case 'Cyan':
      return '#80ebff';
    case 'Lime':
    case 'Green':
      return '#bbfe8a';
    case 'Rose':
      return '#fe9fbd';
    case 'White':
    default:
      return '#ffffff';
  }
};

export const getSubtitleEdgeColorHex = (name?: string): string => {
  switch (name) {
    case 'Graphite': return '#1b1e23';
    case 'White': return '#ffffff';
    case 'Semi-transparent Black': return 'rgba(0, 0, 0, 0.6)';
    case 'Dark Gray': return '#222222';
    case 'Red': return '#f44336';
    case 'Yellow': return '#ffeb3b';
    case 'Cyan': return '#00bcd4';
    case 'Blue': return '#2196f3';
    case 'Black':
    default:
      return '#000000';
  }
};

export const getSubtitleBackgroundSwatchHex = (name?: string): string => {
  switch (name) {
    case 'Transparent':
    case 'None':
      return '#414850';
    case 'Soft Scrim':
    case 'Semi-transparent Black':
    case 'Semi-transparent Dark':
      return '#0b0e13';
    case 'Solid Black':
    default:
      return '#020306';
  }
};

export const getSubtitleBackgroundHex = (name?: string): string => {
  switch (name) {
    case 'Transparent':
    case 'None':
      return 'transparent';
    case 'Soft Scrim':
    case 'Semi-transparent Black':
      return 'rgba(11, 14, 19, 0.75)';
    case 'Solid Black':
      return '#020306';
    case 'Semi-transparent Dark':
      return 'rgba(18, 26, 36, 0.8)';
    case 'Solid White':
      return '#ffffff';
    case 'Semi-transparent White':
      return 'rgba(255, 255, 255, 0.75)';
    default:
      return 'rgba(11, 14, 19, 0.75)';
  }
};

export const getSubtitleEdgeTextShadow = (style?: string, colorName?: string): string => {
  const color = getSubtitleEdgeColorHex(colorName);
  switch (style) {
    case 'None':
      return 'none';
    case 'Outline':
      return `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}`;
    case 'Raised':
      return `0 1px 2px ${color}, 0 2px 3px ${color}`;
    case 'Depressed':
      return `0 -1px 2px ${color}, 0 -2px 3px ${color}`;
    case 'Drop Shadow':
    default:
      return `0 2px 4px ${color}`;
  }
};

const SubtitleAppearanceModal: React.FC<{
  settings: any;
  updateSetting: (key: any, value: any) => void;
  showToast: (msg: string) => void;
  onClose: () => void;
}> = ({ settings, updateSetting, showToast, onClose }) => {
  const [activePicker, setActivePicker] = useState<'font' | 'textColor' | 'edgeStyle' | 'edgeColor' | 'background' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore any imported custom font on mount
  useEffect(() => {
    loadCustomFontFromStorage();
  }, []);

  const currentFont = settings.subtitleFont || 'Netflix Sans';
  const currentSize = settings.subtitleSize ?? 15;
  const currentElevation = settings.subtitleElevation ?? -10;
  const currentTextColor = settings.subtitleTextColor || 'White';
  const currentEdgeStyle = settings.subtitleEdgeStyle || 'Drop Shadow';
  const currentEdgeColor = settings.subtitleEdgeColor || 'Black';
  const currentBackground = settings.subtitleBackground || 'Soft Scrim';
  const displayBackground =
    currentBackground === 'Semi-transparent Black'
      ? 'Soft Scrim'
      : currentBackground === 'None'
      ? 'Transparent'
      : currentBackground;

  const baseFontList = [
    'Netflix Sans',
    'Montserrat',
    'Satoshi',
    'Inter',
    'Google Sans',
    'Chakra Petch',
    'Bebas Neue',
    'System',
  ];

  const fontList = useMemo(() => {
    if (currentFont && !baseFontList.some((f) => f.toLowerCase() === currentFont.toLowerCase())) {
      return [currentFont, ...baseFontList];
    }
    return baseFontList;
  }, [currentFont]);

  const textColorList = [
    'White',
    'Warm Yellow',
    'Cyan',
    'Lime',
    'Rose',
  ];

  const edgeStyleList = [
    'Outline',
    'Drop Shadow',
    'None',
  ];

  const edgeColorList = [
    'Black',
    'Graphite',
  ];

  const backgroundList = [
    'Transparent',
    'Soft Scrim',
    'Solid Black',
  ];

  const handleReset = () => {
    updateSetting('subtitleFont', 'Netflix Sans');
    updateSetting('subtitleSize', 15);
    updateSetting('subtitleElevation', -10);
    updateSetting('subtitleTextColor', 'White');
    updateSetting('subtitleEdgeStyle', 'Drop Shadow');
    updateSetting('subtitleEdgeColor', 'Black');
    updateSetting('subtitleBackground', 'Soft Scrim');
    showToast('Subtitle appearance reset to default');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      showToast('Loading font from device...');
      const result = await registerAndSaveCustomFont(file);
      if (result.success) {
        updateSetting('subtitleFont', result.fontName);
        showToast(`Imported font: ${result.fontName}`);
      } else {
        showToast(result.error || 'Failed to import font file');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Subtitle Appearance</h3>

          {/* Scrollable Container with vertically +50px increased height (530px) */}
          <div className="space-y-4 overflow-y-auto pr-1 px-[5px] max-h-[530px]">
            {/* Subtitle Live Preview Box with Night City Skyline & Stars (height: 180px) */}
            <div className="relative w-full h-[180px] rounded-[20px] overflow-hidden shadow-inner">
              <svg
                viewBox="0 0 300 150"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="skyGradSub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#121a24" />
                    <stop offset="65%" stopColor="#18222e" />
                    <stop offset="100%" stopColor="#080c10" />
                  </linearGradient>
                </defs>
                <rect width="300" height="150" fill="url(#skyGradSub)" />
                {/* Stars */}
                <circle cx="25" cy="22" r="0.9" fill="white" opacity="0.3" />
                <circle cx="58" cy="36" r="1.3" fill="white" opacity="0.55" />
                <circle cx="84" cy="18" r="0.8" fill="white" opacity="0.4" />
                <circle cx="110" cy="28" r="1.1" fill="white" opacity="0.6" />
                <circle cx="135" cy="40" r="0.8" fill="white" opacity="0.3" />
                <circle cx="165" cy="16" r="1.2" fill="white" opacity="0.5" />
                <circle cx="206" cy="32" r="0.9" fill="white" opacity="0.45" />
                <circle cx="232" cy="20" r="1.2" fill="white" opacity="0.6" />
                <circle cx="256" cy="44" r="0.8" fill="white" opacity="0.35" />
                <circle cx="280" cy="26" r="1.1" fill="white" opacity="0.5" />
                {/* Skyline silhouettes */}
                <rect x="0" y="72" width="18" height="78" fill="#090d12" opacity="0.9" />
                <rect x="20" y="62" width="16" height="88" fill="#0d141d" opacity="0.9" />
                <rect x="38" y="74" width="14" height="76" fill="#080c10" opacity="0.85" />
                <rect x="54" y="54" width="22" height="96" fill="#0d141d" opacity="0.9" />
                <rect x="78" y="66" width="18" height="84" fill="#080c10" opacity="0.85" />
                <rect x="98" y="76" width="14" height="74" fill="#090d12" opacity="0.85" />
                <rect x="114" y="60" width="20" height="90" fill="#0d141d" opacity="0.9" />
                <rect x="136" y="72" width="16" height="78" fill="#080c10" opacity="0.85" />
                <rect x="154" y="50" width="24" height="100" fill="#0d141d" opacity="0.9" />
                <rect x="180" y="64" width="18" height="86" fill="#080c10" opacity="0.85" />
                <rect x="200" y="56" width="22" height="94" fill="#0d141d" opacity="0.9" />
                <rect x="224" y="70" width="18" height="80" fill="#080c10" opacity="0.85" />
                <rect x="244" y="60" width="24" height="90" fill="#0d141d" opacity="0.9" />
                <rect x="270" y="66" width="30" height="84" fill="#090d12" opacity="0.9" />
                {/* Horizon dark base */}
                <rect x="0" y="98" width="300" height="52" fill="#040608" opacity="0.8" />
              </svg>
              <div
                className="absolute inset-x-0 z-10 px-3 text-center select-none transition-all duration-150 flex items-center justify-center pointer-events-none"
                style={{
                  bottom: `calc(1px + ${(currentElevation - (-20)) * 2}px)`,
                }}
              >
                <span
                  key={currentFont}
                  className="inline-block px-2.5 py-1 rounded transition-all duration-150 leading-snug"
                  style={{
                    fontFamily: getSubtitleFontFamily(currentFont),
                    fontSize: `${currentSize}px`,
                    color: getSubtitleTextColorHex(currentTextColor),
                    backgroundColor: getSubtitleBackgroundHex(currentBackground),
                    textShadow: getSubtitleEdgeTextShadow(currentEdgeStyle, currentEdgeColor),
                  }}
                >
                  The city lights look softer from here.
                </span>
              </div>
            </div>

            {/* Options with 2-gap increase on left and right sides */}
            <div className="space-y-4 px-2">
              {/* Font Row */}
              <div className="space-y-2 pt-0.5">
                <div
                  className="flex items-center justify-between cursor-pointer group py-0.5"
                  onClick={() => setActivePicker('font')}
                >
                  <div>
                    <div className="text-[15px] font-bold text-white tracking-tight">Font</div>
                    <div className="text-[13px] text-white/60">{currentFont}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#a855f7] stroke-[2.5]" />
                </div>

                {/* Import and Reset Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 bg-[#121922] hover:bg-[#15202c] active:scale-[0.98] text-[#a855f7] font-semibold text-sm rounded-xl transition-all cursor-pointer text-center border border-white/[0.04]"
                  >
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="py-2.5 bg-[#121922] hover:bg-[#15202c] active:scale-[0.98] text-white/90 hover:text-white font-semibold text-sm rounded-xl transition-all cursor-pointer text-center border border-white/[0.04]"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Size Slider (19 steps: 12 to 30, default 15) */}
              <div>
                <CapsuleDotSlider
                  label="Size"
                  sublabel={`${currentSize}sp in portrait`}
                  value={currentSize}
                  min={12}
                  max={30}
                  steps={19}
                  accentColorHex={ACCENT_COLOR_MAP[(settings.accentColor as AccentColorKey) || 'Purple']?.hex || '#a755f7'}
                  onChange={(val) => updateSetting('subtitleSize', val)}
                />
              </div>

              {/* Elevation Slider (51 steps: -20% to 30%, default -10%) */}
              <div>
                <CapsuleDotSlider
                  label="Elevation"
                  sublabel={`${currentElevation}% relative to the default position`}
                  value={currentElevation}
                  min={-20}
                  max={30}
                  steps={51}
                  accentColorHex={ACCENT_COLOR_MAP[(settings.accentColor as AccentColorKey) || 'Purple']?.hex || '#a755f7'}
                  onChange={(val) => updateSetting('subtitleElevation', Math.round(val))}
                />
              </div>

              {/* Option: Text Colour */}
              <div
                className="flex items-center justify-between cursor-pointer group py-0.5"
                onClick={() => setActivePicker('textColor')}
              >
                <div>
                  <div className="text-[15px] font-bold text-white tracking-tight">Text Colour</div>
                  <div className="text-[13px] text-white/60 mt-0.5">{currentTextColor}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#a855f7] stroke-[2.5]" />
              </div>

              {/* Option: Edge Style */}
              <div
                className="flex items-center justify-between cursor-pointer group py-0.5"
                onClick={() => setActivePicker('edgeStyle')}
              >
                <div>
                  <div className="text-[15px] font-bold text-white tracking-tight">Edge Style</div>
                  <div className="text-[13px] text-white/60 mt-0.5">{currentEdgeStyle}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#a855f7] stroke-[2.5]" />
              </div>

              {/* Option: Edge Colour */}
              <div
                className="flex items-center justify-between cursor-pointer group py-0.5"
                onClick={() => setActivePicker('edgeColor')}
              >
                <div>
                  <div className="text-[15px] font-bold text-white tracking-tight">Edge Colour</div>
                  <div className="text-[13px] text-white/60 mt-0.5">{currentEdgeColor}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#a855f7] stroke-[2.5]" />
              </div>

              {/* Option: Background */}
              <div
                className="flex items-center justify-between cursor-pointer group py-0.5"
                onClick={() => setActivePicker('background')}
              >
                <div>
                  <div className="text-[15px] font-bold text-white tracking-tight">Background</div>
                  <div className="text-[13px] text-white/60 mt-0.5">{displayBackground}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#a855f7] stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Close Button at bottom right */}
          <div className="flex justify-end pt-2 shrink-0 px-[5px]">
            <button
              type="button"
              onClick={onClose}
              className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Font Picker Modal with Tickmark */}
      {activePicker === 'font' && (
        <div
          className="fixed inset-0 z-[7500] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
          onClick={() => setActivePicker(null)}
        >
          <div
            className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Font</h3>
            <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
              {fontList.map((fName) => {
                const isSelected = currentFont.toLowerCase() === fName.toLowerCase();
                return (
                  <button
                    key={fName}
                    type="button"
                    onClick={() => {
                      updateSetting('subtitleFont', fName);
                      setActivePicker(null);
                      showToast(`Font set to ${fName}`);
                    }}
                    className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'text-[#a855f7] font-bold'
                        : 'text-white font-medium hover:text-white/80'
                    }`}
                  >
                    <span style={{ fontFamily: getSubtitleFontFamily(fName) }}>
                      {fName}
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 shrink-0 px-[5px]">
              <button
                type="button"
                onClick={() => setActivePicker(null)}
                className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Colour Picker Modal */}
      {activePicker === 'textColor' && (
        <div
          className="fixed inset-0 z-[7500] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
          onClick={() => setActivePicker(null)}
        >
          <div
            className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Text Colour</h3>
            <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
              {textColorList.map((colName) => {
                const isSelected = currentTextColor.toLowerCase() === colName.toLowerCase();
                return (
                  <button
                    key={colName}
                    type="button"
                    onClick={() => {
                      updateSetting('subtitleTextColor', colName);
                      setActivePicker(null);
                      showToast(`Text colour set to ${colName}`);
                    }}
                    className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'text-[#a855f7] font-bold'
                        : 'text-white font-medium hover:text-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: getSubtitleTextColorHex(colName) }}
                      />
                      <span>{colName}</span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 shrink-0 px-[5px]">
              <button
                type="button"
                onClick={() => setActivePicker(null)}
                className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edge Style Picker Modal */}
      {activePicker === 'edgeStyle' && (
        <div
          className="fixed inset-0 z-[7500] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
          onClick={() => setActivePicker(null)}
        >
          <div
            className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Edge Style</h3>
            <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
              {edgeStyleList.map((stName) => {
                const isSelected = currentEdgeStyle.toLowerCase() === stName.toLowerCase();
                return (
                  <button
                    key={stName}
                    type="button"
                    onClick={() => {
                      updateSetting('subtitleEdgeStyle', stName);
                      setActivePicker(null);
                      showToast(`Edge style set to ${stName}`);
                    }}
                    className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'text-[#a855f7] font-bold'
                        : 'text-white font-medium hover:text-white/80'
                    }`}
                  >
                    <span>{stName}</span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 shrink-0 px-[5px]">
              <button
                type="button"
                onClick={() => setActivePicker(null)}
                className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edge Colour Picker Modal */}
      {activePicker === 'edgeColor' && (
        <div
          className="fixed inset-0 z-[7500] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
          onClick={() => setActivePicker(null)}
        >
          <div
            className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Edge Colour</h3>
            <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
              {edgeColorList.map((colName) => {
                const isSelected = currentEdgeColor.toLowerCase() === colName.toLowerCase();
                return (
                  <button
                    key={colName}
                    type="button"
                    onClick={() => {
                      updateSetting('subtitleEdgeColor', colName);
                      setActivePicker(null);
                      showToast(`Edge colour set to ${colName}`);
                    }}
                    className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'text-[#a855f7] font-bold'
                        : 'text-white font-medium hover:text-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: getSubtitleEdgeColorHex(colName) }}
                      />
                      <span>{colName}</span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 shrink-0 px-[5px]">
              <button
                type="button"
                onClick={() => setActivePicker(null)}
                className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Picker Modal */}
      {activePicker === 'background' && (
        <div
          className="fixed inset-0 z-[7500] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
          onClick={() => setActivePicker(null)}
        >
          <div
            className="w-full max-w-[432px] sm:max-w-[482px] bg-[#172029] border-0 outline-none rounded-[28px] p-6 shadow-2xl space-y-3.5 select-none animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white tracking-tight shrink-0">Background</h3>
            <div className="space-y-1 overflow-y-auto pr-1 px-[5px] max-h-[392px]">
              {backgroundList.map((bgName) => {
                const isSelected =
                  currentBackground.toLowerCase() === bgName.toLowerCase() ||
                  (bgName === 'Soft Scrim' && currentBackground.toLowerCase() === 'semi-transparent black') ||
                  (bgName === 'Transparent' && currentBackground.toLowerCase() === 'none');
                return (
                  <button
                    key={bgName}
                    type="button"
                    onClick={() => {
                      updateSetting('subtitleBackground', bgName);
                      setActivePicker(null);
                      showToast(`Background set to ${bgName}`);
                    }}
                    className={`w-full flex items-center justify-between py-2 px-1 rounded-xl text-[15px] transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'text-[#a855f7] font-bold'
                        : 'text-white font-medium hover:text-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: getSubtitleBackgroundSwatchHex(bgName) }}
                      />
                      <span>{bgName}</span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#a855f7] flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 text-[#172029] stroke-[3.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 shrink-0 px-[5px]">
              <button
                type="button"
                onClick={() => setActivePicker(null)}
                className="text-[#a855f7] hover:text-[#c084fc] font-semibold text-sm transition-colors cursor-pointer px-2 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

