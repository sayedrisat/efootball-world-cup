import Navigation from './components/Navigation'
import { useHashRoute } from './hooks/useHashRoute'
import LeagueAdminPage from './pages/LeagueAdminPage'
import LeaguePublicPage from './pages/LeaguePublicPage'
import LeagueRulesPage from './pages/LeagueRulesPage'
import WorldCupPage from './pages/WorldCupPage'

function getRoutePage(route) {
  if (route === '/rules') return <LeagueRulesPage />
  if (route === '/admin') return <LeagueAdminPage />
  if (route === '/world-cup') return <WorldCupPage />
  return <LeaguePublicPage />
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
