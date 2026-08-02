import { useEffect, useState } from 'react'
import { displayTeamName } from '../../utils/league/leagueRules'

function getInitials(team) {
  return displayTeamName(team)
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function LeagueTeamAvatar({ team, size = 'md' }) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [team?.image])

  const className = `league-avatar league-avatar--${size}`

  if (team?.image && !imageFailed) {
    return (
      <span className={className}>
        <img
          src={team.image}
          alt={`${displayTeamName(team)} logo`}
          onError={() => setImageFailed(true)}
        />
      </span>
    )
  }

  return <span className={className}>{team ? getInitials(team) : '?'}</span>
}

export default LeagueTeamAvatar
