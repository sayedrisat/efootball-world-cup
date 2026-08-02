function AppHeader({ nextTournamentDisabled, onNextTournament, onResetScores, onResetAll, onToggleOutput }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">E-Football 6 Player Tournament</p>
        <h1>World Cup Finals Hub</h1>
      </div>

      <div className="header-actions">
        <button type="button" className="secondary-button" onClick={onResetScores}>
          Reset Scores
        </button>
        <button type="button" className="secondary-button" onClick={onResetAll}>
          Reset All
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={nextTournamentDisabled}
          onClick={onNextTournament}
        >
          Next Tournament
        </button>
        <button type="button" className="primary-button" onClick={onToggleOutput}>
          Output
        </button>
      </div>
    </header>
  )
}

export default AppHeader
