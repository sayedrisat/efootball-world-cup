import assert from 'node:assert/strict'
import test from 'node:test'

import {
  areKnockoutStageFixturesComplete,
  canStartNextTournament,
  createKnockoutBracket,
  createKnockoutStageMatches,
  createNextKnockoutRound,
  generateMatches,
  getPlayoffMatch,
  getSixQualifiers,
  hasValidKnockoutStageFixtures,
  initialState,
  isValidCompletedSixTeamChampionship,
  knockoutStandings,
  normalizeState,
  reconcileTournamentProgression,
  resolveKnockoutWinner,
} from '../src/utils/tournament.ts'

const COMPLETED_AT = '2026-08-12T12:00:00.000Z'
const KNOCKOUT_RANK_ORDER = ['b-3', 'a-3', 'b-2', 'a-2', 'b-1', 'a-1']

const makeTeam = (id, name = `Team ${id.toUpperCase()}`) => ({
  id,
  name,
  imageUrl: `https://example.test/${id}.png`,
  createdAt: '2026-08-01T00:00:00.000Z',
})

function makeScenario({ completeGroups = true } = {}) {
  const teams = [
    makeTeam('a-1', 'Group A One'),
    makeTeam('a-2', 'Group A Two'),
    makeTeam('a-3', 'Group A Three'),
    makeTeam('a-4', 'Group A Four'),
    makeTeam('b-1', 'Group B One'),
    makeTeam('b-2', 'Group B Two'),
    makeTeam('b-3', 'Group B Three'),
    makeTeam('b-4', 'Group B Four'),
  ]
  const groups = [
    { id: 'group-a-id', name: 'Group A', teamIds: ['a-1', 'a-2', 'a-3', 'a-4'] },
    { id: 'group-b-id', name: 'Group B', teamIds: ['b-1', 'b-2', 'b-3', 'b-4'] },
  ]
  const groupById = new Map(groups.map(group => [group.id, group]))
  const matches = generateMatches(groups).map((match, index, allMatches) => {
    const group = groupById.get(match.groupId)
    const homePosition = group.teamIds.indexOf(match.homeId)
    const awayPosition = group.teamIds.indexOf(match.awayId)
    const scored = {
      ...match,
      homeScore: homePosition < awayPosition ? 2 : 0,
      awayScore: homePosition < awayPosition ? 0 : 2,
      playedAt: COMPLETED_AT,
    }

    if (!completeGroups && index === allMatches.length - 1) {
      return { ...scored, homeScore: null, awayScore: null, playedAt: undefined }
    }
    return scored
  })

  return {
    teams,
    groups,
    matches,
    state: {
      ...initialState(),
      status: 'groups',
      stage: 'Group Stage',
      teams,
      groups,
      matches,
      qualifiedTeamIds: [],
      knockoutStageMatches: [],
      knockoutMatches: [],
    },
  }
}

const pairKey = match => [match.homeId, match.awayId].sort().join('|')

function scoreRoundRobin(matches, rankOrder = KNOCKOUT_RANK_ORDER) {
  const rank = new Map(rankOrder.map((id, index) => [id, index]))
  return matches.map(match => {
    const homeWins = rank.get(match.homeId) < rank.get(match.awayId)
    return {
      ...match,
      homeScore: homeWins ? 2 : 0,
      awayScore: homeWins ? 0 : 2,
      playedAt: COMPLETED_AT,
    }
  })
}

function withPlayoffResult(state, stage, result) {
  const target = getPlayoffMatch(state.knockoutMatches, stage)
  assert.ok(target, `${stage} must exist before it can be scored`)

  const scored = {
    ...target,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    homePenaltyScore: result.homePenaltyScore ?? null,
    awayPenaltyScore: result.awayPenaltyScore ?? null,
    winnerId: null,
    playedAt: undefined,
  }
  const winnerId = resolveKnockoutWinner(scored)
  const completed = {
    ...scored,
    winnerId,
    playedAt: winnerId ? COMPLETED_AT : undefined,
  }

  return {
    ...state,
    knockoutMatches: state.knockoutMatches.map(match => match.id === target.id ? completed : match),
  }
}

