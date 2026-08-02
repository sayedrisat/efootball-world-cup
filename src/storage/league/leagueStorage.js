import { createLeagueState, LEAGUE_STORAGE_KEY } from '../../utils/league/leagueRules'

export function readLeagueState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(LEAGUE_STORAGE_KEY))
    if (!savedState || typeof savedState !== 'object') return createLeagueState()

    return {
      teams: Array.isArray(savedState.teams) ? savedState.teams : [],
      results: savedState.results && typeof savedState.results === 'object' ? savedState.results : {},
    }
  } catch {
    return createLeagueState()
  }
}

export function saveLeagueState(state) {
  try {
    localStorage.setItem(LEAGUE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Large uploaded team images may exceed browser storage limits.
  }
}
