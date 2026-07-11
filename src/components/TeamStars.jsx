const STAR_SYMBOL = '\u2605'

function TeamStars({ team }) {
  const stars = Number(team?.stars || 0)

  if (!stars) return null

  return (
    <span className="team-stars" aria-label={`${stars} tournament wins`}>
      {STAR_SYMBOL} {stars}
    </span>
  )
}

export default TeamStars
