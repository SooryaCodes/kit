-- Core tables: jobs, items, reels, model_cache, api_spend, job_requests.

create extension if not exists pgcrypto;

create type public.job_status as enum (
  'uploaded', 'listing', 'segmenting', 'awaiting_confirm', 'reconstructing', 'ready', 'failed', 'budget_exceeded'
);
create type public.item_status as enum (
  'pending', 'segmented', 'reconstructing', 'ready', 'fallback', 'failed'
);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- jobs: one photo going through the pipeline
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  photo_path text,
  photo_hash text,
  template text,
  status public.job_status not null default 'uploaded',
  timings jsonb not null default '{}'::jsonb,
  cost jsonb not null default '{}'::jsonb,
  error text,
  -- friendly message shown to the user when a job stops (e.g. budget_exceeded)
  user_message text
);
create index jobs_photo_hash_idx on public.jobs (photo_hash);
create index jobs_created_at_idx on public.jobs (created_at);
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- items: one object found in the photo
create table public.items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  idx integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  phrase text,
  category text,
  box jsonb,
  mask_path text,
  crop_path text,
  glb_path text,
  status public.item_status not null default 'pending',
  -- fal queue request id: lets the webhook find the item and stops double submits
  fal_request_id text,
  brand text,
  model text,
  price numeric(12, 2),
  currency text,
  link text,
  confidence real,
  fallback boolean not null default false,
  user_edited boolean not null default false,
  unique (job_id, idx)
);
create index items_job_id_idx on public.items (job_id);
create index items_fal_request_id_idx on public.items (fal_request_id);
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- reels: exported videos and share pages
create table public.reels (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  preset text,
  world_path text,
  cover_path text,
  mp4_path text,
  share_slug text unique
);
create index reels_job_id_idx on public.reels (job_id);

-- model_cache: model responses keyed by input hash
create table public.model_cache (
  key text primary key,
  provider text not null,
  model text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

-- api_spend: one row per paid model call; lib/budget.ts sums it for the caps
create table public.api_spend (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  provider text not null check (provider in ('meta', 'baseten', 'fal')),
  model text not null,
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  job_id text,
  label text
);
create index api_spend_created_at_idx on public.api_spend (created_at);
create index api_spend_job_id_idx on public.api_spend (job_id);

create or replace function public.spend_by_provider()
returns table (provider text, cost_usd numeric)
language sql stable security definer set search_path = '' as $$
  select s.provider, coalesce(sum(s.cost_usd), 0) from public.api_spend s group by s.provider;
$$;
revoke all on function public.spend_by_provider() from public, anon, authenticated;
grant execute on function public.spend_by_provider() to service_role;

-- job_requests: per-IP rate limiting for job creation. Hashed IPs only.
create table public.job_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  job_id uuid references public.jobs (id) on delete set null
);
create index job_requests_ip_hash_created_at_idx on public.job_requests (ip_hash, created_at);
create index job_requests_job_id_idx on public.job_requests (job_id);

-- Row level security on every table.
-- All writes come from the server with the service role, which bypasses RLS:
-- there are no insert/update/delete policies for anon or authenticated.
-- Job ids are random UUIDs, so read access by id is how the build, studio and share pages work.
alter table public.jobs enable row level security;
alter table public.items enable row level security;
alter table public.reels enable row level security;
alter table public.model_cache enable row level security;
alter table public.api_spend enable row level security;
alter table public.job_requests enable row level security;

create policy "jobs are readable" on public.jobs for select to anon, authenticated using (true);
create policy "items are readable" on public.items for select to anon, authenticated using (true);
create policy "reels are readable" on public.reels for select to anon, authenticated using (true);

-- model_cache, api_spend, job_requests: server only. Remove table grants as well as relying on RLS.
revoke all on public.model_cache, public.api_spend, public.job_requests from anon, authenticated;
