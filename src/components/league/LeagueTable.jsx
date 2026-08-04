import { BarChart3, Crown } from 'lucide-react'
import TeamStars from '../TeamStars'
import LeagueTeamAvatar from './LeagueTeamAvatar'
import { displayTeamName } from '../../utils/league/leagueRules'

function formatGoalDifference(value) {
  if (value > 0) return `+${value}`
  return String(value)
}

function LeagueTable({ table, tournamentComplete }) {
  return (
    <section className="league-card league-table-card">
      <div className="league-section-title">
        <div>
          <span>Live Ranking</span>
          <h2>League Table</h2>
        </div>
        <BarChart3 size={22} />
      </div>

      <div className="league-table-scroll">
        <div className="league-table">
          <div className="league-table-row league-table-row--head">
            <span>#</span>
            <span>Team</span>
            <span>P</span>
            <span>H</span>
            <span>A</span>
            <span>W</span>
            <span>D</span>
            <span>L</span>
            <span>GF</span>
            <span>GA</span>
            <span>+Goal</span>
            <span>PTS</span>
          </div>

          {table.length === 0 ? (
            <div className="league-table-empty">Add two or more teams to start the table.</div>
          ) : (
            table.map((team) => (
              <div
                className={`league-table-row${
                  tournamentComplete && team.rank === 1 ? ' league-table-row--champion' : ''
                }`}
                key={team.id}
              >
                <span className="league-rank-cell">
                  {team.rank}
                  {tournamentComplete && team.rank === 1 && <Crown size={15} />}
                </span>
                <span className="league-table-team">
                  <LeagueTeamAvatar size="sm" team={team} />
                  <span className="league-table-name">
                    <strong>{displayTeamName(team)}</strong>
                    <TeamStars team={team} />
                  </span>
                </span>
                <span>{team.played}</span>
                <span>{team.homePlayed}</span>
                <span>{team.awayPlayed}</span>
                <span>{team.wins}</span>
                <span>{team.draws}</span>
                <span>{team.losses}</span>
                <span>{team.goalsFor}</span>
                <span>{team.goalsAgainst}</span>
                <span className={team.goalDifference >= 0 ? 'league-positive' : 'league-negative'}>
                  {formatGoalDifference(team.goalDifference)}
                </span>
                <span className="league-points-cell">{team.points}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="league-mobile-table" role="table" aria-label="Mobile league ranking">
        {table.length === 0 ? (
          <div className="league-table-empty">Add two or more teams to start the table.</div>
        ) : (
          table.map((team) => (
            <article
              className={`league-mobile-standing${
                tournamentComplete && team.rank === 1 ? ' league-mobile-standing--champion' : ''
              }`}
              key={team.id}
              role="row"
            >
              <span className="league-mobile-rank">
                {team.rank}
                {tournamentComplete && team.rank === 1 && <Crown size={13} />}
              </span>
              <LeagueTeamAvatar size="sm" team={team} />
              <div className="league-mobile-team-info">
                <span className="league-table-name">
                  <strong>{displayTeamName(team)}</strong>
                  <TeamStars team={team} />
                </span>
                <span>{team.played} played | {team.wins}W {team.draws}D {team.losses}L</span>
              </div>
              <div className="league-mobile-points">
                <strong>{team.points}</strong>
                <span>PTS</span>
              </div>
              <div className="league-mobile-stats">
                <span>GF <strong>{team.goalsFor}</strong></span>
                <span>GA <strong>{team.goalsAgainst}</strong></span>
                <span>GD <strong>{formatGoalDifference(team.goalDifference)}</strong></span>
                <span>Home <strong>{team.homePlayed}</strong></span>
                <span>Away <strong>{team.awayPlayed}</strong></span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default LeagueTable
