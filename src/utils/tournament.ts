import type { Group, HistoryItem, KnockoutMatch, Match, Phase, Standing, Team, TournamentState } from '../types'

const seededHistory: HistoryItem[] = [
  ['England', 1], ['England', 2], ['Germany', 3], ['Spain', 4], ['Honduras', 5],
].map(([winnerName, tournamentNumber]) => ({ id: `history-${tournamentNumber}`, tournamentNumber: Number(tournamentNumber), winnerId: '', winnerName: String(winnerName), completedAt: `2025-0${tournamentNumber}-01T00:00:00.000Z` }))

export const initialState = (): TournamentState => ({
  version: 4,
  tournamentNumber: 6,
  status: 'registration',
  stage: 'Team Registration',
  teams: [],
  groups: [],
  matches: [],
  knockoutMatches: [],
  history: [...seededHistory],
  winnerId: null,
  updatedAt: new Date().toISOString(),
})

const phases: Phase[] = ['registration', 'groups', 'knockout', 'completed']
const erroneousTournamentSixHistoryId = 'e02d6055-8f6d-410f-93f2-48b7ab91f83f'
const erroneousTournamentSixWinnerId = '62c035a1-0775-4df8-9e75-900d16e89f49'
const erroneousTournamentSixCompletedAt = '2026-08-10T18:09:02.841Z'

export type StateMigrationKind = 'rollback-skipped-tournament-6' | 'upgrade-v4'

/** Exact, one-time fingerprint of the live #6 skip; legitimate #5 history is untouched. */
export function isSkippedTournamentSixState(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const persisted = value as Omit<Partial<TournamentState>, 'version'> & { version?: number }
  const history = Array.isArray(persisted.history) ? persisted.history : []
  const isUnfinishedSkippedTournament = persisted.status === 'registration'
    || persisted.status === 'groups'
    || persisted.status === 'knockout'
  return (persisted.version === 3 || persisted.version === 4)
    && persisted.tournamentNumber === 7
    && isUnfinishedSkippedTournament
    && persisted.winnerId === null
    && Array.isArray(persisted.teams) && persisted.teams.length === 8
    && history.length === 6
    && history.some(item => item.id === erroneousTournamentSixHistoryId
      && item.tournamentNumber === 6
      && item.winnerName.trim().toLowerCase() === 'honduras'
      && item.winnerId === erroneousTournamentSixWinnerId
      && item.completedAt === erroneousTournamentSixCompletedAt)
}

export function getStateMigrationKind(value: unknown): StateMigrationKind | null {
  if (isSkippedTournamentSixState(value)) return 'rollback-skipped-tournament-6'
  if (value && typeof value === 'object' && (value as { version?: number }).version === 3) return 'upgrade-v4'
  return null
}

function knockoutStageLabel(round: number | null) {
  if (round === 2) return 'Final'
  if (round === 4) return 'Semi-finals'
  if (round === 8) return 'Quarter-finals'
  return round ? `Round of ${round}` : 'Knockout Stage'
}

