import { isSupabaseConfigured, LEAGUE_SLUG, LEAGUE_TABLE, supabase } from '../lib/supabase'
import type { TournamentState } from '../types'
import { initialState, normalizeState } from '../utils/tournament'

export async function readRemoteState() {
  if (!supabase) return initialState()
  const { data, error } = await supabase.from(LEAGUE_TABLE).select('results').eq('slug', LEAGUE_SLUG).maybeSingle()
  if (error) throw error
  return normalizeState(data?.results)
}

export async function saveRemoteState(state: TournamentState, userId: string) {
  if (!supabase || !userId) throw new Error('Admin authentication required.')
  const { error } = await supabase.from(LEAGUE_TABLE).upsert({ slug: LEAGUE_SLUG, teams: state.teams, results: state, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'slug' })
  if (error) throw error
}

export function subscribeRemote(onChange: (state: TournamentState) => void) {
  if (!supabase) return () => undefined
  const client = supabase
  const channel = client.channel('championship-live-v3').on('postgres_changes', { event: '*', schema: 'public', table: LEAGUE_TABLE, filter: `slug=eq.${LEAGUE_SLUG}` }, payload => {
    const row = payload.new as { results?: unknown }; if (row?.results) onChange(normalizeState(row.results))
  }).subscribe()
  return () => { void client.removeChannel(channel) }
}

export { isSupabaseConfigured }
