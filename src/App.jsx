import AppHeader from './components/AppHeader'
import GroupMatches from './components/GroupMatches'
import KnockoutPanel from './components/KnockoutPanel'
import OutputBanners from './components/OutputBanners'
import StandingsTable from './components/StandingsTable'
import TeamSetup from './components/TeamSetup'
import { useTournamentManager } from './hooks/useTournamentManager'

function App() {
  const tournament = useTournamentManager()

  return (
    <main className="app-shell">
      <AppHeader
        nextTournamentDisabled={!tournament.champion}
        onNextTournament={tournament.startNextTournament}
        onResetScores={tournament.resetScores}
        onResetAll={tournament.resetAll}
        onToggleOutput={() => tournament.setShowOutput((value) => !value)}
      />

      <TeamSetup
        teams={tournament.teams}
        onTeamChange={tournament.updateTeam}
        onIconUpload={tournament.uploadIcon}
        onClearIcon={tournament.clearIcon}
      />

      <div className="dashboard-grid">
        <GroupMatches
          groupStandings={tournament.groupStandings}
          teamsById={tournament.teamsById}
          groupResults={tournament.groupResults}
          rosterComplete={tournament.rosterComplete}
          onResultChange={tournament.updateGroupResult}
        />

        <div className="side-stack">
          <StandingsTable
            groupStandings={tournament.groupStandings}
            groupComplete={tournament.groupComplete}
          />
          <KnockoutPanel
            groupComplete={tournament.groupComplete}
            groupAFirst={tournament.groupAFirst}
            groupASecond={tournament.groupASecond}
            groupBFirst={tournament.groupBFirst}
            groupBSecond={tournament.groupBSecond}
            semiAResult={tournament.semiAResult}
            semiBResult={tournament.semiBResult}
            finalResult={tournament.finalResult}
            semiAWinner={tournament.semiAWinner}
            semiBWinner={tournament.semiBWinner}
            champion={tournament.champion}
            onKnockoutChange={tournament.updateKnockout}
          />
        </div>
      </div>

      {tournament.showOutput && (
        <OutputBanners
          teamsById={tournament.teamsById}
          groupStandings={tournament.groupStandings}
          groupResults={tournament.groupResults}
          groupComplete={tournament.groupComplete}
          groupAFirst={tournament.groupAFirst}
          groupASecond={tournament.groupASecond}
          groupBFirst={tournament.groupBFirst}
          groupBSecond={tournament.groupBSecond}
          semiAResult={tournament.semiAResult}
          semiBResult={tournament.semiBResult}
          finalResult={tournament.finalResult}
          semiAWinner={tournament.semiAWinner}
          semiBWinner={tournament.semiBWinner}
          champion={tournament.champion}
        />
      )}
    </main>
  )
}

export default App
