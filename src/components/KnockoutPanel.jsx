import MatchEditor from './MatchEditor'

function KnockoutPanel({
  groupComplete,
  groupAFirst,
  groupASecond,
  groupBFirst,
  groupBSecond,
  semiAResult,
  semiBResult,
  finalResult,
  semiAWinner,
  semiBWinner,
  champion,
  onKnockoutChange,
}) {
  const finalUnlocked = Boolean(semiAWinner && semiBWinner)

  return (
    <section className="panel knockout-panel">
      <div className="section-heading">
        <p>Knockout</p>
        <span>{champion ? 'Champion decided' : 'Playoff bracket'}</span>
      </div>

      <div className="knockout-grid">
        <MatchEditor
          title="Semi Final 1 - Group A #1 vs Group B #2"
          homeTeam={groupComplete ? groupAFirst : null}
          awayTeam={groupComplete ? groupBSecond : null}
          result={semiAResult}
          disabled={!groupComplete}
          enablePenaltyShootout
          onScoreChange={(field, value) => onKnockoutChange('semiA', field, value)}
        />

        <MatchEditor
          title="Semi Final 2 - Group B #1 vs Group A #2"
          homeTeam={groupComplete ? groupBFirst : null}
          awayTeam={groupComplete ? groupASecond : null}
          result={semiBResult}
          disabled={!groupComplete}
          enablePenaltyShootout
          onScoreChange={(field, value) => onKnockoutChange('semiB', field, value)}
        />

        <MatchEditor
          title="Final - Semi Winners"
          homeTeam={semiAWinner}
          awayTeam={semiBWinner}
          result={finalResult}
          disabled={!finalUnlocked}
          enablePenaltyShootout
          onScoreChange={(field, value) => onKnockoutChange('final', field, value)}
        />
      </div>
    </section>
  )
}

export default KnockoutPanel
