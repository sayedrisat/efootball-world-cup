import { LoaderCircle, LogOut, ShieldCheck, UploadCloud } from 'lucide-react'
import AdminLoginPanel from '../components/league/AdminLoginPanel'
import { useLeagueTournament } from '../hooks/league/useLeagueTournament'
import LeagueTournamentPage from './LeagueTournamentPage'

function LeagueAdminPage({ auth }) {
  const tournament = useLeagueTournament({
    canEdit: !auth.isConfigured || Boolean(auth.session),
    userId: auth.session?.user?.id || null,
  })

  if (auth.loading) {
    return (
      <section className="league-card admin-loading-panel">
        <LoaderCircle className="spin" size={28} />
        <strong>Checking admin session</strong>
      </section>
    )
  }

  if (auth.isConfigured && !auth.session) {
    return <AdminLoginPanel onResetPassword={auth.sendPasswordReset} onSignIn={auth.signIn} />
  }

  return (
    <div className="admin-page">
      <header className="league-card admin-control-header">
        <div>
          <span className="league-kicker">
            <ShieldCheck size={16} />
            Admin Control Room
          </span>
          <strong>{auth.session?.user?.email || 'Local preview access'}</strong>
        </div>

        {auth.session && (
          <div className="admin-header-actions">
            {tournament.localDraftAvailable && (
              <button className="league-primary-action" onClick={tournament.importLocalDraft} type="button">
                <UploadCloud size={16} />
                Import Local Data
              </button>
            )}
            <button className="league-reset-button" onClick={auth.signOut} type="button">
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </header>

      {!auth.isConfigured && (
        <div className="league-local-notice">
          Supabase is not connected yet. Changes are staying in this browser until cloud keys are added.
        </div>
      )}

      <LeagueTournamentPage editable tournament={tournament} />
    </div>
  )
}

export default LeagueAdminPage
