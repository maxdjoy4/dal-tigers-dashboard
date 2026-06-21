-- Supabase starter schema for Dal player + goalie analytics.
-- Adapt names/types to the existing project before running in production.

create extension if not exists pgcrypto;

create table if not exists players (
  player_id uuid primary key default gen_random_uuid(),
  instat_player_name text not null,
  jersey_number int,
  position text check (position in ('F','D','G')),
  shoots text,
  active boolean default true,
  created_at timestamptz default now(),
  unique (instat_player_name)
);

create table if not exists goalies (
  goalie_id uuid primary key default gen_random_uuid(),
  instat_player_name text not null,
  jersey_number int,
  active boolean default true,
  created_at timestamptz default now(),
  unique (instat_player_name)
);

create table if not exists player_season_stats (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  player_id uuid references players(player_id) on delete cascade,
  uploaded_file_id uuid,
  raw jsonb not null,
  position text,
  toi_seconds int,
  games_played numeric,
  created_at timestamptz default now()
);

create table if not exists goalie_season_stats (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  goalie_id uuid references goalies(goalie_id) on delete cascade,
  uploaded_file_id uuid,
  raw jsonb not null,
  toi_seconds int,
  games_played numeric,
  created_at timestamptz default now()
);

create table if not exists player_metric_weights (
  metric_weight_id uuid primary key default gen_random_uuid(),
  model_type text not null check (model_type in ('Forward','Defense')),
  category text not null,
  category_weight_pct numeric not null,
  metric_key text not null,
  display_name text not null,
  source_columns_required text,
  calculation text,
  direction text not null,
  normalization text not null,
  score_method text not null,
  metric_weight_in_category_pct numeric not null,
  final_weight_pct numeric not null,
  include_in_v1_score boolean default true,
  sample_rule text,
  team_success_link text,
  notes text,
  created_at timestamptz default now(),
  unique (model_type, metric_key, category)
);

create table if not exists goalie_metric_weights (
  metric_weight_id uuid primary key default gen_random_uuid(),
  model_type text not null default 'Goalie',
  category text not null,
  category_weight_pct numeric not null,
  metric_key text not null,
  display_name text not null,
  source_columns_required text,
  calculation text,
  direction text not null,
  normalization text not null,
  score_method text not null,
  metric_weight_in_category_pct numeric not null,
  final_weight_pct numeric not null,
  include_in_v1_score boolean default true,
  sample_rule text,
  team_success_link text,
  notes text,
  created_at timestamptz default now(),
  unique (metric_key, category)
);

create table if not exists team_to_player_metric_mapping (
  id uuid primary key default gen_random_uuid(),
  team_rank int,
  team_statistic text not null,
  team_category text,
  signal_tier text,
  direction text,
  team_weight_pct numeric,
  team_codex_key text,
  skater_metric_or_proxy text,
  goalie_metric_or_proxy text,
  mapping_type text,
  team_dashboard_note text,
  created_at timestamptz default now()
);

create table if not exists player_calculated_metrics (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  player_id uuid references players(player_id) on delete cascade,
  model_type text check (model_type in ('Forward','Defense')),
  metric_key text not null,
  raw_value numeric,
  calculated_value numeric,
  score_0_100 numeric check (score_0_100 is null or (score_0_100 >= 0 and score_0_100 <= 100)),
  reliability_flag text,
  context jsonb,
  created_at timestamptz default now()
);

create table if not exists goalie_calculated_metrics (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  goalie_id uuid references goalies(goalie_id) on delete cascade,
  metric_key text not null,
  raw_value numeric,
  calculated_value numeric,
  score_0_100 numeric check (score_0_100 is null or (score_0_100 >= 0 and score_0_100 <= 100)),
  reliability_flag text,
  context jsonb,
  created_at timestamptz default now()
);

create table if not exists player_scores (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  player_id uuid references players(player_id) on delete cascade,
  model_type text check (model_type in ('Forward','Defense')),
  overall_score numeric check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  category_scores jsonb not null default '{}'::jsonb,
  strongest_kpis jsonb not null default '[]'::jsonb,
  development_kpis jsonb not null default '[]'::jsonb,
  reliability_score numeric,
  reliability_flag text,
  context_flags jsonb not null default '{}'::jsonb,
  calculated_at timestamptz default now(),
  unique (season, player_id, model_type)
);

