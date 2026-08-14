import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import gsap from 'gsap'
import {
  Check,
  Crown,
  GitBranch,
  LockKeyhole,
  Radio,
  ShieldQuestion,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import type { Group, KnockoutMatch, Standing, Team } from '../types'
import { areGroupFixturesComplete, resolveKnockoutWinner, standings } from '../utils/tournament'

type RoadmapTone = 'locked' | 'active' | 'complete' | 'gold'

type RoadmapEdge = {
  from: string
  to: string
  tone: RoadmapTone
}

type ConnectorPath = RoadmapEdge & {
  id: string
  d: string
}

type ConnectorLayout = {
  width: number
  height: number
  paths: ConnectorPath[]
}

type QualificationEntry = {
  team: Team
  groupName: string
  groupPosition: number
}

const playoffKeys = ['semifinal-1', 'spot-semifinal', 'semifinal-2', 'grand-final'] as const

const fallbackLogo = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=102a54&color=45d7ff&bold=true&size=128`

function RoadmapLogo({ team, large = false }: { team: Team; large?: boolean }) {
  const [bad, setBad] = useState(false)

  useLayoutEffect(() => setBad(false), [team.imageUrl])

  return (
    <img
      className={`roadmap-logo ${large ? 'roadmap-logo--large' : ''}`}
      src={!bad && team.imageUrl ? team.imageUrl : fallbackLogo(team.name)}
      alt={`${team.name} logo`}
      onError={() => setBad(true)}
    />
  )
}

function PlaceholderLogo({ large = false }: { large?: boolean }) {
  return (
    <span className={`roadmap-logo roadmap-logo--placeholder ${large ? 'roadmap-logo--large' : ''}`} aria-hidden="true">
      <ShieldQuestion />
    </span>
  )
}

function StatusPill({ tone, children }: { tone: RoadmapTone; children: ReactNode }) {
  return <span className={`roadmap-status roadmap-status--${tone}`}>{children}</span>
}

function TeamSlot({
  team,
  source,
  slotKey,
  winner = false,
  emptyLabel = 'TBA',
  compact = false,
}: {
  team?: Team | null
  source: string
  slotKey: string
  winner?: boolean
  emptyLabel?: string
  compact?: boolean
}) {
  return (
    <div
      className={`roadmap-team-slot ${team ? 'is-filled' : 'is-empty'} ${winner ? 'is-winner' : ''} ${compact ? 'is-compact' : ''}`}
      data-slot-key={slotKey}
      data-filled={Boolean(team)}
    >
      {team ? <RoadmapLogo team={team} /> : <PlaceholderLogo />}
      <span>
        <small>{source}</small>
        <strong>{team?.name || emptyLabel}</strong>
      </span>
      {winner && <Check aria-label="Winner" />}
    </div>
  )
}

function groupRows(group: Group | undefined, t: any) {
  if (!group) return [] as Standing[]
  return standings(
    t.state.teams,
    t.state.matches.filter((match: any) => match.groupId === group.id),
    group.teamIds,
  )
}

function GroupNode({
  group,
  fallbackName,
  nodeId,
  className,
  t,
  advanceCount = 3,
}: {
  group?: Group
  fallbackName: string
  nodeId: string
  className?: string
  t: any
  advanceCount?: number
}) {
  const rows = groupRows(group, t)
  const groupMatches = group
    ? t.state.matches.filter((match: any) => match.groupId === group.id)
    : []
  const played = groupMatches.filter((match: any) => match.homeScore !== null && match.awayScore !== null).length
  const expectedMatches = group ? (group.teamIds.length * (group.teamIds.length - 1)) / 2 : 0
  const complete = Boolean(group && areGroupFixturesComplete([group], groupMatches))
  const tone: RoadmapTone = complete ? 'complete' : group ? 'active' : 'locked'
  const slots = group ? Math.max(group.teamIds.length, rows.length, group.teamIds.length ? 0 : 4) : 4

  return (
    <article className={`roadmap-node roadmap-group roadmap-node--${tone} ${className || ''}`} data-node-id={nodeId} data-roadmap-node>
      <header className="roadmap-node-head">
        <div>
          <span className="roadmap-step">01 · GROUP STAGE</span>
          <h2>{group?.name || fallbackName}</h2>
        </div>
        <StatusPill tone={tone}>{complete ? 'COMPLETE' : group ? 'LIVE' : 'WAITING'}</StatusPill>
      </header>
      <div className="roadmap-group-table" role="list" aria-label={`${group?.name || fallbackName} standings`}>
        {Array.from({ length: slots }, (_, index) => {
          const row = rows[index]
          return (
            <div className={`roadmap-group-row ${row && index < advanceCount ? 'is-qualifying' : ''}`} role="listitem" key={row?.id || `${nodeId}-tba-${index}`}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              {row ? <RoadmapLogo team={row} /> : <PlaceholderLogo />}
              <strong>{row?.name || 'TBA'}</strong>
              <span>{row ? `${row.points} PTS` : '—'}</span>
            </div>
          )
        })}
      </div>
      <footer><span>{played}/{expectedMatches} MATCHES</span><span>TOP {advanceCount} ADVANCE</span></footer>
    </article>
  )
}

function QualifierNode({
  entry,
  source,
  nodeId,
  className,
  slotKey,
  seed,
}: {
  entry?: QualificationEntry
  source: string
  nodeId: string
  className: string
  slotKey: string
  seed: number
}) {
  const tone: RoadmapTone = entry ? 'complete' : 'locked'
  return (
    <article className={`roadmap-node roadmap-qualifier roadmap-node--${tone} ${className}`} data-node-id={nodeId} data-roadmap-node>
      <span className="roadmap-qualifier-seed">Q{seed}</span>
      <TeamSlot team={entry?.team} source={entry ? `${entry.groupName} · #${entry.groupPosition}` : source} slotKey={slotKey} compact />
    </article>
  )
}

