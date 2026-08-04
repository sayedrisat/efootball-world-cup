import { CalendarDays } from 'lucide-react'
import LeagueLiveStatusBar from '../components/league/LeagueLiveStatusBar'
import LeagueMatchBoard from '../components/league/LeagueMatchBoard'
import LeagueStatStrip from '../components/league/LeagueStatStrip'

function LeagueMatchesPage({ tournament }) {
  return (
    <div className="league-page">
      <LeagueLiveStatusBar lastUpdated={tournament.lastUpdated} status={tournament.remoteStatus} />
      {tournament.syncError && <div className="league-sync-error">{tournament.syncError}</div>}

      <header className="league-route-heading">
        <span className="league-kicker">
          <CalendarDays size={16} />
          Match Center
        </span>
        <h1>Home & Away Fixtures</h1>
        <p>Every official fixture and published result in one live match feed.</p>
      </header>

      <LeagueStatStrip
        completedMatches={tournament.completedMatches}
        pendingMatches={tournament.pendingMatches}
        teams={tournament.teams}
        totalMatches={tournament.fixtures.length}
      />

      <LeagueMatchBoard
        filteredFixtures={tournament.filteredFixtures}
        fixtures={tournament.fixtures}
        matchFilter={tournament.matchFilter}
        onResetResults={tournament.resetResults}
        onResultChange={tournament.updateResult}
        readOnly
        results={tournament.results}
        setMatchFilter={tournament.setMatchFilter}
        teams={tournament.teams}
        tournamentReady={tournament.tournamentReady}
      />
    </div>
  )
}

export default LeagueMatchesPage
