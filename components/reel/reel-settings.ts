// Studio settings for one Reel. Starts from the template; every field is the user's to change.

import { TEMPLATES, type AnimationPreset, type TemplateId } from "@/lib/templates";

export type LabelMode = "off" | "name" | "name-brand" | "name-price";
export type ReelFormat = "9:16" | "1:1";

export interface ReelSettings {
  template: TemplateId;
  title: string;
  background: string;
  animation: AnimationPreset;
  labels: LabelMode;
  format: ReelFormat;
  hidden: number[];
  names: Record<number, string>;
}

export const DURATION_S = 8;
export const FPS = 30;

export const SWATCHES = ["#f4f2ee", "#e7e4de", "#fbfaf8", "#161514", "#3b3834", "#2b44ff", "#0e1660", "#dfe3ff"];

export function settingsFor(template: TemplateId): ReelSettings {
  const t = TEMPLATES[template];
  return { template, title: t.title, background: t.background, animation: t.animation, labels: t.labels, format: "9:16", hidden: [], names: {} };
}

/** Readable ink for text on a background colour. */
export function inkFor(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? "#161514" : "#ffffff";
}
