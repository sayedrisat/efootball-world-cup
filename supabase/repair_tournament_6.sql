-- One-time, idempotent repair for the exact skipped Tournament #06 record.
-- Run from the Supabase SQL Editor only if an immediate database-level repair
-- is needed before the updated app is deployed and opened by an administrator.

with repair_candidate as (
  select
    slug,
    coalesce(
      (
        select jsonb_agg(entry order by position)
        from jsonb_array_elements(
          case when jsonb_typeof(results -> 'history') = 'array'
            then results -> 'history' else '[]'::jsonb end
        ) with ordinality as history(entry, position)
        where entry ->> 'id' is distinct from 'e02d6055-8f6d-410f-93f2-48b7ab91f83f'
      ),
      '[]'::jsonb
    ) as repaired_history
  from public.league_tournaments
  where slug = 'main'
    and results ->> 'version' in ('3', '4')
    and results ->> 'tournamentNumber' = '7'
    and results ->> 'status' in ('registration', 'groups', 'knockout')
    and results -> 'winnerId' = 'null'::jsonb
    and jsonb_array_length(
      case when jsonb_typeof(results -> 'teams') = 'array'
        then results -> 'teams' else '[]'::jsonb end
    ) = 8
    and jsonb_array_length(
      case when jsonb_typeof(results -> 'history') = 'array'
        then results -> 'history' else '[]'::jsonb end
    ) = 6
    and exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(results -> 'history') = 'array'
          then results -> 'history' else '[]'::jsonb end
      ) as history(entry)
      where entry ->> 'id' = 'e02d6055-8f6d-410f-93f2-48b7ab91f83f'
        and entry ->> 'tournamentNumber' = '6'
        and lower(entry ->> 'winnerName') = 'honduras'
        and entry ->> 'winnerId' = '62c035a1-0775-4df8-9e75-900d16e89f49'
        and entry ->> 'completedAt' = '2026-08-10T18:09:02.841Z'
    )
)
update public.league_tournaments as tournament
set
  results = tournament.results || jsonb_build_object(
    'version', 4,
    'tournamentNumber', 6,
    'status', 'registration',
    'stage', 'Team Registration',
    'groups', '[]'::jsonb,
    'matches', '[]'::jsonb,
    'knockoutMatches', '[]'::jsonb,
    'winnerId', null,
    'history', repair_candidate.repaired_history,
    'updatedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ),
  updated_at = now()
from repair_candidate
where tournament.slug = repair_candidate.slug
returning
  tournament.slug,
  tournament.results ->> 'tournamentNumber' as tournament_number,
  tournament.results ->> 'status' as status,
  jsonb_array_length(tournament.results -> 'history') as history_entries;
