export type Phase = 'registration' | 'groups' | 'knockout' | 'completed'
export type PlayoffStage = 'semifinal-1' | 'spot-semifinal' | 'semifinal-2' | 'grand-final'

export interface Team { id: string; name: string; imageUrl: string; createdAt: string }
export interface Group { id: string; name: string; teamIds: string[] }
export interface Match {
  id: string;
  groupId: string;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Admin-set Bangladesh wall-clock kickoff in YYYY-MM-DDTHH:mm format. */
  scheduledAt: string | null;
  playedAt?: string;
}
export interface RoundRobinMatch {
  id: string;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Admin-set Bangladesh wall-clock kickoff in YYYY-MM-DDTHH:mm format. */
  scheduledAt: string | null;
  playedAt?: string;
}
export interface KnockoutMatch {
  id: string;
  /** Legacy bracket size, or progression order 4 -> 3 -> 2 for semantic playoffs. */
  round: number;
  order: number;
  /** Semantic stage used by the six-team championship ladder. */
  stage?: PlayoffStage;
  homeId: string | null;
  awayId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  winnerId: string | null;
  playedAt?: string;
}
export interface HistoryItem { id: string; tournamentNumber: number; winnerId: string; winnerName: string; completedAt: string }
export interface TournamentState {
  version: 4 | 5; tournamentNumber: number; status: Phase; stage: string; teams: Team[];
  groups: Group[]; matches: Match[]; qualifiedTeamIds: string[]; knockoutStageMatches: RoundRobinMatch[];
  knockoutMatches: KnockoutMatch[]; history: HistoryItem[];
  winnerId: string | null; updatedAt: string;
}
export interface Standing extends Team { position: number; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number }
