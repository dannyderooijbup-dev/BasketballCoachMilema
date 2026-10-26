/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, PlayerShift, Stats, MatchHistoryEntry, LineupStint, LineupGroupStat, CombinationStats } from './types';

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

/**
 * Returns all lineup stints for a match.
 * Uses explicit `lineupStints` if present, or reconstructs them from player sessions/shifts.
 */
export function getMatchLineupStints(match: MatchHistoryEntry): LineupStint[] {
  // 1. If explicit lineupStints were recorded, return them
  if (Array.isArray(match.lineupStints) && match.lineupStints.length > 0) {
    return match.lineupStints.filter(s => s && Array.isArray(s.playerIds) && s.playerIds.length > 0);
  }

  // 2. Reconstruct from player sessions if available
  const allSessions: { playerId: string; name: string; number: string; start: number; end: number }[] = [];

  if (Array.isArray(match.players)) {
    match.players.forEach(p => {
      if (Array.isArray(p.sessions)) {
        p.sessions.forEach(s => {
          if (s && typeof s.start === 'number' && typeof s.end === 'number' && s.end > s.start) {
            allSessions.push({
              playerId: p.id,
              name: p.name,
              number: p.number,
              start: s.start,
              end: s.end
            });
          }
        });
      }
    });
  }

  if (allSessions.length > 0) {
    const boundaries = Array.from(new Set(allSessions.flatMap(s => [s.start, s.end]))).sort((a, b) => a - b);
    const rawStints: LineupStint[] = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const tStart = boundaries[i];
      const tEnd = boundaries[i + 1];
      const duration = tEnd - tStart;
      if (duration < 1000) continue; // ignore sub-second noise

      const activePlayers = match.players.filter(p => {
        return (p.sessions || []).some(s => s && s.start <= tStart && s.end >= tEnd);
      });

      if (activePlayers.length > 0) {
        const sortedActive = [...activePlayers].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
        const playerIds = sortedActive.map(p => p.id);
        const playerNames = sortedActive.map(p => `#${p.number} ${p.name}`);

        const totalTime = match.totalMatchTime > 0 ? match.totalMatchTime : Math.max(1, (boundaries[boundaries.length - 1] - boundaries[0]));
        const fraction = Math.min(1, Math.max(0, duration / totalTime));
        const teamPts = Math.round((match.teamScore || 0) * fraction);
        const oppPts = Math.round((match.opponentScore || 0) * fraction);

        rawStints.push({
          id: `stint-${tStart}-${tEnd}`,
          playerIds,
          playerNames,
          duration,
          teamPoints: teamPts,
          opponentPoints: oppPts,
          plusMinus: teamPts - oppPts,
          startTime: tStart,
          endTime: tEnd
        });
      }
    }

    // Merge consecutive stints with identical lineups
    const merged: LineupStint[] = [];
    rawStints.forEach(stint => {
      const last = merged[merged.length - 1];
      const isSameLineup = last &&
        last.playerIds.length === stint.playerIds.length &&
        last.playerIds.every((id, idx) => id === stint.playerIds[idx]);

      if (isSameLineup) {
        last.duration += stint.duration;
        last.teamPoints += stint.teamPoints;
        last.opponentPoints += stint.opponentPoints;
        last.plusMinus += stint.plusMinus;
        last.endTime = stint.endTime;
      } else {
        merged.push({ ...stint });
      }
    });

    if (merged.length > 0) {
      return merged;
    }
  }

  // 3. Fallback for matches without sessions: use starters / active players
  const starters = (match.players || [])
    .filter(p => (p.totalTime || 0) > 0)
    .slice(0, 5)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  if (starters.length > 0) {
    const diff = (match.teamScore || 0) - (match.opponentScore || 0);
    return [{
      id: `fallback-${match.matchId}`,
      playerIds: starters.map(p => p.id),
      playerNames: starters.map(p => `#${p.number} ${p.name}`),
      duration: match.totalMatchTime || 2400000,
      teamPoints: match.teamScore || 0,
      opponentPoints: match.opponentScore || 0,
      plusMinus: diff,
      startTime: match.date,
      endTime: match.date + (match.totalMatchTime || 2400000)
    }];
  }

  return [];
}

/**
 * Calculates combined stats (+/-, minutes, points for/against) for any combination of players
 * across the provided matches (single match or season).
 */
