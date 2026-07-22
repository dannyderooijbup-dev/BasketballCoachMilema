/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, Stats } from './types';

export const INITIAL_STATS: Stats = {
  points: 0,
  assists: 0,
  rebounds: 0,
  offReb: 0,
  defReb: 0,
  teamReb: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fgm: 0,
  fga: 0,
  threeFgm: 0,
  threeFga: 0,
  ftm: 0,
  fta: 0,
  pf: 0,
  plusMinus: 0
};

export function calculatePercentage(made: number, attempted: number): string {
  if (attempted === 0) return '0%';
  return Math.round((made / attempted) * 100) + '%';
}

export function formatTime(ms: number): string {
  if (isNaN(ms) || ms === undefined || ms === null || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
