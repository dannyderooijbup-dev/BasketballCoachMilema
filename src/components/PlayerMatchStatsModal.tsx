/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Download, 
  Trophy, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Activity, 
  Award,
  Users,
  Search,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react';
import { MatchHistoryEntry, Player, Team } from '../types';
import { formatTime, formatDate, calculatePercentage } from '../utils';
import { exportPlayerMatchLogToPDF } from '../pdfUtils';

interface PlayerMatchStatsModalProps {
  player: { id?: string; name: string; number: string; position?: string };
  allPlayers: Player[];
  history: MatchHistoryEntry[];
  theme: 'dark' | 'light';
  activeTeamId: string;
  teams: Team[];
  onClose: () => void;
  onSelectPlayer: (player: { id?: string; name: string; number: string; position?: string }) => void;
  onOpenMatchDetail: (match: MatchHistoryEntry) => void;
}

type SortField = 'date' | 'points' | 'totalTime' | 'plusMinus' | 'rebounds' | 'assists';

export const PlayerMatchStatsModal: React.FC<PlayerMatchStatsModalProps> = ({
  player,
  allPlayers,
  history,
  theme,
  activeTeamId,
  teams,
  onClose,
  onSelectPlayer,
  onOpenMatchDetail
}) => {
  const [selectedSeason, setSelectedSeason] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Filter matches in which this player participated
  const playerMatches = useMemo(() => {
    return history
      .filter(m => {
        // Season filter
        const matchSeason = m.season || '2026/2027';
        if (selectedSeason !== 'All' && matchSeason !== selectedSeason) {
          return false;
        }

        // Check if player participated in this match
        const found = m.players.some(p => 
          (player.id && p.id === player.id) || 
          p.name.trim().toLowerCase() === player.name.trim().toLowerCase()
        );
        return found;
      })
      .map(m => {
        const playerStats = m.players.find(p => 
          (player.id && p.id === player.id) || 
          p.name.trim().toLowerCase() === player.name.trim().toLowerCase()
        )!;

        const isStarter = Array.isArray(m.starting5) && m.starting5.some(s => 
          s.startsWith(`#${player.number} `) || 
          s.includes(player.name) || 
          s.includes(playerStats.name)
        );

        const hasScore = m.teamScore !== undefined && m.opponentScore !== undefined;
        const isWin = hasScore && (m.teamScore! > m.opponentScore!);
        const isLoss = hasScore && (m.teamScore! < m.opponentScore!);

        return {
          match: m,
          playerStats,
          isStarter,
          isWin,
          isLoss
        };
      });
  }, [history, player, selectedSeason]);

  // Filtered and sorted matches
  const displayedMatches = useMemo(() => {
    let list = [...playerMatches];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(pm => 
        pm.match.opponent.toLowerCase().includes(q) ||
        formatDate(pm.match.date).toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;

      switch (sortField) {
        case 'date':
          valA = a.match.date;
          valB = b.match.date;
          break;
        case 'points':
          valA = a.playerStats.stats.points || 0;
          valB = b.playerStats.stats.points || 0;
          break;
        case 'totalTime':
          valA = a.playerStats.totalTime || 0;
          valB = b.playerStats.totalTime || 0;
          break;
        case 'plusMinus':
          valA = a.playerStats.stats.plusMinus || 0;
          valB = b.playerStats.stats.plusMinus || 0;
          break;
        case 'rebounds':
          valA = a.playerStats.stats.rebounds || 0;
          valB = b.playerStats.stats.rebounds || 0;
          break;
        case 'assists':
          valA = a.playerStats.stats.assists || 0;
          valB = b.playerStats.stats.assists || 0;
          break;
      }

      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [playerMatches, searchQuery, sortField, sortAsc]);

  // Aggregate statistics for this player across the filtered matches
  const aggregates = useMemo(() => {
    const totalMatches = playerMatches.length;
    if (totalMatches === 0) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        totalTime: 0,
        avgTime: 0,
        totalPoints: 0,
        ppg: '0.0',
        highPoints: 0,
        totalFgm: 0,
        totalFga: 0,
        total3Fgm: 0,
        total3Fga: 0,
        totalFtm: 0,
        totalFta: 0,
        totalReb: 0,
        totalOffReb: 0,
        totalDefReb: 0,
        rpg: '0.0',
        totalAst: 0,
        apg: '0.0',
        totalStl: 0,
        spg: '0.0',
        totalBlk: 0,
        bpg: '0.0',
        totalTo: 0,
        tpg: '0.0',
        totalPf: 0,
        pfpg: '0.0',
        totalPlusMinus: 0,
        avgPlusMinus: '0.0',
        starterCount: 0
      };
    }

    let wins = 0;
    let losses = 0;
    let totalTime = 0;
    let totalPoints = 0;
    let highPoints = 0;
    let totalFgm = 0, totalFga = 0;
    let total3Fgm = 0, total3Fga = 0;
    let totalFtm = 0, totalFta = 0;
    let totalReb = 0, totalOffReb = 0, totalDefReb = 0;
    let totalAst = 0, totalStl = 0, totalBlk = 0, totalTo = 0, totalPf = 0;
    let totalPlusMinus = 0;
    let starterCount = 0;

    playerMatches.forEach(pm => {
      if (pm.isWin) wins++;
      if (pm.isLoss) losses++;
      if (pm.isStarter) starterCount++;

      const st = pm.playerStats.stats;
      totalTime += pm.playerStats.totalTime || 0;
      const pts = st.points || 0;
      totalPoints += pts;
      if (pts > highPoints) highPoints = pts;

      totalFgm += st.fgm || 0;
      totalFga += st.fga || 0;
      total3Fgm += st.threeFgm || 0;
      total3Fga += st.threeFga || 0;
      totalFtm += st.ftm || 0;
      totalFta += st.fta || 0;

      totalReb += st.rebounds || 0;
      totalOffReb += st.offReb || 0;
      totalDefReb += st.defReb || 0;

      totalAst += st.assists || 0;
      totalStl += st.steals || 0;
      totalBlk += st.blocks || 0;
      totalTo += st.turnovers || 0;
      totalPf += st.pf || 0;
      totalPlusMinus += st.plusMinus || 0;
    });

    return {
      totalMatches,
      wins,
      losses,
      totalTime,
      avgTime: totalTime / totalMatches,
      totalPoints,
      ppg: (totalPoints / totalMatches).toFixed(1),
      highPoints,
      totalFgm,
      totalFga,
      total3Fgm,
      total3Fga,
      totalFtm,
      totalFta,
      totalReb,
      totalOffReb,
      totalDefReb,
      rpg: (totalReb / totalMatches).toFixed(1),
      totalAst,
      apg: (totalAst / totalMatches).toFixed(1),
      totalStl,
      spg: (totalStl / totalMatches).toFixed(1),
      totalBlk,
      bpg: (totalBlk / totalMatches).toFixed(1),
      totalTo,
      tpg: (totalTo / totalMatches).toFixed(1),
      totalPf,
      pfpg: (totalPf / totalMatches).toFixed(1),
      totalPlusMinus,
      avgPlusMinus: (totalPlusMinus / totalMatches).toFixed(1),
      starterCount
    };
  }, [playerMatches]);

  const handleDownloadPDF = () => {
    const matchData = playerMatches.map(pm => ({
      match: pm.match,
      playerStats: pm.playerStats
    }));

    exportPlayerMatchLogToPDF(
      {
        name: player.name,
        number: player.number,
        position: player.position || 'Speler'
      },
      matchData,
      theme,
      selectedSeason
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark/95 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-surface w-full max-w-5xl max-h-[96vh] sm:max-h-[92vh] sm:rounded-3xl border-t sm:border border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-white/5 p-4 sm:p-6 border-b border-white/5 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Player Info with Switcher */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-display font-black text-xl sm:text-2xl italic shadow-lg shadow-primary/20 shrink-0">
                #{player.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl sm:text-2xl font-display font-black italic uppercase tracking-tighter truncate text-white">
                    {player.name}
                  </h3>
                  <span className="text-[10px] text-text-muted bg-dark/60 border border-white/10 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                    {player.position || 'Speler'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Speler wisselen:</span>
                  <select
                    value={player.id || player.name}
                    onChange={(e) => {
                      const selected = allPlayers.find(p => p.id === e.target.value || p.name === e.target.value);
                      if (selected) {
                        onSelectPlayer(selected);
                      }
                    }}
                    className="bg-dark border border-white/10 rounded-lg px-2 py-0.5 text-xs text-primary font-bold cursor-pointer focus:outline-none focus:border-primary"
                  >
                    {allPlayers.map(p => (
                      <option key={p.id || p.name} value={p.id || p.name}>
                        #{p.number} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions: Season Filter, PDF Export, Close */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 bg-dark/70 border border-white/10 rounded-xl px-2.5 py-1.5">
                <span className="text-[10px] text-text-muted uppercase font-black tracking-wider">Seizoen:</span>
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="bg-transparent border-none text-white text-xs font-bold cursor-pointer focus:outline-none"
                >
                  <option value="All" className="bg-dark text-white">Alle Seizoenen</option>
                  <option value="2026/2027" className="bg-dark text-white">2026/2027</option>
                  <option value="2025/2026" className="bg-dark text-white">2025/2026</option>
                  <option value="2024/2025" className="bg-dark text-white">2024/2025</option>
                </select>
              </div>

              {playerMatches.length > 0 && (
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-3 py-1.5 rounded-xl text-xs font-black uppercase italic font-display transition-all active:scale-95 shadow-md shadow-primary/5"
                  title="Exporteer wedstrijden van deze speler naar PDF"
                >
                  <Download size={15} />
                  <span className="hidden xs:inline">PDF</span>
                </button>
              )}

              <button 
                onClick={onClose} 
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-text-muted hover:text-white transition-colors active:scale-90"
                title="Sluiten"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">

          {/* Aggregated KPI Summary Grid */}
          <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-primary/20 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-white/5 pb-3">
              <div>
                <h4 className="font-display font-black uppercase italic tracking-tight text-sm sm:text-base text-primary flex items-center gap-2">
                  <Award size={18} />
                  Gemiddelden & Totalen ({selectedSeason === 'All' ? 'Alle Seizoenen' : selectedSeason})
                </h4>
                <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mt-0.5">
                  Gebaseerd op {aggregates.totalMatches} gespeelde {aggregates.totalMatches === 1 ? 'wedstrijd' : 'wedstrijden'}
                  {aggregates.starterCount > 0 && ` (${aggregates.starterCount}x basisopstelling)`}
                </p>
              </div>
              <div className="text-left sm:text-right flex items-center gap-3">
                {aggregates.totalMatches > 0 && (
                  <div className="flex items-center gap-1.5 bg-dark/50 border border-white/10 px-3 py-1 rounded-xl">
                    <Trophy size={14} className="text-amber-400" />
                    <span className="text-xs font-mono font-black text-white">
                      {aggregates.wins}W - {aggregates.losses}V
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider block">Speeltijd Totaal</span>
                  <span className="font-mono text-sm sm:text-base font-black text-white">{formatTime(aggregates.totalTime)}</span>
                </div>
              </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
              <div className="bg-dark/60 p-3 rounded-2xl border border-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">PTN / Wedstrijd</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-primary mt-0.5">{aggregates.ppg}</p>
                <p className="text-[9px] text-text-muted/70 mt-0.5 font-bold">{aggregates.totalPoints} ptn (High: {aggregates.highPoints})</p>
              </div>

              <div className="bg-dark/60 p-3 rounded-2xl border border-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">Speeltijd Gem.</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-white mt-0.5">{formatTime(aggregates.avgTime)}</p>
                <p className="text-[9px] text-text-muted/70 mt-0.5 font-bold">per wedstrijd</p>
              </div>

              <div className="bg-dark/60 p-3 rounded-2xl border border-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">FG% (Veld)</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-white mt-0.5">{calculatePercentage(aggregates.totalFgm, aggregates.totalFga)}</p>
                <p className="text-[9px] text-text-muted/70 mt-0.5 font-bold">{aggregates.totalFgm}/{aggregates.totalFga}</p>
              </div>

              <div className="bg-dark/60 p-3 rounded-2xl border border-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">3P% (Driepunter)</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-white mt-0.5">{calculatePercentage(aggregates.total3Fgm, aggregates.total3Fga)}</p>
                <p className="text-[9px] text-text-muted/70 mt-0.5 font-bold">{aggregates.total3Fgm}/{aggregates.total3Fga}</p>
              </div>

              <div className="bg-dark/60 p-3 rounded-2xl border border-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">FT% (Vrije Worp)</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-white mt-0.5">{calculatePercentage(aggregates.totalFtm, aggregates.totalFta)}</p>
                <p className="text-[9px] text-text-muted/70 mt-0.5 font-bold">{aggregates.totalFtm}/{aggregates.totalFta}</p>
              </div>

              <div className="bg-dark/60 p-3 rounded-2xl border border-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">Plus / Minus (+/-)</p>
                <p className={`text-xl sm:text-2xl font-mono font-black mt-0.5 ${
                  aggregates.totalPlusMinus > 0 ? 'text-green-400' : aggregates.totalPlusMinus < 0 ? 'text-red-400' : 'text-white'
                }`}>
                  {aggregates.totalPlusMinus > 0 ? `+${aggregates.totalPlusMinus}` : aggregates.totalPlusMinus}
                </p>
                <p className="text-[9px] text-text-muted/70 mt-0.5 font-bold">gem. {aggregates.avgPlusMinus}</p>
              </div>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="bg-dark/40 px-3 py-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-text-muted uppercase font-bold">REB Gem.</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white">{aggregates.rpg} ({aggregates.totalReb})</span>
              </div>
              <div className="bg-dark/40 px-3 py-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-text-muted uppercase font-bold">AST Gem.</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white">{aggregates.apg} ({aggregates.totalAst})</span>
              </div>
              <div className="bg-dark/40 px-3 py-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-text-muted uppercase font-bold">STL Gem.</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white">{aggregates.spg} ({aggregates.totalStl})</span>
              </div>
              <div className="bg-dark/40 px-3 py-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-text-muted uppercase font-bold">BLK Gem.</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white">{aggregates.bpg} ({aggregates.totalBlk})</span>
              </div>
              <div className="bg-dark/40 px-3 py-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-text-muted uppercase font-bold">TO Gem.</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white">{aggregates.tpg} ({aggregates.totalTo})</span>
              </div>
              <div className="bg-dark/40 px-3 py-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-text-muted uppercase font-bold">PF Gem.</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-red-400">{aggregates.pfpg} ({aggregates.totalPf})</span>
              </div>
            </div>
          </div>

          {/* Match by Match Details Table Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-lg sm:text-xl font-display font-black italic uppercase tracking-tighter text-white border-l-4 border-primary pl-3 flex items-center gap-2">
                  <Activity size={18} className="text-primary" />
                  Wedstrijden Detailoverzicht ({displayedMatches.length})
                </h4>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider pl-3 mt-0.5">
                  Statistieken per wedstrijd voor #{player.number} {player.name}
                </p>
              </div>

              {/* Search Opponent */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Zoek tegenstander..."
                    className="bg-dark border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-text-muted focus:outline-none focus:border-primary w-40 sm:w-48 transition-colors"
                  />
                </div>
              </div>
            </div>

            {displayedMatches.length === 0 ? (
              <div className="py-12 text-center bg-white/2 rounded-2xl border border-dashed border-white/10 space-y-2">
                <Users size={36} className="mx-auto text-text-muted opacity-30" />
                <p className="text-sm font-bold text-white uppercase tracking-wider">Geen wedstrijden gevonden</p>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  {playerMatches.length === 0 
                    ? `Er zijn in ${selectedSeason === 'All' ? 'alle seizoenen' : selectedSeason} geen wedstrijden geregistreerd waarin ${player.name} heeft gespeeld.`
                    : 'Er zijn geen wedstrijden die voldoen aan je zoekopdracht.'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10 shadow-xl bg-dark/40">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="bg-white/5 text-[9px] sm:text-[10px] uppercase tracking-widest text-text-muted border-b border-white/5 font-bold italic select-none">
                        <th 
                          onClick={() => handleSort('date')}
                          className="px-3 py-3 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            Datum <ArrowUpDown size={11} className={sortField === 'date' ? 'text-primary' : 'opacity-30'} />
                          </div>
                        </th>
                        <th className="px-3 py-3">Tegenstander & Uitslag</th>
                        <th className="px-3 py-3">Rol</th>
                        <th 
                          onClick={() => handleSort('totalTime')}
                          className="px-3 py-3 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            Min <ArrowUpDown size={11} className={sortField === 'totalTime' ? 'text-primary' : 'opacity-30'} />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('points')}
                          className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-primary font-black"
                        >
                          <div className="flex items-center gap-1">
                            PTN <ArrowUpDown size={11} className={sortField === 'points' ? 'text-primary' : 'opacity-30'} />
                          </div>
                        </th>
                        <th className="px-3 py-3">FG (M/A)</th>
                        <th className="px-3 py-3">3P (M/A)</th>
                        <th className="px-3 py-3">FT (M/A)</th>
                        <th 
                          onClick={() => handleSort('rebounds')}
                          className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-right"
                        >
                          <div className="flex items-center justify-end gap-1">
                            REB <ArrowUpDown size={11} className={sortField === 'rebounds' ? 'text-primary' : 'opacity-30'} />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('assists')}
                          className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-right"
                        >
                          <div className="flex items-center justify-end gap-1">
                            AST <ArrowUpDown size={11} className={sortField === 'assists' ? 'text-primary' : 'opacity-30'} />
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right">STL</th>
                        <th className="px-3 py-3 text-right">BLK</th>
                        <th className="px-3 py-3 text-right">TO</th>
                        <th className="px-3 py-3 text-right">PF</th>
                        <th 
                          onClick={() => handleSort('plusMinus')}
                          className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-right font-display font-black"
                        >
                          <div className="flex items-center justify-end gap-1">
                            +/- <ArrowUpDown size={11} className={sortField === 'plusMinus' ? 'text-primary' : 'opacity-30'} />
                          </div>
                        </th>
                        <th className="px-3 py-3 text-center">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedMatches.map(({ match, playerStats, isStarter, isWin, isLoss }) => {
                        const st = playerStats.stats;
                        const hasScore = match.teamScore !== undefined && match.opponentScore !== undefined;
                        const pmVal = st.plusMinus || 0;

                        return (
                          <tr 
                            key={match.matchId} 
                            className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                          >
                            {/* Datum */}
                            <td className="px-3 py-3 whitespace-nowrap text-xs text-text-muted font-medium">
                              {formatDate(match.date).split(' om ')[0]}
                            </td>

                            {/* Tegenstander & Score */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs sm:text-sm">
                                  vs {match.opponent}
                                </span>
                                {hasScore && (
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                    isWin 
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' 
                                      : isLoss 
                                        ? 'bg-red-500/15 text-red-400 border border-red-500/25' 
                                        : 'bg-white/10 text-white'
                                  }`}>
                                    {isWin ? 'W' : isLoss ? 'V' : 'G'} {match.teamScore}-{match.opponentScore}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Rol */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isStarter 
                                  ? 'bg-primary/20 text-primary border border-primary/30' 
                                  : 'bg-white/5 text-text-muted'
                              }`}>
                                {isStarter ? 'Starter' : 'Bank'}
                              </span>
                            </td>

                            {/* Speeltijd */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs sm:text-sm font-semibold text-white">
                              {formatTime(playerStats.totalTime || 0)}
                            </td>

                            {/* PTN */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono font-black text-primary text-xs sm:text-sm">
                              {st.points || 0}
                            </td>

                            {/* FG */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                              <span className="text-white font-bold">{st.fgm || 0}/{st.fga || 0}</span>
                              <span className="text-[10px] text-text-muted ml-1.5">({calculatePercentage(st.fgm || 0, st.fga || 0)})</span>
                            </td>

                            {/* 3P */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                              <span className="text-white font-bold">{st.threeFgm || 0}/{st.threeFga || 0}</span>
                              <span className="text-[10px] text-text-muted ml-1.5">({calculatePercentage(st.threeFgm || 0, st.threeFga || 0)})</span>
                            </td>

                            {/* FT */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                              <span className="text-white font-bold">{st.ftm || 0}/{st.fta || 0}</span>
                              <span className="text-[10px] text-text-muted ml-1.5">({calculatePercentage(st.ftm || 0, st.fta || 0)})</span>
                            </td>

                            {/* REB */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-right">
                              <span className="text-white font-bold">{st.rebounds || 0}</span>
                              <span className="text-[9px] text-text-muted ml-1">({st.offReb || 0}o/{st.defReb || 0}d)</span>
                            </td>

                            {/* AST */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-right font-bold text-white">
                              {st.assists || 0}
                            </td>

                            {/* STL */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-right text-text-muted">
                              {st.steals || 0}
                            </td>

                            {/* BLK */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-right text-text-muted">
                              {st.blocks || 0}
                            </td>

                            {/* TO */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-right text-text-muted">
                              {st.turnovers || 0}
                            </td>

                            {/* PF */}
                            <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-right font-semibold text-red-400">
                              {st.pf || 0}
                            </td>

                            {/* +/- */}
                            <td className={`px-3 py-3 whitespace-nowrap font-mono text-xs text-right font-bold ${
                              pmVal > 0 ? 'text-green-400' : pmVal < 0 ? 'text-red-400' : 'text-white'
                            }`}>
                              {pmVal > 0 ? `+${pmVal}` : pmVal}
                            </td>

                            {/* Bekijk Match Knop */}
                            <td className="px-3 py-3 whitespace-nowrap text-center">
                              <button
                                onClick={() => {
                                  onClose();
                                  onOpenMatchDetail(match);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg transition-all active:scale-95"
                                title="Open volledige wedstrijdstatistieken"
                              >
                                Match <ExternalLink size={11} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
