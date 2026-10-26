/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  Activity, 
  ArrowUpDown, 
  Search, 
  X, 
  Check, 
  Layers,
  Calendar,
  Filter
} from 'lucide-react';
import { MatchHistoryEntry, Player } from '../types';
import { 
  formatTime, 
  formatDate, 
  calculateCombinationStats, 
  getAllLineupGroupStats 
} from '../utils';

interface LineupCombinationViewProps {
  matches: MatchHistoryEntry[];
  allPlayers: Player[];
  title?: string;
  isSingleMatch?: boolean;
  initialSelectedPlayerIds?: string[];
  theme?: 'dark' | 'light';
}

type LineupSortField = 'plusMinus' | 'totalTime' | 'netPer40' | 'teamPoints';

export const LineupCombinationView: React.FC<LineupCombinationViewProps> = ({
  matches,
  allPlayers,
  title,
  isSingleMatch = false,
  initialSelectedPlayerIds = []
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'lineups' | 'custom'>('lineups');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(initialSelectedPlayerIds);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [lineupSortField, setLineupSortField] = useState<LineupSortField>('plusMinus');
  const [lineupSortAsc, setLineupSortAsc] = useState<boolean>(false);
  const [minMinutesFilter, setMinMinutesFilter] = useState<number>(0);

  // Pool of players participating in these matches
  const availablePlayers = useMemo(() => {
    const map = new Map<string, Player>();

    matches.forEach(m => {
      (m.players || []).forEach(p => {
        if (p && p.id && !map.has(p.id)) {
          map.set(p.id, p);
        }
      });
    });

    // Also include from allPlayers if none found
    if (map.size === 0) {
      allPlayers.forEach(p => map.set(p.id, p));
    }

    const list = Array.from(map.values());
    list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return list;
  }, [matches, allPlayers]);

  // Filter available players by search
  const filteredAvailablePlayers = useMemo(() => {
    if (!playerSearchQuery.trim()) return availablePlayers;
    const q = playerSearchQuery.toLowerCase().trim();
    return availablePlayers.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.number.includes(q) ||
      (p.position && String(p.position).toLowerCase().includes(q))
    );
  }, [availablePlayers, playerSearchQuery]);

  // Compute 5-man lineups stats
  const all5ManLineups = useMemo(() => {
    const raw = getAllLineupGroupStats(matches, 5, availablePlayers);
    const minMs = minMinutesFilter * 60 * 1000;
    const filtered = raw.filter(l => l.totalTime >= minMs);

    filtered.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      switch (lineupSortField) {
        case 'plusMinus':
          valA = a.plusMinus;
          valB = b.plusMinus;
          break;
        case 'totalTime':
          valA = a.totalTime;
          valB = b.totalTime;
          break;
        case 'netPer40':
          valA = a.netPer40;
          valB = b.netPer40;
          break;
        case 'teamPoints':
          valA = a.teamPoints;
          valB = b.teamPoints;
          break;
      }
      return lineupSortAsc ? valA - valB : valB - valA;
    });

    return filtered;
  }, [matches, availablePlayers, minMinutesFilter, lineupSortField, lineupSortAsc]);

  // Compute stats for the custom selected player combination
  const customComboStats = useMemo(() => {
    return calculateCombinationStats(matches, selectedPlayerIds, availablePlayers);
  }, [matches, selectedPlayerIds, availablePlayers]);

  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        if (prev.length >= 5) {
          // If already 5, replace or keep max 5
          return [...prev.slice(1), playerId];
        }
        return [...prev, playerId];
      }
    });
  };

  const handleSelectLineupForCustom = (playerIds: string[]) => {
    setSelectedPlayerIds(playerIds);
    setActiveSubTab('custom');
  };

  const clearSelection = () => {
    setSelectedPlayerIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/60 border border-white/10 p-2 sm:p-2.5 rounded-2xl backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-1.5 p-1 bg-dark/60 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveSubTab('lineups')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeSubTab === 'lineups'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={14} />
            <span>Top 5-Tallen (Lineups)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('custom')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeSubTab === 'custom'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={14} />
            <span>Combinatie Analyzer (+/-)</span>
            {selectedPlayerIds.length > 0 && (
              <span className="bg-white text-primary text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                {selectedPlayerIds.length}
              </span>
            )}
          </button>
        </div>

        {title && (
          <span className="text-xs text-text-muted font-bold px-2 hidden md:inline">
            {title} ({matches.length} {matches.length === 1 ? 'wedstrijd' : 'wedstrijden'})
          </span>
        )}
      </div>

      {/* TAB 1: 5-MAN LINEUPS OVERVIEW */}
      {activeSubTab === 'lineups' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-3 sm:p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users size={15} className="text-primary" />
                5-Tallen op het Veld ({all5ManLineups.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Min minutes filter */}
              {!isSingleMatch && (
                <div className="flex items-center gap-1.5 bg-dark/70 border border-white/10 rounded-xl px-2.5 py-1">
                  <Filter size={12} className="text-primary" />
                  <span className="text-[10px] text-text-muted uppercase font-bold">Min. Speeltijd:</span>
                  <select
                    value={minMinutesFilter}
                    onChange={(e) => setMinMinutesFilter(Number(e.target.value))}
                    className="bg-transparent border-none text-white text-xs font-bold cursor-pointer focus:outline-none"
                  >
                    <option value={0} className="bg-dark text-white">Alle speeltijd</option>
                    <option value={2} className="bg-dark text-white">&gt; 2 min</option>
                    <option value={5} className="bg-dark text-white">&gt; 5 min</option>
                    <option value={10} className="bg-dark text-white">&gt; 10 min</option>
                  </select>
                </div>
              )}

              {/* Sorter */}
              <div className="flex items-center gap-1.5 bg-dark/70 border border-white/10 rounded-xl px-2.5 py-1">
                <ArrowUpDown size={12} className="text-primary" />
                <span className="text-[10px] text-text-muted uppercase font-bold">Sorteer:</span>
                <select
                  value={lineupSortField}
                  onChange={(e) => setLineupSortField(e.target.value as LineupSortField)}
                  className="bg-transparent border-none text-white text-xs font-bold cursor-pointer focus:outline-none"
                >
                  <option value="plusMinus" className="bg-dark text-white">Hoogste +/-</option>
                  <option value="totalTime" className="bg-dark text-white">Meeste Speeltijd</option>
                  <option value="netPer40" className="bg-dark text-white">Netto per 40 min</option>
                  <option value="teamPoints" className="bg-dark text-white">Punten Voor</option>
                </select>
                <button
                  type="button"
                  onClick={() => setLineupSortAsc(!lineupSortAsc)}
                  className="text-text-muted hover:text-white px-1 text-xs font-bold"
                  title="Wissel oplopend / aflopend"
                >
                  {lineupSortAsc ? '▲' : '▼'}
                </button>
              </div>
            </div>
          </div>

          {/* Lineups List / Cards */}
          {all5ManLineups.length === 0 ? (
            <div className="py-12 text-center bg-white/2 rounded-2xl border border-dashed border-white/10 space-y-2">
              <Users size={36} className="mx-auto text-text-muted opacity-30" />
              <p className="text-sm font-bold text-white uppercase tracking-wider">Geen 5-tallen gevonden</p>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Er zijn geen 5-mans opstellingen geregistreerd die voldoen aan het filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {all5ManLineups.map((lineup, idx) => {
                const isPositive = lineup.plusMinus > 0;
                const isNegative = lineup.plusMinus < 0;

                return (
                  <div
                    key={lineup.key}
                    className="bg-surface/70 hover:bg-surface/90 border border-white/5 hover:border-primary/30 p-3.5 sm:p-4 rounded-2xl transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Lineup Players */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-text-muted">
                          5-Mans Opstelling {!isSingleMatch && `• ${lineup.gamesCount} ${lineup.gamesCount === 1 ? 'wedstrijd' : 'wedstrijden'}`}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {lineup.players.map(p => (
                          <div
                            key={p.id}
                            className="flex items-center gap-1.5 bg-dark/70 border border-white/10 px-2 sm:px-2.5 py-1 rounded-xl text-xs"
                          >
                            <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                              #{p.number}
                            </span>
                            <span className="font-bold text-white truncate max-w-[110px] sm:max-w-none">
                              {p.name}
                            </span>
                            {p.position && (
                              <span className="text-[8px] text-text-muted uppercase font-bold hidden sm:inline">
                                ({p.position})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Plus/Minus and stats */}
                    <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-6 border-t md:border-t-0 border-white/5 pt-3 md:pt-0 shrink-0">
                      {/* Speeltijd */}
                      <div className="text-left md:text-right">
                        <span className="text-[9px] uppercase font-bold text-text-muted block">Speeltijd</span>
                        <span className="font-mono text-sm sm:text-base font-bold text-white">
                          {formatTime(lineup.totalTime)}
                        </span>
                      </div>

                      {/* Punten Voor / Tegen */}
                      <div className="text-center md:text-right">
                        <span className="text-[9px] uppercase font-bold text-text-muted block">Score (V - T)</span>
                        <span className="font-mono text-sm sm:text-base font-bold text-white">
                          <span className="text-primary font-black">{lineup.teamPoints}</span>
                          <span className="text-text-muted mx-1">-</span>
                          <span>{lineup.opponentPoints}</span>
                        </span>
                      </div>

                      {/* Netto +/- */}
                      <div className="text-right">
                        <span className="text-[9px] uppercase font-bold text-text-muted block">Netto +/-</span>
                        <div className={`inline-flex items-center gap-1 font-mono text-base sm:text-xl font-black px-2.5 py-0.5 rounded-xl border ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : isNegative
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-white/5 text-white border-white/10'
                        }`}>
                          {isPositive ? `+${lineup.plusMinus}` : lineup.plusMinus}
                        </div>
                        {lineup.totalTime >= 120000 && (
                          <span className="text-[9px] text-text-muted font-mono block mt-0.5">
                            {lineup.netPer40 > 0 ? `+${lineup.netPer40}` : lineup.netPer40} /40m
                          </span>
                        )}
                      </div>

                      {/* Analyseer knop */}
                      <button
                        type="button"
                        onClick={() => handleSelectLineupForCustom(lineup.playerIds)}
                        className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all active:scale-95 cursor-pointer shrink-0"
                        title="Open deze combinatie in de Analyzer voor detailinzage"
                      >
                        Analyseer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE CUSTOM COMBINATION ANALYZER */}
      {activeSubTab === 'custom' && (
        <div className="space-y-6">
          {/* Combinatie selector box */}
          <div className="bg-surface/80 border border-white/10 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-display font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                  <Layers size={18} className="text-primary" />
                  Stel een Combinatie Samen ({selectedPlayerIds.length}/5)
                </h4>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Klik op 2, 3, 4 of 5 spelers om direct hun gezamenlijke Plus/Minus (+/-) te berekenen wanneer zij tegelijk in het veld staan.
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {selectedPlayerIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer font-bold"
                  >
                    <X size={13} />
                    <span>Wis selectie</span>
                  </button>
                )}
              </div>
            </div>

            {/* Currently selected combo chips */}
            {selectedPlayerIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-dark/60 rounded-2xl border border-primary/20">
                <span className="text-[10px] uppercase font-black tracking-wider text-primary px-1">Gekozen:</span>
                {customComboStats.players.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 bg-primary/20 text-white border border-primary/40 px-2.5 py-1 rounded-xl text-xs font-bold shadow-sm"
                  >
                    <span className="text-[10px] text-primary-light font-mono">#{p.number}</span>
                    <span>{p.name}</span>
                    <button
                      type="button"
                      onClick={() => togglePlayerSelection(p.id)}
                      className="text-text-muted hover:text-white ml-0.5 p-0.5 rounded cursor-pointer"
                      title="Verwijder uit combinatie"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-dark/40 rounded-2xl border border-dashed border-white/10 text-center text-xs text-text-muted">
                Nog geen spelers geselecteerd. Klik hieronder op spelers (bijvoorbeeld Speler A, B, C, D en E) om de stat te berekenen.
              </div>
            )}

            {/* Search and player picker chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted">
                  Beschikbare Spelers ({filteredAvailablePlayers.length}):
                </span>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    placeholder="Zoek speler..."
                    className="bg-dark/80 border border-white/10 rounded-xl pl-7 pr-2.5 py-1 text-xs text-white placeholder-text-muted focus:outline-none focus:border-primary w-32 sm:w-44"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {filteredAvailablePlayers.map(player => {
                  const isSelected = selectedPlayerIds.includes(player.id);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => togglePlayerSelection(player.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02] border border-primary-light/40'
                          : 'bg-dark/70 hover:bg-dark text-text-muted hover:text-white border border-white/10'
                      }`}
                    >
                      <span className={`text-[10px] font-mono font-black ${isSelected ? 'text-white' : 'text-primary'}`}>
                        #{player.number}
                      </span>
                      <span>{player.name}</span>
                      {isSelected ? <Check size={12} className="ml-0.5 text-white" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COMBINATION RESULTS CARD */}
          {selectedPlayerIds.length > 0 && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/25 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-primary block">
                      Resultaat voor {selectedPlayerIds.length} Spelers tegelijk in het veld:
                    </span>
                    <h3 className="text-base sm:text-xl font-display font-black italic uppercase tracking-tight text-white mt-0.5">
                      {customComboStats.players.map(p => `#${p.number} ${p.name}`).join(' + ')}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-text-muted block">Gezamenlijke Speeltijd</span>
                      <span className="font-mono text-base sm:text-lg font-black text-white">
                        {formatTime(customComboStats.totalTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI metrics row */}
                <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 sm:gap-3">
                  {/* Netto +/- */}
                  <div className="bg-dark/70 p-3 sm:p-4 rounded-2xl border border-white/5 text-center relative overflow-hidden">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Netto +/-</span>
                    <span className={`text-2xl sm:text-3xl font-mono font-black block mt-0.5 ${
                      customComboStats.plusMinus > 0
                        ? 'text-emerald-400'
                        : customComboStats.plusMinus < 0
                          ? 'text-red-400'
                          : 'text-white'
                    }`}>
                      {customComboStats.plusMinus > 0 ? `+${customComboStats.plusMinus}` : customComboStats.plusMinus}
                    </span>
                    <span className="text-[9px] text-text-muted/70 block mt-0.5 font-mono">
                      {customComboStats.netPer40 > 0 ? `+${customComboStats.netPer40}` : customComboStats.netPer40} per 40 min
                    </span>
                  </div>

                  {/* Punten Voor */}
                  <div className="bg-dark/70 p-3 sm:p-4 rounded-2xl border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Punten Team</span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-primary block mt-0.5">
                      {customComboStats.teamPoints}
                    </span>
                    <span className="text-[9px] text-text-muted/70 block mt-0.5">
                      gemaakt tijdens combo
                    </span>
                  </div>

                  {/* Punten Tegen */}
                  <div className="bg-dark/70 p-3 sm:p-4 rounded-2xl border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Punten Tegen</span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-white block mt-0.5">
                      {customComboStats.opponentPoints}
                    </span>
                    <span className="text-[9px] text-text-muted/70 block mt-0.5">
                      geïncasseerd
                    </span>
                  </div>

                  {/* Wedstrijden */}
                  <div className="bg-dark/70 p-3 sm:p-4 rounded-2xl border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Wedstrijden</span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-white block mt-0.5">
                      {customComboStats.gamesCount}
                    </span>
                    <span className="text-[9px] text-text-muted/70 block mt-0.5">
                      van {matches.length} {matches.length === 1 ? 'wedstrijd' : 'wedstrijden'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Match by match breakdown if multiple matches or single match */}
              {customComboStats.matchBreakdown.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs sm:text-sm font-display font-black uppercase italic tracking-wider text-white flex items-center gap-1.5 px-1">
                    <Calendar size={14} className="text-primary" />
                    Wedstrijd Uitsplitsing ({customComboStats.matchBreakdown.length})
                  </h4>

                  <div className="overflow-hidden rounded-2xl border border-white/10 shadow-lg bg-dark/40">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/5 text-[9px] sm:text-[10px] uppercase tracking-widest text-text-muted border-b border-white/5 font-bold italic select-none">
                          <th className="px-3 py-2.5">Datum</th>
                          <th className="px-3 py-2.5">Tegenstander</th>
                          <th className="px-3 py-2.5">Speeltijd Samen</th>
                          <th className="px-3 py-2.5 text-center">Score (Team - Tegenstander)</th>
                          <th className="px-3 py-2.5 text-right font-black">Netto +/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customComboStats.matchBreakdown.map(entry => {
                          const isPos = entry.plusMinus > 0;
                          const isNeg = entry.plusMinus < 0;

                          return (
                            <tr key={entry.matchId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="px-3 py-2.5 text-xs text-text-muted font-medium whitespace-nowrap">
                                {formatDate(entry.date).split(' om ')[0]}
                              </td>
                              <td className="px-3 py-2.5 text-xs font-bold text-white whitespace-nowrap">
                                vs {entry.opponent}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs font-semibold text-white whitespace-nowrap">
                                {formatTime(entry.duration)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-center whitespace-nowrap">
                                <span className="text-primary font-bold">{entry.teamPoints}</span>
                                <span className="text-text-muted mx-1">-</span>
                                <span className="text-white">{entry.opponentPoints}</span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-right whitespace-nowrap">
                                <span className={`inline-block font-bold px-2 py-0.5 rounded-lg border text-xs ${
                                  isPos
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : isNeg
                                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                      : 'bg-white/5 text-white border-white/10'
                                }`}>
                                  {isPos ? `+${entry.plusMinus}` : entry.plusMinus}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center bg-white/2 rounded-2xl border border-dashed border-white/10 space-y-1">
                  <p className="text-sm font-bold text-white uppercase tracking-wider">Geen gezamenlijke speelminuten</p>
                  <p className="text-xs text-text-muted">
                    Deze {selectedPlayerIds.length} geselecteerde spelers hebben in de geselecteerde wedstrijden niet gelijktijdig op het veld gestaan.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
