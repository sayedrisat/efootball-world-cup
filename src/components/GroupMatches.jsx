import { GROUP_MATCHES } from '../constants/tournament'
import MatchEditor from './MatchEditor'

function GroupMatches({ teamsById, groupResults, rosterComplete, onResultChange }) {
  return (
    <section className="panel group-panel">
      <div className="section-heading">
        <p>Group Stage</p>
        <span>{GROUP_MATCHES.length} matches</span>
      </div>

      <div className="match-list">
        {GROUP_MATCHES.map((match, index) => (
          <MatchEditor
            key={match.id}
            title={`Match ${index + 1}`}
            homeTeam={teamsById[match.homeId]}
            awayTeam={teamsById[match.awayId]}
            result={groupResults[match.id]}
            disabled={!rosterComplete}
            onScoreChange={(field, value) => onResultChange(match.id, field, value)}
          />
        ))}
      </div>
    </section>
  )
}

export default GroupMatches
