import MatchEditor from './MatchEditor'

function KnockoutPanel({
  groupComplete,
  firstSeed,
  secondSeed,
  thirdSeed,
  semiResult,
  finalResult,
  semiWinner,
  champion,
  onKnockoutChange,
}) {
  return (
    <section className="panel knockout-panel">
      <div className="section-heading">
        <p>Knockout</p>
        <span>{champion ? 'Champion decided' : 'Playoff bracket'}</span>
      </div>

      <div className="knockout-grid">
        <MatchEditor
          title="Semi Final - Rank 2 vs Rank 3"
          homeTeam={groupComplete ? secondSeed : null}
          awayTeam={groupComplete ? thirdSeed : null}
          result={semiResult}
          disabled={!groupComplete}
          enablePenaltyShootout
          onScoreChange={(field, value) => onKnockoutChange('semi', field, value)}
        />

        <MatchEditor
          title="Final - Rank 1 vs Semi Winner"
          homeTeam={groupComplete ? firstSeed : null}
          awayTeam={semiWinner}
          result={finalResult}
          disabled={!semiWinner}
          enablePenaltyShootout
          onScoreChange={(field, value) => onKnockoutChange('final', field, value)}
        />
      </div>
    </section>
  )
}

export default KnockoutPanel
