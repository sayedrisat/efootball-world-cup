import { useEffect, useState } from 'react'
import { displayName, getInitials } from '../utils/tournament'

function TeamLogo({ team, compact = false }) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [team?.icon])

  const className = compact ? 'team-logo team-logo--compact' : 'team-logo'

  if (team?.icon && !imageFailed) {
    return (
      <span className={className}>
        <img
          src={team.icon}
          alt={`${displayName(team)} icon`}
          onError={() => setImageFailed(true)}
        />
      </span>
    )
  }

  return <span className={className}>{team ? getInitials(team) : '?'}</span>
}

export default TeamLogo
