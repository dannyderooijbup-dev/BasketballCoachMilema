import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Trophy, 
  Calendar, 
  Clock, 
  Target, 
  Download, 
  BarChart2, 
  Shield, 
  ChevronRight,
  Flame,
  Award
} from 'lucide-react';
import { Player, MatchHistoryEntry, Team } from '../types';
import { formatTime, formatDate, calculatePercentage } from '../utils';
import { exportPlayerMatchLogToPDF } from '../pdfUtils';

interface PlayerMatchStatsModalProps {
  player: Player;
  history: MatchHistoryEntry[];
  teams: Team[];
  allPlayers?: Player[];
  theme?: string;
  onClose: () => void;
  onSelectMatch?: (match: MatchHistoryEntry) => void;
  onSelectPlayer?: (player: Player) => void;
}

export const PlayerMatchStatsModal: React.FC<PlayerMatchStatsModalProps> = ({
  player,
  history,
  teams,
  allPlayers = [],
  theme = 'dark',
  onClose,
  onSelectMatch,
  onSelectPlayer
}) => {
  const [selectedSeason, setSelectedSeason] = useState<string>('All');

  // Filter matches for this player and season
  const playerMatches = useMemo(() => {
    return history
      .filter(m => {
        const matchSeason = m.season || '2026/2027';
        if (selectedSeason !== 'All' && matchSeason !== selectedSeason) {
          return false;
        }
        // Check if player was in this match
        return m.players.some(p => 
          p.id === player.id || 
          (p.name && player.name && p.name.trim().toLowerCase() === player.name.trim().toLowerCase())
        );
      })
      .map(match => {
        const pStats = match.players.find(p => 
          p.id === player.id || 
          (p.name && player.name && p.name.trim().toLowerCase() === player.name.trim().toLowerCase())
        )!;
        const isStarter = Array.isArray(match.starting5) && 
          (match.starting5.includes(player.name) || match.starting5.includes(pStats.name));
        
        const isWin = (match.teamScore ?? 0) > (match.opponentScore ?? 0);
        const isTie = (match.teamScore ?? 0) === (match.opponentScore ?? 0);

        return {
          match,
          stats: pStats,
          isStarter,
          isWin,
          isTie
        };
      })
      .sort((a, b) => b.match.date - a.match.date); // Most recent first
  }, [history, player, selectedSeason]);

  // Aggregate stats across filtered matches
  const totals = useMemo(() => {
    const t = {
      matches: playerMatches.length,
      starterCount: 0,
      totalTime: 0,
      points: 0,
      highScore: 0,
      fgm: 0,
      fga: 0,
      threeFgm: 0,
      threeFga: 0,
      ftm: 0,
      fta: 0,
      rebounds: 0,
      offReb: 0,
      defReb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      pf: 0,
      plusMinus: 0
    };

    playerMatches.forEach(({ stats, isStarter }) => {
      if (isStarter) t.starterCount++;
      t.totalTime += stats.totalTime || 0;
      const pts = stats.stats.points || 0;
      t.points += pts;
      if (pts > t.highScore) t.highScore = pts;

      t.fgm += stats.stats.fgm || 0;
      t.fga += stats.stats.fga || 0;
      t.threeFgm += stats.stats.threeFgm || 0;
      t.threeFga += stats.stats.threeFga || 0;
      t.ftm += stats.stats.ftm || 0;
      t.fta += stats.stats.fta || 0;

      t.rebounds += stats.stats.rebounds || 0;
      t.offReb += stats.stats.offReb || 0;
      t.defReb += stats.stats.defReb || 0;
      t.assists += stats.stats.assists || 0;
      t.steals += stats.stats.steals || 0;
      t.blocks += stats.stats.blocks || 0;
      t.turnovers += stats.stats.turnovers || 0;
      t.pf += stats.stats.pf || 0;
      t.plusMinus += stats.stats.plusMinus || 0;
    });

    return t;
  }, [playerMatches]);

  const handleExportPDF = () => {
    exportPlayerMatchLogToPDF(
      player,
      playerMatches.map(pm => ({ match: pm.match, playerStats: pm.stats })),
      theme === 'light' ? 'light' : 'dark',
      selectedSeason
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-surface border border-white/10 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-surface to-dark flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-black italic text-xl sm:text-2xl shadow-inner shrink-0">
              #{player.number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-display font-black text-white italic tracking-tight">
                  {player.name}
                </h2>
                <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold bg-white/10 text-primary px-2.5 py-0.5 rounded-full">
                  {player.position}
                </span>
              </div>
              <p className="text-text-muted text-xs flex items-center gap-2 mt-0.5">
                <span>Individuele wedstrijdstatistieken</span>
                <span>•</span>
                <span className="text-white font-mono font-semibold">{totals.matches} {totals.matches === 1 ? 'wedstrijd' : 'wedstrijden'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-center">
            {/* Quick player switcher */}
            {allPlayers.length > 1 && onSelectPlayer && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-muted uppercase font-bold hidden md:inline">Speler:</span>
                <select
                  value={player.id}
                  onChange={(e) => {
                    const next = allPlayers.find(p => p.id === e.target.value);
                    if (next) onSelectPlayer(next);
                  }}
                  className="bg-dark/80 border border-white/10 text-white text-xs rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:border-primary cursor-pointer max-w-[140px] truncate"
                >
                  {allPlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.number} {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Season filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-muted uppercase font-bold hidden md:inline">Seizoen:</span>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="bg-dark/80 border border-white/10 text-white text-xs rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="All">Alle Seizoenen</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>

            {/* PDF Export */}
            {playerMatches.length > 0 && (
              <button
                onClick={handleExportPDF}
                className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 px-3 py-2 rounded-xl text-xs font-black uppercase italic font-display flex items-center gap-1.5 transition-all active:scale-95 shadow"
                title="Download rapport als PDF"
              >
                <Download size={14} />
                <span className="hidden xs:inline">PDF</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors"
              title="Sluiten"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin scrollbar-thumb-white/10">
          
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Punten Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Punten (PPG)</span>
                <Flame size={14} className="text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-primary">
                {totals.matches > 0 ? (totals.points / totals.matches).toFixed(1) : '0.0'}
              </div>
              <div className="text-[10px] text-text-muted flex items-center justify-between">
                <span>{totals.points} ptn tot</span>
                <span className="text-amber-400 font-bold" title="Hoogste wedstrijdscore">High: {totals.highScore}</span>
              </div>
            </div>

            {/* Speeltijd Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Speeltijd (MPG)</span>
                <Clock size={14} className="text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {formatTime(totals.matches > 0 ? totals.totalTime / totals.matches : 0)}
              </div>
              <div className="text-[10px] text-text-muted">
                {formatTime(totals.totalTime)} totaal
              </div>
            </div>

            {/* Driepunters (3P) Card - Met totaal aantal genomen en gemaakt! */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-primary/20 bg-primary/[0.03] space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary">3-Pointers (3P)</span>
                <Target size={14} className="text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {calculatePercentage(totals.threeFgm, totals.threeFga)}
              </div>
              <div className="text-[10px] text-primary font-mono font-semibold">
                {totals.threeFgm}/{totals.threeFga} gemaakt/tot
              </div>
              {totals.matches > 0 && (
                <div className="text-[9px] text-text-muted">
                  {(totals.threeFgm / totals.matches).toFixed(1)}/{(totals.threeFga / totals.matches).toFixed(1)} per w
                </div>
              )}
            </div>

            {/* Vrije Worpen (FT) Card - Met totaal aantal genomen en gemaakt! */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-primary/20 bg-primary/[0.03] space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Vrije Worpen (FT)</span>
                <Award size={14} className="text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {calculatePercentage(totals.ftm, totals.fta)}
              </div>
              <div className="text-[10px] text-primary font-mono font-semibold">
                {totals.ftm}/{totals.fta} gemaakt/tot
              </div>
              {totals.matches > 0 && (
                <div className="text-[9px] text-text-muted">
                  {(totals.ftm / totals.matches).toFixed(1)}/{(totals.fta / totals.matches).toFixed(1)} per w
                </div>
              )}
            </div>

            {/* Veldscores (FG) Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Veldscores (FG)</span>
                <Target size={14} className="text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {calculatePercentage(totals.fgm, totals.fga)}
              </div>
              <div className="text-[10px] text-text-muted font-mono">
                {totals.fgm}/{totals.fga} totaal
              </div>
            </div>

            {/* Rebounds Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Rebounds (RPG)</span>
                <Shield size={14} className="text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {totals.matches > 0 ? (totals.rebounds / totals.matches).toFixed(1) : '0.0'}
              </div>
              <div className="text-[10px] text-text-muted">
                {totals.defReb} DEF • {totals.offReb} OFF
              </div>
            </div>

            {/* Assists Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Assists (APG)</span>
                <BarChart2 size={14} className="text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {totals.matches > 0 ? (totals.assists / totals.matches).toFixed(1) : '0.0'}
              </div>
              <div className="text-[10px] text-text-muted">
                {totals.assists} totaal
              </div>
            </div>

            {/* Steals & Blocks Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Steals & Blocks</span>
                <Shield size={14} className="text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {totals.matches > 0 ? (totals.steals / totals.matches).toFixed(1) : '0.0'} <span className="text-xs text-text-muted">STL</span>
              </div>
              <div className="text-[10px] text-text-muted">
                {totals.matches > 0 ? (totals.blocks / totals.matches).toFixed(1) : '0.0'} BLK avg
              </div>
            </div>

            {/* Turnovers & Fouten Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Fouten & TO</span>
                <Award size={14} className="text-red-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-red-400">
                {totals.matches > 0 ? (totals.pf / totals.matches).toFixed(1) : '0.0'} <span className="text-xs text-text-muted">PF</span>
              </div>
              <div className="text-[10px] text-text-muted">
                {totals.matches > 0 ? (totals.turnovers / totals.matches).toFixed(1) : '0.0'} TO avg
              </div>
            </div>

            {/* Plus / Minus Card */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Plus / Minus</span>
                <Trophy size={14} className="text-emerald-400" />
              </div>
              <div className={`text-xl sm:text-2xl font-mono font-black ${
                totals.plusMinus > 0 ? 'text-emerald-400' : totals.plusMinus < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {totals.plusMinus > 0 ? `+${totals.plusMinus}` : totals.plusMinus}
              </div>
              <div className="text-[10px] text-text-muted">
                {totals.matches > 0 ? ((totals.plusMinus / totals.matches) > 0 ? `+${(totals.plusMinus / totals.matches).toFixed(1)}` : (totals.plusMinus / totals.matches).toFixed(1)) : '0.0'} avg
              </div>
            </div>

            {/* Starters status */}
            <div className="bg-dark/50 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[10px] uppercase font-bold tracking-wider">Starts</span>
                <Award size={14} className="text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white">
                {totals.starterCount} / {totals.matches}
              </div>
              <div className="text-[10px] text-text-muted">
                {totals.matches > 0 ? Math.round((totals.starterCount / totals.matches) * 100) : 0}% basisspeler
              </div>
            </div>
          </div>

          {/* WEDSTRIJDEN PER MATCH OVERZICHT */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                <h3 className="font-display font-black text-base sm:text-lg italic uppercase tracking-tight text-white">
                  Wedstrijden Overzicht ({playerMatches.length})
                </h3>
              </div>
              <span className="text-xs text-text-muted">
                Gesorteerd op meest recent
              </span>
            </div>

            {playerMatches.length === 0 ? (
              <div className="py-16 text-center text-text-muted bg-dark/30 rounded-2xl border border-dashed border-white/10 p-6">
                <Calendar className="mx-auto mb-3 opacity-20" size={40} />
                <p className="font-bold text-white text-sm uppercase tracking-wider mb-1">
                  Geen gespeelde wedstrijden gevonden
                </p>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  Deze speler heeft nog geen wedstrijdminuten geregistreerd in het geselecteerde seizoen ({selectedSeason}).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-dark/40 shadow-xl scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[980px]">
                  <thead>
                    <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-text-muted border-b border-white/5 font-bold italic">
                      <th className="px-3.5 py-3">Datum & Wedstrijd</th>
                      <th className="px-3 py-3 text-center">Uitslag</th>
                      <th className="px-3 py-3 text-center">Rol</th>
                      <th className="px-3 py-3">Speeltijd</th>
                      <th className="px-3 py-3 text-primary font-black">PTN</th>
                      <th className="px-3 py-3">FG (M/A)</th>
                      <th className="px-3 py-3 text-primary font-bold">3P (M/A)</th>
                      <th className="px-3 py-3 text-primary font-bold">FT (M/A)</th>
                      <th className="px-3 py-3 text-right">REB</th>
                      <th className="px-3 py-3 text-right">AST</th>
                      <th className="px-3 py-3 text-right">STL</th>
                      <th className="px-3 py-3 text-right">BLK</th>
                      <th className="px-3 py-3 text-right">TO</th>
                      <th className="px-3 py-3 text-right">PF</th>
                      <th className="px-3 py-3 text-right">+/-</th>
                      {onSelectMatch && <th className="px-3 py-3 text-center">Actie</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {playerMatches.map(({ match, stats, isStarter, isWin, isTie }) => {
                      const st = stats.stats;
                      const matchTeam = teams.find(t => t.id === match.teamId);

                      return (
                        <tr 
                          key={match.matchId}
                          className="border-b border-white/5 hover:bg-white/[0.04] transition-colors"
                        >
                          {/* Datum & Tegenstander */}
                          <td className="px-3.5 py-3.5">
                            <div className="font-bold text-white text-xs sm:text-sm leading-tight">
                              VS {match.opponent}
                            </div>
                            <div className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5">
                              <span>{formatDate(match.date).split(' om ')[0]}</span>
                              {matchTeam && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary/90 font-medium">{matchTeam.name}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Uitslag W/L */}
                          <td className="px-3 py-3.5 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`px-2 py-0.5 rounded-md font-mono font-black text-[11px] uppercase ${
                                isWin 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                  : isTie 
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {isWin ? 'W' : isTie ? 'T' : 'L'} {match.teamScore ?? 0}-{match.opponentScore ?? 0}
                              </span>
                            </div>
                          </td>

                          {/* Starter of Bank */}
                          <td className="px-3 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              isStarter 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                : 'bg-white/5 text-text-muted'
                            }`}>
                              {isStarter ? 'Starter' : 'Bank'}
                            </span>
                          </td>

                          {/* Speeltijd */}
                          <td className="px-3 py-3.5 font-mono text-xs text-white">
                            {formatTime(stats.totalTime)}
                          </td>

                          {/* Punten */}
                          <td className="px-3 py-3.5 font-mono text-sm font-black text-primary">
                            {st.points || 0}
                          </td>

                          {/* FG (Veldscore) */}
                          <td className="px-3 py-3.5 font-mono text-xs">
                            <span className="text-white font-bold">{st.fgm}/{st.fga}</span>
                            <span className="text-[10px] text-text-muted ml-1.5 font-sans">
                              ({calculatePercentage(st.fgm, st.fga)})
                            </span>
                          </td>

                          {/* 3P (Driepunters) - Gemaakt / Genomen & Percentage */}
                          <td className="px-3 py-3.5 font-mono text-xs">
                            <span className="text-white font-bold">{st.threeFgm}/{st.threeFga}</span>
                            <span className="text-[10px] text-primary/90 ml-1.5 font-sans font-semibold">
                              ({calculatePercentage(st.threeFgm, st.threeFga)})
                            </span>
                          </td>

                          {/* FT (Vrije Worpen) - Gemaakt / Genomen & Percentage */}
                          <td className="px-3 py-3.5 font-mono text-xs">
                            <span className="text-white font-bold">{st.ftm}/{st.fta}</span>
                            <span className="text-[10px] text-primary/90 ml-1.5 font-sans font-semibold">
                              ({calculatePercentage(st.ftm, st.fta)})
                            </span>
                          </td>

                          {/* REB */}
                          <td className="px-3 py-3.5 font-mono text-xs text-right">
                            <span className="font-bold text-white">{st.rebounds || 0}</span>
                            <span className="text-[9px] text-text-muted block">
                              {st.defReb || 0}D / {st.offReb || 0}O
                            </span>
                          </td>

                          {/* AST */}
                          <td className="px-3 py-3.5 font-mono text-xs text-right font-bold text-white">
                            {st.assists || 0}
                          </td>

                          {/* STL */}
                          <td className="px-3 py-3.5 font-mono text-xs text-right text-white/90">
                            {st.steals || 0}
                          </td>

                          {/* BLK */}
                          <td className="px-3 py-3.5 font-mono text-xs text-right text-white/90">
                            {st.blocks || 0}
                          </td>

                          {/* TO */}
                          <td className="px-3 py-3.5 font-mono text-xs text-right text-text-muted">
                            {st.turnovers || 0}
                          </td>

                          {/* PF */}
                          <td className="px-3 py-3.5 font-mono text-xs text-right font-semibold text-red-400">
                            {st.pf || 0}
                          </td>

                          {/* +/- */}
                          <td className={`px-3 py-3.5 font-mono text-xs text-right font-black ${
                            (st.plusMinus || 0) > 0 
                              ? 'text-emerald-400' 
                              : (st.plusMinus || 0) < 0 
                                ? 'text-red-400' 
                                : 'text-white'
                          }`}>
                            {(st.plusMinus || 0) > 0 ? `+${st.plusMinus}` : (st.plusMinus || 0)}
                          </td>

                          {/* Bekijk wedstrijd link */}
                          {onSelectMatch && (
                            <td className="px-3 py-3.5 text-center">
                              <button
                                onClick={() => {
                                  onSelectMatch(match);
                                  onClose();
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-primary hover:text-white text-text-muted transition-all active:scale-95"
                                title="Bekijk volledige wedstrijdstatistieken"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-white/10 bg-dark/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-text-muted">
            Tip: Klik op een andere speler in de selectiebalk om snel te schakelen.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold font-display uppercase tracking-wider transition-colors"
          >
            Sluiten
          </button>
        </div>
      </motion.div>
    </div>
  );
};
