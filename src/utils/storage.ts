import type { SavedDestination, SkyTarget } from "../types";

const STORAGE_KEY = "celestial-drift.saved.v1";

export function loadSaved(): SavedDestination[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function persist(list: SavedDestination[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable (private mode, quota, etc). Fail silently —
    // Saved just won't persist across sessions.
  }
}

export function saveDestination(target: SkyTarget): SavedDestination {
  const list = loadSaved();
  const id = `${target.ra_deg.toFixed(4)}:${target.dec_deg.toFixed(4)}`;
  const existing = list.find((d) => d.id === id);
  if (existing) return existing;
  const entry: SavedDestination = { ...target, id, savedAt: Date.now() };
  persist([entry, ...list]);
  return entry;
}

export function removeSaved(id: string) {
  persist(loadSaved().filter((d) => d.id !== id));
}

export function isSaved(ra_deg: number, dec_deg: number): boolean {
  const id = `${ra_deg.toFixed(4)}:${dec_deg.toFixed(4)}`;
  return loadSaved().some((d) => d.id === id);
}