function LeagueNode({ t, nodeId }: { t: any; nodeId: string }) {
  const rows = (t.knockoutStandings ?? []) as Standing[]
  const qualifiers = (t.qualificationEntries ?? []) as QualificationEntry[]
  const started = (t.knockoutStageMatches?.length ?? 0) > 0
  const complete = Boolean(t.knockoutStageComplete)
  const completed = t.completedKnockoutStageMatches ?? 0
  const tone: RoadmapTone = complete ? 'complete' : started ? 'active' : 'locked'
  const progress = Math.min(100, Math.max(0, (completed / 15) * 100))

  return (
    <article className={`roadmap-node roadmap-league roadmap-node--${tone}`} data-node-id={nodeId} data-roadmap-node>
      <header className="roadmap-node-head">
        <div>
          <span className="roadmap-step">03 · KNOCKOUT LEAGUE</span>
          <h2>Six-team arena</h2>
          <p>Every qualifier plays five matches. The live table decides the four playoff seeds.</p>
        </div>
        <div className="roadmap-progress-dial" style={{ '--roadmap-progress': `${progress}%` } as CSSProperties}>
          <strong>{completed}</strong><small>/ 15</small>
        </div>
      </header>
      <div className="roadmap-league-grid">
        {Array.from({ length: 6 }, (_, index) => {
          const row = rows[index]
          const fallbackTeam = qualifiers[index]?.team
          const team = row || fallbackTeam
          const isEliminated = complete && index > 3
          return (
            <div className={`roadmap-rank-slot ${isEliminated ? 'is-eliminated' : ''}`} key={team?.id || `league-tba-${index}`}>
              <b>{row ? `#${row.position}` : `S${index + 1}`}</b>
              {team ? <RoadmapLogo team={team} /> : <PlaceholderLogo />}
              <span><strong>{team?.name || 'TBA'}</strong><small>{row ? `${row.points} PTS · ${row.goalDifference >= 0 ? '+' : ''}${row.goalDifference} GD` : 'QUALIFIER SLOT'}</small></span>
              {complete && <em>{index < 2 ? 'SF1' : index < 4 ? 'SPOT SF' : 'OUT'}</em>}
            </div>
          )
        })}
      </div>
      <footer className="roadmap-path-legend">
        <span><b>#1–#2</b> SEMIFINAL 1</span>
        <span><b>#3–#4</b> SPOT SEMIFINAL</span>
        <span><b>#5–#6</b> ELIMINATED</span>
      </footer>
    </article>
  )
}

function matchStatus(match: KnockoutMatch | null, participantCount = 0) {
  if (!match) return participantCount
    ? { label: `${participantCount} / 2 SET`, tone: 'active' as RoadmapTone }
    : { label: 'LOCKED', tone: 'locked' as RoadmapTone }
  if (resolveKnockoutWinner(match)) return { label: 'DECIDED', tone: 'complete' as RoadmapTone }
  if (match.homeScore !== null && match.awayScore !== null && match.homeScore === match.awayScore) {
    return { label: 'PENALTIES', tone: 'active' as RoadmapTone }
  }
  if (match.homeScore !== null || match.awayScore !== null) return { label: 'LIVE', tone: 'active' as RoadmapTone }
  return { label: 'READY', tone: 'active' as RoadmapTone }
}

function resolvedLoserId(match: KnockoutMatch | null) {
  if (!match?.homeId || !match.awayId) return null
  const winnerId = resolveKnockoutWinner(match)
  if (winnerId === match.homeId) return match.awayId
  if (winnerId === match.awayId) return match.homeId
  return null
}

