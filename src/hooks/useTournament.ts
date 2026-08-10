import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, readRemoteState, saveRemoteState, subscribeRemote } from '../services/leagueSupabase'
import type { HistoryItem, TournamentState } from '../types'
import { generateGroups, generateMatches, initialState, normalizeState, standings, starCounts } from '../utils/tournament'

const KEY = 'efc-championship-v3'
const readLocal = () => { try { return normalizeState(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return initialState() } }

export function useTournament(canEdit: boolean, userId?: string) {
  const [state, setState] = useState<TournamentState>(readLocal)
  const [message, setMessage] = useState('')
  const [syncing, setSyncing] = useState(isSupabaseConfigured)
  const hydrated = useRef(!isSupabaseConfigured)
  const mutate = useCallback((fn: (s: TournamentState) => TournamentState) => { if (!canEdit) return; setState(s => ({ ...fn(s), updatedAt: new Date().toISOString() })) }, [canEdit])

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); if (!isSupabaseConfigured || !hydrated.current || !canEdit || !userId) return; const id = setTimeout(() => { setSyncing(true); saveRemoteState(state, userId).catch(e => setMessage(e.message)).finally(() => setSyncing(false)) }, 350); return () => clearTimeout(id) }, [state, canEdit, userId])
  useEffect(() => { if (!isSupabaseConfigured) return; let active = true; readRemoteState().then(s => { if(active) { hydrated.current = true; setState(s); setSyncing(false) } }).catch(e => { setMessage(e.message); setSyncing(false) }); const stop = subscribeRemote(s => active && setState(s)); return () => { active = false; stop() } }, [])
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 3500); return () => clearTimeout(id) }, [message])

  const allStandings = useMemo(() => standings(state.teams, state.matches), [state.teams, state.matches])
  const stars = useMemo(() => starCounts(state.history), [state.history])
  const addTeam = (name: string, imageUrl: string) => { if (state.teams.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) return setMessage('Team already exists.'); mutate(s => ({ ...s, teams: [...s.teams, { id: crypto.randomUUID(), name: name.trim(), imageUrl: imageUrl.trim(), createdAt: new Date().toISOString() }] })); setMessage('Team added successfully.') }
  const editTeam = (id: string, name: string, imageUrl: string) => mutate(s => ({ ...s, teams: s.teams.map(t => t.id === id ? { ...t, name, imageUrl } : t) }))
  const deleteTeam = (id: string) => { if (state.status !== 'registration') return setMessage('Teams cannot be deleted after the tournament starts.'); mutate(s => ({ ...s, teams: s.teams.filter(t => t.id !== id) })) }
  const draw = () => { if (state.teams.length < 4) return setMessage('Minimum 4 teams required to start tournament.'); const groups = generateGroups(state.teams); mutate(s => ({ ...s, groups, matches: generateMatches(groups), status: 'groups', stage: 'Group Stage' })); setMessage('Groups confirmed. Fixtures generated.') }
  const regenerate = () => { if (state.matches.some(m => m.homeScore !== null)) return setMessage('Cannot regenerate groups after results are entered.'); const groups = generateGroups(state.teams); mutate(s => ({ ...s, groups, matches: generateMatches(groups) })) }
  const score = (id: string, homeScore: number | null, awayScore: number | null) => mutate(s => ({ ...s, matches: s.matches.map(m => m.id === id ? { ...m, homeScore, awayScore, playedAt: homeScore !== null && awayScore !== null ? new Date().toISOString() : undefined } : m) }))
  const complete = (winnerId: string) => { const winner = state.teams.find(t => t.id === winnerId); if (!winner) return; const item: HistoryItem = { id: crypto.randomUUID(), tournamentNumber: state.tournamentNumber, winnerId, winnerName: winner.name, completedAt: new Date().toISOString() }; mutate(s => ({ ...s, status: 'completed', stage: 'Completed', winnerId, history: [...s.history.filter(h => h.tournamentNumber !== s.tournamentNumber), item] })); setMessage(`${winner.name} crowned champion!`) }
  const nextTournament = () => mutate(s => ({ ...s, tournamentNumber: s.tournamentNumber + 1, status: 'registration', stage: 'Team Registration', groups: [], matches: [], winnerId: null }))
  const updateHistory = (id: string, winnerName: string) => mutate(s => ({ ...s, history: s.history.map(h => h.id === id ? { ...h, winnerName } : h) }))
  return { state, allStandings, stars, message, syncing, setMessage, addTeam, editTeam, deleteTeam, draw, regenerate, score, complete, nextTournament, updateHistory }
}
