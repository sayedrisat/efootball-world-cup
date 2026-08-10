import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, readRemoteState, saveRemoteState, subscribeRemote, type RemoteStateSnapshot } from '../services/leagueSupabase'
import type { HistoryItem, TournamentState } from '../types'
import {
  areGroupFixturesComplete,
  canStartNextTournament,
  createKnockoutBracket,
  createNextKnockoutRound,
  generateGroups,
  generateMatches,
  getActiveKnockoutMatches,
  getActiveKnockoutRound,
  getConfirmableChampionId,
  hasAnyMatchScore,
  initialState,
  isKnockoutMatchComplete,
  normalizeState,
  resolveKnockoutWinner,
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

type StateUpdate = (current: TournamentState) => TournamentState | null

export function useTournament(canEdit: boolean, userId?: string) {
  const [state, setState] = useState<TournamentState>(readLocal)
  const [message, setMessage] = useState('')
  const [syncing, setSyncing] = useState(isSupabaseConfigured)
  const [hydrated, setHydrated] = useState(!isSupabaseConfigured)
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
        .then((incoming) => applyRemote(incoming, true))
        .catch((error) => {
          if (!active || hydratedRef.current) return
          setMessage(error instanceof Error ? error.message : 'Could not load the live tournament.')
          hydrationRetryTimerRef.current = window.setTimeout(loadRemote, 2500)
        })
    }

    loadRemote()

    const stop = subscribeRemote((incoming) => applyRemote(incoming, true))
    return () => {
      active = false
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
  const groupComplete = useMemo(
    () => areGroupFixturesComplete(state.groups, state.matches),
    [state.groups, state.matches],
  )
  const canRegenerateGroups = readyToEdit && state.status === 'groups' && !hasAnyMatchScore(state.matches)
  const canStartKnockout = readyToEdit && state.status === 'groups' && groupComplete
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
  const canAdvanceKnockoutRound = readyToEdit && state.status === 'knockout'
    && activeKnockoutMatches.length > 0
    && activeKnockoutMatches.every(isKnockoutMatchComplete)
  const finalMatch = useMemo(
    () => state.knockoutMatches.find((match) => match.round === 2) ?? null,
    [state.knockoutMatches],
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
    if (hasAnyMatchScore(current.matches)) {
      setMessage('Cannot regenerate groups after results are entered.')
      return false
    }

    const regenerated = commit((latest) => {
      if (latest.status !== 'groups') return null
      if (hasAnyMatchScore(latest.matches)) return null
      const groups = generateGroups(latest.teams, latest.groups)
      return { ...latest, groups, matches: generateMatches(groups) }
    })
    if (regenerated) setMessage('Groups regenerated.')
    return regenerated
  }

  const score = (id: string, homeScore: number | null, awayScore: number | null) => {
    if (!isNullableScore(homeScore) || !isNullableScore(awayScore)) {
      setMessage('Scores must be whole numbers from 0 to 99.')
      return false
    }
    return commit((current) => {
      if (current.status !== 'groups' || !current.matches.some((match) => match.id === id)) return null
      return {
        ...current,
        matches: current.matches.map((match) => match.id === id
          ? {
              ...match,
              homeScore,
              awayScore,
              playedAt: homeScore !== null && awayScore !== null ? new Date().toISOString() : undefined,
            }
          : match),
      }
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

    const started = commit((latest) => {
      if (latest.status !== 'groups' || !areGroupFixturesComplete(latest.groups, latest.matches)) return null
      const knockoutMatches = createKnockoutBracket(latest.groups, latest.teams, latest.matches)
      if (!knockoutMatches.length) return null
      return {
        ...latest,
        knockoutMatches,
        status: 'knockout',
        stage: knockoutStageName(getActiveKnockoutRound(knockoutMatches)),
      }
    })
    if (started) setMessage('Knockout bracket generated.')
    return started
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
      const activeRound = getActiveKnockoutRound(current.knockoutMatches)
      const target = current.knockoutMatches.find((match) => match.id === id && match.round === activeRound)
      if (!target || !target.homeId || !target.awayId) return null

      const scoredMatch = {
        ...target,
        homeScore,
        awayScore,
        homePenaltyScore,
        awayPenaltyScore,
        winnerId: null,
        playedAt: undefined,
      }
      const winnerId = resolveKnockoutWinner(scoredMatch)
      const nextMatch = {
        ...scoredMatch,
        winnerId,
        playedAt: winnerId ? new Date().toISOString() : undefined,
      }

      return {
        ...current,
        knockoutMatches: current.knockoutMatches.map((match) => match.id === id ? nextMatch : match),
      }
    })

    if (!updated && stateRef.current.status !== 'knockout') {
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
    canRegenerateGroups,
    canStartKnockout,
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
    setMessage,
    addTeam,
    editTeam,
    deleteTeam,
    draw,
    regenerate,
    score,
    startKnockout,
    knockoutScore,
    advanceKnockoutRound,
    complete,
    nextTournament,
    updateHistory,
  }
}
