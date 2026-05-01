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
  Activity
} from 'lucide-react';
import { Player, MatchHistoryEntry, Tab, Position, Session } from './types';
import { INITIAL_STATS, formatTime, formatDate } from './utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [showMatchStartModal, setShowMatchStartModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryEntry | null>(null);

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

    if (savedPlayers) {
      let parsedPlayers: Player[] = JSON.parse(savedPlayers);
      // Restore states if app was closed while timers were running
      parsedPlayers = parsedPlayers.map(p => {
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

    initialLoadDone.current = true;
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!initialLoadDone.current) return;
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('matchesHistory', JSON.stringify(history));
    localStorage.setItem('isMatchActive', JSON.stringify(isMatchActive));
    localStorage.setItem('opponent', opponent);
  }, [players, history, isMatchActive, opponent]);

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
      stats: { ...INITIAL_STATS }
    };
    setPlayers([...players, newPlayer]);
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const toggleTimer = (id: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p;

      if (p.isRunning) {
        const now = Date.now();
        const duration = now - (p.lastStartTime || now);
        const newSession: Session = {
          start: p.lastStartTime || now,
          end: now,
          duration
        };
        return {
          ...p,
          isRunning: false,
          totalTime: p.totalTime + duration,
          lastStartTime: null,
          sessions: [...p.sessions, newSession]
        };
      } else {
        return {
          ...p,
          isRunning: true,
          lastStartTime: Date.now()
        };
      }
    }));
  };

  const updateStat = (id: string, stat: keyof Player['stats'], delta: number) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        stats: {
          ...p.stats,
          [stat]: Math.max(0, p.stats[stat] + delta)
        }
      };
    }));
  };

  const startNewMatch = () => {
    if (!opponent.trim()) return;
    setPlayers(prev => prev.map(p => ({
      ...p,
      totalTime: 0,
      isRunning: false,
      lastStartTime: null,
      sessions: [],
      stats: { ...INITIAL_STATS }
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
    setOpponent('');
  };

  const resetAll = () => {
    setPlayers(prev => prev.map(p => ({
      ...p,
      totalTime: 0,
      isRunning: false,
      lastStartTime: null,
      sessions: [],
      stats: { ...INITIAL_STATS }
    })));
    setIsMatchActive(false);
    setOpponent('');
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 rounded-2xl shadow-lg border border-white/5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-primary" />
            {isMatchActive ? `vs ${opponent}` : 'Geen actieve wedstrijd'}
          </h2>
          <p className="text-text-muted text-sm">{isMatchActive ? 'Wedstrijd is bezig...' : 'Start een nieuwe wedstrijd om te beginnen'}</p>
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
                  <div className={`text-2xl font-mono font-bold ${player.isRunning ? 'text-primary animate-pulse' : 'text-white'}`}>
                    {formatTime(liveTime)}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase">Beurten: {player.sessions.length}</div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <StatButton label="Punten" value={player.stats.points} onClick={() => updateStat(player.id, 'points', 1)} />
                  <StatButton label="Assists" value={player.stats.assists} onClick={() => updateStat(player.id, 'assists', 1)} />
                  <StatButton label="Rebounds" value={player.stats.rebounds} onClick={() => updateStat(player.id, 'rebounds', 1)} />
                  <StatButton label="Steals" value={player.stats.steals} onClick={() => updateStat(player.id, 'steals', 1)} />
                  <StatButton label="Blocks" value={player.stats.blocks} onClick={() => updateStat(player.id, 'blocks', 1)} />
                  <StatButton label="TO" value={player.stats.turnovers} onClick={() => updateStat(player.id, 'turnovers', 1)} />
                </div>

                <button 
                  onClick={() => toggleTimer(player.id)}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    player.isRunning ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-primary text-white'
                  }`}
                >
                  {player.isRunning ? <Pause size={20} /> : <Play size={20} />}
                  {player.isRunning ? 'Beurt Stoppen' : 'Beurt Starten'}
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
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Wedstrijd Historie</h2>
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
                <h3 className="font-bold text-lg">vs {match.opponent}</h3>
                <p className="text-sm text-text-muted">{formatDate(match.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div className="hidden sm:block">
                <p className="text-xs text-text-muted uppercase">Spelers</p>
                <p className="font-bold">{match.players.length}</p>
              </div>
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
        <h2 className="text-2xl font-bold">Team Beheer</h2>
        <button onClick={() => setShowAddPlayerModal(true)} className="btn-primary flex items-center gap-2 py-2">
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
            <button 
              onClick={() => removePlayer(player.id)}
              className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('PG');

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-6 max-w-5xl mx-auto px-4">
      <header className="py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tighter uppercase italic">
            Basketball Coach Timer
          </h1>
          <p className="text-[10px] text-text-muted uppercase tracking-[0.2em]">Milema Webdesign × Jeremy Hooi</p>
        </div>
        <div className="hidden md:flex bg-surface rounded-xl p-1 border border-white/5">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Timer size={18} />} label="Dashboard" />
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={18} />} label="Historie" />
          <TabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} icon={<Users size={18} />} label="Spelers" />
        </div>
      </header>

      <main className="py-4">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'players' && renderPlayers()}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-dark/80 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex justify-between items-center z-50">
        <MobileTabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={24} />} label="Stats" />
        <MobileTabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={24} />} label="Historie" />
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
                      {['PG', 'SG', 'SF', 'PF', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
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
                  <h3 className="text-2xl font-bold italic uppercase tracking-tighter">Match Detail</h3>
                  <p className="text-text-muted text-sm capitalize">{formatDate(selectedMatch.date)}</p>
                </div>
                <button onClick={() => setSelectedMatch(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                  <X />
                </button>
              </div>

              <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
                <div className="bg-primary/10 p-6 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="text-4xl font-black italic">VS</div>
                    <div className="text-3xl font-bold">{selectedMatch.opponent}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-muted uppercase tracking-wider">Totaal Speeltijd</p>
                    <p className="text-2xl font-mono text-primary font-bold">{formatTime(selectedMatch.totalMatchTime)}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-lg font-bold border-l-4 border-primary pl-3 uppercase">Speler Statistieken</h4>
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
      </AnimatePresence>
    </div>
  );
}

function StatButton({ label, value, onClick }: { label: string, value: number, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-dark p-2 rounded-xl border border-white/5 hover:border-primary/50 transition-all active:scale-95 text-center group"
    >
      <div className="text-[9px] text-text-muted uppercase group-hover:text-primary transition-colors">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </button>
  );
}

function HistoryStat({ label, value }: { label: string, value: number }) {
  return (
    <div className="bg-dark/50 p-2 rounded-lg text-center border border-white/5">
      <div className="text-[8px] text-text-muted uppercase font-bold">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
        active ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'
      }`}
    >
      {icon}
      <span className="font-bold text-sm">{label}</span>
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
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </button>
  );
}
