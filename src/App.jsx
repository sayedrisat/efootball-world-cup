import Navigation from './components/Navigation'
import PasswordRecoveryPanel from './components/league/PasswordRecoveryPanel'
import { useHashRoute } from './hooks/useHashRoute'
import { useLeagueTournament } from './hooks/league/useLeagueTournament'
import { useSupabaseAuth } from './hooks/useSupabaseAuth'
import LeagueAdminPage from './pages/LeagueAdminPage'
import LeaguePublicPage from './pages/LeaguePublicPage'
import LeagueRulesPage from './pages/LeagueRulesPage'
import WorldCupPage from './pages/WorldCupPage'

function getRoutePage(route, auth, tournament) {
  if (route === '/rules') return <LeagueRulesPage />
  if (route === '/admin') return <LeagueAdminPage auth={auth} tournament={tournament} />
  if (route === '/world-cup') return <WorldCupPage />
  return <LeaguePublicPage tournament={tournament} />
}

function App() {
  const auth = useSupabaseAuth()
  const route = useHashRoute()
  const tournament = useLeagueTournament({
    canEdit: !auth.isConfigured || (Boolean(auth.session) && auth.isAdmin),
    enabled: !auth.loading,
    userId: auth.session?.user?.id || null,
  })

  return (
    <main className="app-shell">
      <Navigation currentRoute={route} />
      {auth.isPasswordRecovery ? (
        <PasswordRecoveryPanel onUpdatePassword={auth.updatePassword} />
      ) : (
        getRoutePage(route, auth, tournament)
      )}
    </main>
  )
}

export default App
