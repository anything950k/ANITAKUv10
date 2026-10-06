import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { cleanStaleSWRCache } from './services/swrCache';
import { HomeView } from './components/home/HomeView';
import { DetailsView } from './components/details/DetailsView';
import { CharacterModal } from './components/details/CharacterModal';
import { WatchOrderModal } from './components/details/WatchOrderModal';
import { EpisodeSearchModal } from './components/details/EpisodeSearchModal';
import { AddToLibraryModal } from './components/details/AddToLibraryModal';
import { VideoPlayerModal } from './components/player/VideoPlayerModal';
import { MangaReaderModal } from './components/reader/MangaReaderModal';
import { ScheduleView } from './components/schedule/ScheduleView';
import { SearchView } from './components/search/SearchView';
import { FilterModal } from './components/search/FilterModal';
import { ProfileView } from './components/profile/ProfileView';
import { CommunityView } from './components/community/CommunityView';
import { SettingsView } from './components/settings/SettingsView';
import { BottomNavigationBar } from './components/layout/BottomNavigationBar';

const MainContainer: React.FC = () => {
  const { activeNav, toastMessage, selectedMedia } = useApp();

  return (
    <div className="relative min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-purple-500 selection:text-white no-scrollbar">
      {/* 1. MAIN SCREEN VIEWS (Zero-Latency Keep-Alive DOM & State Persistence) */}
      <main className="w-full max-w-5xl mx-auto">
        <div className={activeNav === 'home' ? 'block' : 'hidden'}>
          <HomeView />
        </div>
        <div className={activeNav === 'schedule' ? 'block' : 'hidden'}>
          <ScheduleView />
        </div>
        <div className={activeNav === 'search' ? 'block' : 'hidden'}>
          <SearchView />
        </div>
        <div className={activeNav === 'community' ? 'block' : 'hidden'}>
          <CommunityView />
        </div>
        <div className={activeNav === 'profile' ? 'block' : 'hidden'}>
          <ProfileView />
        </div>
        <div className={activeNav === 'settings' ? 'block' : 'hidden'}>
          <SettingsView />
        </div>
      </main>

      {/* 2. MEDIA DETAILS VIEW MODAL / OVERLAY */}
      {selectedMedia && <DetailsView />}

      {/* 3. SUPPORTING MODALS */}
      <CharacterModal />
      <WatchOrderModal />
      <EpisodeSearchModal key={selectedMedia ? `ep-search-${selectedMedia.id}` : 'ep-search-none'} />
      <AddToLibraryModal />
      <FilterModal />

      {/* 4. ACTIVE VIDEO STREAMING & READER MODALS */}
      <VideoPlayerModal />
      <MangaReaderModal />

      {/* 5. FLOATING BOTTOM NAVIGATION CAPSULE */}
      <BottomNavigationBar />

      {/* 6. TOAST NOTIFICATION POPUP */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] px-4 py-2.5 rounded-full bg-[#181824]/95 text-white border border-purple-500/40 text-xs font-bold shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in slide-in-from-top duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App() {
  useEffect(() => {
    // Silently purge expired SWR records on startup
    cleanStaleSWRCache().catch(() => {});
  }, []);

  return (
    <AppProvider>
      <MainContainer />
    </AppProvider>
  );
}
