import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import gsap from 'gsap'
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Crown,
  Eye,
  EyeOff,
  GitBranch,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  Maximize2,
  Menu,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { useSupabaseAuth } from './hooks/useSupabaseAuth'
import { useTournament } from './hooks/useTournament'
import type { Group, KnockoutMatch, Match, RoundRobinMatch, Standing, Team } from './types'
import { normalizeScheduledAt, standings } from './utils/tournament'
import Roadmap from './components/Roadmap'

const fallback = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=102a54&color=45d7ff&bold=true&size=256`

function Logo({ team, small = false }: { team?: Team; small?: boolean }) {
  const [bad, setBad] = useState(false)

  useEffect(() => setBad(false), [team?.imageUrl])

  return (
    <img
      className={`team-logo ${small ? 'small' : ''}`}
      src={!bad && team?.imageUrl ? team.imageUrl : fallback(team?.name || '?')}
      alt={team ? `${team.name} logo` : ''}
      onError={() => setBad(true)}
    />
  )
}

function Stars({ count = 0 }: { count?: number }) {
  return count ? (
    <span className="stars" aria-label={`${count} championships`}>
      {'★'.repeat(count)}
    </span>
  ) : null
}

function PageReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const context = gsap.context(
      () => gsap.from('[data-reveal]', { y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }),
      ref,
    )
    return () => context.revert()
  }, [])

  return <div ref={ref} className={className}>{children}</div>
}

const liveLabels: Record<string, string> = {
  connecting: 'CONNECTING',
  live: 'LIVE',
  local: 'LOCAL',
  polling: 'UPDATING',
  offline: 'OFFLINE',
}

function Navigation({ liveStatus }: { liveStatus: string }) {
  const [open, setOpen] = useState(false)
  const links = [
    ['/', 'Home'],
    ['/rankings', 'Rankings'],
    ['/teams', 'Teams'],
    ['/groups', 'Groups'],
    ['/roadmap', 'Roadmap'],
    ['/matches', 'Matches'],
    ['/knockout', 'Knockout'],
    ['/history', 'History'],
  ]

  return (
    <header className="nav">
      <NavLink className="brand" to="/">
        <span><Trophy /></span>
        <strong>EFC</strong>
        <small>WORLD SERIES</small>
      </NavLink>
      <nav id="primary-navigation" className={open ? 'open' : ''}>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>
        ))}
      </nav>
      <div className={`live-pill live-pill--${liveStatus}`} role="status" aria-live="polite">
        <i /> <span>{liveLabels[liveStatus] || 'UPDATING'}</span>
      </div>
      <button
        className="menu"
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="primary-navigation"
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  )
}

function App() {
  const auth = useSupabaseAuth()
  const canEdit = Boolean(auth.isConfigured && auth.session && auth.isAdmin)
  const tournament = useTournament(canEdit, auth.session?.user?.id)

  return (
    <>
      <Navigation liveStatus={tournament.liveStatus} />
      <Routes>
        <Route path="/" element={<Home t={tournament} />} />
        <Route path="/rankings" element={<Rankings t={tournament} />} />
        <Route path="/teams" element={<Teams t={tournament} />} />
        <Route path="/groups" element={<Groups t={tournament} />} />
        <Route path="/roadmap" element={<Roadmap t={tournament} />} />
        <Route path="/matches" element={<MatchesPage t={tournament} />} />
        <Route path="/knockout" element={<KnockoutPage t={tournament} />} />
        <Route path="/history" element={<History t={tournament} />} />
        <Route path="/admin" element={<Admin auth={auth} t={tournament} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {tournament.message && (
        <div className="toast" role="status" aria-live="polite"><Check /> {tournament.message}</div>
      )}
    </>
  )
}

function Home({ t }: any) {
  const { state, stars, allStandings } = t
  const champion = state.history.at(-1)
  const hero = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const timeline = gsap.timeline()
      timeline
        .from('.eyebrow,.hero h1,.hero-copy', { y: 40, opacity: 0, stagger: 0.12, duration: 0.8 })
        .from('.cup-wrap', { scale: 0.6, opacity: 0, rotation: 8, duration: 1.1, ease: 'back.out(1.4)' }, '-=.5')
        .from('.metric', { y: 20, opacity: 0, stagger: 0.1 }, '-=.4')
    }, hero)
    return () => context.revert()
  }, [])

  return (
    <main ref={hero}>
      <section className="hero">
        <div>
          <p className="eyebrow"><span /> THE DIGITAL PITCH AWAITS</p>
          <h1>eFOOTBALL<br /><em>CHAMPIONSHIP</em></h1>
          <p className="hero-copy">Elite competitors. One digital arena. Every goal writes history.</p>
          <div className="actions">
            <NavLink className="button primary" to="/rankings">Live ranking <ChevronRight /></NavLink>
            <NavLink className="button ghost" to="/roadmap"><GitBranch /> Explore roadmap</NavLink>
          </div>
        </div>
        <div className="cup-wrap">
          <div className="orbit one" />
          <div className="orbit two" />
          <img src={`${import.meta.env.BASE_URL}efootball-cup.png`} alt="Championship trophy" />
          <div className="cup-label">
            SEASON {String(state.tournamentNumber).padStart(2, '0')}
            <strong>{state.status === 'completed' ? 'COMPLETE' : state.stage.toUpperCase()}</strong>
          </div>
        </div>
      </section>
      <section className="metric-strip">
        <div className="metric"><small>Current tournament</small><strong>#{String(state.tournamentNumber).padStart(2, '0')}</strong></div>
        <div className="metric"><small>Status</small><strong className="cyan">{state.status.toUpperCase()}</strong></div>
        <div className="metric"><small>Contenders</small><strong>{state.teams.length}</strong></div>
        <div className="metric"><small>Current leader</small><strong>{allStandings[0]?.name || 'TBD'}</strong></div>
      </section>
      <section className="section">
        <div className="section-head">
          <div><p className="eyebrow">LEGACY ARCHIVE</p><h2>Champions of the arena</h2></div>
          <NavLink to="/history">View full history <ChevronRight /></NavLink>
        </div>
        <div className="champion-preview">
          {state.history.slice(-5).reverse().map((item: any, index: number) => (
            <article key={item.id} className={index === 0 ? 'featured' : ''}>
              <span>TOURNAMENT {String(item.tournamentNumber).padStart(2, '0')}</span>
              <Crown />
              <h3>{item.winnerName}</h3>
              <Stars count={stars[item.winnerName.toLowerCase()]} />
            </article>
          ))}
        </div>
        {champion && <p className="broadcast"><i /> Reigning champion: <strong>{champion.winnerName}</strong></p>}
      </section>
    </main>
  )
}

function PageHead({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return <div className="page-head" data-reveal><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{text}</p></div>
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="empty">{icon}<h2>{title}</h2><p>{text}</p></div>
}

function RankingTable({
  rows,
  ariaLabel = 'Live tournament rankings',
  className = '',
}: {
  rows: Standing[];
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const context = gsap.context(
      () => gsap.from('.standing-row', { x: -28, opacity: 0, stagger: 0.06, duration: 0.55, ease: 'power2.out' }),
      ref,
    )
    return () => context.revert()
  }, [rows.length])

  return (
    <div className={`table-wrap ${className}`.trim()} ref={ref} role="table" aria-label={ariaLabel}>
      <div className="standing-row table-head" role="row"><span role="columnheader">#</span><span role="columnheader">Club</span><span role="columnheader">P</span><span className="standing-secondary" role="columnheader">W</span><span className="standing-secondary" role="columnheader">D</span><span className="standing-secondary" role="columnheader">L</span><span className="standing-secondary" role="columnheader">GF</span><span className="standing-secondary" role="columnheader">GA</span><span role="columnheader">GD</span><span role="columnheader">PTS</span></div>
      {rows.map((row) => (
        <div className={`standing-row rank-${row.position}`} key={row.id} role="row">
          <b role="cell">{String(row.position).padStart(2, '0')}</b>
          <span className="club" role="cell"><Logo team={row} small /><strong>{row.name}</strong></span>
          <span role="cell">{row.played}</span><span className="standing-secondary" role="cell">{row.wins}</span><span className="standing-secondary" role="cell">{row.draws}</span><span className="standing-secondary" role="cell">{row.losses}</span>
          <span className="standing-secondary" role="cell">{row.goalsFor}</span><span className="standing-secondary" role="cell">{row.goalsAgainst}</span>
          <span role="cell">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</span>
          <strong role="cell">{row.points}</strong>
        </div>
      ))}
    </div>
  )
}

function Rankings({ t }: any) {
  return (
    <PageReveal className="page">
      <PageHead kicker="LIVE INTELLIGENCE" title="Tournament rankings" text="Live standings updated from every confirmed group-stage result." />
      {t.state.teams.length
        ? <RankingTable rows={t.allStandings} />
        : <Empty icon={<BarChart3 />} title="The table is waiting" text="Registered teams will appear here before the first whistle." />}
    </PageReveal>
  )
}

function TeamGrid({ t, manage = false }: { t: any; manage?: boolean }) {
  return (
    <div className={`team-grid ${manage ? 'manage' : ''}`}>
      {t.state.teams.map((team: Team, index: number) => (
        <article className="team-card" data-reveal key={team.id}>
          <span className="seed">{String(index + 1).padStart(2, '0')}</span>
          <Logo team={team} />
          <div>
            <h3>{team.name}</h3>
            <Stars count={t.stars[team.name.toLowerCase()]} />
            <p>{t.stars[team.name.toLowerCase()] || 0}× champion</p>
          </div>
          {manage && t.state.status === 'registration' && (
            <button className="icon danger" type="button" aria-label={`Delete ${team.name}`} onClick={() => t.deleteTeam(team.id)}><X /></button>
          )}
        </article>
      ))}
    </div>
  )
}

function Teams({ t }: any) {
  return (
    <PageReveal className="page">
      <PageHead kicker="GLOBAL CONTENDERS" title="Registered teams" text={`${t.state.teams.length} teams are ready to compete in Tournament #${String(t.state.tournamentNumber).padStart(2, '0')}.`} />
      {t.state.teams.length
        ? <TeamGrid t={t} />
        : <Empty icon={<Users />} title="No contenders yet" text="Teams will appear here once an administrator registers them." />}
    </PageReveal>
  )
}

