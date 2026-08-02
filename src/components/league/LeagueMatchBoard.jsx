import { RotateCcw, Swords } from 'lucide-react'
import LeagueMatchCard from './LeagueMatchCard'

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Finished', value: 'completed' },
]

function LeagueMatchBoard({
  filteredFixtures,
  fixtures,
  matchFilter,
  onResetResults,
  onResultChange,
  readOnly = false,
  results,
  setMatchFilter,
  teams,
  tournamentReady,
}) {
  const teamsById = Object.fromEntries(teams.map((team) => [team.id, team]))

  return (
    <section className="league-card league-match-board">
      <div className="league-section-title">
        <div>
          <span>Home & Away</span>
          <h2>{readOnly ? 'Live Results' : 'Match Center'}</h2>
        </div>
        <Swords size={22} />
      </div>

      <div className="league-board-toolbar">
        <div className="league-filter-tabs">
          {filters.map((filter) => (
            <button
              className={matchFilter === filter.value ? 'league-tab league-tab--active' : 'league-tab'}
              key={filter.value}
              onClick={() => setMatchFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!readOnly && (
          <button className="league-reset-button" disabled={fixtures.length === 0} onClick={onResetResults} type="button">
            <RotateCcw size={16} />
            Reset Results
          </button>
        )}
      </div>

      {!tournamentReady ? (
        <div className="league-empty-state league-empty-state--wide">
          <strong>Add at least 2 teams</strong>
          <p>After that every team gets one home and one away match against every opponent.</p>
        </div>
      ) : filteredFixtures.length === 0 ? (
        <div className="league-empty-state league-empty-state--wide">
          <strong>No matches in this filter</strong>
          <p>Switch filter or add another score.</p>
        </div>
      ) : (
        <div className="league-match-grid">
          {filteredFixtures.map((fixture) => (
            <LeagueMatchCard
              awayTeam={teamsById[fixture.awayId]}
              fixture={fixture}
              homeTeam={teamsById[fixture.homeId]}
              key={fixture.id}
              onResultChange={onResultChange}
              readOnly={readOnly}
              result={results[fixture.id]}
              results={results}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default LeagueMatchBoard
