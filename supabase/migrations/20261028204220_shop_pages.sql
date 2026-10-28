-- Shop pages: one photo's products published as a public link (/k/:slug).
--   pages         the public page; anon can read published ones
--   page_secrets  edit token hashes, server only (column-level hiding is not enough under RLS)
--   events        anonymous pilot metrics; anon can insert, never read
-- Items gain the fields a shop needs: description, real size, styled photo, order and visibility.
-- Price and the buy link reuse items.price, items.currency and items.link.

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  job_id uuid not null references public.jobs (id) on delete cascade,
  mode text not null default 'shop' check (mode in ('shop', 'creator')),
  title text not null,
  handle text,
  avatar_path text,
  theme text not null default 'paper',
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  affiliate_tag text,
  og_image_path text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pages_job_id_idx on public.pages (job_id);

create table public.page_secrets (
  page_id uuid primary key references public.pages (id) on delete cascade,
  edit_token_hash text not null
);

alter table public.items
  add column description text,
  add column real_size_m numeric check (real_size_m is null or (real_size_m > 0 and real_size_m < 10)),
  add column styled_image_path text,
  add column display_order integer,
  add column hidden boolean not null default false;

create table public.events (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.pages (id) on delete cascade,
  item_id uuid references public.items (id) on delete cascade,
  type text not null check (type in ('view', 'open_3d', 'open_ar', 'ask', 'buy')),
  created_at timestamptz not null default now()
);
create index events_page_id_idx on public.events (page_id, created_at);
create index events_item_id_idx on public.events (item_id);

create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

alter table public.pages enable row level security;
alter table public.page_secrets enable row level security;
alter table public.events enable row level security;

create policy "published pages are readable" on public.pages for select to anon, authenticated using (published);
create policy "server only" on public.page_secrets as restrictive for all to anon, authenticated using (false) with check (false);
create policy "events can be recorded" on public.events for insert to anon, authenticated
  with check (exists (select 1 from public.pages p where p.id = page_id and p.published));
