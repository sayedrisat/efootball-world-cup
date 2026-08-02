import { TROPHY_SRC } from '../constants/tournament'
import { displayName, scoreText } from '../utils/tournament'
import TeamBadge from './TeamBadge'
import TeamLogo from './TeamLogo'
import TeamStars from './TeamStars'

function ResultRow({ homeTeam, awayTeam, result }) {
  return (
    <div className="banner-result-row">
      <div className="banner-team banner-team--left">
        <span>{displayName(homeTeam)}</span>
        <TeamStars team={homeTeam} />
        <TeamLogo team={homeTeam} compact />
      </div>
      <strong>{scoreText(result)}</strong>
      <div className="banner-team">
        <TeamLogo team={awayTeam} compact />
        <span>{displayName(awayTeam)}</span>
        <TeamStars team={awayTeam} />
      </div>
    </div>
  )
}

function StageResultRow({ homeTeam, awayTeam, result }) {
  return (
    <div className="banner-stage-row">
      <TeamBadge team={homeTeam} />
      <strong>{scoreText(result)}</strong>
      <TeamBadge team={awayTeam} align="right" />
    </div>
  )
}

function OutputBanners({
  teamsById,
  groupStandings,
  groupResults,
  groupComplete,
  groupAFirst,
  groupASecond,
  groupBFirst,
  groupBSecond,
  semiAResult,
  semiBResult,
  finalResult,
  semiAWinner,
  semiBWinner,
  champion,
}) {
  return (
    <section className="output-zone">
      <div className="banner-card banner-card--results">
        <div className="banner-label">E-Football World Cup</div>
        <h2>Group Stage Results</h2>

        <div className="banner-results">
          {groupStandings.map((group) => (
            <div className="banner-group" key={group.id}>
              <div className="banner-group__title">{group.name}</div>
              {group.matches.map((match) => (
                <ResultRow
                  key={match.id}
                  homeTeam={teamsById[match.homeId]}
                  awayTeam={teamsById[match.awayId]}
                  result={groupResults[match.id]}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="banner-card banner-card--table">
        <div className="banner-label">Group Ranking</div>
        <h2>{groupComplete ? 'Semi Finalists' : 'Live Tables'}</h2>

        <div className="banner-standings">
          {groupStandings.map((group) => (
            <div className="banner-group" key={group.id}>
              <div className="banner-group__title">{group.name}</div>
              {group.standings.map((team) => (
                <div className="banner-standing-row" key={team.id}>
                  <span>{team.rank}</span>
                  <TeamLogo team={team} compact />
                  <strong>{displayName(team)}</strong>
                  <TeamStars team={team} />
                  <em>{team.points} pts</em>
                  {groupComplete && team.rank === 3 && <small>OUT</small>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="banner-card banner-card--knockout">
        <div className="banner-label">Semi Final 1</div>
        <h2>A1 vs B2</h2>
        <StageResultRow
          homeTeam={groupComplete ? groupAFirst : null}
          awayTeam={groupComplete ? groupBSecond : null}
          result={semiAResult}
        />
        <div className="banner-advance">
          Winner: <strong>{semiAWinner ? displayName(semiAWinner) : 'TBD'}</strong>
        </div>
      </div>

      <div className="banner-card banner-card--knockout">
        <div className="banner-label">Semi Final 2</div>
        <h2>B1 vs A2</h2>
        <StageResultRow
          homeTeam={groupComplete ? groupBFirst : null}
          awayTeam={groupComplete ? groupASecond : null}
          result={semiBResult}
        />
        <div className="banner-advance">
          Winner: <strong>{semiBWinner ? displayName(semiBWinner) : 'TBD'}</strong>
        </div>
      </div>

      <div className="banner-card banner-card--knockout">
        <div className="banner-label">Final</div>
        <h2>Champion Match</h2>
        <StageResultRow
          homeTeam={semiAWinner}
          awayTeam={semiBWinner}
          result={finalResult}
        />
        <div className="banner-advance">
          Champion: <strong>{champion ? displayName(champion) : 'TBD'}</strong>
        </div>
      </div>

      <div className="banner-card banner-card--champion">
        <div className="champion-copy">
          <div className="banner-label">Tournament Champion</div>
          <h2>{champion ? displayName(champion) : 'Champion TBD'}</h2>
          <div className="champion-team">
            <TeamLogo team={champion} />
            <span>E-Football World Cup Winner</span>
            <TeamStars team={champion} />
          </div>
        </div>
        <img className="trophy-image" src={TROPHY_SRC} alt="E-Football tournament trophy" />
      </div>
    </section>
  )
}

export default OutputBanners
