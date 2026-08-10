import type { Group, HistoryItem, Match, Standing, Team, TournamentState } from '../types'

const seededHistory: HistoryItem[] = [
  ['England', 1], ['England', 2], ['Germany', 3], ['Spain', 4], ['Honduras', 5],
].map(([winnerName, tournamentNumber]) => ({ id: `history-${tournamentNumber}`, tournamentNumber: Number(tournamentNumber), winnerId: '', winnerName: String(winnerName), completedAt: `2025-0${tournamentNumber}-01T00:00:00.000Z` }))

export const initialState = (): TournamentState => ({ version: 3, tournamentNumber: 6, status: 'registration', stage: 'Team Registration', teams: [], groups: [], matches: [], history: seededHistory, winnerId: null, updatedAt: new Date().toISOString() })

export function normalizeState(value: unknown): TournamentState {
  if (!value || typeof value !== 'object') return initialState()
  const v = value as Partial<TournamentState> & { groupResults?: Record<string, {homeScore?: string; awayScore?: string}> }
  if (v.version === 3) return { ...initialState(), ...v, history: v.history?.length ? v.history : seededHistory } as TournamentState
  return initialState()
}

export const slug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const starCounts = (history: HistoryItem[]) => history.reduce<Record<string, number>>((acc, item) => { const key = item.winnerName.toLowerCase(); acc[key] = (acc[key] || 0) + 1; return acc }, {})

export function shuffled<T>(items: T[]) { const copy = [...items]; for (let i = copy.length - 1; i; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy }

export function generateGroups(teams: Team[]): Group[] {
  const count = Math.max(1, Math.ceil(teams.length / 4));
  const groups = Array.from({ length: count }, (_, i) => ({ id: `g-${Date.now()}-${i}`, name: `Group ${String.fromCharCode(65 + i)}`, teamIds: [] as string[] }))
  shuffled(teams).forEach((team, i) => groups[i % count].teamIds.push(team.id))
  return groups
}

export function generateMatches(groups: Group[]): Match[] {
  return groups.flatMap(group => group.teamIds.flatMap((homeId, i) => group.teamIds.slice(i + 1).map(awayId => ({ id: `${group.id}-${homeId}-${awayId}`, groupId: group.id, homeId, awayId, homeScore: null, awayScore: null }))))
}

export function standings(teams: Team[], matches: Match[], teamIds = teams.map(t => t.id)): Standing[] {
  const rows = new Map(teamIds.map(id => { const team = teams.find(t => t.id === id)!; return [id, { ...team, position: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }] }))
  matches.filter(m => teamIds.includes(m.homeId) && teamIds.includes(m.awayId) && m.homeScore !== null && m.awayScore !== null).forEach(m => {
    const h = rows.get(m.homeId)!; const a = rows.get(m.awayId)!; h.played++; a.played++; h.goalsFor += m.homeScore!; h.goalsAgainst += m.awayScore!; a.goalsFor += m.awayScore!; a.goalsAgainst += m.homeScore!
    if (m.homeScore! > m.awayScore!) { h.wins++; h.points += 3; a.losses++ } else if (m.homeScore! < m.awayScore!) { a.wins++; a.points += 3; h.losses++ } else { h.draws++; a.draws++; h.points++; a.points++ }
  })
  return [...rows.values()].map(r => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst })).sort((a,b) => b.points-a.points || b.goalDifference-a.goalDifference || b.goalsFor-a.goalsFor || b.wins-a.wins || a.name.localeCompare(b.name)).map((r,i) => ({...r, position:i+1}))
}

