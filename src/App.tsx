/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Timer, 
  Users, 
  History as HistoryIcon, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  X, 
  ChevronRight,
  Trophy,
  Activity,
  BarChart3,
  Download,
  RotateCcw
} from 'lucide-react';
import { Player, MatchHistoryEntry, Tab, Position, Session } from './types';
import { INITIAL_STATS, formatTime, formatDate, calculatePercentage } from './utils';
import { exportMatchToPDF } from './pdfUtils';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [showMatchStartModal, setShowMatchStartModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryEntry | null>(null);

  // Game Clock
  const [gameClockRunning, setGameClockRunning] = useState(false);

  // Interval for live timer re-renders
  const [_, setTick] = useState(0);

  // Ref to persist state to localStorage only when it changes
  const initialLoadDone = useRef(false);

  // Load from localStorage
  useEffect(() => {
    const savedPlayers = localStorage.getItem('players');
    const savedHistory = localStorage.getItem('matchesHistory');
    const savedMatchActive = localStorage.getItem('isMatchActive');
    const savedOpponent = localStorage.getItem('opponent');
    const savedClock = localStorage.getItem('gameClockRunning');

    if (savedPlayers) {
      let parsedPlayers: Player[] = JSON.parse(savedPlayers);

      // Auto-migrate positions
      const positionMap: Record<string, string> = {
        'PG': 'Guard', 'SG': 'Guard',
        'SF': 'Forward', 'PF': 'Forward',
        'C': 'Big'
      };

      // Restore states if app was closed while timers were running
      parsedPlayers = parsedPlayers.map(p => {
        // Migration
        if (positionMap[p.position]) {
          p.position = positionMap[p.position];
        }

        // Ensure lastActions exists
        if (!p.lastActions) {
          p.lastActions = [];
        }

        if (p.isRunning && p.lastStartTime) {
          const now = Date.now();
          const extraTime = now - p.lastStartTime;
          return {
            ...p,
            totalTime: p.totalTime + extraTime,
            lastStartTime: now
          };
        }
        return p;
      });
      setPlayers(parsedPlayers);
    }
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedMatchActive) setIsMatchActive(JSON.parse(savedMatchActive));
    if (savedOpponent) setOpponent(savedOpponent);
    if (savedClock) setGameClockRunning(JSON.parse(savedClock));

    initialLoadDone.current = true;
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!initialLoadDone.current) return;
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('matchesHistory', JSON.stringify(history));
    localStorage.setItem('isMatchActive', JSON.stringify(isMatchActive));
    localStorage.setItem('opponent', opponent);
    localStorage.setItem('gameClockRunning', JSON.stringify(gameClockRunning));
  }, [players, history, isMatchActive, opponent, gameClockRunning]);

  // Tick for UI updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const addPlayer = (name: string, number: string, position: string) => {
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name,
      number,
      position,
      totalTime: 0,
      isRunning: false,
      lastStartTime: null,
      sessions: [],
      stats: { ...INITIAL_STATS },
      lastActions: []
    };
    setPlayers([...players, newPlayer]);
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const toggleTimer = (id: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p;

      const now = Date.now();
      if (p.isRunning) {
        // Subbing out
        let newTotalTime = p.totalTime;
        let newSessions = [...p.sessions];
        if (p.lastStartTime) {
          const duration = now - p.lastStartTime;
          newTotalTime += duration;
          newSessions.push({ start: p.lastStartTime, end: now, duration });
        }
        return {
          ...p,
          isRunning: false,
          totalTime: newTotalTime,
          lastStartTime: null,
          sessions: newSessions
        };
      } else {
        // Subbing in
        return {
          ...p,
          isRunning: true,
          lastStartTime: gameClockRunning ? now : null
        };
      }
    }));
  };

  const toggleGameClock = () => {
    const newRunningState = !gameClockRunning;
    setGameClockRunning(newRunningState);
    const now = Date.now();

    setPlayers(prev => prev.map(p => {
      if (!p.isRunning) return p;

      if (!newRunningState) {
        // Pausing: save progress to totalTime and session slice if was running
        if (p.lastStartTime) {
          const duration = now - p.lastStartTime;
          return {
            ...p,
            totalTime: p.totalTime + duration,
            lastStartTime: null,
            sessions: [...p.sessions, { start: p.lastStartTime, end: now, duration }]
          };
        }
      } else {
        // Resuming: start new timing reference
        return {
          ...p,
          lastStartTime: now
        };
      }
      return p;
    }));
  };

  const updateStat = (id: string, stat: keyof Player['stats'], delta: number) => {
    if (delta < 0) return; // Prevent manual decrement, use undo instead

    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p;
      
      const newStats = { ...p.stats };
      const newActions = [...(p.lastActions || [])];

      // Advanced Logic
      if (stat === 'threeFgm') {
        newStats.threeFgm += 1;
        newStats.threeFga += 1;
        newStats.fgm += 1;
        newStats.fga += 1;
        newStats.points += 3;
        newActions.push({ type: 'threeFgm', delta: 1, compound: true });
      } else if (stat === 'threeFga') {
        newStats.threeFga += 1;
        newStats.fga += 1;
        newActions.push({ type: 'threeFga', delta: 1, compound: true });
      } else if (stat === 'fgm') {
        newStats.fgm += 1;
        newStats.fga += 1;
        newStats.points += 2;
        newActions.push({ type: 'fgm', delta: 1, compound: true });
      } else if (stat === 'ftm') {
        newStats.ftm += 1;
        newStats.fta += 1;
        newStats.points += 1;
        newActions.push({ type: 'ftm', delta: 1, compound: true });
      } else if (stat === 'fga' || stat === 'fta') {
        newStats[stat] += 1;
        newActions.push({ type: stat, delta: 1, compound: false });
      } else {
        newStats[stat] = Math.max(0, newStats[stat] + 1);
        newActions.push({ type: stat, delta: 1, compound: false });
      }

      return {
        ...p,
        stats: newStats,
        lastActions: newActions
      };
    }));
  };

  const undoLastAction = (id: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== id || !p.lastActions || p.lastActions.length === 0) return p;
      
      const lastActions = [...p.lastActions];
      const action = lastActions.pop();
      if (!action) return p;

      const newStats = { ...p.stats };
      const { type, delta } = action;

      if (type === 'threeFgm') {
        newStats.threeFgm = Math.max(0, newStats.threeFgm - 1);
        newStats.threeFga = Math.max(0, newStats.threeFga - 1);
        newStats.fgm = Math.max(0, newStats.fgm - 1);
        newStats.fga = Math.max(0, newStats.fga - 1);
        newStats.points = Math.max(0, newStats.points - 3);
      } else if (type === 'threeFga') {
        newStats.threeFga = Math.max(0, newStats.threeFga - 1);
        newStats.fga = Math.max(0, newStats.fga - 1);
      } else if (type === 'fgm') {
        newStats.fgm = Math.max(0, newStats.fgm - 1);
        newStats.fga = Math.max(0, newStats.fga - 1);
        newStats.points = Math.max(0, newStats.points - 2);
      } else if (type === 'ftm') {
        newStats.ftm = Math.max(0, newStats.ftm - 1);
        newStats.fta = Math.max(0, newStats.fta - 1);
        newStats.points = Math.max(0, newStats.points - 1);
      } else {
        newStats[type] = Math.max(0, (newStats[type] as number) - delta);
      }

      return {
        ...p,
        stats: newStats,
        lastActions: lastActions
      };
    }));
  };

  const deleteMatch = (id: string) => {
    if (confirm('Weet je zeker dat je deze wedstrijd wilt verwijderen?')) {
      setHistory(history.filter(m => m.matchId !== id));
    }
  };

  const seasonStats = useCallback(() => {
    const stats: Record<string, any> = {};
    
    history.forEach(match => {
      match.players.forEach(p => {
        if (!stats[p.name]) {
          stats[p.name] = {
            name: p.name,
            number: p.number,
            totalTime: 0,
            points: 0,
            assists: 0,
            rebounds: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            fgm: 0, fga: 0,
            threeFgm: 0, threeFga: 0,
            ftm: 0, fta: 0,
            matches: 0
          };
        }
        const s = stats[p.name];
        s.totalTime += p.totalTime;
        s.points += p.stats.points;
        s.assists += p.stats.assists;
        s.rebounds += p.stats.rebounds;
        s.steals += p.stats.steals;
        s.blocks += p.stats.blocks;
        s.turnovers += p.stats.turnovers;
        s.fgm += p.stats.fgm;
        s.fga += p.stats.fga;
        s.threeFgm += p.stats.threeFgm;
        s.threeFga += p.stats.threeFga;
        s.ftm += p.stats.ftm;
        s.fta += p.stats.fta;
        s.matches += 1;
      });
    });

    return Object.values(stats);
  }, [history]);

  const startNewMatch = () => {
    if (!opponent.trim()) return;
    setPlayers(prev => prev.map(p => ({
      ...p,
      totalTime: 0,
      isRunning: false,
      lastStartTime: null,
      sessions: [],
      stats: { ...INITIAL_STATS },
      lastActions: []
    })));
    setIsMatchActive(true);
    setShowMatchStartModal(false);
  };

  const endMatch = () => {
    // Stop all running timers first
    const now = Date.now();
    const finalPlayers = players.map(p => {
      if (p.isRunning && p.lastStartTime) {
        const duration = now - p.lastStartTime;
        return {
          ...p,
          isRunning: false,
          totalTime: p.totalTime + duration,
          lastStartTime: null,
          sessions: [...p.sessions, { start: p.lastStartTime, end: now, duration }]
        };
      }
      return p;
    });

    const totalMatchTime = finalPlayers.reduce((acc, p) => acc + p.totalTime, 0);

    const newEntry: MatchHistoryEntry = {
      matchId: crypto.randomUUID(),
      date: now,
      opponent,
      players: finalPlayers,
      totalMatchTime
    };

    setHistory([newEntry, ...history]);
    setPlayers(finalPlayers); // Update local state for reset
    setIsMatchActive(false);
    setGameClockRunning(false);
    setOpponent('');
  };

  const resetAll = () => {
    setPlayers(prev => prev.map(p => ({
      ...p,
      totalTime: 0,
      isRunning: false,
      lastStartTime: null,
      sessions: [],
      stats: { ...INITIAL_STATS },
      lastActions: []
    })));
    setIsMatchActive(false);
    setGameClockRunning(false);
    setOpponent('');
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Game Clock Control */}
      <div className="bg-surface p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${gameClockRunning ? 'bg-primary shadow-[0_0_20px_rgba(255,106,0,0.4)]' : 'bg-white/5'} transition-all`}>
            <Timer size={32} className={gameClockRunning ? 'text-white' : 'text-text-muted'} />
          </div>
          <div>
            <h2 className="text-3xl font-black font-display italic uppercase tracking-tighter">Wedstrijdklok</h2>
            <p className="text-text-muted text-xs uppercase tracking-widest font-medium">{gameClockRunning ? 'Klok Loopt' : 'Klok Gestopt'}</p>
          </div>
        </div>
        <button 
          onClick={toggleGameClock}
          className={`w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-black font-display uppercase italic transition-all active:scale-95 ${
            gameClockRunning 
              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
              : 'bg-primary text-white shadow-xl shadow-primary/30 hover:scale-[1.02]'
          }`}
        >
          {gameClockRunning ? <Pause size={24} strokeWidth={3} /> : <Play size={24} fill="white" strokeWidth={3} />}
          {gameClockRunning ? 'Pauze' : 'Start Klok'}
        </button>
      </div>

      <div className="flex justify-between items-center bg-surface p-6 rounded-2xl shadow-xl border border-white/5">
        <div>
          <h2 className="text-2xl font-display font-black text-white flex items-center gap-2 italic tracking-tighter">
            <Trophy className="text-primary" size={24} />
            {isMatchActive ? opponent.toUpperCase() : 'GEEN ACTIEVE WEDSTRIJD'}
          </h2>
          <p className="text-text-muted text-xs uppercase tracking-widest font-bold mt-1">
            {isMatchActive ? 'Live wedstrijd bezig...' : 'Start een nieuwe wedstrijd om stats te tracken'}
          </p>
        </div>
        {!isMatchActive ? (
          <button onClick={() => setShowMatchStartModal(true)} className="btn-primary flex items-center gap-2 py-2">
            <Play size={18} /> Start Match
          </button>
        ) : (
          <button onClick={endMatch} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl transition-all active:scale-95">
            Beëindigen
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {players.map(player => {
          const liveTime = player.isRunning && player.lastStartTime 
            ? player.totalTime + (Date.now() - player.lastStartTime) 
            : player.totalTime;

          return (
            <motion.div 
              key={player.id}
              layout
              className="bg-surface rounded-2xl overflow-hidden shadow-xl border border-white/10"
            >
              <div className="p-4 flex justify-between items-center bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    #{player.number}
                  </div>
                  <div>
                    <h3 className="font-bold">{player.name}</h3>
                    <span className="text-xs text-text-muted uppercase tracking-wider">{player.position}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-mono font-black ${player.isRunning && gameClockRunning ? 'text-primary animate-pulse' : (player.isRunning ? 'text-orange-400' : 'text-white')}`}>
                    {formatTime(liveTime)}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-tight">Beurten: {player.sessions.length}</div>
                </div>
              </div>

              <div className="p-4 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatButton label="PTN" value={player.stats.points} onAdd={() => updateStat(player.id, 'points', 1)} onSub={() => updateStat(player.id, 'points', -1)} />
                  <StatButton label="FG" value={`${player.stats.fgm}/${player.stats.fga}`} onAdd={() => updateStat(player.id, 'fgm', 1)} onSub={() => updateStat(player.id, 'fga', 1)} isSpecial />
                  <StatButton label="3P" value={`${player.stats.threeFgm}/${player.stats.threeFga}`} onAdd={() => updateStat(player.id, 'threeFgm', 1)} onSub={() => updateStat(player.id, 'threeFga', 1)} isSpecial />
                  <StatButton label="FT" value={`${player.stats.ftm}/${player.stats.fta}`} onAdd={() => updateStat(player.id, 'ftm', 1)} onSub={() => updateStat(player.id, 'fta', 1)} isSpecial />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <StatControl label="AST" value={player.stats.assists} onAdd={() => updateStat(player.id, 'assists', 1)} onSub={() => updateStat(player.id, 'assists', -1)} />
                  <StatControl label="REB" value={player.stats.rebounds} onAdd={() => updateStat(player.id, 'rebounds', 1)} onSub={() => updateStat(player.id, 'rebounds', -1)} />
                  <StatControl label="STL" value={player.stats.steals} onAdd={() => updateStat(player.id, 'steals', 1)} onSub={() => updateStat(player.id, 'steals', -1)} />
                  <StatControl label="BLK" value={player.stats.blocks} onAdd={() => updateStat(player.id, 'blocks', 1)} onSub={() => updateStat(player.id, 'blocks', -1)} />
                  <StatControl label="TO" value={player.stats.turnovers} onAdd={() => updateStat(player.id, 'turnovers', 1)} onSub={() => updateStat(player.id, 'turnovers', -1)} />
                  <button onClick={() => undoLastAction(player.id)} className="bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-text-muted text-xs font-bold transition-colors">
                    <RotateCcw size={14} className="mr-2" /> UNDO
                  </button>
                </div>

                <button 
                  onClick={() => toggleTimer(player.id)}
                  className={`w-full py-4 rounded-xl font-display font-black uppercase italic flex items-center justify-center gap-3 transition-all ${
                    player.isRunning ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 
                    'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02]'
                  }`}
                >
                  {player.isRunning ? <Pause size={20} strokeWidth={3} /> : <Play size={20} fill="white" strokeWidth={3} />}
                  {player.isRunning ? 'Wissel Uit' : 'Wissel In'}
                </button>
              </div>
            </motion.div>
          );
        })}
        {players.length === 0 && (
          <div className="col-span-full py-20 text-center text-text-muted">
            <Users className="mx-auto mb-4 opacity-20" size={48} />
            <p>Geen spelers gevonden. Voeg spelers toe in het Spelers tabblad.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      <h2 className="text-3xl font-display font-black italic uppercase tracking-tighter">Wedstrijdhistorie</h2>
      <div className="space-y-3">
        {history.map(match => (
          <button 
            key={match.matchId}
            onClick={() => setSelectedMatch(match)}
            className="w-full bg-surface hover:bg-white/5 transition-colors p-4 rounded-2xl flex items-center justify-between shadow-lg border border-white/5 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Trophy size={24} />
              </div>
              <div>
                <h3 className="font-display font-black uppercase italic tracking-tight text-lg">{match.opponent}</h3>
                <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">{formatDate(match.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div className="hidden sm:block">
                <p className="text-xs text-text-muted uppercase">Spelers</p>
                <p className="font-bold">{match.players.length}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteMatch(match.matchId); }}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                title="Verwijderen"
              >
                <Trash2 size={18} />
              </button>
              <ChevronRight className="text-text-muted" />
            </div>
          </button>
        ))}
        {history.length === 0 && (
          <div className="py-20 text-center text-text-muted">
            <HistoryIcon className="mx-auto mb-4 opacity-20" size={48} />
            <p>Nog geen wedstrijden gespeeld.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPlayers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-display font-black italic uppercase tracking-tighter">Spelerslijst</h2>
        <button 
          onClick={() => setShowAddPlayerModal(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-display font-black uppercase italic tracking-tighter shadow-lg shadow-primary/20 flex items-center gap-2"
        >
          <Plus size={18} /> Nieuwe Speler
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map(player => (
          <div key={player.id} className="bg-surface p-4 rounded-2xl border border-white/5 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-inner">
                #{player.number}
              </div>
              <div>
                <h3 className="font-bold">{player.name}</h3>
                <p className="text-xs text-text-muted uppercase">{player.position}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  setEditingPlayer(player);
                  setNewPlayerName(player.name);
                  setNewPlayerNumber(player.number);
                  setNewPlayerPosition(player.position as string);
                  setShowEditPlayerModal(true);
                }}
                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Plus size={18} />
              </button>
              <button 
                onClick={() => removePlayer(player.id)}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSeason = () => {
    const stats = seasonStats();
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-display font-black italic uppercase tracking-tighter">Seizoensstatistieken</h2>
        <div className="overflow-x-auto bg-surface rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-text-muted border-b border-white/5 font-bold italic">
                <th className="px-4 py-4">Speler</th>
                <th className="px-4 py-4">W</th>
                <th className="px-4 py-4">Tijd</th>
                <th className="px-4 py-4">PTN</th>
                <th className="px-4 py-4">FG%</th>
                <th className="px-4 py-4">3P%</th>
                <th className="px-4 py-4">FT%</th>
                <th className="px-4 py-4">REB</th>
                <th className="px-4 py-4">AST</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s: any) => (
                <tr key={s.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">#{s.number}</span>
                      <span className="font-medium text-sm">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-sm">{s.matches}</td>
                  <td className="px-4 py-4 font-mono text-sm">{formatTime(s.totalTime)}</td>
                  <td className="px-4 py-4 font-bold text-primary">{Math.round(s.points / s.matches)} <span className="text-[10px] text-text-muted font-normal italic">avg</span></td>
                  <td className="px-4 py-4 font-mono text-sm">{calculatePercentage(s.fgm, s.fga)}</td>
                  <td className="px-4 py-4 font-mono text-sm">{calculatePercentage(s.threeFgm, s.threeFga)}</td>
                  <td className="px-4 py-4 font-mono text-sm">{calculatePercentage(s.ftm, s.fta)}</td>
                  <td className="px-4 py-4 font-mono text-sm">{(s.rebounds / s.matches).toFixed(1)}</td>
                  <td className="px-4 py-4 font-mono text-sm">{(s.assists / s.matches).toFixed(1)}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-text-muted">Geen data beschikbaar</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('Guard');

  const updatePlayer = (id: string, name: string, number: string, position: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, name, number, position };
    }));
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-6 max-w-5xl mx-auto px-4">
      <header className="py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Logo />
            </div>
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] mt-1">Milema Webdesign × Jeremy Hooi</p>
        </div>
        <div className="flex bg-surface rounded-2xl p-1 border border-white/5 backdrop-blur-sm self-start md:self-center">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Timer size={18} />} label="Match" />
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={18} />} label="Historie" />
          <TabButton active={activeTab === 'season'} onClick={() => setActiveTab('season')} icon={<BarChart3 size={18} />} label="Seizoen" />
          <TabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} icon={<Users size={18} />} label="Spelers" />
        </div>
      </header>

      <main className="py-4">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'season' && renderSeason()}
        {activeTab === 'players' && renderPlayers()}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-dark/80 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex justify-between items-center z-50">
        <MobileTabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={24} />} label="Live" />
        <MobileTabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={24} />} label="Historie" />
        <MobileTabButton active={activeTab === 'season'} onClick={() => setActiveTab('season')} icon={<BarChart3 size={24} />} label="Seizoen" />
        <MobileTabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} icon={<Users size={24} />} label="Team" />
      </nav>

      {/* Footer */}
      <footer className="hidden md:block py-8 text-center text-[10px] text-text-muted uppercase tracking-[0.3em]">
        Milema Webdesign × Jeremy Hooi Basketball
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showMatchStartModal && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Nieuwe Wedstrijd</h3>
                <button onClick={() => setShowMatchStartModal(false)} className="text-text-muted hover:text-white"><X /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Tegenstander</label>
                  <input 
                    type="text" 
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder="bijv. Amsterdam Lions"
                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <button 
                  onClick={startNewMatch} 
                  disabled={!opponent.trim()}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  Wedstrijd Starten
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddPlayerModal && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Speler Toevoegen</h3>
                <button onClick={() => setShowAddPlayerModal(false)} className="text-text-muted hover:text-white"><X /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Naam</label>
                  <input 
                    type="text" 
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Rugnummer</label>
                    <input 
                      type="text" 
                      value={newPlayerNumber}
                      onChange={(e) => setNewPlayerNumber(e.target.value)}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Positie</label>
                    <select 
                      value={newPlayerPosition}
                      onChange={(e) => setNewPlayerPosition(e.target.value)}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                    >
                      {['Guard', 'Forward', 'Big'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    addPlayer(newPlayerName, newPlayerNumber, newPlayerPosition);
                    setShowAddPlayerModal(false);
                    setNewPlayerName('');
                    setNewPlayerNumber('');
                  }} 
                  className="w-full btn-primary"
                >
                  Speler Opslaan
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedMatch && (
          <div className="fixed inset-0 bg-dark/95 backdrop-blur-md z-[100] flex items-center justify-center sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-surface w-full max-w-4xl min-h-screen sm:min-h-0 sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="bg-white/5 p-6 flex justify-between items-center border-b border-white/5">
                <div>
                  <h3 className="text-3xl font-display font-black italic uppercase tracking-tighter">Match Detail</h3>
                  <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-bold">{formatDate(selectedMatch.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => exportMatchToPDF(selectedMatch)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  >
                    <Download size={18} /> Export PDF
                  </button>
                  <button onClick={() => setSelectedMatch(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                    <X />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
                <div className="bg-primary/10 p-8 rounded-[2rem] flex items-center justify-between shadow-inner border border-primary/10">
                  <div className="flex items-center gap-8">
                    <div className="text-5xl font-display font-black italic text-primary/30 tracking-tighter">VS</div>
                    <div className="text-4xl font-display font-black uppercase italic tracking-tighter">{selectedMatch.opponent}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">Totaal Speeltijd</p>
                    <p className="text-3xl font-mono text-primary font-black italic">{formatTime(selectedMatch.totalMatchTime)}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-xl font-display font-black italic uppercase tracking-tighter text-white border-l-4 border-primary pl-4">Speler Statistieken</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {selectedMatch.players.map(player => (
                      <div key={player.id} className="bg-white/5 p-4 rounded-xl space-y-4 border border-white/5">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">#{player.number}</span>
                            <span className="font-bold text-lg">{player.name}</span>
                            <span className="text-xs text-text-muted bg-dark px-2 py-0.5 rounded uppercase">{player.position}</span>
                          </div>
                          <div className="text-xl font-mono font-bold text-primary">{formatTime(player.totalTime)}</div>
                        </div>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          <HistoryStat label="PTN" value={player.stats.points} />
                          <HistoryStat label="AST" value={player.stats.assists} />
                          <HistoryStat label="REB" value={player.stats.rebounds} />
                          <HistoryStat label="STL" value={player.stats.steals} />
                          <HistoryStat label="BLK" value={player.stats.blocks} />
                          <HistoryStat label="TO" value={player.stats.turnovers} />
                        </div>

                        {player.sessions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Sessie Logs ({player.sessions.length} beurten)</p>
                            <div className="flex flex-wrap gap-2">
                              {player.sessions.map((s, idx) => (
                                <div key={idx} className="bg-dark/50 px-2 py-1 rounded text-[10px] font-mono border border-white/5">
                                  {formatTime(s.duration)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showEditPlayerModal && editingPlayer && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Speler Bewerken</h3>
                <button onClick={() => setShowEditPlayerModal(false)} className="text-text-muted hover:text-white"><X /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Naam</label>
                  <input 
                    type="text" 
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Rugnummer</label>
                    <input 
                      type="text" 
                      value={newPlayerNumber}
                      onChange={(e) => setNewPlayerNumber(e.target.value)}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Positie</label>
                    <select 
                      value={newPlayerPosition}
                      onChange={(e) => setNewPlayerPosition(e.target.value)}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                    >
                      {['Guard', 'Forward', 'Big'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    updatePlayer(editingPlayer.id, newPlayerName, newPlayerNumber, newPlayerPosition);
                    setShowEditPlayerModal(false);
                    setEditingPlayer(null);
                    setNewPlayerName('');
                    setNewPlayerNumber('');
                  }} 
                  className="w-full btn-primary"
                >
                  Wijzigingen Opslaan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatButton({ label, value, onAdd, onSub, isSpecial }: { label: string, value: string | number, onAdd: () => void, onSub: () => void, isSpecial?: boolean }) {
  return (
    <div className="bg-dark/40 p-3 rounded-2xl border border-white/5 flex flex-col justify-between group h-full shadow-inner">
      <div className="text-[10px] text-text-muted font-bold uppercase text-center mb-1 tracking-wider">{label}</div>
      <div className="text-xl font-display font-black text-center mb-3 text-white italic">{value}</div>
      <div className="flex gap-2">
        <button onClick={onAdd} className="flex-1 bg-primary text-white py-2 rounded-xl active:scale-90 transition-all font-black font-display shadow-lg shadow-primary/20">+</button>
        <button onClick={onSub} className="flex-1 bg-white/5 text-text-muted py-2 rounded-xl active:scale-90 transition-all font-bold text-xs uppercase">{isSpecial ? 'ATT' : '-'}</button>
      </div>
    </div>
  );
}

function StatControl({ label, value, onAdd, onSub }: { label: string, value: number, onAdd: () => void, onSub: () => void }) {
  return (
    <div className="bg-dark/30 p-2 rounded-xl border border-white/5 flex flex-col items-center">
      <div className="text-[9px] text-text-muted font-bold uppercase mb-1 tracking-tight">{label}</div>
      <div className="text-lg font-display font-black mb-2 text-white italic">{value}</div>
      <div className="flex gap-1.5 w-full">
        <button onClick={onAdd} className="flex-1 bg-primary/10 text-primary py-1.5 rounded-lg active:scale-90 transition-all font-black text-sm border border-primary/20">+</button>
        <button onClick={onSub} className="flex-1 bg-white/5 text-text-muted py-1.5 rounded-lg active:scale-90 transition-all font-bold text-xs">-</button>
      </div>
    </div>
  );
}

function HistoryStat({ label, value }: { label: string, value: number | string }) {
  return (
    <div className="bg-dark/50 p-2 rounded-lg text-center border border-white/5">
      <div className="text-[8px] text-text-muted uppercase font-bold">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Logo() {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <h1 className="text-2xl font-black text-primary tracking-tighter uppercase italic font-display">
        Basketball Coach - GameStats
      </h1>
    );
  }

  return (
    <img 
      src="/input_file_1.png" 
      alt="Basketball Coach - GameStats" 
      className="h-14 md:h-16 w-auto object-contain"
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
    />
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-display font-black uppercase italic tracking-tight ${
        active ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'text-text-muted hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function MobileTabButton({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${
        active ? 'text-primary' : 'text-text-muted'
      }`}
    >
      <div className={`p-2 rounded-2xl transition-all ${active ? 'bg-primary/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-display font-black uppercase italic tracking-tighter">{label}</span>
    </button>
  );
}
