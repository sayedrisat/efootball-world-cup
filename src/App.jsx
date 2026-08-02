import Navigation from './components/Navigation'
import PasswordRecoveryPanel from './components/league/PasswordRecoveryPanel'
import { useHashRoute } from './hooks/useHashRoute'
import { useSupabaseAuth } from './hooks/useSupabaseAuth'
import LeagueAdminPage from './pages/LeagueAdminPage'
import LeaguePublicPage from './pages/LeaguePublicPage'
import LeagueRulesPage from './pages/LeagueRulesPage'
import WorldCupPage from './pages/WorldCupPage'

function getRoutePage(route, auth) {
  if (route === '/rules') return <LeagueRulesPage />
  if (route === '/admin') return <LeagueAdminPage auth={auth} />
  if (route === '/world-cup') return <WorldCupPage />
  return <LeaguePublicPage />
}

function App() {
  const auth = useSupabaseAuth()
  const route = useHashRoute()

  return (
    <main className="app-shell">
      <Navigation currentRoute={route} />
      {auth.isPasswordRecovery ? (
        <PasswordRecoveryPanel onUpdatePassword={auth.updatePassword} />
      ) : (
        getRoutePage(route, auth)
      )}
    </main>
  )
}

export default App
