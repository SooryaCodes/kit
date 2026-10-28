-- Storage buckets and Realtime.
--   photos  private  original uploads                 10 MB
--   masks   private  SAM masks for the 3D step        10 MB
--   crops   private  item cutouts                     10 MB
--   glbs    public   per-item 3D models                5 MB
--   reels   public   exported videos                  50 MB
--   covers  public   covers and generated worlds      10 MB
-- Private files are read through 1 hour signed URLs made by the server (fal and Meta read those).
-- Public files are served from their public URL; paths are uuid-based.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('masks',  'masks',  false, 10 * 1024 * 1024, array['image/png']),
  ('crops',  'crops',  false, 10 * 1024 * 1024, array['image/png', 'image/webp']),
  ('glbs',   'glbs',   true,   5 * 1024 * 1024, array['model/gltf-binary', 'application/octet-stream']),
  ('reels',  'reels',  true,  50 * 1024 * 1024, array['video/mp4', 'video/webm']),
  ('covers', 'covers', true,  10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage access: no policies on storage.objects for anon or authenticated, so only the
-- service role (server) can upload, update, delete or list. Public buckets still serve
-- files by public URL, which does not go through RLS.

-- Realtime: the build screen subscribes to item changes for its job ("item ready"),
-- and to the job row for status changes such as failed or budget_exceeded.
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.jobs;
