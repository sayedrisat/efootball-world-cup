import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, readRemoteState, saveRemoteState, subscribeRemote, type RemoteStateSnapshot } from '../services/leagueSupabase'
import type { HistoryItem, KnockoutMatch, TournamentState } from '../types'
import {
  areGroupFixturesComplete,
  areKnockoutStageFixturesComplete,
  canStartNextTournament,
  createKnockoutBracket,
  createNextKnockoutRound,
  generateGroups,
  generateMatches,
  getActiveKnockoutMatches,
  getActiveKnockoutRound,
  getConfirmableChampionId,
  getPlayoffMatch,
  getSixQualifiers,
  hasAnyMatchSchedule,
  hasAnyMatchScore,
  initialState,
  isSixTeamChampionship,
  isKnockoutMatchComplete,
  knockoutStandings,
  normalizeState,
  normalizeScheduledAt,
  reconcileTournamentProgression,
  resolveKnockoutWinner,
  setMatchSchedule,
  standings,
  starCounts,
  type StateMigrationKind,
} from '../utils/tournament'

const KEY = 'efc-championship-v3'
const DIRTY_KEY = `${KEY}-pending-version`

const readLocal = () => {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(KEY) || 'null'))
  } catch {
    return initialState()
  }
}

const readPendingVersion = () => {
  try {
    return localStorage.getItem(DIRTY_KEY) || ''
  } catch {
    return ''
  }
}

const timestampValue = (value: string) => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const nextUpdatedAt = (previous: string) =>
  new Date(Math.max(Date.now(), timestampValue(previous) + 1)).toISOString()

const isNullableScore = (value: number | null) =>
  value === null || (Number.isInteger(value) && value >= 0 && value <= 99)

const knockoutStageName = (round: number | null) => {
  if (round === 2) return 'Final'
  if (round === 4) return 'Semi-finals'
  if (round === 8) return 'Quarter-finals'
  return round ? `Round of ${round}` : 'Knockout Stage'
}

const hasEnteredKnockoutScore = (match: KnockoutMatch) => [
  match.homeScore,
  match.awayScore,
  match.homePenaltyScore,
  match.awayPenaltyScore,
].some(value => value !== null)

const hasEnteredRoundRobinScore = (match: { homeScore: number | null; awayScore: number | null }) =>
  match.homeScore !== null || match.awayScore !== null

function canEditStoredGroupMatches(state: TournamentState) {
  if (state.status === 'groups') return true
  return state.status === 'knockout'
    && isSixTeamChampionship(state)
    && !state.knockoutStageMatches.some(hasEnteredRoundRobinScore)
    && !state.knockoutMatches.some(hasEnteredKnockoutScore)
}

function canEditStoredKnockoutMatch(state: TournamentState, match: KnockoutMatch) {
  if (state.status !== 'knockout' || !match.homeId || !match.awayId) return false

  if (!match.stage) return match.round === getActiveKnockoutRound(state.knockoutMatches)
  if (match.stage === 'semifinal-1' || match.stage === 'spot-semifinal') {
    return !state.knockoutMatches.some(candidate =>
      (candidate.stage === 'semifinal-2' || candidate.stage === 'grand-final')
      && hasEnteredKnockoutScore(candidate))
  }
  if (match.stage === 'semifinal-2') {
    return !state.knockoutMatches.some(candidate =>
      candidate.stage === 'grand-final' && hasEnteredKnockoutScore(candidate))
  }
  return match.stage === 'grand-final'
}

type StateUpdate = (current: TournamentState) => TournamentState | null
export type TournamentLiveStatus = 'connecting' | 'live' | 'local' | 'polling' | 'offline'

