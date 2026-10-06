export function safeGetItem<T = string>(
  key: string,
  defaultValue: T,
  parseJson?: boolean
): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;

    if (parseJson || typeof defaultValue !== 'string') {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return raw as unknown as T;
  } catch (err) {
    console.warn(`[storage] Failed to retrieve key ${key}:`, err);
    return defaultValue;
  }
}

export function safeSetItem(key: string, value: any, stringify?: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const val =
      stringify || typeof value !== 'string' ? JSON.stringify(value) : value;
    localStorage.setItem(key, val);
  } catch (err) {
    console.warn(`[storage] Failed to set key ${key}:`, err);
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] Failed to remove key ${key}:`, err);
  }
}
