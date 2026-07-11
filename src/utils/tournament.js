import { GROUP_MATCHES, TEAM_IDS } from '../constants/tournament'

export function createTeams() {
  return TEAM_IDS.map((id, index) => ({
    id,
    name: '',
    icon: '',
    stars: 0,
    seed: index + 1,
  }))
}

export function createGroupResults() {
  return GROUP_MATCHES.reduce((results, match) => {
    results[match.id] = { homeScore: '', awayScore: '' }
    return results
  }, {})
}

export function createKnockoutResult() {
  return {
    homeScore: '',
    awayScore: '',
    penaltyHomeScore: '',
    penaltyAwayScore: '',
    winnerId: '',
  }
}

export function createTournamentState() {
  return {
    teams: createTeams(),
    groupResults: createGroupResults(),
    knockout: {
      semi: createKnockoutResult(),
      final: createKnockoutResult(),
    },
  }
}

export function displayName(team) {
  if (!team) return 'TBD'
  return team.name.trim() || `Team ${team.seed}`
}

export function getInitials(team) {
  return displayName(team)
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
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

export function scoreText(result) {
  if (!isResultComplete(result)) return '-'

  const mainScore = `${result.homeScore}-${result.awayScore}`
  if (isDraw(result) && isPenaltyComplete(result)) {
    return `${mainScore} (${result.penaltyHomeScore}-${result.penaltyAwayScore} pens)`
  }

  return mainScore
}

export function isDraw(result) {
  return isResultComplete(result) && Number(result.homeScore) === Number(result.awayScore)
}

export function isPenaltyComplete(result) {
  return (
    result &&
    result.penaltyHomeScore !== '' &&
    result.penaltyAwayScore !== '' &&
    Number.isFinite(Number(result.penaltyHomeScore)) &&
    Number.isFinite(Number(result.penaltyAwayScore))
  )
}

export function getWinnerId(result, matchTeams) {
  if (!isResultComplete(result) || matchTeams.length !== 2) return ''

  const homeScore = Number(result.homeScore)
  const awayScore = Number(result.awayScore)

  if (homeScore > awayScore) return matchTeams[0].id
  if (awayScore > homeScore) return matchTeams[1].id

  if (isPenaltyComplete(result)) {
    const penaltyHomeScore = Number(result.penaltyHomeScore)
    const penaltyAwayScore = Number(result.penaltyAwayScore)

    if (penaltyHomeScore > penaltyAwayScore) return matchTeams[0].id
    if (penaltyAwayScore > penaltyHomeScore) return matchTeams[1].id

    return ''
  }

  return ''
}

export function mergeSavedState(savedState) {
  const freshState = createTournamentState()

  if (!savedState || typeof savedState !== 'object') return freshState

  return {
    teams: freshState.teams.map((team) => ({
      ...team,
      ...(savedState.teams?.find((savedTeam) => savedTeam.id === team.id) || {}),
    })),
    groupResults: {
      ...freshState.groupResults,
      ...(savedState.groupResults || {}),
    },
    knockout: {
      semi: {
        ...freshState.knockout.semi,
        ...(savedState.knockout?.semi || {}),
      },
      final: {
        ...freshState.knockout.final,
        ...(savedState.knockout?.final || {}),
      },
    },
  }
}

export function calculateStandings(teams, groupResults) {
  const table = teams.reduce((rows, team) => {
    rows[team.id] = {
      ...team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }
    return rows
  }, {})

  GROUP_MATCHES.forEach((match) => {
    const result = groupResults[match.id]
    if (!isResultComplete(result)) return

    const home = table[match.homeId]
    const away = table[match.awayId]
    const homeScore = Number(result.homeScore)
    const awayScore = Number(result.awayScore)

    home.played += 1
    away.played += 1
    home.goalsFor += homeScore
    home.goalsAgainst += awayScore
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

  return Object.values(table)
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.goalsAgainst - b.goalsAgainst ||
        displayName(a).localeCompare(displayName(b)),
    )
    .map((team, index) => ({ ...team, rank: index + 1 }))
}
