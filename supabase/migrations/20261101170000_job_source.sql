-- where a job's photo came from when Kit composed it, like a grid of a Shopify store's product photos
alter table public.jobs add column source jsonb;
