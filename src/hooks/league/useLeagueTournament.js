import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  isSupabaseConfigured, readRemoteLeagueState, removeTeamIcon, saveRemoteLeagueState,
  subscribeToRemoteLeagueState, uploadTeamIcon,
} from '../../services/leagueSupabase'
import { readLeagueState, saveLeagueState } from '../../storage/league/leagueStorage'
import {
  advanceKnockout, calculateGroupTables, createKnockoutBracket, createLeagueState,
  createRandomGroups, createTeam, generateGroupFixtures, getQualifiers, isResultComplete,
  normalizeScore, resolveKnockoutWinner,
} from '../../utils/league/leagueRules'

function reducer(state, action) {
  if (action.type === 'HYDRATE') return action.payload
  if (action.type === 'ADD_TEAM') return { ...state, teams: [...state.teams, action.team] }
  if (action.type === 'REMOVE_TEAM') return { ...state, teams: state.teams.filter((team) => team.id !== action.id) }
  if (action.type === 'DRAW') return { ...state, groups: action.groups, groupResults: {}, knockout: [], phase: 'groups', groupSize: action.groupSize, drawVersion: state.drawVersion + 1 }
  if (action.type === 'GROUP_SCORE') return { ...state, groupResults: { ...state.groupResults, [action.id]: { ...(state.groupResults[action.id] || {}), [action.field]: normalizeScore(action.value) } } }
  if (action.type === 'START_KNOCKOUT') return { ...state, knockout: action.matches, phase: 'knockout' }
  if (action.type === 'KNOCKOUT_SCORE') return { ...state, knockout: state.knockout.map((match) => match.id === action.id ? { ...match, result: { ...match.result, [action.field]: normalizeScore(action.value) }, winnerId: '' } : match) }
  if (action.type === 'ADVANCE') return { ...state, knockout: advanceKnockout(action.matches) }
  if (action.type === 'RESET') return createLeagueState()
  return state
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

export function useLeagueTournament({ canEdit = true, enabled = true, userId = null } = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, readLeagueState)
  const [remoteStatus, setRemoteStatus] = useState(isSupabaseConfigured ? 'loading' : 'local')
  const [syncError, setSyncError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const hydrated = useRef(!isSupabaseConfigured)
  const skipSave = useRef(false)
  const fixtures = useMemo(() => generateGroupFixtures(state.groups), [state.groups])
  const groupTables = useMemo(() => calculateGroupTables(state.teams, state.groups, state.groupResults), [state.teams, state.groups, state.groupResults])
  const teamsById = useMemo(() => Object.fromEntries(state.teams.map((team) => [team.id, team])), [state.teams])
  const groupComplete = fixtures.length > 0 && fixtures.every((fixture) => isResultComplete(state.groupResults[fixture.id]))
  const qualifiers = useMemo(() => getQualifiers(groupTables), [groupTables])
  const activeRound = state.knockout.length ? Math.min(...state.knockout.filter((match) => !match.winnerId).map((match) => match.round).concat(Infinity)) : null
  const visibleKnockout = state.knockout.filter((match) => match.round === activeRound || (activeRound === Infinity && match.round === 2))
  const finalMatch = state.knockout.find((match) => match.round === 2)
  const championId = finalMatch ? resolveKnockoutWinner(finalMatch) : ''
  const champion = teamsById[championId] || null

  useEffect(() => { saveLeagueState(state) }, [state])
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return undefined
    let active = true
    readRemoteLeagueState().then(({ state: remote, updatedAt }) => {
      if (!active) return
      hydrated.current = true; skipSave.current = true; dispatch({ type: 'HYDRATE', payload: remote })
      setLastUpdated(updatedAt); setRemoteStatus('live')
    }).catch((error) => { if (active) { hydrated.current = true; setSyncError(error.message); setRemoteStatus('error') } })
    const unsubscribe = subscribeToRemoteLeagueState((remote, updatedAt) => {
      if (!active) return
      skipSave.current = true; dispatch({ type: 'HYDRATE', payload: remote }); setLastUpdated(updatedAt); setRemoteStatus('live')
    }, (status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRemoteStatus('error') })
    return () => { active = false; unsubscribe() }
  }, [enabled])
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled || !canEdit || !userId || !hydrated.current) return undefined
    if (skipSave.current) { skipSave.current = false; return undefined }
    setRemoteStatus('saving')
    const timer = window.setTimeout(() => saveRemoteLeagueState(state, userId).then((updatedAt) => {
      setLastUpdated(updatedAt); setSyncError(''); setRemoteStatus('live')
    }).catch((error) => { setSyncError(error.message); setRemoteStatus('error') }), 450)
    return () => window.clearTimeout(timer)
  }, [state, canEdit, enabled, userId])

  const addTeam = async ({ file, image, name }) => {
    if (!canEdit || !name.trim()) return
    const team = createTeam({ image, name })
    if (file && isSupabaseConfigured) Object.assign(team, await uploadTeamIcon(file, team.id, userId))
    else if (file) team.image = await readFile(file)
    dispatch({ type: 'ADD_TEAM', team })
  }
  const removeTeam = async (id) => {
    if (!canEdit || state.phase !== 'setup') return
    const team = state.teams.find((item) => item.id === id)
    if (team?.imagePath && isSupabaseConfigured) await removeTeamIcon(team.imagePath)
    dispatch({ type: 'REMOVE_TEAM', id })
  }
  const createDraw = (groupSize) => {
    if (!canEdit || state.teams.length < 2) return
    dispatch({ type: 'DRAW', groups: createRandomGroups(state.teams, groupSize), groupSize })
  }
  const startKnockout = () => {
    if (!canEdit || !groupComplete) return
    dispatch({ type: 'START_KNOCKOUT', matches: createKnockoutBracket(qualifiers) })
  }
  const advanceRound = () => {
    if (!canEdit || !visibleKnockout.length || visibleKnockout.some((match) => !resolveKnockoutWinner(match))) return
    dispatch({ type: 'ADVANCE', matches: state.knockout })
  }
  const resetAll = () => {
    if (canEdit && window.confirm('Delete the current tournament and start fresh?')) dispatch({ type: 'RESET' })
  }

  return {
    ...state, activeRound, addTeam, advanceRound, canEdit, champion, createDraw, fixtures,
    groupComplete, groupTables, isSupabaseConfigured, lastUpdated, qualifiers, remoteStatus,
    removeTeam, resetAll, startKnockout, syncError, teamsById, visibleKnockout,
    updateGroupResult: (id, field, value) => canEdit && dispatch({ type: 'GROUP_SCORE', id, field, value }),
    updateKnockoutResult: (id, field, value) => canEdit && dispatch({ type: 'KNOCKOUT_SCORE', id, field, value }),
  }
}
