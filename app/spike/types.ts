// Shape of public/spike/report.json, as written by scripts/spike.ts (fields the viewer uses).

export type Quality = "good" | "rough" | "bad";

export interface SpikeItem {
  index: number;
  name: string;
  phrase: string;
  category: string;
  source: "phrase" | "box" | "extra";
  confidence: number | null;
  flat: boolean;
  partial: boolean;
  areaPct: number;
  crop: string;
  mask: string;
  glb?: string;
  glbRaw?: string;
  glbPerItem?: string;
  bytesBefore?: number;
  bytesAfter?: number;
  trianglesBefore?: number;
  trianglesAfter?: number;
  reconstructMs?: number;
  error?: string;
}

export interface SpikePhoto {
  file: string;
  slug: string;
  photo: string;
  width: number;
  height: number;
  lister: { model: string; listed: number };
  items: SpikeItem[];
  dropped: Array<{ name: string; reason: string }>;
  steps: Record<string, { ms: number; usd: number }>;
  threeD?: { combined?: { masks: number; glbs: number; ok: boolean }; perItem?: { calls: number; ok: number } };
  totalUsd: number;
  totalMs: number;
  status: string;
  error?: string;
  notes: string[];
}

export interface SpikeReport {
  summary: { runAt: string; photos: number; items: number; glbs: number; totalUsd: number; usdPerItem: number; usdPerPhoto: number; avgSecondsPerPhoto: number };
  reports: SpikePhoto[];
}

export type Ratings = Record<string, Quality>;
