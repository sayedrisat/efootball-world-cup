import { useEffect, useMemo, useReducer, useState } from 'react'
import { readLeagueState, saveLeagueState } from '../../storage/league/leagueStorage'
import {
  calculateLeagueTable,
  createLeagueState,
  createTeam,
  emptyResult,
  filterResultsByTeam,
  generateFixtures,
  isResultComplete,
  normalizeScore,
} from '../../utils/league/leagueRules'

function leagueReducer(state, action) {
  if (action.type === 'ADD_TEAM') {
    const team = createTeam(action.payload)
    if (!team.name) return state

    return {
      ...state,
      teams: [...state.teams, team],
    }
  }

  if (action.type === 'REMOVE_TEAM') {
    const teams = state.teams.filter((team) => team.id !== action.payload.teamId)

    return {
      ...state,
      results: filterResultsByTeam(state.results, teams),
      teams,
    }
  }

  if (action.type === 'UPDATE_RESULT') {
    const previousResult = state.results[action.payload.fixtureId] || emptyResult

    return {
      ...state,
      results: {
        ...state.results,
        [action.payload.fixtureId]: {
          ...previousResult,
          [action.payload.field]: normalizeScore(action.payload.value),
        },
      },
    }
  }

  if (action.type === 'RESET_RESULTS') {
    return {
      ...state,
      results: {},
    }
  }

  if (action.type === 'RESET_ALL') {
    return createLeagueState()
  }

  return state
}

export function useLeagueTournament() {
  const [state, dispatch] = useReducer(leagueReducer, undefined, readLeagueState)
  const [matchFilter, setMatchFilter] = useState('all')

  const fixtures = useMemo(() => generateFixtures(state.teams), [state.teams])
  const table = useMemo(
    () => calculateLeagueTable(state.teams, fixtures, state.results),
    [fixtures, state.results, state.teams],
  )

  const completedMatches = fixtures.filter((fixture) => isResultComplete(state.results[fixture.id])).length
  const pendingMatches = fixtures.length - completedMatches
  const tournamentReady = state.teams.length >= 2
  const tournamentComplete = tournamentReady && fixtures.length > 0 && pendingMatches === 0
  const champion = tournamentComplete ? table[0] : null

  const filteredFixtures = useMemo(() => {
    if (matchFilter === 'completed') {
      return fixtures.filter((fixture) => isResultComplete(state.results[fixture.id]))
    }

    if (matchFilter === 'pending') {
      return fixtures.filter((fixture) => !isResultComplete(state.results[fixture.id]))
    }

    return fixtures
  }, [fixtures, matchFilter, state.results])

  useEffect(() => {
    saveLeagueState(state)
  }, [state])

  const addTeam = (payload) => dispatch({ payload, type: 'ADD_TEAM' })
  const removeTeam = (teamId) => dispatch({ payload: { teamId }, type: 'REMOVE_TEAM' })
  const resetResults = () => dispatch({ type: 'RESET_RESULTS' })
  const resetAll = () => {
    if (!window.confirm('Reset all league teams and results?')) return
    dispatch({ type: 'RESET_ALL' })
  }
  const updateResult = (fixtureId, field, value) => {
    dispatch({
      payload: {
        field,
        fixtureId,
        value,
      },
      type: 'UPDATE_RESULT',
    })
  }

  return {
    addTeam,
    champion,
    completedMatches,
    filteredFixtures,
    fixtures,
    matchFilter,
    pendingMatches,
    removeTeam,
    resetAll,
    resetResults,
    results: state.results,
    setMatchFilter,
    table,
    teams: state.teams,
    tournamentComplete,
    tournamentReady,
    updateResult,
  }
}
