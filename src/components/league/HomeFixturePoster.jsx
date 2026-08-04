import { CheckCircle2, Clock3, Home } from 'lucide-react'
import TeamStars from '../TeamStars'
import { displayTeamName, emptyResult, isResultComplete } from '../../utils/league/leagueRules'
import LeagueTeamAvatar from './LeagueTeamAvatar'

function PosterFixtureRow({ awayTeam, fixture, homeTeam, result }) {
  const savedResult = result || emptyResult
  const isFinished = isResultComplete(savedResult)

  return (
    <article className={`home-poster-match${isFinished ? ' home-poster-match--finished' : ''}`}>
      <div className="home-poster-match-number">Match {String(fixture.order).padStart(2, '0')}</div>

      <div className="home-poster-team home-poster-team--home">
        <LeagueTeamAvatar size="poster" team={homeTeam} />
        <div>
          <span>Home</span>
          <strong>{displayTeamName(homeTeam)}</strong>
          <TeamStars team={homeTeam} />
        </div>
      </div>

      <div className="home-poster-score">
        {isFinished ? (
          <strong>
            {savedResult.homeScore}<span>:</span>{savedResult.awayScore}
          </strong>
        ) : (
          <strong>VS</strong>
        )}
        <span className={isFinished ? 'home-poster-status home-poster-status--done' : 'home-poster-status'}>
          {isFinished ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
          {isFinished ? 'Finished' : 'Pending'}
        </span>
      </div>

      <div className="home-poster-team home-poster-team--away">
        <LeagueTeamAvatar size="poster" team={awayTeam} />
        <div>
          <span>Away</span>
          <strong>{displayTeamName(awayTeam)}</strong>
          <TeamStars team={awayTeam} />
        </div>
      </div>
    </article>
  )
}

function HomeFixturePoster({ fixtures, homeTeam, results, teamsById, totalHomeMatches }) {
  const finishedMatches = fixtures.filter((fixture) => isResultComplete(results[fixture.id])).length
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  return (
    <section className="home-fixture-poster">
      <div className="home-poster-accent" />

      <header className="home-poster-header">
        <div className="home-poster-brand">
          <span className="home-poster-brand-mark">EF</span>
          <div>
            <strong>E-Football League</strong>
            <span>Official Match Board</span>
          </div>
        </div>
        <div className="home-poster-date">
          <span>Match Day</span>
          <strong>{dateLabel}</strong>
        </div>
      </header>

      <div className="home-poster-hero">
        <div>
          <span className="home-poster-eyebrow">
            <Home size={15} />
            Home Match Assignment
          </span>
          <h1>{displayTeamName(homeTeam)}</h1>
          <p>Complete all pending home fixtures</p>
        </div>
        <div className="home-poster-featured-team">
          <LeagueTeamAvatar size="hero" team={homeTeam} />
          <TeamStars team={homeTeam} />
        </div>
      </div>

      <div className="home-poster-summary">
        <div>
          <span>Showing</span>
          <strong>{fixtures.length}</strong>
        </div>
        <div>
          <span>Total Home</span>
          <strong>{totalHomeMatches}</strong>
        </div>
        <div>
          <span>Finished Here</span>
          <strong>{finishedMatches}</strong>
        </div>
      </div>

      {fixtures.length === 0 ? (
        <div className="home-poster-empty">No home fixtures in this view</div>
      ) : (
        <div className="home-poster-fixtures">
          {fixtures.map((fixture, index) => (
            <PosterFixtureRow
              awayTeam={teamsById[fixture.awayId]}
              fixture={{ ...fixture, order: index + 1 }}
              homeTeam={homeTeam}
              key={fixture.id}
              result={results[fixture.id]}
            />
          ))}
        </div>
      )}

      <footer className="home-poster-footer">
        <strong>Play Fair. Finish Strong.</strong>
        <span>E-Football Hub | Home & Away League</span>
      </footer>
    </section>
  )
}

export default HomeFixturePoster
