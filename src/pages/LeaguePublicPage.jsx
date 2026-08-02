import { useLeagueTournament } from '../hooks/league/useLeagueTournament'
import LeagueTournamentPage from './LeagueTournamentPage'

function LeaguePublicPage() {
  const tournament = useLeagueTournament({ canEdit: false })

  return <LeagueTournamentPage tournament={tournament} />
}

export default LeaguePublicPage
