import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  fetchCharacterDetailsById,
  fetchMediaDetailsById,
  parseCharacterDescription,
} from '../../services/apiClient';
import { Character, MediaItem } from '../../types';

export const CharacterModal: React.FC = () => {
  const { selectedCharacter, setSelectedCharacter, openMediaDetails } = useApp();

  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync with selectedCharacter from context
  useEffect(() => {
    if (!selectedCharacter) {
      setActiveChar(null);
      return;
    }

    setActiveChar(selectedCharacter);

    // Fetch full real metadata from AniList GraphQL if not already fully hydrated
    let isCancelled = false;
    async function loadFullDetails() {
      if (!selectedCharacter) return;
      if (!selectedCharacter.appearedIn || selectedCharacter.appearedIn.length === 0) {
        const full = await fetchCharacterDetailsById(selectedCharacter.id);
        if (!isCancelled && full) {
          setActiveChar(full);
        }
      }
    }

    loadFullDetails();

    return () => {
      isCancelled = true;
    };
  }, [selectedCharacter?.id]);

  // Scroll to top when active character changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeChar?.id]);

  if (!selectedCharacter || !activeChar) return null;

  // Handle Back button
  const handleBack = () => {
    setSelectedCharacter(null);
  };

  // Handle clicking an appearance item from Appeared In
  const handleSelectAppearedInMedia = async (mediaId: string | number) => {
    try {
      const fullMedia = await fetchMediaDetailsById(mediaId);
      setSelectedCharacter(null);
      if (fullMedia) {
        openMediaDetails(fullMedia);
      } else {
        const fallbackMedia: MediaItem = {
          id: String(mediaId),
          title: 'Media Details',
          category: 'anime',
          coverImage: '',
          format: 'TV',
          status: 'Finished',
          score: 8.0,
          year: new Date().getFullYear(),
          genres: [],
          description: '',
        };
        openMediaDetails(fallbackMedia);
      }
    } catch (err) {
      console.error('Failed to open appeared media:', err);
      setSelectedCharacter(null);
    }
  };

  // Extract attributes: use pre-parsed attributes or parse from rawDescription/bio
  const effectiveAttributes =
    activeChar.attributes && activeChar.attributes.length > 0
      ? activeChar.attributes
      : parseCharacterDescription(activeChar.rawDescription || activeChar.bio, {
          gender: activeChar.gender,
          birthday: activeChar.birthday,
          age: activeChar.age,
          bloodType: activeChar.bloodType,
        }).attributes;

  // Split narrative bio into clean paragraphs with spoiler tags stripped
  const rawNarrativeText = (activeChar.bio || '').replace(/~!|!~/g, '');
  const paragraphs = rawNarrativeText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Render markdown inline tokens:
  // - [Character Name](https://anilist.co/character/12345) rendered as purple link opening AniList profile in a new tab
  // - Handles cases with or without opening brackets: e.g. [Lakan](url) or Lakan](url) or ( Lakan](url)
  const renderParagraphTokens = (text: string) => {
    // Strip any spoiler markers
    const cleanText = text.replace(/~!|!~/g, '');
    const tokenRegex = /(?:\[)?([^[\]()\n]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g;
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(cleanText)) !== null) {
      if (match.index > lastIdx) {
        elements.push(cleanText.substring(lastIdx, match.index));
      }

      const label = match[1].trim();
      const rawUrl = match[2].trim();
      let targetUrl = rawUrl;
      if (targetUrl.startsWith('/')) {
        targetUrl = `https://anilist.co${targetUrl}`;
      } else if (!targetUrl.startsWith('http')) {
        targetUrl = `https://anilist.co/${targetUrl}`;
      }

      elements.push(
        <a
          key={`char-link-${match.index}-${label}`}
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline text-[#c084fc] font-semibold underline underline-offset-4 decoration-[#c084fc]/50 hover:text-[#d8b4fe] transition-colors cursor-pointer text-left mx-0.5"
        >
          {label}
        </a>
      );

      lastIdx = tokenRegex.lastIndex;
    }

    if (lastIdx < cleanText.length) {
      elements.push(cleanText.substring(lastIdx));
    }

    return elements;
  };

  // Strictly filter Appeared In to anime-related series, movies, OVAs, ONAs, and specials (exclude manga & light novels)
  const appearedInList = (activeChar.appearedIn || []).filter((app) => {
    const rawType = (app.type || '').toUpperCase();
    const rawFormat = (app.format || '').toUpperCase();
    return (
      rawType !== 'MANGA' &&
      rawFormat !== 'MANGA' &&
      rawFormat !== 'NOVEL' &&
      rawFormat !== 'ONE_SHOT'
    );
  });

  return (
    <div
      id="character-profile-sheet-backdrop"
      onClick={(e) => {
        // Clicking the exposed clear area at the top dismisses the sheet
        if (e.target === e.currentTarget) handleBack();
      }}
      className="fixed inset-0 z-[2000] bg-transparent flex flex-col justify-end"
    >
      {/* 95% Height bottom sheet panel leaving top 5% exposed crystal clear with flat top edge matching Watch Order sheet */}
      <div
        id="character-profile-bottom-sheet"
        className="w-full h-[95dvh] max-h-[95dvh] bg-[#000000] text-white flex flex-col overflow-hidden rounded-none shadow-[0_-12px_40px_rgba(0,0,0,0.95)] animate-in slide-in-from-bottom duration-300"
      >
        {/* Scrollable Main Content Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto no-scrollbar px-3.5 sm:px-6 py-4 flex flex-col"
        >
          <div className="max-w-2xl mx-auto w-full pb-20 space-y-4">
            {/* Back Button (no divider line, scrolls naturally with sheet content) */}
            <div className="flex items-center pt-1">
              <button
                onClick={handleBack}
                aria-label="Back"
                className="w-10 h-10 rounded-full bg-[#1c1c24] hover:bg-[#282834] text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-md"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* BOX 1: Character Details Card */}
            <div className="p-4 sm:p-6 bg-[#121217] rounded-3xl border border-white/[0.08] shadow-2xl space-y-6">
              {/* Character Hero Header */}
              <div className="flex gap-4 sm:gap-5 items-start">
                {activeChar.image ? (
                  <img
                    src={activeChar.image}
                    alt={activeChar.name}
                    className="w-28 h-40 sm:w-36 sm:h-48 rounded-2xl object-cover shadow-2xl shrink-0 border border-white/5"
                  />
                ) : (
                  <div className="w-28 h-40 sm:w-36 sm:h-48 bg-neutral-800 rounded-2xl shadow-xl shrink-0" />
                )}

                <div className="flex-1 min-w-0 pt-1">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    {activeChar.name}
                  </h2>
                  {activeChar.nativeName && (
                    <p className="text-xs sm:text-sm font-semibold text-neutral-400 mt-1">
                      {activeChar.nativeName}
                    </p>
                  )}
                </div>
              </div>

              {/* Key-Value Attributes List */}
              {effectiveAttributes.length > 0 && (
                <div className="pt-2 space-y-2.5">
                  {effectiveAttributes.map((attr, idx) => (
                    <div key={idx} className="flex items-baseline text-xs sm:text-sm leading-relaxed">
                      <span className="w-32 sm:w-40 text-neutral-400 font-bold shrink-0">
                        {attr.key}
                      </span>
                      <span className="text-white font-medium flex-1">
                        {renderParagraphTokens(attr.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Narrative Description / Bio with Purple Character Links */}
              {paragraphs.length > 0 && (
                <div className="pt-2 space-y-4 text-xs sm:text-sm text-neutral-200 leading-relaxed font-normal">
                  {paragraphs.map((p, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {renderParagraphTokens(p)}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* BOX 2: Appeared In Section Box */}
            {appearedInList.length > 0 && (
              <div className="p-4 sm:p-6 bg-[#121217] rounded-3xl border border-white/[0.08] shadow-2xl space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                    Appeared In
                  </h3>
                  <p className="text-xs text-neutral-400 font-medium mt-0.5">
                    Anime and film appearances.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  {appearedInList.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => handleSelectAppearedInMedia(app.id)}
                      className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#181822] border border-white/5 hover:border-white/20 hover:bg-[#20202c] transition-all cursor-pointer group shadow-md"
                    >
                      {app.image ? (
                        <img
                          src={app.image}
                          alt={app.title}
                          className="w-13 h-19 sm:w-14 sm:h-20 object-cover rounded-xl shadow-md shrink-0 border border-white/5"
                        />
                      ) : (
                        <div className="w-13 h-19 sm:w-14 sm:h-20 bg-neutral-800 rounded-xl shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide line-clamp-1 group-hover:text-purple-300 transition-colors">
                          {app.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-neutral-400 font-medium mt-1">
                          {app.year ? `${app.year} - ` : ''}
                          {app.format}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