function PlayoffNode({
  nodeId,
  className,
  step,
  eyebrow,
  title,
  match,
  teamsById,
  homeSource,
  awaySource,
  pendingHomeId = null,
  pendingAwayId = null,
}: {
  nodeId: string
  className: string
  step: string
  eyebrow: string
  title: string
  match: KnockoutMatch | null
  teamsById: Map<string, Team>
  homeSource: string
  awaySource: string
  pendingHomeId?: string | null
  pendingAwayId?: string | null
}) {
  const homeId = match ? match.homeId : pendingHomeId
  const awayId = match ? match.awayId : pendingAwayId
  const home = homeId ? teamsById.get(homeId) : null
  const away = awayId ? teamsById.get(awayId) : null
  const participantCount = Number(Boolean(homeId)) + Number(Boolean(awayId))
  const winnerId = match ? resolveKnockoutWinner(match) : null
  const state = matchStatus(match, participantCount)
  const scored = Boolean(match && match.homeScore !== null && match.awayScore !== null)
  const hasScore = Boolean(match && (match.homeScore !== null || match.awayScore !== null))
  const penalties = Boolean(scored && match!.homeScore === match!.awayScore
    && match!.homePenaltyScore !== null && match!.awayPenaltyScore !== null)

  return (
    <article className={`roadmap-node roadmap-match roadmap-node--${state.tone} ${className}`} data-node-id={nodeId} data-roadmap-node>
      <header className="roadmap-node-head">
        <div><span className="roadmap-step">{step} · {eyebrow}</span><h2>{title}</h2></div>
        <StatusPill tone={state.tone}>{state.label}</StatusPill>
      </header>
      <div className="roadmap-versus">
        <TeamSlot team={home} source={homeSource} slotKey={`${nodeId}-home`} winner={Boolean(home && winnerId === home.id)} emptyLabel={match?.awayId && !match.homeId ? 'BYE' : 'TBA'} compact />
        <div className="roadmap-score">
          <span>{hasScore ? `${match!.homeScore ?? '—'} : ${match!.awayScore ?? '—'}` : 'VS'}</span>
          {penalties && <small>PEN {match!.homePenaltyScore} : {match!.awayPenaltyScore}</small>}
        </div>
        <TeamSlot team={away} source={awaySource} slotKey={`${nodeId}-away`} winner={Boolean(away && winnerId === away.id)} emptyLabel={match?.homeId && !match.awayId ? 'BYE' : 'TBA'} compact />
      </div>
      {!match && <div className="roadmap-lock-copy"><LockKeyhole /> {participantCount ? `${participantCount} route secured — waiting for the other side` : 'Complete the previous path to unlock this match'}</div>}
    </article>
  )
}

function ChampionNode({ champion, nodeId, step = '07' }: { champion: Team | null; nodeId: string; step?: string }) {
  const tone: RoadmapTone = champion ? 'gold' : 'locked'
  return (
    <article className={`roadmap-node roadmap-champion roadmap-node--${tone}`} data-node-id={nodeId} data-slot-key="champion" data-roadmap-node>
      {champion && <div className="roadmap-champion-halo" aria-hidden="true" />}
      <Crown className="roadmap-champion-crown" />
      {champion ? <RoadmapLogo team={champion} large /> : <PlaceholderLogo large />}
      <div><span className="roadmap-step">{step} · TOURNAMENT CHAMPION</span><h2>{champion?.name || 'TBA'}</h2><p>{champion ? 'The road ends in glory.' : 'One name will own the night.'}</p></div>
      <Trophy />
    </article>
  )
}

function connectorCurve(surface: DOMRect, from: Element, to: Element) {
  const start = from.getBoundingClientRect()
  const end = to.getBoundingClientRect()
  const x1 = start.left - surface.left + start.width / 2
  const y1 = start.bottom - surface.top
  const x2 = end.left - surface.left + end.width / 2
  const y2 = end.top - surface.top
  const bend = y1 + (y2 - y1) * 0.5
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${bend.toFixed(1)}, ${x2.toFixed(1)} ${bend.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

function useConnectorLayout(surfaceRef: React.RefObject<HTMLDivElement | null>, edges: RoadmapEdge[]) {
  const [layout, setLayout] = useState<ConnectorLayout>({ width: 0, height: 0, paths: [] })
  const edgeSignature = edges.map((edge) => `${edge.from}>${edge.to}:${edge.tone}`).join('|')

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return undefined
    let frame = 0
    let active = true

    const measure = () => {
      if (!active) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (!active) return
        const surfaceBox = surface.getBoundingClientRect()
        const paths = edges.flatMap((edge, index) => {
          const from = surface.querySelector(`[data-node-id="${edge.from}"]`)
          const to = surface.querySelector(`[data-node-id="${edge.to}"]`)
          if (!from || !to) return []
          return [{ ...edge, id: `${edge.from}-${edge.to}-${index}`, d: connectorCurve(surfaceBox, from, to) }]
        })
        const next = { width: surface.clientWidth, height: surface.scrollHeight, paths }
        setLayout((current) => {
          const currentKey = `${current.width}:${current.height}:${current.paths.map((path) => path.d).join('|')}`
          const nextKey = `${next.width}:${next.height}:${next.paths.map((path) => path.d).join('|')}`
          return currentKey === nextKey ? current : next
        })
      })
    }

    const observer = new ResizeObserver(measure)
    observer.observe(surface)
    Array.from(surface.querySelectorAll('[data-roadmap-node]')).forEach((node) => observer.observe(node))
    window.addEventListener('resize', measure)
    window.addEventListener('roadmap:remeasure', measure)
    measure()
    document.fonts?.ready.then(() => { if (active) measure() }).catch(() => undefined)

    return () => {
      active = false
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('roadmap:remeasure', measure)
    }
  }, [surfaceRef, edgeSignature])

  return layout
}

function ConnectorLayer({ layout }: { layout: ConnectorLayout }) {
  const ref = useRef<SVGSVGElement>(null)
  const pathSignature = layout.paths.map((path) => `${path.id}:${path.d}:${path.tone}`).join('|')

  useLayoutEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const context = gsap.context(() => {
      ref.current?.querySelectorAll<SVGPathElement>('.roadmap-wire-base').forEach((path) => {
        const length = path.getTotalLength()
        gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, {
          strokeDashoffset: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => gsap.set(path, { clearProps: 'strokeDasharray,strokeDashoffset' }),
        })
      })
      gsap.to('.roadmap-wire-flow', { strokeDashoffset: -42, duration: 2.2, repeat: -1, ease: 'none' })
    }, ref)
    return () => context.revert()
  }, [pathSignature])

  if (!layout.width || !layout.height) return null
  return (
    <svg
      ref={ref}
      className="roadmap-wires"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      aria-hidden="true"
    >
      {layout.paths.map((path) => (
        <g className={`roadmap-wire roadmap-wire--${path.tone}`} key={path.id}>
          <path className="roadmap-wire-base" d={path.d} />
          {path.tone !== 'locked' && <path className="roadmap-wire-flow" d={path.d} />}
        </g>
      ))}
    </svg>
  )
}

