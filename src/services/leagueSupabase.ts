import { isSupabaseConfigured, LEAGUE_SLUG, LEAGUE_TABLE, supabase } from '../lib/supabase'
import type { TournamentState } from '../types'
import { getStateMigrationKind, initialState, normalizeState, type StateMigrationKind } from '../utils/tournament'

export interface RemoteStateSnapshot {
  state: TournamentState
  migrationKind: StateMigrationKind | null
}

const snapshotFrom = (value: unknown): RemoteStateSnapshot => ({
  state: normalizeState(value),
  migrationKind: getStateMigrationKind(value),
})

export async function readRemoteState() {
  if (!supabase) return { state: initialState(), migrationKind: null } satisfies RemoteStateSnapshot
  const { data, error } = await supabase.from(LEAGUE_TABLE).select('results').eq('slug', LEAGUE_SLUG).maybeSingle()
  if (error) throw error
  return snapshotFrom(data?.results)
}

export async function saveRemoteState(state: TournamentState, userId: string) {
  if (!supabase || !userId) throw new Error('Admin authentication required.')
  const { error } = await supabase.from(LEAGUE_TABLE).upsert({ slug: LEAGUE_SLUG, teams: state.teams, results: state, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'slug' })
  if (error) throw error
}

export function subscribeRemote(onChange: (snapshot: RemoteStateSnapshot) => void) {
  if (!supabase) return () => undefined
  const client = supabase
  const channel = client.channel('championship-live-v3').on('postgres_changes', { event: '*', schema: 'public', table: LEAGUE_TABLE, filter: `slug=eq.${LEAGUE_SLUG}` }, payload => {
    const row = payload.new as { results?: unknown }; if (row?.results) onChange(snapshotFrom(row.results))
  }).subscribe()
  return () => { void client.removeChannel(channel) }
}

export { isSupabaseConfigured }
