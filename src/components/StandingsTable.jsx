import { displayName } from '../utils/tournament'
import TeamLogo from './TeamLogo'
import TeamStars from './TeamStars'

function StandingsTable({ groupStandings, groupComplete }) {
  return (
    <section className="panel standings-panel">
      <div className="section-heading">
        <p>Group Tables</p>
        <span>{groupComplete ? 'Top 2 qualify' : 'Live ranking'}</span>
      </div>

      <div className="standings-groups">
        {groupStandings.map((group) => (
          <div className="standings-group" key={group.id}>
            <div className="standings-group__title">
              <strong>{group.name}</strong>
              <span>{groupComplete ? 'Rank 3 out' : '3 players'}</span>
            </div>

            <div className="standings-table">
              <div className="standings-row standings-row--head">
                <span>#</span>
                <span>Team</span>
                <span>P</span>
                <span>W</span>
                <span>D</span>
                <span>L</span>
                <span>GD</span>
                <span>PTS</span>
              </div>

              {group.standings.map((team) => (
                <div
                  className={`standings-row ${
                    groupComplete && team.rank === 3 ? 'standings-row--out' : ''
                  }`}
                  key={team.id}
                >
                  <span>{team.rank}</span>
                  <span className="standings-team">
                    <TeamLogo team={team} compact />
                    {displayName(team)}
                    <TeamStars team={team} />
                  </span>
                  <span>{team.played}</span>
                  <span>{team.wins}</span>
                  <span>{team.draws}</span>
                  <span>{team.losses}</span>
                  <span>{team.goalDifference}</span>
                  <strong>{team.points}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default StandingsTable
