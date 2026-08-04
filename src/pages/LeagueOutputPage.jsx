import { Images, Maximize2, Printer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import HomeFixturePoster from '../components/league/HomeFixturePoster'
import LeagueLiveStatusBar from '../components/league/LeagueLiveStatusBar'
import { displayTeamName, isResultComplete } from '../utils/league/leagueRules'

const outputFilters = [
  { label: 'All Home', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Finished', value: 'completed' },
]

function LeagueOutputPage({ tournament }) {
  const [filter, setFilter] = useState('pending')
  const [selectedTeamId, setSelectedTeamId] = useState(tournament.teams[0]?.id || '')
  const posterRef = useRef(null)

  useEffect(() => {
    if (tournament.teams.some((team) => team.id === selectedTeamId)) return
    setSelectedTeamId(tournament.teams[0]?.id || '')
  }, [selectedTeamId, tournament.teams])

  const teamsById = useMemo(
    () => Object.fromEntries(tournament.teams.map((team) => [team.id, team])),
    [tournament.teams],
  )
  const selectedTeam = teamsById[selectedTeamId]
  const homeFixtures = tournament.fixtures.filter((fixture) => fixture.homeId === selectedTeamId)
  const filteredFixtures = homeFixtures.filter((fixture) => {
    if (filter === 'pending') return !isResultComplete(tournament.results[fixture.id])
    if (filter === 'completed') return isResultComplete(tournament.results[fixture.id])
    return true
  })

  const openPosterView = async () => {
    if (!posterRef.current?.requestFullscreen) {
      posterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    try {
      await posterRef.current.requestFullscreen()
    } catch {
      posterRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="league-page league-output-page">
      <LeagueLiveStatusBar lastUpdated={tournament.lastUpdated} status={tournament.remoteStatus} />
      {tournament.syncError && <div className="league-sync-error">{tournament.syncError}</div>}

      <header className="league-route-heading">
        <span className="league-kicker">
          <Images size={16} />
          Share Center
        </span>
        <h1>Home Match Output</h1>
        <p>One official home fixture board for every team.</p>
      </header>

      <section className="league-card output-control-panel">
        <label>
          Home Team
          <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
            {tournament.teams.length === 0 && <option value="">No teams available</option>}
            {tournament.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {displayTeamName(team)}
              </option>
            ))}
          </select>
        </label>

        <div className="league-filter-tabs output-filter-tabs" aria-label="Output match filter">
          {outputFilters.map((item) => (
            <button
              className={filter === item.value ? 'league-tab league-tab--active' : 'league-tab'}
              key={item.value}
              onClick={() => setFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="output-actions">
          <button className="league-reset-button" disabled={!selectedTeam} onClick={openPosterView} type="button">
            <Maximize2 size={16} />
            Poster View
          </button>
          <button className="league-primary-action" disabled={!selectedTeam} onClick={() => window.print()} type="button">
            <Printer size={16} />
            Print Output
          </button>
        </div>
      </section>

      {selectedTeam ? (
        <div className="home-poster-stage" ref={posterRef}>
          <HomeFixturePoster
            fixtures={filteredFixtures}
            homeTeam={selectedTeam}
            results={tournament.results}
            teamsById={teamsById}
            totalHomeMatches={homeFixtures.length}
          />
        </div>
      ) : (
        <section className="league-card league-empty-state league-empty-state--wide">
          <strong>No output available</strong>
          <p>Add teams from the Admin page to create home match posters.</p>
        </section>
      )}
    </div>
  )
}

export default LeagueOutputPage