/** Accepts both the previous v3 payload and the current v4 payload. */
export function normalizeState(value: unknown): TournamentState {
  if (!value || typeof value !== 'object') return initialState()

  const persisted = value as Omit<Partial<TournamentState>, 'version'> & { version?: number }
  if (persisted.version !== 3 && persisted.version !== 4) return initialState()

  const fresh = initialState()
  const rollbackSkippedSix = isSkippedTournamentSixState(value)
  const persistedTournamentNumber = typeof persisted.tournamentNumber === 'number' ? persisted.tournamentNumber : fresh.tournamentNumber
  const tournamentNumber = rollbackSkippedSix ? 6 : persistedTournamentNumber
  const teams = Array.isArray(persisted.teams) ? persisted.teams : []
  const groups = rollbackSkippedSix ? [] : Array.isArray(persisted.groups) ? persisted.groups : []
  const matches = rollbackSkippedSix ? [] : Array.isArray(persisted.matches) ? persisted.matches : []
  const knockoutMatches = rollbackSkippedSix ? [] : Array.isArray(persisted.knockoutMatches) ? persisted.knockoutMatches : []
  const persistedHistory = Array.isArray(persisted.history) && persisted.history.length ? persisted.history : [...seededHistory]
  const history = rollbackSkippedSix
    ? persistedHistory.filter(item => item.id !== erroneousTournamentSixHistoryId)
    : persistedHistory
  const persistedStatus = rollbackSkippedSix
    ? 'registration'
    : phases.includes(persisted.status as Phase) ? persisted.status as Phase : fresh.status
  const persistedWinnerId = rollbackSkippedSix ? null : typeof persisted.winnerId === 'string' ? persisted.winnerId : null
  const final = knockoutMatches.find(match => match.round === 2)
  const hasArchivedWinner = Boolean(persistedWinnerId && history.some(item =>
    item.tournamentNumber === tournamentNumber && item.winnerId === persistedWinnerId))
  const hasTrustedCompletion = Boolean(
    final
    && persistedWinnerId
    && resolveKnockoutWinner(final) === persistedWinnerId
    && isValidCompletedKnockoutBracket(groups, teams, matches, knockoutMatches)
    && hasArchivedWinner,
  )
  // Older and malformed payloads could say "completed" without a resolved,
  // archived final. Reopen the last recoverable stage instead of exposing Next.
  const reopenInvalidCompletion = persistedStatus === 'completed' && !hasTrustedCompletion
  const recoveredStatus: Phase = knockoutMatches.length ? 'knockout' : groups.length ? 'groups' : 'registration'
  const status: Phase = reopenInvalidCompletion ? recoveredStatus : persistedStatus

  return {
    ...fresh,
    tournamentNumber,
    status,
    stage: rollbackSkippedSix
      ? 'Team Registration'
      : reopenInvalidCompletion
      ? (recoveredStatus === 'knockout'
          ? knockoutStageLabel(getActiveKnockoutRound(knockoutMatches))
          : recoveredStatus === 'groups' ? 'Group Stage' : 'Team Registration')
      : typeof persisted.stage === 'string' ? persisted.stage : fresh.stage,
    teams,
    groups,
    matches,
    knockoutMatches,
    history: reopenInvalidCompletion
      ? history.filter(item => item.tournamentNumber !== tournamentNumber)
      : history,
    winnerId: reopenInvalidCompletion ? null : persistedWinnerId,
    updatedAt: typeof persisted.updatedAt === 'string' ? persisted.updatedAt : fresh.updatedAt,
    version: 4,
  }
}

export const slug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const starCounts = (history: HistoryItem[]) => history.reduce<Record<string, number>>((acc, item) => { const key = item.winnerName.toLowerCase(); acc[key] = (acc[key] || 0) + 1; return acc }, {})

/** Returns an integer in [0, upperExclusive) without modulo bias when Web Crypto is available. */
function randomIndex(upperExclusive: number) {
  if (upperExclusive <= 1) return 0

  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues && upperExclusive <= 0x1_0000_0000) {
    try {
      const range = 0x1_0000_0000
      const limit = range - (range % upperExclusive)
      const buffer = new Uint32Array(1)
      for (let attempt = 0; attempt < 128; attempt++) {
        cryptoApi.getRandomValues(buffer)
        if (buffer[0] < limit) return buffer[0] % upperExclusive
      }
    } catch {
      // Sandboxed/older browsers can expose crypto while denying random access.
    }
  }

  return Math.floor(Math.random() * upperExclusive)
}

/** Fisher-Yates shuffle; the input array is never mutated. */
export function shuffled<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

type GroupDraft = Pick<Group, 'name' | 'teamIds'>

