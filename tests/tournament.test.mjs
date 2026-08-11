import assert from 'node:assert/strict'
import test from 'node:test'

import {
  allGroupMatchesComplete,
  areGroupFixturesComplete,
  canStartNextTournament,
  createKnockoutBracket,
  createNextKnockoutRound,
  generateGroups,
  generateMatches,
  getConfirmableChampionId,
  getStateMigrationKind,
  getActiveKnockoutMatches,
  getActiveKnockoutRound,
  hasAnyMatchSchedule,
  hasAnyMatchScore,
  initialState,
  isKnockoutMatchComplete,
  isValidCompletedKnockoutBracket,
  normalizeState,
  normalizeScheduledAt,
  resolveKnockoutWinner,
  setMatchSchedule,
  starCounts,
  standings,
} from '../src/utils/tournament.ts'

const makeTeams = count => Array.from({ length: count }, (_, index) => ({
  id: `team-${index + 1}`,
  name: `Team ${index + 1}`,
  imageUrl: '',
  createdAt: '',
}))

const membershipSignature = groups => groups
  .map(group => [...group.teamIds].sort().join(','))
  .join('|')

test('v3 state is migrated without losing tournament data', () => {
  const teams = makeTeams(4)
  const migrated = normalizeState({
    ...initialState(),
    version: 3,
    teams,
    knockoutMatches: undefined,
  })

  assert.equal(migrated.version, 4)
  assert.deepEqual(migrated.teams, teams)
  assert.deepEqual(migrated.knockoutMatches, [])
})

test('a prematurely completed v3 tournament reopens instead of exposing Next Tournament', () => {
  const teams = makeTeams(4)
  const groups = [{ id: 'g-a', name: 'Group A', teamIds: teams.map(team => team.id) }]
  const matches = generateMatches(groups)
  const currentHistory = {
    id: 'premature',
    tournamentNumber: 6,
    winnerId: teams[0].id,
    winnerName: teams[0].name,
    completedAt: '2026-08-10T00:00:00.000Z',
  }
  const migrated = normalizeState({
    ...initialState(),
    version: 3,
    status: 'completed',
    stage: 'Completed',
    teams,
    groups,
    matches,
    winnerId: teams[0].id,
    history: [...initialState().history, currentHistory],
    knockoutMatches: undefined,
  })

  assert.equal(migrated.status, 'groups')
  assert.equal(migrated.stage, 'Group Stage')
  assert.equal(migrated.winnerId, null)
  assert.equal(migrated.history.some(item => item.id === currentHistory.id), false)
  assert.equal(canStartNextTournament(migrated), false)
})

test('the exact skipped #6 archive rolls #7 back without removing legitimate #5 Honduras', () => {
  const badWinnerId = '62c035a1-0775-4df8-9e75-900d16e89f49'
  const teams = makeTeams(8).map((team, index) => index === 0
    ? { ...team, id: badWinnerId, name: 'Honduras' }
    : team)
  const badHistory = {
    id: 'e02d6055-8f6d-410f-93f2-48b7ab91f83f',
    tournamentNumber: 6,
    winnerId: badWinnerId,
    winnerName: 'Honduras',
    completedAt: '2026-08-10T18:09:02.841Z',
  }
  const raw = {
    ...initialState(),
    version: 3,
    tournamentNumber: 7,
    status: 'registration',
    stage: 'Team Registration',
    teams,
    groups: [],
    matches: [],
    knockoutMatches: undefined,
    winnerId: null,
    history: [...initialState().history, badHistory],
    updatedAt: '2026-08-10T18:10:06.842Z',
  }
  const repaired = normalizeState(raw)

  assert.equal(getStateMigrationKind(raw), 'rollback-skipped-tournament-6')
  assert.equal(repaired.version, 4)
  assert.equal(repaired.tournamentNumber, 6)
  assert.equal(repaired.status, 'registration')
  assert.equal(repaired.stage, 'Team Registration')
  assert.deepEqual(repaired.teams, teams)
  assert.equal(repaired.history.some(item => item.id === badHistory.id), false)
  assert.equal(repaired.history.some(item => item.id === 'history-5'), true)
  assert.equal(starCounts(repaired.history).honduras, 1)
  assert.equal(canStartNextTournament(repaired), false)
  assert.deepEqual(normalizeState(repaired), repaired)
  assert.equal(getStateMigrationKind(repaired), null)

  const repairedFromPrematureV4 = normalizeState({ ...raw, version: 4 })
  assert.equal(repairedFromPrematureV4.tournamentNumber, 6)
  assert.equal(repairedFromPrematureV4.history.some(item => item.id === badHistory.id), false)

  const accidentalGroups = generateGroups(teams)
  const repairedAfterAccidentalDraw = normalizeState({
    ...raw,
    status: 'groups',
    stage: 'Group Stage',
    groups: accidentalGroups,
    matches: generateMatches(accidentalGroups),
  })
  assert.equal(getStateMigrationKind({
    ...raw,
    status: 'groups',
    stage: 'Group Stage',
    groups: accidentalGroups,
    matches: generateMatches(accidentalGroups),
  }), 'rollback-skipped-tournament-6')
  assert.equal(repairedAfterAccidentalDraw.tournamentNumber, 6)
  assert.deepEqual(repairedAfterAccidentalDraw.groups, [])
  assert.deepEqual(repairedAfterAccidentalDraw.matches, [])
  assert.deepEqual(repairedAfterAccidentalDraw.teams, teams)
  assert.equal(starCounts(repairedAfterAccidentalDraw.history).honduras, 1)
})

