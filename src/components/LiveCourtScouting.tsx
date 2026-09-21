import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RotateCcw, Users } from 'lucide-react';
import { Player, Stats } from '../types';
import { formatTime } from '../utils';

interface LiveCourtScoutingProps {
  filteredPlayers: Player[];
  isMatchActive: boolean;
  activeTeamId: string;
  gameClockRunning: boolean;
  getTeamBgColorClass: (teamId: string) => string;
  getNameFontSize: (name: string) => string;
  updateStat: (playerId: string, statKey: keyof Stats, delta: number) => void;
  undoLastGlobalAction: () => void;
  toggleTimer: (playerId: string) => void;
  totalPlayersCount: number;
}

function LiveStatButton({ 
  label, 
  value, 
  onAdd, 
  onSub, 
  isSpecial 
}: { 
  label: string; 
  value: string | number; 
  onAdd: () => void; 
  onSub: () => void; 
  isSpecial?: boolean;
}) {
  return (
    <div className="bg-dark/40 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/5 flex flex-col justify-between group h-full shadow-inner">
      <div className="text-[8px] sm:text-[10px] text-text-muted font-bold uppercase text-center mb-0.5 sm:mb-1 tracking-wider">{label}</div>
      <div className="text-base sm:text-xl font-display font-black text-center mb-2 sm:mb-3 text-white italic">{value}</div>
      <div className="flex gap-1.5 sm:gap-2">
        <button onClick={onAdd} className="flex-1 bg-primary text-white py-1.5 sm:py-2 rounded-lg sm:rounded-xl active:scale-90 transition-all font-black font-display shadow-lg shadow-primary/20 text-xs sm:text-base cursor-pointer">+</button>
        <button onClick={onSub} className="flex-1 bg-white/5 text-text-muted py-1.5 sm:py-2 rounded-lg sm:rounded-xl active:scale-90 transition-all font-bold text-[9px] sm:text-xs uppercase whitespace-nowrap cursor-pointer">{isSpecial ? 'ATT' : '-'}</button>
      </div>
    </div>
  );
}

function LiveStatControl({ 
  label, 
  value, 
  onAdd, 
  onSub 
}: { 
  label: string; 
  value: number; 
  onAdd: () => void; 
  onSub: () => void; 
}) {
  return (
    <div className="bg-dark/30 p-1.5 sm:p-2 rounded-xl border border-white/5 flex flex-col items-center">
      <div className="text-[8px] sm:text-[9px] text-text-muted font-bold uppercase mb-0.5 sm:mb-1 tracking-tight">{label}</div>
      <div className="text-base sm:text-lg font-display font-black mb-1 sm:mb-2 text-white italic">{value}</div>
      <div className="flex gap-1 sm:gap-1.5 w-full">
        <button onClick={onAdd} className="flex-1 bg-primary/10 text-primary py-1 sm:py-1.5 rounded-lg active:scale-90 transition-all font-black text-xs sm:text-sm border border-primary/20 cursor-pointer">+</button>
        <button onClick={onSub} className="flex-1 bg-white/5 text-text-muted py-1 sm:py-1.5 rounded-lg active:scale-90 transition-all font-bold text-[10px] sm:text-xs cursor-pointer">-</button>
      </div>
    </div>
  );
}

