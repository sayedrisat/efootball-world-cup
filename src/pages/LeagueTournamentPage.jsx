import LeagueChampionPanel from '../components/league/LeagueChampionPanel'
import LeagueMatchBoard from '../components/league/LeagueMatchBoard'
import LeagueStatStrip from '../components/league/LeagueStatStrip'
import LeagueTable from '../components/league/LeagueTable'
import LeagueTeamForm from '../components/league/LeagueTeamForm'
import LeagueTeamRoster from '../components/league/LeagueTeamRoster'
import LeagueLiveStatusBar from '../components/league/LeagueLiveStatusBar'

function LeagueTournamentPage({ editable = false, tournament }) {
  return (
    <div className="league-page">
      <LeagueLiveStatusBar lastUpdated={tournament.lastUpdated} status={tournament.remoteStatus} />

      {tournament.syncError && <div className="league-sync-error">{tournament.syncError}</div>}

      <LeagueChampionPanel
        champion={tournament.champion}
        completedMatches={tournament.completedMatches}
        isAdmin={editable}
        onNextTournament={tournament.startNextTournament}
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

      <div className={editable ? 'league-layout' : 'league-public-layout'}>
        {editable && (
          <aside className="league-side">
            <LeagueTeamForm onAddTeam={tournament.addTeam} />
            <LeagueTeamRoster onRemoveTeam={tournament.removeTeam} teams={tournament.teams} />
            <button className="league-reset-all-button" onClick={tournament.resetAll} type="button">
              Reset Full League
            </button>
          </aside>
        )}

        <div className="league-main-stack">
          <LeagueTable table={tournament.table} tournamentComplete={tournament.tournamentComplete} />
          <LeagueMatchBoard
            filteredFixtures={tournament.filteredFixtures}
            fixtures={tournament.fixtures}
            matchFilter={tournament.matchFilter}
            onResetResults={tournament.resetResults}
            onResultChange={tournament.updateResult}
            readOnly={!editable}
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
