create extension if not exists pgcrypto;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  feed_url text not null unique,
  site_url text,
  source_type text not null default 'rss',
  description text,
  enabled boolean not null default true,
  fetch_interval_minutes integer not null default 60,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_source_type_check check (source_type in ('rss')),
  constraint sources_fetch_interval_check check (fetch_interval_minutes > 0)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  title text not null,
  url text not null,
  url_hash text not null unique,
  guid text,
  author text,
  summary text,
  published_at timestamptz,
  raw_item jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_source_id_idx on public.articles(source_id);
create index if not exists articles_published_at_idx on public.articles(published_at desc nulls last);
create index if not exists articles_first_seen_at_idx on public.articles(first_seen_at desc);

create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  status text not null default 'running',
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint crawl_runs_status_check check (status in ('running', 'success', 'failed'))
);

create index if not exists crawl_runs_source_id_idx on public.crawl_runs(source_id);
create index if not exists crawl_runs_started_at_idx on public.crawl_runs(started_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sources_updated_at on public.sources;
create trigger set_sources_updated_at
before update on public.sources
for each row
execute function public.set_updated_at();

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();

alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.crawl_runs enable row level security;

insert into public.sources (
  slug,
  name,
  feed_url,
  site_url,
  description,
  enabled,
  fetch_interval_minutes
)
values
  (
    '36kr',
    '36氪',
    'https://36kr.com/feed',
    'https://36kr.com',
    '36氪综合 RSS，覆盖中文科技、商业和创业资讯。',
    true,
    60
  ),
  (
    'hacker-news',
    'Hacker News',
    'https://hnrss.org/frontpage',
    'https://news.ycombinator.com',
    'Hacker News front page RSS via HNRSS.',
    true,
    60
  ),
  (
    'aihot',
    'AIHOT',
    'https://aihot.virxact.com/feed/all.xml',
    'https://aihot.virxact.com',
    'AIHOT all-feed RSS source.',
    true,
    60
  )
on conflict (slug) do update
set
  name = excluded.name,
  feed_url = excluded.feed_url,
  site_url = excluded.site_url,
  description = excluded.description,
  enabled = excluded.enabled,
  fetch_interval_minutes = excluded.fetch_interval_minutes;