test('group draw is balanced, contains every team once, and does not mutate input', () => {
  const teams = makeTeams(11)
  const original = structuredClone(teams)
  const groups = generateGroups(teams)
  const sizes = groups.map(group => group.teamIds.length)

  assert.deepEqual(teams, original)
  assert.equal(groups.length, 3)
  assert.ok(Math.max(...sizes) <= 4)
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1)
  assert.deepEqual(groups.flatMap(group => group.teamIds).sort(), teams.map(team => team.id).sort())
})

test('regenerating returns different membership when more than one group exists', () => {
  const teams = makeTeams(8)
  const first = generateGroups(teams)
  const regenerated = generateGroups(teams, first)

  assert.notEqual(membershipSignature(regenerated), membershipSignature(first))
})

test('regenerating a single group changes its visible draw order', () => {
  const teams = makeTeams(4)
  const first = generateGroups(teams)
  const regenerated = generateGroups(teams, first)

  assert.notDeepEqual(regenerated[0].teamIds, first[0].teamIds)
})

test('partial scores block redraw and only fully entered fixtures complete the groups', () => {
  const [match] = generateMatches([{ id: 'g-a', name: 'Group A', teamIds: ['a', 'b'] }])

  assert.equal(hasAnyMatchScore([{ ...match, awayScore: 2 }]), true)
  assert.equal(hasAnyMatchScore([match]), false)
  assert.equal(allGroupMatchesComplete([]), false)
  assert.equal(allGroupMatchesComplete([{ ...match, homeScore: 1 }]), false)
  assert.equal(allGroupMatchesComplete([{ ...match, homeScore: 1, awayScore: 2 }]), true)
})

test('match schedules are stable, validated, and preserved by state normalization', () => {
  const groups = [{ id: 'g-a', name: 'Group A', teamIds: ['a', 'b'] }]
  const [match] = generateMatches(groups)

  assert.equal(match.scheduledAt, null)
  assert.equal(normalizeScheduledAt('2026-08-12T20:30'), '2026-08-12T20:30')
  assert.equal(normalizeScheduledAt('2026-02-30T20:30'), null)
  assert.equal(normalizeScheduledAt('2026-08-12T24:00'), null)
  assert.equal(normalizeScheduledAt('2026-08-12T20:30:00'), null)

  const originalMatches = [match]
  const scheduled = setMatchSchedule(originalMatches, match.id, '2026-08-12T20:30')
  assert.ok(scheduled)
  assert.notEqual(scheduled, originalMatches)
  assert.equal(match.scheduledAt, null)
  assert.equal(scheduled[0].scheduledAt, '2026-08-12T20:30')
  assert.equal(hasAnyMatchSchedule(scheduled), true)
  assert.equal(hasAnyMatchSchedule([match]), false)
  assert.equal(setMatchSchedule(scheduled, 'missing', '2026-08-12T21:00'), null)
  assert.equal(setMatchSchedule(scheduled, match.id, 'invalid'), null)

  const cleared = setMatchSchedule(scheduled, match.id, null)
  assert.ok(cleared)
  assert.equal(cleared[0].scheduledAt, null)

  const legacyMatch = { ...match }
  delete legacyMatch.scheduledAt
  const normalizedLegacy = normalizeState({
    ...initialState(),
    status: 'groups',
    stage: 'Group Stage',
    groups,
    matches: [legacyMatch],
  })
  assert.equal(normalizedLegacy.matches[0].scheduledAt, null)

  const normalizedScheduled = normalizeState({
    ...normalizedLegacy,
    matches: [{ ...match, scheduledAt: '2026-08-12T20:30' }],
  })
  assert.equal(normalizedScheduled.matches[0].scheduledAt, '2026-08-12T20:30')
  assert.deepEqual(normalizeState(normalizedScheduled), normalizedScheduled)

  const normalizedInvalid = normalizeState({
    ...normalizedLegacy,
    matches: [{ ...match, scheduledAt: 'not-a-date' }],
  })
  assert.equal(normalizedInvalid.matches[0].scheduledAt, null)
})