function startSixTeamFlow() {
  const scenario = makeScenario()
  return {
    ...scenario,
    state: reconcileTournamentProgression(scenario.state, COMPLETED_AT),
  }
}

function createLegacyCompletedState() {
  const { teams, groups, matches } = makeScenario()
  const openingRound = createKnockoutBracket(groups, teams, matches).map(match => ({
    ...match,
    homeScore: match.awayId ? 2 : null,
    awayScore: match.awayId ? 0 : null,
    winnerId: match.homeId,
    playedAt: match.awayId ? COMPLETED_AT : undefined,
  }))
  const [createdFinal] = createNextKnockoutRound(openingRound)
  const final = {
    ...createdFinal,
    homeScore: 3,
    awayScore: 1,
    winnerId: createdFinal.homeId,
    playedAt: COMPLETED_AT,
  }
  const winner = teams.find(team => team.id === final.winnerId)
  const fresh = initialState()
  const legacy = {
    ...fresh,
    version: 4,
    status: 'completed',
    stage: 'Completed',
    teams,
    groups,
    matches,
    knockoutMatches: [...openingRound, final],
    winnerId: winner.id,
    history: [
      ...fresh.history,
      {
        id: 'legacy-current-champion',
        tournamentNumber: fresh.tournamentNumber,
        winnerId: winner.id,
        winnerName: winner.name,
        completedAt: COMPLETED_AT,
      },
    ],
  }
  delete legacy.qualifiedTeamIds
  delete legacy.knockoutStageMatches
  return legacy
}

test('qualification requires exactly Group A and Group B to finish and takes each dynamic top three', () => {
  const { teams, groups, matches } = makeScenario()
  const qualifiers = getSixQualifiers(groups, teams, matches)

  assert.deepEqual(
    qualifiers.map(({ teamId, groupName, groupPosition }) => ({ teamId, groupName, groupPosition })),
    [
      { teamId: 'a-1', groupName: 'Group A', groupPosition: 1 },
      { teamId: 'a-2', groupName: 'Group A', groupPosition: 2 },
      { teamId: 'a-3', groupName: 'Group A', groupPosition: 3 },
      { teamId: 'b-1', groupName: 'Group B', groupPosition: 1 },
      { teamId: 'b-2', groupName: 'Group B', groupPosition: 2 },
      { teamId: 'b-3', groupName: 'Group B', groupPosition: 3 },
    ],
  )
  assert.equal(new Set(qualifiers.map(entry => entry.teamId)).size, 6)
  assert.ok(qualifiers.every(entry => entry.groupId === `group-${entry.groupName.at(-1).toLowerCase()}-id`))

  const incomplete = makeScenario({ completeGroups: false })
  assert.deepEqual(getSixQualifiers(incomplete.groups, incomplete.teams, incomplete.matches), [])

  const renamed = groups.map((group, index) => index === 1 ? { ...group, name: 'Group C' } : group)
  assert.deepEqual(getSixQualifiers(renamed, teams, matches), [])

  const thirdGroup = { id: 'group-c-id', name: 'Group C', teamIds: ['a-4', 'b-4'] }
  assert.deepEqual(getSixQualifiers([...groups, thirdGroup], teams, matches), [])
})