function ModernRoadmapBoard({ t }: { t: any }) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const groups = t.state.groups as Group[]
  const groupA = groups.find((group) => group.name.trim().toLowerCase() === 'group a') ?? groups[0]
  const groupB = groups.find((group) => group.name.trim().toLowerCase() === 'group b') ?? groups[1]
  const entries = (t.qualificationEntries ?? []) as QualificationEntry[]
  const teamsById = useMemo(() => new Map<string, Team>(t.state.teams.map((team: Team) => [team.id, team])), [t.state.teams])
  const matches = t.playoffMatches as Record<(typeof playoffKeys)[number], KnockoutMatch | null>
  const sf1 = matches?.['semifinal-1'] ?? null
  const spot = matches?.['spot-semifinal'] ?? null
  const sf2 = matches?.['semifinal-2'] ?? null
  const final = matches?.['grand-final'] ?? null
  const knockoutRows = (t.knockoutStandings ?? []) as Standing[]
  const qualifierComplete = entries.length === 6
  const leagueStarted = (t.knockoutStageMatches?.length ?? 0) > 0
  const sf1WinnerId = sf1 ? resolveKnockoutWinner(sf1) : null
  const sf1LoserId = resolvedLoserId(sf1)
  const spotWinnerId = spot ? resolveKnockoutWinner(spot) : null
  const sf2WinnerId = sf2 ? resolveKnockoutWinner(sf2) : null
  const finalWinnerId = final ? resolveKnockoutWinner(final) : null
  const sf1Decided = Boolean(sf1WinnerId)
  const spotDecided = Boolean(spotWinnerId)
  const sf2Decided = Boolean(sf2WinnerId)
  const finalDecided = Boolean(finalWinnerId)
  const openingHomeIds = t.knockoutStageComplete ? knockoutRows.slice(0, 4).map((row) => row.id) : []

  const edges = useMemo<RoadmapEdge[]>(() => {
    const list: RoadmapEdge[] = []
    for (let index = 1; index <= 3; index++) {
      list.push({ from: 'group-a', to: `qualifier-a-${index}`, tone: qualifierComplete ? 'complete' : groups.length ? 'active' : 'locked' })
      list.push({ from: 'group-b', to: `qualifier-b-${index}`, tone: qualifierComplete ? 'complete' : groups.length ? 'active' : 'locked' })
      list.push({ from: `qualifier-a-${index}`, to: 'league', tone: leagueStarted ? 'complete' : 'locked' })
      list.push({ from: `qualifier-b-${index}`, to: 'league', tone: leagueStarted ? 'complete' : 'locked' })
    }
    list.push({ from: 'league', to: 'semifinal-1', tone: sf1 ? 'complete' : t.knockoutStageMatches?.length ? 'active' : 'locked' })
    list.push({ from: 'league', to: 'spot-semifinal', tone: spot ? 'complete' : t.knockoutStageMatches?.length ? 'active' : 'locked' })
    list.push({ from: 'semifinal-1', to: 'semifinal-2', tone: sf1Decided && sf2 ? 'complete' : sf1 ? 'active' : 'locked' })
    list.push({ from: 'spot-semifinal', to: 'semifinal-2', tone: spotDecided && sf2 ? 'complete' : spot ? 'active' : 'locked' })
    list.push({ from: 'semifinal-1', to: 'grand-final', tone: sf1Decided && final ? 'complete' : sf1 ? 'active' : 'locked' })
    list.push({ from: 'semifinal-2', to: 'grand-final', tone: sf2Decided && final ? 'complete' : sf2 ? 'active' : 'locked' })
    list.push({ from: 'grand-final', to: 'champion', tone: finalDecided ? 'gold' : final ? 'active' : 'locked' })
    return list
  }, [final, finalDecided, groups.length, leagueStarted, qualifierComplete, sf1, sf1Decided, sf2, sf2Decided, spot, spotDecided, t.knockoutStageMatches?.length])
  const layout = useConnectorLayout(surfaceRef, edges)

  return (
    <section className="roadmap-board" aria-label="Live championship roadmap">
      <div className="roadmap-board-topline">
        <div><GitBranch /><span>LIVE TOURNAMENT GRAPH</span></div>
        <small>Every node is connected to the official tournament state</small>
      </div>
      <div className="roadmap-surface" ref={surfaceRef}>
        <ConnectorLayer layout={layout} />

        <GroupNode group={groupA} fallbackName="Group A" nodeId="group-a" className="roadmap-group--a" t={t} />
        {[0, 1, 2].map((index) => (
          <QualifierNode
            key={`qa-${index}`}
            entry={entries[index]}
            source={`GROUP A · TOP ${index + 1}`}
            nodeId={`qualifier-a-${index + 1}`}
            className={`roadmap-qualifier--a${index + 1}`}
            slotKey={`qa${index + 1}`}
            seed={index + 1}
          />
        ))}

        <GroupNode group={groupB} fallbackName="Group B" nodeId="group-b" className="roadmap-group--b" t={t} />
        {[0, 1, 2].map((index) => (
          <QualifierNode
            key={`qb-${index}`}
            entry={entries[index + 3]}
            source={`GROUP B · TOP ${index + 1}`}
            nodeId={`qualifier-b-${index + 1}`}
            className={`roadmap-qualifier--b${index + 1}`}
            slotKey={`qb${index + 1}`}
            seed={index + 4}
          />
        ))}

        <LeagueNode t={t} nodeId="league" />

        <PlayoffNode
          nodeId="semifinal-1"
          className="roadmap-opening roadmap-opening--sf1"
          step="04"
          eyebrow="TOP-TWO SHOWDOWN"
          title="Semifinal 1"
          match={sf1}
          teamsById={teamsById}
          homeSource="KNOCKOUT #1"
          awaySource="KNOCKOUT #2"
          pendingHomeId={openingHomeIds[0]}
          pendingAwayId={openingHomeIds[1]}
        />
        <PlayoffNode
          nodeId="spot-semifinal"
          className="roadmap-opening roadmap-opening--spot"
          step="04"
          eyebrow="LAST-CHANCE PATH"
          title="Spot semifinal"
          match={spot}
          teamsById={teamsById}
          homeSource="KNOCKOUT #3"
          awaySource="KNOCKOUT #4"
          pendingHomeId={openingHomeIds[2]}
          pendingAwayId={openingHomeIds[3]}
        />
        <PlayoffNode
          nodeId="semifinal-2"
          className="roadmap-semifinal-two"
          step="05"
          eyebrow="FINAL QUALIFIER"
          title="Semifinal 2"
          match={sf2}
          teamsById={teamsById}
          homeSource="SF1 LOSER"
          awaySource="SPOT SF WINNER"
          pendingHomeId={sf1LoserId}
          pendingAwayId={spotWinnerId}
        />
        <PlayoffNode
          nodeId="grand-final"
          className="roadmap-final"
          step="06"
          eyebrow="TITLE MATCH"
          title="Grand final"
          match={final}
          teamsById={teamsById}
          homeSource="SF1 WINNER"
          awaySource="SF2 WINNER"
          pendingHomeId={sf1WinnerId}
          pendingAwayId={sf2WinnerId}
        />
        <ChampionNode champion={(t.champion ?? null) as Team | null} nodeId="champion" />
      </div>
    </section>
  )
}

