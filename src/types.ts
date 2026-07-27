export enum Position {
  Guard = 'Guard',
  Forward = 'Forward',
  Big = 'Big'
}

export interface Session {
  start: number;
  end: number;
  duration: number;
}

export interface Stats {
  points: number;
  assists: number;
  rebounds: number;
  offReb: number;
  defReb: number;
  teamReb: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  threeFgm: number;
  threeFga: number;
  ftm: number;
  fta: number;
  pf: number;
  plusMinus?: number;
}

export interface PlayerAction {
  type: keyof Stats;
  delta: number;
  compound?: boolean; // To track if this was part of a 3P or FG increment
}

export interface Player {
  id: string;
  name: string;
  number: string;
  position: Position | string;
  totalTime: number;
  isRunning: boolean;
  lastStartTime: number | null;
  sessions: Session[];
  stats: Stats;
  lastActions: PlayerAction[];
}

export interface MatchHistoryEntry {
  matchId: string;
  date: number;
  opponent: string;
  players: Player[];
  totalMatchTime: number;
  starting5?: string[];
  teamId?: string;
  opponentScore?: number;
  teamScore?: number;
  season?: string;
}

export const SEASONS = ['2026/2027', '2025/2026', '2024/2025'];
export const DEFAULT_SEASON = '2026/2027';

export type Tab = 'dashboard' | 'history' | 'players' | 'season' | 'account' | 'teams' | 'admin';

export interface AdminUser {
  id: string;
  email: string;
  naam: string;
  club: string;
  role: UserRole;
  membership: UserMembership;
  createdAt?: number | null;
  lastLogin?: number | null;
  teamCount?: number;
  playerCount?: number;
}

export interface Team {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
  colorScheme?: string;
}

export interface TeamPlayer {
  id: string;
  teamId: string;
  playerId: string;
  createdAt: number;
  role?: string;
}

export type UserRole = 'admin' | 'user';

export interface UserMembership {
  status: string;
  type: string;
  trialStart: number | null;
  trialEnd: number | null;
  approvedAt: number | null;
  approvedBy: string | null;
}

export const DEFAULT_MEMBERSHIP: UserMembership = {
  status: 'pending',
  type: 'pending',
  trialStart: null,
  trialEnd: null,
  approvedAt: null,
  approvedBy: null
};

