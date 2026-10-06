/**
 * Utility for loading and persisting custom device fonts via FontFace API
 */

export const loadCustomFontFromStorage = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const fontData = localStorage.getItem('satori_custom_font_data');
    const fontName = localStorage.getItem('satori_custom_font_name');
    if (fontData && fontName) {
      const fontFace = new FontFace(fontName, `url(${fontData})`);
      const loaded = await fontFace.load();
      document.fonts.add(loaded);
      return fontName;
    }
  } catch (e) {
    console.warn('Custom font could not be restored from storage:', e);
  }
  return null;
};

export const registerAndSaveCustomFont = async (
  file: File
): Promise<{ success: boolean; fontName: string; error?: string }> => {
  if (typeof window === 'undefined') {
    return { success: false, fontName: '', error: 'Browser environment not available' };
  }

  return new Promise((resolve) => {
    try {
      const rawName = file.name.replace(/\.[^/.]+$/, '').trim();
      const safeFontName = rawName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'CustomDeviceFont';

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target?.result as string;
          if (!dataUrl) {
            resolve({ success: false, fontName: '', error: 'Empty file data' });
            return;
          }

          const fontFace = new FontFace(safeFontName, `url(${dataUrl})`);
          const loaded = await fontFace.load();
          document.fonts.add(loaded);

          try {
            localStorage.setItem('satori_custom_font_data', dataUrl);
            localStorage.setItem('satori_custom_font_name', safeFontName);
          } catch (storageErr) {
            console.warn(
              'Font file size exceeds local storage quota. Font remains active for current session.',
              storageErr
            );
          }

          resolve({ success: true, fontName: safeFontName });
        } catch (loadErr: any) {
          console.error('Failed to parse or register font file:', loadErr);
          resolve({
            success: false,
            fontName: safeFontName,
            error: loadErr?.message || 'Unsupported font file or corrupted format',
          });
        }
      };

      reader.onerror = () => {
        resolve({ success: false, fontName: '', error: 'Failed to read file from storage' });
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      resolve({ success: false, fontName: '', error: err?.message || 'Error processing font' });
    }
  });
};