function legacyRoundName(round: number) {
  if (round === 2) return 'Grand final'
  if (round === 4) return 'Semifinals'
  if (round === 8) return 'Quarterfinals'
  return `Round of ${round}`
}

function nextPowerOfTwo(value: number) {
  let size = 2
  while (size < value) size *= 2
  return size
}

function LegacyRoadmapBoard({ t }: { t: any }) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const groups = t.state.groups as Group[]
  const teamsById = useMemo(() => new Map<string, Team>(t.state.teams.map((team: Team) => [team.id, team])), [t.state.teams])
  const storedMatches = (t.state.knockoutMatches as KnockoutMatch[]).filter((match) => !match.stage)
  const storedRounds = [...new Set(storedMatches.map((match) => match.round))].sort((a, b) => b - a)
  const qualifierCount = Math.max(2, groups.reduce((count, group) => count + Math.min(2, group.teamIds.length), 0))
  const firstRound = storedRounds[0] ?? nextPowerOfTwo(qualifierCount)
  const rounds: number[] = []
  for (let round = firstRound; round >= 2; round /= 2) rounds.push(round)
  const finalMatch = storedMatches.find((match) => match.round === 2) ?? null
  const confirmedChampionId = t.state.status === 'completed' ? t.state.winnerId : null
  const champion = confirmedChampionId ? teamsById.get(confirmedChampionId) ?? null : null

  const edges = useMemo<RoadmapEdge[]>(() => {
    const list: RoadmapEdge[] = []
    const firstMatches = Math.max(1, firstRound / 2)
    groups.forEach((group, groupIndex) => {
      for (let order = 1; order <= firstMatches; order++) {
        const match = storedMatches.find((item) => item.round === firstRound && item.order === order)
        const touchesGroup = match && group.teamIds.some((id) => id === match.homeId || id === match.awayId)
        const projectedTarget = (groupIndex % firstMatches) + 1
        if (touchesGroup || (!storedMatches.length && order === projectedTarget)) {
          list.push({ from: `legacy-group-${groupIndex}`, to: `legacy-${firstRound}-${order}`, tone: match ? 'complete' : 'locked' })
        }
      }
    })
    rounds.slice(0, -1).forEach((round) => {
      for (let order = 1; order <= round / 2; order++) {
        const match = storedMatches.find((item) => item.round === round && item.order === order)
        const next = storedMatches.find((item) => item.round === round / 2 && item.order === Math.ceil(order / 2))
        list.push({
          from: `legacy-${round}-${order}`,
          to: `legacy-${round / 2}-${Math.ceil(order / 2)}`,
          tone: next ? 'complete' : match ? 'active' : 'locked',
        })
      }
    })
    list.push({ from: 'legacy-2-1', to: 'legacy-champion', tone: champion ? 'gold' : finalMatch ? 'active' : 'locked' })
    return list
  }, [champion, finalMatch, firstRound, groups, rounds, storedMatches])
  const layout = useConnectorLayout(surfaceRef, edges)

  return (
    <section className="roadmap-board roadmap-board--legacy" aria-label="Classic knockout roadmap">
      <div className="roadmap-board-topline">
        <div><GitBranch /><span>CLASSIC BRACKET GRAPH</span></div>
        <small>Top two from each group enter the knockout tree</small>
      </div>
      <div className="roadmap-surface roadmap-surface--legacy" ref={surfaceRef}>
        <ConnectorLayer layout={layout} />
        <div className="roadmap-legacy-groups">
          {groups.length ? groups.map((group, index) => (
            <GroupNode key={group.id} group={group} fallbackName={group.name} nodeId={`legacy-group-${index}`} t={t} advanceCount={2} />
          )) : (
            <GroupNode fallbackName="Group stage" nodeId="legacy-group-0" t={t} advanceCount={2} />
          )}
        </div>
        {rounds.map((round, roundIndex) => (
          <section className="roadmap-legacy-round" key={round}>
            <div className="roadmap-stage-divider"><span>{String(roundIndex + 2).padStart(2, '0')}</span><div><small>KNOCKOUT STAGE</small><h2>{legacyRoundName(round)}</h2></div></div>
            <div className="roadmap-legacy-match-grid">
              {Array.from({ length: Math.max(1, round / 2) }, (_, index) => {
                const order = index + 1
                const match = storedMatches.find((item) => item.round === round && item.order === order) ?? null
                const feederRound = round * 2
                const homeFeeder = storedMatches.find((item) => item.round === feederRound && item.order === order * 2 - 1)
                const awayFeeder = storedMatches.find((item) => item.round === feederRound && item.order === order * 2)
                const pendingHomeId = round === firstRound || !homeFeeder ? null : resolveKnockoutWinner(homeFeeder)
                const pendingAwayId = round === firstRound || !awayFeeder ? null : resolveKnockoutWinner(awayFeeder)
                return (
                  <PlayoffNode
                    key={`${round}-${order}`}
                    nodeId={`legacy-${round}-${order}`}
                    className="roadmap-legacy-match"
                    step={String(roundIndex + 2).padStart(2, '0')}
                    eyebrow={`MATCH ${String(order).padStart(2, '0')}`}
                    title={legacyRoundName(round)}
                    match={match}
                    teamsById={teamsById}
                    homeSource={round === firstRound ? 'GROUP QUALIFIER' : `WINNER · M${order * 2 - 1}`}
                    awaySource={round === firstRound ? 'GROUP QUALIFIER' : `WINNER · M${order * 2}`}
                    pendingHomeId={pendingHomeId}
                    pendingAwayId={pendingAwayId}
                  />
                )
              })}
            </div>
          </section>
        ))}
        <ChampionNode champion={champion} nodeId="legacy-champion" step={String(rounds.length + 2).padStart(2, '0')} />
      </div>
    </section>
  )
}

