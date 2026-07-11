import { displayName } from '../utils/tournament'
import TeamLogo from './TeamLogo'
import TeamStars from './TeamStars'

function StandingsTable({ standings, groupComplete }) {
  return (
    <section className="panel standings-panel">
      <div className="section-heading">
        <p>Group Table</p>
        <span>{groupComplete ? 'Final ranking' : 'Live ranking'}</span>
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

        {standings.map((team) => (
          <div
            className={`standings-row ${
              groupComplete && team.rank === 4 ? 'standings-row--out' : ''
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
    </section>
  )
}

export default StandingsTable
