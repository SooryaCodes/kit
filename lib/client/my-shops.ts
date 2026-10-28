"use client";

// No accounts: this browser keeps the edit token of every shop page it created.
// Losing it means the page can't be edited from here; the page itself stays up.

const KEY = "kit:shops";

export interface SavedShop {
  jobId: string;
  pageId: string;
  slug: string;
  token: string;
  title: string;
  createdAt: string;
}

export function listShops(): SavedShop[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedShop[]) : [];
  } catch {
    return [];
  }
}

export function findShop(jobId: string): SavedShop | undefined {
  return listShops().find((s) => s.jobId === jobId);
}

export function saveShop(shop: SavedShop): void {
  try {
    const rest = listShops().filter((s) => s.pageId !== shop.pageId);
    localStorage.setItem(KEY, JSON.stringify([shop, ...rest].slice(0, 100)));
  } catch {
    // storage blocked: editing works this session only
  }
}