function roadmapMilestones(t: any, modern: boolean) {
  if (!modern) {
    const matches = (t.state.knockoutMatches as KnockoutMatch[]).filter((match) => !match.stage)
    const qualifierCount = Math.max(2, (t.state.groups as Group[]).reduce(
      (count, group) => count + Math.min(2, group.teamIds.length),
      0,
    ))
    const firstRound = matches.length
      ? Math.max(...matches.map((match) => match.round))
      : nextPowerOfTwo(qualifierCount)
    const roundMilestones: boolean[] = []
    for (let round = firstRound; round >= 2; round /= 2) {
      const roundMatches = matches.filter((match) => match.round === round)
      roundMilestones.push(roundMatches.length === round / 2 && roundMatches.every((match) => Boolean(resolveKnockoutWinner(match))))
    }
    return [
      Boolean(t.groupComplete),
      ...roundMilestones,
      Boolean(t.state.status === 'completed' && t.state.winnerId),
    ]
  }
  return [
    Boolean(t.groupComplete),
    (t.qualificationEntries?.length ?? 0) === 6,
    Boolean(t.knockoutStageComplete),
    Boolean(t.playoffMatches?.['semifinal-1'] && resolveKnockoutWinner(t.playoffMatches['semifinal-1'])),
    Boolean(t.playoffMatches?.['spot-semifinal'] && resolveKnockoutWinner(t.playoffMatches['spot-semifinal'])),
    Boolean(t.playoffMatches?.['semifinal-2'] && resolveKnockoutWinner(t.playoffMatches['semifinal-2'])),
    Boolean(t.playoffMatches?.['grand-final'] && resolveKnockoutWinner(t.playoffMatches['grand-final'])),
    Boolean(t.champion),
  ]
}

