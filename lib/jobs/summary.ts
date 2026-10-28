// Light job cards for My Reels: status, template, a few cutouts, and the latest exported Reel.

import "server-only";
import { supabaseAdmin } from "../supabase/server";
import { publicUrl, signedUrl } from "../supabase/storage";
import { TEMPLATES, isTemplateId } from "../templates";

export interface JobSummary {
  id: string;
  createdAt: string;
  status: string;
  template: string;
  items: number;
  thumbs: string[];
  reel: { slug: string; coverUrl: string | null; title: string | null } | null;
}

export async function summarise(ids: string[]): Promise<JobSummary[]> {
  if (!ids.length) return [];
  const db = supabaseAdmin();
  const [{ data: jobs }, { data: items }, { data: reels }] = await Promise.all([
    db.from("jobs").select("id, created_at, status, template").in("id", ids),
    db.from("items").select("job_id, idx, crop_path").in("job_id", ids).order("idx"),
    db.from("reels").select("job_id, share_slug, cover_path, title, created_at, mp4_path").in("job_id", ids).not("mp4_path", "is", null).order("created_at", { ascending: false }),
  ]);

  const byJob = new Map<string, string[]>();
  for (const i of items ?? []) if (i.crop_path) byJob.set(i.job_id, [...(byJob.get(i.job_id) ?? []), i.crop_path]);

  const out = await Promise.all(
    (jobs ?? []).map(async (j): Promise<JobSummary> => {
      const crops = byJob.get(j.id) ?? [];
      const reel = (reels ?? []).find((r) => r.job_id === j.id);
      return {
        id: j.id,
        createdAt: j.created_at,
        status: j.status,
        template: isTemplateId(j.template) ? TEMPLATES[j.template].name : "Reel",
        items: crops.length,
        thumbs: await Promise.all(crops.slice(0, 4).map((p) => signedUrl("crops", p))),
        reel: reel?.share_slug ? { slug: reel.share_slug, coverUrl: reel.cover_path ? publicUrl("covers", reel.cover_path) : null, title: reel.title } : null,
      };
    }),
  );
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
