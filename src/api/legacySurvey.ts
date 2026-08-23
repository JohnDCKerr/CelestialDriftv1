/**
 * Real astronomical imagery for Celestial Drift comes from the DESI Legacy
 * Imaging Surveys (Legacy Surveys) DR11 JPEG cutout service, documented at
 * https://www.legacysurvey.org/viewer/urls/
 *
 * This is the ONLY place in the app that builds a request for sky imagery.
 * Nothing here generates, mocks, or falls back to synthetic imagery — if the
 * service has nothing useful at a coordinate, callers show the "nothing
 * useful at this coordinate" empty state (see ExplorationScreen).
 */

const CUTOUT_BASE = "https://www.legacysurvey.org/viewer/jpeg-cutout";

// The documented cutout endpoint caps images at 512px per dimension.
export const MAX_CUTOUT_PX = 512;

export const DEFAULT_LAYER = "ls-dr11";

export interface CutoutParams {
  ra: number;
  dec: number;
  /** Arcsec per pixel. Smaller = more zoomed in. */
  pixscale: number;
  width?: number;
  height?: number;
  layer?: string;
}

/** Build the Legacy Survey jpeg-cutout URL for a given sky position and zoom level. */
export function buildCutoutUrl({
  ra,
  dec,
  pixscale,
  width = MAX_CUTOUT_PX,
  height = MAX_CUTOUT_PX,
  layer = DEFAULT_LAYER,
}: CutoutParams): string {
  const w = Math.min(Math.round(width), MAX_CUTOUT_PX);
  const h = Math.min(Math.round(height), MAX_CUTOUT_PX);
  const params = new URLSearchParams({
    ra: ra.toFixed(6),
    dec: dec.toFixed(6),
    layer,
    pixscale: pixscale.toFixed(3),
    width: String(w),
    height: String(h),
  });
  return `${CUTOUT_BASE}?${params.toString()}`;
}

/**
 * Round RA/Dec/pixscale to a coarse grid so small pan/zoom jitter reuses a
 * cached cutout instead of re-requesting from the service on every frame.
 */
export function cutoutCacheKey(ra: number, dec: number, pixscale: number, layer = DEFAULT_LAYER): string {
  const raK = ra.toFixed(4);
  const decK = dec.toFixed(4);
  const psK = pixscale.toFixed(3);
  return `${layer}:${raK}:${decK}:${psK}`;
}

interface CacheEntry {
  url: string;
  loadedAt: number;
}

const MAX_CACHE_ENTRIES = 40;

/**
 * Small LRU-ish in-memory cache of recently loaded cutouts, keyed by rounded
 * coordinates. Keeps recent destinations feeling instant on revisit without
 * ever storing a full high-res survey image on the device.
 */
class CutoutCache {
  private entries = new Map<string, CacheEntry>();

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.url;
  }

  set(key: string, url: string) {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { url, loadedAt: Date.now() });
    if (this.entries.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
  }
}

export const cutoutCache = new CutoutCache();

/** Preload an image URL into the browser cache; resolves true on success, false on failure. */
export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
