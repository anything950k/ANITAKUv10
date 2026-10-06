import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AppToggleSwitch } from '../common/AppToggleSwitch';
import { loadCustomFontFromStorage, registerAndSaveCustomFont } from '../../utils/customFontHelper';

export interface NovelReaderSettings {
  perNovelSettings: boolean;
  pageColor: 'paper' | 'sepia' | 'dark' | 'amoled' | 'custom';
  customColors: {
    background: string;
    text: string;
  };
  pageLayout: 'automatic' | 'paged' | 'vertical';
  pageSpread: 'automatic' | 'single' | 'double';
  readingDirection: 'ltr' | 'rtl';
  pageTurn: 'off' | 'slide' | 'book_flip';
  pageTurnSound: 'Off' | '1' | '2' | '3' | '4';
  edgeTapNavigation: boolean;
  preloadVolumes: number;
  typography: 'Bookerly' | 'EB Garamond' | 'Bembolz' | 'Comic Sans' | 'System Serif' | 'System Sans' | 'Monospace' | 'Custom';
  customFontName: string;
  fontWeight: number;
  fontSize: number; // in sp (e.g. 18)
  lineHeight: number; // e.g. 1.55
  paragraphSpacing: number; // in dp (e.g. 14)
  sideMargin: number; // in dp (e.g. 24)
  topMargin: number; // in dp (e.g. 14)
  bottomMargin: number; // in dp (e.g. 14)
  textAlignment: 'aligned' | 'justified';
  hyphenation: boolean;
  keepScreenAwake: boolean;
}

export const DEFAULT_NOVEL_SETTINGS: NovelReaderSettings = {
  perNovelSettings: false,
  pageColor: 'paper',
  customColors: {
    background: '#191724',
    text: '#e0def4',
  },
  pageLayout: 'automatic',
  pageSpread: 'automatic',
  readingDirection: 'ltr',
  pageTurn: 'off',
  pageTurnSound: 'Off',
  edgeTapNavigation: true,
  preloadVolumes: 4,
  typography: 'Bookerly',
  customFontName: '',
  fontWeight: 400,
  fontSize: 18,
  lineHeight: 1.55,
  paragraphSpacing: 14,
  sideMargin: 24,
  topMargin: 14,
  bottomMargin: 14,
  textAlignment: 'aligned',
  hyphenation: true,
  keepScreenAwake: true,
};

interface NovelReaderSettingsSheetProps {
  settings: NovelReaderSettings;
  onChange: (newSettings: NovelReaderSettings) => void;
  onClose: () => void;
  onPlaySound?: (sound: '1' | '2' | '3' | '4') => void;
}

interface CustomSliderProps {
  label: string;
  value: number;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  compact?: boolean;
}

