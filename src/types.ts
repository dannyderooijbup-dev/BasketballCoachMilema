export enum Position {
  PG = 'PG',
  SG = 'SG',
  SF = 'SF',
  PF = 'PF',
  C = 'C'
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
  steals: number;
  blocks: number;
  turnovers: number;
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
}

export interface MatchHistoryEntry {
  matchId: string;
  date: number;
  opponent: string;
  players: Player[];
  totalMatchTime: number;
}

export type Tab = 'dashboard' | 'history' | 'players';
