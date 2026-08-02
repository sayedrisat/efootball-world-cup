import { ArrowDownWideNarrow, CalendarDays, Goal, Medal, Swords, Trophy } from 'lucide-react'

const pointRules = [
  { example: 'Team A 3 - 1 Team B', label: 'Win', points: '+3 pts' },
  { example: 'Team A 2 - 2 Team B', label: 'Draw', points: '+1 pt each' },
  { example: 'Team A 0 - 1 Team B', label: 'Loss', points: '+0 pts' },
]

const tieBreakers = [
  'Most points',
  'Best goal difference (+Goal / GD)',
  'Most goals scored (GF)',
  'Most wins',
  'Head-to-head points',
  'Head-to-head goal difference',
  'Head-to-head goals scored',
  'Team name A-Z',
]

function LeagueRulesPage() {
  return (
    <div className="rules-page">
      <header className="rules-hero">
        <span className="league-kicker">
          <Medal size={16} />
          League System Guide
        </span>
        <h1>Match Rules & Ranking Map</h1>
        <p>
          Add any number of teams. The app creates two matches for every pair: one home match and one away match.
          When all scores are added, the team ranked #1 becomes champion.
        </p>
      </header>

      <section className="rules-grid">
        <article className="rule-card">
          <Swords size={28} />
          <h2>Fixture Format</h2>
          <p>Every team plays every other team twice. Example: France vs England and England vs France.</p>
        </article>

        <article className="rule-card">
          <CalendarDays size={28} />
          <h2>Match Count</h2>
          <p>If you add N teams, total matches will be N x (N - 1). Four teams means 12 matches.</p>
        </article>

        <article className="rule-card">
          <Goal size={28} />
          <h2>Live Stats</h2>
          <p>The table updates played, home, away, win, draw, loss, GF, GA, +Goal and points instantly.</p>
        </article>

        <article className="rule-card">
          <Trophy size={28} />
          <h2>Champion</h2>
          <p>After every fixture has a score, the #1 team in the table is locked as champion.</p>
        </article>
      </section>

      <section className="league-card rules-panel">
        <div className="league-section-title">
          <div>
            <span>Points Mapping</span>
            <h2>How Scores Become Points</h2>
          </div>
          <ArrowDownWideNarrow size={22} />
        </div>

        <div className="points-map">
          {pointRules.map((rule) => (
            <article className="point-map-card" key={rule.label}>
              <span>{rule.label}</span>
              <strong>{rule.example}</strong>
              <em>{rule.points}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="league-card rules-panel">
        <div className="league-section-title">
          <div>
            <span>Tie Rules</span>
            <h2>If Points Are Equal</h2>
          </div>
          <Medal size={22} />
        </div>

        <div className="tie-breaker-list">
          {tieBreakers.map((rule, index) => (
            <div className="tie-breaker-row" key={rule}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{rule}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default LeagueRulesPage