function groupLabel(index: number) {
  let value = index + 1
  let label = ''
  while (value > 0) {
    value--
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

function draftGroups(teams: Team[]): GroupDraft[] {
  if (!teams.length) return []
  const count = Math.max(1, Math.ceil(teams.length / 4))
  const groups = Array.from({ length: count }, (_, i) => ({ name: `Group ${groupLabel(i)}`, teamIds: [] as string[] }))
  shuffled(teams).forEach((team, i) => groups[i % count].teamIds.push(team.id))
  return groups
}

function groupSignature(groups: Array<Pick<Group, 'teamIds'>>) {
  if (groups.length === 1) return groups[0].teamIds.join('\u0000')
  return groups.map(group => [...group.teamIds].sort().join('\u0000')).join('\u0001')
}

let fallbackId = 0
function createDrawId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {
    // The timestamp/counter fallback below is sufficient for local React keys.
  }
  fallbackId += 1
  return `${Date.now().toString(36)}-${fallbackId.toString(36)}`
}

/**
 * Produces balanced groups of at most four. When a previous draw is supplied,
 * it makes bounded retries to return a visibly different allocation whenever possible.
 */
export function generateGroups(teams: Team[], previousGroups: Group[] = []): Group[] {
  if (!teams.length) return []

  const previousSignature = previousGroups.length ? groupSignature(previousGroups) : ''
  const canDiffer = teams.length > 1
  const attempts = previousSignature && canDiffer ? 24 : 1
  let selected = draftGroups(teams)

  for (let attempt = 1; attempt < attempts && groupSignature(selected) === previousSignature; attempt++) {
    selected = draftGroups(teams)
  }

  // A deterministic last resort makes regeneration visibly change even if an
  // RNG implementation repeatedly returns the same sequence.
  if (canDiffer && groupSignature(selected) === previousSignature) {
    selected = selected.map(group => ({ ...group, teamIds: [...group.teamIds] }))
    if (selected.length === 1) {
      ;[selected[0].teamIds[0], selected[0].teamIds[1]] = [selected[0].teamIds[1], selected[0].teamIds[0]]
    } else {
      ;[selected[0].teamIds[0], selected[1].teamIds[0]] = [selected[1].teamIds[0], selected[0].teamIds[0]]
    }
  }

  const drawId = createDrawId()
  return selected.map((group, i) => ({ ...group, id: `g-${drawId}-${i}` }))
}

export function generateMatches(groups: Group[]): Match[] {
  return groups.flatMap(group => group.teamIds.flatMap((homeId, i) => group.teamIds.slice(i + 1).map(awayId => ({
    id: `${group.id}-${homeId}-${awayId}`,
    groupId: group.id,
    homeId,
    awayId,
    homeScore: null,
    awayScore: null,
  }))))
}

/** True even for a partial score, so a redraw cannot discard either entered side. */
export function hasAnyMatchScore(matches: Match[]) {
  return matches.some(match => match.homeScore !== null || match.awayScore !== null)
}

export function allGroupMatchesComplete(matches: Match[]) {
  return matches.length > 0 && matches.every(match =>
    isValidStoredScore(match.homeScore) && isValidStoredScore(match.awayScore))
}

function isValidStoredScore(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 99
}

function fixtureKey(groupId: string, firstTeamId: string, secondTeamId: string) {
  const [left, right] = [firstTeamId, secondTeamId].sort()
  return `${groupId}\u0000${left}\u0000${right}`
}

/** Verifies that every expected group pairing exists exactly once and is scored. */
export function areGroupFixturesComplete(groups: Group[], matches: Match[]) {
  const expected = new Set(groups.flatMap(group => group.teamIds.flatMap((homeId, index) =>
    group.teamIds.slice(index + 1).map(awayId => fixtureKey(group.id, homeId, awayId)))))
  if (!expected.size || matches.length !== expected.size) return false

  const actual = new Set(matches.map(match => fixtureKey(match.groupId, match.homeId, match.awayId)))
  return actual.size === expected.size
    && [...expected].every(key => actual.has(key))
    && allGroupMatchesComplete(matches)
}

export function standings(teams: Team[], matches: Match[], teamIds = teams.map(team => team.id)): Standing[] {
  const teamsById = new Map(teams.map(team => [team.id, team]))
  const drawOrder = new Map(teamIds.map((id, index) => [id, index]))
  const rows = new Map<string, Standing>()

  teamIds.forEach(id => {
    const team = teamsById.get(id)
    if (!team) return
    rows.set(id, { ...team, position: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 })
  })

  matches.forEach(match => {
    if (match.homeScore === null || match.awayScore === null) return
    const home = rows.get(match.homeId)
    const away = rows.get(match.awayId)
    if (!home || !away) return

    home.played++
    away.played++
    home.goalsFor += match.homeScore
    home.goalsAgainst += match.awayScore
    away.goalsFor += match.awayScore
    away.goalsAgainst += match.homeScore

    if (match.homeScore > match.awayScore) {
      home.wins++
      home.points += 3
      away.losses++
    } else if (match.homeScore < match.awayScore) {
      away.wins++
      away.points += 3
      home.losses++
    } else {
      home.draws++
      away.draws++
      home.points++
      away.points++
    }
  })

  return [...rows.values()]
    .map(row => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || b.wins - a.wins
      || (drawOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (drawOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    .map((row, index) => ({ ...row, position: index + 1 }))
}

function nextPowerOfTwo(value: number) {
  let size = 2
  while (size < value) size *= 2
  return size
}

function knockoutMatch(round: number, order: number, homeId: string | null, awayId: string | null): KnockoutMatch {
  const winnerId = homeId && !awayId ? homeId : awayId && !homeId ? awayId : null
  return {
    id: `knockout-${round}-${order}`,
    round,
    order,
    homeId,
    awayId,
    homeScore: null,
    awayScore: null,
    homePenaltyScore: null,
    awayPenaltyScore: null,
    winnerId,
  }
}

/** Builds the first knockout round from the top two finishers in each group. */
export function createKnockoutBracket(groups: Group[], teams: Team[], groupMatches: Match[]): KnockoutMatch[] {
  if (!areGroupFixturesComplete(groups, groupMatches)) return []

  const qualifiers = groups.flatMap(group => standings(
    teams,
    groupMatches.filter(match => match.groupId === group.id),
    group.teamIds,
  ).slice(0, 2).map((team, rank) => ({ teamId: team.id, groupId: group.id, rank: rank + 1 })))
  const uniqueQualifiers = qualifiers.filter((qualifier, index) =>
    qualifiers.findIndex(item => item.teamId === qualifier.teamId) === index)
  if (uniqueQualifiers.length < 2) return []

  const round = nextPowerOfTwo(uniqueQualifiers.length)
  const byeCount = round - uniqueQualifiers.length
  // Byes are earned by group winners first, then (only if unavoidable) runners-up.
  const seedOrder = [...uniqueQualifiers].sort((a, b) => a.rank - b.rank)
  const byeRecipients = seedOrder.slice(0, byeCount)
  const byeIds = new Set(byeRecipients.map(qualifier => qualifier.teamId))
  const remaining = uniqueQualifiers.filter(qualifier => !byeIds.has(qualifier.teamId))
  const contestedPairs: Array<[string, string]> = []
  const groupBuckets = new Map<string, typeof remaining>()
  remaining.forEach(qualifier => {
    const bucket = groupBuckets.get(qualifier.groupId) ?? []
    bucket.push(qualifier)
    bucket.sort((a, b) => a.rank - b.rank)
    groupBuckets.set(qualifier.groupId, bucket)
  })

  while ([...groupBuckets.values()].some(bucket => bucket.length)) {
    const populated = [...groupBuckets.entries()]
      .filter(([, bucket]) => bucket.length)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    if (populated.length < 2) {
      const onlyBucket = populated[0]?.[1]
      if (!onlyBucket || onlyBucket.length < 2) return []
      const home = onlyBucket.shift()!
      const away = onlyBucket.shift()!
      contestedPairs.push([home.teamId, away.teamId])
      continue
    }

    const [homeGroupId, homeBucket] = populated[0]
    const home = homeBucket.shift()!
    const opponentGroups = populated
      .slice(1)
      .sort((a, b) => {
        const aHasOppositeRank = a[1].some(candidate => candidate.rank !== home.rank) ? 1 : 0
        const bHasOppositeRank = b[1].some(candidate => candidate.rank !== home.rank) ? 1 : 0
        return bHasOppositeRank - aHasOppositeRank || b[1].length - a[1].length || a[0].localeCompare(b[0])
      })
    const [awayGroupId, awayBucket] = opponentGroups[0]
    const oppositeRankIndex = awayBucket.findIndex(candidate => candidate.rank !== home.rank)
    const [away] = awayBucket.splice(oppositeRankIndex >= 0 ? oppositeRankIndex : 0, 1)
    groupBuckets.set(homeGroupId, homeBucket)
    groupBuckets.set(awayGroupId, awayBucket)
    contestedPairs.push([home.teamId, away.teamId])
  }

  const byePairs: Array<[string, null]> = byeRecipients.map(qualifier => [qualifier.teamId, null])
  const seededPairs: Array<[string, string | null]> = []
  // Interleave byes with contested ties so automatic qualifiers are spread
  // across the bracket instead of being clustered in one branch.
  while (byePairs.length || contestedPairs.length) {
    if (byePairs.length) seededPairs.push(byePairs.shift()!)
    if (contestedPairs.length) seededPairs.push(contestedPairs.shift()!)
  }

  return seededPairs.map(([homeId, awayId], index) => knockoutMatch(round, index + 1, homeId, awayId))
}

/** Derives the winner from participants and scores; a tied regulation score needs a penalty winner. */
export function resolveKnockoutWinner(match: KnockoutMatch): string | null {
  if (match.homeId && !match.awayId) return match.homeId
  if (match.awayId && !match.homeId) return match.awayId
  if (!match.homeId || !match.awayId
    || !isValidStoredScore(match.homeScore) || !isValidStoredScore(match.awayScore)) return null
  if (match.homeScore > match.awayScore) return match.homeId
  if (match.awayScore > match.homeScore) return match.awayId
  if (!isValidStoredScore(match.homePenaltyScore) || !isValidStoredScore(match.awayPenaltyScore)) return null
  if (match.homePenaltyScore > match.awayPenaltyScore) return match.homeId
  if (match.awayPenaltyScore > match.homePenaltyScore) return match.awayId
  return null
}

export function isKnockoutMatchComplete(match: KnockoutMatch) {
  return resolveKnockoutWinner(match) !== null
}

/** The smallest round is the latest round appended to the bracket. */
export function getActiveKnockoutRound(matches: KnockoutMatch[]): number | null {
  return matches.length ? Math.min(...matches.map(match => match.round)) : null
}

export function getActiveKnockoutMatches(matches: KnockoutMatch[]) {
  const activeRound = getActiveKnockoutRound(matches)
  return activeRound === null
    ? []
    : matches.filter(match => match.round === activeRound).sort((a, b) => a.order - b.order)
}

/** Returns only the next round; callers append it to the stored bracket. */
export function createNextKnockoutRound(matches: KnockoutMatch[]): KnockoutMatch[] {
  const activeRound = getActiveKnockoutRound(matches)
  if (activeRound === null || activeRound <= 2 || activeRound % 2 !== 0) return []

  const activeMatches = getActiveKnockoutMatches(matches)
  const winners = activeMatches.map(resolveKnockoutWinner)
  if (!activeMatches.length || winners.some(winner => winner === null)) return []

  const nextRound = activeRound / 2
  return Array.from({ length: winners.length / 2 }, (_, index) => knockoutMatch(
    nextRound,
    index + 1,
    winners[index * 2] ?? null,
    winners[index * 2 + 1] ?? null,
  ))
}

/**
 * Validates the complete bracket tree, not just a lone resolved final. Every
 * stored round must match the qualifiers/parents from the preceding round.
 */
export function isValidCompletedKnockoutBracket(
  groups: Group[],
  teams: Team[],
  groupMatches: Match[],
  knockoutMatches: KnockoutMatch[],
) {
  let expectedRound = createKnockoutBracket(groups, teams, groupMatches)
  if (!expectedRound.length || !knockoutMatches.length) return false
  if (new Set(knockoutMatches.map(match => match.id)).size !== knockoutMatches.length) return false

  const validated: KnockoutMatch[] = []
  while (expectedRound.length) {
    const round = expectedRound[0].round
    const actualRound = knockoutMatches
      .filter(match => match.round === round)
      .sort((a, b) => a.order - b.order)
    if (actualRound.length !== expectedRound.length) return false

    for (let index = 0; index < expectedRound.length; index++) {
      const expected = expectedRound[index]
      const actual = actualRound[index]
      const resolvedWinner = resolveKnockoutWinner(actual)
      if (actual.order !== expected.order
        || actual.homeId !== expected.homeId
        || actual.awayId !== expected.awayId
        || !resolvedWinner
        || actual.winnerId !== resolvedWinner) return false
    }

    validated.push(...actualRound)
    if (round === 2) break
    expectedRound = createNextKnockoutRound(validated)
    if (!expectedRound.length) return false
  }

  return validated.length === knockoutMatches.length
}

/** Returns a champion only when the entire group-to-final path is valid. */
export function getConfirmableChampionId(state: TournamentState) {
  if (state.status !== 'knockout' || getActiveKnockoutRound(state.knockoutMatches) !== 2) return null
  const activeMatches = getActiveKnockoutMatches(state.knockoutMatches)
  if (activeMatches.length !== 1) return null
  const winnerId = resolveKnockoutWinner(activeMatches[0])
  if (!winnerId || !state.teams.some(team => team.id === winnerId)) return null
  return isValidCompletedKnockoutBracket(state.groups, state.teams, state.matches, state.knockoutMatches)
    ? winnerId
    : null
}

/** A new tournament is available only after every stage and the final have a resolved winner. */
export function canStartNextTournament(state: TournamentState) {
  if (state.status !== 'completed' || !state.winnerId || !areGroupFixturesComplete(state.groups, state.matches)) return false
  if (!isValidCompletedKnockoutBracket(state.groups, state.teams, state.matches, state.knockoutMatches)) return false
  const final = state.knockoutMatches.find(match => match.round === 2)
  const archived = state.history.some(item =>
    item.tournamentNumber === state.tournamentNumber && item.winnerId === state.winnerId)
  return Boolean(final && resolveKnockoutWinner(final) === state.winnerId && archived)
}
