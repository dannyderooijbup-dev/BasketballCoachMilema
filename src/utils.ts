/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, PlayerShift, Stats } from './types';

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

/**
 * Returns all shifts (speelbeurten) for a player.
 * Uses explicit `shifts` if present, falls back gracefully to `sessions` or `totalTime` for older matches.
 */
export function getPlayerShifts(player: Player): PlayerShift[] {
  if (Array.isArray(player.shifts) && player.shifts.length > 0) {
    return player.shifts.filter(s => s && typeof s.duration === 'number' && s.duration > 0);
  }
  if (Array.isArray(player.sessions) && player.sessions.length > 0) {
    const validSessions = player.sessions.filter(s => s && typeof s.duration === 'number' && s.duration > 0);
    if (validSessions.length === 0) {
      if (typeof player.totalTime === 'number' && player.totalTime > 0) {
        return [{ shiftNumber: 1, duration: player.totalTime }];
      }
      return [];
    }

    // Group sessions where the gap between the end of previous slice and start of next slice is < 2.5 minutes (e.g. timeout / clock pause during same stint)
    const groupedShifts: PlayerShift[] = [];
    let currentShift: { duration: number; startTime?: number; endTime?: number } | null = null;

    for (const sess of validSessions) {
      if (!currentShift) {
        currentShift = {
          duration: sess.duration,
          startTime: sess.start,
          endTime: sess.end
        };
      } else {
        const gap = (sess.start && currentShift.endTime) ? (sess.start - currentShift.endTime) : 0;
        if (gap >= 0 && gap <= 150000) {
          // Less than 2.5 min pause: same stint on the court
          currentShift.duration += sess.duration;
          currentShift.endTime = sess.end;
        } else {
          // Player sat on bench or long stoppage: conclude previous shift and start a new one
          groupedShifts.push({
            shiftNumber: groupedShifts.length + 1,
            duration: currentShift.duration,
            startTime: currentShift.startTime,
            endTime: currentShift.endTime
          });
          currentShift = {
            duration: sess.duration,
            startTime: sess.start,
            endTime: sess.end
          };
        }
      }
    }

    if (currentShift && currentShift.duration > 0) {
      groupedShifts.push({
        shiftNumber: groupedShifts.length + 1,
        duration: currentShift.duration,
        startTime: currentShift.startTime,
        endTime: currentShift.endTime
      });
    }

    return groupedShifts;
  }
  if (typeof player.totalTime === 'number' && player.totalTime > 0) {
    return [{
      shiftNumber: 1,
      duration: player.totalTime
    }];
  }
  return [];
}
