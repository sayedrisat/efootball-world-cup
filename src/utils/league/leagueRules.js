export const LEAGUE_STORAGE_KEY = 'efootball-unlimited-league-v1'

export const emptyResult = {
  homeScore: '',
  awayScore: '',
}

export const createLeagueState = () => ({
  teams: [],
  results: {},
})

export function createTeam({ name, image }) {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `team-${Date.now()}-${Math.random().toString(16).slice(2)}`

  return {
    id,
    image: image.trim(),
    name: name.trim(),
  }
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
  return (
    result &&
    result.homeScore !== '' &&
    result.awayScore !== '' &&
    Number.isFinite(Number(result.homeScore)) &&
    Number.isFinite(Number(result.awayScore))
  )
}

export function generateFixtures(teams) {
  const fixtures = []

  teams.forEach((homeTeam) => {
    teams.forEach((awayTeam) => {
      if (homeTeam.id === awayTeam.id) return

      fixtures.push({
        awayId: awayTeam.id,
        homeId: homeTeam.id,
        id: `${homeTeam.id}__${awayTeam.id}`,
      })
    })
  })

  return fixtures
}

function getHeadToHeadStats(teamId, opponentId, fixtures, results) {
  return fixtures
    .filter(
      (fixture) =>
        (fixture.homeId === teamId && fixture.awayId === opponentId) ||
        (fixture.homeId === opponentId && fixture.awayId === teamId),
    )
    .reduce(
      (stats, fixture) => {
        const result = results[fixture.id]
        if (!isResultComplete(result)) return stats

        const isHome = fixture.homeId === teamId
        const goalsFor = Number(isHome ? result.homeScore : result.awayScore)
        const goalsAgainst = Number(isHome ? result.awayScore : result.homeScore)

        stats.goalsFor += goalsFor
        stats.goalsAgainst += goalsAgainst
        stats.goalDifference += goalsFor - goalsAgainst

        if (goalsFor > goalsAgainst) stats.points += 3
        if (goalsFor === goalsAgainst) stats.points += 1

        return stats
      },
      { goalDifference: 0, goalsAgainst: 0, goalsFor: 0, points: 0 },
    )
}

export function calculateLeagueTable(teams, fixtures, results) {
  const rowsById = teams.reduce((rows, team) => {
    rows[team.id] = {
      ...team,
      awayPlayed: 0,
      draws: 0,
      goalDifference: 0,
      goalsAgainst: 0,
      goalsFor: 0,
      homePlayed: 0,
      losses: 0,
      played: 0,
      points: 0,
      wins: 0,
    }
    return rows
  }, {})

  fixtures.forEach((fixture) => {
    const result = results[fixture.id]
    if (!isResultComplete(result)) return

    const home = rowsById[fixture.homeId]
    const away = rowsById[fixture.awayId]
    const homeScore = Number(result.homeScore)
    const awayScore = Number(result.awayScore)

    home.played += 1
    home.homePlayed += 1
    home.goalsFor += homeScore
    home.goalsAgainst += awayScore

    away.played += 1
    away.awayPlayed += 1
    away.goalsFor += awayScore
    away.goalsAgainst += homeScore

    if (homeScore > awayScore) {
      home.wins += 1
      home.points += 3
      away.losses += 1
    } else if (awayScore > homeScore) {
      away.wins += 1
      away.points += 3
      home.losses += 1
    } else {
      home.draws += 1
      away.draws += 1
      home.points += 1
      away.points += 1
    }
  })

  return Object.values(rowsById)
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    }))
    .sort((a, b) => {
      const basicSort =
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        b.wins - a.wins

      if (basicSort !== 0) return basicSort

      const aHeadToHead = getHeadToHeadStats(a.id, b.id, fixtures, results)
      const bHeadToHead = getHeadToHeadStats(b.id, a.id, fixtures, results)

      return (
        bHeadToHead.points - aHeadToHead.points ||
        bHeadToHead.goalDifference - aHeadToHead.goalDifference ||
        bHeadToHead.goalsFor - aHeadToHead.goalsFor ||
        displayTeamName(a).localeCompare(displayTeamName(b))
      )
    })
    .map((team, index) => ({ ...team, rank: index + 1 }))
}

export function getMatchState(fixture, results) {
  const result = results[fixture.id] || emptyResult

  if (!isResultComplete(result)) return 'pending'
  if (Number(result.homeScore) === Number(result.awayScore)) return 'draw'
  if (Number(result.homeScore) > Number(result.awayScore)) return 'home'
  return 'away'
}

export function filterResultsByTeam(results, teams) {
  const ids = new Set(teams.map((team) => team.id))

  return Object.fromEntries(
    Object.entries(results).filter(([fixtureId]) => {
      const [homeId, awayId] = fixtureId.split('__')
      return ids.has(homeId) && ids.has(awayId)
    }),
  )
}
