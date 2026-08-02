import { LoaderCircle, LogOut, ShieldCheck, TriangleAlert, UploadCloud } from 'lucide-react'
import AdminLoginPanel from '../components/league/AdminLoginPanel'
import LeagueTournamentPage from './LeagueTournamentPage'

function LeagueAdminPage({ auth, tournament }) {
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

  if (auth.adminLoading) {
    return (
      <section className="league-card admin-loading-panel">
        <LoaderCircle className="spin" size={28} />
        <strong>Verifying admin access</strong>
      </section>
    )
  }

  if (auth.isConfigured && auth.session && !auth.isAdmin) {
    return (
      <section className="league-card admin-access-panel">
        <TriangleAlert size={30} />
        <span className="league-kicker">Access Not Assigned</span>
        <h1>Admin Permission Required</h1>
        <p>{auth.adminError || 'This Auth user is signed in but is not registered as a tournament admin.'}</p>
        <button className="league-reset-button" onClick={auth.signOut} type="button">
          <LogOut size={16} />
          Sign Out
        </button>
      </section>
    )
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
