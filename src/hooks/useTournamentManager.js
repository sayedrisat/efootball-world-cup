import { useEffect, useMemo, useState } from 'react'
import { GROUP_MATCHES } from '../constants/tournament'
import { readTournamentState, saveTournamentState } from '../storage/tournamentStorage'
import {
  calculateGroupStandings,
  createGroupResults,
  createTournamentState,
  getWinnerId,
  isResultComplete,
  normalizeScore,
} from '../utils/tournament'

export function useTournamentManager() {
  const [tournament, setTournament] = useState(readTournamentState)
  const [showOutput, setShowOutput] = useState(false)

  const { teams, groupResults, knockout } = tournament
  const rosterComplete = teams.every((team) => team.name.trim())
  const teamsById = useMemo(() => Object.fromEntries(teams.map((team) => [team.id, team])), [teams])
  const groupStandings = useMemo(() => calculateGroupStandings(teams, groupResults), [teams, groupResults])
  const groupComplete =
    rosterComplete && GROUP_MATCHES.every((match) => isResultComplete(groupResults[match.id]))

  const groupAStandings = groupStandings.find((group) => group.id === 'A')?.standings || []
  const groupBStandings = groupStandings.find((group) => group.id === 'B')?.standings || []
  const groupAFirst = groupComplete ? groupAStandings[0] : null
  const groupASecond = groupComplete ? groupAStandings[1] : null
  const groupBFirst = groupComplete ? groupBStandings[0] : null
  const groupBSecond = groupComplete ? groupBStandings[1] : null
  const semiATeams = groupComplete ? [groupAFirst, groupBSecond].filter(Boolean) : []
  const semiBTeams = groupComplete ? [groupBFirst, groupASecond].filter(Boolean) : []
  const semiAWinnerId = getWinnerId(knockout.semiA, semiATeams)
  const semiBWinnerId = getWinnerId(knockout.semiB, semiBTeams)
  const semiAWinner = teamsById[semiAWinnerId] || null
  const semiBWinner = teamsById[semiBWinnerId] || null
  const finalTeams = groupComplete && semiAWinner && semiBWinner ? [semiAWinner, semiBWinner] : []
  const championId = getWinnerId(knockout.final, finalTeams)
  const champion = teamsById[championId] || null

  useEffect(() => {
    saveTournamentState(tournament)
  }, [tournament])

  const updateTeam = (teamId, field, value) => {
    setTournament((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.id === teamId ? { ...team, [field]: value } : team)),
    }))
  }

  const uploadIcon = (teamId, event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => updateTeam(teamId, 'icon', String(reader.result || ''))
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const clearIcon = (teamId) => updateTeam(teamId, 'icon', '')

  const updateGroupResult = (matchId, field, value) => {
    setTournament((current) => ({
      ...current,
      groupResults: {
        ...current.groupResults,
        [matchId]: {
          ...current.groupResults[matchId],
          [field]: normalizeScore(value),
        },
      },
    }))
  }

  const updateKnockout = (stage, field, value) => {
    setTournament((current) => ({
      ...current,
      knockout: {
        ...current.knockout,
        [stage]: {
          ...current.knockout[stage],
          [field]: field === 'winnerId' ? value : normalizeScore(value),
        },
      },
    }))
  }

  const resetScores = () => {
    setTournament((current) => ({
      ...current,
      groupResults: createGroupResults(),
      knockout: createTournamentState().knockout,
    }))
  }

  const startNextTournament = () => {
    if (!champion) return

    setTournament((current) => ({
      ...current,
      teams: current.teams.map((team) =>
        team.id === champion.id ? { ...team, stars: Number(team.stars || 0) + 1 } : team,
      ),
      groupResults: createGroupResults(),
      knockout: createTournamentState().knockout,
    }))
    setShowOutput(false)
  }

  const resetAll = () => {
    if (!window.confirm('Reset teams and tournament data?')) return
    setTournament(createTournamentState())
    setShowOutput(false)
  }

  return {
    champion,
    clearIcon,
    finalResult: knockout.final,
    groupComplete,
    groupResults,
    groupStandings,
    groupAFirst,
    groupASecond,
    groupBFirst,
    groupBSecond,
    resetAll,
    resetScores,
    rosterComplete,
    semiAResult: knockout.semiA,
    semiAWinner,
    semiBResult: knockout.semiB,
    semiBWinner,
    setShowOutput,
    showOutput,
    startNextTournament,
    teams,
    teamsById,
    updateGroupResult,
    updateKnockout,
    updateTeam,
    uploadIcon,
  }
}
