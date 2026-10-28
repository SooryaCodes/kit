"use client";

// No accounts: this browser remembers the Reels it made.

const KEY = "kit:reels";

export interface SavedReel {
  id: string;
  template: string;
  createdAt: string;
}

export function listReels(): SavedReel[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedReel[]) : [];
  } catch {
    return [];
  }
}

export function saveReel(reel: SavedReel): void {
  try {
    const rest = listReels().filter((r) => r.id !== reel.id);
    localStorage.setItem(KEY, JSON.stringify([reel, ...rest].slice(0, 100)));
  } catch {
    // private mode or storage blocked: the Reel still works, it just isn't listed
  }
}

export function forgetReel(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listReels().filter((r) => r.id !== id)));
  } catch {
    // ignore
  }
}
