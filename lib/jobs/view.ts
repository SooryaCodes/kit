// What the client sees of a job: rows plus readable URLs (signed for private files, public for GLBs).

import "server-only";
import type { Tables } from "../database.types";
import { supabaseAdmin } from "../supabase/server";
import { publicUrl, signedUrl } from "../supabase/storage";
import { TEMPLATES, isTemplateId } from "../templates";

export interface JobItemView {
  id: string;
  idx: number;
  name: string;
  category: string | null;
  status: Tables<"items">["status"];
  confidence: number | null;
  box: { left: number; top: number; right: number; bottom: number; areaPct?: number; flat?: boolean } | null;
  cropUrl: string | null;
  glbUrl: string | null;
  fallback: boolean;
  brand: string | null;
  price: number | null;
  currency: string | null;
  link: string | null;
}

export interface JobView {
  id: string;
  createdAt: string;
  status: Tables<"jobs">["status"];
  template: { id: string; name: string };
  userMessage: string | null;
  photoUrl: string | null;
  photo: { width: number; height: number } | null;
  mode: string | null;
  timings: Record<string, number>;
  items: JobItemView[];
}

export async function getJobView(jobId: string): Promise<JobView | null> {
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return null;
  const { data: items } = await db.from("items").select("*").eq("job_id", jobId).order("idx");
  const cost = (job.cost ?? {}) as { width?: number; height?: number; mode?: string };
  const template = isTemplateId(job.template) ? TEMPLATES[job.template] : null;

  const views = await Promise.all(
    (items ?? []).map(async (i): Promise<JobItemView> => ({
      id: i.id,
      idx: i.idx,
      name: i.name,
      category: i.category,
      status: i.status,
      confidence: i.confidence,
      box: (i.box ?? null) as JobItemView["box"],
      cropUrl: i.crop_path ? await signedUrl("crops", i.crop_path) : null,
      glbUrl: i.glb_path ? publicUrl("glbs", i.glb_path) : null,
      fallback: i.fallback,
      brand: i.brand,
      price: i.price,
      currency: i.currency,
      link: i.link,
    })),
  );

  return {
    id: job.id,
    createdAt: job.created_at,
    status: job.status,
    template: { id: job.template ?? "bag", name: template?.name ?? "Reel" },
    userMessage: job.user_message,
    photoUrl: job.photo_path ? await signedUrl("photos", job.photo_path) : null,
    photo: cost.width && cost.height ? { width: cost.width, height: cost.height } : null,
    mode: cost.mode ?? null,
    timings: (job.timings ?? {}) as Record<string, number>,
    items: views,
  };
}