export function useTournament(canEdit: boolean, userId?: string) {
  const [state, setState] = useState<TournamentState>(readLocal)
  const [message, setMessage] = useState('')
  const [syncing, setSyncing] = useState(isSupabaseConfigured)
  const [hydrated, setHydrated] = useState(!isSupabaseConfigured)
  const [liveStatus, setLiveStatus] = useState<TournamentLiveStatus>(isSupabaseConfigured ? 'connecting' : 'local')
  const [saveRetry, setSaveRetry] = useState(0)
  const [migrationSignal, setMigrationSignal] = useState(0)
  const storedPendingVersion = useRef(readPendingVersion()).current
  const pendingVersionOnLoad = storedPendingVersion === state.updatedAt ? storedPendingVersion : ''
  const stateRef = useRef(state)
  const canEditRef = useRef(canEdit)
  const userIdRef = useRef(userId)
  const hydratedRef = useRef(!isSupabaseConfigured)
  const localVersionsRef = useRef(new Set<string>(pendingVersionOnLoad ? [pendingVersionOnLoad] : []))
  const locallyCommittedRef = useRef(Boolean(pendingVersionOnLoad))
  const hasRemoteSnapshotRef = useRef(false)
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)
  const hydrationRetryTimerRef = useRef<number | null>(null)
  const migrationPendingRef = useRef<StateMigrationKind | null>(null)

  stateRef.current = state
  canEditRef.current = canEdit
  userIdRef.current = userId

  const commit = useCallback((update: StateUpdate) => {
    if (!canEditRef.current) return false
    if (isSupabaseConfigured && !hydratedRef.current) {
      setMessage('Wait for the live tournament to finish loading.')
      return false
    }

    const current = stateRef.current
    const candidate = update(current)
    if (!candidate || candidate === current) return false

    const next = { ...candidate, updatedAt: nextUpdatedAt(current.updatedAt) }
    locallyCommittedRef.current = true
    retryCountRef.current = 0
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    localVersionsRef.current.clear()
    localVersionsRef.current.add(next.updatedAt)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
      localStorage.setItem(DIRTY_KEY, next.updatedAt)
    } catch { /* local persistence is best effort */ }
    stateRef.current = next
    setState(next)
    return true
  }, [])

  const adoptRemote = useCallback((incomingValue: TournamentState, allowFirstSnapshot = false) => {
    const incoming = normalizeState(incomingValue)
    const current = stateRef.current
    const isFirstSafeSnapshot = allowFirstSnapshot
      && !hasRemoteSnapshotRef.current
      && !locallyCommittedRef.current
    const isNewer = timestampValue(incoming.updatedAt) > timestampValue(current.updatedAt)

    hasRemoteSnapshotRef.current = true
    if (!isFirstSafeSnapshot && !isNewer) return false

    localVersionsRef.current.clear()
    try { localStorage.removeItem(DIRTY_KEY) } catch { /* local persistence is best effort */ }
    stateRef.current = incoming
    setState(incoming)
    return true
  }, [])

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* remote saving must still proceed */ }

    if (!localVersionsRef.current.has(state.updatedAt)) return
    if (!isSupabaseConfigured || !hydrated || !canEdit || !userId) return

    const snapshot = state
    const saveTimer = window.setTimeout(() => {
      setSyncing(true)

      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(async () => {
          // A newer local commit or accepted remote snapshot supersedes this
          // queued write; never publish an older full-state payload afterward.
          if (timestampValue(stateRef.current.updatedAt) > timestampValue(snapshot.updatedAt)) return
          await saveRemoteState(snapshot, userId)

          const latest = stateRef.current
          if (latest.updatedAt === snapshot.updatedAt) {
            localVersionsRef.current.delete(snapshot.updatedAt)
            retryCountRef.current = 0
            try {
              if (localStorage.getItem(DIRTY_KEY) === snapshot.updatedAt) localStorage.removeItem(DIRTY_KEY)
            } catch { /* local persistence is best effort */ }
            return
          }

          // If a newer remote/local state arrived while this request was in
          // flight, this stale upsert may have just replaced it in the DB.
          // Queue the latest accepted state to restore convergence.
          if (timestampValue(latest.updatedAt) > timestampValue(snapshot.updatedAt)) {
            localVersionsRef.current.clear()
            localVersionsRef.current.add(latest.updatedAt)
            try { localStorage.setItem(DIRTY_KEY, latest.updatedAt) } catch { /* best effort */ }
            setSaveRetry((value) => value + 1)
          }
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : 'Could not publish the tournament update.')
          if (stateRef.current.updatedAt === snapshot.updatedAt) {
            localVersionsRef.current.clear()
            localVersionsRef.current.add(snapshot.updatedAt)
            try { localStorage.setItem(DIRTY_KEY, snapshot.updatedAt) } catch { /* best effort */ }
            retryCountRef.current += 1
            const retryDelay = Math.min(8000, 750 * (2 ** Math.min(retryCountRef.current, 4)))
            if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null
              setSaveRetry((value) => value + 1)
            }, retryDelay)
          }
        })
        .finally(() => {
          if (stateRef.current.updatedAt === snapshot.updatedAt) setSyncing(false)
        })
    }, 350)

    return () => window.clearTimeout(saveTimer)
  }, [state, hydrated, canEdit, userId, saveRetry])

  useEffect(() => {
    const flushPendingState = () => {
      const snapshot = stateRef.current
      const activeUserId = userIdRef.current
      if (!isSupabaseConfigured || !canEditRef.current || !hydratedRef.current || !activeUserId) return
      if (!localVersionsRef.current.has(snapshot.updatedAt)) return

      // Keep unload writes in the same order as normal saves. The dirty marker
      // intentionally remains: browsers may terminate pagehide work at any
      // point, so the next session must be able to retry safely.
      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(() => {
          if (stateRef.current.updatedAt !== snapshot.updatedAt) return
          return saveRemoteState(snapshot, activeUserId)
        })
        .catch(() => undefined)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingState()
    }

    window.addEventListener('pagehide', flushPendingState)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushPendingState)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
      if (hydrationRetryTimerRef.current !== null) window.clearTimeout(hydrationRetryTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let active = true
    let realtimeConnected = false
    let refreshTimer: number | null = null
    const applyRemote = (snapshot: RemoteStateSnapshot, allowFirstSnapshot = false) => {
      if (!active) return
      if (hydrationRetryTimerRef.current !== null) {
        window.clearTimeout(hydrationRetryTimerRef.current)
        hydrationRetryTimerRef.current = null
      }
      const wasHydrated = hydratedRef.current
      const isKnownBadRollback = snapshot.migrationKind === 'rollback-skipped-tournament-6'

      // Accept the known bad payload only as a clean session's first snapshot,
      // where normalizeState safely turns it into #6 registration. If an old
      // admin tab republishes v3 later, keep the valid local v4 state and queue
      // it for persistence instead of wiping current teams/groups/results.
      if (isKnownBadRollback && (hasRemoteSnapshotRef.current || locallyCommittedRef.current)) {
        hasRemoteSnapshotRef.current = true
        migrationPendingRef.current = snapshot.migrationKind
        setMigrationSignal((value) => value + 1)
        hydratedRef.current = true
        setHydrated(true)
        setSyncing(false)
        return
      }

      const adopted = adoptRemote(snapshot.state, allowFirstSnapshot)
      if (adopted) {
        migrationPendingRef.current = snapshot.migrationKind
        if (snapshot.migrationKind) setMigrationSignal((value) => value + 1)
      }
      hydratedRef.current = true
      setHydrated(true)
      if (adopted || !wasHydrated) setSyncing(false)
    }

    const loadRemote = () => {
      if (!active || hydratedRef.current) return
      setSyncing(true)
      readRemoteState()
        .then((incoming) => {
          applyRemote(incoming, true)
          if (!realtimeConnected) setLiveStatus('polling')
        })
        .catch((error) => {
          if (!active || hydratedRef.current) return
          if (!realtimeConnected) setLiveStatus('offline')
          setMessage(error instanceof Error ? error.message : 'Could not load the live tournament.')
          hydrationRetryTimerRef.current = window.setTimeout(loadRemote, 2500)
        })
    }

    const refreshRemote = () => {
      if (!active || !hydratedRef.current) return
      readRemoteState()
        .then((incoming) => {
          applyRemote(incoming)
          if (!realtimeConnected) setLiveStatus('polling')
        })
        .catch(() => {
          if (!realtimeConnected) setLiveStatus('offline')
        })
    }

    const handleRealtimeStatus = (status: string) => {
      if (!active) return
      if (status === 'SUBSCRIBED') {
        realtimeConnected = true
        setLiveStatus('live')
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        realtimeConnected = false
        setLiveStatus('polling')
        refreshRemote()
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshRemote()
    }

    loadRemote()

    const stop = subscribeRemote((incoming) => applyRemote(incoming, true), handleRealtimeStatus)
    refreshTimer = window.setInterval(refreshRemote, 15000)
    window.addEventListener('focus', refreshRemote)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.removeEventListener('focus', refreshRemote)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      if (refreshTimer !== null) window.clearInterval(refreshTimer)
      if (hydrationRetryTimerRef.current !== null) {
        window.clearTimeout(hydrationRetryTimerRef.current)
        hydrationRetryTimerRef.current = null
      }
      stop()
    }
  }, [adoptRemote])

  useEffect(() => {
    const migrationKind = migrationPendingRef.current
    if (!migrationKind || !hydrated || !canEdit || !userId) return

    migrationPendingRef.current = null
    const queued = commit(current => ({ ...current }))
    if (!queued) return
    setMessage(migrationKind === 'rollback-skipped-tournament-6'
      ? 'Tournament #06 restored. The unsupported Honduras #06 title was removed.'
      : 'Tournament data upgraded to the protected final-stage format.')
  }, [hydrated, canEdit, userId, commit, migrationSignal])

  useEffect(() => {
    if (!hydrated || !canEdit) return

    const current = stateRef.current
    const completedTwoGroupStage = current.status === 'groups'
      && getSixQualifiers(current.groups, current.teams, current.matches).length === 6
    const hasSixTeamQualifiers = getSixQualifiers(current.groups, current.teams, current.matches).length === 6
    const repairableLegacyStart = current.status === 'knockout'
      && hasSixTeamQualifiers
      && !current.qualifiedTeamIds.length
      && !current.knockoutStageMatches.length
      && current.knockoutMatches.length > 0
      && !current.knockoutMatches.some(match => Boolean(match.stage))
      && !current.knockoutMatches.some(hasEnteredKnockoutScore)
      && current.winnerId === null
    const repairableChampionship = current.status === 'knockout'
      && (isSixTeamChampionship(current) || repairableLegacyStart)
    if (!completedTwoGroupStage && !repairableChampionship) return

    const progressed = commit(latest => reconcileTournamentProgression(latest))
    if (progressed && (completedTwoGroupStage || repairableLegacyStart)) {
      setMessage('Top three from Group A and Group B qualified. The 15-match Knockout Stage is ready.')
    }
  }, [
    hydrated,
    canEdit,
    commit,
    state.status,
    state.groups,
    state.matches,
    state.qualifiedTeamIds,
    state.knockoutStageMatches,
    state.knockoutMatches,
  ])

  useEffect(() => {
    if (!message) return undefined
    const messageTimer = window.setTimeout(() => setMessage(''), 3500)
    return () => window.clearTimeout(messageTimer)
  }, [message])

  const allStandings = useMemo(() => standings(state.teams, state.matches), [state.teams, state.matches])
  const stars = useMemo(() => starCounts(state.history), [state.history])
  const completedMatches = useMemo(
    () => state.matches.filter((match) => match.homeScore !== null && match.awayScore !== null).length,
    [state.matches],
  )
  const pendingMatches = state.matches.length - completedMatches
  const readyToEdit = !isSupabaseConfigured || hydrated
  const canEditGroupMatches = readyToEdit && canEditStoredGroupMatches(state)
  const groupComplete = useMemo(
    () => areGroupFixturesComplete(state.groups, state.matches),
    [state.groups, state.matches],
  )
  const canRegenerateGroups = readyToEdit
    && state.status === 'groups'
    && !hasAnyMatchScore(state.matches)
    && !hasAnyMatchSchedule(state.matches)
  const canStartKnockout = readyToEdit && state.status === 'groups' && groupComplete
  const sixTeamChampionship = useMemo(() => isSixTeamChampionship(state), [state])
  const qualificationEntries = useMemo(() => getSixQualifiers(
    state.groups,
    state.teams,
    state.matches,
  ).map(entry => ({
    ...entry,
    team: state.teams.find(team => team.id === entry.teamId)!,
  })).filter(entry => Boolean(entry.team)), [state.groups, state.teams, state.matches])
  const knockoutStageMatches = state.knockoutStageMatches
  const completedKnockoutStageMatches = useMemo(
    () => knockoutStageMatches.filter(match => match.homeScore !== null && match.awayScore !== null).length,
    [knockoutStageMatches],
  )
  const knockoutStageComplete = useMemo(
    () => areKnockoutStageFixturesComplete(state.qualifiedTeamIds, knockoutStageMatches),
    [state.qualifiedTeamIds, knockoutStageMatches],
  )
  const knockoutTable = useMemo(
    () => knockoutStandings(state.teams, knockoutStageMatches, state.qualifiedTeamIds),
    [state.teams, knockoutStageMatches, state.qualifiedTeamIds],
  )
  const playoffMatches = useMemo(() => ({
    'semifinal-1': getPlayoffMatch(state.knockoutMatches, 'semifinal-1'),
    'spot-semifinal': getPlayoffMatch(state.knockoutMatches, 'spot-semifinal'),
    'semifinal-2': getPlayoffMatch(state.knockoutMatches, 'semifinal-2'),
    'grand-final': getPlayoffMatch(state.knockoutMatches, 'grand-final'),
  }), [state.knockoutMatches])
  const activeKnockoutRound = useMemo(
    () => getActiveKnockoutRound(state.knockoutMatches),
    [state.knockoutMatches],
  )
  const activeKnockoutMatches = useMemo(
    () => getActiveKnockoutMatches(state.knockoutMatches),
    [state.knockoutMatches],
  )
  const completedKnockoutMatches = useMemo(
    () => state.knockoutMatches.filter(isKnockoutMatchComplete).length,
    [state.knockoutMatches],
  )
  const pendingKnockoutMatches = state.knockoutMatches.length - completedKnockoutMatches
  const canAdvanceKnockoutRound = !sixTeamChampionship && readyToEdit && state.status === 'knockout'
    && activeKnockoutMatches.length > 0
    && activeKnockoutMatches.every(isKnockoutMatchComplete)
  const finalMatch = useMemo(
    () => playoffMatches['grand-final']
      ?? state.knockoutMatches.find((match) => !match.stage && match.round === 2)
      ?? null,
    [playoffMatches, state.knockoutMatches],
  )
  const champion = useMemo(() => {
    const championId = state.winnerId
      ?? (finalMatch && isKnockoutMatchComplete(finalMatch) ? resolveKnockoutWinner(finalMatch) : null)
    return state.teams.find((team) => team.id === championId) ?? null
  }, [finalMatch, state.teams, state.winnerId])
  const canStartNext = useMemo(
    () => readyToEdit && canStartNextTournament(state),
    [readyToEdit, state],
  )
  const canEditKnockoutStageMatches = readyToEdit
    && state.status === 'knockout'
    && sixTeamChampionship
    && !state.knockoutMatches.some(hasEnteredKnockoutScore)
  const isKnockoutMatchEditable = (match: KnockoutMatch) =>
    readyToEdit && canEditStoredKnockoutMatch(state, match)

  const addTeam = (name: string, imageUrl: string) => {
    const cleanName = name.trim()
    const cleanImageUrl = imageUrl.trim()
    const current = stateRef.current

    if (!canEditRef.current) {
      setMessage('Administrator access is required to add teams.')
      return false
    }
    if (current.status !== 'registration') {
      setMessage('Teams can only be added during registration.')
      return false
    }
    if (!cleanName || !cleanImageUrl) {
      setMessage('Team name and logo URL are required.')
      return false
    }
    try {
      new URL(cleanImageUrl)
    } catch {
      setMessage('Enter a valid logo image URL.')
      return false
    }
    if (current.teams.some((team) => team.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      setMessage('Team already exists.')
      return false
    }

    const added = commit((latest) => {
      if (latest.status !== 'registration') return null
      if (latest.teams.some((team) => team.name.trim().toLowerCase() === cleanName.toLowerCase())) return null
      return {
        ...latest,
        teams: [
          ...latest.teams,
          {
            id: crypto.randomUUID(),
            name: cleanName,
            imageUrl: cleanImageUrl,
            createdAt: new Date().toISOString(),
          },
        ],
      }
    })

    if (added) setMessage('Team added successfully.')
    return added
  }

  const editTeam = (id: string, name: string, imageUrl: string) => {
    const cleanName = name.trim()
    const cleanImageUrl = imageUrl.trim()
    if (!cleanName || !cleanImageUrl) return false
    return commit((current) => {
      if (current.status !== 'registration' || !current.teams.some((team) => team.id === id)) return null
      return {
        ...current,
        teams: current.teams.map((team) => team.id === id
          ? { ...team, name: cleanName, imageUrl: cleanImageUrl }
          : team),
      }
    })
  }

  const deleteTeam = (id: string) => {
    if (stateRef.current.status !== 'registration') {
      setMessage('Teams cannot be deleted after the tournament starts.')
      return false
    }
    return commit((current) => {
      if (current.status !== 'registration' || !current.teams.some((team) => team.id === id)) return null
      return { ...current, teams: current.teams.filter((team) => team.id !== id) }
    })
  }

  const draw = () => {
    const current = stateRef.current
    if (current.status !== 'registration') {
      setMessage('The tournament has already started.')
      return false
    }
    if (current.teams.length < 4) {
      setMessage('Minimum 4 teams required to start tournament.')
      return false
    }

    const groups = generateGroups(current.teams)
    const drawn = commit((latest) => {
      if (latest.status !== 'registration' || latest.teams.length < 4) return null
      return {
        ...latest,
        groups,
        matches: generateMatches(groups),
        qualifiedTeamIds: [],
        knockoutStageMatches: [],
        knockoutMatches: [],
        winnerId: null,
        status: 'groups',
        stage: 'Group Stage',
      }
    })
    if (drawn) setMessage('Groups confirmed. Fixtures generated.')
    return drawn
  }

  const regenerate = () => {
    const current = stateRef.current
    if (current.status !== 'groups') {
      setMessage('Groups can only be regenerated during the group stage.')
      return false
    }
    if (hasAnyMatchScore(current.matches) || hasAnyMatchSchedule(current.matches)) {
      setMessage('Clear match scores and schedules before regenerating groups.')
      return false
    }

    const regenerated = commit((latest) => {
      if (latest.status !== 'groups') return null
      if (hasAnyMatchScore(latest.matches) || hasAnyMatchSchedule(latest.matches)) return null
      const groups = generateGroups(latest.teams, latest.groups)
      return { ...latest, groups, matches: generateMatches(groups) }
    })
    if (regenerated) setMessage('Groups regenerated.')
    return regenerated
  }

  const scheduleMatch = (id: string, value: string | null) => {
    const scheduledAt = value === null || value.trim() === '' ? null : normalizeScheduledAt(value)
    if (value !== null && value.trim() !== '' && scheduledAt === null) {
      setMessage('Choose a valid match date and time.')
      return false
    }
    if (!canEditStoredGroupMatches(stateRef.current)) {
      setMessage('Group match times lock after the first Knockout Stage result is entered.')
      return false
    }

    const updated = commit((current) => {
      if (!canEditStoredGroupMatches(current)) return null
      const matches = setMatchSchedule(current.matches, id, scheduledAt)
      return matches ? { ...current, matches } : null
    })
    if (updated) setMessage(scheduledAt ? 'Match date and time updated.' : 'Match date and time cleared.')
    return updated
  }

  const score = (id: string, homeScore: number | null, awayScore: number | null) => {
    if (!isNullableScore(homeScore) || !isNullableScore(awayScore)) {
      setMessage('Scores must be whole numbers from 0 to 99.')
      return false
    }
    return commit((current) => {
      if (!canEditStoredGroupMatches(current) || !current.matches.some((match) => match.id === id)) return null
      const editableState: TournamentState = current.status === 'groups'
        ? current
        : {
            ...current,
            status: 'groups',
            stage: 'Group Stage',
            qualifiedTeamIds: [],
            knockoutStageMatches: [],
            knockoutMatches: [],
            winnerId: null,
          }
      const scored = {
        ...editableState,
        matches: editableState.matches.map((match) => match.id === id
          ? {
              ...match,
              homeScore,
              awayScore,
              playedAt: homeScore !== null && awayScore !== null ? new Date().toISOString() : undefined,
            }
          : match),
      }
      return reconcileTournamentProgression(scored)
    })
  }

  const startKnockout = () => {
    const current = stateRef.current
    if (current.status !== 'groups') {
      setMessage('The knockout stage can only start after the group stage.')
      return false
    }
    if (!areGroupFixturesComplete(current.groups, current.matches)) {
      setMessage('Complete every group match before starting the knockout stage.')
      return false
    }
    const usesSixTeamFormat = getSixQualifiers(current.groups, current.teams, current.matches).length === 6

    const started = commit((latest) => {
      if (latest.status !== 'groups' || !areGroupFixturesComplete(latest.groups, latest.matches)) return null
      const progressed = reconcileTournamentProgression(latest)
      if (progressed !== latest) return progressed

      const knockoutMatches = createKnockoutBracket(latest.groups, latest.teams, latest.matches)
      if (!knockoutMatches.length) return null
      return {
        ...latest,
        knockoutMatches,
        status: 'knockout',
        stage: knockoutStageName(getActiveKnockoutRound(knockoutMatches)),
      }
    })
    if (started) setMessage(usesSixTeamFormat
      ? 'Six teams qualified. All 15 Knockout Stage fixtures were generated.'
      : 'Knockout bracket generated.')
    return started
  }

  const knockoutStageScore = (id: string, homeScore: number | null, awayScore: number | null) => {
    if (!isNullableScore(homeScore) || !isNullableScore(awayScore)) {
      setMessage('Scores must be whole numbers from 0 to 99.')
      return false
    }

    const updated = commit((current) => {
      if (current.status !== 'knockout' || !isSixTeamChampionship(current)) return null
      if (current.knockoutMatches.some(hasEnteredKnockoutScore)) return null
      if (!current.knockoutStageMatches.some(match => match.id === id)) return null

      const knockoutStageMatches = current.knockoutStageMatches.map(match => match.id === id
        ? {
            ...match,
            homeScore,
            awayScore,
            playedAt: homeScore !== null && awayScore !== null ? new Date().toISOString() : undefined,
          }
        : match)
      // Unplayed playoff fixtures are derived from the standings. Rebuild them
      // when an administrator corrects a round-robin result before playoff play.
      return reconcileTournamentProgression({
        ...current,
        knockoutStageMatches,
        knockoutMatches: [],
        stage: 'Knockout Stage',
      })
    })

    if (!updated && stateRef.current.knockoutMatches.some(hasEnteredKnockoutScore)) {
      setMessage('Knockout Stage results lock after a playoff score is entered.')
    }
    return updated
  }

  const knockoutScore = (
    id: string,
    homeScore: number | null,
    awayScore: number | null,
    homePenaltyScore: number | null = null,
    awayPenaltyScore: number | null = null,
  ) => {
    if (![homeScore, awayScore, homePenaltyScore, awayPenaltyScore].every(isNullableScore)) {
      setMessage('Scores must be whole numbers from 0 to 99.')
      return false
    }

    const updated = commit((current) => {
      if (current.status !== 'knockout') return null
      const storedTarget = current.knockoutMatches.find(match => match.id === id)
      if (!storedTarget || !canEditStoredKnockoutMatch(current, storedTarget)) return null

      let retainedMatches = current.knockoutMatches
      if (storedTarget.stage === 'semifinal-1' || storedTarget.stage === 'spot-semifinal') {
        retainedMatches = retainedMatches.filter(match =>
          match.stage !== 'semifinal-2' && match.stage !== 'grand-final')
      } else if (storedTarget.stage === 'semifinal-2') {
        retainedMatches = retainedMatches.filter(match => match.stage !== 'grand-final')
      }
      const target = retainedMatches.find(match => match.id === id)
      if (!target || !target.homeId || !target.awayId) return null

      const needsPenalties = homeScore !== null && awayScore !== null && homeScore === awayScore
      const scoredMatch = {
        ...target,
        homeScore,
        awayScore,
        homePenaltyScore: needsPenalties ? homePenaltyScore : null,
        awayPenaltyScore: needsPenalties ? awayPenaltyScore : null,
        winnerId: null,
        playedAt: undefined,
      }
      const winnerId = resolveKnockoutWinner(scoredMatch)
      const nextMatch = {
        ...scoredMatch,
        winnerId,
        playedAt: winnerId ? new Date().toISOString() : undefined,
      }

      const scoredState = {
        ...current,
        knockoutMatches: retainedMatches.map((match) => match.id === id ? nextMatch : match),
      }
      return target.stage ? reconcileTournamentProgression(scoredState) : scoredState
    })

    if (!updated) {
      setMessage('Only active knockout matches can be scored.')
    }
    return updated
  }

  const advanceKnockoutRound = () => {
    const current = stateRef.current
    if (current.status !== 'knockout') {
      setMessage('There is no active knockout round to advance.')
      return false
    }
    if (isSixTeamChampionship(current)) {
      setMessage('This championship advances automatically as each required result is completed.')
      return false
    }

    const activeMatches = getActiveKnockoutMatches(current.knockoutMatches)
    const activeRound = getActiveKnockoutRound(current.knockoutMatches)
    if (!activeMatches.length || !activeMatches.every(isKnockoutMatchComplete)) {
      setMessage('Resolve every active knockout match before advancing.')
      return false
    }

    if (activeRound === 2 && activeMatches.length === 1) {
      const finalWinnerId = getConfirmableChampionId(current)
      const winner = current.teams.find((team) => team.id === finalWinnerId)
      if (!finalWinnerId || !winner) {
        setMessage('Complete the verified group, knockout, and final path before crowning a champion.')
        return false
      }

      const completed = commit((latest) => {
        if (latest.status !== 'knockout') return null
        const latestActiveMatches = getActiveKnockoutMatches(latest.knockoutMatches)
        if (getActiveKnockoutRound(latest.knockoutMatches) !== 2
          || latestActiveMatches.length !== 1
          || !latestActiveMatches.every(isKnockoutMatchComplete)) return null
        const latestWinnerId = getConfirmableChampionId(latest)
        const latestWinner = latest.teams.find((team) => team.id === latestWinnerId)
        if (!latestWinnerId || !latestWinner) return null

        const historyItem: HistoryItem = {
          id: crypto.randomUUID(),
          tournamentNumber: latest.tournamentNumber,
          winnerId: latestWinnerId,
          winnerName: latestWinner.name,
          completedAt: new Date().toISOString(),
        }
        return {
          ...latest,
          status: 'completed',
          stage: 'Completed',
          winnerId: latestWinnerId,
          history: [
            ...latest.history.filter((item) => item.tournamentNumber !== latest.tournamentNumber),
            historyItem,
          ],
        }
      })
      if (completed) setMessage(`${winner.name} crowned champion!`)
      return completed
    }

    const advanced = commit((latest) => {
      if (latest.status !== 'knockout') return null
      const latestActiveMatches = getActiveKnockoutMatches(latest.knockoutMatches)
      if (!latestActiveMatches.length || !latestActiveMatches.every(isKnockoutMatchComplete)) return null
      const nextMatches = createNextKnockoutRound(latest.knockoutMatches)
      if (!nextMatches.length) return null
      return {
        ...latest,
        knockoutMatches: [...latest.knockoutMatches, ...nextMatches],
        stage: knockoutStageName(getActiveKnockoutRound(nextMatches)),
      }
    })
    if (advanced) setMessage('Next knockout round is ready.')
    return advanced
  }

  // Kept for compatibility with older UI code, but it can no longer bypass the final.
  const complete = (winnerId: string) => {
    const activeMatches = getActiveKnockoutMatches(stateRef.current.knockoutMatches)
    if (getActiveKnockoutRound(stateRef.current.knockoutMatches) !== 2
      || activeMatches.length !== 1
      || resolveKnockoutWinner(activeMatches[0]) !== winnerId) {
      setMessage('The champion is decided by the completed knockout final.')
      return false
    }
    return advanceKnockoutRound()
  }

  const nextTournament = (confirmed?: boolean) => {
    if (!canStartNextTournament(stateRef.current)) {
      setMessage('Finish and confirm the final before starting the next tournament.')
      return false
    }

    const approved = typeof confirmed === 'boolean'
      ? confirmed
      : typeof window !== 'undefined'
        && window.confirm('Start the next tournament? Current groups and match results will be cleared.')
    if (!approved) return false

    const started = commit((current) => {
      if (!canStartNextTournament(current)) return null
      return {
        ...current,
        tournamentNumber: current.tournamentNumber + 1,
        status: 'registration',
        stage: 'Team Registration',
        groups: [],
        matches: [],
        qualifiedTeamIds: [],
        knockoutStageMatches: [],
        knockoutMatches: [],
        winnerId: null,
      }
    })
    if (started) setMessage('Registration opened for the next tournament.')
    return started
  }

  const updateHistory = (id: string, winnerName: string) => commit((current) => ({
    ...current,
    history: current.history.map((historyItem) => historyItem.id === id
      ? { ...historyItem, winnerName }
      : historyItem),
  }))

  return {
    state,
    hydrated,
    allStandings,
    stars,
    completedMatches,
    pendingMatches,
    groupComplete,
    canEditGroupMatches,
    canRegenerateGroups,
    canStartKnockout,
    isSixTeamChampionship: sixTeamChampionship,
    qualificationEntries,
    knockoutStageMatches,
    knockoutStandings: knockoutTable,
    completedKnockoutStageMatches,
    knockoutStageComplete,
    playoffMatches,
    canEditKnockoutStageMatches,
    isKnockoutMatchEditable,
    activeKnockoutRound,
    activeKnockoutMatches,
    completedKnockoutMatches,
    pendingKnockoutMatches,
    canAdvanceKnockoutRound,
    finalMatch,
    champion,
    canStartNext,
    message,
    syncing,
    liveStatus,
    setMessage,
    addTeam,
    editTeam,
    deleteTeam,
    draw,
    regenerate,
    scheduleMatch,
    score,
    startKnockout,
    knockoutStageScore,
    knockoutScore,
    advanceKnockoutRound,
    complete,
    nextTournament,
    updateHistory,
  }
}
