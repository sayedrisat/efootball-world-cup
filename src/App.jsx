import Navigation from './components/Navigation'
import { useHashRoute } from './hooks/useHashRoute'
import LeagueRulesPage from './pages/LeagueRulesPage'
import LeagueTournamentPage from './pages/LeagueTournamentPage'
import WorldCupPage from './pages/WorldCupPage'

function getRoutePage(route) {
  if (route === '/rules') return <LeagueRulesPage />
  if (route === '/world-cup') return <WorldCupPage />
  return <LeagueTournamentPage />
}

function App() {
  const route = useHashRoute()

  return (
    <main className="app-shell">
      <Navigation currentRoute={route} />
      {getRoutePage(route)}
    </main>
  )
}

export default App
