import LeagueChampionPanel from '../components/league/LeagueChampionPanel'
import LeagueMatchBoard from '../components/league/LeagueMatchBoard'
import LeagueStatStrip from '../components/league/LeagueStatStrip'
import LeagueTable from '../components/league/LeagueTable'
import LeagueTeamForm from '../components/league/LeagueTeamForm'
import LeagueTeamRoster from '../components/league/LeagueTeamRoster'
import { useLeagueTournament } from '../hooks/league/useLeagueTournament'

function LeagueTournamentPage() {
  const tournament = useLeagueTournament()

  return (
    <div className="league-page">
      <LeagueChampionPanel
        champion={tournament.champion}
        completedMatches={tournament.completedMatches}
        pendingMatches={tournament.pendingMatches}
        table={tournament.table}
        tournamentComplete={tournament.tournamentComplete}
      />

      <LeagueStatStrip
        completedMatches={tournament.completedMatches}
        pendingMatches={tournament.pendingMatches}
        teams={tournament.teams}
        totalMatches={tournament.fixtures.length}
      />

      <div className="league-layout">
        <aside className="league-side">
          <LeagueTeamForm onAddTeam={tournament.addTeam} />
          <LeagueTeamRoster onRemoveTeam={tournament.removeTeam} teams={tournament.teams} />
          <button className="league-reset-all-button" onClick={tournament.resetAll} type="button">
            Reset Full League
          </button>
        </aside>

        <div className="league-main-stack">
          <LeagueTable table={tournament.table} tournamentComplete={tournament.tournamentComplete} />
          <LeagueMatchBoard
            filteredFixtures={tournament.filteredFixtures}
            fixtures={tournament.fixtures}
            matchFilter={tournament.matchFilter}
            onResetResults={tournament.resetResults}
            onResultChange={tournament.updateResult}
            results={tournament.results}
            setMatchFilter={tournament.setMatchFilter}
            teams={tournament.teams}
            tournamentReady={tournament.tournamentReady}
          />
        </div>
      </div>
    </div>
  )
}

export default LeagueTournamentPage
