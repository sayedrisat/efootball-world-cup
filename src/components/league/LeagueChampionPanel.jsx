import { Crown, RotateCw, Sparkles } from 'lucide-react'
import { TROPHY_SRC } from '../../constants/tournament'
import TeamStars from '../TeamStars'
import LeagueTeamAvatar from './LeagueTeamAvatar'
import { displayTeamName } from '../../utils/league/leagueRules'

function LeagueChampionPanel({
  champion,
  completedMatches,
  isAdmin = false,
  onNextTournament,
  pendingMatches,
  table,
  tournamentComplete,
}) {
  const leader = table[0]

  return (
    <section className={`league-champion-panel${tournamentComplete ? ' league-champion-panel--complete' : ''}`}>
      <div className="league-champion-copy">
        <span className="league-kicker">
          <Crown size={16} />
          {tournamentComplete ? 'Champion Confirmed' : 'Current Leader'}
        </span>
        <div className="league-champion-name">
          <h1>{tournamentComplete ? displayTeamName(champion) : leader ? displayTeamName(leader) : 'Unlimited League'}</h1>
          <TeamStars team={tournamentComplete ? champion : leader} />
        </div>
        <p>
          {tournamentComplete
            ? `${displayTeamName(champion)} finished top of the live table and wins the league title.`
            : isAdmin
              ? 'Add unlimited teams, play home-away fixtures, save scores, and let the table decide the champion.'
              : leader
                ? 'Follow every home-away result and the live championship standings.'
                : 'Official fixtures, results, table, and champion updates will appear here.'}
        </p>

        <div className="league-progress-line">
          <span>{completedMatches} finished</span>
          <strong>{pendingMatches} pending</strong>
          {isAdmin && tournamentComplete && (
            <button className="league-next-tournament-button" onClick={onNextTournament} type="button">
              <RotateCw size={16} />
              Next Tournament
            </button>
          )}
        </div>

        {leader && (
          <div className="league-leader-chip">
            <LeagueTeamAvatar size="sm" team={leader} />
            <span>{leader.points} pts</span>
            <span>{leader.goalDifference >= 0 ? `+${leader.goalDifference}` : leader.goalDifference} GD</span>
          </div>
        )}
      </div>

      <div className="league-trophy-frame">
        {tournamentComplete && <Sparkles className="league-spark league-spark--left" size={22} />}
        <img src={TROPHY_SRC} alt="E-Football tournament trophy" />
        {tournamentComplete && <Sparkles className="league-spark league-spark--right" size={22} />}
      </div>
    </section>
  )
}

export default LeagueChampionPanel
