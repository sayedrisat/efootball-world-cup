import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  isSupabaseConfigured,
  readRemoteLeagueState,
  removeTeamIcon,
  saveRemoteLeagueState,
  subscribeToRemoteLeagueState,
  uploadTeamIcon,
} from '../../services/leagueSupabase'
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
  if (action.type === 'HYDRATE') {
    return action.payload
  }

  if (action.type === 'ADD_TEAM') {
    const team = action.payload.team
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

export function useLeagueTournament({ canEdit = true, userId = null } = {}) {
  const localDraftRef = useRef(null)
  const [state, dispatch] = useReducer(leagueReducer, undefined, () => {
    const localState = readLeagueState()
    localDraftRef.current = localState
    return localState
  })
  const [matchFilter, setMatchFilter] = useState('all')
  const [remoteStatus, setRemoteStatus] = useState(isSupabaseConfigured ? 'loading' : 'local')
  const [syncError, setSyncError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const remoteHydratedRef = useRef(!isSupabaseConfigured)
  const skipNextRemoteSaveRef = useRef(false)

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
    if (!isSupabaseConfigured) saveLeagueState(state)
  }, [state])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let isActive = true
    setRemoteStatus('loading')

    readRemoteLeagueState()
      .then(({ state: remoteState, updatedAt }) => {
        if (!isActive) return
        skipNextRemoteSaveRef.current = true
        remoteHydratedRef.current = true
        dispatch({ payload: remoteState, type: 'HYDRATE' })
        setLastUpdated(updatedAt)
        setRemoteStatus('live')
      })
      .catch((error) => {
        if (!isActive) return
        remoteHydratedRef.current = true
        setSyncError(error.message || 'Could not load live tournament data.')
        setRemoteStatus('error')
      })

    const unsubscribe = subscribeToRemoteLeagueState(
      (remoteState, updatedAt) => {
        if (!isActive) return
        skipNextRemoteSaveRef.current = true
        remoteHydratedRef.current = true
        dispatch({ payload: remoteState, type: 'HYDRATE' })
        setLastUpdated(updatedAt)
        setSyncError('')
        setRemoteStatus('live')
      },
      (status) => {
        if (!isActive) return
        if (status === 'SUBSCRIBED') setRemoteStatus((current) => (current === 'saving' ? current : 'live'))
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRemoteStatus('error')
      },
    )

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !canEdit || !userId || !remoteHydratedRef.current) return undefined

    if (skipNextRemoteSaveRef.current) {
      skipNextRemoteSaveRef.current = false
      return undefined
    }

    setRemoteStatus('saving')
    const saveTimer = window.setTimeout(() => {
      saveRemoteLeagueState(state, userId)
        .then((updatedAt) => {
          setLastUpdated(updatedAt)
          setSyncError('')
          setRemoteStatus('live')
        })
        .catch((error) => {
          setSyncError(error.message || 'Could not publish the tournament update.')
          setRemoteStatus('error')
        })
    }, 450)

    return () => window.clearTimeout(saveTimer)
  }, [canEdit, state, userId])

  const addTeam = async ({ file, image, name }) => {
    if (!canEdit) return
    setIsAddingTeam(true)
    setSyncError('')

    try {
      const team = createTeam({ image, name })

      if (file && isSupabaseConfigured) {
        const uploadedImage = await uploadTeamIcon(file, team.id, userId)
        Object.assign(team, uploadedImage)
      } else if (file) {
        team.image = await readFileAsDataUrl(file)
      }

      dispatch({ payload: { team }, type: 'ADD_TEAM' })
    } catch (error) {
      setSyncError(error.message || 'Could not add this team.')
      throw error
    } finally {
      setIsAddingTeam(false)
    }
  }

  const importLocalDraft = async () => {
    const localDraft = localDraftRef.current
    if (!canEdit || !userId || !localDraft) return

    setRemoteStatus('saving')
    setSyncError('')

    try {
      const updatedAt = await saveRemoteLeagueState(localDraft, userId)
      skipNextRemoteSaveRef.current = true
      dispatch({ payload: localDraft, type: 'HYDRATE' })
      setLastUpdated(updatedAt)
      setRemoteStatus('live')
    } catch (error) {
      setSyncError(error.message || 'Could not import local tournament data.')
      setRemoteStatus('error')
    }
  }

  const removeTeam = async (teamId) => {
    if (!canEdit) return
    const team = state.teams.find((item) => item.id === teamId)

    if (team?.imagePath && isSupabaseConfigured) {
      try {
        await removeTeamIcon(team.imagePath)
      } catch (error) {
        setSyncError(error.message || 'Team removed, but its image could not be deleted.')
      }
    }

    dispatch({ payload: { teamId }, type: 'REMOVE_TEAM' })
  }

  const resetResults = () => {
    if (!canEdit) return
    dispatch({ type: 'RESET_RESULTS' })
  }
  const resetAll = () => {
    if (!canEdit) return
    if (!window.confirm('Reset all league teams and results?')) return
    dispatch({ type: 'RESET_ALL' })
  }
  const updateResult = (fixtureId, field, value) => {
    if (!canEdit) return
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
    isAddingTeam,
    isSupabaseConfigured,
    importLocalDraft,
    lastUpdated,
    localDraftAvailable:
      isSupabaseConfigured &&
      (localDraftRef.current?.teams?.length > 0 || Object.keys(localDraftRef.current?.results || {}).length > 0) &&
      state.teams.length === 0 &&
      Object.keys(state.results).length === 0,
    matchFilter,
    pendingMatches,
    removeTeam,
    resetAll,
    resetResults,
    remoteStatus,
    results: state.results,
    setMatchFilter,
    table,
    teams: state.teams,
    syncError,
    tournamentComplete,
    tournamentReady,
    updateResult,
  }
}
