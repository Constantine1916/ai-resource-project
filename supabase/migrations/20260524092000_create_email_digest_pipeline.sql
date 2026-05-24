create table if not exists public.delivery_rules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  channel_type text not null default 'email',
  enabled boolean not null default true,
  max_articles integer not null default 20,
  lookback_hours integer not null default 48,
  subject_prefix text not null default 'AI 资讯日报',
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_rules_channel_type_check check (channel_type in ('email')),
  constraint delivery_rules_max_articles_check check (max_articles > 0),
  constraint delivery_rules_lookback_hours_check check (lookback_hours > 0)
);

create table if not exists public.delivery_logs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.delivery_rules(id) on delete set null,
  status text not null default 'running',
  recipient_email text,
  article_count integer not null default 0,
  article_ids uuid[] not null default '{}'::uuid[],
  subject text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint delivery_logs_status_check check (status in ('running', 'success', 'failed', 'skipped'))
);

create index if not exists delivery_logs_rule_id_idx on public.delivery_logs(rule_id);
create index if not exists delivery_logs_started_at_idx on public.delivery_logs(started_at desc);

create table if not exists public.article_deliveries (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  rule_id uuid not null references public.delivery_rules(id) on delete cascade,
  recipient_email text not null,
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (article_id, rule_id, recipient_email)
);

create index if not exists article_deliveries_rule_id_idx on public.article_deliveries(rule_id);
create index if not exists article_deliveries_article_id_idx on public.article_deliveries(article_id);

drop trigger if exists set_delivery_rules_updated_at on public.delivery_rules;
create trigger set_delivery_rules_updated_at
before update on public.delivery_rules
for each row
execute function public.set_updated_at();

alter table public.delivery_rules enable row level security;
alter table public.delivery_logs enable row level security;
alter table public.article_deliveries enable row level security;

insert into public.delivery_rules (
  slug,
  name,
  channel_type,
  enabled,
  max_articles,
  lookback_hours,
  subject_prefix
)
values (
  'daily-email-digest',
  'Daily email digest',
  'email',
  true,
  20,
  48,
  'AI 资讯日报'
)
on conflict (slug) do update
set
  name = excluded.name,
  channel_type = excluded.channel_type,
  enabled = excluded.enabled,
  max_articles = excluded.max_articles,
  lookback_hours = excluded.lookback_hours,
  subject_prefix = excluded.subject_prefix;
