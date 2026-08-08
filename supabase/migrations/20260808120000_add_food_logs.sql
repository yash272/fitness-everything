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
