-- Storage buckets and Realtime.
--   photos  private  original uploads (served through signed URLs)
--   masks   private  SAM masks for the 3D step
--   glbs    public   per-item 3D models and cutout crops (viewer + share page)
--   reels   public   exported MP4s, covers and generated worlds

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', false, 15 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('masks', 'masks', false, 10 * 1024 * 1024, array['image/png']),
  ('glbs', 'glbs', true, 25 * 1024 * 1024, array['model/gltf-binary', 'application/octet-stream', 'image/png', 'image/webp']),
  ('reels', 'reels', true, 100 * 1024 * 1024, array['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public buckets are readable through their public URL without a policy.
-- No insert/update/delete policies: uploads happen server-side with the service role.

-- Realtime: the build screen subscribes to item changes for its job, and to the job row
-- for status changes such as failed or budget_exceeded.
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.jobs;
