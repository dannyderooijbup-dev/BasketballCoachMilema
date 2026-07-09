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
  Pencil,
  LogOut,
  User as UserIcon,
  Shield,
  Briefcase,
  Sun,
  Moon
} from 'lucide-react';
import { Player, MatchHistoryEntry, Tab, Position, Session, Team, TeamPlayer, SEASONS, DEFAULT_SEASON } from './types';
import { INITIAL_STATS, formatTime, formatDate, calculatePercentage } from './utils';
import { exportMatchToPDF, exportSeasonStatsToPDF } from './pdfUtils';
import { User } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  deleteDoc, 
  writeBatch,
  updateDoc 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import AuthScreen from './components/AuthScreen';
import AccountScreen from './components/AccountScreen';
import { db } from './firebase';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
};

export default function App() {
  const { currentUser, loading: loadingAuth, logout } = useAuth();
  const [loadingSync, setLoadingSync] = useState(false);
  const hasSyncedFromFirestore = useRef(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const [profileName, setProfileName] = useState('');
  const [profileClub, setProfileClub] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileNewsletter, setProfileNewsletter] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string>('all');
  const [players, setPlayers] = useState<Player[]>([]);

  const getPlayersOfTeam = (teamId: string) => {
    if (teamId === 'all') return players;
    const mappedPlayerIds = teamPlayers
      .filter(tp => tp.teamId === teamId)
      .map(tp => tp.playerId);
    return players.filter(p => mappedPlayerIds.includes(p.id));
  };

  const isJerseyNumberTakenInTeam = (number: string, teamId: string, excludePlayerId?: string) => {
    return false;
  };

  const isJerseyNumberConflictingForPlayer = (newNumber: string, playerId: string) => {
    return false;
  };

  const COLOR_SCHEMES: { [id: string]: { name: string; dotColor: string; bgClass: string; borderClass: string; borderActive: string; btnBg: string; shadowClass: string; accentText: string } } = {
    blue: {
      name: 'Blauw',
      dotColor: 'bg-blue-500',
      bgClass: 'bg-[#1e2e5c]',
      borderClass: 'border-blue-500/30',
      borderActive: 'border-blue-500',
      btnBg: 'bg-blue-600',
      shadowClass: 'shadow-blue-600/20',
      accentText: 'text-blue-400'
    },
    purple: {
      name: 'Paars',
      dotColor: 'bg-purple-500',
      bgClass: 'bg-[#3b1a40]',
      borderClass: 'border-purple-500/30',
      borderActive: 'border-purple-500',
      btnBg: 'bg-purple-600',
      shadowClass: 'shadow-purple-600/20',
      accentText: 'text-purple-400'
    },
    emerald: {
      name: 'Groen',
      dotColor: 'bg-emerald-500',
      bgClass: 'bg-[#103028]',
      borderClass: 'border-emerald-500/30',
      borderActive: 'border-emerald-500',
      btnBg: 'bg-emerald-600',
      shadowClass: 'shadow-emerald-600/20',
      accentText: 'text-emerald-400'
    },
    red: {
      name: 'Rood',
      dotColor: 'bg-red-500',
      bgClass: 'bg-[#4a1c1c]',
      borderClass: 'border-red-500/30',
      borderActive: 'border-red-500',
      btnBg: 'bg-red-600',
      shadowClass: 'shadow-red-600/20',
      accentText: 'text-red-400'
    },
    orange: {
      name: 'Oranje',
      dotColor: 'bg-primary',
      bgClass: 'bg-[#4d2512]',
      borderClass: 'border-primary/30',
      borderActive: 'border-primary',
      btnBg: 'bg-primary',
      shadowClass: 'shadow-primary/20',
      accentText: 'text-primary'
    }
  };

  const getTeamScheme = (team: Team | undefined, index?: number) => {
    if (!team) return COLOR_SCHEMES.orange;
    if (team.colorScheme && COLOR_SCHEMES[team.colorScheme]) {
      return COLOR_SCHEMES[team.colorScheme];
    }
    const idx = index !== undefined ? index : teams.findIndex(t => t.id === team.id);
    if (idx === 0) return COLOR_SCHEMES.blue;
    if (idx === 1) return COLOR_SCHEMES.purple;
    if (idx === 2) return COLOR_SCHEMES.emerald;
    return COLOR_SCHEMES.orange;
  };

  const getTeamSchemeById = (teamId: string) => {
    if (teamId === 'all') {
      return {
        bgClass: 'bg-surface',
        borderClass: 'border-white/10',
        btnBg: 'bg-primary',
        shadowClass: 'shadow-primary/20',
        accentText: 'text-primary'
      };
    }
    const team = teams.find(t => t.id === teamId);
    const index = teams.findIndex(t => t.id === teamId);
    return getTeamScheme(team, index);
  };

  const getTeamBgColorClass = (teamId: string) => {
    if (teamId === 'all') return 'bg-surface border-white/10';
    const scheme = getTeamSchemeById(teamId);
    return `${scheme.bgClass} ${scheme.borderClass}`;
  };

  const getTeamButtonColorClass = (teamId: string) => {
    if (teamId === 'all') return 'bg-primary text-white font-black shadow-lg shadow-primary/20';
    const scheme = getTeamSchemeById(teamId);
    return `${scheme.btnBg} text-white font-black shadow-lg ${scheme.shadowClass}`;
  };

  const getTeamStickyBgColorClass = (teamId: string) => {
    if (teamId === 'all') return 'bg-surface';
    const scheme = getTeamSchemeById(teamId);
    return scheme.bgClass;
  };

  const updateTeamColorScheme = async (teamId: string, schemeName: string) => {
    if (!currentUser) return;
    try {
      const teamRef = doc(db, 'teams', teamId);
      await updateDoc(teamRef, { colorScheme: schemeName });
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, colorScheme: schemeName } : t));
    } catch (err) {
      console.error("Fout bij bijwerken van teamkleur:", err);
    }
  };

  useEffect(() => {
    localStorage.setItem('activeTeamId', activeTeamId);
  }, [activeTeamId]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [matchTeamId, setMatchTeamId] = useState<string | null>(null);
  const [selectedMatchTeamId, setSelectedMatchTeamId] = useState<string>('');
  const [opponent, setOpponent] = useState('');
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [matchSeason, setMatchSeason] = useState<string>(DEFAULT_SEASON);
  const [historySeasonFilter, setHistorySeasonFilter] = useState<string>('All');
  const [seasonTabSeasonFilter, setSeasonTabSeasonFilter] = useState<string>('All');
  const [showMatchStartModal, setShowMatchStartModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryEntry | null>(null);
  const [detailSeason, setDetailSeason] = useState<string>('2026/2027');

  useEffect(() => {
    if (selectedMatch) {
      setDetailSeason(selectedMatch.season || '2026/2027');
    }
  }, [selectedMatch]);
  const [selectedStarters, setSelectedStarters] = useState<string[]>([]);
  const [matchInactivePlayerIds, setMatchInactivePlayerIds] = useState<string[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState<{ [teamId: string]: string }>({});

  // Game Clock
  const [gameClockRunning, setGameClockRunning] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<number>(1); // 1-4 standard, 5+ overtime
  const [periodElapsed, setPeriodElapsed] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [matchClockStartTime, setMatchClockStartTime] = useState<number | null>(null);
  const [isEditingClock, setIsEditingClock] = useState(false);
  const [editMin, setEditMin] = useState(0);
  const [editSec, setEditSec] = useState(0);

  // Global action log for undo and visible recent actions list
  const [globalActionsLog, setGlobalActionsLog] = useState<any[]>([]);
  const [currentStarting5, setCurrentStarting5] = useState<string[]>([]);

  // Interval for live timer re-renders
  const [tick, setTick] = useState(0);

  const getFilteredPlayers = () => {
    let list = players;
    if (activeTeamId !== 'all') {
      const mappedPlayerIds = teamPlayers
        .filter(tp => tp.teamId === activeTeamId)
        .map(tp => tp.playerId);
      list = players.filter(p => mappedPlayerIds.includes(p.id));
    }
    if (isMatchActive && matchInactivePlayerIds.length > 0) {
      list = list.filter(p => !matchInactivePlayerIds.includes(p.id));
    }
    return list;
  };
  const filteredPlayers = getFilteredPlayers();

  const getLivePeriodElapsedTime = () => {
    let elapsed = periodElapsed[currentPeriod] || 0;
    if (gameClockRunning && matchClockStartTime) {
      elapsed += (Date.now() - matchClockStartTime);
    }
    return elapsed;
  };

  const getRemainingTime = () => {
    const currentPeriodDuration = currentPeriod <= 4 ? 10 * 60 * 1000 : 5 * 60 * 1000;
    return Math.max(0, currentPeriodDuration - getLivePeriodElapsedTime());
  };

  const getTotalMatchDuration = () => {
    let total = 0;
    const maxPeriod = Math.max(4, ...Object.keys(periodElapsed).map(Number), currentPeriod);
    for (let p = 1; p <= maxPeriod; p++) {
      if (p === currentPeriod) {
        total += getLivePeriodElapsedTime();
      } else {
        total += periodElapsed[p] || 0;
      }
    }
    return total;
  };

  const getPeriodLabel = (pNum: number) => {
    if (pNum <= 4) {
      return `Kwart ${pNum}`;
    }
    return `Verlenging ${pNum - 4} (OT${pNum - 4})`;
  };

  const switchPeriod = (targetPeriod: number) => {
    const now = Date.now();
    // 1. Pause clock if it is running to commit current elapsed times
    if (gameClockRunning) {
      if (matchClockStartTime) {
        const elapsedSession = now - matchClockStartTime;
        setPeriodElapsed(prev => ({
          ...prev,
          [currentPeriod]: (prev[currentPeriod] || 0) + elapsedSession
        }));
      }
      setGameClockRunning(false);
      setMatchClockStartTime(null);
      
      // Update players' time
      setPlayers(prev => prev.map(p => {
        if (p.isRunning && p.lastStartTime) {
          const duration = now - p.lastStartTime;
          return {
            ...p,
            totalTime: p.totalTime + duration,
            lastStartTime: null,
            sessions: [...p.sessions, { start: p.lastStartTime, end: now, duration }]
          };
        }
        return p;
      }));
    } else {
      // Clear open run startTimes (even if paused, just in case)
      setPlayers(prev => prev.map(p => {
        if (p.isRunning && p.lastStartTime) {
          const duration = now - p.lastStartTime;
          return {
            ...p,
            totalTime: p.totalTime + duration,
            lastStartTime: null,
            sessions: [...p.sessions, { start: p.lastStartTime, end: now, duration }]
          };
        }
        return p;
      }));
    }

    // 2. Set new period
    setCurrentPeriod(targetPeriod);
    setPeriodElapsed(prev => {
      if (prev[targetPeriod] !== undefined) return prev;
      return {
        ...prev,
        [targetPeriod]: 0
      };
    });
  };

  const startClockEditing = () => {
    const remainingMs = getRemainingTime();
    const totalSec = Math.floor(remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    setEditMin(m);
    setEditSec(s);
    setIsEditingClock(true);
  };

  const saveClockCorrection = () => {
    const currentPeriodDuration = currentPeriod <= 4 ? 10 * 60 * 1000 : 5 * 60 * 1000;
    const oldElapsedTime = getLivePeriodElapsedTime();
    const newRemainingMs = (editMin * 60 + editSec) * 1000;
    const newElapsedTime = Math.max(0, Math.min(currentPeriodDuration, currentPeriodDuration - newRemainingMs));
    const delta = newElapsedTime - oldElapsedTime;
    const now = Date.now();

    // 1. Update Period Elapsed state
    setPeriodElapsed(prev => ({
      ...prev,
      [currentPeriod]: newElapsedTime
    }));
    
    if (gameClockRunning) {
      setMatchClockStartTime(now);
    } else {
      setMatchClockStartTime(null);
    }

    // 2. Update players timing (specifically active ones)
    setPlayers(prev => prev.map(p => {
      if (!p.isRunning) return p;

      if (gameClockRunning) {
        const playerLiveTime = p.lastStartTime ? p.totalTime + (now - p.lastStartTime) : p.totalTime;
        const newPlayerTime = Math.max(0, playerLiveTime + delta);
        return {
          ...p,
          totalTime: newPlayerTime,
          lastStartTime: now
        };
      } else {
        const newPlayerTime = Math.max(0, p.totalTime + delta);
        return {
          ...p,
          totalTime: newPlayerTime,
          lastStartTime: null
        };
      }
    }));

    setIsEditingClock(false);
  };

  const adjustClock = (amountMs: number) => {
    if (!isMatchActive) return;
    const currentPeriodDuration = currentPeriod <= 4 ? 10 * 60 * 1000 : 5 * 60 * 1000;
    const oldElapsedTime = getLivePeriodElapsedTime();
    const currentRemaining = getRemainingTime();
    const targetRemaining = Math.max(0, Math.min(currentPeriodDuration, currentRemaining + amountMs));
    const newElapsedTime = currentPeriodDuration - targetRemaining;
    const delta = newElapsedTime - oldElapsedTime;
    const now = Date.now();

    // 1. Update Period Elapsed state
    setPeriodElapsed(prev => ({
      ...prev,
      [currentPeriod]: newElapsedTime
    }));
    
    if (gameClockRunning) {
      setMatchClockStartTime(now);
    } else {
      setMatchClockStartTime(null);
    }

    // 2. Update players timing (specifically active ones)
    setPlayers(prev => prev.map(p => {
      if (!p.isRunning) return p;

      if (gameClockRunning) {
        const playerLiveTime = p.lastStartTime ? p.totalTime + (now - p.lastStartTime) : p.totalTime;
        const newPlayerTime = Math.max(0, playerLiveTime + delta);
        return {
          ...p,
          totalTime: newPlayerTime,
          lastStartTime: now
        };
      } else {
        const newPlayerTime = Math.max(0, p.totalTime + delta);
        return {
          ...p,
          totalTime: newPlayerTime,
          lastStartTime: null
        };
      }
    }));
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
              fgm: 0, fga: 0, threeFgm: 0, threeFga: 0, ftm: 0, fta: 0, pf: 0
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
                fgm: 0, fga: 0, threeFgm: 0, threeFga: 0, ftm: 0, fta: 0, pf: 0
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
      const savedMatchSeason = localStorage.getItem('matchSeason');
      if (savedMatchSeason && savedMatchSeason !== 'null' && savedMatchSeason !== 'undefined') {
        setMatchSeason(savedMatchSeason);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedMatchTeamId = localStorage.getItem('matchTeamId');
      if (savedMatchTeamId && savedMatchTeamId !== 'null' && savedMatchTeamId !== 'undefined') {
        setMatchTeamId(savedMatchTeamId);
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
      const savedOpponentScore = localStorage.getItem('opponentScore');
      if (savedOpponentScore) {
        setOpponentScore(JSON.parse(savedOpponentScore));
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
      const savedPeriod = localStorage.getItem('currentPeriod');
      if (savedPeriod) {
        setCurrentPeriod(JSON.parse(savedPeriod));
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedPeriodElapsed = localStorage.getItem('periodElapsed');
      if (savedPeriodElapsed) {
        setPeriodElapsed(JSON.parse(savedPeriodElapsed));
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

    try {
      const savedProfileName = localStorage.getItem('profileName');
      if (savedProfileName) setProfileName(savedProfileName);
    } catch (e) { console.error(e); }

    try {
      const savedProfileClub = localStorage.getItem('profileClub');
      if (savedProfileClub) setProfileClub(savedProfileClub);
    } catch (e) { console.error(e); }

    try {
      const savedProfileRole = localStorage.getItem('profileRole');
      if (savedProfileRole) setProfileRole(savedProfileRole);
    } catch (e) { console.error(e); }

    try {
      const savedProfileNewsletter = localStorage.getItem('profileNewsletter');
      if (savedProfileNewsletter) setProfileNewsletter(JSON.parse(savedProfileNewsletter) === true);
    } catch (e) { console.error(e); }

    try {
      const savedActiveTeamId = localStorage.getItem('activeTeamId');
      if (savedActiveTeamId) setActiveTeamId(savedActiveTeamId);
    } catch (e) { console.error(e); }

    initialLoadDone.current = true;
  }, []);

  // Firestore Sync & Migration Hook
  useEffect(() => {
    if (!currentUser) {
      hasSyncedFromFirestore.current = false;
      return;
    }

    const syncWithFirestore = async () => {
      setLoadingSync(true);
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        let data: any = null;

        if (docSnap.exists()) {
          data = docSnap.data();
          if (Array.isArray(data.wedstrijden)) {
            setHistory(data.wedstrijden);
            localStorage.setItem('matchesHistory', JSON.stringify(data.wedstrijden));
          }
          
          if (data.profiel) {
            if (data.profiel.naam !== undefined) {
              setProfileName(data.profiel.naam);
              localStorage.setItem('profileName', data.profiel.naam);
            }
            if (data.profiel.club !== undefined) {
              setProfileClub(data.profiel.club);
              localStorage.setItem('profileClub', data.profiel.club);
            }
            if (data.profiel.functie !== undefined) {
              setProfileRole(data.profiel.functie);
              localStorage.setItem('profileRole', data.profiel.functie);
            }
            if (data.profiel.nieuwsbrief !== undefined) {
              setProfileNewsletter(data.profiel.nieuwsbrief);
              localStorage.setItem('profileNewsletter', JSON.stringify(data.profiel.nieuwsbrief));
            }
          }

          if (data.instellingen) {
            const inst = data.instellingen;
            if (inst.isMatchActive !== undefined) {
              setIsMatchActive(inst.isMatchActive);
              localStorage.setItem('isMatchActive', JSON.stringify(inst.isMatchActive));
            }
            if (inst.opponent !== undefined) {
              setOpponent(inst.opponent);
              localStorage.setItem('opponent', inst.opponent);
            }
            if (inst.opponentScore !== undefined) {
              setOpponentScore(inst.opponentScore);
              localStorage.setItem('opponentScore', JSON.stringify(inst.opponentScore));
            }
            if (inst.gameClockRunning !== undefined) {
              setGameClockRunning(inst.gameClockRunning);
              localStorage.setItem('gameClockRunning', JSON.stringify(inst.gameClockRunning));
            }
            if (inst.currentPeriod !== undefined) {
              setCurrentPeriod(inst.currentPeriod);
              localStorage.setItem('currentPeriod', JSON.stringify(inst.currentPeriod));
            }
            if (inst.periodElapsed !== undefined) {
              setPeriodElapsed(inst.periodElapsed);
              localStorage.setItem('periodElapsed', JSON.stringify(inst.periodElapsed));
            }
            if (inst.matchClockStartTime !== undefined) {
              setMatchClockStartTime(inst.matchClockStartTime);
              localStorage.setItem('matchClockStartTime', JSON.stringify(inst.matchClockStartTime));
            }
            if (inst.globalActionsLog !== undefined) {
              setGlobalActionsLog(inst.globalActionsLog);
              localStorage.setItem('globalActionsLog', JSON.stringify(inst.globalActionsLog));
            }
            if (inst.currentStarting5 !== undefined) {
              setCurrentStarting5(inst.currentStarting5);
              localStorage.setItem('currentStarting5', JSON.stringify(inst.currentStarting5));
            }
            if (inst.matchTeamId !== undefined) {
              setMatchTeamId(inst.matchTeamId);
              localStorage.setItem('matchTeamId', inst.matchTeamId || '');
            }
            if (inst.matchSeason !== undefined) {
              setMatchSeason(inst.matchSeason);
              localStorage.setItem('matchSeason', inst.matchSeason || '');
            }
          }
        } else {
          // Document does not exist (first login):
          // Migrate current state (loaded from localstorage or defaults) to Firestore
          const initialDocData = {
            profiel: {
              email: currentUser.email,
              naam: profileName,
              club: profileClub,
              functie: profileRole,
              nieuwsbrief: profileNewsletter,
              lastLogin: Date.now(),
              migratedAt: Date.now(),
              teamCount: 0
            },
            spelers: players,
            wedstrijden: history,
            instellingen: {
              isMatchActive,
              opponent,
              opponentScore,
              gameClockRunning,
              currentPeriod,
              periodElapsed,
              matchClockStartTime,
              globalActionsLog,
              currentStarting5,
              matchTeamId,
              matchSeason
            }
          };

          await setDoc(userDocRef, initialDocData);
        }

        // 1. Fetch Teams
        const teamsQuery = query(collection(db, 'teams'), where('userId', '==', currentUser.uid));
        const teamsSnap = await getDocs(teamsQuery);
        let loadedTeams: Team[] = [];
        teamsSnap.forEach(tDoc => {
          loadedTeams.push({ id: tDoc.id, ...tDoc.data() } as Team);
        });
        setTeams(loadedTeams);

        // 2. Fetch Players
        const playersQuery = query(collection(db, 'players'), where('userId', '==', currentUser.uid));
        const playersSnap = await getDocs(playersQuery);
        let loadedPlayers: Player[] = [];
        playersSnap.forEach(pDoc => {
          loadedPlayers.push({ id: pDoc.id, ...pDoc.data() } as Player);
        });

        // 3. Fetch teamPlayers mappings
        let loadedMappings: TeamPlayer[] = [];
        if (loadedTeams.length > 0) {
          const teamIds = loadedTeams.map(t => t.id);
          const tpQuery = query(collection(db, 'teamPlayers'), where('teamId', 'in', teamIds));
          const tpSnap = await getDocs(tpQuery);
          tpSnap.forEach(tpDoc => {
            loadedMappings.push({ id: tpDoc.id, ...tpDoc.data() } as TeamPlayer);
          });
        }
        setTeamPlayers(loadedMappings);

        // 4. Backward Compatibility / Migration Check
        if (loadedPlayers.length === 0 && data && Array.isArray(data.spelers) && data.spelers.length > 0) {
          console.log("Migrating players to root /players collection...");
          const batch = writeBatch(db);
          
          const newTeamId = generateId();
          const defaultTeam: Team = {
            id: newTeamId,
            name: `${data.profiel?.club || profileClub || 'Mijn Coach'} - Team 1`,
            userId: currentUser.uid,
            createdAt: Date.now()
          };
          batch.set(doc(db, 'teams', newTeamId), defaultTeam);
          loadedTeams.push(defaultTeam);

          batch.set(userDocRef, {
            profiel: {
              teamCount: 1
            }
          }, { merge: true });

          data.spelers.forEach((p: Player) => {
            const newPlayerDoc = {
              ...p,
              userId: currentUser.uid,
              createdAt: Date.now()
            };
            batch.set(doc(db, 'players', p.id), newPlayerDoc);
            loadedPlayers.push(p);

            const mappingId = generateId();
            const mapping: TeamPlayer = {
              id: mappingId,
              teamId: newTeamId,
              playerId: p.id,
              createdAt: Date.now()
            };
            batch.set(doc(db, 'teamPlayers', mappingId), mapping);
            loadedMappings.push(mapping);
          });

          await batch.commit();
          setTeams(loadedTeams);
          setTeamPlayers(loadedMappings);
        }

        setPlayers(loadedPlayers);
        localStorage.setItem('players', JSON.stringify(loadedPlayers));

        const actualTeamCount = loadedTeams.length;
        const currentStoredTeamCount = (data?.profiel?.teamCount !== undefined) ? data.profiel.teamCount : 0;
        if (actualTeamCount !== currentStoredTeamCount) {
          await setDoc(userDocRef, {
            profiel: {
              teamCount: actualTeamCount
            }
          }, { merge: true });
        }

        hasSyncedFromFirestore.current = true;
      } catch (err) {
        console.error("Fout tijdens Firestore synchronisatie:", err);
      } finally {
        setLoadingSync(false);
      }
    };

    if (initialLoadDone.current) {
      syncWithFirestore();
    } else {
      const checkInterval = setInterval(() => {
        if (initialLoadDone.current) {
          clearInterval(checkInterval);
          syncWithFirestore();
        }
      }, 50);
    }
  }, [currentUser]);

  // Save changes to localStorage AND Firestore
  useEffect(() => {
    if (!currentUser || !hasSyncedFromFirestore.current) return;

    // Save to localStorage
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('matchesHistory', JSON.stringify(history));
    localStorage.setItem('isMatchActive', JSON.stringify(isMatchActive));
    localStorage.setItem('matchTeamId', matchTeamId || '');
    localStorage.setItem('opponent', opponent);
    localStorage.setItem('opponentScore', JSON.stringify(opponentScore));
    localStorage.setItem('gameClockRunning', JSON.stringify(gameClockRunning));
    localStorage.setItem('currentPeriod', JSON.stringify(currentPeriod));
    localStorage.setItem('periodElapsed', JSON.stringify(periodElapsed));
    localStorage.setItem('matchClockStartTime', JSON.stringify(matchClockStartTime));
    localStorage.setItem('globalActionsLog', JSON.stringify(globalActionsLog));
    localStorage.setItem('currentStarting5', JSON.stringify(currentStarting5));
    localStorage.setItem('matchSeason', matchSeason);
    localStorage.setItem('profileName', profileName);
    localStorage.setItem('profileClub', profileClub);
    localStorage.setItem('profileRole', profileRole);
    localStorage.setItem('profileNewsletter', JSON.stringify(profileNewsletter));

    // Save to Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    setDoc(userDocRef, {
      profiel: {
        email: currentUser.email,
        naam: profileName,
        club: profileClub,
        functie: profileRole,
        nieuwsbrief: profileNewsletter,
        lastUpdated: Date.now()
      },
      spelers: players,
      wedstrijden: history,
      instellingen: {
        isMatchActive,
        opponent,
        opponentScore,
        gameClockRunning,
        currentPeriod,
        periodElapsed,
        matchClockStartTime,
        globalActionsLog,
        currentStarting5,
        matchTeamId,
        matchSeason
      }
    }, { merge: true }).catch(err => {
      console.error("Fout bij opslaan naar Firestore:", err);
    });
  }, [players, history, isMatchActive, matchTeamId, matchSeason, opponent, opponentScore, gameClockRunning, currentPeriod, periodElapsed, matchClockStartTime, globalActionsLog, currentStarting5, currentUser, profileName, profileClub, profileRole, profileNewsletter]);

  const handleSaveProfile = async (updatedData: { name: string; club: string; role: string; newsletter: boolean }) => {
    if (!currentUser) return;
    
    // Update local React states
    setProfileName(updatedData.name);
    setProfileClub(updatedData.club);
    setProfileRole(updatedData.role);
    setProfileNewsletter(updatedData.newsletter);

    // Save to localStorage
    localStorage.setItem('profileName', updatedData.name);
    localStorage.setItem('profileClub', updatedData.club);
    localStorage.setItem('profileRole', updatedData.role);
    localStorage.setItem('profileNewsletter', JSON.stringify(updatedData.newsletter));

    // Save directly to Firestore and return the promise for the UI to wait on
    const userDocRef = doc(db, 'users', currentUser.uid);
    await setDoc(userDocRef, {
      profiel: {
        email: currentUser.email,
        naam: updatedData.name,
        club: updatedData.club,
        functie: updatedData.role,
        nieuwsbrief: updatedData.newsletter,
        lastUpdated: Date.now()
      }
    }, { merge: true });
  };

   const handleLogout = async () => {
    try {
      // Clear all React states to defaults
      setPlayers([]);
      setHistory([]);
      setTeams([]);
      setTeamPlayers([]);
      setActiveTeamId('all');
      setIsMatchActive(false);
      setOpponent('');
      setGameClockRunning(false);
      setCurrentPeriod(1);
      setPeriodElapsed({ 1: 0, 2: 0, 3: 0, 4: 0 });
      setMatchClockStartTime(null);
      setGlobalActionsLog([]);
      setCurrentStarting5([]);
      setProfileName('');
      setProfileClub('');
      setProfileRole('');
      setProfileNewsletter(false);
      
      // Clear localStorage
      localStorage.removeItem('players');
      localStorage.removeItem('matchesHistory');
      localStorage.removeItem('activeTeamId');
      localStorage.removeItem('isMatchActive');
      localStorage.removeItem('opponent');
      localStorage.removeItem('gameClockRunning');
      localStorage.removeItem('currentPeriod');
      localStorage.removeItem('periodElapsed');
      localStorage.removeItem('matchClockStartTime');
      localStorage.removeItem('globalActionsLog');
      localStorage.removeItem('currentStarting5');
      localStorage.removeItem('profileName');
      localStorage.removeItem('profileClub');
      localStorage.removeItem('profileRole');
      localStorage.removeItem('profileNewsletter');

      // Reset sync variables
      hasSyncedFromFirestore.current = false;

      // Sign out
      await logout();
    } catch (e) {
      console.error("Fout bij het uitloggen:", e);
    }
  };

  // Tick for UI updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if current period has run out and needs auto-pausing
  useEffect(() => {
    if (isMatchActive && gameClockRunning && matchClockStartTime) {
      const currentPeriodDuration = currentPeriod <= 4 ? 10 * 60 * 1000 : 5 * 60 * 1000;
      const liveElapsedTime = (periodElapsed[currentPeriod] || 0) + (Date.now() - matchClockStartTime);
      
      if (liveElapsedTime >= currentPeriodDuration) {
        // Stop the clock immediately at the exact limit!
        const excess = liveElapsedTime - currentPeriodDuration;
        const exactEndTime = Date.now() - excess;
        
        setGameClockRunning(false);
        setPeriodElapsed(prev => ({
          ...prev,
          [currentPeriod]: currentPeriodDuration
        }));
        setMatchClockStartTime(null);
        
        // Update all running players to the exact end of the quarter
        setPlayers(prev => prev.map(p => {
          if (!p.isRunning) return p;
          if (p.lastStartTime) {
            const duration = Math.max(0, exactEndTime - p.lastStartTime);
            return {
              ...p,
              totalTime: p.totalTime + duration,
              lastStartTime: null,
              sessions: [...p.sessions, { start: p.lastStartTime, end: exactEndTime, duration }]
            };
          }
          return p;
        }));
      }
    }
  }, [tick, gameClockRunning, matchClockStartTime, isMatchActive, currentPeriod, periodElapsed]);

  const addPlayer = async (name: string, number: string, position: string, teamIdsToAssociate?: string[]) => {
    if (!currentUser) return;
    
    // Check jersey number in all selected teams
    const targetTeamIds = teamIdsToAssociate || (activeTeamId !== 'all' ? [activeTeamId] : []);
    for (const tId of targetTeamIds) {
      if (isJerseyNumberTakenInTeam(number, tId)) {
        const teamName = teams.find(t => t.id === tId)?.name || 'het team';
        alert(`Kan speler niet aanmaken: rugnummer #${number} is al in gebruik binnen ${teamName}!`);
        return;
      }
    }

    const newPlayerId = generateId();
    const newPlayer: Player = {
      id: newPlayerId,
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

    try {
      const batch = writeBatch(db);
      
      // Save global player structure
      const playerDocRef = doc(db, 'players', newPlayerId);
      batch.set(playerDocRef, {
        ...newPlayer,
        userId: currentUser.uid,
        createdAt: Date.now()
      });

      const newMappings: TeamPlayer[] = [];

      if (targetTeamIds.length > 0) {
        targetTeamIds.forEach(tId => {
          const mappingId = generateId();
          const newMapping = {
            id: mappingId,
            teamId: tId,
            playerId: newPlayerId,
            createdAt: Date.now()
          };
          newMappings.push(newMapping);
          const mappingDocRef = doc(db, 'teamPlayers', mappingId);
          batch.set(mappingDocRef, newMapping);
        });
      }

      await batch.commit();

      // Update React State
      setPlayers(prev => [...prev, newPlayer]);
      if (newMappings.length > 0) {
        setTeamPlayers(prev => [...prev, ...newMappings]);
      }
    } catch (err) {
      console.error("Fout bij het toevoegen van speler via Firestore:", err);
    }
  };

  const removePlayer = async (id: string, deleteGlobally: boolean = false) => {
    if (!currentUser) return;

    try {
      const batch = writeBatch(db);

      if (activeTeamId !== 'all' && !deleteGlobally) {
        // Just unlink from the current active team
        const mappingToDelete = teamPlayers.find(tp => tp.teamId === activeTeamId && tp.playerId === id);
        if (mappingToDelete) {
          batch.delete(doc(db, 'teamPlayers', mappingToDelete.id));
          await batch.commit();
          setTeamPlayers(prev => prev.filter(tp => tp.id !== mappingToDelete.id));
        }
      } else {
        // Delete globally
        if (!window.confirm("Weet je zeker dat je deze speler HELEMAAL wilt verwijderen uit de database? Al zijn statistieken en team-koppelingen worden permanent gewist.")) {
          return;
        }
        
        // 1. Delete player doc
        batch.delete(doc(db, 'players', id));
        
        // 2. Delete all related teamPlayer mappings
        const mappingsToDelete = teamPlayers.filter(tp => tp.playerId === id);
        mappingsToDelete.forEach(m => {
          batch.delete(doc(db, 'teamPlayers', m.id));
        });

        await batch.commit();

        // Update state
        setPlayers(prev => prev.filter(p => p.id !== id));
        setTeamPlayers(prev => prev.filter(tp => tp.playerId !== id));
      }
    } catch (err) {
      console.error("Fout bij het verwijderen/loskoppelen van speler:", err);
    }
  };

  const createTeam = async (name: string): Promise<boolean> => {
    if (!currentUser) {
      alert("Je moet ingelogd zijn om een team aan te maken.");
      return false;
    }
    
    // UI Guard
    if (teams.length >= 3) {
      alert("Helaas, maximaal 3 teams is toegestaan onder dit account.");
      return false;
    }

    const tId = generateId();
    const newTeam: Team = {
      id: tId,
      name,
      userId: currentUser.uid,
      createdAt: Date.now()
    };

    try {
      const batch = writeBatch(db);
      
      // Update /teams/{tId}
      batch.set(doc(db, 'teams', tId), newTeam);
      
      // Update teamCount in /users/{userId}
      const userRef = doc(db, 'users', currentUser.uid);
      batch.set(userRef, {
        profiel: {
          teamCount: teams.length + 1
        }
      }, { merge: true });

      await batch.commit();

      setTeams(prev => [...prev, newTeam]);
      setActiveTeamId(tId); // auto select newly created team as active
      localStorage.setItem('activeTeamId', tId);
      return true;
    } catch (err: any) {
      console.error("Fout bij aanmaken van team:", err);
      alert(`Fout bij het opslaan van het team in de database: ${err?.message || err}`);
      return false;
    }
  };

  const deleteTeam = async (tId: string) => {
    if (!currentUser) return;

    if (!window.confirm("Weet je zeker dat je dit team wilt verwijderen? Spelers die erin zitten blijven bestaan, maar hun koppeling aan dit team wordt permanent verwijderd.")) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Delete /teams/{tId}
      batch.delete(doc(db, 'teams', tId));

      // 2. Delete all related /teamPlayers mappings
      const relatedMappings = teamPlayers.filter(tp => tp.teamId === tId);
      relatedMappings.forEach(tp => {
        batch.delete(doc(db, 'teamPlayers', tp.id));
      });

      // 3. Update teamCount in /users/{userId}
      const userRef = doc(db, 'users', currentUser.uid);
      const newTeamCount = Math.max(0, teams.length - 1);
      batch.set(userRef, {
        profiel: {
          teamCount: newTeamCount
        }
      }, { merge: true });

      await batch.commit();

      // Update states
      setTeams(prev => prev.filter(t => t.id !== tId));
      setTeamPlayers(prev => prev.filter(tp => tp.teamId !== tId));
      
      if (activeTeamId === tId) {
        setActiveTeamId('all');
        localStorage.setItem('activeTeamId', 'all');
      }
    } catch (err) {
      console.error("Fout bij verwijderen van team:", err);
    }
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
    const currentPeriodDuration = currentPeriod <= 4 ? 10 * 60 * 1000 : 5 * 60 * 1000;
    const currentElapsed = getLivePeriodElapsedTime();
    if (!gameClockRunning && currentElapsed >= currentPeriodDuration) {
      alert("Deze periode is afgelopen. Start de volgende periode of voeg een verlenging toe.");
      return;
    }

    const newRunningState = !gameClockRunning;
    setGameClockRunning(newRunningState);
    const now = Date.now();

    if (!newRunningState) {
      if (matchClockStartTime) {
        const elapsedSession = now - matchClockStartTime;
        setPeriodElapsed(prev => ({
          ...prev,
          [currentPeriod]: (prev[currentPeriod] || 0) + elapsedSession
        }));
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

  const adjustOpponentScore = (delta: number) => {
    setOpponentScore(prev => {
      const nextScore = Math.max(0, prev + delta);
      const actualChange = nextScore - prev;

      if (actualChange !== 0) {
        // Decrement +/- of all running players by the actual change in opponent score
        setPlayers(pPrev => pPrev.map(p => {
          if (!p.isRunning) return p;
          const newStats = { ...p.stats };
          newStats.plusMinus = (newStats.plusMinus || 0) - actualChange;
          return {
            ...p,
            stats: newStats
          };
        }));
      }

      return nextScore;
    });
  };

  const updateStat = (id: string, stat: keyof Player['stats'], delta: number) => {
    const player = players.find(p => p.id === id);
    if (!player) return;

    let statChanges: Partial<Record<keyof Player['stats'], number>> = {};
    let label = '';

    if (delta < 0) {
      statChanges = { [stat]: -1 };
      const DutchLabels: Record<string, string> = {
        points: '-1 PTN',
        assists: '-1 Assist',
        rebounds: '-1 Rebound',
        steals: '-1 Steal',
        blocks: '-1 Block',
        turnovers: '-1 Turnover',
        pf: '-1 Fout'
      };
      label = DutchLabels[stat] || `-1 ${stat.toUpperCase()}`;
    } else {
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
          turnovers: '+1 Turnover',
          pf: '+1 Fout'
        };
        label = DutchLabels[stat] || `+1 ${stat.toUpperCase()}`;
      }
    }

    // Update player stats
    const pointsScored = statChanges.points || 0;
    setPlayers(prev => prev.map(p => {
      const isTarget = p.id === id;
      const newStats = { ...p.stats };

      if (isTarget) {
        Object.entries(statChanges).forEach(([key, val]) => {
          const statKey = key as keyof Player['stats'];
          newStats[statKey] = Math.max(0, (newStats[statKey] || 0) + (val || 0));
        });
      }

      if (pointsScored !== 0 && p.isRunning) {
        newStats.plusMinus = (newStats.plusMinus || 0) + pointsScored;
      }

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

      // Subtract the stats from the target player and update +/-
      const pointsScored = lastAction.statChanges.points || 0;
      setPlayers(pPrev => pPrev.map(p => {
        const isTarget = p.id === lastAction.playerId;
        const newStats = { ...p.stats };

        if (isTarget) {
          Object.entries(lastAction.statChanges).forEach(([key, val]) => {
            const statKey = key as keyof Player['stats'];
            newStats[statKey] = Math.max(0, (newStats[statKey] || 0) - (val as number || 0));
          });
        }

        if (pointsScored !== 0 && p.isRunning) {
          newStats.plusMinus = (newStats.plusMinus || 0) - pointsScored;
        }

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

  const handleUpdateMatchSeason = (matchId: string, newSeason: string) => {
    const updatedHistory = history.map(m => {
      if (m.matchId === matchId) {
        return { ...m, season: newSeason };
      }
      return m;
    });
    setHistory(updatedHistory);
    if (selectedMatch && selectedMatch.matchId === matchId) {
      setSelectedMatch({ ...selectedMatch, season: newSeason });
    }
  };

  const seasonStats = useCallback(() => {
    const stats: Record<string, any> = {};
    
    // Filter history matches if a specific team and/or season is active
    const filteredMatches = history.filter(m => {
      const matchTeam = activeTeamId === 'all' || m.teamId === activeTeamId;
      const matchSeasonVal = m.season || '2026/2027';
      const matchSeasonMatch = seasonTabSeasonFilter === 'All' || matchSeasonVal === seasonTabSeasonFilter;
      return matchTeam && matchSeasonMatch;
    });

    // Get the playerIds belonging to this active team (if not 'all')
    const activeTeamPlayerIds = activeTeamId === 'all' 
      ? null 
      : teamPlayers.filter(tp => tp.teamId === activeTeamId).map(tp => tp.playerId);

    filteredMatches.forEach(match => {
      match.players.forEach(p => {
        // Only include this player if they belong to the active team or if no team filter is selected
        if (activeTeamPlayerIds && !activeTeamPlayerIds.includes(p.id)) {
          return;
        }

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
            pf: 0,
            plusMinus: 0,
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
        s.pf += p.stats.pf || 0;
        s.plusMinus += p.stats.plusMinus || 0;
        s.matches += 1;
      });
    });

    // If a team filter is active, make sure all team members appear, even with zeros if they haven't played
    if (activeTeamId !== 'all' && activeTeamPlayerIds) {
      const activeTeamPlayers = players.filter(p => activeTeamPlayerIds.includes(p.id));
      activeTeamPlayers.forEach(p => {
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
            pf: 0,
            plusMinus: 0,
            matches: 0
          };
        }
      });
    }

    return Object.values(stats);
  }, [history, activeTeamId, teamPlayers, players, seasonTabSeasonFilter]);

  const startNewMatch = () => {
    if (!opponent.trim() || selectedStarters.length !== 5 || (teams.length > 0 && !selectedMatchTeamId)) return;

    const starting5Names = players
      .filter(p => selectedStarters.includes(p.id))
      .map(p => `#${p.number} ${p.name}`);

    setCurrentStarting5(starting5Names);

    if (teams.length > 0 && selectedMatchTeamId) {
      setMatchTeamId(selectedMatchTeamId);
      setActiveTeamId(selectedMatchTeamId);
    } else {
      setMatchTeamId(null);
    }

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
    setCurrentPeriod(1);
    setPeriodElapsed({ 1: 0, 2: 0, 3: 0, 4: 0 });
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

    const finalMatchTime = getTotalMatchDuration();
    
    const activeTeamPlayerIds = matchTeamId
      ? teamPlayers.filter(tp => tp.teamId === matchTeamId).map(tp => tp.playerId)
      : null;

    const matchSpecificPlayers = finalPlayers.filter(p => {
      if (activeTeamPlayerIds && !activeTeamPlayerIds.includes(p.id)) {
        return false;
      }
      if (matchInactivePlayerIds.includes(p.id)) {
        return false;
      }
      return true;
    });

    const teamScore = matchSpecificPlayers.reduce((sum, p) => sum + (p.stats.points || 0), 0);

    const newEntry: MatchHistoryEntry = {
      matchId: generateId(),
      date: now,
      opponent,
      players: matchSpecificPlayers,
      totalMatchTime: finalMatchTime,
      starting5: currentStarting5,
      teamId: matchTeamId || undefined,
      teamScore,
      opponentScore,
      season: matchSeason
    };

    setHistory([newEntry, ...history]);
    setPlayers(finalPlayers); // Update local state for reset
    setIsMatchActive(false);
    setMatchTeamId(null);
    setMatchSeason(DEFAULT_SEASON);
    setGameClockRunning(false);
    setCurrentPeriod(1);
    setPeriodElapsed({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setMatchClockStartTime(null);
    setGlobalActionsLog([]);
    setCurrentStarting5([]);
    setSelectedStarters([]);
    setOpponent('');
    setOpponentScore(0);
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
      setCurrentPeriod(1);
      setPeriodElapsed({ 1: 0, 2: 0, 3: 0, 4: 0 });
      setMatchClockStartTime(null);
      setGlobalActionsLog([]);
      setOpponentScore(0);
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
    setCurrentPeriod(1);
    setPeriodElapsed({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setMatchClockStartTime(null);
    setGlobalActionsLog([]);
    setCurrentStarting5([]);
    setSelectedStarters([]);
    setOpponent('');
    setOpponentScore(0);
  };

  const getNameFontSize = (name: string) => {
    const len = name ? String(name).length : 0;
    if (len > 20) return 'text-[11px] sm:text-xs leading-tight font-bold';
    if (len > 15) return 'text-xs sm:text-sm leading-tight font-bold';
    if (len > 10) return 'text-sm sm:text-base leading-tight font-bold';
    return 'text-base sm:text-lg leading-tight font-bold';
  };

  const renderTeams = () => {
    const isLimitReached = teams.length >= 3;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div>
            <h2 className="text-xl sm:text-3xl font-display font-black italic uppercase tracking-tighter text-white">Mijn Teams</h2>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mt-1">
              {teams.length} van de 3 teams gebruikt
            </p>
          </div>
          <button 
            onClick={() => {
              if (isLimitReached) {
                alert("Je hebt de limiet van maximaal 3 teams bereikt!");
                return;
              }
              setShowAddTeamModal(true);
            }}
            disabled={isLimitReached}
            className={`font-display font-black uppercase italic tracking-tighter shadow-lg flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-base p-2.5 sm:px-6 sm:py-3 rounded-xl cursor-pointer ${
              isLimitReached 
                ? 'bg-white/10 text-white/40 cursor-not-allowed shadow-none' 
                : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
            }`}
          >
            <Plus size={18} /> Team Toevoegen
          </button>
        </div>

        {isLimitReached && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl text-center text-xs sm:text-sm text-primary font-bold">
            💡 Je hebt de limiet van 3 teams bereikt. Verwijder een team om een nieuwe te kunnen maken, of neem deel aan premium functionaliteiten!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teams.map(team => {
            const teamRelatedPlayers = players.filter(p => 
              teamPlayers.some(tp => tp.teamId === team.id && tp.playerId === p.id)
            );
            const isActive = activeTeamId === team.id;
            const scheme = getTeamScheme(team);

            return (
              <div 
                key={team.id} 
                className={`bg-surface rounded-2xl border transition-all p-5 flex flex-col justify-between ${
                  isActive 
                    ? `${scheme.borderActive} ring-1 ring-white/10 shadow-xl bg-surface/90` 
                    : 'border-white/5 hover:border-white/10 shadow-lg'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-[0.15em] font-mono">
                      {isActive ? '● Actief Team' : 'Team'}
                    </span>
                    <button 
                      onClick={() => deleteTeam(team.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-lg transition-all cursor-pointer"
                      title="Team Verwijderen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <h3 className="text-xl font-display font-black uppercase italic tracking-tight text-white mb-2 truncate">
                    {team.name}
                  </h3>
                  
                  <p className="text-xs text-text-muted font-medium mb-2 flex items-center gap-1.5 font-sans">
                    <Users size={14} className="text-primary/70" /> {teamRelatedPlayers.length} Spelers gekoppeld
                  </p>

                  {/* Subtle Color Options picker */}
                  <div className="mt-3 mb-4 flex items-center justify-between bg-dark/30 p-2.5 rounded-xl border border-white/5 color-scheme-picker-container">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider font-mono">
                      Kleurthema
                    </span>
                    <div className="flex items-center gap-1.5">
                      {Object.entries(COLOR_SCHEMES).map(([schemeId, s]) => {
                        const isSelected = team.colorScheme === schemeId || (!team.colorScheme && getTeamScheme(team).name === s.name);
                        return (
                          <button
                            key={schemeId}
                            type="button"
                            onClick={() => updateTeamColorScheme(team.id, schemeId)}
                            className={`color-picker-dot w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${s.dotColor} ${
                              isSelected 
                                ? 'ring-2 ring-white scale-110 shadow-md shadow-white/10' 
                                : 'hover:scale-110 opacity-60 hover:opacity-100'
                            }`}
                            title={s.name}
                          >
                            {isSelected && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-6 max-h-[140px] overflow-y-auto pr-1">
                    {teamRelatedPlayers.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-xs bg-dark/40 py-1.5 px-2.5 rounded-lg border border-white/2">
                        <span className="text-white/90 truncate mr-3 font-medium">#{p.number} {p.name}</span>
                        <button
                          onClick={async () => {
                            if (confirm(`Wil je ${p.name} loskoppelen van team ${team.name}?`)) {
                              const mappingToDelete = teamPlayers.find(tp => tp.teamId === team.id && tp.playerId === p.id);
                              if (mappingToDelete) {
                                try {
                                  await deleteDoc(doc(db, 'teamPlayers', mappingToDelete.id));
                                  setTeamPlayers(prev => prev.filter(tp => tp.id !== mappingToDelete.id));
                                } catch (e) {
                                  console.error("Loskoppelen mislukt:", e);
                                }
                              }
                            }
                          }}
                          className="text-[10px] uppercase font-bold text-red-400/80 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          Ontkoppel
                        </button>
                      </div>
                    ))}
                    {teamRelatedPlayers.length === 0 && (
                      <p className="text-xs text-text-muted/60 italic py-2 text-center select-none">Nog geen spelers gekoppeld.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="bg-dark/40 p-3 rounded-xl border border-white/5">
                    <label className="block text-[10px] text-text-muted uppercase font-bold tracking-wider mb-2">Bestaande speler koppelen</label>
                    <div className="space-y-2">
                      <input 
                        type="text"
                        placeholder="Zoek speler..."
                        value={playerSearchQuery[team.id] || ''}
                        onChange={(e) => setPlayerSearchQuery(prev => ({ ...prev, [team.id]: e.target.value }))}
                        className="w-full bg-dark text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary placeholder:text-text-muted/50"
                      />
                      <select
                        onChange={(e) => {
                          const pId = e.target.value;
                          if (pId) {
                            const mappingId = generateId();
                            const mapping: TeamPlayer = {
                              id: mappingId,
                              teamId: team.id,
                              playerId: pId,
                              createdAt: Date.now()
                            };
                            setDoc(doc(db, 'teamPlayers', mappingId), mapping)
                              .then(() => {
                                setTeamPlayers(prev => [...prev, mapping]);
                                setPlayerSearchQuery(prev => ({ ...prev, [team.id]: '' })); // Clear search after adding
                              })
                              .catch(err => console.error("Koppelen mislukt:", err));
                          }
                          e.target.value = '';
                        }}
                        className="w-full bg-dark text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="">Selecteer speler...</option>
                        {players
                          .filter(p => !teamRelatedPlayers.some(tp => tp.playerId === p.id))
                          .filter(p => {
                            const q = (playerSearchQuery[team.id] || '').toLowerCase();
                            if (!q) return true;
                            return p.name.toLowerCase().includes(q) || p.number.toLowerCase().includes(q);
                          })
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.number})
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setActiveTeamId(team.id);
                    }}
                    className={`w-full py-2.5 rounded-xl text-center font-display font-medium text-xs uppercase italic tracking-widest transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-primary/20 text-primary border border-primary/20 font-black' 
                        : 'bg-white/5 hover:bg-white/10 text-white/90'
                    }`}
                  >
                    {isActive ? 'Momenteel Actief' : 'Selecteer als Actief'}
                  </button>
                </div>
              </div>
            );
          })}

          {teams.length === 0 && (
            <div className="col-span-full py-16 text-center text-text-muted bg-surface/30 rounded-3xl border border-dashed border-white/10 w-full">
              <Shield className="mx-auto mb-4 opacity-10 animate-bounce" size={48} />
              <p className="text-sm font-medium text-white mb-2">Je hebt nog geen teams aangemaakt</p>
              <p className="text-xs text-text-muted/65 max-w-sm mx-auto mb-4">
                Maak eerst een team aan om spelers te groeperen en stats per wedstrijd te tracken!
              </p>
              <button 
                onClick={() => setShowAddTeamModal(true)}
                className="bg-primary hover:bg-primary/95 text-white py-2 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md"
              >
                Eerste Team Maken
              </button>
            </div>
          )}
        </div>

        {showAddTeamModal && (
          <div className="fixed inset-0 bg-dark/95 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setShowAddTeamModal(false);
                  setNewTeamName('');
                }}
                className="absolute top-6 right-6 text-text-muted hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-xl sm:text-2xl font-display font-black italic uppercase tracking-tighter mb-6 text-white">
                Team Toevoegen
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase text-text-muted font-bold tracking-wider mb-2">Team Naam</label>
                  <input 
                    type="text" 
                    placeholder="bijv. Heren 1, Junioren U16"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white text-sm"
                  />
                </div>
                
                <button
                  onClick={async () => {
                    if (!newTeamName.trim() || isSavingTeam) return;
                    setIsSavingTeam(true);
                    const success = await createTeam(newTeamName.trim());
                    setIsSavingTeam(false);
                    if (success) {
                      setShowAddTeamModal(false);
                      setNewTeamName('');
                    }
                  }}
                  disabled={!newTeamName.trim() || isSavingTeam}
                  className="w-full bg-primary hover:bg-primary/95 font-display font-black uppercase italic tracking-widest py-3 sm:py-4 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSavingTeam ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Bezig met opslaan...</span>
                    </>
                  ) : (
                    "Team Opslaan"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
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
                setMatchInactivePlayerIds([]);
                setSelectedMatchTeamId(activeTeamId !== 'all' ? activeTeamId : '');
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
 
      {/* Live Scoreboard */}
      {isMatchActive && (
        <div className="bg-surface p-5 sm:p-8 rounded-2xl shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Home Team */}
            <div className="flex-1 text-center md:text-left">
              <span className="text-text-muted text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold block mb-1">EIGEN TEAM</span>
              <div className="flex items-center justify-center md:justify-start gap-4">
                <span className="text-4xl sm:text-6xl font-mono font-black text-primary drop-shadow-[0_0_15px_rgba(255,106,0,0.3)]">
                  {players.reduce((sum, p) => sum + (p.stats.points || 0), 0)}
                </span>
                <div className="text-left hidden sm:block border-l border-white/10 pl-4 py-1">
                  <span className="text-[10px] text-text-muted uppercase tracking-widest block font-bold">Live score</span>
                  <span className="text-[9px] text-primary/80 uppercase tracking-widest block font-bold">Automatisch bijgewerkt</span>
                </div>
              </div>
            </div>

            {/* Separator / Period Info */}
            <div className="flex flex-col items-center justify-center bg-dark/50 px-6 py-3 rounded-2xl border border-white/5 min-w-[120px]">
              <span className="text-text-muted text-[9px] uppercase tracking-widest font-bold mb-0.5">SCOREBOARD</span>
              <span className="text-lg font-display font-black italic uppercase text-white/40 tracking-widest">VS</span>
              <span className="bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider uppercase mt-1">
                {getPeriodLabel(currentPeriod)}
              </span>
            </div>

            {/* Opponent Team */}
            <div className="flex-1 text-center md:text-right w-full sm:w-auto">
              <span className="text-text-muted text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold block mb-1 truncate">{opponent || 'TEGENSTANDER'}</span>
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-end gap-4">
                <div className="flex items-center gap-2 order-2 sm:order-1 border-t sm:border-t-0 sm:border-r border-white/10 pt-2 sm:pt-0 sm:pr-4 py-1">
                  <button 
                    onClick={() => adjustOpponentScore(-1)}
                    className="p-1.5 px-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-black transition-all active:scale-90"
                    title="-1 PT"
                  >
                    -1
                  </button>
                  <button 
                    onClick={() => adjustOpponentScore(1)}
                    className="p-1.5 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-black transition-all active:scale-90"
                    title="+1 PT"
                  >
                    +1
                  </button>
                  <button 
                    onClick={() => adjustOpponentScore(2)}
                    className="p-1.5 px-2.5 bg-primary text-white rounded-lg text-xs font-black transition-all active:scale-90"
                    title="+2 PT"
                  >
                    +2
                  </button>
                  <button 
                    onClick={() => adjustOpponentScore(3)}
                    className="p-1.5 px-2.5 bg-[#ff6a00] text-white rounded-lg text-xs font-black transition-all active:scale-90"
                    title="+3 PT"
                  >
                    +3
                  </button>
                </div>
                <span className="text-4xl sm:text-6xl font-mono font-black text-white order-1 sm:order-2">
                  {opponentScore}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Game Clock Control */}
       <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-4 w-full sm:w-auto">
           <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${gameClockRunning ? 'bg-primary shadow-[0_0_20px_rgba(255,106,0,0.4)]' : (isMatchActive ? 'bg-white/5' : 'bg-white/2 opacity-20')} transition-all`}>
             <Timer size={24} className={`sm:w-8 sm:h-8 ${gameClockRunning ? 'text-white' : (isMatchActive ? 'text-text-muted' : 'text-slate-700')}`} />
           </div>
           <div className={!isMatchActive ? 'opacity-30' : ''}>
             <div className="flex flex-wrap items-center gap-2">
               <h2 className="text-xl sm:text-2xl font-black font-display italic uppercase tracking-tighter text-white">Wedstrijdklok</h2>
               {isMatchActive && (
                 <span className="bg-primary/20 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold font-mono tracking-wider uppercase">
                   {getPeriodLabel(currentPeriod)}
                 </span>
               )}
             </div>
             <div className="text-3xl sm:text-5xl font-mono font-black text-primary tracking-wider mt-1 sm:mt-2">
               {isEditingClock ? (
                <div className="flex flex-wrap items-center gap-2 mt-1 sm:mt-2 text-base font-sans font-medium tracking-normal">
                   {/* Inputs Group */}
                   <div className="flex items-center gap-1.5">
                  <input 
                      type="number" 
                      min="0"
                      max="99"
                      value={editMin} 
                      onChange={e => setEditMin(Math.max(0, parseInt(e.target.value) || 0))} 
                      className="w-14 sm:w-16 bg-dark/60 text-white font-mono text-lg sm:text-xl p-1.5 sm:p-2 text-center rounded-lg border border-white/20 focus:outline-none focus:border-primary font-black"
                      placeholder="Min"
                      id="clock-min-input"
                    />
                    <span className="text-white text-lg sm:text-xl font-bold font-mono">:</span>
                    <input 
                      type="number" 
                      min="0"
                      max="59"
                      value={editSec} 
                      onChange={e => setEditSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-14 sm:w-16 bg-dark/60 text-white font-mono text-lg sm:text-xl p-1.5 sm:p-2 text-center rounded-lg border border-white/20 focus:outline-none focus:border-primary font-black"
                      placeholder="Sec"
                      id="clock-sec-input"
                    />
                  </div>

                  {/* Buttons Group */}
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={saveClockCorrection}
                      className="bg-primary hover:bg-primary/80 text-white text-[11px] sm:text-xs font-black uppercase italic font-display px-3 py-2.5 sm:py-3 rounded-lg transition-colors shadow active:scale-95 whitespace-nowrap"
                      id="save-clock-btn"
                    >
                      Opslaan
                    </button>
                    <button 
                      onClick={() => setIsEditingClock(false)}
                      className="bg-white/10 hover:bg-white/20 text-text-muted hover:text-white text-[11px] sm:text-xs font-black uppercase italic font-display px-2.5 py-2.5 sm:py-3 rounded-lg transition-colors active:scale-95 whitespace-nowrap"
                      id="cancel-clock-btn"
                    >
                      Annuleer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <span className={getRemainingTime() === 0 && isMatchActive ? 'text-red-500 animate-pulse' : 'text-primary'}>
                      {isMatchActive ? formatTime(getRemainingTime()) : '10:00'}
                    </span>
                    {isMatchActive && (
                      <button 
                        onClick={startClockEditing}
                        className="text-text-muted hover:text-primary transition-colors p-1.5 rounded hover:bg-white/5 active:scale-90"
                        title="Corrigeer wedstrijdklok"
                        id="edit-clock-btn"
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                  </div>

                  {isMatchActive && (
                    <div className="flex items-center gap-2 lg:hidden">
                      {/* Minutes adjustment group */}
                      <div className="flex items-center bg-white/5 rounded-xl p-0.5 border border-white/10 shadow-inner">
                        <button 
                          onClick={() => adjustClock(-60000)}
                          className="flex items-center justify-center text-text-muted hover:text-white font-mono font-black text-xs w-9 h-8 rounded-lg hover:bg-white/5 active:scale-90 transition-all select-none"
                          title="-1 minuut"
                          id="adjust-clock-minus-1m"
                        >
                          -1m
                        </button>
                        <div className="h-4 w-px bg-white/10" />
                        <button 
                          onClick={() => adjustClock(60000)}
                          className="flex items-center justify-center text-text-muted hover:text-white font-mono font-black text-xs w-9 h-8 rounded-lg hover:bg-white/5 active:scale-90 transition-all select-none"
                          title="+1 minuut"
                          id="adjust-clock-plus-1m"
                        >
                          +1m
                        </button>
                      </div>

                      {/* Seconds adjustment group */}
                      <div className="flex items-center bg-white/5 rounded-xl p-0.5 border border-white/10 shadow-inner">
                        <button 
                          onClick={() => adjustClock(-1000)}
                          className="flex items-center justify-center text-text-muted hover:text-white font-mono font-black text-xs w-9 h-8 rounded-lg hover:bg-white/5 active:scale-90 transition-all select-none"
                          title="-1 seconde"
                          id="adjust-clock-minus-1s"
                        >
                          -1s
                        </button>
                        <div className="h-4 w-px bg-white/10" />
                        <button 
                          onClick={() => adjustClock(1000)}
                          className="flex items-center justify-center text-text-muted hover:text-white font-mono font-black text-xs w-9 h-8 rounded-lg hover:bg-white/5 active:scale-90 transition-all select-none"
                          title="+1 seconde"
                          id="adjust-clock-plus-1s"
                        >
                          +1s
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
             </div>
             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
               <p className="text-text-muted text-[10px] sm:text-xs uppercase tracking-widest font-medium">
                 {gameClockRunning ? 'Klok Loopt' : (isMatchActive ? (getRemainingTime() === 0 ? 'Periode afgelopen' : 'Klok Gestopt') : 'Wacht op match...')}
               </p>
               {isMatchActive && (
                 <div className="flex items-center gap-1.5 text-[10px] sm:text-xs border-l border-white/10 pl-3">
                   <span className="text-text-muted uppercase tracking-widest font-medium font-sans">Periodes:</span>
                   <select 
                     value={currentPeriod}
                     onChange={(e) => switchPeriod(parseInt(e.target.value))}
                     className="bg-dark/80 text-white font-bold text-[11px] py-0.5 px-1.5 rounded border border-white/10 focus:outline-none focus:border-primary cursor-pointer"
                     id="period-select"
                   >
                     <option value="1">Kwart 1 (10m)</option>
                     <option value="2">Kwart 2 (10m)</option>
                     <option value="3">Kwart 3 (10m)</option>
                     <option value="4">Kwart 4 (10m)</option>
                     {Array.from({ length: Math.max(1, currentPeriod - 3) }, (_, i) => (
                       <option key={i} value={String(5 + i)}>
                         Verlenging {i + 1} (5m)
                       </option>
                     ))}
                   </select>
                 </div>
               )}
             </div>
           </div>
         </div>
         {isMatchActive && !gameClockRunning && (
           <>
             {currentPeriod < 4 && getRemainingTime() === 0 && (
               <button
                 onClick={() => switchPeriod(currentPeriod + 1)}
                 className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-black font-display uppercase italic px-5 py-4 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
                 id="next-period-btn"
               >
                 Volgend Kwart
               </button>
             )}
             {currentPeriod >= 4 && (
               <button
                 onClick={() => switchPeriod(currentPeriod + 1)}
                 className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-black font-display uppercase italic px-5 py-4 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2"
                 id="add-ot-ot-btn"
               >
                 + Verlenging (OT)
               </button>
             )}
           </>
         )}

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
         {filteredPlayers.map(player => {
           const liveTime = player.isRunning && player.lastStartTime 
             ? player.totalTime + (Date.now() - player.lastStartTime) 
             : player.totalTime;
 
           return (
             <motion.div 
               key={player.id}
               layout
               className={`rounded-2xl overflow-hidden shadow-xl border transition-colors ${getTeamBgColorClass(activeTeamId)}`}
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
                   {/* Beurten count removed */}
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
                    <StatControl label="PF" value={player.stats.pf || 0} onAdd={() => updateStat(player.id, 'pf', 1)} onSub={() => updateStat(player.id, 'pf', -1)} />
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

  const renderHistory = () => {
    const filteredHistory = history.filter(m => {
      const matchTeam = activeTeamId === 'all' || m.teamId === activeTeamId;
      const matchSeasonVal = m.season || '2026/2027';
      const matchSeasonMatch = historySeasonFilter === 'All' || matchSeasonVal === historySeasonFilter;
      return matchTeam && matchSeasonMatch;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-display font-black italic uppercase tracking-tighter">
            Wedstrijdhistorie{teams.length > 0 && ` - ${activeTeamId === 'all' ? 'Alle spelers' : (teams.find(t => t.id === activeTeamId)?.name || 'Alle spelers')}`}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-text-muted">Seizoen:</span>
            <select
              value={historySeasonFilter}
              onChange={(e) => setHistorySeasonFilter(e.target.value)}
              className="bg-surface border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary text-white text-xs cursor-pointer font-bold"
            >
              <option value="All">Alle Seizoenen</option>
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2024/2025">2024/2025</option>
            </select>
          </div>
        </div>

        {filteredHistory.length > 0 && (() => {
          const hTotals = {
            matches: filteredHistory.length,
            totalTime: 0,
            totalPlayerTime: 0,
            points: 0,
            fgm: 0, fga: 0,
            threeFgm: 0, threeFga: 0,
            ftm: 0, fta: 0,
            assists: 0,
            rebounds: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            pf: 0
          };

          filteredHistory.forEach(match => {
            hTotals.totalTime += match.totalMatchTime || 0;
            match.players.forEach(p => {
              hTotals.totalPlayerTime += p.totalTime || 0;
              hTotals.points += p.stats.points || 0;
              hTotals.fgm += p.stats.fgm || 0;
              hTotals.fga += p.stats.fga || 0;
              hTotals.threeFgm += p.stats.threeFgm || 0;
              hTotals.threeFga += p.stats.threeFga || 0;
              hTotals.ftm += p.stats.ftm || 0;
              hTotals.fta += p.stats.fta || 0;
              hTotals.assists += p.stats.assists || 0;
              hTotals.rebounds += p.stats.rebounds || 0;
              hTotals.steals += p.stats.steals || 0;
              hTotals.blocks += p.stats.blocks || 0;
              hTotals.turnovers += p.stats.turnovers || 0;
              hTotals.pf += p.stats.pf || 0;
            });
          });

          return (
            <div className={`p-4 sm:p-5 rounded-3xl border space-y-4 shadow-xl transition-all ${activeTeamId === 'all' ? 'bg-gradient-to-br from-primary/15 to-primary/5 border-primary/20' : getTeamBgColorClass(activeTeamId)}`}>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-white/5 pb-3">
                <div>
                  <h3 className="font-display font-black uppercase italic tracking-tight text-md sm:text-lg text-primary">Seizoenstotalen ({activeTeamId === 'all' ? 'Alle Teams' : (teams.find(t => t.id === activeTeamId)?.name || 'Team')})</h3>
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">{hTotals.matches} Gespeelde Wedstrijden</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-[0.1em] block">Totale Team Speeltijd</span>
                  <span className="font-mono text-lg sm:text-xl font-black text-white">{formatTime(hTotals.totalPlayerTime)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-wider font-bold">PTN</p>
                  <p className="text-md sm:text-lg font-black text-primary">{hTotals.points}</p>
                  <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{(hTotals.points / hTotals.matches).toFixed(1)} avg</p>
                </div>
                <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-wider font-bold">FG%</p>
                  <p className="text-md sm:text-lg font-black text-white">{calculatePercentage(hTotals.fgm, hTotals.fga)}</p>
                  <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{hTotals.fgm}/{hTotals.fga}</p>
                </div>
                <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-wider font-bold">AST</p>
                  <p className="text-md sm:text-lg font-black text-white">{hTotals.assists}</p>
                  <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{(hTotals.assists / hTotals.matches).toFixed(1)} avg</p>
                </div>
                <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-wider font-bold">REB</p>
                  <p className="text-md sm:text-lg font-black text-white">{hTotals.rebounds}</p>
                  <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{(hTotals.rebounds / hTotals.matches).toFixed(1)} avg</p>
                </div>
                <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-wider font-bold">STL</p>
                  <p className="text-md sm:text-lg font-black text-white">{hTotals.steals}</p>
                  <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{(hTotals.steals / hTotals.matches).toFixed(1)} avg</p>
                </div>
                <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-wider font-bold">TO</p>
                  <p className="text-md sm:text-lg font-black text-white">{hTotals.turnovers}</p>
                  <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{(hTotals.turnovers / hTotals.matches).toFixed(1)} avg</p>
                </div>
                <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-wider font-bold">PF</p>
                  <p className="text-md sm:text-lg font-black text-red-400">{hTotals.pf}</p>
                  <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{(hTotals.pf / hTotals.matches).toFixed(1)} avg</p>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="space-y-3">
          {filteredHistory.map(match => (
            <div 
              key={match.matchId}
              onClick={() => setSelectedMatch(match)}
              className={`w-full transition-all p-3 sm:p-4 rounded-2xl flex items-center justify-between shadow-lg border text-left cursor-pointer group active:scale-[0.98] ${getTeamBgColorClass(match.teamId || 'all')} hover:brightness-110`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedMatch(match); }}
            >
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Trophy size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-black uppercase italic tracking-tight text-base sm:text-lg truncate">{match.opponent}</h3>
                    {(match.teamScore !== undefined || match.opponentScore !== undefined) && (
                      <span className="bg-primary/25 text-primary border border-primary/20 px-2 py-0.5 rounded-lg text-xs font-mono font-black select-none">
                        {match.teamScore ?? 0} - {match.opponentScore ?? 0}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const totalMatchPlayerTime = match.players.reduce((sum, p) => sum + (p.totalTime || 0), 0);
                    return (
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        <p className="text-[9px] sm:text-[10px] text-text-muted uppercase tracking-widest font-bold">{formatDate(match.date)}</p>
                        <span className="text-[9px] sm:text-[10px] text-primary/60 font-black">•</span>
                        <p className="text-[9px] sm:text-[10px] text-primary font-black uppercase italic tracking-widest" title="Wedstrijdduur">{formatTime(match.totalMatchTime)}</p>
                        <span className="text-[9px] sm:text-[10px] text-primary/60 font-black">•</span>
                        <p className="text-[9px] sm:text-[10px] text-white font-mono font-bold" title="Totale speeltijd van alle spelers opgeteld">Speeltijd team: {formatTime(totalMatchPlayerTime)}</p>
                        {match.teamId && teams.find(t => t.id === match.teamId) && (
                          <>
                            <span className="text-[9px] sm:text-[10px] text-primary/60 font-black">•</span>
                            <span className="text-[9px] sm:text-[10px] font-black uppercase font-display bg-primary/10 text-primary py-0.5 px-2 rounded-md border border-primary/20">
                              {teams.find(t => t.id === match.teamId)?.name}
                            </span>
                          </>
                        )}
                        <span className="text-[9px] sm:text-[10px] text-primary/60 font-black">•</span>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase font-display bg-white/5 text-text-muted py-0.5 px-2 rounded-md border border-white/5">
                          {match.season || '2026/2027'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 text-right flex-shrink-0">
                <div className="hidden sm:block">
                  <p className="text-xs text-text-muted uppercase font-bold tracking-wider">Spelers</p>
                  <p className="font-mono text-xs text-text-muted">{match.players.length}</p>
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
          {filteredHistory.length === 0 && (
            <div className="py-20 text-center text-text-muted bg-surface/30 rounded-3xl border border-dashed border-white/10">
              <HistoryIcon className="mx-auto mb-4 opacity-20" size={48} />
              <p className="text-sm font-bold uppercase text-white font-display">Nog geen wedstrijden</p>
              <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed mt-1">Er zijn geen wedstrijden gevonden voor de huidige selectie.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPlayers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
        <h2 className="text-xl sm:text-3xl font-display font-black italic uppercase tracking-tighter">
          Spelerslijst{teams.length > 0 && ` - ${activeTeamId === 'all' ? 'Alle spelers' : (teams.find(t => t.id === activeTeamId)?.name || 'Alle spelers')}`}
        </h2>
        <button 
          onClick={() => {
            setNewPlayerSelectedTeams(activeTeamId !== 'all' ? [activeTeamId] : []);
            setShowAddPlayerModal(true);
          }}
          className="bg-primary text-white p-2.5 sm:px-6 sm:py-3 rounded-xl font-display font-black uppercase italic tracking-tighter shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-base"
        >
          <Plus size={18} /> <span className="hidden xs:inline">Nieuwe</span> Speler
        </button>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredPlayers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-text-muted bg-surface/30 rounded-3xl border border-dashed border-white/10 w-full px-4">
            <Users className="mx-auto mb-4 opacity-10" size={48} />
            <p className="text-sm font-bold text-white uppercase tracking-wider mb-1">Geen spelers gevonden</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              {activeTeamId === 'all' 
                ? 'Er zijn nog geen spelers in de database. Klik hierboven op "+ Speler" om je eerste speler te registreren!' 
                : 'Dit team heeft nog geen gekoppelde spelers. Gebruik het "Teams" tabblad om spelers te koppelen of voeg hier een nieuwe toe.'}
            </p>
            <button 
              onClick={() => {
                setNewPlayerSelectedTeams(activeTeamId !== 'all' ? [activeTeamId] : []);
                setShowAddPlayerModal(true);
              }}
              className="mt-5 bg-primary/25 border border-primary/20 text-primary hover:bg-primary/40 font-display font-medium text-xs uppercase italic tracking-widest py-2.5 px-6 rounded-lg transition-all active:scale-95 shadow"
            >
              Nieuwe Speler Toevoegen
            </button>
          </div>
        ) : (
          filteredPlayers.map(player => (
            <div key={player.id} className={`p-3 sm:p-4 rounded-2xl border shadow-lg flex items-center justify-between gap-2 group min-w-0 transition-colors ${getTeamBgColorClass(activeTeamId)}`}>
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
                  title={activeTeamId === 'all' ? "Speler verwijderen" : "Speler loskoppelen van team"}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSeason = () => {
    const stats = seasonStats();
    const filteredMatchesForPDF = history.filter(m => {
      const matchTeam = activeTeamId === 'all' || m.teamId === activeTeamId;
      const matchSeasonVal = m.season || '2026/2027';
      const matchSeasonMatch = seasonTabSeasonFilter === 'All' || matchSeasonVal === seasonTabSeasonFilter;
      return matchTeam && matchSeasonMatch;
    });
    const calculatedTotalPlusMinus = filteredMatchesForPDF.reduce((sum, m) => sum + ((m.teamScore ?? 0) - (m.opponentScore ?? 0)), 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-black italic uppercase tracking-tighter">
              Seizoensstatistieken{teams.length > 0 && ` - ${activeTeamId === 'all' ? 'Alle spelers' : (teams.find(t => t.id === activeTeamId)?.name || 'Alle spelers')}`}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-text-muted">Seizoen:</span>
              <select
                value={seasonTabSeasonFilter}
                onChange={(e) => setSeasonTabSeasonFilter(e.target.value)}
                className="bg-dark border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary text-white text-xs cursor-pointer font-bold"
              >
                <option value="All">Alle Seizoenen</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>
            {stats.length > 0 && (
              <button 
                onClick={() => exportSeasonStatsToPDF(stats, theme, calculatedTotalPlusMinus, seasonTabSeasonFilter)}
                className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-xs sm:text-sm font-black italic uppercase font-display transition-all active:scale-95 border border-primary/20 shadow-lg shadow-primary/5"
              >
                <Download size={16} /> <span className="hidden xs:inline">PDF Export</span>
              </button>
            )}
          </div>
        </div>
        <div className={`overflow-hidden rounded-2xl sm:rounded-3xl border shadow-2xl transition-colors ${getTeamBgColorClass(activeTeamId)}`}>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-white/5 text-[9px] sm:text-[10px] uppercase tracking-widest text-text-muted border-b border-white/5 font-bold italic">
                  <th className="px-3 sm:px-4 py-3 sm:py-4 sticky left-0 sm:relative sm:bg-transparent z-10 transition-colors ${getTeamStickyBgColorClass(activeTeamId)}">Speler</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">W</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">Tijd AVG</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">PTN AVG</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">FG%</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">3P%</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4">FT%</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">REB</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">AST</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">STL</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">BLK</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">TO</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right">PF</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-right font-display font-black text-primary">+/-</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s: any) => (
                  <tr key={s.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className={`px-3 sm:px-4 py-3 sm:py-4 sticky left-0 sm:relative sm:bg-transparent z-10 transition-colors ${getTeamStickyBgColorClass(activeTeamId)}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">#{s.number}</span>
                        <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{s.matches || 0}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{formatTime(s.matches > 0 ? s.totalTime / s.matches : 0)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-primary text-xs sm:text-sm">{s.matches > 0 ? (s.points / s.matches).toFixed(1) : '0.0'}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(s.fgm, s.fga)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(s.threeFgm, s.threeFga)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(s.ftm, s.fta)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right">{s.matches > 0 ? (s.rebounds / s.matches).toFixed(1) : '0.0'}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right">{s.matches > 0 ? (s.assists / s.matches).toFixed(1) : '0.0'}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right">{s.matches > 0 ? (s.steals / s.matches).toFixed(1) : '0.0'}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right">{s.matches > 0 ? (s.blocks / s.matches).toFixed(1) : '0.0'}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right">{s.matches > 0 ? (s.turnovers / s.matches).toFixed(1) : '0.0'}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right font-semibold text-red-400">{s.matches > 0 ? (s.pf / s.matches).toFixed(1) : '0.0'}</td>
                    <td className={`px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-sm text-right font-bold ${s.plusMinus > 0 ? 'text-green-400' : s.plusMinus < 0 ? 'text-red-400' : 'text-white'}`}>
                      {s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}
                    </td>
                  </tr>
                ))}

                {stats.length > 0 && (() => {
                  let totalW = stats.length > 0 ? Math.max(...stats.map((s: any) => s.matches || 0)) : 0;
                  let totalTime = stats.reduce((sum, s) => sum + (s.totalTime || 0), 0);
                  let totalPoints = stats.reduce((sum, s) => sum + (s.points || 0), 0);
                  let totalFgm = stats.reduce((sum, s) => sum + (s.fgm || 0), 0);
                  let totalFga = stats.reduce((sum, s) => sum + (s.fga || 0), 0);
                  let total3Fgm = stats.reduce((sum, s) => sum + (s.threeFgm || 0), 0);
                  let total3Fga = stats.reduce((sum, s) => sum + (s.threeFga || 0), 0);
                  let totalFtm = stats.reduce((sum, s) => sum + (s.ftm || 0), 0);
                  let totalFta = stats.reduce((sum, s) => sum + (s.fta || 0), 0);
                  let totalRebounds = stats.reduce((sum, s) => sum + (s.rebounds || 0), 0);
                  let totalAssists = stats.reduce((sum, s) => sum + (s.assists || 0), 0);
                  let totalSteals = stats.reduce((sum, s) => sum + (s.steals || 0), 0);
                  let totalBlocks = stats.reduce((sum, s) => sum + (s.blocks || 0), 0);
                  let totalTurnovers = stats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
                  let totalPf = stats.reduce((sum, s) => sum + (s.pf || 0), 0);
                  const filteredMatches = activeTeamId === 'all' 
                    ? history 
                    : history.filter(m => m.teamId === activeTeamId);
                  let totalPlusMinus = filteredMatches.reduce((sum, m) => sum + ((m.teamScore ?? 0) - (m.opponentScore ?? 0)), 0);

                  return (
                    <tr className="bg-primary/15 border-t border-primary/30 font-bold text-white relative z-10">
                      <td className={`px-3 sm:px-4 py-4 sticky left-0 sm:relative sm:bg-transparent z-10 transition-colors ${activeTeamId === 'all' ? 'bg-[#231710]' : getTeamStickyBgColorClass(activeTeamId)}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-black text-primary">TEAM</span>
                          <span className="font-display font-black uppercase text-xs sm:text-sm whitespace-nowrap text-primary">TOTAAL</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-primary">{totalW}</td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-primary">{formatTime(totalW > 0 ? totalTime / totalW : 0)}</td>
                      <td className="px-3 sm:px-4 py-4 font-bold text-primary font-mono text-[11px] sm:text-sm">
                        {totalW > 0 ? (totalPoints / totalW).toFixed(1) : '0.0'}
                      </td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(totalFgm, totalFga)}</td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(total3Fgm, total3Fga)}</td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm">{calculatePercentage(totalFtm, totalFta)}</td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-right text-orange-200">{totalW > 0 ? (totalRebounds / totalW).toFixed(1) : '0.0'} <span className="text-[9px] text-text-muted font-normal italic">avg</span></td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-right text-orange-200">{totalW > 0 ? (totalAssists / totalW).toFixed(1) : '0.0'} <span className="text-[9px] text-text-muted font-normal italic">avg</span></td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-right text-orange-200">{totalW > 0 ? (totalSteals / totalW).toFixed(1) : '0.0'} <span className="text-[9px] text-text-muted font-normal italic">avg</span></td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-right text-orange-200">{totalW > 0 ? (totalBlocks / totalW).toFixed(1) : '0.0'} <span className="text-[9px] text-text-muted font-normal italic">avg</span></td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-right text-orange-200">{totalW > 0 ? (totalTurnovers / totalW).toFixed(1) : '0.0'} <span className="text-[9px] text-text-muted font-normal italic">avg</span></td>
                      <td className="px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-right text-red-300 font-bold">{totalW > 0 ? (totalPf / totalW).toFixed(1) : '0.0'} <span className="text-[9px] text-red-300/80 font-normal italic">avg</span></td>
                      <td className={`px-3 sm:px-4 py-4 font-mono text-[11px] sm:text-sm text-right font-bold ${totalPlusMinus > 0 ? 'text-green-400' : totalPlusMinus < 0 ? 'text-red-400' : 'text-white'}`}>
                        {totalPlusMinus > 0 ? `+${totalPlusMinus}` : totalPlusMinus}
                      </td>
                    </tr>
                  );
                })()}

                {stats.length === 0 && (
                  <tr>
                    <td colSpan={14} className="py-20 text-center text-text-muted">Geen data beschikbaar</td>
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
  const [newPlayerSelectedTeams, setNewPlayerSelectedTeams] = useState<string[]>([]);

  const updatePlayer = async (id: string, name: string, number: string, position: string) => {
    if (!currentUser) return;
    if (isJerseyNumberConflictingForPlayer(number, id)) {
      alert(`Kan speler niet wijzigen: er is al een teamgenoot met rugnummer #${number}!`);
      return;
    }
    try {
      const playerDocRef = doc(db, 'players', id);
      await setDoc(playerDocRef, {
        name,
        number,
        position
      }, { merge: true });

      setPlayers(prev => prev.map(p => {
        if (p.id !== id) return p;
        return { ...p, name, number, position };
      }));
    } catch (err) {
      console.error("Fout bij bijwerken van speler in Firestore:", err);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-text-muted font-mono uppercase tracking-widest text-[10px] sm:text-xs">Laden...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  if (loadingSync) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-text-muted font-mono uppercase tracking-widest text-[10px] sm:text-xs">Gegevens synchroniseren...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pt-6 max-w-5xl mx-auto px-4 md:px-6">
      <header className="py-4 md:py-6 flex flex-row items-center justify-between gap-4 border-b border-white/5 mb-6">
        <div className="flex-shrink-0">
          <Logo />
        </div>
        
        <div className="hidden md:flex bg-surface rounded-2xl p-1 border border-white/5 backdrop-blur-sm self-center shadow-lg">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Timer size={18} />} label="Match" />
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={18} />} label="Historie" />
          <TabButton active={activeTab === 'season'} onClick={() => setActiveTab('season')} icon={<BarChart3 size={18} />} label="Seizoen" />
          <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} icon={<Shield size={18} />} label="Teams" />
          <TabButton active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={<UserIcon size={18} />} label="Account" />
        </div>

        <div className="flex items-center gap-2.5">
          <div 
            onClick={() => setActiveTab('account')}
            className={`bg-surface/50 border border-white/5 rounded-2xl px-3 py-1.5 flex items-center gap-2.5 backdrop-blur-sm text-xs cursor-pointer hover:bg-surface/80 hover:border-white/10 transition-colors select-none ${activeTab === 'account' ? 'ring-1 ring-primary/40 bg-surface/80' : ''}`}
          >
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[9px] text-text-muted uppercase font-black tracking-wider leading-none mb-0.5">Coach</span>
              <span className="text-white font-mono font-bold max-w-[100px] sm:max-w-[130px] truncate leading-none">{profileName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Coach')}</span>
            </div>
            
            <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-black text-xs border border-primary/25">
              {(profileName || currentUser?.email || 'C')[0].toUpperCase()}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center border border-red-500/10 cursor-pointer"
              title="Log uit"
              id="header-logout-btn"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Active Team Filter Bar */}
      {teams.length > 0 && activeTab !== 'account' && (
        <div className="mb-6 bg-surface/30 p-2 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 pl-2">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-text-muted">Actief Team:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            <button
              onClick={() => {
                if (isMatchActive) return;
                setActiveTeamId('all');
              }}
              disabled={isMatchActive}
              className={`px-3.5 py-1.5 rounded-xl font-display font-medium text-xs uppercase italic tracking-wider transition-all flex items-center gap-1.5 ${
                activeTeamId === 'all'
                  ? 'bg-primary text-white font-black shadow-lg shadow-primary/20'
                  : 'bg-white/5 hover:bg-white/10 text-text-muted hover:text-white'
              } ${isMatchActive ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
              title={isMatchActive ? "Stop de actieve wedstrijd om van team te switchen" : "Laat alle spelers zien"}
            >
              Alle Spelers
            </button>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => {
                  if (isMatchActive) return;
                  setActiveTeamId(team.id);
                }}
                disabled={isMatchActive}
                className={`px-3.5 py-1.5 rounded-xl font-display font-medium text-xs uppercase italic tracking-wider transition-all flex items-center gap-1.5 ${
                  activeTeamId === team.id
                    ? getTeamButtonColorClass(team.id)
                    : 'bg-white/5 hover:bg-white/10 text-text-muted hover:text-white'
                } ${isMatchActive ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
                title={isMatchActive ? "Stop de actieve wedstrijd om van team te switchen" : `Switch naar team ${team.name}`}
              >
                <span>{team.name}</span>
                <span className={`text-[9px] font-bold font-mono rounded-full px-1.5 py-0.2 ${
                  activeTeamId === team.id ? 'bg-white text-primary' : 'bg-white/10 text-text-muted'
                }`}>
                  {teamPlayers.filter(tp => tp.teamId === team.id).length}
                </span>
              </button>
            ))}
            {isMatchActive && (
              <span className="text-[10px] text-red-500 font-black uppercase italic tracking-widest pl-2 bg-red-500/10 py-1.5 px-3 rounded-lg border border-red-500/20 whitespace-nowrap animate-pulse">
                Wedstrijd Actief
              </span>
            )}
          </div>
        </div>
      )}

      <main className="py-4">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'teams' && (
          <div className="space-y-12">
            {renderTeams()}
            <div className="border-t border-white/5 pt-10">
              {renderPlayers()}
            </div>
          </div>
        )}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'season' && renderSeason()}
        {activeTab === 'account' && (
          <AccountScreen
            currentUser={currentUser}
            name={profileName}
            club={profileClub}
            role={profileRole}
            newsletter={profileNewsletter}
            onSaveProfile={handleSaveProfile}
            onLogout={handleLogout}
            theme={theme}
            onThemeChange={setTheme}
          />
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-surface py-3 px-2 flex justify-around items-center z-[100] border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <MobileTabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={20} />} label="Live" />
        <MobileTabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<HistoryIcon size={20} />} label="Historie" />
        <MobileTabButton active={activeTab === 'season'} onClick={() => setActiveTab('season')} icon={<BarChart3 size={20} />} label="Stats" />
        <MobileTabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} icon={<Shield size={20} />} label="Teams" />
        <MobileTabButton active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={<UserIcon size={20} />} label="Account" />
      </nav>

      {/* Footer */}
      <footer className="py-8 text-center text-[10px] text-text-muted uppercase tracking-[0.3em] flex flex-col items-center gap-1">
        <span>Milema Webdesign × Jeremy Hooi Basketball</span>
        <span className="text-[9px] font-mono tracking-normal text-primary/80 lowercase mt-1 font-bold" id="app-version">v.1.00.1</span>
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

                <div>
                  <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Seizoen</label>
                  <select
                    value={matchSeason}
                    onChange={(e) => setMatchSeason(e.target.value)}
                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white text-sm cursor-pointer font-bold"
                  >
                    <option value="2026/2027">2026/2027 (huidig seizoen)</option>
                    <option value="2025/2026">2025/2026</option>
                    <option value="2024/2025">2024/2025</option>
                  </select>
                </div>

                {teams.length > 0 && (
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Kies een Team voor deze wedstrijd</label>
                    <select
                      value={selectedMatchTeamId}
                      onChange={(e) => {
                        setSelectedMatchTeamId(e.target.value);
                        setSelectedStarters([]);
                      }}
                      className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-white text-sm cursor-pointer"
                    >
                      <option value="" disabled>-- Selecteer een Team --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {teams.length > 0 && !selectedMatchTeamId ? (
                  <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 text-center">
                    <p className="text-text-muted text-xs">Selecteer hierboven eerst een team om de basisopstelling te bepalen.</p>
                  </div>
                ) : (() => {
                  const modalPlayers = teams.length > 0 && selectedMatchTeamId 
                    ? getPlayersOfTeam(selectedMatchTeamId)
                    : players;

                  return modalPlayers.length < 5 ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center space-y-2">
                      <p className="text-red-400 text-xs font-bold uppercase tracking-wider">Te weinig spelers</p>
                      <p className="text-text-muted text-xs">
                        Je hebt minimaal 5 spelers nodig om een wedstrijd te kunnen starten. Voeg eerst spelers toe aan {teams.length > 0 ? "dit team" : "de spelerslijst"}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted uppercase font-bold tracking-wider font-display">Spelers (Kies status & starting 5)</span>
                        <span className={`font-black uppercase tracking-widest ${selectedStarters.length === 5 ? 'text-primary' : 'text-white/60'}`}>
                          Starters: {selectedStarters.length} / 5
                        </span>
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar bg-dark/40 p-2.5 rounded-xl border border-white/5">
                        {modalPlayers.map(p => {
                          const isInactive = matchInactivePlayerIds.includes(p.id);
                          const isStarter = selectedStarters.includes(p.id);
                          
                          return (
                            <div 
                              key={p.id} 
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs ${
                                isInactive 
                                  ? 'bg-red-500/5 border-red-500/10 opacity-60' 
                                  : isStarter 
                                    ? 'bg-primary/10 border-primary/45' 
                                    : 'bg-surface border-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                                  isInactive 
                                    ? 'bg-red-500/20 text-red-400' 
                                    : isStarter 
                                      ? 'bg-primary text-white font-black' 
                                      : 'bg-white/5 text-text-muted'
                                }`}>
                                  #{p.number}
                                </span>
                                <span className={`truncate font-medium ${isInactive ? 'text-red-300/60 line-through' : 'text-white/90'}`}>
                                  {p.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Active / Inactive Status toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMatchInactivePlayerIds(prev => {
                                      if (prev.includes(p.id)) {
                                        return prev.filter(id => id !== p.id);
                                      } else {
                                        setSelectedStarters(starters => starters.filter(id => id !== p.id));
                                        return [...prev, p.id];
                                      }
                                    });
                                  }}
                                  className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all select-none cursor-pointer ${
                                    isInactive 
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/25 hover:bg-red-500/30' 
                                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/25'
                                  }`}
                                >
                                  {isInactive ? 'Niet Actief' : 'Actief'}
                                </button>

                                {/* Starter toggle */}
                                <button
                                  type="button"
                                  disabled={isInactive}
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
                                  className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all select-none ${
                                    isInactive 
                                      ? 'bg-white/5 text-white/10 cursor-not-allowed opacity-30' 
                                      : isStarter 
                                        ? 'bg-primary text-white border border-primary/20 cursor-pointer shadow shadow-primary/30' 
                                        : 'bg-white/5 text-text-muted border border-white/5 hover:border-white/10 hover:text-white cursor-pointer'
                                  }`}
                                >
                                  Starten
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <button 
                  onClick={startNewMatch} 
                  disabled={!opponent.trim() || selectedStarters.length !== 5 || (teams.length > 0 && !selectedMatchTeamId)}
                  className="w-full btn-primary disabled:opacity-30 disabled:cursor-not-allowed uppercase font-display font-black italic tracking-widest text-sm py-4 rounded-xl shadow-lg mt-2 transition-all active:scale-95 cursor-pointer"
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
                {teams.length > 0 && (
                  <div>
                    <label className="block text-sm text-text-muted mb-2 uppercase font-medium">Direct koppelen aan Teams</label>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto bg-dark p-3 rounded-xl border border-white/10">
                      {teams.map(team => {
                        const isSelected = newPlayerSelectedTeams.includes(team.id);
                        const isTaken = newPlayerNumber.trim() !== '' && isJerseyNumberTakenInTeam(newPlayerNumber, team.id);
                        
                        return (
                          <label 
                            key={team.id} 
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                              isTaken ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'
                            }`}
                          >
                            <input 
                              type="checkbox"
                              disabled={isTaken}
                              checked={isSelected && !isTaken}
                              onChange={() => {
                                if (isTaken) return;
                                setNewPlayerSelectedTeams(prev => 
                                  prev.includes(team.id) 
                                    ? prev.filter(id => id !== team.id)
                                    : [...prev, team.id]
                                );
                              }}
                              className="rounded border-white/10 text-primary focus:ring-primary bg-dark h-4 w-4"
                            />
                            <span className="truncate text-white font-medium">{team.name}</span>
                            {isTaken && <span className="text-[9px] text-red-400 font-bold ml-auto">(# bezet)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {newPlayerNumber.trim() !== '' && newPlayerSelectedTeams.some(tId => isJerseyNumberTakenInTeam(newPlayerNumber, tId)) && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-semibold text-center">
                    Rugnummer {newPlayerNumber} is al in gebruik binnen een of meer geselecteerde teams!
                  </div>
                )}
                <button 
                  onClick={() => {
                    if (!newPlayerName.trim() || !newPlayerNumber) return;
                    if (newPlayerSelectedTeams.some(tId => isJerseyNumberTakenInTeam(newPlayerNumber, tId))) return;
                    addPlayer(newPlayerName, newPlayerNumber, newPlayerPosition, newPlayerSelectedTeams);
                    setShowAddPlayerModal(false);
                    setNewPlayerName('');
                    setNewPlayerNumber('');
                    setNewPlayerSelectedTeams([]);
                  }} 
                  disabled={!newPlayerName.trim() || !newPlayerNumber || newPlayerSelectedTeams.some(tId => isJerseyNumberTakenInTeam(newPlayerNumber, tId))}
                  className="w-full btn-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-bold">{formatDate(selectedMatch.date)}</p>
                    <span className="text-white/20 text-xs">•</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-0.5">
                        <span className="text-[9px] text-text-muted uppercase font-black tracking-wider">Seizoen:</span>
                        <select
                          value={detailSeason}
                          onChange={(e) => setDetailSeason(e.target.value)}
                          className="bg-transparent border-none text-white text-[10px] font-bold cursor-pointer focus:outline-none py-0.5"
                        >
                          <option value="2026/2027">2026/2027</option>
                          <option value="2025/2026">2025/2026</option>
                          <option value="2024/2025">2024/2025</option>
                        </select>
                      </div>
                      {detailSeason !== (selectedMatch.season || '2026/2027') && (
                        <button
                          onClick={() => handleUpdateMatchSeason(selectedMatch.matchId, detailSeason)}
                          className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase italic tracking-wider font-display px-2.5 py-1 rounded-lg transition-all active:scale-95 shadow-md shadow-primary/10"
                        >
                          Opslaan
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => exportMatchToPDF(selectedMatch, theme)}
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
                  {(selectedMatch.teamScore !== undefined || selectedMatch.opponentScore !== undefined) && (
                    <div className="flex items-center gap-3 bg-dark/40 px-5 py-2.5 rounded-2xl border border-white/5">
                      <div className="text-center">
                        <span className="text-[8px] text-text-muted uppercase tracking-wider font-bold block">Eigen Team</span>
                        <span className="text-2xl font-mono font-black text-primary">{selectedMatch.teamScore ?? 0}</span>
                      </div>
                      <div className="text-xl font-black text-text-muted select-none">-</div>
                      <div className="text-center">
                        <span className="text-[8px] text-text-muted uppercase tracking-wider font-bold block">Tegenstander</span>
                        <span className="text-2xl font-mono font-black text-white">{selectedMatch.opponentScore ?? 0}</span>
                      </div>
                    </div>
                  )}
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

                {(() => {
                  let tTime = 0, tPtn = 0, tAst = 0, tReb = 0, tStl = 0, tBlk = 0, tTo = 0, tPf = 0;
                  let tFgm = 0, tFga = 0, t3Fgm = 0, t3Fga = 0, tFtm = 0, tFta = 0;

                  selectedMatch.players.forEach(p => {
                    tTime += p.totalTime || 0;
                    tPtn += p.stats.points || 0;
                    tAst += p.stats.assists || 0;
                    tReb += p.stats.rebounds || 0;
                    tStl += p.stats.steals || 0;
                    tBlk += p.stats.blocks || 0;
                    tTo += p.stats.turnovers || 0;
                    tPf += p.stats.pf || 0;
                    tFgm += p.stats.fgm || 0;
                    tFga += p.stats.fga || 0;
                    t3Fgm += p.stats.threeFgm || 0;
                    t3Fga += p.stats.threeFga || 0;
                    tFtm += p.stats.ftm || 0;
                    tFta += p.stats.fta || 0;
                  });

                  return (
                    <div className="bg-gradient-to-br from-primary/10 to-primary/2 p-5 sm:p-6 rounded-2xl border border-primary/20 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-white/5 pb-3">
                        <div>
                          <h4 className="font-display font-black uppercase italic tracking-tight text-md text-primary">TEAM TOTAAL (WEDSTRIJD)</h4>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-text-muted uppercase font-bold tracking-[0.1em] block">Totale Team Speeltijd</span>
                          <span className="font-mono text-lg sm:text-xl font-black text-white">{formatTime(tTime)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                          <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">PTN</p>
                          <p className="text-sm sm:text-md font-black text-primary">{tPtn}</p>
                        </div>
                        <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                          <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">FG%</p>
                          <p className="text-sm sm:text-md font-black text-white">{calculatePercentage(tFgm, tFga)}</p>
                          <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{tFgm}/{tFga}</p>
                        </div>
                        <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                          <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">3P%</p>
                          <p className="text-sm sm:text-md font-black text-white">{calculatePercentage(t3Fgm, t3Fga)}</p>
                          <p className="text-[8px] text-text-muted/60 mt-0.5 font-bold">{t3Fgm}/{t3Fga}</p>
                        </div>
                        <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                          <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">AST / REB / STL</p>
                          <p className="text-sm sm:text-md font-black text-white">{tAst} / {tReb} / {tStl}</p>
                        </div>
                        <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                          <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">BLK / TO</p>
                          <p className="text-sm sm:text-md font-black text-white">{tBlk} / {tTo}</p>
                        </div>
                        <div className="bg-dark/40 p-2.5 rounded-xl border border-white/5 text-center">
                          <p className="text-[9px] text-text-muted uppercase font-black tracking-wider">FOUTEN (PF)</p>
                          <p className="text-sm sm:text-md font-black text-red-400">{tPf}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                        
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                          <HistoryStat label="PTN" value={player.stats.points} />
                          <HistoryStat label="AST" value={player.stats.assists} />
                          <HistoryStat label="REB" value={player.stats.rebounds} />
                          <HistoryStat label="STL" value={player.stats.steals} />
                          <HistoryStat label="BLK" value={player.stats.blocks} />
                          <HistoryStat label="TO" value={player.stats.turnovers} />
                          <HistoryStat label="PF" value={player.stats.pf || 0} />
                          <div className={`p-2 rounded-lg text-center border border-white/5 ${
                            (player.stats.plusMinus || 0) > 0 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : (player.stats.plusMinus || 0) < 0 
                                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                : 'bg-dark/50 text-white'
                          }`}>
                            <div className="text-[8px] text-text-muted uppercase font-bold">+/-</div>
                            <div className="text-sm font-bold mt-0.5">
                              {(player.stats.plusMinus || 0) > 0 ? `+${player.stats.plusMinus}` : (player.stats.plusMinus || 0)}
                            </div>
                          </div>
                        </div>

                        {/* Sessie Logs removed */}
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
                {editingPlayer && newPlayerNumber.trim() !== '' && isJerseyNumberConflictingForPlayer(newPlayerNumber, editingPlayer.id) && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-semibold text-center">
                    Rugnummer {newPlayerNumber} is al in gebruik door een teamgenoot!
                  </div>
                )}
                <button 
                  onClick={() => {
                    if (!newPlayerName.trim() || !newPlayerNumber) return;
                    if (isJerseyNumberConflictingForPlayer(newPlayerNumber, editingPlayer.id)) return;
                    updatePlayer(editingPlayer.id, newPlayerName, newPlayerNumber, newPlayerPosition);
                    setShowEditPlayerModal(false);
                    setEditingPlayer(null);
                    setNewPlayerName('');
                    setNewPlayerNumber('');
                  }} 
                  disabled={!newPlayerName.trim() || !newPlayerNumber || isJerseyNumberConflictingForPlayer(newPlayerNumber, editingPlayer.id)}
                  className="w-full btn-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
    <div className="flex flex-col items-start select-none">
      <div className="flex items-baseline gap-1">
        <h1 className="text-lg sm:text-2xl font-black font-display italic uppercase tracking-tighter leading-none">
          <span className="text-white">Basketball</span>
          <span className="text-primary ml-1">Coach</span>
        </h1>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[9px] sm:text-[11px] font-black text-text-muted uppercase tracking-[0.25em] font-sans">
          Game <span className="text-primary font-bold">Stats</span>
        </span>
        <div className="h-[1px] w-3 bg-primary/30 rounded-full"></div>
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
