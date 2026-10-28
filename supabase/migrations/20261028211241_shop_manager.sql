-- Shop Manager: customer conversations, the seller's reports, and every action the agent proposes.
-- All server only; the public page and the editor reach them through API routes.

alter table public.items
  add column offer_label text check (offer_label is null or char_length(offer_label) <= 40),
  add column size_image_path text;

create table public.conversations (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.pages (id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  item_id uuid references public.items (id) on delete set null,
  question text not null check (char_length(question) <= 500),
  answer text not null,
  created_at timestamptz not null default now()
);
create index conversations_page_idx on public.conversations (page_id, created_at desc);
create index conversations_visitor_idx on public.conversations (page_id, visitor_id, created_at desc);

create table public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  summary text not null,
  metrics jsonb not null default '{}'::jsonb,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);
create index agent_reports_page_idx on public.agent_reports (page_id, created_at desc);

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  report_id uuid references public.agent_reports (id) on delete set null,
  kind text not null check (kind in ('update_description', 'set_offer', 'add_size_image')),
  item_id uuid references public.items (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'dismissed', 'failed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index agent_actions_page_idx on public.agent_actions (page_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.agent_reports enable row level security;
alter table public.agent_actions enable row level security;
create policy "server only" on public.conversations as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.agent_reports as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.agent_actions as restrictive for all to anon, authenticated using (false) with check (false);