test('knockout readiness requires the exact generated group fixtures', () => {
  const teams = makeTeams(4)
  const groups = [{ id: 'g-a', name: 'Group A', teamIds: teams.map(team => team.id) }]
  const complete = generateMatches(groups).map(match => ({ ...match, homeScore: 1, awayScore: 0 }))

  assert.equal(areGroupFixturesComplete(groups, complete), true)
  assert.equal(areGroupFixturesComplete(groups, complete.slice(1)), false)
  assert.equal(areGroupFixturesComplete(groups, [...complete.slice(1), complete[1]]), false)
  assert.equal(areGroupFixturesComplete(groups, complete.map((match, index) =>
    index === 0 ? { ...match, homeScore: -1 } : match)), false)
})

test('standings use supplied draw order as the final tie-break', () => {
  const teams = [
    { id: 'a', name: 'Alpha', imageUrl: '', createdAt: '' },
    { id: 'b', name: 'Bravo', imageUrl: '', createdAt: '' },
    { id: 'c', name: 'Charlie', imageUrl: '', createdAt: '' },
  ]

  assert.deepEqual(standings(teams, [], ['c', 'b', 'a']).map(team => team.id), ['c', 'b', 'a'])
})

test('knockout bracket advances only resolved rounds and tied games require penalties', () => {
  const teams = makeTeams(8)
  const groups = [
    { id: 'g-a', name: 'Group A', teamIds: teams.slice(0, 4).map(team => team.id) },
    { id: 'g-b', name: 'Group B', teamIds: teams.slice(4).map(team => team.id) },
  ]
  const groupMatches = generateMatches(groups).map(match => ({ ...match, homeScore: 1, awayScore: 0 }))
  const semifinals = createKnockoutBracket(groups, teams, groupMatches)

  assert.equal(getActiveKnockoutRound(semifinals), 4)
  assert.equal(getActiveKnockoutMatches(semifinals).length, 2)
  assert.deepEqual(createNextKnockoutRound(semifinals), [])

  const oneCompletedSemifinal = semifinals.map((match, index) => index === 0
    ? { ...match, homeScore: 2, awayScore: 1, winnerId: match.homeId }
    : match)
  assert.deepEqual(createNextKnockoutRound(oneCompletedSemifinal), [])

  const completedSemifinals = semifinals.map(match => ({
    ...match,
    homeScore: 2,
    awayScore: 1,
    winnerId: match.homeId,
  }))
  const [final] = createNextKnockoutRound(completedSemifinals)
  assert.equal(final.round, 2)
  assert.equal(createNextKnockoutRound(completedSemifinals).length, 1)
  assert.deepEqual(
    [final.homeId, final.awayId],
    completedSemifinals.sort((a, b) => a.order - b.order).map(match => resolveKnockoutWinner(match)),
  )

  const tiedFinal = { ...final, homeScore: 1, awayScore: 1 }
  assert.equal(resolveKnockoutWinner(tiedFinal), null)
  assert.equal(isKnockoutMatchComplete(tiedFinal), false)

  const completedFinal = {
    ...tiedFinal,
    homePenaltyScore: 5,
    awayPenaltyScore: 4,
    winnerId: tiedFinal.homeId,
  }
  assert.equal(resolveKnockoutWinner(completedFinal), completedFinal.homeId)
  assert.equal(isKnockoutMatchComplete(completedFinal), true)

  const confirmableState = {
    ...initialState(),
    status: 'knockout',
    teams,
    groups,
    matches: groupMatches,
    knockoutMatches: [...completedSemifinals, completedFinal],
  }
  assert.equal(getConfirmableChampionId(confirmableState), completedFinal.homeId)
  assert.equal(getConfirmableChampionId({ ...confirmableState, knockoutMatches: [completedFinal] }), null)

  const completedState = {
    ...initialState(),
    status: 'completed',
    teams,
    groups,
    matches: groupMatches,
    knockoutMatches: [...completedSemifinals, completedFinal],
    winnerId: completedFinal.homeId,
    history: [
      ...initialState().history,
      {
        id: 'current-champion',
        tournamentNumber: initialState().tournamentNumber,
        winnerId: completedFinal.homeId,
        winnerName: teams.find(team => team.id === completedFinal.homeId).name,
        completedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
  }
  assert.equal(canStartNextTournament({ ...completedState, status: 'registration', knockoutMatches: [] }), false)
  assert.equal(canStartNextTournament({ ...completedState, status: 'groups', knockoutMatches: [] }), false)
  assert.equal(canStartNextTournament({ ...completedState, status: 'knockout', knockoutMatches: completedSemifinals }), false)
  assert.equal(canStartNextTournament({ ...completedState, status: 'knockout' }), false)
  assert.equal(canStartNextTournament(completedState), true)
  assert.equal(canStartNextTournament({ ...completedState, winnerId: completedFinal.awayId }), false)
  assert.equal(canStartNextTournament({ ...completedState, status: 'knockout' }), false)
  assert.equal(canStartNextTournament({ ...completedState, history: initialState().history }), false)
  assert.equal(isValidCompletedKnockoutBracket(groups, teams, groupMatches, [completedFinal]), false)
  assert.equal(canStartNextTournament({ ...completedState, knockoutMatches: [completedFinal] }), false)
})

test('byes go to group winners before runners-up', () => {
  for (const teamCount of [9, 18]) {
    const teams = makeTeams(teamCount)
    const groups = generateGroups(teams)
    const matches = generateMatches(groups).map(match => ({ ...match, homeScore: 1, awayScore: 0 }))
    const bracket = createKnockoutBracket(groups, teams, matches)
    const winners = new Set(groups.map(group => standings(
      teams,
      matches.filter(match => match.groupId === group.id),
      group.teamIds,
    )[0].id))
    const byeIds = bracket.filter(match => !match.awayId).map(match => match.homeId)
    const groupByTeam = new Map(groups.flatMap(group => group.teamIds.map(id => [id, group.id])))

    if (byeIds.length <= winners.size) {
      assert.ok(byeIds.every(id => winners.has(id)))
    } else {
      assert.ok([...winners].every(id => byeIds.includes(id)))
    }
    assert.ok(bracket
      .filter(match => match.homeId && match.awayId)
      .every(match => groupByTeam.get(match.homeId) !== groupByTeam.get(match.awayId)))
  }
})

test('every supported roster size can reach a strictly gated final', () => {
  for (let teamCount = 4; teamCount <= 20; teamCount++) {
    const teams = makeTeams(teamCount)
    const groups = generateGroups(teams)
    const matches = generateMatches(groups).map(match => ({ ...match, homeScore: 2, awayScore: 0 }))
    let knockoutMatches = createKnockoutBracket(groups, teams, matches)

    while (getActiveKnockoutRound(knockoutMatches) !== 2) {
      const activeRound = getActiveKnockoutRound(knockoutMatches)
      knockoutMatches = knockoutMatches.map(match => match.round === activeRound && match.homeId && match.awayId
        ? { ...match, homeScore: 1, awayScore: 0, winnerId: match.homeId }
        : match)
      const nextRound = createNextKnockoutRound(knockoutMatches)
      assert.ok(nextRound.length > 0, `team count ${teamCount} should advance`)
      knockoutMatches = [...knockoutMatches, ...nextRound]
    }

    knockoutMatches = knockoutMatches.map(match => match.round === 2
      ? { ...match, homeScore: 3, awayScore: 1, winnerId: match.homeId }
      : match)
    const final = knockoutMatches.find(match => match.round === 2)
    const completed = {
      ...initialState(),
      status: 'completed',
      teams,
      groups,
      matches,
      knockoutMatches,
      winnerId: final.homeId,
      history: [{
        id: `winner-${teamCount}`,
        tournamentNumber: initialState().tournamentNumber,
        winnerId: final.homeId,
        winnerName: teams.find(team => team.id === final.homeId).name,
        completedAt: '2026-08-11T00:00:00.000Z',
      }],
    }

    assert.equal(canStartNextTournament(completed), true, `team count ${teamCount} should unlock Next`)
  }
})

test('an invalid v4 completion reopens at its last recoverable stage', () => {
  const teams = makeTeams(4)
  const groups = [{ id: 'g-a', name: 'Group A', teamIds: teams.map(team => team.id) }]
  const matches = generateMatches(groups).map(match => ({ ...match, homeScore: 1, awayScore: 0 }))
  const knockoutMatches = createKnockoutBracket(groups, teams, matches)
  const recovered = normalizeState({
    ...initialState(),
    status: 'completed',
    teams,
    groups,
    matches,
    knockoutMatches,
    winnerId: teams[0].id,
    history: [{
      id: 'bad-completion',
      tournamentNumber: initialState().tournamentNumber,
      winnerId: teams[0].id,
      winnerName: teams[0].name,
      completedAt: '2026-08-11T00:00:00.000Z',
    }],
  })

  assert.equal(recovered.status, 'knockout')
  assert.equal(recovered.winnerId, null)
  assert.equal(recovered.history.length, 0)
})