export function calculateCombinationStats(
  matches: MatchHistoryEntry[],
  selectedPlayerIds: string[],
  allPlayersList: Player[] = []
): CombinationStats {
  const sortedIds = [...selectedPlayerIds].sort();

  const playerObjects: { id: string; name: string; number: string; position?: string }[] = sortedIds.map(id => {
    for (const m of matches) {
      const found = m.players?.find(p => p.id === id);
      if (found) return { id: found.id, name: found.name, number: found.number, position: found.position as string };
    }
    const foundAll = allPlayersList.find(p => p.id === id);
    if (foundAll) return { id: foundAll.id, name: foundAll.name, number: foundAll.number, position: foundAll.position as string };
    return { id, name: 'Speler', number: '?' };
  });

  if (sortedIds.length === 0) {
    return {
      playerIds: [],
      players: [],
      gamesCount: 0,
      totalTime: 0,
      teamPoints: 0,
      opponentPoints: 0,
      plusMinus: 0,
      netPer40: 0,
      matchBreakdown: []
    };
  }

  let totalDuration = 0;
  let totalTeamPts = 0;
  let totalOppPts = 0;
  let gamesWithLineup = 0;
  const matchBreakdown: CombinationStats['matchBreakdown'] = [];

  matches.forEach(match => {
    const stints = getMatchLineupStints(match);
    // Filter stints where ALL selected players were on the court simultaneously
    const matchingStints = stints.filter(stint =>
      sortedIds.every(reqId => stint.playerIds.includes(reqId))
    );

    if (matchingStints.length > 0) {
      gamesWithLineup++;
      const matchDuration = matchingStints.reduce((sum, s) => sum + (s.duration || 0), 0);
      const matchTeamPts = matchingStints.reduce((sum, s) => sum + (s.teamPoints || 0), 0);
      const matchOppPts = matchingStints.reduce((sum, s) => sum + (s.opponentPoints || 0), 0);
      const matchPm = matchTeamPts - matchOppPts;

      totalDuration += matchDuration;
      totalTeamPts += matchTeamPts;
      totalOppPts += matchOppPts;

      matchBreakdown.push({
        matchId: match.matchId,
        opponent: match.opponent,
        date: match.date,
        season: match.season,
        teamId: match.teamId,
        duration: matchDuration,
        teamPoints: matchTeamPts,
        opponentPoints: matchOppPts,
        plusMinus: matchPm
      });
    }
  });

  const totalPm = totalTeamPts - totalOppPts;
  const totalMinutes = totalDuration / 60000;
  const netPer40 = totalMinutes > 0 ? Number(((totalPm / totalMinutes) * 40).toFixed(1)) : 0;

  return {
    playerIds: sortedIds,
    players: playerObjects,
    gamesCount: gamesWithLineup,
    totalTime: totalDuration,
    teamPoints: totalTeamPts,
    opponentPoints: totalOppPts,
    plusMinus: totalPm,
    netPer40,
    matchBreakdown
  };
}

/**
 * Aggregates all lineup groups of a specific size (default 5-man) that appeared across matches,
 * sorted by Plus/Minus (+/-) and playing time.
 */
export function getAllLineupGroupStats(
  matches: MatchHistoryEntry[],
  size: number = 5,
  allPlayersList: Player[] = []
): LineupGroupStat[] {
  const groupMap = new Map<string, {
    playerIds: string[];
    gamesSet: Set<string>;
    totalTime: number;
    teamPoints: number;
    opponentPoints: number;
  }>();

  matches.forEach(match => {
    const stints = getMatchLineupStints(match);
    stints.forEach(stint => {
      if (size > 0 && stint.playerIds.length !== size) return;
      if (stint.playerIds.length === 0) return;

      const sortedIds = [...stint.playerIds].sort();
      const key = sortedIds.join(',');

      let group = groupMap.get(key);
      if (!group) {
        group = {
          playerIds: sortedIds,
          gamesSet: new Set(),
          totalTime: 0,
          teamPoints: 0,
          opponentPoints: 0
        };
        groupMap.set(key, group);
      }

      group.gamesSet.add(match.matchId);
      group.totalTime += stint.duration || 0;
      group.teamPoints += stint.teamPoints || 0;
      group.opponentPoints += stint.opponentPoints || 0;
    });
  });

  const results: LineupGroupStat[] = [];
  groupMap.forEach(g => {
    const playerObjects: { id: string; name: string; number: string; position?: string }[] = g.playerIds.map(id => {
      for (const m of matches) {
        const found = m.players?.find(p => p.id === id);
        if (found) return { id: found.id, name: found.name, number: found.number, position: found.position as string };
      }
      const foundAll = allPlayersList.find(p => p.id === id);
      if (foundAll) return { id: foundAll.id, name: foundAll.name, number: foundAll.number, position: foundAll.position as string };
      return { id, name: 'Speler', number: '?' };
    });

    const plusMinus = g.teamPoints - g.opponentPoints;
    const minutes = g.totalTime / 60000;
    const netPer40 = minutes > 0 ? Number(((plusMinus / minutes) * 40).toFixed(1)) : 0;

    results.push({
      key: g.playerIds.join(','),
      playerIds: g.playerIds,
      players: playerObjects,
      gamesCount: g.gamesSet.size,
      totalTime: g.totalTime,
      teamPoints: g.teamPoints,
      opponentPoints: g.opponentPoints,
      plusMinus,
      netPer40
    });
  });

  results.sort((a, b) => b.plusMinus - a.plusMinus || b.totalTime - a.totalTime);
  return results;
}
