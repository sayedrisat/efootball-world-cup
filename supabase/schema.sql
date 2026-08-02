-- Run this file once from the Supabase SQL Editor.

create table if not exists public.tournament_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.tournament_admins enable row level security;

create or replace function public.is_tournament_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tournament_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_tournament_admin() from public;
grant execute on function public.is_tournament_admin() to authenticated;

drop policy if exists "Admins can view their membership" on public.tournament_admins;
create policy "Admins can view their membership"
on public.tournament_admins
for select
to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.league_tournaments (
  slug text primary key,
  teams jsonb not null default '[]'::jsonb,
  results jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint league_teams_are_array check (jsonb_typeof(teams) = 'array'),
  constraint league_results_are_object check (jsonb_typeof(results) = 'object')
);

insert into public.league_tournaments (slug)
values ('main')
on conflict (slug) do nothing;

alter table public.league_tournaments enable row level security;

drop policy if exists "Tournament is publicly readable" on public.league_tournaments;
create policy "Tournament is publicly readable"
on public.league_tournaments
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can create tournaments" on public.league_tournaments;
create policy "Admins can create tournaments"
on public.league_tournaments
for insert
to authenticated
with check ((select public.is_tournament_admin()));

drop policy if exists "Admins can update tournaments" on public.league_tournaments;
create policy "Admins can update tournaments"
on public.league_tournaments
for update
to authenticated
using ((select public.is_tournament_admin()))
with check ((select public.is_tournament_admin()));

drop policy if exists "Admins can delete tournaments" on public.league_tournaments;
create policy "Admins can delete tournaments"
on public.league_tournaments
for delete
to authenticated
using ((select public.is_tournament_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-icons',
  'team-icons',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read team icons" on storage.objects;
create policy "Admins can read team icons"
on storage.objects
for select
to authenticated
using (bucket_id = 'team-icons' and (select public.is_tournament_admin()));

drop policy if exists "Admins can upload team icons" on storage.objects;
create policy "Admins can upload team icons"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'team-icons' and (select public.is_tournament_admin()));

drop policy if exists "Admins can update team icons" on storage.objects;
create policy "Admins can update team icons"
on storage.objects
for update
to authenticated
using (bucket_id = 'team-icons' and (select public.is_tournament_admin()))
with check (bucket_id = 'team-icons' and (select public.is_tournament_admin()));

drop policy if exists "Admins can delete team icons" on storage.objects;
create policy "Admins can delete team icons"
on storage.objects
for delete
to authenticated
using (bucket_id = 'team-icons' and (select public.is_tournament_admin()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'league_tournaments'
  ) then
    alter publication supabase_realtime add table public.league_tournaments;
  end if;
end $$;

-- After creating the admin in Authentication > Users, run this separately:
-- insert into public.tournament_admins (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict (user_id) do nothing;
