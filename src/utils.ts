/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, Stats } from './types';

export const INITIAL_STATS: Stats = {
  points: 0,
  assists: 0,
  rebounds: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0
};

export function formatTime(ms: number): string {
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