export default function Roadmap({ t }: { t: any }) {
  const rootRef = useRef<HTMLElement>(null)
  const previousAssignments = useRef<Record<string, string> | null>(null)
  const groups = t.state.groups as Group[]
  const hasSemanticMatches = (t.state.knockoutMatches as KnockoutMatch[]).some((match) => Boolean(match.stage))
  const hasLegacyMatches = (t.state.knockoutMatches as KnockoutMatch[]).some((match) => !match.stage)
  const explicitModern = Boolean(hasSemanticMatches
    || t.state.knockoutStageMatches.length
    || t.state.qualifiedTeamIds.length)
  const modern = explicitModern
    ? true
    : hasLegacyMatches
      ? false
      : Boolean(t.isSixTeamChampionship || (!groups.length && t.state.version === 5))
  const milestones = roadmapMilestones(t, modern)
  const completedMilestones = milestones.filter(Boolean).length
  const progress = Math.round((completedMilestones / milestones.length) * 100)
  const completedPlayoffs = playoffKeys.filter((key) => {
    const match = t.playoffMatches?.[key] as KnockoutMatch | null
    return Boolean(match && resolveKnockoutWinner(match))
  }).length
  const qualifierEntries = (t.qualificationEntries ?? []) as QualificationEntry[]
  const legacyMatches = (t.state.knockoutMatches as KnockoutMatch[]).filter((match) => !match.stage)
  const legacyFirstRound = legacyMatches.length ? Math.max(...legacyMatches.map((match) => match.round)) : null
  const legacyQualifierIds = new Set(legacyMatches
    .filter((match) => match.round === legacyFirstRound)
    .flatMap((match) => [match.homeId, match.awayId])
    .filter((id): id is string => Boolean(id)))
  const legacyQualifierCount = legacyQualifierIds.size || (t.groupComplete
    ? groups.reduce((count, group) => count + Math.min(2, group.teamIds.length), 0)
    : 0)
  const confirmedLegacyChampion = t.state.status === 'completed' && t.state.winnerId
    ? t.state.teams.find((team: Team) => team.id === t.state.winnerId) ?? null
    : null
  const displayChampion = modern ? (t.champion as Team | null) : confirmedLegacyChampion
  const assignmentMap: Record<string, string> = {}

  if (modern) {
    qualifierEntries.forEach((entry, index) => { assignmentMap[index < 3 ? `qa${index + 1}` : `qb${index - 2}`] = entry.team.id })
    playoffKeys.forEach((key) => {
      const match = t.playoffMatches?.[key] as KnockoutMatch | null
      if (match?.homeId) assignmentMap[`${key}-home`] = match.homeId
      if (match?.awayId) assignmentMap[`${key}-away`] = match.awayId
    })
    const semantic = t.playoffMatches as Record<(typeof playoffKeys)[number], KnockoutMatch | null>
    const sf1 = semantic?.['semifinal-1'] ?? null
    const spot = semantic?.['spot-semifinal'] ?? null
    const sf2 = semantic?.['semifinal-2'] ?? null
    const rows = (t.knockoutStandings ?? []) as Standing[]
    if (t.knockoutStageComplete) {
      if (rows[0]) assignmentMap['semifinal-1-home'] ??= rows[0].id
      if (rows[1]) assignmentMap['semifinal-1-away'] ??= rows[1].id
      if (rows[2]) assignmentMap['spot-semifinal-home'] ??= rows[2].id
      if (rows[3]) assignmentMap['spot-semifinal-away'] ??= rows[3].id
    }
    const sf1Loser = resolvedLoserId(sf1)
    const sf1Winner = sf1 ? resolveKnockoutWinner(sf1) : null
    const spotWinner = spot ? resolveKnockoutWinner(spot) : null
    const sf2Winner = sf2 ? resolveKnockoutWinner(sf2) : null
    if (sf1Loser) assignmentMap['semifinal-2-home'] ??= sf1Loser
    if (spotWinner) assignmentMap['semifinal-2-away'] ??= spotWinner
    if (sf1Winner) assignmentMap['grand-final-home'] ??= sf1Winner
    if (sf2Winner) assignmentMap['grand-final-away'] ??= sf2Winner
  } else {
    const qualifierCount = Math.max(2, groups.reduce((count, group) => count + Math.min(2, group.teamIds.length), 0))
    const firstRound = legacyFirstRound ?? nextPowerOfTwo(qualifierCount)
    for (let round = firstRound; round >= 2; round /= 2) {
      for (let order = 1; order <= round / 2; order++) {
        const key = `legacy-${round}-${order}`
        const match = legacyMatches.find((item) => item.round === round && item.order === order)
        if (match?.homeId) assignmentMap[`${key}-home`] = match.homeId
        if (match?.awayId) assignmentMap[`${key}-away`] = match.awayId
        if (match || round === firstRound) continue
        const homeFeeder = legacyMatches.find((item) => item.round === round * 2 && item.order === order * 2 - 1)
        const awayFeeder = legacyMatches.find((item) => item.round === round * 2 && item.order === order * 2)
        const homeWinner = homeFeeder ? resolveKnockoutWinner(homeFeeder) : null
        const awayWinner = awayFeeder ? resolveKnockoutWinner(awayFeeder) : null
        if (homeWinner) assignmentMap[`${key}-home`] = homeWinner
        if (awayWinner) assignmentMap[`${key}-away`] = awayWinner
      }
    }
  }
  if (displayChampion?.id) assignmentMap.champion = displayChampion.id
  const assignmentSignature = Object.entries(assignmentMap).map(([key, value]) => `${key}:${value}`).join('|')

  useLayoutEffect(() => {
    if (!rootRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      timeline
        .from('.roadmap-hero-copy > *', { y: 24, opacity: 0, duration: 0.65, stagger: 0.08 })
        .from('.roadmap-hero-art', { scale: 0.82, opacity: 0, rotation: 4, duration: 0.9, ease: 'back.out(1.25)' }, '-=.42')
        .from('.roadmap-overview > *', { y: 14, opacity: 0, duration: 0.45, stagger: 0.06 }, '-=.42')
        .from('[data-roadmap-node]', { y: 22, scale: 0.975, opacity: 0, duration: 0.55, stagger: 0.045 }, '-=.1')
      timeline.eventCallback('onComplete', () => window.dispatchEvent(new Event('roadmap:remeasure')))
      gsap.to('.roadmap-hero-ring--one', { rotation: '+=360', duration: 24, repeat: -1, ease: 'none' })
      gsap.to('.roadmap-hero-ring--two', { rotation: '-=360', duration: 34, repeat: -1, ease: 'none' })
    }, rootRef)
    return () => context.revert()
  }, [t.state.tournamentNumber, modern])

  useLayoutEffect(() => {
    if (!rootRef.current || !displayChampion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const context = gsap.context(() => {
      gsap.to('.roadmap-champion-halo', { scale: 1.08, opacity: 0.75, duration: 2.3, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, rootRef)
    return () => context.revert()
  }, [displayChampion?.id])

  useLayoutEffect(() => {
    const previous = previousAssignments.current
    previousAssignments.current = assignmentMap
    if (!rootRef.current || previous === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const changed = Object.entries(assignmentMap).filter(([key, value]) => value && previous[key] !== value)
    const context = gsap.context(() => {
      changed.forEach(([key]) => {
        const target = rootRef.current?.querySelector(`[data-slot-key="${key}"]`)
        if (!target) return
        gsap.timeline()
          .fromTo(target, { scale: 0.8, boxShadow: '0 0 0 rgba(69,215,255,0)' }, {
            scale: 1,
            boxShadow: '0 0 34px rgba(69,215,255,.28)',
            duration: 0.5,
            ease: 'back.out(1.7)',
          })
          .to(target, { boxShadow: '0 0 0 rgba(69,215,255,0)', duration: 0.32, clearProps: 'boxShadow,transform' })
      })
    }, rootRef)
    return () => context.revert()
  }, [assignmentSignature])

  return (
    <main className="page roadmap-page" ref={rootRef}>
      <section className="roadmap-hero">
        <div className="roadmap-hero-copy">
          <p className="eyebrow"><span /> THE TOURNAMENT, MAPPED LIVE</p>
          <h1>Road to<br /><em>glory</em></h1>
          <p>Every team starts here. Follow each qualification, setback and victory as the championship tree builds itself in real time.</p>
          <div className="roadmap-live-line"><Radio /><span className={`roadmap-live-state roadmap-live-state--${t.liveStatus || 'local'}`}>{String(t.liveStatus || 'local').toUpperCase()}</span><i />TOURNAMENT #{String(t.state.tournamentNumber).padStart(2, '0')}</div>
        </div>
        <div className="roadmap-hero-art" aria-hidden="true">
          <div className="roadmap-hero-ring roadmap-hero-ring--one" />
          <div className="roadmap-hero-ring roadmap-hero-ring--two" />
          <div className="roadmap-hero-trophy"><Trophy /></div>
          <Sparkles className="roadmap-spark roadmap-spark--one" />
          <Sparkles className="roadmap-spark roadmap-spark--two" />
        </div>
      </section>

      <section className="roadmap-overview" aria-label="Tournament roadmap status">
        <article><small>CURRENT PHASE</small><strong>{t.state.stage}</strong><span><i className={t.state.status === 'completed' ? 'is-complete' : 'is-live'} /> {t.state.status === 'completed' ? 'COMPLETE' : 'IN PROGRESS'}</span></article>
        <article><small>QUALIFIERS</small><strong>{modern ? `${qualifierEntries.length} / 6` : legacyQualifierCount}</strong><span><Users /> LOCKED BY RESULTS</span></article>
        <article><small>{modern ? 'KNOCKOUT LEAGUE' : 'KNOCKOUT TREE'}</small><strong>{modern ? `${t.completedKnockoutStageMatches ?? 0} / 15` : `${t.completedKnockoutMatches ?? 0}`}</strong><span><Swords /> MATCHES DECIDED</span></article>
        <article><small>PLAYOFF PATH</small><strong>{modern ? `${completedPlayoffs} / 4` : `${completedMilestones} / ${milestones.length}`}</strong><span><Trophy /> ROAD TO FINAL</span></article>
        <div className="roadmap-overview-progress" role="progressbar" aria-label="Tournament journey complete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        <b className="roadmap-overview-percent">{progress}% JOURNEY COMPLETE</b>
      </section>

      <div className="roadmap-key">
        <div><span className="roadmap-key-dot is-live" />ACTIVE PATH</div>
        <div><span className="roadmap-key-dot is-complete" />CONFIRMED</div>
        <div><span className="roadmap-key-dot is-locked" />TBA / LOCKED</div>
        <p>{modern ? 'GROUPS → QUALIFIERS → KNOCKOUT LEAGUE → PLAYOFFS → CHAMPION' : 'GROUPS → KNOCKOUT ROUNDS → FINAL → CHAMPION'}</p>
      </div>

      {modern ? <ModernRoadmapBoard t={t} /> : <LegacyRoadmapBoard t={t} />}
    </main>
  )
}
