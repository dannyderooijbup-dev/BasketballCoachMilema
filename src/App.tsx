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
  RotateCcw,
  Pencil
} from 'lucide-react';
import { Player, MatchHistoryEntry, Tab, Position, Session } from './types';
import { INITIAL_STATS, formatTime, formatDate, calculatePercentage } from './utils';
import { exportMatchToPDF, exportSeasonStatsToPDF } from './pdfUtils';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [showMatchStartModal, setShowMatchStartModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryEntry | null>(null);
  const [selectedStarters, setSelectedStarters] = useState<string[]>([]);

  // Game Clock
  const [gameClockRunning, setGameClockRunning] = useState(false);
  const [matchTime, setMatchTime] = useState(0); // Accumulated time in ms
  const [matchClockStartTime, setMatchClockStartTime] = useState<number | null>(null);

  // Global action log for undo and visible recent actions list
  const [globalActionsLog, setGlobalActionsLog] = useState<any[]>([]);
  const [currentStarting5, setCurrentStarting5] = useState<string[]>([]);

  // Interval for live timer re-renders
  const [_, setTick] = useState(0);

  const getLiveMatchTime = () => {
    let liveMatchTime = matchTime;
    if (gameClockRunning && matchClockStartTime) {
      liveMatchTime += (Date.now() - matchClockStartTime);
    }
    return liveMatchTime;
  };

  // Ref to persist state to localStorage only when it changes
  const initialLoadDone = useRef(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedPlayers = localStorage.getItem('players');
      if (savedPlayers) {
        let parsedPlayers = JSON.parse(savedPlayers);
        if (Array.isArray(parsedPlayers)) {
          // Auto-migrate positions
          const positionMap: Record<string, string> = {
            'PG': 'Guard', 'SG': 'Guard',
            'SF': 'Forward', 'PF': 'Forward',
            'C': 'Big'
          };

          // Restore states if app was closed while timers were running & sanitize fields
          parsedPlayers = parsedPlayers.map((p: any) => {
            if (!p || typeof p !== 'object') return null;
            
            const id = p.id || generateId();
            const name = p.name || 'Speler';
            const number = p.number !== undefined ? String(p.number) : '0';
            const position = p.position || 'Guard';
            const totalTime = typeof p.totalTime === 'number' ? p.totalTime : 0;
            const isRunning = p.isRunning === true;
            const lastStartTime = typeof p.lastStartTime === 'number' ? p.lastStartTime : null;
            const sessions = Array.isArray(p.sessions) ? p.sessions : [];
            
            // Stats fallback
            const defaultStats = {
              points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, turnovers: 0,
              fgm: 0, fga: 0, threeFgm: 0, threeFga: 0, ftm: 0, fta: 0
            };
            const stats = p.stats && typeof p.stats === 'object' ? { ...defaultStats, ...p.stats } : defaultStats;
            const lastActions = Array.isArray(p.lastActions) ? p.lastActions : [];

            // Migration
            let migratedPosition = position;
            if (positionMap[position]) {
              migratedPosition = positionMap[position];
            }

            if (isRunning && lastStartTime) {
              const now = Date.now();
              const extraTime = now - lastStartTime;
              return {
                id,
                name,
                number,
                position: migratedPosition,
                totalTime: totalTime + extraTime,
                isRunning,
                lastStartTime: now,
                sessions,
                stats,
                lastActions
              };
            }
            return {
              id,
              name,
              number,
              position: migratedPosition,
              totalTime,
              isRunning,
              lastStartTime,
              sessions,
              stats,
              lastActions
            };
          }).filter(Boolean);
          setPlayers(parsedPlayers);
        }
      }
    } catch (e) {
      console.error('Failed to parse players from localStorage:', e);
    }

    try {
      const savedHistory = localStorage.getItem('matchesHistory');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          const sanitizedHistory = parsedHistory.map((match: any) => {
            if (!match || typeof match !== 'object') return null;
            const players = Array.isArray(match.players) ? match.players.map((p: any) => {
              if (!p || typeof p !== 'object') return null;
              const defaultStats = {
                points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, turnovers: 0,
                fgm: 0, fga: 0, threeFgm: 0, threeFga: 0, ftm: 0, fta: 0
              };
              return {
                id: p.id || generateId(),
                name: p.name || 'Speler',
                number: p.number !== undefined ? String(p.number) : '0',
                position: p.position || 'Guard',
                totalTime: typeof p.totalTime === 'number' ? p.totalTime : 0,
                isRunning: false,
                lastStartTime: null,
                sessions: Array.isArray(p.sessions) ? p.sessions : [],
                stats: p.stats && typeof p.stats === 'object' ? { ...defaultStats, ...p.stats } : defaultStats,
                lastActions: []
              };
            }).filter(Boolean) : [];

            return {
              matchId: match.matchId || generateId(),
              date: typeof match.date === 'number' ? match.date : Date.now(),
              opponent: match.opponent || 'Onbekende Tegenstander',
              players,
              totalMatchTime: typeof match.totalMatchTime === 'number' ? match.totalMatchTime : 0,
              starting5: Array.isArray(match.starting5) ? match.starting5 : []
            };
          }).filter(Boolean);
          setHistory(sanitizedHistory);
        }
      }
    } catch (e) {
      console.error('Failed to parse match history from localStorage:', e);
    }

    try {
      const savedMatchActive = localStorage.getItem('isMatchActive');
      if (savedMatchActive) {
        setIsMatchActive(JSON.parse(savedMatchActive) === true);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedOpponent = localStorage.getItem('opponent');
      if (savedOpponent && savedOpponent !== 'null' && savedOpponent !== 'undefined') {
        setOpponent(savedOpponent);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedClock = localStorage.getItem('gameClockRunning');
      if (savedClock) {
        setGameClockRunning(JSON.parse(savedClock) === true);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedMatchTime = localStorage.getItem('matchTime');
      if (savedMatchTime) {
        const val = JSON.parse(savedMatchTime);
        if (typeof val === 'number') {
          setMatchTime(val);
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedMatchClockStart = localStorage.getItem('matchClockStartTime');
      if (savedMatchClockStart) {
        const val = JSON.parse(savedMatchClockStart);
        if (typeof val === 'number' || val === null) {
          setMatchClockStartTime(val);
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedActions = localStorage.getItem('globalActionsLog');
      if (savedActions) {
        const parsedActions = JSON.parse(savedActions);
        if (Array.isArray(parsedActions)) {
          setGlobalActionsLog(parsedActions);
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedStarting5 = localStorage.getItem('currentStarting5');
      if (savedStarting5) {
        const parsedStarting = JSON.parse(savedStarting5);
        if (Array.isArray(parsedStarting)) {
          setCurrentStarting5(parsedStarting);
        }
      }
    } catch (e) {
      console.error(e);
    }

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
    localStorage.setItem('matchTime', JSON.stringify(matchTime));
    localStorage.setItem('matchClockStartTime', JSON.stringify(matchClockStartTime));
    localStorage.setItem('globalActionsLog', JSON.stringify(globalActionsLog));
    localStorage.setItem('currentStarting5', JSON.stringify(currentStarting5));
  }, [players, history, isMatchActive, opponent, gameClockRunning, matchTime, matchClockStartTime, globalActionsLog, currentStarting5]);

  // Tick for UI updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const addPlayer = (name: string, number: string, position: string) => {
    const newPlayer: Player = {
      id: generateId(),
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

    if (!newRunningState) {
      if (matchClockStartTime) {
        setMatchTime(prev => prev + (now - matchClockStartTime));
        setMatchClockStartTime(null);
      }
    } else {
      setMatchClockStartTime(now);
    }

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

    const player = players.find(p => p.id === id);
    if (!player) return;

    let statChanges: Partial<Record<keyof Player['stats'], number>> = {};
    let label = '';

    if (stat === 'threeFgm') {
      statChanges = { threeFgm: 1, threeFga: 1, fgm: 1, fga: 1, points: 3 };
      label = '+3 PTN';
    } else if (stat === 'threeFga') {
      statChanges = { threeFga: 1, fga: 1 };
      label = '3P Miss';
    } else if (stat === 'fgm') {
      statChanges = { fgm: 1, fga: 1, points: 2 };
      label = '+2 PTN';
    } else if (stat === 'ftm') {
      statChanges = { ftm: 1, fta: 1, points: 1 };
      label = '+1 VW';
    } else if (stat === 'fga') {
      statChanges = { fga: 1 };
      label = 'FG Miss';
    } else if (stat === 'fta') {
      statChanges = { fta: 1 };
      label = 'VW Miss';
    } else {
      statChanges = { [stat]: 1 };
      const DutchLabels: Record<string, string> = {
        points: '+1 PTN',
        assists: '+1 Assist',
        rebounds: '+1 Rebound',
        steals: '+1 Steal',
        blocks: '+1 Block',
        turnovers: '+1 Turnover'
      };
      label = DutchLabels[stat] || `+1 ${stat.toUpperCase()}`;
    }

    // Update player stats
    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newStats = { ...p.stats };
      Object.entries(statChanges).forEach(([key, val]) => {
        const statKey = key as keyof Player['stats'];
        newStats[statKey] = (newStats[statKey] || 0) + (val || 0);
      });
      return {
        ...p,
        stats: newStats
      };
    }));

    // Add to global action log
    const newAction = {
      actionId: generateId(),
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      stat,
      label,
      statChanges,
      timestamp: Date.now()
    };
    setGlobalActionsLog(prev => [...prev, newAction]);
  };

  const undoLastGlobalAction = () => {
    if (globalActionsLog.length === 0) return;

    setGlobalActionsLog(prev => {
      const updated = [...prev];
      const lastAction = updated.pop();
      if (!lastAction) return prev;

      // Subtract the stats from the target player
      setPlayers(pPrev => pPrev.map(p => {
        if (p.id !== lastAction.playerId) return p;

        const newStats = { ...p.stats };
        Object.entries(lastAction.statChanges).forEach(([key, val]) => {
          const statKey = key as keyof Player['stats'];
          newStats[statKey] = Math.max(0, (newStats[statKey] || 0) - (val as number || 0));
        });

        return {
          ...p,
          stats: newStats
        };
      }));

      return updated;
    });
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
    if (!opponent.trim() || selectedStarters.length !== 5) return;

    const starting5Names = players
      .filter(p => selectedStarters.includes(p.id))
      .map(p => `#${p.number} ${p.name}`);

    setCurrentStarting5(starting5Names);

    setPlayers(prev => prev.map(p => {
      const isStarter = selectedStarters.includes(p.id);
      return {
        ...p,
        totalTime: 0,
        isRunning: isStarter,
        lastStartTime: null,
        sessions: [],
        stats: { ...INITIAL_STATS },
        lastActions: []
      };
    }));
    setIsMatchActive(true);
    setMatchTime(0);
    setMatchClockStartTime(null);
    setGlobalActionsLog([]);
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

    let finalMatchTime = matchTime;
    if (gameClockRunning && matchClockStartTime) {
      finalMatchTime += (now - matchClockStartTime);
    }

    const newEntry: MatchHistoryEntry = {
      matchId: generateId(),
      date: now,
      opponent,
      players: finalPlayers,
      totalMatchTime: finalMatchTime,
      starting5: currentStarting5
    };

    setHistory([newEntry, ...history]);
    setPlayers(finalPlayers); // Update local state for reset
    setIsMatchActive(false);
    setGameClockRunning(false);
    setMatchTime(0);
    setMatchClockStartTime(null);
    setGlobalActionsLog([]);
    setCurrentStarting5([]);
    setSelectedStarters([]);
    setOpponent('');
  };

  const clearMatchStats = () => {
    if (confirm('Weet je zeker dat je alle statistieken van de huidige wedstrijd wilt wissen? Dit kan niet ongedaan worden gemaakt.')) {
      setPlayers(prev => prev.map(p => {
        // Reset current stats but keep players and put original starting 5 back on-court
        const isStarter = currentStarting5.some(nameStr => nameStr.startsWith(`#${p.number} `));
        return {
          ...p,
          totalTime: 0,
          isRunning: isStarter,
          lastStartTime: null,
          sessions: [],
          stats: { ...INITIAL_STATS },
          lastActions: []
        };
      }));
      setGameClockRunning(false);
      setMatchTime(0);
      setMatchClockStartTime(null);
      setGlobalActionsLog([]);
    }
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
    setMatchTime(0);
    setMatchClockStartTime(null);
    setGlobalActionsLog([]);
    setCurrentStarting5([]);
    setSelectedStarters([]);
    setOpponent('');
  };

  const getNameFontSize = (name: string) => {
    const len = name ? String(name).length : 0;
    if (len > 20) return 'text-[11px] sm:text-xs leading-tight font-bold';
    if (len > 15) return 'text-xs sm:text-sm leading-tight font-bold';
    if (len > 10) return 'text-sm sm:text-base leading-tight font-bold';
    return 'text-base sm:text-lg leading-tight font-bold';
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center bg-surface p-4 sm:p-6 rounded-2xl shadow-xl border border-white/5">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-black text-white flex items-center gap-2 italic tracking-tighter">
            <Trophy className="text-primary" size={20} />
            {isMatchActive ? opponent.toUpperCase() : 'GEEN ACTIEVE WEDSTRIJD'}
          </h2>
          <p className="text-text-muted text-[10px] uppercase tracking-widest font-bold mt-1">
            {isMatchActive ? 'Live wedstrijd bezig...' : 'Start een wedstrijd om stats te tracken'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {!isMatchActive ? (
            <button 
              onClick={() => {
                setSelectedStarters([]);
                setOpponent('');
                setShowMatchStartModal(true);
              }} 
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-display font-black italic uppercase tracking-widest flex items-center justify-center gap-2 py-5 px-10 rounded-2xl transition-all active:scale-95 shadow-xl shadow-primary/20"
            >
              <Play size={20} fill="white" /> <span className="text-base sm:text-lg">Start Match</span>
            </button>
          ) : (
            <button 
              onClick={endMatch} 
              className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white font-display font-black italic uppercase tracking-widest py-3 sm:py-5 px-6 sm:px-10 rounded-2xl transition-all active:scale-95 text-xs sm:text-sm shadow-xl shadow-red-500/20 flex items-center justify-center"
            >
              Beëindigen
            </button>
          )}
        </div>
      </div>
 
       {/* Game Clock Control */}
       <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-4 w-full sm:w-auto">
           <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${gameClockRunning ? 'bg-primary shadow-[0_0_20px_rgba(255,106,0,0.4)]' : (isMatchActive ? 'bg-white/5' : 'bg-white/2 opacity-20')} transition-all`}>
             <Timer size={24} className={`sm:w-8 sm:h-8 ${gameClockRunning ? 'text-white' : (isMatchActive ? 'text-text-muted' : 'text-slate-700')}`} />
           </div>
           <div className={!isMatchActive ? 'opacity-30' : ''}>
             <h2 className="text-xl sm:text-2xl font-black font-display italic uppercase tracking-tighter text-white">Wedstrijdklok</h2>
             <div className="text-3xl sm:text-5xl font-mono font-black text-primary tracking-wider mt-1 sm:mt-2">
               {isMatchActive ? formatTime(getLiveMatchTime()) : '00:00'}
             </div>
             <p className="text-text-muted text-[10px] sm:text-xs uppercase tracking-widest font-medium mt-1">{gameClockRunning ? 'Klok Loopt' : (isMatchActive ? 'Klok Gestopt' : 'Wacht op match...')}</p>
           </div>
         </div>
         <button 
           onClick={toggleGameClock}
           disabled={!isMatchActive}
           className={`w-full sm:w-auto flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black font-display uppercase italic transition-all ${
             !isMatchActive
               ? 'bg-white/5 text-text-muted cursor-not-allowed opacity-30 grayscale'
               : gameClockRunning 
                 ? 'bg-red-500/10 text-red-500 border border-red-500/20 active:scale-95' 
                 : 'bg-primary text-white shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95'
           }`}
         >
           {gameClockRunning ? <Pause size={20} strokeWidth={3} className="sm:w-6 sm:h-6" /> : <Play size={20} fill={isMatchActive ? "white" : "currentColor"} strokeWidth={3} className="sm:w-6 sm:h-6" />}
           <span className="text-xs sm:text-sm">{gameClockRunning ? 'Pauze' : 'Start Klok'}</span>
         </button>
       </div>

      {/* Actiegeschiedenis panel */}
      {isMatchActive && (
        <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="text-primary" size={18} />
              <h3 className="font-display font-black italic uppercase tracking-tighter text-sm sm:text-base text-white">Recente Acties</h3>
            </div>
            {globalActionsLog.length > 0 && (
              <button 
                onClick={undoLastGlobalAction}
                className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-bold font-display italic uppercase tracking-tight active:scale-95 transition-all"
              >
                <RotateCcw size={12} className="mr-1" /> Undo laatste actie
              </button>
            )}
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
            {[...globalActionsLog].reverse().slice(0, 10).map((action) => (
              <div 
                key={action.actionId}
                className="flex-shrink-0 flex items-center gap-2 bg-dark/60 border border-white/5 px-3 py-2 rounded-xl text-xs"
              >
                <span className="font-bold text-primary">#{action.playerNumber} {action.playerName}</span>
                <span className="text-text-muted bg-white/5 px-2 py-0.5 rounded-md font-black">{action.label}</span>
              </div>
            ))}
            {globalActionsLog.length === 0 && (
              <p className="text-text-muted text-xs italic py-1">Nog geen acties geregistreerd in deze wedstrijd.</p>
            )}
          </div>
        </div>
      )}
 
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
               <div className="p-4 flex justify-between items-center bg-white/5 border-b border-white/5 gap-2">
                 <div className="flex items-center gap-3 min-w-0 flex-1">
                   <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black flex-shrink-0">
                     #{player.number}
                   </div>
                   <div className="min-w-0 flex-1">
                     <h3 className={`text-white leading-tight ${getNameFontSize(player.name)} truncate`} title={player.name}>
                       {player.name}
                     </h3>
                     <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">{player.position}</span>
                   </div>
                 </div>
                 <div className="text-right flex-shrink-0">
                   <div className={`text-3xl font-mono font-black ${player.isRunning && gameClockRunning ? 'text-primary animate-pulse' : (player.isRunning ? 'text-orange-400' : 'text-white')}`}>
                     {formatTime(liveTime)}
                   </div>
                   <div className="text-[10px] text-text-muted uppercase font-bold tracking-tight">Beurten: {player.sessions.length}</div>
                 </div>
               </div>
 
               <div className="p-4 space-y-6">
                 <div className="grid grid-cols-4 gap-2 sm:gap-3">
                   <StatButton label="PTN" value={player.stats.points} onAdd={() => updateStat(player.id, 'points', 1)} onSub={() => updateStat(player.id, 'points', -1)} />
                   <StatButton label="FG" value={`${player.stats.fgm}/${player.stats.fga}`} onAdd={() => updateStat(player.id, 'fgm', 1)} onSub={() => updateStat(player.id, 'fga', 1)} isSpecial />
                   <StatButton label="3P" value={`${player.stats.threeFgm}/${player.stats.threeFga}`} onAdd={() => updateStat(player.id, 'threeFgm', 1)} onSub={() => updateStat(player.id, 'threeFga', 1)} isSpecial />
                   <StatButton label="FT" value={`${player.stats.ftm}/${player.stats.fta}`} onAdd={() => updateStat(player.id, 'ftm', 1)} onSub={() => updateStat(player.id, 'fta', 1)} isSpecial />
                 </div>
                 
                 <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 sm:gap-3">
                   <StatControl label="AST" value={player.stats.assists} onAdd={() => updateStat(player.id, 'assists', 1)} onSub={() => updateStat(player.id, 'assists', -1)} />
                   <StatControl label="REB" value={player.stats.rebounds} onAdd={() => updateStat(player.id, 'rebounds', 1)} onSub={() => updateStat(player.id, 'rebounds', -1)} />
                   <StatControl label="STL" value={player.stats.steals} onAdd={() => updateStat(player.id, 'steals', 1)} onSub={() => updateStat(player.id, 'steals', -1)} />
                   <StatControl label="BLK" value={player.stats.blocks} onAdd={() => updateStat(player.id, 'blocks', 1)} onSub={() => updateStat(player.id, 'blocks', -1)} />
                   <StatControl label="TO" value={player.stats.turnovers} onAdd={() => updateStat(player.id, 'turnovers', 1)} onSub={() => updateStat(player.id, 'turnovers', -1)} />
                   <button onClick={() => undoLastGlobalAction()} className="bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-text-muted text-[10px] font-bold transition-all border border-white/5 active:scale-95 py-3 sm:py-0">
                     <RotateCcw size={12} className="mr-2" /> UNDO
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
      <h2 className="text-2xl sm:text-3xl font-display font-black italic uppercase tracking-tighter">Wedstrijdhistorie</h2>
      <div className="space-y-3">
        {history.map(match => (
          <div 
            key={match.matchId}
            onClick={() => setSelectedMatch(match)}
            className="w-full bg-surface hover:bg-white/5 transition-all p-3 sm:p-4 rounded-2xl flex items-center justify-between shadow-lg border border-white/5 text-left cursor-pointer group active:scale-[0.98]"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedMatch(match); }}
          >
            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Trophy size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="truncate">
                <h3 className="font-display font-black uppercase italic tracking-tight text-base sm:text-lg truncate">{match.opponent}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-[9px] sm:text-[10px] text-text-muted uppercase tracking-widest font-bold">{formatDate(match.date)}</p>
                  <span className="text-[9px] sm:text-[10px] text-primary/60 font-black">•</span>
                  <p className="text-[9px] sm:text-[10px] text-primary font-black uppercase italic tracking-widest">{formatTime(match.totalMatchTime)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 text-right flex-shrink-0">
              <div className="hidden sm:block">
                <p className="text-xs text-text-muted uppercase">Spelers</p>
                <p className="font-bold">{match.players.length}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteMatch(match.matchId); }}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors active:scale-90 relative z-10"
                title="Verwijderen"
              >
                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <ChevronRight className="text-text-muted w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
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
      <div className="flex justify-between items-center bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
        <h2 className="text-xl sm:text-3xl font-display font-black italic uppercase tracking-tighter">Spelerslijst</h2>
        <button 
          onClick={() => setShowAddPlayerModal(true)}
          className="bg-primary text-white p-2.5 sm:px-6 sm:py-3 rounded-xl font-display font-black uppercase italic tracking-tighter shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-base"
        >
          <Plus size={18} /> <span className="hidden xs:inline">Nieuwe</span> Speler
        </button>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {players.map(player => (
          <div key={player.id} className="bg-surface p-3 sm:p-4 rounded-2xl border border-white/5 shadow-lg flex items-center justify-between gap-2 group min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-white flex items-center justify-center font-black italic text-base sm:text-lg shadow-inner flex-shrink-0">
                #{player.number}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`font-bold transition-all break-words leading-tight ${
                  (player.name || '').length > 20 
                    ? 'text-xs sm:text-sm' 
                    : (player.name || '').length > 12 
                      ? 'text-sm sm:text-base' 
                      : 'text-base sm:text-lg'
                }`} title={player.name || ''}>
                  {player.name || 'Speler'}
                </h3>
                <p className="text-[10px] text-text-muted uppercase font-bold">{player.position}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button 
                onClick={() => {
                  setEditingPlayer(player);
                  setNewPlayerName(player.name);
                  setNewPlayerNumber(player.number);
                  setNewPlayerPosition(player.position as string);
                  setShowEditPlayerModal(true);
                }}
                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors active:scale-90"
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={() => removePlayer(player.id)}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors active:scale-90"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {players.length === 0 && (
          <div className="col-span-full py-12 text-center text-text-muted bg-surface/30 rounded-3xl border border-dashed border-white/10">
            <Users className="mx-auto mb-4 opacity-10" size={48} />
            <p className="text-sm">Geen spelers in je team...</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSeason = () => {
    const stats = seasonStats();
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
          <h2 className="text-2xl sm:text-3xl font-display font-black italic uppercase tracking-tighter">Seizoensstatistieken</h2>
          {stats.length > 0 && (
            <button 
              onClick={() => exportSeasonStatsToPDF(stats)}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-xs sm:text-sm font-black italic uppercase font-display transition-all active:scale-95 border border-primary/20 shadow-lg shadow-primary/5"
            >
              <Download size={16} /> <span className="hidden xs:inline">PDF Export</span>
            </button>
          )}
        </div>
        <div className="overflow-hidden bg-surface rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white/5 text-[9px] sm:text-[10px] uppercase tracking-widest text-text-muted border-b border-white/5 font-bold italic">
                  <th className="px-3 sm:px-4 py-3 sm:py-4">Speler</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">W</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">Tijd</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">PTN</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">FG%</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">3P%</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">FT%</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">REB</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">AST</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s: any) => (
                  <tr key={s.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-3 sm:px-4 py-3 sm:py-4 sticky left-0 bg-surface sm:relative sm:bg-transparent">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">#{s.number}</span>
                        <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{s.matches}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{formatTime(s.totalTime)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-primary text-xs sm:text-sm">{Math.round(s.points / s.matches)} <span className="text-[9px] text-text-muted font-normal italic">avg</span></td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(s.fgm, s.fga)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(s.threeFgm, s.threeFga)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(s.ftm, s.fta)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right">{(s.rebounds / s.matches).toFixed(1)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right">{(s.assists / s.matches).toFixed(1)}</td>
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
    <div className="min-h-screen pb-24 md:pb-0 md:pt-6 max-w-5xl mx-auto px-4 md:px-6">
      <header className="py-4 sm:py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <Logo />
        </div>
        <div className="hidden md:flex bg-surface rounded-2xl p-1 border border-white/5 backdrop-blur-sm self-center">
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
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-surface py-3 px-2 flex justify-around items-center z-[100] border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <MobileTabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={20} />} label="Live" />
        <MobileTabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={20} />} label="Historie" />
        <MobileTabButton active={activeTab === 'season'} onClick={() => setActiveTab('season')} icon={<BarChart3 size={20} />} label="Stats" />
        <MobileTabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} icon={<Users size={20} />} label="Team" />
      </nav>

      {/* Footer */}
      <footer className="hidden md:block py-8 text-center text-[10px] text-text-muted uppercase tracking-[0.3em]">
        Milema Webdesign × Jeremy Hooi Basketball
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showMatchStartModal && (
          <div className="fixed inset-0 bg-dark/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold font-display italic uppercase tracking-tighter">Nieuwe Wedstrijd</h3>
                <button onClick={() => setShowMatchStartModal(false)} className="text-text-muted hover:text-white transition-colors"><X /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Tegenstander</label>
                  <input 
                    type="text" 
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder="bijv. Amsterdam Lions"
                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white"
                  />
                </div>

                {players.length < 5 ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center space-y-2">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-wider">Te weinig spelers</p>
                    <p className="text-text-muted text-xs">
                      Je hebt minimaal 5 spelers nodig om een wedstrijd te kunnen starten. Voeg eerst spelers toe in de Spelers-lijst.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted uppercase font-bold tracking-wider">Basisopstelling (Starting 5)</span>
                      <span className={`font-black uppercase tracking-widest ${selectedStarters.length === 5 ? 'text-primary' : 'text-white/60'}`}>
                        {selectedStarters.length} / 5
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar bg-dark/40 p-2 rounded-xl border border-white/5">
                      {players.map(p => {
                        const isSelected = selectedStarters.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedStarters(prev => {
                                if (prev.includes(p.id)) {
                                  return prev.filter(id => id !== p.id);
                                } else {
                                  if (prev.length >= 5) return prev;
                                  return [...prev, p.id];
                                }
                              });
                            }}
                            className={`flex items-center gap-2 p-2.5 rounded-xl text-left border transition-all text-xs ${
                              isSelected 
                                ? 'bg-primary/20 border-primary text-white font-bold' 
                                : 'bg-surface border-white/5 text-text-muted hover:border-white/10 hover:text-white'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${isSelected ? 'bg-primary text-white font-black' : 'bg-white/5 text-text-muted'}`}>
                              #{p.number}
                            </span>
                            <span className="truncate">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button 
                  onClick={startNewMatch} 
                  disabled={!opponent.trim() || selectedStarters.length !== 5 || players.length < 5}
                  className="w-full btn-primary disabled:opacity-30 disabled:cursor-not-allowed uppercase font-display font-black italic tracking-widest text-sm py-4 rounded-xl shadow-lg mt-2 transition-all active:scale-95"
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
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        setNewPlayerNumber(clean);
                      }}
                      placeholder="bijv. 14"
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Positie</label>
                    <select 
                      value={newPlayerPosition}
                      onChange={(e) => setNewPlayerPosition(e.target.value)}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white"
                    >
                      {['Guard', 'Forward', 'Big'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                {newPlayerNumber.trim() !== '' && players.some(p => p.number.trim() === newPlayerNumber.trim()) && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-semibold text-center">
                    Rugnummer {newPlayerNumber} is al in gebruik!
                  </div>
                )}
                <button 
                  onClick={() => {
                    if (!newPlayerName.trim() || !newPlayerNumber) return;
                    if (players.some(p => p.number.trim() === newPlayerNumber.trim())) return;
                    addPlayer(newPlayerName, newPlayerNumber, newPlayerPosition);
                    setShowAddPlayerModal(false);
                    setNewPlayerName('');
                    setNewPlayerNumber('');
                  }} 
                  disabled={!newPlayerName.trim() || !newPlayerNumber || players.some(p => p.number.trim() === newPlayerNumber.trim())}
                  className="w-full btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Speler Opslaan
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedMatch && (
          <div className="fixed inset-0 bg-dark/95 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-surface w-full max-w-4xl max-h-[96vh] sm:max-h-[90vh] sm:rounded-3xl border-t sm:border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="bg-white/5 p-4 sm:p-6 flex justify-between items-center border-b border-white/5 flex-shrink-0">
                <div>
                  <h3 className="text-xl sm:text-3xl font-display font-black italic uppercase tracking-tighter">Match Detail</h3>
                  <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-bold">{formatDate(selectedMatch.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => exportMatchToPDF(selectedMatch)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95"
                  >
                    <Download size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden xs:inline">PDF</span>
                  </button>
                  <button onClick={() => setSelectedMatch(null)} className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors active:scale-90">
                    <X size={20} className="sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto custom-scrollbar">
                <div className="bg-primary/10 p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner border border-primary/10">
                  <div className="flex items-center gap-4 sm:gap-8">
                    <div className="text-3xl sm:text-5xl font-display font-black italic text-primary/30 tracking-tighter">VS</div>
                    <div className="text-[21px] sm:text-[33px] font-display font-black uppercase italic tracking-tighter truncate max-w-[200px] sm:max-w-none">{selectedMatch.opponent}</div>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">Wedstrijdduur</p>
                    <p className="text-2xl sm:text-3xl font-mono text-primary font-black italic">{formatTime(selectedMatch.totalMatchTime)}</p>
                  </div>
                </div>

                {selectedMatch.starting5 && selectedMatch.starting5.length > 0 && (
                  <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Basisopstelling (Starting 5)</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedMatch.starting5.map((name, idx) => (
                        <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-bold leading-none">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4 sm:space-y-6">
                  <h4 className="text-lg sm:text-xl font-display font-black italic uppercase tracking-tighter text-white border-l-4 border-primary pl-4">Speler Statistieken</h4>
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {selectedMatch.players.map(player => (
                      <div key={player.id} className="bg-white/5 p-3 sm:p-4 rounded-xl space-y-3 sm:space-y-4 border border-white/5">
                        <div className="flex justify-between items-center border-b border-white/5 pb-3 sm:pb-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] sm:text-xs flex-shrink-0">#{player.number}</span>
                            <span className="font-bold text-base sm:text-lg truncate">{player.name}</span>
                            <span className="text-[9px] sm:text-xs text-text-muted bg-dark px-1.5 sm:px-2 py-0.5 rounded uppercase font-bold">{player.position}</span>
                          </div>
                          <div className="text-lg sm:text-xl font-mono font-bold text-primary flex-shrink-0">{formatTime(player.totalTime)}</div>
                        </div>
                        
                        <div className="grid grid-cols-3 xs:grid-cols-6 gap-2">
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
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        setNewPlayerNumber(clean);
                      }}
                      placeholder="bijv. 14"
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Positie</label>
                    <select 
                      value={newPlayerPosition}
                      onChange={(e) => setNewPlayerPosition(e.target.value)}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white"
                    >
                      {['Guard', 'Forward', 'Big'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                {editingPlayer && newPlayerNumber.trim() !== '' && players.some(p => p.id !== editingPlayer.id && p.number.trim() === newPlayerNumber.trim()) && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-semibold text-center">
                    Rugnummer {newPlayerNumber} is al in gebruik!
                  </div>
                )}
                <button 
                  onClick={() => {
                    if (!newPlayerName.trim() || !newPlayerNumber) return;
                    if (players.some(p => p.id !== editingPlayer.id && p.number.trim() === newPlayerNumber.trim())) return;
                    updatePlayer(editingPlayer.id, newPlayerName, newPlayerNumber, newPlayerPosition);
                    setShowEditPlayerModal(false);
                    setEditingPlayer(null);
                    setNewPlayerName('');
                    setNewPlayerNumber('');
                  }} 
                  disabled={!newPlayerName.trim() || !newPlayerNumber || players.some(p => p.id !== editingPlayer.id && p.number.trim() === newPlayerNumber.trim())}
                  className="w-full btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
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
    <div className="bg-dark/40 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/5 flex flex-col justify-between group h-full shadow-inner">
      <div className="text-[8px] sm:text-[10px] text-text-muted font-bold uppercase text-center mb-0.5 sm:mb-1 tracking-wider">{label}</div>
      <div className="text-base sm:text-xl font-display font-black text-center mb-2 sm:mb-3 text-white italic">{value}</div>
      <div className="flex gap-1.5 sm:gap-2">
        <button onClick={onAdd} className="flex-1 bg-primary text-white py-1.5 sm:py-2 rounded-lg sm:rounded-xl active:scale-90 transition-all font-black font-display shadow-lg shadow-primary/20 text-xs sm:text-base">+</button>
        <button onClick={onSub} className="flex-1 bg-white/5 text-text-muted py-1.5 sm:py-2 rounded-lg sm:rounded-xl active:scale-90 transition-all font-bold text-[9px] sm:text-xs uppercase whitespace-nowrap">{isSpecial ? 'ATT' : '-'}</button>
      </div>
    </div>
  );
}

function StatControl({ label, value, onAdd, onSub }: { label: string, value: number, onAdd: () => void, onSub: () => void }) {
  return (
    <div className="bg-dark/30 p-1.5 sm:p-2 rounded-xl border border-white/5 flex flex-col items-center">
      <div className="text-[8px] sm:text-[9px] text-text-muted font-bold uppercase mb-0.5 sm:mb-1 tracking-tight">{label}</div>
      <div className="text-base sm:text-lg font-display font-black mb-1 sm:mb-2 text-white italic">{value}</div>
      <div className="flex gap-1 sm:gap-1.5 w-full">
        <button onClick={onAdd} className="flex-1 bg-primary/10 text-primary py-1 sm:py-1.5 rounded-lg active:scale-90 transition-all font-black text-xs sm:text-sm border border-primary/20">+</button>
        <button onClick={onSub} className="flex-1 bg-white/5 text-text-muted py-1 sm:py-1.5 rounded-lg active:scale-90 transition-all font-bold text-[10px] sm:text-xs">-</button>
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
  return (
    <div className="flex flex-col items-center md:items-start select-none">
      <div className="flex items-baseline gap-1">
        <h1 className="text-xl sm:text-2xl font-black font-display italic uppercase tracking-tighter leading-none">
          <span className="text-white">Basketball</span>
          <span className="text-primary ml-1">Coach</span>
        </h1>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-[1px] w-4 bg-primary/30 rounded-full block md:hidden"></div>
        <span className="text-[10px] sm:text-[12px] font-black text-text-muted uppercase tracking-[0.3em] font-sans">
          Game <span className="text-primary">Stats</span>
        </span>
        <div className="h-[1px] w-4 bg-primary/30 rounded-full"></div>
      </div>
    </div>
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
      className={`flex flex-col items-center gap-1 flex-1 transition-all ${
        active ? 'text-primary' : 'text-text-muted hover:text-white'
      }`}
    >
      <div className={`p-2 rounded-2xl transition-all ${active ? 'bg-primary/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-display font-black uppercase italic tracking-tighter">{label}</span>
    </button>
  );
}
