create extension if not exists "pgcrypto";

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workout_date date not null,
  split text not null,
  did_workout boolean not null default false,
  steps integer check (steps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workout_date)
);

alter table public.workouts drop constraint if exists workouts_split_check;
alter table public.workouts add column if not exists did_workout boolean not null default false;
alter table public.workouts add column if not exists steps integer check (steps >= 0);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  tracking_type text not null default 'weighted',
  created_at timestamptz not null default now()
);

alter table public.exercises add column if not exists tracking_type text not null default 'weighted';

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  user_id uuid not null,
  reps integer check (reps > 0),
  weight numeric(7, 2) check (weight >= 0),
  duration_minutes numeric(7, 2) check (duration_minutes > 0),
  is_pr boolean not null default false,
  logged_at timestamptz not null default now()
);

alter table public.exercise_sets alter column reps drop not null;
alter table public.exercise_sets alter column weight drop not null;
alter table public.exercise_sets add column if not exists duration_minutes numeric(7, 2) check (duration_minutes > 0);

create table if not exists public.body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  log_date date not null,
  weight numeric(6, 2) not null check (weight > 0),
  body_fat numeric(5, 2) check (body_fat >= 0 and body_fat <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.workouts drop constraint if exists workouts_user_id_fkey;
alter table public.exercises drop constraint if exists exercises_user_id_fkey;
alter table public.exercise_sets drop constraint if exists exercise_sets_user_id_fkey;
alter table public.body_logs drop constraint if exists body_logs_user_id_fkey;

create index if not exists workouts_user_date_idx on public.workouts(user_id, workout_date desc);
create index if not exists exercises_user_name_idx on public.exercises(user_id, lower(name));
create index if not exists sets_user_logged_idx on public.exercise_sets(user_id, logged_at desc);
create index if not exists body_logs_user_date_idx on public.body_logs(user_id, log_date desc);

alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.body_logs enable row level security;

drop policy if exists "Users can read their workouts" on public.workouts;
drop policy if exists "Users can insert their workouts" on public.workouts;
drop policy if exists "Users can update their workouts" on public.workouts;
drop policy if exists "Users can delete their workouts" on public.workouts;
drop policy if exists "Personal app can read workouts" on public.workouts;
drop policy if exists "Personal app can insert workouts" on public.workouts;
drop policy if exists "Personal app can update workouts" on public.workouts;
drop policy if exists "Personal app can delete workouts" on public.workouts;

drop policy if exists "Users can read their exercises" on public.exercises;
drop policy if exists "Users can insert their exercises" on public.exercises;
drop policy if exists "Users can update their exercises" on public.exercises;
drop policy if exists "Users can delete their exercises" on public.exercises;
drop policy if exists "Personal app can read exercises" on public.exercises;
drop policy if exists "Personal app can insert exercises" on public.exercises;
drop policy if exists "Personal app can update exercises" on public.exercises;
drop policy if exists "Personal app can delete exercises" on public.exercises;

drop policy if exists "Users can read their sets" on public.exercise_sets;
drop policy if exists "Users can insert their sets" on public.exercise_sets;
drop policy if exists "Users can update their sets" on public.exercise_sets;
drop policy if exists "Users can delete their sets" on public.exercise_sets;
drop policy if exists "Personal app can read sets" on public.exercise_sets;
drop policy if exists "Personal app can insert sets" on public.exercise_sets;
drop policy if exists "Personal app can update sets" on public.exercise_sets;
drop policy if exists "Personal app can delete sets" on public.exercise_sets;

drop policy if exists "Users can read their body logs" on public.body_logs;
drop policy if exists "Users can insert their body logs" on public.body_logs;
drop policy if exists "Users can update their body logs" on public.body_logs;
drop policy if exists "Users can delete their body logs" on public.body_logs;
drop policy if exists "Personal app can read body logs" on public.body_logs;
drop policy if exists "Personal app can insert body logs" on public.body_logs;
drop policy if exists "Personal app can update body logs" on public.body_logs;
drop policy if exists "Personal app can delete body logs" on public.body_logs;

create policy "Personal app can read workouts"
  on public.workouts for select
  using (true);

create policy "Personal app can insert workouts"
  on public.workouts for insert
  with check (true);

create policy "Personal app can update workouts"
  on public.workouts for update
  using (true)
  with check (true);

create policy "Personal app can delete workouts"
  on public.workouts for delete
  using (true);

create policy "Personal app can read exercises"
  on public.exercises for select
  using (true);

create policy "Personal app can insert exercises"
  on public.exercises for insert
  with check (true);

create policy "Personal app can update exercises"
  on public.exercises for update
  using (true)
  with check (true);

create policy "Personal app can delete exercises"
  on public.exercises for delete
  using (true);

create policy "Personal app can read sets"
  on public.exercise_sets for select
  using (true);

create policy "Personal app can insert sets"
  on public.exercise_sets for insert
  with check (true);

create policy "Personal app can update sets"
  on public.exercise_sets for update
  using (true)
  with check (true);

create policy "Personal app can delete sets"
  on public.exercise_sets for delete
  using (true);

create policy "Personal app can read body logs"
  on public.body_logs for select
  using (true);

create policy "Personal app can insert body logs"
  on public.body_logs for insert
  with check (true);

create policy "Personal app can update body logs"
  on public.body_logs for update
  using (true)
  with check (true);

create policy "Personal app can delete body logs"
  on public.body_logs for delete
  using (true);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  log_date date not null,
  description text not null check (char_length(trim(description)) > 0),
  calories integer not null check (calories > 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_logs_user_date_idx on public.food_logs(user_id, log_date desc, logged_at desc);

alter table public.food_logs enable row level security;

drop policy if exists "Personal app can read food logs" on public.food_logs;
drop policy if exists "Personal app can insert food logs" on public.food_logs;
drop policy if exists "Personal app can update food logs" on public.food_logs;
drop policy if exists "Personal app can delete food logs" on public.food_logs;

create policy "Personal app can read food logs"
  on public.food_logs for select
  using (true);

create policy "Personal app can insert food logs"
  on public.food_logs for insert
  with check (true);

create policy "Personal app can update food logs"
  on public.food_logs for update
  using (true)
  with check (true);

create policy "Personal app can delete food logs"
  on public.food_logs for delete
  using (true);
