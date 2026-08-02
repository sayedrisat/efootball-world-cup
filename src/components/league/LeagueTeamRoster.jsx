import { Trash2, UsersRound } from 'lucide-react'
import LeagueTeamAvatar from './LeagueTeamAvatar'
import { displayTeamName } from '../../utils/league/leagueRules'

function LeagueTeamRoster({ onRemoveTeam, teams }) {
  return (
    <section className="league-card league-roster">
      <div className="league-section-title">
        <div>
          <span>Club List</span>
          <h2>Registered Teams</h2>
        </div>
        <UsersRound size={22} />
      </div>

      {teams.length === 0 ? (
        <div className="league-empty-state">
          <strong>No teams yet</strong>
          <p>Add team name and image from the form to generate home-away fixtures.</p>
        </div>
      ) : (
        <div className="league-team-list">
          {teams.map((team, index) => (
            <article className="league-team-card" key={team.id}>
              <span className="league-team-seed">{String(index + 1).padStart(2, '0')}</span>
              <LeagueTeamAvatar team={team} />
              <div>
                <strong>{displayTeamName(team)}</strong>
                <span>Home + Away ready</span>
              </div>
              <button
                aria-label={`Remove ${displayTeamName(team)}`}
                className="league-icon-button league-danger-button"
                onClick={() => onRemoveTeam(team.id)}
                type="button"
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default LeagueTeamRoster
