import { Home, Plane, Trophy } from 'lucide-react'
import LeagueTeamAvatar from './LeagueTeamAvatar'
import { displayTeamName, emptyResult, getMatchState } from '../../utils/league/leagueRules'

function getResultLabel(matchState, homeTeam, awayTeam) {
  if (matchState === 'pending') return 'Pending'
  if (matchState === 'draw') return 'Draw'
  if (matchState === 'home') return `${displayTeamName(homeTeam)} wins`
  return `${displayTeamName(awayTeam)} wins`
}

function LeagueMatchCard({ awayTeam, fixture, homeTeam, onResultChange, result, results }) {
  const savedResult = result || emptyResult
  const matchState = getMatchState(fixture, results)

  return (
    <article className={`league-match-card league-match-card--${matchState}`}>
      <div className="league-match-topline">
        <span>
          <Home size={14} />
          Home
        </span>
        <strong>{getResultLabel(matchState, homeTeam, awayTeam)}</strong>
        <span>
          <Plane size={14} />
          Away
        </span>
      </div>

      <div className="league-match-main">
        <div className={`league-match-side${matchState === 'home' ? ' league-match-side--winner' : ''}`}>
          <LeagueTeamAvatar team={homeTeam} />
          <strong>{displayTeamName(homeTeam)}</strong>
        </div>

        <div className="league-score-box">
          <input
            aria-label={`${displayTeamName(homeTeam)} score`}
            inputMode="numeric"
            max="99"
            min="0"
            onChange={(event) => onResultChange(fixture.id, 'homeScore', event.target.value)}
            placeholder="0"
            type="number"
            value={savedResult.homeScore}
          />
          <span>:</span>
          <input
            aria-label={`${displayTeamName(awayTeam)} score`}
            inputMode="numeric"
            max="99"
            min="0"
            onChange={(event) => onResultChange(fixture.id, 'awayScore', event.target.value)}
            placeholder="0"
            type="number"
            value={savedResult.awayScore}
          />
        </div>

        <div className={`league-match-side${matchState === 'away' ? ' league-match-side--winner' : ''}`}>
          <LeagueTeamAvatar team={awayTeam} />
          <strong>{displayTeamName(awayTeam)}</strong>
        </div>
      </div>

      <div className="league-match-footer">
        <span>{matchState === 'pending' ? 'Result not saved yet' : 'Result saved in browser'}</span>
        {matchState !== 'pending' && (
          <span className="league-result-pill">
            <Trophy size={14} />
            {matchState === 'draw' ? '1 point each' : '3 points'}
          </span>
        )}
      </div>
    </article>
  )
}

export default LeagueMatchCard
