import { CalendarCheck, ListChecks, Shield, TimerReset } from 'lucide-react'

function LeagueStatStrip({ completedMatches, pendingMatches, teams, totalMatches }) {
  const stats = [
    { icon: Shield, label: 'Teams', value: teams.length },
    { icon: ListChecks, label: 'Total Matches', value: totalMatches },
    { icon: CalendarCheck, label: 'Finished', value: completedMatches },
    { icon: TimerReset, label: 'Pending', value: pendingMatches },
  ]

  return (
    <section className="league-stat-strip" aria-label="League summary">
      {stats.map((stat) => {
        const Icon = stat.icon

        return (
          <div className="league-stat" key={stat.label}>
            <Icon size={20} />
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        )
      })}
    </section>
  )
}

export default LeagueStatStrip
