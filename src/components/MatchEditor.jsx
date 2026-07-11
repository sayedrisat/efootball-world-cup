import { displayName, getWinnerId, isDraw, isPenaltyComplete } from '../utils/tournament'
import TeamBadge from './TeamBadge'

function MatchEditor({
  title,
  homeTeam,
  awayTeam,
  result,
  disabled = false,
  enablePenaltyShootout = false,
  onScoreChange,
}) {
  const matchTeams = homeTeam && awayTeam ? [homeTeam, awayTeam] : []
  const winnerId = getWinnerId(result, matchTeams)
  const winnerTeam = matchTeams.find((team) => team.id === winnerId)
  const showPenaltyShootout = enablePenaltyShootout && isDraw(result) && matchTeams.length === 2

  return (
    <div className={`match-editor ${disabled ? 'match-editor--disabled' : ''}`}>
      {title && <div className="match-editor__title">{title}</div>}

      <div className="match-editor__main">
        <TeamBadge team={homeTeam} />
        <div className="score-control">
          <input
            type="number"
            min="0"
            value={result.homeScore}
            disabled={disabled}
            aria-label={`${displayName(homeTeam)} score`}
            onChange={(event) => onScoreChange('homeScore', event.target.value)}
          />
          <span>-</span>
          <input
            type="number"
            min="0"
            value={result.awayScore}
            disabled={disabled}
            aria-label={`${displayName(awayTeam)} score`}
            onChange={(event) => onScoreChange('awayScore', event.target.value)}
          />
        </div>
        <TeamBadge team={awayTeam} align="right" />
      </div>

      {showPenaltyShootout && (
        <div className="penalty-shootout">
          <div className="penalty-shootout__title">Penalty Shoot-out</div>
          <div className="match-editor__main">
            <TeamBadge team={homeTeam} />
            <div className="score-control score-control--penalty">
              <input
                type="number"
                min="0"
                value={result.penaltyHomeScore}
                disabled={disabled}
                aria-label={`${displayName(homeTeam)} penalty score`}
                onChange={(event) => onScoreChange('penaltyHomeScore', event.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                min="0"
                value={result.penaltyAwayScore}
                disabled={disabled}
                aria-label={`${displayName(awayTeam)} penalty score`}
                onChange={(event) => onScoreChange('penaltyAwayScore', event.target.value)}
              />
            </div>
            <TeamBadge team={awayTeam} align="right" />
          </div>
          {isPenaltyComplete(result) && !winnerTeam && (
            <div className="penalty-note">Penalty score must be different to decide winner.</div>
          )}
        </div>
      )}

      {winnerTeam && (
        <div className="winner-chip">
          Winner <strong>{displayName(winnerTeam)}</strong>
        </div>
      )}
    </div>
  )
}

export default MatchEditor
