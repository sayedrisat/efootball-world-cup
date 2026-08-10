export const LEAGUE_STORAGE_KEY = 'efootball-group-cup-v2'

export const emptyResult = { homeScore: '', awayScore: '', penaltyHomeScore: '', penaltyAwayScore: '' }

export const createLeagueState = () => ({
  teams: [],
  groups: [],
  groupResults: {},
  knockout: [],
  phase: 'setup',
  groupSize: 4,
  drawVersion: 0,
})

export function createTeam({ name, image = '' }) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `team-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return { id, image: image.trim(), name: name.trim() }
}

export function displayTeamName(team) {
  return team?.name?.trim() || 'Unknown Team'
}

export function normalizeScore(value) {
  if (value === '') return ''
  const score = Number(value)
  if (!Number.isFinite(score) || score < 0) return ''
  return String(Math.min(99, Math.trunc(score)))
}

export function isResultComplete(result) {
  return Boolean(result && result.homeScore !== '' && result.awayScore !== '')
}

export function shuffle(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }
  return copy
}

export function createRandomGroups(teams, requestedSize = 4) {
  if (teams.length < 2) return []
  const groupCount = Math.max(1, Math.ceil(teams.length / Math.max(2, requestedSize)))
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Group ${String.fromCharCode(65 + index)}`,
    teamIds: [],
  }))
  shuffle(teams).forEach((team, index) => groups[index % groupCount].teamIds.push(team.id))
  return groups
}

export function generateGroupFixtures(groups) {
  return groups.flatMap((group) =>
    group.teamIds.flatMap((homeId, index) =>
      group.teamIds.slice(index + 1).map((awayId) => ({
        id: `${group.id}__${homeId}__${awayId}`,
        groupId: group.id,
        homeId,
        awayId,
      })),
    ),
  )
}

export function calculateGroupTables(teams, groups, results) {
  const teamsById = Object.fromEntries(teams.map((team) => [team.id, team]))
  const fixtures = generateGroupFixtures(groups)
  return groups.map((group) => {
    const rows = Object.fromEntries(group.teamIds.map((id) => [id, {
      ...teamsById[id], played: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    }]))
    fixtures.filter((fixture) => fixture.groupId === group.id).forEach((fixture) => {
      const result = results[fixture.id]
      if (!isResultComplete(result)) return
      const home = rows[fixture.homeId]
      const away = rows[fixture.awayId]
      const hs = Number(result.homeScore)
      const as = Number(result.awayScore)
      home.played += 1; away.played += 1
      home.goalsFor += hs; home.goalsAgainst += as
      away.goalsFor += as; away.goalsAgainst += hs
      if (hs > as) { home.wins += 1; home.points += 3; away.losses += 1 }
      else if (as > hs) { away.wins += 1; away.points += 3; home.losses += 1 }
      else { home.draws += 1; away.draws += 1; home.points += 1; away.points += 1 }
    })
    const table = Object.values(rows).map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    })).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || displayTeamName(a).localeCompare(displayTeamName(b)))
      .map((team, index) => ({ ...team, rank: index + 1 }))
    return { ...group, table }
  })
}

export function getQualifiers(groupTables) {
  return groupTables.flatMap((group) => group.table.slice(0, Math.min(2, group.table.length)))
}

function nextPowerOfTwo(value) {
  let size = 2
  while (size < value) size *= 2
  return size
}

export function createKnockoutBracket(qualifiers) {
  if (qualifiers.length < 2) return []
  const size = nextPowerOfTwo(qualifiers.length)
  const seeded = [...qualifiers]
  const matches = []
  for (let index = 0; index < size / 2; index += 1) {
    const home = seeded[index] || null
    const away = seeded[size - 1 - index] || null
    matches.push({
      id: `round-${size}-${index + 1}`,
      round: size,
      order: index + 1,
      homeId: home?.id || '',
      awayId: away?.id || '',
      result: { ...emptyResult },
      winnerId: home && !away ? home.id : '',
    })
  }
  return matches
}

export function roundName(round) {
  if (round === 2) return 'Final'
  if (round === 4) return 'Semi Final'
  if (round === 8) return 'Quarter Final'
  return `Round of ${round}`
}

export function resolveKnockoutWinner(match) {
  if (!match?.homeId || !match?.awayId || !isResultComplete(match.result)) return match?.winnerId || ''
  const hs = Number(match.result.homeScore)
  const as = Number(match.result.awayScore)
  if (hs > as) return match.homeId
  if (as > hs) return match.awayId
  if (match.result.penaltyHomeScore === '' || match.result.penaltyAwayScore === '') return ''
  const hp = Number(match.result.penaltyHomeScore)
  const ap = Number(match.result.penaltyAwayScore)
  if (hp > ap) return match.homeId
  if (ap > hp) return match.awayId
  return ''
}

export function advanceKnockout(matches) {
  if (!matches.length || matches.some((match) => !resolveKnockoutWinner(match))) return matches
  const currentRound = matches[0].round
  if (currentRound === 2) return matches.map((match) => ({ ...match, winnerId: resolveKnockoutWinner(match) }))
  const completed = matches.map((match) => ({ ...match, winnerId: resolveKnockoutWinner(match) }))
  const next = []
  for (let index = 0; index < completed.length; index += 2) {
    next.push({
      id: `round-${currentRound / 2}-${index / 2 + 1}`,
      round: currentRound / 2,
      order: index / 2 + 1,
      homeId: completed[index]?.winnerId || '',
      awayId: completed[index + 1]?.winnerId || '',
      result: { ...emptyResult },
      winnerId: '',
    })
  }
  return [...completed, ...next]
}

export function normalizeTournamentState(value) {
  const fresh = createLeagueState()
  if (!value || typeof value !== 'object') return fresh
  return {
    ...fresh,
    ...value,
    teams: Array.isArray(value.teams) ? value.teams : [],
    groups: Array.isArray(value.groups) ? value.groups : [],
    groupResults: value.groupResults && typeof value.groupResults === 'object' ? value.groupResults : {},
    knockout: Array.isArray(value.knockout) ? value.knockout : [],
  }
}