create table if not exists goalie_scores (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  goalie_id uuid references goalies(goalie_id) on delete cascade,
  overall_score numeric check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  category_scores jsonb not null default '{}'::jsonb,
  strongest_kpis jsonb not null default '[]'::jsonb,
  development_kpis jsonb not null default '[]'::jsonb,
  reliability_score numeric,
  reliability_flag text,
  context_flags jsonb not null default '{}'::jsonb,
  calculated_at timestamptz default now(),
  unique (season, goalie_id)
);

create table if not exists player_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid,
  season text not null,
  snapshot_date timestamptz not null default now(),
  player_id uuid references players(player_id) on delete cascade,
  player_name text not null,
  position text,
  model_type text check (model_type in ('Forward','Defense')),
  games_played numeric,
  toi_minutes numeric,
  overall_score numeric,
  offensive_score numeric,
  defensive_score numeric,
  transition_score numeric,
  puck_management_score numeric,
  battle_compete_score numeric,
  possession_score numeric,
  special_teams_score numeric,
  discipline_risk_score numeric,
  reliability_score numeric,
  reliability_label text,
  role_tags jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists goalie_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid,
  season text not null,
  snapshot_date timestamptz not null default now(),
  goalie_id uuid references goalies(goalie_id) on delete cascade,
  goalie_name text not null,
  games_played numeric,
  toi_minutes numeric,
  overall_score numeric,
  defensive_score numeric,
  puck_management_score numeric,
  battle_compete_score numeric,
  possession_score numeric,
  special_teams_score numeric,
  discipline_risk_score numeric,
  reliability_score numeric,
  reliability_label text,
  role_tags jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists player_interval_scores (
  id uuid primary key default gen_random_uuid(),
  current_upload_id uuid,
  previous_upload_id uuid,
  season text not null,
  player_id uuid references players(player_id) on delete cascade,
  player_name text not null,
  position text,
  interval_start_date timestamptz,
  interval_end_date timestamptz,
  games_added numeric,
  toi_added_minutes numeric,
  overall_interval_score numeric,
  offensive_interval_score numeric,
  defensive_interval_score numeric,
  transition_interval_score numeric,
  puck_management_interval_score numeric,
  battle_compete_interval_score numeric,
  possession_interval_score numeric,
  special_teams_interval_score numeric,
  discipline_risk_interval_score numeric,
  overall_score_change numeric,
  reliability_change numeric,
  strongest_improvement text,
  biggest_decline text,
  trend_label text,
  created_at timestamptz default now()
);

create table if not exists goalie_interval_scores (
  id uuid primary key default gen_random_uuid(),
  current_upload_id uuid,
  previous_upload_id uuid,
  season text not null,
  goalie_id uuid references goalies(goalie_id) on delete cascade,
  goalie_name text not null,
  interval_start_date timestamptz,
  interval_end_date timestamptz,
  games_added numeric,
  toi_added_minutes numeric,
  overall_interval_score numeric,
  defensive_interval_score numeric,
  puck_management_interval_score numeric,
  battle_compete_interval_score numeric,
  possession_interval_score numeric,
  special_teams_interval_score numeric,
  discipline_risk_interval_score numeric,
  overall_score_change numeric,
  reliability_change numeric,
  strongest_improvement text,
  biggest_decline text,
  trend_label text,
  created_at timestamptz default now()
);

create table if not exists coaching_focus_briefs (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  upload_id uuid,
  snapshot_id uuid,
  generated_at timestamptz not null default now(),
  model_used text,
  evidence_hash text not null,
  team_priorities_json jsonb not null default '[]'::jsonb,
  micro_priorities_json jsonb not null default '[]'::jsonb,
  staff_note_json jsonb not null default '{}'::jsonb,
  data_confidence text,
  created_by uuid,
  evidence_bundle_json jsonb,
  ai_output_json jsonb,
  fallback_used boolean not null default false
);

create unique index if not exists coaching_focus_briefs_evidence_hash_idx
  on coaching_focus_briefs (evidence_hash);
