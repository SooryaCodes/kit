-- Studio settings saved with each exported Reel, so it can be re-edited and the share page can describe it.
alter table public.reels add column settings jsonb not null default '{}'::jsonb;
alter table public.reels add column title text;