function GroupCard({ group, t }: { group: Group; t: any }) {
  const rows = standings(
    t.state.teams,
    t.state.matches.filter((match: Match) => match.groupId === group.id),
    group.teamIds,
  )

  return (
    <article className="group-card" data-reveal>
      <header><span>{group.name}</span><small>{group.teamIds.length} TEAMS</small></header>
      <div className="mini-head"><span>Team</span><span>P</span><span>GD</span><span>Pts</span></div>
      {rows.map((row) => (
        <div className="mini-row" key={row.id}>
          <span className="club"><Logo team={row} small /><strong>{row.name}</strong></span>
          <span>{row.played}</span><span>{row.goalDifference}</span><b>{row.points}</b>
        </div>
      ))}
    </article>
  )
}

function Groups({ t }: any) {
  return (
    <PageReveal className="page">
      <PageHead kicker="THE DRAW" title="Tournament groups" text="Balanced groups, securely randomized and ranked live." />
      {t.state.groups.length
        ? <div className="groups-grid">{t.state.groups.map((group: Group) => <GroupCard key={group.id} group={group} t={t} />)}</div>
        : <Empty icon={<LayoutGrid />} title="Draw not completed" text="Groups will be revealed here when the administrator starts the tournament." />}
    </PageReveal>
  )
}

type MatchFilter = 'all' | 'pending' | 'finished'

const matchFilters: Array<{ label: string; value: MatchFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Upcoming', value: 'pending' },
  { label: 'Finished', value: 'finished' },
]

const matchIsFinished = (match: Match) => match.homeScore !== null && match.awayScore !== null

const matchDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function matchScheduleParts(value: string | null) {
  const scheduledAt = normalizeScheduledAt(value)
  if (!scheduledAt) return null

  const [datePart, timePart] = scheduledAt.split('T')
  const [hourText, minute] = timePart.split(':')
  const hour = Number(hourText)
  return {
    scheduledAt,
    date: matchDateFormatter.format(new Date(`${datePart}T00:00:00.000Z`)).toUpperCase(),
    time: `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'} BDT`,
  }
}

