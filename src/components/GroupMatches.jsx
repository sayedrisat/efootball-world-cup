import MatchEditor from './MatchEditor'

function GroupMatches({ groupStandings, teamsById, groupResults, rosterComplete, onResultChange }) {
  const matchCount = groupStandings.reduce((total, group) => total + group.matches.length, 0)

  return (
    <section className="panel group-panel">
      <div className="section-heading">
        <p>Group Stage</p>
        <span>{matchCount} matches</span>
      </div>

      <div className="group-match-grid">
        {groupStandings.map((group) => (
          <div className="group-block" key={group.id}>
            <div className="group-block__title">
              <strong>{group.name}</strong>
              <span>{group.matches.length} fixtures</span>
            </div>
            <div className="match-list">
              {group.matches.map((match, index) => (
                <MatchEditor
                  key={match.id}
                  title={`${group.name} - Match ${index + 1}`}
                  homeTeam={teamsById[match.homeId]}
                  awayTeam={teamsById[match.awayId]}
                  result={groupResults[match.id]}
                  disabled={!rosterComplete}
                  onScoreChange={(field, value) => onResultChange(match.id, field, value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default GroupMatches
