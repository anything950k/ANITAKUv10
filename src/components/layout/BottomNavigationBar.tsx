import React from 'react';
import { useApp } from '../../context/AppContext';
import { NavTab } from '../../types';
import { safeGetItem } from '../../utils/storage';
import { AppLogoIcon } from '../common/AppLogoIcon';
import { CommunityIcon } from '../common/CommunityIcon';
import { ScheduleIcon } from '../common/ScheduleIcon';
import { SettingsIcon } from '../common/SettingsIcon';

export type MainTab = 'home' | 'profile' | 'community' | 'schedule' | 'search' | 'settings';

interface BottomNavProps {
  activeTab?: MainTab;
  onTabChange?: (tab: MainTab) => void;
  userInitials?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab: propActiveTab,
  onTabChange: propOnTabChange,
  userInitials: propUserInitials,
}) => {
  const {
    activeNav,
    setActiveNav,
    closeMediaDetails,
    setActiveLibraryStatus,
    setSettingsSubPage,
    settingsSubPage,
    setSettingsActiveModal,
    settingsActiveModal,
    showFilterModal,
    selectedMedia,
    activeVideoEpisode,
    activeReader,
    activeLibraryStatus,
    showAddToLibrary,
    isProfileSheetOpen,
    markCommunityAsRead,
  } = useApp();

  // Hide the floating bottom nav when modals, full-screen library sheets, edit profile sheets,
  // or ANY Settings option / subpage is open
  if (
    showFilterModal ||
    selectedMedia ||
    activeVideoEpisode ||
    activeReader ||
    activeLibraryStatus ||
    showAddToLibrary ||
    isProfileSheetOpen ||
    settingsSubPage !== null ||
    settingsActiveModal !== null
  ) {
    return null;
  }

  const currentTab = (propActiveTab || activeNav) as MainTab;

  const handleTabClick = (tab: MainTab) => {
    if (tab === 'community') {
      markCommunityAsRead();
    }
    if (propOnTabChange) {
      propOnTabChange(tab);
    } else {
      closeMediaDetails();
      setActiveLibraryStatus(null);
      setSettingsSubPage(null);
      setSettingsActiveModal(null);
      setActiveNav(tab as NavTab);
    }
  };

  // Get user profile initials dynamically (fallback to MD)
  const profileName = safeGetItem('satori_profile_name', 'MD');
  const userInitials =
    propUserInitials || profileName.trim().slice(0, 2).toUpperCase() || 'MD';

  const tabs = [
    {
      id: 'home' as MainTab,
      label: 'Home',
      renderIcon: (isActive: boolean) => (
        <AppLogoIcon
          size={27}
          color={isActive ? '#C084FC' : '#FFFFFF'}
          glow={false}
          strokeWidth={0.5}
          className="transition-all duration-200"
        />
      ),
    },
    {
      id: 'profile' as MainTab,
      label: 'Profile',
      renderIcon: (isActive: boolean) => (
        <div
          className={`w-[32px] h-[32px] rounded-full bg-[#0284C7] text-white text-[13px] font-black flex items-center justify-center tracking-tight transition-all duration-200 shrink-0 ${
            isActive ? 'ring-2 ring-purple-400' : ''
          }`}
        >
          {userInitials}
        </div>
      ),
    },
    {
      id: 'community' as MainTab,
      label: 'Community',
      renderIcon: (isActive: boolean) => (
        <CommunityIcon
          size={27}
          color={isActive ? '#C084FC' : '#FFFFFF'}
          glow={false}
          strokeWidth={0.5}
          className="transition-all duration-200"
        />
      ),
    },
    {
      id: 'schedule' as MainTab,
      label: 'Schedule',
      renderIcon: (isActive: boolean) => (
        <ScheduleIcon
          size={27}
          color={isActive ? '#C084FC' : '#FFFFFF'}
          glow={false}
          strokeWidth={0.5}
          dotSize={0.1}
          dotStrokeWidth={0.1}
          className="transition-all duration-200"
        />
      ),
    },
    {
      id: 'search' as MainTab,
      label: 'Search',
      renderIcon: (isActive: boolean) => (
        <svg
          width="27"
          height="27"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? '#C084FC' : '#FFFFFF'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle
            cx="11"
            cy="11"
            r="7.5"
            fill="none"
            stroke={isActive ? '#C084FC' : '#FFFFFF'}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="16.5"
            y1="16.5"
            x2="21"
            y2="21"
            fill="none"
            stroke={isActive ? '#C084FC' : '#FFFFFF'}
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ),
    },
    {
      id: 'settings' as MainTab,
      label: 'Settings',
      renderIcon: (isActive: boolean) => (
        <SettingsIcon
          size={27}
          color={isActive ? '#C084FC' : '#FFFFFF'}
          glow={false}
          strokeWidth={0.5}
          className="transition-all duration-200"
        />
      ),
    },
  ];

  return (
    <nav
      id="bottom-floating-navigation"
      aria-label="Main Navigation"
      role="tablist"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-14px)] max-w-[560px] sm:max-w-[620px] md:max-w-[660px] h-[70px] rounded-full z-[99999] bg-transparent border border-white/10 shadow-2xl flex items-center justify-between gap-1.5 px-2.5 sm:px-4 py-2 select-none"
    >
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`nav-item-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleTabClick(tab.id)}
            className={`relative flex-1 h-[54px] py-[2px] flex items-center justify-center rounded-full cursor-pointer outline-none focus:outline-none focus:ring-0 isolate transition-colors duration-200 overflow-hidden ${
              isActive ? 'text-[#C084FC]' : 'text-white'
            }`}
            aria-label={tab.label}
          >
            {/* Active Capsule Pill Overlay */}
            {isActive && (
              <div
                className="absolute inset-0 rounded-full bg-white/10 outline-none border-0 shadow-none pointer-events-none z-0 transition-all duration-200"
                aria-hidden="true"
              />
            )}

            {/* Icon Render */}
            <span
              className={`relative z-10 flex items-center justify-center pointer-events-none ${
                isActive ? 'text-[#C084FC]' : 'text-white'
              }`}
            >
              {tab.renderIcon(isActive)}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export const BottomNavigationBar = BottomNav;