export const LiveCourtScouting: React.FC<LiveCourtScoutingProps> = ({
  filteredPlayers,
  isMatchActive,
  activeTeamId,
  gameClockRunning,
  getTeamBgColorClass,
  getNameFontSize,
  updateStat,
  undoLastGlobalAction,
  toggleTimer,
  totalPlayersCount
}) => {
  const renderPlayerCard = (player: Player, inField: boolean) => {
    const liveTime = player.isRunning && player.lastStartTime 
      ? player.totalTime + (Date.now() - player.lastStartTime) 
      : player.totalTime;

    return (
      <motion.div 
        key={player.id}
        layout
        className={`rounded-2xl overflow-hidden shadow-xl border transition-all ${
          inField ? 'ring-2 ring-emerald-500/40 shadow-emerald-950/20' : 'opacity-95'
        } ${getTeamBgColorClass(activeTeamId)}`}
      >
        <div className={`p-4 flex justify-between items-center border-b border-white/5 gap-2 ${
          inField ? 'bg-emerald-500/10' : 'bg-white/5'
        }`}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black flex-shrink-0 ${
                inField ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-primary/20 text-primary'
              }`}>
                #{player.number}
              </div>
              {inField && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-surface animate-pulse" title="In het veld" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className={`text-white leading-tight ${getNameFontSize(player.name)} truncate`} title={player.name}>
                  {player.name}
                </h3>
                {inField && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full shrink-0 border border-emerald-500/30">
                    In Veld
                  </span>
                )}
              </div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">{player.position}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-3xl font-mono font-black ${player.isRunning && gameClockRunning ? 'text-primary animate-pulse' : (player.isRunning ? 'text-orange-400' : 'text-white')}`}>
              {formatTime(liveTime)}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <LiveStatButton label="PTN" value={player.stats.points} onAdd={() => updateStat(player.id, 'points', 1)} onSub={() => updateStat(player.id, 'points', -1)} />
            <LiveStatButton label="FG" value={`${player.stats.fgm}/${player.stats.fga}`} onAdd={() => updateStat(player.id, 'fgm', 1)} onSub={() => updateStat(player.id, 'fga', 1)} isSpecial />
            <LiveStatButton label="3P" value={`${player.stats.threeFgm}/${player.stats.threeFga}`} onAdd={() => updateStat(player.id, 'threeFgm', 1)} onSub={() => updateStat(player.id, 'threeFga', 1)} isSpecial />
            <LiveStatButton label="FT" value={`${player.stats.ftm}/${player.stats.fta}`} onAdd={() => updateStat(player.id, 'ftm', 1)} onSub={() => updateStat(player.id, 'fta', 1)} isSpecial />
          </div>
          
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 sm:gap-3">
            <LiveStatControl label="AST" value={player.stats.assists} onAdd={() => updateStat(player.id, 'assists', 1)} onSub={() => updateStat(player.id, 'assists', -1)} />
            <LiveStatControl label="DEF REB" value={player.stats.defReb || 0} onAdd={() => updateStat(player.id, 'defReb', 1)} onSub={() => updateStat(player.id, 'defReb', -1)} />
            <LiveStatControl label="OFF REB" value={player.stats.offReb || 0} onAdd={() => updateStat(player.id, 'offReb', 1)} onSub={() => updateStat(player.id, 'offReb', -1)} />
            <LiveStatControl label="STL" value={player.stats.steals} onAdd={() => updateStat(player.id, 'steals', 1)} onSub={() => updateStat(player.id, 'steals', -1)} />
            <LiveStatControl label="BLK" value={player.stats.blocks} onAdd={() => updateStat(player.id, 'blocks', 1)} onSub={() => updateStat(player.id, 'blocks', -1)} />
            <LiveStatControl label="TO" value={player.stats.turnovers} onAdd={() => updateStat(player.id, 'turnovers', 1)} onSub={() => updateStat(player.id, 'turnovers', -1)} />
            <LiveStatControl label="PF" value={player.stats.pf || 0} onAdd={() => updateStat(player.id, 'pf', 1)} onSub={() => updateStat(player.id, 'pf', -1)} />
            <button onClick={() => undoLastGlobalAction()} className="bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-text-muted text-[10px] font-bold transition-all border border-white/5 active:scale-95 py-3 sm:py-0 cursor-pointer">
              <RotateCcw size={12} className="mr-2" /> UNDO
            </button>
          </div>

          <button 
            onClick={() => toggleTimer(player.id)}
            className={`w-full py-4 rounded-xl font-display font-black uppercase italic flex items-center justify-center gap-3 transition-all cursor-pointer ${
              player.isRunning ? 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30' : 
              'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02]'
            }`}
          >
            {player.isRunning ? <Pause size={20} strokeWidth={3} /> : <Play size={20} fill="white" strokeWidth={3} />}
            {player.isRunning ? 'Wissel Uit' : 'Wissel In'}
          </button>
        </div>
      </motion.div>
    );
  };

  if (isMatchActive) {
    const onCourtPlayers = filteredPlayers.filter(p => p.isRunning);
    const benchPlayers = filteredPlayers.filter(p => !p.isRunning);

    return (
      <div className="space-y-6">
        {/* 5 SPELERS IN HET VELD BOVENAAN */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              <h3 className="font-display font-black italic uppercase tracking-wider text-sm sm:text-base text-white">
                In het Veld ({onCourtPlayers.length}/5 Spelers)
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-2.5 py-0.5 rounded-full uppercase border border-emerald-500/30">
                Actief
              </span>
            </div>
            <div className="text-xs">
              {onCourtPlayers.length === 5 ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  ✓ 5 Spelers in het veld
                </span>
              ) : onCourtPlayers.length < 5 ? (
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  ⚠ {5 - onCourtPlayers.length} speler(s) te weinig in het veld
                </span>
              ) : (
                <span className="text-red-400 font-bold flex items-center gap-1.5">
                  ⚠ {onCourtPlayers.length} spelers (te veel) in het veld
                </span>
              )}
            </div>
          </div>

          {onCourtPlayers.length === 0 ? (
            <div className="p-8 text-center bg-dark/30 rounded-2xl border border-dashed border-white/10 text-text-muted">
              <p className="font-bold text-sm text-white mb-1">Geen spelers momenteel in het veld</p>
              <p className="text-xs">Klik hieronder op &quot;Wissel In&quot; bij 5 spelers om ze in het veld te brengen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {onCourtPlayers.map(player => renderPlayerCard(player, true))}
            </div>
          )}
        </div>

        {/* WISSELSPELERS / BANK */}
        {benchPlayers.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="text-text-muted" size={18} />
                <h3 className="font-display font-black italic uppercase tracking-wider text-sm sm:text-base text-text-muted">
                  Wisselspelers / Bank ({benchPlayers.length})
                </h3>
              </div>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                Klik &quot;Wissel In&quot; om speler in te zetten
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benchPlayers.map(player => renderPlayerCard(player, false))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredPlayers.map(player => renderPlayerCard(player, false))}
      {totalPlayersCount === 0 && (
        <div className="col-span-full py-20 text-center text-text-muted">
          <Users className="mx-auto mb-4 opacity-20" size={48} />
          <p>Geen spelers gevonden. Voeg spelers toe in het Spelers tabblad.</p>
        </div>
      )}
    </div>
  );
};
