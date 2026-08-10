export type Phase = 'registration' | 'groups' | 'completed'

export interface Team { id: string; name: string; imageUrl: string; createdAt: string }
export interface Group { id: string; name: string; teamIds: string[] }
export interface Match { id: string; groupId: string; homeId: string; awayId: string; homeScore: number | null; awayScore: number | null; playedAt?: string }
export interface HistoryItem { id: string; tournamentNumber: number; winnerId: string; winnerName: string; completedAt: string }
export interface TournamentState {
  version: 3; tournamentNumber: number; status: Phase; stage: string; teams: Team[];
  groups: Group[]; matches: Match[]; history: HistoryItem[]; winnerId: string | null; updatedAt: string;
}
export interface Standing extends Team { position: number; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number }

