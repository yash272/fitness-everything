alter table public.workouts drop constraint if exists workouts_split_check;

alter table public.exercises
  add column if not exists tracking_type text not null default 'weighted';

alter table public.exercise_sets
  alter column reps drop not null;

alter table public.exercise_sets
  alter column weight drop not null;

alter table public.exercise_sets
  add column if not exists duration_minutes numeric(7, 2) check (duration_minutes > 0);