test('six qualifiers generate exactly 15 deterministic unordered fixtures with degree five and no self-match', () => {
  const { teams, groups, matches } = makeScenario()
  const qualifiedTeamIds = getSixQualifiers(groups, teams, matches).map(entry => entry.teamId)
  const fixtures = createKnockoutStageMatches(qualifiedTeamIds)
  const pairKeys = fixtures.map(pairKey)
  const appearances = new Map(qualifiedTeamIds.map(id => [id, 0]))

  fixtures.forEach(match => {
    assert.notEqual(match.homeId, match.awayId)
    appearances.set(match.homeId, appearances.get(match.homeId) + 1)
    appearances.set(match.awayId, appearances.get(match.awayId) + 1)
  })

  assert.equal(fixtures.length, 15)
  assert.equal(new Set(fixtures.map(match => match.id)).size, 15)
  assert.equal(new Set(pairKeys).size, 15)
  assert.deepEqual([...appearances.values()], [5, 5, 5, 5, 5, 5])
  assert.deepEqual(createKnockoutStageMatches(qualifiedTeamIds), fixtures)
  assert.equal(hasValidKnockoutStageFixtures(qualifiedTeamIds, fixtures), true)
  assert.deepEqual(createKnockoutStageMatches(qualifiedTeamIds.slice(0, 5)), [])
  assert.deepEqual(createKnockoutStageMatches([...qualifiedTeamIds.slice(0, 5), qualifiedTeamIds[0]]), [])
  assert.deepEqual(createKnockoutStageMatches([...qualifiedTeamIds, 'outsider']), [])
})

test('round-robin fixture validation rejects missing, duplicate, reverse, self, outsider, and duplicate-id records', () => {
  const { state } = startSixTeamFlow()
  const { qualifiedTeamIds, knockoutStageMatches: fixtures } = state
  const first = fixtures[0]
  const last = fixtures.at(-1)
  const cases = {
    missing: fixtures.slice(0, -1),
    duplicate: [...fixtures.slice(0, -1), { ...first }],
    reverse: [
      ...fixtures.slice(0, -1),
      { ...last, id: 'reverse-duplicate', homeId: first.awayId, awayId: first.homeId },
    ],
    self: [...fixtures.slice(0, -1), { ...last, homeId: last.homeId, awayId: last.homeId }],
    outsider: [...fixtures.slice(0, -1), { ...last, awayId: 'not-qualified' }],
    'duplicate id': [...fixtures.slice(0, -1), { ...last, id: first.id }],
  }

  for (const [name, malformed] of Object.entries(cases)) {
    assert.equal(
      hasValidKnockoutStageFixtures(qualifiedTeamIds, malformed),
      false,
      `${name} fixtures must be rejected`,
    )
    assert.equal(
      areKnockoutStageFixturesComplete(qualifiedTeamIds, scoreRoundRobin(malformed)),
      false,
      `${name} fixtures must never finalize the table`,
    )
  }
})

