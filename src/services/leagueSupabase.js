import {
  isSupabaseConfigured,
  LEAGUE_SLUG,
  LEAGUE_TABLE,
  supabase,
  TEAM_ICONS_BUCKET,
} from '../lib/supabase'
import { createLeagueState } from '../utils/league/leagueRules'

function normalizeRemoteState(record) {
  if (!record) return createLeagueState()

  return {
    results: record.results && typeof record.results === 'object' ? record.results : {},
    teams: Array.isArray(record.teams) ? record.teams : [],
  }
}

export async function readRemoteLeagueState() {
  if (!supabase) return { state: createLeagueState(), updatedAt: null }

  const { data, error } = await supabase
    .from(LEAGUE_TABLE)
    .select('teams, results, updated_at')
    .eq('slug', LEAGUE_SLUG)
    .maybeSingle()

  if (error) throw error

  return {
    state: normalizeRemoteState(data),
    updatedAt: data?.updated_at || null,
  }
}

export async function saveRemoteLeagueState(state, userId) {
  if (!supabase || !userId) throw new Error('Admin login is required to publish updates.')

  const updatedAt = new Date().toISOString()
  const { error } = await supabase.from(LEAGUE_TABLE).upsert(
    {
      results: state.results,
      slug: LEAGUE_SLUG,
      teams: state.teams,
      updated_at: updatedAt,
      updated_by: userId,
    },
    { onConflict: 'slug' },
  )

  if (error) throw error
  return updatedAt
}

export function subscribeToRemoteLeagueState(onChange, onStatusChange) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel('public-league-live-state')
    .on(
      'postgres_changes',
      {
        event: '*',
        filter: `slug=eq.${LEAGUE_SLUG}`,
        schema: 'public',
        table: LEAGUE_TABLE,
      },
      (payload) => {
        if (!payload.new) return
        onChange(normalizeRemoteState(payload.new), payload.new.updated_at || null)
      },
    )
    .subscribe((status) => onStatusChange?.(status))

  return () => {
    supabase.removeChannel(channel)
  }
}

function getFileExtension(file) {
  const nameExtension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (nameExtension) return nameExtension
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function uploadTeamIcon(file, teamId, userId) {
  if (!supabase || !userId) throw new Error('Admin login is required to upload a team image.')

  const filePath = `${userId}/${teamId}.${getFileExtension(file)}`
  const { error } = await supabase.storage.from(TEAM_ICONS_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })

  if (error) throw error

  const { data } = supabase.storage.from(TEAM_ICONS_BUCKET).getPublicUrl(filePath)
  return { image: data.publicUrl, imagePath: filePath }
}

export async function removeTeamIcon(imagePath) {
  if (!supabase || !imagePath) return
  const { error } = await supabase.storage.from(TEAM_ICONS_BUCKET).remove([imagePath])
  if (error) throw error
}

export { isSupabaseConfigured }