const NovelSlider: React.FC<CustomSliderProps> = ({
  label,
  value,
  valueDisplay,
  min,
  max,
  step,
  onChange,
  compact = false,
}) => {
  const safeValue = Math.min(max, Math.max(min, value));
  const ratio = max > min ? Math.max(0, Math.min(1, (safeValue - min) / (max - min))) : 0;
  const currentIndicatorPosition = `calc(10px + (100% - 20px) * ${ratio})`;
  const isOverDot = safeValue >= max || ratio >= 0.999;

  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureRef = useRef<'undecided' | 'scrolling' | 'sliding' | null>(null);
  const isMouseDownRef = useRef(false);

  // Compute slider value from a given clientX coordinate
  const getValueFromX = useCallback((clientX: number) => {
    if (!trackRef.current) return safeValue;
    const rect = trackRef.current.getBoundingClientRect();
    const innerWidth = Math.max(1, rect.width - 20);
    const relativeX = clientX - rect.left - 10;
    const clampedRatio = Math.max(0, Math.min(1, relativeX / innerWidth));
    let rawVal = min + clampedRatio * (max - min);
    if (step > 0) {
      const stepsCount = Math.round((rawVal - min) / step);
      rawVal = min + stepsCount * step;
    }
    const precision = step < 0.1 ? 2 : step < 1 ? 1 : 0;
    return Math.min(max, Math.max(min, parseFloat(rawVal.toFixed(precision))));
  }, [min, max, step, safeValue]);

  // Touch handling: allows smooth vertical scrolling while still enabling tap-to-set and horizontal sliding
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
    if (gestureRef.current === 'scrolling') return; // User is scrolling vertically, ignore slider updates

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = Math.abs(currentX - touchStartRef.current.x);
    const dy = Math.abs(currentY - touchStartRef.current.y);

    if (gestureRef.current === 'undecided') {
      if (dy > dx && dy > 7) {
        // Vertical movement detected -> scroll the settings sheet
        gestureRef.current = 'scrolling';
        return;
      } else if (dx > dy && dx > 7) {
        // Horizontal movement detected -> adjust the slider
        gestureRef.current = 'sliding';
      } else {
        return;
      }
    }

    if (gestureRef.current === 'sliding') {
      const newVal = getValueFromX(currentX);
      onChange(newVal);
    }
  };

  const handleTouchEnd = () => {
    // If the touch didn't move past the 7px threshold, treat it as a tap/click to set value directly
    if (gestureRef.current === 'undecided' && touchStartRef.current) {
      const newVal = getValueFromX(touchStartRef.current.x);
      onChange(newVal);
    }
    touchStartRef.current = null;
    gestureRef.current = null;
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    gestureRef.current = null;
  };

  // Mouse handling for desktop users (click and drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    const newVal = getValueFromX(e.clientX);
    onChange(newVal);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      onChange(getValueFromX(moveEvent.clientX));
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      delta = step;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      delta = -step;
    } else if (e.key === 'Home') {
      onChange(min);
      return;
    } else if (e.key === 'End') {
      onChange(max);
      return;
    }
    if (delta !== 0) {
      e.preventDefault();
      const precision = step < 0.1 ? 2 : step < 1 ? 1 : 0;
      const newVal = Math.min(max, Math.max(min, parseFloat((safeValue + delta).toFixed(precision))));
      onChange(newVal);
    }
  };

  return (
    <div className={`space-y-1 ${compact ? 'py-0.5' : 'py-1'}`}>
      <div className="flex items-center justify-between">
        <span className={compact ? 'font-semibold text-[15px] text-white tracking-tight' : 'font-bold text-sm text-white tracking-tight'}>
          {label}
        </span>
        <span className={compact ? 'font-semibold text-[13px] text-[#c084fc]' : 'font-bold text-xs text-[#b876fc] font-mono'}>
          {valueDisplay}
        </span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeValue}
        aria-valuetext={valueDisplay}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        className={`relative flex items-center w-full select-none mx-0 group touch-pan-y cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#b876fc]/50 rounded-lg ${
          compact ? 'h-10' : 'h-12 sm:h-14'
        }`}
      >
        {/* 1. Left Progressed Purple Solid Bar */}
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 ${
            compact ? 'h-3 sm:h-3.5' : 'h-3.5 sm:h-4'
          } bg-[#b876fc] rounded-l-full rounded-r-[3.5px] overflow-hidden flex items-center z-[2]`}
          style={{
            width: ratio > 0 ? `calc(${currentIndicatorPosition} - 6px)` : '0px',
            display: ratio > 0 ? 'block' : 'none',
          }}
        />

        {/* 2. Right Unfilled Dark Track */}
        <div
          className={`absolute right-0 top-1/2 -translate-y-1/2 ${
            compact ? 'h-3 sm:h-3.5' : 'h-3.5 sm:h-4'
          } bg-[#181826] rounded-l-[3.5px] rounded-r-full overflow-hidden flex items-center shadow-inner z-[2]`}
          style={{
            left: ratio < 1 ? `calc(${currentIndicatorPosition} + 6px)` : '100%',
            display: ratio < 1 ? 'block' : 'none',
          }}
        />

        {/* 3. Vertical Indicator Line */}
        <div
          className="absolute top-1/2 pointer-events-none z-10"
          style={{
            left: currentIndicatorPosition,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className={`w-[3.5px] sm:w-[4px] ${
              compact ? 'h-[36px]' : 'h-[46px] sm:h-[50px]'
            } bg-[#b876fc] rounded-full shadow-none`}
          />
        </div>

        {/* 4. Single End Dot Indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none transition-all duration-75 z-[4] ${
            isOverDot ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
          } w-[7px] h-[7px] sm:w-2 sm:h-2 bg-white/35`}
          style={{ left: 'calc(100% - 10px)' }}
        />
      </div>
    </div>
  );
};

const brightnessToHex = (percent: number): string => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const val = Math.round((clamped / 100) * 255);
  const hex = val.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
};

const hexToBrightness = (hex: string, defaultVal: number): number => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return defaultVal;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return Math.round(((r * 0.299 + g * 0.587 + b * 0.114) / 255) * 100);
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return Math.round(((r * 0.299 + g * 0.587 + b * 0.114) / 255) * 100);
  }
  return defaultVal;
};

export const NovelReaderSettingsSheet: React.FC<NovelReaderSettingsSheetProps> = ({
  settings,
  onChange,
  onClose,
  onPlaySound,
}) => {
  const [showCustomColorModal, setShowCustomColorModal] = useState(false);
  const [tempPageBrightness, setTempPageBrightness] = useState<number>(() => {
    return hexToBrightness(settings.customColors?.background || '#171717', 9);
  });
  const [tempTextBrightness, setTempTextBrightness] = useState<number>(() => {
    return hexToBrightness(settings.customColors?.text || '#ededed', 93);
  });
  const fontFileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore imported font on mount
  useEffect(() => {
    loadCustomFontFromStorage().then((name) => {
      if (name && !settings.customFontName) {
        updateSetting('customFontName', name);
      }
    });
  }, [settings.customFontName]);

  const handleFontFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast('Loading font from device...');
    const result = await registerAndSaveCustomFont(file);

    if (result.success) {
      onChange({
        ...settings,
        typography: 'Custom',
        customFontName: result.fontName,
      });
      showToast(`Font "${result.fontName}" imported successfully!`);
    } else {
      showToast(result.error || 'Failed to import font file');
    }

    if (fontFileInputRef.current) {
      fontFileInputRef.current.value = '';
    }
  };

  const openCustomColorModal = () => {
    setTempPageBrightness(hexToBrightness(settings.customColors?.background || '#171717', 9));
    setTempTextBrightness(hexToBrightness(settings.customColors?.text || '#ededed', 93));
    setShowCustomColorModal(true);
  };

  const handleApplyCustomColors = () => {
    const newBg = brightnessToHex(tempPageBrightness);
    const newText = brightnessToHex(tempTextBrightness);
    onChange({
      ...settings,
      pageColor: 'custom',
      customColors: {
        background: newBg,
        text: newText,
      },
    });
    setShowCustomColorModal(false);
    showToast('Custom page colors applied');
  };

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleResetToDefaults = () => {
    onChange({ ...DEFAULT_NOVEL_SETTINGS });
    setTempPageBrightness(hexToBrightness(DEFAULT_NOVEL_SETTINGS.customColors.background, 9));
    setTempTextBrightness(hexToBrightness(DEFAULT_NOVEL_SETTINGS.customColors.text, 93));
    try {
      localStorage.removeItem('satori_novel_settings_global');
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith('satori_novel_per_')) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
    showToast('Reader settings reset to defaults');
  };

  const updateSetting = <K extends keyof NovelReaderSettings>(key: K, val: NovelReaderSettings[K]) => {
    onChange({
      ...settings,
      [key]: val,
    });
  };

  return (
    <div className="fixed inset-0 z-[6000] w-full h-full bg-[#0a0b10] flex flex-col overflow-hidden">
      {/* Scrollable Settings Content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 pt-7 pb-6 space-y-7 text-white no-scrollbar max-w-2xl mx-auto w-full">
        {/* Header: Reader Settings (Left) & Done (Right) */}
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-2xl sm:text-[26px] font-extrabold text-white tracking-tight">
            Reader Settings
          </h2>
          <button
            onClick={onClose}
            className="text-sm font-semibold text-white hover:text-white/80 transition-opacity cursor-pointer px-2 py-1"
          >
            Done
          </button>
        </div>

        {/* 1. Per-Novel Settings */}
        <div
          onClick={() => updateSetting('perNovelSettings', !settings.perNovelSettings)}
          className="flex items-center justify-between py-1 px-1 rounded-2xl hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
        >
          <div>
            <h3 className="text-[15px] font-bold text-white">Per-Novel Settings</h3>
            <p className="text-xs text-white/50 mt-0.5">
              {settings.perNovelSettings
                ? 'Custom settings are active for this novel'
                : 'Changes apply to global Reader Settings'}
            </p>
          </div>
          <AppToggleSwitch
            checked={settings.perNovelSettings}
            onChange={(next) => updateSetting('perNovelSettings', next)}
          />
        </div>

        {/* 2. Page Color */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Page Color</h3>
          <div className="grid grid-cols-5 gap-2.5">
            {[
              {
                id: 'paper' as const,
                label: 'Paper',
                circleBg: '#FFFFFF',
                textColor: '#1a1a24',
              },
              {
                id: 'sepia' as const,
                label: 'Sepia',
                circleBg: '#F5EEDC',
                textColor: '#4a3b2c',
              },
              {
                id: 'dark' as const,
                label: 'Dark',
                circleBg: '#222430',
                textColor: '#FFFFFF',
              },
              {
                id: 'amoled' as const,
                label: 'AMOLED',
                circleBg: '#000000',
                textColor: '#FFFFFF',
                border: true,
              },
              {
                id: 'custom' as const,
                label: 'Custom',
                circleBg: settings.customColors?.background || '#191724',
                textColor: settings.customColors?.text || '#e0def4',
                border: true,
              },
            ].map((opt) => {
              const isSelected = settings.pageColor === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    updateSetting('pageColor', opt.id);
                    if (opt.id === 'custom') {
                      openCustomColorModal();
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all cursor-pointer select-none border-2 ${
                    isSelected
                      ? 'bg-[#1a122e] border-[#b876fc]'
                      : 'bg-[#12131c] border-transparent hover:border-white/10'
                  }`}
                >
                  <div
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-md transition-transform"
                    style={{
                      backgroundColor: opt.circleBg,
                      border: opt.border ? '1px solid rgba(255,255,255,0.15)' : 'none',
                    }}
                  >
                    <span
                      className="text-xs sm:text-sm font-serif font-bold"
                      style={{ color: opt.textColor }}
                    >
                      Aa
                    </span>
                  </div>
                  <span
                    className={`mt-2 text-[11px] sm:text-xs font-medium truncate ${
                      isSelected ? 'text-[#b876fc] font-semibold' : 'text-white/70'
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={openCustomColorModal}
              className="text-xs font-semibold text-[#b876fc] hover:underline cursor-pointer"
            >
              Edit Custom Colors
            </button>
          </div>
        </div>

        {/* 3. Page Layout */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Page Layout</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Automatic */}
            <button
              onClick={() => updateSetting('pageLayout', 'automatic')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageLayout === 'automatic'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-1.5 flex gap-1 items-center justify-center ${
                  settings.pageLayout === 'automatic' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-2.5 h-7 rounded-[2px] ${
                    settings.pageLayout === 'automatic' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-2.5 h-7 rounded-[2px] ${
                    settings.pageLayout === 'automatic' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Automatic</span>
            </button>

            {/* Paged */}
            <button
              onClick={() => updateSetting('pageLayout', 'paged')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageLayout === 'paged'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-1.5 flex flex-col justify-center gap-1 items-center ${
                  settings.pageLayout === 'paged' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-6 h-1 rounded-full ${
                    settings.pageLayout === 'paged' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-6 h-1 rounded-full ${
                    settings.pageLayout === 'paged' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-6 h-1 rounded-full ${
                    settings.pageLayout === 'paged' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-4 h-1 rounded-full self-start ml-0.5 ${
                    settings.pageLayout === 'paged' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Paged</span>
            </button>

            {/* Vertical */}
            <button
              onClick={() => updateSetting('pageLayout', 'vertical')}
              className={`col-span-2 sm:col-span-1 flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageLayout === 'vertical'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-1.5 flex flex-col justify-center gap-1 items-center ${
                  settings.pageLayout === 'vertical' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-6 h-2 rounded-[2px] ${
                    settings.pageLayout === 'vertical' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-6 h-2 rounded-[2px] ${
                    settings.pageLayout === 'vertical' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-6 h-2 rounded-[2px] ${
                    settings.pageLayout === 'vertical' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Vertical</span>
            </button>
          </div>
        </div>

        {/* 4. Page Spread */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Page Spread</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Automatic */}
            <button
              onClick={() => updateSetting('pageSpread', 'automatic')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageSpread === 'automatic'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-1 flex gap-1 items-center justify-center ${
                  settings.pageSpread === 'automatic' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-3 h-8 rounded-[2px] ${
                    settings.pageSpread === 'automatic' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-3 h-8 rounded-[2px] ${
                    settings.pageSpread === 'automatic' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Automatic</span>
            </button>

            {/* Single */}
            <button
              onClick={() => updateSetting('pageSpread', 'single')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageSpread === 'single'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-1 flex items-center justify-center ${
                  settings.pageSpread === 'single' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-4 h-8 rounded-[2px] ${
                    settings.pageSpread === 'single' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Single</span>
            </button>

            {/* Double */}
            <button
              onClick={() => updateSetting('pageSpread', 'double')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageSpread === 'double'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-1 flex gap-1 items-center justify-center ${
                  settings.pageSpread === 'double' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-3 h-8 rounded-[2px] ${
                    settings.pageSpread === 'double' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-3 h-8 rounded-[2px] ${
                    settings.pageSpread === 'double' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Double</span>
            </button>
          </div>
        </div>

        {/* 5. Reading Direction */}
        <div className="space-y-2.5">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Reading Direction</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Left to Right */}
            <button
              onClick={() => updateSetting('readingDirection', 'ltr')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all cursor-pointer border-2 ${
                settings.readingDirection === 'ltr'
                  ? 'bg-[#1d1430] border-[#b876fc] text-white shadow-sm'
                  : 'bg-[#12131c] border-transparent text-white/80 hover:text-white hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  settings.readingDirection === 'ltr' ? 'bg-[#b876fc]' : 'bg-[#20222e]'
                }`}
              >
                <ArrowRight
                  className={`w-4 h-4 stroke-[2.8] ${
                    settings.readingDirection === 'ltr' ? 'text-[#1a122e]' : 'text-white/70'
                  }`}
                />
              </div>
              <span className="text-[14px] sm:text-[15px] font-bold text-white leading-tight">
                Left to Right
              </span>
            </button>

            {/* Right to Left */}
            <button
              onClick={() => updateSetting('readingDirection', 'rtl')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all cursor-pointer border-2 ${
                settings.readingDirection === 'rtl'
                  ? 'bg-[#1d1430] border-[#b876fc] text-white shadow-sm'
                  : 'bg-[#12131c] border-transparent text-white/80 hover:text-white hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  settings.readingDirection === 'rtl' ? 'bg-[#b876fc]' : 'bg-[#20222e]'
                }`}
              >
                <ArrowLeft
                  className={`w-4 h-4 stroke-[2.8] ${
                    settings.readingDirection === 'rtl' ? 'text-[#1a122e]' : 'text-white/70'
                  }`}
                />
              </div>
              <span className="text-[14px] sm:text-[15px] font-bold text-white leading-tight">
                Right to Left
              </span>
            </button>
          </div>
        </div>

        {/* 6. Page Turn */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Page Turn</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Off */}
            <button
              onClick={() => updateSetting('pageTurn', 'off')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageTurn === 'off'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md flex items-center justify-center shrink-0 transition-all ${
                  settings.pageTurn === 'off' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div className="relative w-[27px] h-[32px] flex items-center justify-center">
                  {/* Back Card */}
                  <div className="absolute right-0 top-0.5 w-[22px] h-[30px] rounded-[3px] bg-[#3b2560]" />
                  {/* Front Card */}
                  <div
                    className={`absolute left-0 top-0.5 w-[22px] h-[30px] rounded-[3px] ${
                      settings.pageTurn === 'off' ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                    }`}
                  />
                  {/* Diagonal Slash */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 27 32" fill="none">
                    <line x1="2" y1="30" x2="25" y2="2" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <span className="text-sm font-bold text-white">Off</span>
            </button>

            {/* Slide */}
            <button
              onClick={() => updateSetting('pageTurn', 'slide')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageTurn === 'slide'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md flex items-center justify-center shrink-0 transition-all ${
                  settings.pageTurn === 'slide' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                {/* Slide Card matching user image */}
                <div className="relative w-[24px] h-[30px] rounded-[4px] overflow-hidden flex items-center justify-center shadow-sm">
                  {/* Left Half (Sliding Page) */}
                  <div
                    className={`w-1/2 h-full ${
                      settings.pageTurn === 'slide' ? 'bg-[#4c2482]' : 'bg-[#656974]'
                    }`}
                  />
                  {/* Right Half (Next Page) */}
                  <div
                    className={`w-1/2 h-full ${
                      settings.pageTurn === 'slide' ? 'bg-[#b876fc]' : 'bg-[#a2a6b2]'
                    }`}
                  />
                  {/* Center Vertical Page Edge / Slide Seam Pill spanning top to bottom edge */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 h-full w-[4.5px] bg-white rounded-full shadow-[0_0_2px_rgba(0,0,0,0.25)]" />
                </div>
              </div>
              <span className="text-sm font-bold text-white">Slide</span>
            </button>

            {/* Book Flip */}
            <button
              onClick={() => updateSetting('pageTurn', 'book_flip')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.pageTurn === 'book_flip'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md flex items-center justify-center shrink-0 transition-all ${
                  settings.pageTurn === 'book_flip' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div className="relative w-[27px] h-[32px] flex items-center justify-center">
                  {/* Back Card */}
                  <div className="absolute right-0 top-0.5 w-[22px] h-[30px] rounded-[3px] bg-[#3b2560]" />
                  {/* Front Card */}
                  <div
                    className={`absolute left-0 top-0.5 w-[22px] h-[30px] rounded-[3px] ${
                      settings.pageTurn === 'book_flip' ? 'bg-[#b876fc]' : 'bg-[#d3d7e3]'
                    }`}
                  />
                  {/* Vertical Page Fold Line matching user image */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 27 32" fill="none">
                    <line x1="12" y1="2.5" x2="16" y2="29" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <span className="text-sm font-bold text-white">Book Flip</span>
            </button>
          </div>
        </div>

        {/* 7. Page Turn Sound */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Page Turn Sound</h3>
          <div className="grid grid-cols-5 gap-2">
            {(['Off', '1', '2', '3', '4'] as const).map((s) => {
              const isSelected = settings.pageTurnSound === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    updateSetting('pageTurnSound', s);
                    if (s !== 'Off' && onPlaySound) {
                      onPlaySound(s);
                    }
                  }}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-2 ${
                    isSelected
                      ? 'bg-[#1d1430] border-[#b876fc] text-white'
                      : 'bg-[#12131c] border-transparent text-white/70 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* 8. Edge Tap Navigation */}
        <div
          onClick={() => updateSetting('edgeTapNavigation', !settings.edgeTapNavigation)}
          className="flex items-center justify-between py-1 px-1 rounded-2xl hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
        >
          <div>
            <h3 className="text-[15px] font-bold text-white">Edge Tap Navigation</h3>
          </div>
          <AppToggleSwitch
            checked={settings.edgeTapNavigation}
            onChange={(next) => updateSetting('edgeTapNavigation', next)}
          />
        </div>

        {/* 9. Preload Volumes */}
        <NovelSlider
          label="Preload Volumes"
          value={Math.min(5, settings.preloadVolumes)}
          valueDisplay={String(Math.min(5, settings.preloadVolumes))}
          min={1}
          max={5}
          step={1}
          onChange={(val) => updateSetting('preloadVolumes', val)}
        />

        {/* 10. Typography */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Typography</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'Bookerly' as const,
                label: 'Bookerly',
                fontFamily: '"Literata", "Bookerly", "Merriweather", Georgia, serif',
              },
              {
                id: 'EB Garamond' as const,
                label: 'EB Garamond',
                fontFamily: '"EB Garamond", Garamond, "Times New Roman", serif',
              },
              {
                id: 'Bembolz' as const,
                label: 'Bembolz',
                fontFamily: '"Bembo", "Palatino Linotype", "Book Antiqua", Palatino, serif',
              },
              {
                id: 'Comic Sans' as const,
                label: 'Comic Sans',
                fontFamily: '"Comic Sans MS", "Comic Neue", "Comic Sans", cursive, sans-serif',
              },
              {
                id: 'System Serif' as const,
                label: 'System Serif',
                fontFamily: 'serif',
              },
              {
                id: 'System Sans' as const,
                label: 'System Sans',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              },
              {
                id: 'Monospace' as const,
                label: 'Monospace',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              },
              {
                id: 'Custom' as const,
                label: settings.customFontName ? settings.customFontName : 'Custom',
                fontFamily: settings.customFontName ? `"${settings.customFontName}", serif` : 'serif',
              },
            ].map((font) => {
              const isSelected = settings.typography === font.id;
              return (
                <button
                  key={font.id}
                  onClick={() => updateSetting('typography', font.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                    isSelected
                      ? 'bg-[#1d1430] border-[#b876fc]'
                      : 'bg-[#12131c] border-transparent hover:border-white/10'
                  }`}
                >
                  <span
                    className={`text-xl font-bold select-none shrink-0 ${
                      isSelected ? 'text-[#b876fc]' : 'text-white/80'
                    }`}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    Aa
                  </span>
                  <span
                    className={`text-sm font-semibold truncate ${
                      isSelected ? 'text-white font-bold' : 'text-white/90'
                    }`}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    {font.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => fontFileInputRef.current?.click()}
              className="text-xs font-semibold text-[#b876fc] hover:underline cursor-pointer"
            >
              Import Custom Font
            </button>
          </div>
        </div>

        {/* 11. Font Weight */}
        <NovelSlider
          label="Font Weight"
          value={settings.fontWeight}
          valueDisplay={String(settings.fontWeight)}
          min={300}
          max={800}
          step={100}
          onChange={(val) => updateSetting('fontWeight', val)}
        />

        {/* 12. Font Size */}
        <NovelSlider
          label="Font Size"
          value={settings.fontSize}
          valueDisplay={`${settings.fontSize} sp`}
          min={12}
          max={34}
          step={1}
          onChange={(val) => updateSetting('fontSize', val)}
        />

        {/* 13. Line Height */}
        <NovelSlider
          label="Line Height"
          value={Math.min(2.1, settings.lineHeight)}
          valueDisplay={`${Math.min(2.1, settings.lineHeight).toFixed(2)}×`}
          min={1.1}
          max={2.1}
          step={0.05}
          onChange={(val) => updateSetting('lineHeight', parseFloat(val.toFixed(2)))}
        />

        {/* 14. Paragraph Spacing */}
        <NovelSlider
          label="Paragraph Spacing"
          value={settings.paragraphSpacing}
          valueDisplay={`${settings.paragraphSpacing} dp`}
          min={4}
          max={32}
          step={2}
          onChange={(val) => updateSetting('paragraphSpacing', val)}
        />

        {/* 15. Side Margin */}
        <NovelSlider
          label="Side Margin"
          value={Math.min(56, settings.sideMargin)}
          valueDisplay={`${Math.min(56, settings.sideMargin)} dp`}
          min={8}
          max={56}
          step={2}
          onChange={(val) => updateSetting('sideMargin', val)}
        />

        {/* 16. Top Margin */}
        <NovelSlider
          label="Top Margin"
          value={Math.min(56, settings.topMargin)}
          valueDisplay={`${Math.min(56, settings.topMargin)} dp`}
          min={4}
          max={56}
          step={2}
          onChange={(val) => updateSetting('topMargin', val)}
        />

        {/* 17. Bottom Margin */}
        <NovelSlider
          label="Bottom Margin"
          value={Math.min(56, settings.bottomMargin)}
          valueDisplay={`${Math.min(56, settings.bottomMargin)} dp`}
          min={4}
          max={56}
          step={2}
          onChange={(val) => updateSetting('bottomMargin', val)}
        />

        {/* 18. Text Alignment */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Text Alignment</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Aligned (Left) */}
            <button
              onClick={() => updateSetting('textAlignment', 'aligned')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.textAlignment === 'aligned'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-2 flex flex-col justify-center gap-1 items-start ${
                  settings.textAlignment === 'aligned' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-5 h-1 rounded-full ${
                    settings.textAlignment === 'aligned' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-3.5 h-1 rounded-full ${
                    settings.textAlignment === 'aligned' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-5 h-1 rounded-full ${
                    settings.textAlignment === 'aligned' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-3 h-1 rounded-full ${
                    settings.textAlignment === 'aligned' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Aligned</span>
            </button>

            {/* Justified */}
            <button
              onClick={() => updateSetting('textAlignment', 'justified')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                settings.textAlignment === 'justified'
                  ? 'bg-[#1d1430] border-[#b876fc]'
                  : 'bg-[#12131c] border-transparent hover:border-white/10'
              }`}
            >
              <div
                className={`w-9 h-11 rounded-md p-2 flex flex-col justify-center gap-1 items-center ${
                  settings.textAlignment === 'justified' ? 'bg-[#2d1b4c]' : 'bg-[#1b1c28]'
                }`}
              >
                <div
                  className={`w-5 h-1 rounded-full ${
                    settings.textAlignment === 'justified' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-5 h-1 rounded-full ${
                    settings.textAlignment === 'justified' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-5 h-1 rounded-full ${
                    settings.textAlignment === 'justified' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
                <div
                  className={`w-5 h-1 rounded-full ${
                    settings.textAlignment === 'justified' ? 'bg-[#b876fc]' : 'bg-[#e2e8f0]'
                  }`}
                />
              </div>
              <span className="text-sm font-bold text-white">Justified</span>
            </button>
          </div>
        </div>

        {/* 19. Hyphenation */}
        <div
          onClick={() => updateSetting('hyphenation', !settings.hyphenation)}
          className="flex items-center justify-between py-1 px-1 rounded-2xl hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
        >
          <div>
            <h3 className="text-[15px] font-bold text-white">Hyphenation</h3>
          </div>
          <AppToggleSwitch
            checked={settings.hyphenation}
            onChange={(next) => updateSetting('hyphenation', next)}
          />
        </div>

        {/* 20. Reader Behavior */}
        <div className="space-y-3 pt-2">
          <h3 className="text-[15px] font-bold text-white tracking-tight">Reader Behavior</h3>
          <div
            onClick={() => updateSetting('keepScreenAwake', !settings.keepScreenAwake)}
            className="flex items-center justify-between py-1 px-1 rounded-2xl hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
          >
            <div>
              <h4 className="text-sm font-semibold text-white">Keep Screen Awake</h4>
            </div>
            <AppToggleSwitch
              checked={settings.keepScreenAwake}
              onChange={(next) => updateSetting('keepScreenAwake', next)}
            />
          </div>
        </div>

        {/* Reset to Defaults button matching Manga Reader settings sheet */}
        <div className="pt-2 pb-2">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="w-full h-[52px] px-5 rounded-[14px] bg-[#11121c] hover:bg-[#181926] active:scale-[0.99] border border-white/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer group shadow-sm"
          >
            <svg
              className="w-4 h-4 text-white group-hover:rotate-[-45deg] transition-transform duration-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            <span className="text-[15px] font-semibold text-white tracking-wide">
              Reset to Defaults
            </span>
          </button>
        </div>
      </div>

      {/* Custom Colors Modal (Matching App Settings Tabs Option Card Size) */}
      {showCustomColorModal && (
        <div
          className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-[14px] py-4 sm:px-4 animate-in fade-in duration-150"
          onClick={() => setShowCustomColorModal(false)}
        >
          <div
            className="w-full max-w-[432px] sm:max-w-[482px] max-h-[85vh] h-[420px] bg-[#2a292f] border-0 outline-none rounded-[28px] p-6 shadow-2xl flex flex-col justify-between select-none animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <h3 className="text-xl font-bold text-white tracking-tight shrink-0 mb-1">
              Custom Page Colors
            </h3>

            {/* Live Preview Box */}
            <div
              className="w-full h-[100px] sm:h-[110px] rounded-[18px] flex items-center justify-center px-6 transition-colors duration-150 select-none shadow-inner overflow-hidden shrink-0"
              style={{
                backgroundColor: brightnessToHex(tempPageBrightness),
              }}
            >
              <span
                className="text-base sm:text-lg font-semibold tracking-tight text-center transition-colors duration-150"
                style={{
                  color: brightnessToHex(tempTextBrightness),
                }}
              >
                A comfortable page preview
              </span>
            </div>

            {/* Brightness Sliders */}
            <div className="space-y-2.5 py-1 flex-1 flex flex-col justify-center">
              <NovelSlider
                label="Page Brightness"
                value={tempPageBrightness}
                valueDisplay={`${tempPageBrightness}%`}
                min={0}
                max={100}
                step={1}
                onChange={setTempPageBrightness}
              />

              <NovelSlider
                label="Text Brightness"
                value={tempTextBrightness}
                valueDisplay={`${tempTextBrightness}%`}
                min={0}
                max={100}
                step={1}
                onChange={setTempTextBrightness}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-6 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCustomColorModal(false)}
                className="text-[15px] font-semibold text-[#c084fc] hover:text-[#d8b4fe] transition-colors cursor-pointer px-2 py-1 select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustomColors}
                className="text-[15px] font-semibold text-[#c084fc] hover:text-[#d8b4fe] transition-colors cursor-pointer px-2 py-1 select-none"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input for Device Fonts */}
      <input
        type="file"
        ref={fontFileInputRef}
        accept=".ttf,.otf,.woff,.woff2,font/*"
        onChange={handleFontFileChange}
        className="hidden"
      />



      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[7500] px-4 py-2.5 rounded-full bg-[#1e2030]/95 text-white text-xs font-semibold shadow-2xl border border-white/15 backdrop-blur-md animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
