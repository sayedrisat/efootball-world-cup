import { displayName } from '../utils/tournament'
import TeamLogo from './TeamLogo'
import TeamStars from './TeamStars'

function TeamBadge({ team, align = 'left' }) {
  return (
    <div className={`team-badge team-badge--${align}`}>
      <TeamLogo team={team} compact />
      <span className="team-badge__name">{displayName(team)}</span>
      <TeamStars team={team} />
    </div>
  )
}

export default TeamBadge