test('round-robin draws count as complete and knockout standings use only the 15 knockout-stage results', () => {
  const { teams, state } = startSixTeamFlow()
  const drawnMatches = state.knockoutStageMatches.map(match => ({
    ...match,
    homeScore: 1,
    awayScore: 1,
    playedAt: COMPLETED_AT,
  }))

  assert.equal(areKnockoutStageFixturesComplete(state.qualifiedTeamIds, drawnMatches), true)
  assert.deepEqual(
    knockoutStandings(teams, drawnMatches, state.qualifiedTeamIds).map(row => ({
      id: row.id,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      points: row.points,
    })),
    state.qualifiedTeamIds.map(id => ({ id, played: 5, wins: 0, draws: 5, losses: 0, points: 5 })),
  )

  const decisiveMatches = scoreRoundRobin(state.knockoutStageMatches)
  const table = knockoutStandings(teams, decisiveMatches, state.qualifiedTeamIds)
  assert.deepEqual(table.map(row => row.id), KNOCKOUT_RANK_ORDER)
  assert.deepEqual(table.map(row => row.position), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(table.map(row => row.played), [5, 5, 5, 5, 5, 5])
  assert.deepEqual(table.map(row => row.wins), [5, 4, 3, 2, 1, 0])
  assert.deepEqual(table.map(row => row.points), [15, 12, 9, 6, 3, 0])

  // Both group winners deliberately finish fifth and sixth here. This proves
  // that their group points/positions are not carried into the new table.
  assert.deepEqual(table.slice(-2).map(row => row.id), ['b-1', 'a-1'])
})

test('progression is strictly gated and creates each semantic playoff only when its inputs are known', () => {
  const incomplete = makeScenario({ completeGroups: false }).state
  assert.strictEqual(reconcileTournamentProgression(incomplete, COMPLETED_AT), incomplete)
  assert.deepEqual(incomplete.qualifiedTeamIds, [])
  assert.deepEqual(incomplete.knockoutStageMatches, [])

  let { state } = startSixTeamFlow()
  assert.equal(state.qualifiedTeamIds.length, 6)
  assert.equal(state.knockoutStageMatches.length, 15)
  assert.deepEqual(state.knockoutMatches, [])
  assert.strictEqual(reconcileTournamentProgression(state, COMPLETED_AT), state)

  const partialRoundRobin = {
    ...state,
    knockoutStageMatches: scoreRoundRobin(state.knockoutStageMatches).map((match, index) =>
      index === 0 ? { ...match, awayScore: null, playedAt: undefined } : match),
  }
  assert.strictEqual(reconcileTournamentProgression(partialRoundRobin, COMPLETED_AT), partialRoundRobin)
  assert.deepEqual(partialRoundRobin.knockoutMatches, [])

  state = reconcileTournamentProgression({
    ...state,
    knockoutStageMatches: scoreRoundRobin(state.knockoutStageMatches),
  }, COMPLETED_AT)
  const semifinal1 = getPlayoffMatch(state.knockoutMatches, 'semifinal-1')
  const spotSemifinal = getPlayoffMatch(state.knockoutMatches, 'spot-semifinal')
  assert.ok(semifinal1)
  assert.ok(spotSemifinal)
  assert.deepEqual([semifinal1.homeId, semifinal1.awayId], KNOCKOUT_RANK_ORDER.slice(0, 2))
  assert.deepEqual([spotSemifinal.homeId, spotSemifinal.awayId], KNOCKOUT_RANK_ORDER.slice(2, 4))
  assert.equal(getPlayoffMatch(state.knockoutMatches, 'semifinal-2'), null)
  assert.equal(getPlayoffMatch(state.knockoutMatches, 'grand-final'), null)
  assert.ok(state.knockoutMatches.every(match =>
    !KNOCKOUT_RANK_ORDER.slice(4).includes(match.homeId)
    && !KNOCKOUT_RANK_ORDER.slice(4).includes(match.awayId)))

  state = withPlayoffResult(state, 'semifinal-1', { homeScore: 1, awayScore: 2 })
  assert.strictEqual(reconcileTournamentProgression(state, COMPLETED_AT), state)
  assert.equal(getPlayoffMatch(state.knockoutMatches, 'semifinal-2'), null)

  state = withPlayoffResult(state, 'spot-semifinal', { homeScore: 1, awayScore: 1 })
  assert.strictEqual(reconcileTournamentProgression(state, COMPLETED_AT), state)
  assert.equal(getPlayoffMatch(state.knockoutMatches, 'semifinal-2'), null)

  state = withPlayoffResult(state, 'spot-semifinal', {
    homeScore: 1,
    awayScore: 1,
    homePenaltyScore: 4,
    awayPenaltyScore: 4,
  })
  assert.strictEqual(reconcileTournamentProgression(state, COMPLETED_AT), state)
  assert.equal(getPlayoffMatch(state.knockoutMatches, 'semifinal-2'), null)

  state = withPlayoffResult(state, 'spot-semifinal', {
    homeScore: 1,
    awayScore: 1,
    homePenaltyScore: 3,
    awayPenaltyScore: 4,
  })
  state = reconcileTournamentProgression(state, COMPLETED_AT)
  const semifinal2 = getPlayoffMatch(state.knockoutMatches, 'semifinal-2')
  assert.ok(semifinal2)
  assert.deepEqual([semifinal2.homeId, semifinal2.awayId], [KNOCKOUT_RANK_ORDER[0], KNOCKOUT_RANK_ORDER[3]])
  assert.equal(getPlayoffMatch(state.knockoutMatches, 'grand-final'), null)
  assert.strictEqual(reconcileTournamentProgression(state, COMPLETED_AT), state)
})

test('unplayed legacy semifinal bracket is repaired into the six-team knockout stage', () => {
  const { teams, groups, matches } = makeScenario()
  const legacySemifinals = createKnockoutBracket(groups, teams, matches)
  assert.equal(legacySemifinals.length, 2)
  assert.ok(legacySemifinals.every(match => !match.stage))

  const legacyState = {
    ...initialState(),
    version: 4,
    status: 'knockout',
    stage: 'Semi-finals',
    teams,
    groups,
    matches,
    qualifiedTeamIds: [],
    knockoutStageMatches: [],
    knockoutMatches: legacySemifinals,
    winnerId: null,
  }

  const repaired = reconcileTournamentProgression(legacyState, COMPLETED_AT)
  assert.notStrictEqual(repaired, legacyState)
  assert.equal(repaired.version, 5)
  assert.equal(repaired.status, 'knockout')
  assert.equal(repaired.stage, 'Knockout Stage')
  assert.equal(repaired.qualifiedTeamIds.length, 6)
  assert.deepEqual(repaired.qualifiedTeamIds, getSixQualifiers(groups, teams, matches).map(entry => entry.teamId))
  assert.equal(repaired.knockoutStageMatches.length, 15)
  assert.equal(new Set(repaired.knockoutStageMatches.map(pairKey)).size, 15)
  assert.ok(hasValidKnockoutStageFixtures(repaired.qualifiedTeamIds, repaired.knockoutStageMatches))
  assert.deepEqual(repaired.knockoutMatches, [])

  const scoredLegacyState = {
    ...legacyState,
    knockoutMatches: legacySemifinals.map((match, index) => index === 0
      ? { ...match, homeScore: 1, awayScore: 0, winnerId: match.homeId, playedAt: COMPLETED_AT }
      : match),
  }
  assert.strictEqual(reconcileTournamentProgression(scoredLegacyState, COMPLETED_AT), scoredLegacyState)
})

test('the exact full flow yields one verified champion and remains idempotent after every prerequisite', () => {
  let { state } = startSixTeamFlow()
  state = reconcileTournamentProgression({
    ...state,
    knockoutStageMatches: scoreRoundRobin(state.knockoutStageMatches),
  }, COMPLETED_AT)

  state = withPlayoffResult(state, 'semifinal-1', { homeScore: 1, awayScore: 2 })
  state = withPlayoffResult(state, 'spot-semifinal', {
    homeScore: 0,
    awayScore: 0,
    homePenaltyScore: 3,
    awayPenaltyScore: 4,
  })
  state = reconcileTournamentProgression(state, COMPLETED_AT)

  const semifinal2 = getPlayoffMatch(state.knockoutMatches, 'semifinal-2')
  assert.deepEqual([semifinal2.homeId, semifinal2.awayId], [KNOCKOUT_RANK_ORDER[0], KNOCKOUT_RANK_ORDER[3]])

  state = withPlayoffResult(state, 'semifinal-2', { homeScore: 2, awayScore: 3 })
  state = reconcileTournamentProgression(state, COMPLETED_AT)
  const final = getPlayoffMatch(state.knockoutMatches, 'grand-final')
  assert.ok(final)
  assert.deepEqual([final.homeId, final.awayId], [KNOCKOUT_RANK_ORDER[1], KNOCKOUT_RANK_ORDER[3]])
  assert.equal(state.winnerId, null)
  assert.equal(isValidCompletedSixTeamChampionship(state), false)
  assert.equal(canStartNextTournament(state), false)

  const unresolvedFinal = withPlayoffResult(state, 'grand-final', { homeScore: 0, awayScore: 0 })
  assert.strictEqual(reconcileTournamentProgression(unresolvedFinal, COMPLETED_AT), unresolvedFinal)
  assert.equal(unresolvedFinal.winnerId, null)

  const tiedPenalties = withPlayoffResult(state, 'grand-final', {
    homeScore: 0,
    awayScore: 0,
    homePenaltyScore: 5,
    awayPenaltyScore: 5,
  })
  assert.strictEqual(reconcileTournamentProgression(tiedPenalties, COMPLETED_AT), tiedPenalties)
  assert.equal(tiedPenalties.winnerId, null)

  const duplicateCurrentHistory = [
    ...state.history,
    {
      id: 'stale-champion-one',
      tournamentNumber: state.tournamentNumber,
      winnerId: 'a-1',
      winnerName: 'Wrong champion one',
      completedAt: '2026-08-11T00:00:00.000Z',
    },
    {
      id: 'stale-champion-two',
      tournamentNumber: state.tournamentNumber,
      winnerId: 'b-1',
      winnerName: 'Wrong champion two',
      completedAt: '2026-08-11T01:00:00.000Z',
    },
  ]
  state = withPlayoffResult({ ...state, history: duplicateCurrentHistory }, 'grand-final', {
    homeScore: 0,
    awayScore: 0,
    homePenaltyScore: 5,
    awayPenaltyScore: 4,
  })
  state = reconcileTournamentProgression(state, COMPLETED_AT)

  assert.equal(state.status, 'completed')
  assert.equal(state.winnerId, KNOCKOUT_RANK_ORDER[1])
  assert.equal(isValidCompletedSixTeamChampionship(state), true)
  assert.equal(canStartNextTournament(state), true)
  const currentHistory = state.history.filter(item => item.tournamentNumber === state.tournamentNumber)
  assert.equal(currentHistory.length, 1)
  assert.equal(currentHistory[0].winnerId, state.winnerId)

  const playoffCounts = stage => state.knockoutMatches.filter(match => match.stage === stage).length
  assert.equal(playoffCounts('semifinal-1'), 1)
  assert.equal(playoffCounts('spot-semifinal'), 1)
  assert.equal(playoffCounts('semifinal-2'), 1)
  assert.equal(playoffCounts('grand-final'), 1)
  assert.strictEqual(reconcileTournamentProgression(state, COMPLETED_AT), state)
  assert.equal(state.history.filter(item => item.tournamentNumber === state.tournamentNumber).length, 1)
})

test('JSON refresh/reconciliation cannot duplicate generated fixtures or playoff matches', () => {
  let { state } = startSixTeamFlow()
  state = reconcileTournamentProgression({
    ...state,
    knockoutStageMatches: scoreRoundRobin(state.knockoutStageMatches),
  }, COMPLETED_AT)

  const refreshed = normalizeState(JSON.parse(JSON.stringify(state)))
  const reconciled = reconcileTournamentProgression(refreshed, COMPLETED_AT)
  const reconciledAgain = reconcileTournamentProgression(reconciled, COMPLETED_AT)

  assert.strictEqual(reconciledAgain, reconciled)
  assert.equal(reconciled.knockoutStageMatches.length, 15)
  assert.equal(new Set(reconciled.knockoutStageMatches.map(pairKey)).size, 15)
  assert.equal(reconciled.knockoutMatches.filter(match => match.stage === 'semifinal-1').length, 1)
  assert.equal(reconciled.knockoutMatches.filter(match => match.stage === 'spot-semifinal').length, 1)
  assert.equal(reconciled.knockoutMatches.filter(match => match.stage === 'semifinal-2').length, 0)
  assert.equal(reconciled.knockoutMatches.filter(match => match.stage === 'grand-final').length, 0)
})

test('normalizing v4 preserves a valid completed legacy bracket instead of converting or reopening it', () => {
  const legacy = createLegacyCompletedState()
  const normalized = normalizeState(legacy)

  assert.equal(normalized.version, 4)
  assert.equal(normalized.status, 'completed')
  assert.equal(normalized.winnerId, legacy.winnerId)
  assert.deepEqual(normalized.teams, legacy.teams)
  assert.deepEqual(normalized.groups, legacy.groups)
  assert.deepEqual(normalized.matches, legacy.matches)
  assert.deepEqual(normalized.knockoutMatches, legacy.knockoutMatches)
  assert.deepEqual(normalized.qualifiedTeamIds, [])
  assert.deepEqual(normalized.knockoutStageMatches, [])
  assert.equal(canStartNextTournament(normalized), true)
  assert.strictEqual(reconcileTournamentProgression(normalized, COMPLETED_AT), normalized)
})
