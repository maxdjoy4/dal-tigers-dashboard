create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

create table if not exists public.kpi_weights (
  id uuid primary key default gen_random_uuid(),
  kpi_key text not null unique,
  name text not null,
  category text not null check (category in ('offense', 'defense', 'special_teams')),
  weight numeric not null,
  r_value numeric not null default 0,
  direction text not null check (direction in ('higher_is_better', 'lower_is_better')),
  include_in_score boolean not null default true,
  cluster text,
  notes text,
  current_value text,
  coaching_adjustment numeric default 1,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text,
  inserted_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  game_date timestamptz not null,
  opponent text not null,
  result text not null,
  result_bucket text not null check (result_bucket in ('win', 'loss', 'tie')),
  home_away text not null default 'unknown' check (home_away in ('home', 'away', 'neutral', 'unknown')),
  goals_for integer,
  goals_against integer,
  summary text,
  uploaded_file_id uuid references public.uploaded_files (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  kpi_key text not null,
  kpi_name text not null,
  category text not null check (category in ('offense', 'defense', 'special_teams')),
  raw_value numeric,
  created_at timestamptz not null default now()
);

create index if not exists games_game_date_idx on public.games (game_date desc);
create index if not exists games_season_idx on public.games (season);
create index if not exists game_stats_game_id_idx on public.game_stats (game_id);
create index if not exists game_stats_kpi_key_idx on public.game_stats (kpi_key);

alter table public.profiles enable row level security;
alter table public.kpi_weights enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.games enable row level security;
alter table public.game_stats enable row level security;

create policy "Profiles are visible to owners"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Profiles can be updated by admins"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read kpi weights"
on public.kpi_weights
for select
using (true);

create policy "Admins manage kpi weights"
on public.kpi_weights
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read uploaded files"
on public.uploaded_files
for select
using (true);

create policy "Admins manage uploaded files"
on public.uploaded_files
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read games"
on public.games
for select
using (true);

create policy "Admins manage games"
on public.games
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read game stats"
on public.game_stats
for select
using (true);

create policy "Admins manage game stats"
on public.game_stats
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('game-uploads', 'game-uploads', false)
on conflict (id) do nothing;

create policy "Admins manage upload bucket"
on storage.objects
for all
to authenticated
using (bucket_id = 'game-uploads' and public.is_admin())
with check (bucket_id = 'game-uploads' and public.is_admin());
