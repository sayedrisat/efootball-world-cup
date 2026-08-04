import LeagueChampionPanel from '../components/league/LeagueChampionPanel'
import LeagueLiveStatusBar from '../components/league/LeagueLiveStatusBar'
import LeagueStatStrip from '../components/league/LeagueStatStrip'
import LeagueTable from '../components/league/LeagueTable'

function LeagueRankingPage({ tournament }) {
  return (
    <div className="league-page">
      <LeagueLiveStatusBar lastUpdated={tournament.lastUpdated} status={tournament.remoteStatus} />
      {tournament.syncError && <div className="league-sync-error">{tournament.syncError}</div>}

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

      <LeagueTable table={tournament.table} tournamentComplete={tournament.tournamentComplete} />
    </div>
  )
}

export default LeagueRankingPage