function GroupMatches({ t, admin, filter = 'all' }: { t: any; admin: boolean; filter?: MatchFilter }) {
  const teamsById = Object.fromEntries(t.state.teams.map((team: Team) => [team.id, team])) as Record<string, Team>
  const scoresLocked = !t.hydrated || !t.canEditGroupMatches
  const visibleMatches = t.state.matches.filter((match: Match) => {
    if (filter === 'pending') return !matchIsFinished(match)
    if (filter === 'finished') return matchIsFinished(match)
    return true
  })

  if (!t.state.matches.length) {
    return <Empty icon={<CalendarDays />} title="No fixtures yet" text="Fixtures are generated automatically with the group draw." />
  }

  if (!visibleMatches.length) {
    return <Empty icon={<CalendarDays />} title={`No ${filter} matches`} text="Choose another match filter to see the fixture board." />
  }

  return (
    <div className={`fixture-board ${admin ? 'fixture-board--admin' : 'fixture-board--public'}`}>
      {t.state.groups.map((group: Group) => {
        const groupMatches = visibleMatches.filter((match: Match) => match.groupId === group.id)
        if (!groupMatches.length) return null
        const allGroupMatches = t.state.matches.filter((match: Match) => match.groupId === group.id)
        const completed = allGroupMatches.filter(matchIsFinished).length

        return (
          <section className="fixture-group" key={group.id} data-reveal>
            <header className="fixture-group-head">
              <div><small>FIXTURE BOARD</small><strong>{group.name}</strong></div>
              <span><b>{completed}</b> / {allGroupMatches.length} PLAYED</span>
            </header>
            <div className={`matches-list ${admin ? 'admin-match-list' : 'group-match-grid'}`}>
              {groupMatches.map((match: Match, index: number) => {
                const home = teamsById[match.homeId]
                const away = teamsById[match.awayId]
                const finished = matchIsFinished(match)
                const matchNumber = allGroupMatches.findIndex((item: Match) => item.id === match.id) + 1
                const schedule = matchScheduleParts(match.scheduledAt)

                return (
                  <article className={`match-card fixture-card ${admin ? 'admin-match' : 'public-match'} ${finished ? 'is-finished' : 'is-pending'}`} key={match.id}>
                    <div className="match-meta">
                      <span className="match-group">{group.name}</span>
                      <span className="match-number">MATCH {String(matchNumber || index + 1).padStart(2, '0')}</span>
                      <span className="match-state">{finished ? 'FT' : 'NEXT'}</span>
                      <div className={`match-schedule ${admin ? 'match-schedule--editor' : ''}`}>
                        {admin ? (
                          <label>
                            <span><CalendarDays /> DATE & TIME <b>BDT</b></span>
                            <input
                              aria-label={`Schedule ${home?.name} versus ${away?.name}`}
                              type="datetime-local"
                              step="60"
                              disabled={scoresLocked}
                              value={match.scheduledAt ?? ''}
                              onChange={(event) => t.scheduleMatch(match.id, event.target.value || null)}
                            />
                          </label>
                        ) : schedule ? (
                          <time dateTime={`${schedule.scheduledAt}:00+06:00`} aria-label={`${schedule.date} at ${schedule.time}`}>
                            <CalendarDays /><span>{schedule.date}</span><strong>{schedule.time}</strong>
                          </time>
                        ) : (
                          <span className="match-schedule--unset"><CalendarDays /> DATE & TIME TBA</span>
                        )}
                      </div>
                    </div>
                    <div className="match-team"><Logo team={home} small /><strong>{home?.name}</strong></div>
                    {admin ? (
                      <div className="score-edit">
                        <input
                          aria-label={`${home?.name} score`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="99"
                          disabled={scoresLocked}
                          value={match.homeScore ?? ''}
                          onChange={(event) => t.score(match.id, event.target.value === '' ? null : Number(event.target.value), match.awayScore)}
                        />
                        <i>—</i>
                        <input
                          aria-label={`${away?.name} score`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="99"
                          disabled={scoresLocked}
                          value={match.awayScore ?? ''}
                          onChange={(event) => t.score(match.id, match.homeScore, event.target.value === '' ? null : Number(event.target.value))}
                        />
                      </div>
                    ) : (
                      <strong className="score" aria-label={finished ? `${home?.name} ${match.homeScore}, ${away?.name} ${match.awayScore}` : `${home?.name} versus ${away?.name}`}>
                        {match.homeScore ?? '–'} <i>:</i> {match.awayScore ?? '–'}
                      </strong>
                    )}
                    <div className="match-team away"><strong>{away?.name}</strong><Logo team={away} small /></div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function MatchesPage({ t }: any) {
  const [filter, setFilter] = useState<MatchFilter>('all')
  const [captureMode, setCaptureMode] = useState(() => new URLSearchParams(window.location.search).get('view') === 'capture')
  const finished = t.state.matches.filter(matchIsFinished).length
  const pending = t.state.matches.length - finished

  useEffect(() => {
    document.body.classList.toggle('match-capture-active', captureMode)
    if (captureMode) window.scrollTo(0, 0)
    return () => document.body.classList.remove('match-capture-active')
  }, [captureMode])

  const filterCount = (value: MatchFilter) => {
    if (value === 'finished') return finished
    if (value === 'pending') return pending
    return t.state.matches.length
  }

  return (
    <PageReveal className={`page matches-page ${captureMode ? 'match-capture-view' : ''}`}>
      {captureMode ? (
        <header className="capture-header">
          <div className="capture-brand"><Trophy /><div><strong>EFC WORLD SERIES</strong><span>OFFICIAL MATCH BOARD</span></div></div>
          <div className="capture-tournament"><span>TOURNAMENT</span><strong>#{String(t.state.tournamentNumber).padStart(2, '0')}</strong></div>
          <button type="button" onClick={() => setCaptureMode(false)} aria-label="Exit screenshot view"><X /></button>
        </header>
      ) : (
        <PageHead kicker="MATCH CENTRE" title="Group fixtures & results" text="Every group-stage contest in one live match feed." />
      )}
      <div className="matches-toolbar" aria-label="Match view controls">
        <div className="match-filter-tabs">
          {matchFilters.map((item) => (
            <button
              className={filter === item.value ? 'active' : ''}
              type="button"
              key={item.value}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}<span>{filterCount(item.value)}</span>
            </button>
          ))}
        </div>
        <button className="button ghost screenshot-button" type="button" onClick={() => setCaptureMode(true)} disabled={!t.state.matches.length}>
          <Maximize2 /> Screenshot view
        </button>
      </div>
      <GroupMatches t={t} admin={false} filter={filter} />
    </PageReveal>
  )
}

function roundName(round: number | null) {
  if (round === 2) return 'Final'
  if (round === 4) return 'Semi Finals'
  if (round === 8) return 'Quarter Finals'
  return round ? `Round of ${round}` : 'Knockout'
}

function scoreValue(value: string) {
  return value === '' ? null : Number(value)
}

function KnockoutMatchCard({
  match,
  t,
  admin,
  matchLabel,
  editableOverride,
  winnerText,
}: {
  match: KnockoutMatch;
  t: any;
  admin: boolean;
  matchLabel?: string;
  editableOverride?: boolean;
  winnerText?: (winner: Team) => string;
}) {
  const teamsById = Object.fromEntries(t.state.teams.map((team: Team) => [team.id, team])) as Record<string, Team>
  const home = match.homeId ? teamsById[match.homeId] : undefined
  const away = match.awayId ? teamsById[match.awayId] : undefined
  const isBye = !match.homeId || !match.awayId
  const stageIsEditable = editableOverride
    ?? (t.state.status === 'knockout' && t.activeKnockoutRound === match.round)
  const editable = admin && t.hydrated && stageIsEditable && !isBye
  const needsPenalties = match.homeScore !== null && match.awayScore !== null && match.homeScore === match.awayScore
  const winner = match.winnerId ? teamsById[match.winnerId] : undefined

  const update = (field: keyof Pick<KnockoutMatch, 'homeScore' | 'awayScore' | 'homePenaltyScore' | 'awayPenaltyScore'>, value: string) => {
    const next = {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homePenaltyScore: match.homePenaltyScore,
      awayPenaltyScore: match.awayPenaltyScore,
      [field]: scoreValue(value),
    }
    t.knockoutScore(match.id, next.homeScore, next.awayScore, next.homePenaltyScore, next.awayPenaltyScore)
  }

  return (
    <article className={`match-card knockout-match ${admin ? 'admin-match' : 'public-match'} ${winner ? 'decided' : ''}`}>
      <span className="match-group">{matchLabel || `Match ${match.order}`}</span>
      <div className={`match-team ${winner?.id === home?.id ? 'winner' : ''}`}>
        <Logo team={home} small />
        <strong>{home?.name || 'BYE'}</strong>
      </div>
      {admin && !isBye ? (
        <div className="score-edit">
          <input aria-label={`${home?.name} score`} type="number" min="0" max="99" disabled={!editable} value={match.homeScore ?? ''} onChange={(event) => update('homeScore', event.target.value)} />
          <i>—</i>
          <input aria-label={`${away?.name} score`} type="number" min="0" max="99" disabled={!editable} value={match.awayScore ?? ''} onChange={(event) => update('awayScore', event.target.value)} />
        </div>
      ) : isBye ? (
        <strong className="score bye-label">BYE</strong>
      ) : (
        <strong className="score">{match.homeScore ?? '–'} <i>:</i> {match.awayScore ?? '–'}</strong>
      )}
      <div className={`match-team away ${winner?.id === away?.id ? 'winner' : ''}`}>
        <strong>{away?.name || 'BYE'}</strong>
        <Logo team={away} small />
      </div>
      {needsPenalties && !isBye && (
        <div className="penalty-row">
          <span>Penalty shoot-out</span>
          {admin ? (
            <div className="score-edit">
              <input aria-label={`${home?.name} penalty score`} type="number" min="0" max="99" disabled={!editable} value={match.homePenaltyScore ?? ''} onChange={(event) => update('homePenaltyScore', event.target.value)} />
              <i>—</i>
              <input aria-label={`${away?.name} penalty score`} type="number" min="0" max="99" disabled={!editable} value={match.awayPenaltyScore ?? ''} onChange={(event) => update('awayPenaltyScore', event.target.value)} />
            </div>
          ) : (
            <strong>{match.homePenaltyScore ?? '–'} : {match.awayPenaltyScore ?? '–'}</strong>
          )}
        </div>
      )}
      {winner && <div className="winner-chip"><Check /> {winnerText ? winnerText(winner) : match.round === 2 ? `${winner.name} wins the final` : `${winner.name} advances`}</div>}
    </article>
  )
}

function KnockoutMatches({ t, admin }: { t: any; admin: boolean }) {
  if (!t.state.knockoutMatches.length) {
    return <Empty icon={<GitBranch />} title="Bracket locked" text="Complete every group match before the knockout bracket can begin." />
  }

  const currentRound = t.state.status === 'knockout' ? t.activeKnockoutRound : null
  const rounds = [...new Set<number>(
    t.state.knockoutMatches.map((match: KnockoutMatch) => match.round),
  )].sort((a, b) => b - a)

  return (
    <div className="knockout-rounds">
      {rounds.map((round) => (
        <section className={`knockout-round ${currentRound === round ? 'active' : ''}`} key={round} data-reveal>
          <header><span>{roundName(round)}</span><small>{currentRound === round ? 'CURRENT ROUND' : 'BRACKET'}</small></header>
          <div className="matches-list">
            {t.state.knockoutMatches
              .filter((match: KnockoutMatch) => match.round === round)
              .sort((a: KnockoutMatch, b: KnockoutMatch) => a.order - b.order)
              .map((match: KnockoutMatch) => <KnockoutMatchCard key={match.id} match={match} t={t} admin={admin} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

type QualificationEntry = {
  team: Team;
  groupName: string;
  groupPosition: number;
}

type RoundRobinStageMatch = RoundRobinMatch & { order?: number }

type ChampionshipStageTone = 'complete' | 'active' | 'locked'

function ChampionshipStage({
  step,
  kicker,
  title,
  text,
  status,
  tone,
  children,
}: {
  step: string;
  kicker: string;
  title: string;
  text: string;
  status: string;
  tone: ChampionshipStageTone;
  children: ReactNode;
}) {
  return (
    <section className={`championship-stage stage-${tone}`} data-reveal>
      <header className="championship-stage-head">
        <span className="championship-step">{step}</span>
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <span className={`championship-status status-${tone}`}>{status}</span>
      </header>
      <div className="championship-stage-body">{children}</div>
    </section>
  )
}

function ChampionshipConnector() {
  return <div className="championship-connector" aria-hidden="true"><ChevronRight /></div>
}

function LockedStage({ text }: { text: string }) {
  return <div className="stage-locked"><LockKeyhole /><span>{text}</span></div>
}

function QualifiedTeams({ entries }: { entries: QualificationEntry[] }) {
  return (
    <div className="qualified-team-grid" role="list" aria-label="Six teams qualified from the group stage">
      {entries.map((entry, index) => (
        <article className="qualified-team-card" role="listitem" key={entry.team.id}>
          <span className="qualified-seed">Q{index + 1}</span>
          <Logo team={entry.team} />
          <div>
            <small>{entry.groupName} · #{entry.groupPosition}</small>
            <strong>{entry.team.name}</strong>
            <span>QUALIFIED</span>
          </div>
          <Check />
        </article>
      ))}
    </div>
  )
}

const roundRobinMatchIsFinished = (match: RoundRobinStageMatch) =>
  match.homeScore !== null && match.awayScore !== null

function RoundRobinMatchCard({
  match,
  index,
  t,
  admin,
}: {
  match: RoundRobinStageMatch;
  index: number;
  t: any;
  admin: boolean;
}) {
  const teamsById = Object.fromEntries(t.state.teams.map((team: Team) => [team.id, team])) as Record<string, Team>
  const home = teamsById[match.homeId]
  const away = teamsById[match.awayId]
  const finished = roundRobinMatchIsFinished(match)
  const editable = Boolean(admin && t.hydrated && t.canEditKnockoutStageMatches)

  return (
    <article className={`match-card round-robin-match ${admin ? 'admin-match' : 'public-match'} ${finished ? 'is-finished' : 'is-pending'}`} role="listitem">
      <div className="round-robin-match-meta">
        <span>MATCH {String(match.order ?? index + 1).padStart(2, '0')}</span>
        <small>{finished ? 'FT' : 'NEXT'}</small>
      </div>
      <div className="match-team"><Logo team={home} small /><strong>{home?.name || 'TBD'}</strong></div>
      {admin ? (
        <div className="score-edit">
          <input
            aria-label={`${home?.name || 'Home team'} score`}
            type="number"
            inputMode="numeric"
            min="0"
            max="99"
            disabled={!editable}
            value={match.homeScore ?? ''}
            onChange={(event) => t.knockoutStageScore(match.id, scoreValue(event.target.value), match.awayScore)}
          />
          <i>—</i>
          <input
            aria-label={`${away?.name || 'Away team'} score`}
            type="number"
            inputMode="numeric"
            min="0"
            max="99"
            disabled={!editable}
            value={match.awayScore ?? ''}
            onChange={(event) => t.knockoutStageScore(match.id, match.homeScore, scoreValue(event.target.value))}
          />
        </div>
      ) : (
        <strong className="score" aria-label={finished ? `${home?.name} ${match.homeScore}, ${away?.name} ${match.awayScore}` : `${home?.name} versus ${away?.name}`}>
          {match.homeScore ?? '–'} <i>:</i> {match.awayScore ?? '–'}
        </strong>
      )}
      <div className="match-team away"><strong>{away?.name || 'TBD'}</strong><Logo team={away} small /></div>
    </article>
  )
}

function RoundRobinMatches({ t, admin }: { t: any; admin: boolean }) {
  const matches = (t.knockoutStageMatches ?? []) as RoundRobinStageMatch[]
  const completed = Number.isInteger(t.completedKnockoutStageMatches)
    ? t.completedKnockoutStageMatches
    : matches.filter(roundRobinMatchIsFinished).length

  return (
    <>
      <div className="round-robin-summary">
        <span><b>{completed}</b> / 15 PLAYED</span>
        <span>6 TEAMS</span>
        <span>5 MATCHES EACH</span>
        <span>EVERY PAIR ONCE</span>
      </div>
      <div className="round-robin-grid" role="list" aria-label="Knockout stage round-robin fixtures">
        {[...matches]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((match, index) => <RoundRobinMatchCard key={match.id} match={match} index={index} t={t} admin={admin} />)}
      </div>
    </>
  )
}

const playoffStageDetails = [
  {
    key: 'semifinal-1',
    step: '05',
    kicker: 'TOP TWO SHOWDOWN',
    title: 'Semifinal 1',
    text: 'Knockout rank #1 faces rank #2. The winner goes directly to the Grand Final; the loser moves to Semifinal 2.',
    lockedText: 'Waiting for the final knockout standings to assign ranks #1 and #2.',
    winnerText: (winner: Team) => `${winner.name} reaches the Grand Final`,
  },
  {
    key: 'spot-semifinal',
    step: '06',
    kicker: 'LAST-CHANCE PATH',
    title: 'Spot Semifinal',
    text: 'Knockout rank #3 faces rank #4. The winner moves to Semifinal 2; the loser is eliminated.',
    lockedText: 'Waiting for the final knockout standings to assign ranks #3 and #4.',
    winnerText: (winner: Team) => `${winner.name} reaches Semifinal 2`,
  },
  {
    key: 'semifinal-2',
    step: '07',
    kicker: 'FINAL QUALIFIER',
    title: 'Semifinal 2',
    text: 'The loser of Semifinal 1 faces the winner of the Spot Semifinal for the remaining Grand Final place.',
    lockedText: 'Waiting for the Semifinal 1 loser and Spot Semifinal winner.',
    winnerText: (winner: Team) => `${winner.name} reaches the Grand Final`,
  },
  {
    key: 'grand-final',
    step: '08',
    kicker: 'TITLE MATCH',
    title: 'Grand Final',
    text: 'The winner of Semifinal 1 faces the winner of Semifinal 2 for the championship.',
    lockedText: 'Waiting for both Grand Finalists to be decided.',
    winnerText: (winner: Team) => `${winner.name} wins the Grand Final`,
  },
] as const

function NamedPlayoffStage({
  details,
  match,
  t,
  admin,
}: {
  details: (typeof playoffStageDetails)[number];
  match: KnockoutMatch | null;
  t: any;
  admin: boolean;
}) {
  const decided = Boolean(match?.winnerId)
  const tone: ChampionshipStageTone = decided ? 'complete' : match ? 'active' : 'locked'
  const status = decided ? 'DECIDED' : match ? 'READY' : 'LOCKED'

  return (
    <ChampionshipStage
      step={details.step}
      kicker={details.kicker}
      title={details.title}
      text={details.text}
      status={status}
      tone={tone}
    >
      {match ? (
        <div className="playoff-match-shell">
          <KnockoutMatchCard
            match={match}
            t={t}
            admin={admin}
            matchLabel={details.title}
            editableOverride={Boolean(t.isKnockoutMatchEditable?.(match))}
            winnerText={details.winnerText}
          />
        </div>
      ) : <LockedStage text={details.lockedText} />}
    </ChampionshipStage>
  )
}

function SixTeamChampionshipFlow({ t, admin }: { t: any; admin: boolean }) {
  const qualificationEntries = (t.qualificationEntries ?? []) as QualificationEntry[]
  const roundRobinMatches = (t.knockoutStageMatches ?? []) as RoundRobinStageMatch[]
  const knockoutRows = (t.knockoutStandings ?? []) as Standing[]
  const completedRoundRobin = Number.isInteger(t.completedKnockoutStageMatches)
    ? t.completedKnockoutStageMatches
    : roundRobinMatches.filter(roundRobinMatchIsFinished).length
  const playoffMatches = (t.playoffMatches ?? {}) as Record<(typeof playoffStageDetails)[number]['key'], KnockoutMatch | null>
  const qualificationComplete = qualificationEntries.length === 6
  const roundRobinStarted = roundRobinMatches.length > 0
  const standingsVisible = knockoutRows.length === 6 && roundRobinStarted
  const champion = t.champion as Team | null

  return (
    <div className={`championship-flow ${admin ? 'championship-flow--admin' : 'championship-flow--public'}`}>
      <ChampionshipStage
        step="01"
        kicker="GROUP STAGE"
        title="Group A & Group B"
        text="The existing group-stage results and ranking rules determine the three qualifiers from each group."
        status={t.groupComplete ? 'COMPLETE' : 'IN PROGRESS'}
        tone={t.groupComplete ? 'complete' : 'active'}
      >
        {t.state.groups.length
          ? <div className="groups-grid championship-groups">{t.state.groups.map((group: Group) => <GroupCard key={group.id} group={group} t={t} />)}</div>
          : <LockedStage text="The group draw has not been completed yet." />}
      </ChampionshipStage>

      <ChampionshipConnector />

      <ChampionshipStage
        step="02"
        kicker="QUALIFICATION"
        title="Qualified Teams"
        text="The final top three from Group A and the final top three from Group B form the six-team field."
        status={qualificationComplete ? '6 QUALIFIED' : t.groupComplete ? 'FINALIZING' : 'LOCKED'}
        tone={qualificationComplete ? 'complete' : t.groupComplete ? 'active' : 'locked'}
      >
        {qualificationComplete
          ? <QualifiedTeams entries={qualificationEntries} />
          : <LockedStage text="All fixtures in both groups must be completed before qualification is finalized." />}
      </ChampionshipStage>

      <ChampionshipConnector />

      <ChampionshipStage
        step="03"
        kicker="KNOCKOUT STAGE"
        title="Six-Team Round Robin"
        text="Every qualified team plays every other qualified team exactly once: five matches per team and 15 unique fixtures in total. Draws stand as final results."
        status={t.knockoutStageComplete ? '15 / 15 COMPLETE' : roundRobinStarted ? `${completedRoundRobin} / 15 PLAYED` : 'LOCKED'}
        tone={t.knockoutStageComplete ? 'complete' : roundRobinStarted ? 'active' : 'locked'}
      >
        {roundRobinStarted
          ? <RoundRobinMatches t={t} admin={admin} />
          : <LockedStage text="The 15 fixtures are generated automatically after all six qualified teams are confirmed." />}
      </ChampionshipStage>

      <ChampionshipConnector />

      <ChampionshipStage
        step="04"
        kicker="KNOCKOUT STANDINGS"
        title="Road to the Playoffs"
        text="Only results from the 15-match knockout round robin count here. Group-stage positions do not carry over."
        status={t.knockoutStageComplete ? 'FINAL' : standingsVisible ? 'LIVE' : 'LOCKED'}
        tone={t.knockoutStageComplete ? 'complete' : standingsVisible ? 'active' : 'locked'}
      >
        {standingsVisible ? (
          <>
            <RankingTable rows={knockoutRows} ariaLabel="Knockout stage standings" className="knockout-standings-table" />
            <div className="standings-pathway" aria-label="Knockout standings qualification paths">
              <span><b>#1–#2</b> SEMIFINAL 1</span>
              <span><b>#3–#4</b> SPOT SEMIFINAL</span>
              <span className="eliminated"><b>#5–#6</b> ELIMINATED</span>
            </div>
          </>
        ) : <LockedStage text="Knockout standings appear when the six-team round robin begins." />}
      </ChampionshipStage>

      {playoffStageDetails.map((details) => (
        <div className="championship-playoff-step" key={details.key}>
          <ChampionshipConnector />
          <NamedPlayoffStage details={details} match={playoffMatches[details.key] ?? null} t={t} admin={admin} />
        </div>
      ))}

      <ChampionshipConnector />

      <ChampionshipStage
        step="09"
        kicker="TOURNAMENT CHAMPION"
        title="Champion"
        text="The Grand Final winner is recorded as the sole champion of this tournament."
        status={champion ? 'CROWNED' : 'WAITING'}
        tone={champion ? 'complete' : 'locked'}
      >
        {champion ? (
          <article className="champion-spotlight">
            <Crown />
            <Logo team={champion} />
            <div><small>🏆 TOURNAMENT CHAMPION</small><strong>{champion.name}</strong></div>
            <Trophy />
          </article>
        ) : <LockedStage text="The champion will be crowned automatically when the Grand Final has a winner." />}
      </ChampionshipStage>
    </div>
  )
}

function KnockoutPage({ t }: any) {
  return (
    <PageReveal className="page">
      <PageHead
        kicker="ROAD TO GLORY"
        title={t.isSixTeamChampionship ? 'Qualification & knockout' : 'Knockout bracket'}
        text={t.isSixTeamChampionship
          ? 'Follow the six qualifiers through the 15-match knockout stage, playoff path, Grand Final and championship.'
          : 'Qualifiers advance round by round. Drawn matches are decided by penalties.'}
      />
      {t.isSixTeamChampionship
        ? <SixTeamChampionshipFlow t={t} admin={false} />
        : <KnockoutMatches t={t} admin={false} />}
    </PageReveal>
  )
}

function History({ t }: any) {
  return (
    <PageReveal className="page">
      <PageHead kicker="HALL OF CHAMPIONS" title="Tournament history" text="Every title. Every champion. One growing legacy." />
      <div className="history-list">
        {[...t.state.history].reverse().map((item: any, index: number) => (
          <article data-reveal className={index === 0 ? 'current' : ''} key={item.id}>
            <span>#{String(item.tournamentNumber).padStart(2, '0')}</span>
            <div><small>CHAMPION</small><h2>{item.winnerName} <Stars count={t.stars[item.winnerName.toLowerCase()]} /></h2></div>
            <Crown />
          </article>
        ))}
      </div>
    </PageReveal>
  )
}

function normalizeImageUrl(rawUrl: string) {
  const trimmed = rawUrl.trim()
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(candidate)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use a valid http:// or https:// image link.')
  return parsed.toString()
}

function AddTeamModal({ close, add }: { close: () => void; add: (name: string, imageUrl: string) => boolean }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLFormElement>(null)

  useLayoutEffect(() => {
    gsap.from(ref.current, { opacity: 0, scale: 0.92, duration: 0.3 })
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!name.trim() || !url.trim()) {
      setError('Team name and logo URL are required.')
      return
    }

    try {
      const accepted = add(name.trim(), normalizeImageUrl(url))
      if (accepted) close()
      else setError('The team was not added. Check the message and try again.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enter a valid logo image URL.')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form ref={ref} className="modal" onSubmit={submit}>
        <header>
          <div><small>TEAM REGISTRY</small><h2>Add contender</h2></div>
          <button type="button" className="icon" onClick={close} aria-label="Close add team form"><X /></button>
        </header>
        <div className="image-preview"><Logo team={{ id: '', name: name || 'New team', imageUrl: url, createdAt: '' }} /></div>
        <label>Team name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. England" /></label>
        <label>Logo image URL<input required type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/team.png" /></label>
        {error && <p className="form-error" role="alert"><CircleAlert /> {error}</p>}
        <footer>
          <button type="button" className="button ghost" onClick={close}>Cancel</button>
          <button type="submit" className="button primary">Add team</button>
        </footer>
      </form>
    </div>
  )
}

function DrawOverlay({ state, done }: { state: any; done: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const doneRef = useRef(done)
  const [counter, setCounter] = useState(0)
  doneRef.current = done

  useLayoutEffect(() => {
    const ticker = window.setInterval(() => setCounter((value) => value + 1), 90)
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ onComplete: () => { window.clearInterval(ticker); doneRef.current() } })
      timeline
        .from('.draw-title', { scale: 0.7, opacity: 0, duration: 0.55 })
        .to('.draw-scan', { x: '200vw', duration: 1.4, ease: 'none' }, 0)
        .from('.draw-group', { y: 60, opacity: 0, stagger: 0.15, duration: 0.65 }, 0.55)
        .to('.shuffle-name', { opacity: 0.3, yoyo: true, repeat: 5, duration: 0.18 }, 1)
        .to('.draw-title', { textContent: 'GROUPS CONFIRMED', color: '#49e7ff', duration: 0.2 }, 3.1)
        .to(ref.current, { opacity: 0, duration: 0.45 }, 3.55)
    }, ref)
    return () => { window.clearInterval(ticker); context.revert() }
  }, [])

  return (
    <div className="draw-overlay" ref={ref}>
      <div className="draw-scan" />
      <div className="draw-content">
        <p>OFFICIAL RANDOM DRAW · SEQUENCE {String(counter).padStart(3, '0')}</p>
        <h1 className="draw-title">DRAWING GROUPS</h1>
        <div className="draw-grid">
          {state.groups.map((group: Group) => (
            <div className="draw-group" key={group.id}>
              <strong>{group.name}</strong>
              {group.teamIds.map((id) => {
                const team = state.teams.find((item: Team) => item.id === id)
                return <span className="shuffle-name" key={id}><Logo team={team} small />{team?.name}</span>
              })}
            </div>
          ))}
        </div>
        <button type="button" className="draw-skip" onClick={() => doneRef.current()}>Skip animation</button>
      </div>
    </div>
  )
}

function CompetitionControls({ t, onDraw, onRedraw, onNext }: { t: any; onDraw: () => void; onRedraw: () => void; onNext: () => void }) {
  if (t.state.status === 'registration') {
    const needed = Math.max(0, 4 - t.state.teams.length)
    return (
      <div className="flow-control">
        <div className="flow-status"><strong>{needed ? `${needed} more team${needed === 1 ? '' : 's'} needed` : 'Roster ready'}</strong><span>At least four teams are required for a balanced tournament.</span></div>
        <button className="button primary" type="button" disabled={needed > 0} onClick={onDraw}><Sparkles /> Start tournament</button>
      </div>
    )
  }

  if (t.state.status === 'groups') {
    if (t.isSixTeamChampionship) {
      return (
        <div className="flow-control">
          <div className={`flow-status ${t.groupComplete ? 'ready' : ''}`}>
            <strong>{t.groupComplete ? 'Qualification is finalizing' : `${t.pendingMatches} group match${t.pendingMatches === 1 ? '' : 'es'} remaining`}</strong>
            <span>{t.groupComplete
              ? 'The top three from each group and all 15 knockout-stage fixtures are created automatically.'
              : 'Complete every Group A and Group B result to trigger automatic qualification.'}</span>
          </div>
          <div className="actions">
            <button className="button ghost" type="button" disabled={!t.canRegenerateGroups} onClick={onRedraw} title={t.canRegenerateGroups ? 'Create a fresh random draw' : 'Clear every score and schedule before regenerating groups'}><RotateCcw /> Regenerate Groups</button>
          </div>
        </div>
      )
    }

    return (
      <div className="flow-control">
        <div className={`flow-status ${t.groupComplete ? 'ready' : ''}`}>
          <strong>{t.groupComplete ? 'Group stage complete' : `${t.pendingMatches} group match${t.pendingMatches === 1 ? '' : 'es'} remaining`}</strong>
          <span>{t.groupComplete ? 'The qualified teams can now enter the knockout bracket.' : 'Every score must be completed before knockout can start.'}</span>
        </div>
        <div className="actions">
          <button className="button ghost" type="button" disabled={!t.canRegenerateGroups} onClick={onRedraw} title={t.canRegenerateGroups ? 'Create a fresh random draw' : 'Clear every score and schedule before regenerating groups'}><RotateCcw /> Regenerate Groups</button>
          <button className="button primary" type="button" disabled={!t.canStartKnockout} onClick={() => t.startKnockout()}><GitBranch /> Start knockout</button>
        </div>
      </div>
    )
  }

  if (t.state.status === 'knockout') {
    if (t.isSixTeamChampionship) {
      const roundRobinProgress = `${t.completedKnockoutStageMatches || 0} / 15 knockout-stage matches complete.`
      const progressText = t.champion
        ? `${t.champion.name} has won the Grand Final and is being recorded as tournament champion.`
        : t.knockoutStageComplete
          ? 'Playoff matches are created automatically as soon as every required participant is known.'
          : `${roundRobinProgress} Playoff matches remain locked until the standings are final.`

      return (
        <div className="flow-control">
          <div className={`flow-status ${t.champion ? 'ready' : ''}`}>
            <strong>{t.state.stage}</strong>
            <span>{progressText}</span>
          </div>
        </div>
      )
    }

    const isFinal = t.activeKnockoutRound === 2
    return (
      <div className="flow-control">
        <div className={`flow-status ${t.canAdvanceKnockoutRound ? 'ready' : ''}`}>
          <strong>{roundName(t.activeKnockoutRound)}</strong>
          <span>{t.canAdvanceKnockoutRound ? (isFinal ? `${t.champion?.name || 'The winner'} is ready to be crowned.` : 'Every winner is decided. The next round is ready.') : `${t.pendingKnockoutMatches} knockout match${t.pendingKnockoutMatches === 1 ? '' : 'es'} still need a winner.`}</span>
        </div>
        <button className="button primary" type="button" disabled={!t.canAdvanceKnockoutRound} onClick={() => t.advanceKnockoutRound()}>
          {isFinal ? <Crown /> : <ChevronRight />}{isFinal ? 'Confirm champion' : `Advance to ${roundName((t.activeKnockoutRound || 4) / 2)}`}
        </button>
      </div>
    )
  }

  return (
    <div className="flow-control">
      <div className={`flow-status ${t.canStartNext ? 'ready' : 'warning'}`}>
        <strong>{t.canStartNext ? `${t.champion?.name || 'Champion'} crowned` : 'Completion needs verification'}</strong>
        <span>{t.canStartNext ? 'The final is recorded and this tournament is safely archived.' : 'A resolved final is required before another tournament can start.'}</span>
      </div>
      <button className="button primary" type="button" disabled={!t.canStartNext} onClick={onNext}><Trophy /> Start next tournament</button>
    </div>
  )
}

function Admin({ auth, t }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [modal, setModal] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [error, setError] = useState('')

  const login = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try { await auth.signIn(email, password) }
    catch (caught: any) { setError(caught.message) }
  }

  if (!auth.isConfigured) {
    return <div className="page"><PageHead kicker="SECURE ACCESS" title="Backend setup required" text="Add your Supabase URL and anonymous key to .env.local, then create an administrator using supabase/schema.sql." /></div>
  }

  if (!auth.session) {
    return (
      <main className="admin-login">
        <form onSubmit={login}>
          <div className="lock"><LockKeyhole /></div>
          <p className="eyebrow">RESTRICTED SYSTEM</p>
          <h1>Control centre</h1>
          <p>Authorized tournament personnel only.</p>
          <label>Admin email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<div className="password"><input type={show ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff /> : <Eye />}</button></div></label>
          {error && <p className="error">{error}</p>}
          <button className="button primary" type="submit">Enter admin panel</button>
        </form>
      </main>
    )
  }

  if (!auth.isAdmin) {
    return <div className="page"><Empty icon={<Shield />} title="Access denied" text="This account is authenticated but is not registered as a tournament administrator." /></div>
  }

  if (!t.hydrated) {
    return <div className="page"><Empty icon={<Shield />} title="Loading live tournament" text="Tournament controls will unlock after the latest saved state is verified." /></div>
  }

  const startDraw = () => { if (t.draw()) setDrawing(true) }
  const redraw = () => { if (t.regenerate()) setDrawing(true) }
  const startNext = () => {
    if (!t.canStartNext) return
    const nextNumber = t.state.tournamentNumber + 1
    if (!window.confirm(`Start Tournament #${String(nextNumber).padStart(2, '0')}? The champion is archived; current groups and match results will be cleared.`)) return
    t.nextTournament(true)
  }
  const totalMatches = t.state.matches.length
    + t.state.knockoutMatches.length
    + (t.isSixTeamChampionship ? (t.knockoutStageMatches?.length || 0) : 0)
  const playedMatches = t.completedMatches
    + t.completedKnockoutMatches
    + (t.isSixTeamChampionship ? (t.completedKnockoutStageMatches || 0) : 0)

  return (
    <main className="admin-page">
      <aside>
        <div className="admin-brand"><Shield /><div><strong>EFC CONTROL</strong><small>ADMIN CONSOLE</small></div></div>
        <nav>
          <a href="#overview"><BarChart3 /> Overview</a>
          <a href="#teams"><Users /> Teams</a>
          <a href="#matches"><CalendarDays /> Group matches</a>
          <a href="#knockout"><GitBranch /> Knockout</a>
          <NavLink to="/history"><Crown /> History</NavLink>
        </nav>
        <button type="button" onClick={auth.signOut}><LogOut /> Sign out</button>
      </aside>
      <div className="admin-content">
        <header>
          <div><p className="eyebrow">TOURNAMENT OPERATIONS</p><h1>Control centre</h1></div>
          <div className="admin-header-tools">
            <span className={`sync sync--${t.syncing ? 'saving' : t.liveStatus}`} role="status" aria-live="polite">
              <i />{t.syncing ? 'SAVING' : (liveLabels[t.liveStatus] || 'UPDATING')}
            </span>
            <button className="mobile-signout" type="button" onClick={auth.signOut}><LogOut /> Sign out</button>
          </div>
        </header>
        <nav className="admin-mobile-nav" aria-label="Admin sections">
          <a href="#overview"><BarChart3 /> Overview</a>
          <a href="#teams"><Users /> Teams</a>
          <a href="#matches"><CalendarDays /> Matches</a>
          <a href="#knockout"><GitBranch /> Knockout</a>
        </nav>
        <section id="overview" className="admin-stats">
          <article><small>Tournament</small><strong>#{String(t.state.tournamentNumber).padStart(2, '0')}</strong></article>
          <article><small>Total teams</small><strong>{t.state.teams.length}</strong></article>
          <article><small>Matches decided</small><strong>{playedMatches}/{totalMatches}</strong></article>
          <article><small>Current stage</small><strong>{t.state.stage}</strong></article>
        </section>
        <section className="control-section">
          <div className="section-head"><div><p className="eyebrow">TOURNAMENT FLOW</p><h2>Competition controls</h2></div></div>
          <CompetitionControls t={t} onDraw={startDraw} onRedraw={redraw} onNext={startNext} />
        </section>
        <section id="teams" className="control-section">
          <div className="section-head">
            <div><p className="eyebrow">ROSTER</p><h2>Team management</h2></div>
            {t.state.status === 'registration' && <button className="button primary" type="button" onClick={() => setModal(true)}><Plus /> Add team</button>}
          </div>
          <TeamGrid t={t} manage />
        </section>
        <section id="matches" className="control-section">
          <div className="section-head"><div><p className="eyebrow">GROUP OPERATIONS</p><h2>Group score desk</h2></div></div>
          <GroupMatches t={t} admin />
        </section>
        <section id="knockout" className="control-section">
          <div className="section-head"><div><p className="eyebrow">KNOCKOUT OPERATIONS</p><h2>{t.isSixTeamChampionship ? 'Qualification to champion' : 'Road to the final'}</h2></div></div>
          {t.isSixTeamChampionship
            ? <SixTeamChampionshipFlow t={t} admin />
            : <KnockoutMatches t={t} admin />}
        </section>
      </div>
      {modal && <AddTeamModal close={() => setModal(false)} add={t.addTeam} />}
      {drawing && <DrawOverlay state={t.state} done={() => setDrawing(false)} />}
    </main>
  )
}

export default App
