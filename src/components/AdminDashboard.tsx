import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminUser, UserRole, UserMembership } from '../types';
import { 
  Users, 
  Clock, 
  UserCheck, 
  Building2, 
  ShieldCheck, 
  Search, 
  Filter, 
  Sliders, 
  X, 
  Sparkles,
  ShieldAlert,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Lock,
  User as UserIcon,
  RotateCcw,
  Activity,
  Check,
  Info,
  Layers,
  ArrowUpRight,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  isAdmin: boolean;
  currentUserId?: string;
}

interface ActionConfirmation {
  type: 'membership' | 'role';
  title: string;
  actionLabel: string;
  targetValue: string;
  description: string;
}

export default function AdminDashboard({ isAdmin, currentUserId }: AdminDashboardProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMembership, setFilterMembership] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Selected user for management side-panel (drawer/bottom-sheet)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ActionConfirmation | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Toast auto-hide timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Real-time Firestore sync for all users
  useEffect(() => {
    if (!isAdmin) return;

    setLoading(true);
    const usersCollectionRef = collection(db, 'users');

    const unsubscribe = onSnapshot(
      usersCollectionRef,
      (snapshot) => {
        const fetchedUsers: AdminUser[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const profiel = data.profiel || {};
          const membership: UserMembership = data.membership || {
            status: 'pending',
            type: 'pending',
            trialStart: null,
            trialEnd: null,
            approvedAt: null,
            approvedBy: null
          };
          const role: UserRole = (data.role as UserRole) || 'user';

          // Automatic one-time migration in Firestore for existing users missing the role field
          if (!data.role) {
            setDoc(docSnap.ref, { role: 'user' }, { merge: true }).catch((err) =>
              console.error('Fout bij automatische role migratie:', err)
            );
          }

          const createdAt = profiel.createdAt || profiel.migratedAt || data.createdAt || data.membership?.approvedAt || null;
          const lastLogin = profiel.lastLogin || data.lastLogin || null;
          const playerCount = Array.isArray(data.spelers) ? data.spelers.length : 0;
          const teamCount = Array.isArray(data.teams) ? data.teams.length : (profiel.teamCount || 0);

          return {
            id: docSnap.id,
            email: profiel.email || docSnap.id,
            naam: profiel.naam || '',
            club: profiel.club || '',
            role,
            membership,
            createdAt,
            lastLogin,
            teamCount,
            playerCount
          };
        });

        setUsers(fetchedUsers);

        // Keep selectedUser updated if already open
        if (selectedUser) {
          const updated = fetchedUsers.find(u => u.id === selectedUser.id);
          if (updated) setSelectedUser(updated);
        }

        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Fout bij ophalen van gebruikers voor Admin Dashboard:', err);
        setError('Kan gebruikersgegevens niet ophalen uit Firestore.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="bg-surface border border-red-500/20 rounded-3xl p-8 text-center max-w-lg mx-auto my-12 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-black font-display uppercase tracking-tight text-white mb-2">
          Geen Toegang
        </h2>
        <p className="text-sm text-text-muted">
          Je hebt geen beheerdersrechten om het Admin Dashboard te bekijken.
        </p>
      </div>
    );
  }

  // Calculate statistics
  const totalUsers = users.length;
  const pendingCount = users.filter(u => u.membership?.status === 'pending' || u.membership?.type === 'pending').length;
  const trialCount = users.filter(u => u.membership?.type === 'trial').length;
  const coachCount = users.filter(u => u.membership?.type === 'coach').length;
  const clubCount = users.filter(u => u.membership?.type === 'club').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim();
    const matchQuery = 
      !query ||
      u.naam.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.club.toLowerCase().includes(query);

    const matchMembership =
      filterMembership === 'all' || u.membership?.type === filterMembership;

    const matchRole = filterRole === 'all' || u.role === filterRole;

    const matchStatus =
      filterStatus === 'all' || u.membership?.status === filterStatus;

    return matchQuery && matchMembership && matchRole && matchStatus;
  });

  // Date format helpers
  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return 'Onbekend';
    return new Date(timestamp).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (timestamp?: number | null) => {
    if (!timestamp) return 'Nog niet ingelogd';
    return new Date(timestamp).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTriggerAction = (action: ActionConfirmation) => {
    setConfirmDialog(action);
  };

  const handleConfirmActionDemo = () => {
    if (!confirmDialog) return;
    setToastMessage(`[Demo Status] Actie "${confirmDialog.actionLabel}" voorbereid! In de volgende stap wordt dit verwerkt.`);
    setConfirmDialog(null);
  };

  const isSelf = selectedUser ? selectedUser.id === currentUserId : false;

  return (
    <div className="space-y-8 select-none relative">
      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-[200] max-w-md bg-emerald-500 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-3 border border-emerald-400"
          >
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/40 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/30">
              Systeembeheer
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-display italic uppercase tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="text-primary" size={30} />
            Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Beheer gebruikers, memberships, trials en rollen realtime vanuit Firestore.
          </p>
        </div>
      </div>

      {/* Error state if any */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Realtime Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Users */}
        <div className="bg-surface/60 border border-white/5 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all hover:border-white/10">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Totaal</span>
            <Users size={18} className="text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {loading ? '...' : totalUsers}
          </div>
          <span className="text-[10px] text-text-muted mt-1">Geregistreerd</span>
        </div>

        {/* Pending */}
        <div className="bg-surface/60 border border-amber-500/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
            <Clock size={18} className="animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
            {loading ? '...' : pendingCount}
          </div>
          <span className="text-[10px] text-amber-400/80 mt-1">Wacht op goedkeuring</span>
        </div>

        {/* Trial */}
        <div className="bg-surface/60 border border-cyan-500/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all hover:border-cyan-500/40">
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Trial</span>
            <Sparkles size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
            {loading ? '...' : trialCount}
          </div>
          <span className="text-[10px] text-cyan-400/80 mt-1">Proefperiode</span>
        </div>

        {/* Coach */}
        <div className="bg-surface/60 border border-emerald-500/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Coach</span>
            <UserCheck size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            {loading ? '...' : coachCount}
          </div>
          <span className="text-[10px] text-emerald-400/80 mt-1">Individuele coaches</span>
        </div>

        {/* Club */}
        <div className="bg-surface/60 border border-purple-500/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all hover:border-purple-500/40">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Club</span>
            <Building2 size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-purple-400">
            {loading ? '...' : clubCount}
          </div>
          <span className="text-[10px] text-purple-400/80 mt-1">Clublicenties</span>
        </div>

        {/* Admins */}
        <div className="bg-surface/60 border border-primary/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all hover:border-primary/40">
          <div className="flex items-center justify-between text-primary mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Admins</span>
            <ShieldCheck size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-primary">
            {loading ? '...' : adminCount}
          </div>
          <span className="text-[10px] text-primary/80 mt-1">Systeembeheerders</span>
        </div>
      </div>

      {/* Main User List Section */}
      <div className="bg-surface/55 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
        {/* Filters and Search toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op naam, e-mail of club..."
              className="w-full bg-background/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-background/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-text-muted">
              <Filter size={14} className="text-primary" />
              <span className="font-semibold text-white/80">Filters:</span>
            </div>

            {/* Filter Membership */}
            <select
              value={filterMembership}
              onChange={(e) => setFilterMembership(e.target.value)}
              className="bg-background/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Membership: Alle</option>
              <option value="pending">Pending</option>
              <option value="trial">Trial</option>
              <option value="coach">Coach</option>
              <option value="club">Club</option>
            </select>

            {/* Filter Role */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-background/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Rol: Alle</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-background/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Status: Alle</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-white/5 text-text-muted uppercase font-mono text-[10px] tracking-wider border-b border-white/5">
              <tr>
                <th className="px-4 py-3.5">Naam</th>
                <th className="px-4 py-3.5">E-mail</th>
                <th className="px-4 py-3.5">Membership</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Rol</th>
                <th className="px-4 py-3.5 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium text-white/90">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <div className="inline-flex items-center gap-2">
                      <Clock size={16} className="animate-spin text-primary" />
                      <span>Gebruikers laden uit Firestore...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    Geen gebruikers gevonden die voldoen aan de zoekcriteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isUserAdmin = u.role === 'admin';
                  const isPending = u.membership?.status === 'pending' || u.membership?.type === 'pending';

                  return (
                    <tr 
                      key={u.id}
                      className={`hover:bg-white/[0.02] transition-colors ${selectedUser?.id === u.id ? 'bg-primary/5' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border ${
                            isUserAdmin 
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                              : 'bg-primary/20 text-primary border-primary/30'
                          }`}>
                            {(u.naam || u.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div>{u.naam || 'Geen naam ingesteld'}</div>
                            {u.club && (
                              <div className="text-[11px] text-text-muted font-normal">
                                {u.club}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-text-muted font-mono text-xs whitespace-nowrap">
                        {u.email}
                      </td>

                      {/* Membership Type */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                          u.membership?.type === 'coach' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          u.membership?.type === 'club' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          u.membership?.type === 'trial' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {u.membership?.type || 'pending'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isPending 
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse' 
                            : u.membership?.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}>
                          {isPending ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                          <span className="capitalize">{u.membership?.status || 'pending'}</span>
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isUserAdmin 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-white/5 text-text-muted border border-white/10'
                        }`}>
                          {isUserAdmin && <ShieldCheck size={12} />}
                          <span>{u.role}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ml-auto cursor-pointer ${
                            selectedUser?.id === u.id
                              ? 'bg-primary text-slate-950 border-primary shadow-lg'
                              : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20'
                          }`}
                        >
                          <Sliders size={14} />
                          <span>Beheren</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Panel Drawer (Desktop Right Side) / Bottom Sheet (Mobile) */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[150] flex flex-col md:flex-row justify-end bg-black/75 backdrop-blur-sm select-none">
            {/* Backdrop click dismiss */}
            <div 
              className="fixed inset-0 z-0" 
              onClick={() => setSelectedUser(null)} 
            />

            <motion.div
              initial={{ x: '100%', y: 0, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              exit={{ x: '100%', y: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative z-10 w-full md:w-[500px] lg:w-[540px] max-w-full h-[90vh] md:h-full bg-surface border-t md:border-t-0 md:border-l border-white/10 rounded-t-3xl md:rounded-l-3xl md:rounded-r-none shadow-2xl flex flex-col mt-auto md:mt-0 overflow-hidden"
            >
              {/* Mobile handle indicator */}
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-2.5 md:hidden flex-shrink-0" />

              {/* Panel Header */}
              <div className="px-6 py-5 border-b border-white/10 bg-surface/80 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm border ${
                    selectedUser.role === 'admin' 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                      : 'bg-primary/20 text-primary border-primary/30'
                  }`}>
                    {(selectedUser.naam || selectedUser.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                      <span>Beheerpaneel</span>
                      {isSelf && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-semibold border border-amber-500/30">
                          Jij (Self)
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white truncate max-w-[280px]">
                      {selectedUser.naam || 'Naamloze Gebruiker'}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors cursor-pointer"
                  title="Sluiten"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Panel Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                {/* Sectie 1: Gebruikersinformatie */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                    <UserIcon size={14} className="text-primary" />
                    <span>Gebruikersinformatie</span>
                  </div>

                  <div className="bg-background/60 p-4 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">Volledige Naam</span>
                      <span className="text-sm font-bold text-white">
                        {selectedUser.naam || 'Geen naam ingesteld'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">E-mailadres</span>
                      <span className="text-sm font-mono text-white flex items-center gap-1.5">
                        <Mail size={14} className="text-text-muted" />
                        {selectedUser.email}
                      </span>
                    </div>

                    {selectedUser.club && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-text-muted">Club / Organisatie</span>
                        <span className="text-sm font-semibold text-white/90 flex items-center gap-1.5">
                          <Building2 size={14} className="text-text-muted" />
                          {selectedUser.club}
                        </span>
                      </div>
                    )}

                    {/* Status & Membership badges */}
                    <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-muted uppercase font-mono">Status</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          selectedUser.membership?.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : selectedUser.membership?.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}>
                          <CheckCircle2 size={12} />
                          <span className="capitalize">{selectedUser.membership?.status || 'pending'}</span>
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-muted uppercase font-mono">Huidig Membership</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white capitalize">
                          <Sparkles size={12} className="text-primary" />
                          <span>{selectedUser.membership?.type || 'pending'}</span>
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-muted uppercase font-mono">Systeemrol</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          selectedUser.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-white/5 text-text-muted border border-white/10'
                        }`}>
                          <ShieldCheck size={12} />
                          <span>{selectedUser.role}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sectie 2: Lidmaatschap (Contextafhankelijke Acties) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                      <Sparkles size={14} className="text-emerald-400" />
                      <span>Lidmaatschap Beheren</span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">Selecteer actie</span>
                  </div>

                  <p className="text-xs text-text-muted">
                    Selecteer een status- of typewijziging voor dit account:
                  </p>

                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Start proefperiode */}
                    <button
                      onClick={() => handleTriggerAction({
                        type: 'membership',
                        title: 'Proefperiode Starten',
                        actionLabel: 'Start proefperiode (14 dagen)',
                        targetValue: 'trial',
                        description: `Hiermee krijgt ${selectedUser.naam || selectedUser.email} een proeflicentie voor 14 dagen met status active.`
                      })}
                      className="p-3.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-left transition-all group cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                          <Clock size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                            Start proefperiode
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Activeer 14 dagen volledige proeftoegang
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>

                    {/* Activeer Coach */}
                    <button
                      onClick={() => handleTriggerAction({
                        type: 'membership',
                        title: 'Coach Membership Activeren',
                        actionLabel: 'Activeer Coach Licentie',
                        targetValue: 'coach',
                        description: `Hiermee wordt ${selectedUser.naam || selectedUser.email} omgezet naar een actieve Coach licentie.`
                      })}
                      className="p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-left transition-all group cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <UserCheck size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                            Activeer Coach
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Toegang voor individuele basketball coach
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>

                    {/* Activeer Club */}
                    <button
                      onClick={() => handleTriggerAction({
                        type: 'membership',
                        title: 'Club Membership Activeren',
                        actionLabel: 'Activeer Club Licentie',
                        targetValue: 'club',
                        description: `Hiermee krijgt ${selectedUser.naam || selectedUser.email} een actieve Club organisatie-licentie met volledige functionaliteit.`
                      })}
                      className="p-3.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-left transition-all group cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                            Activeer Club
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Volledige clublicentie voor verenigingen
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-purple-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>

                    {/* Upgrade naar Club */}
                    <button
                      onClick={() => handleTriggerAction({
                        type: 'membership',
                        title: 'Upgrade naar Club',
                        actionLabel: 'Upgrade naar Club Licentie',
                        targetValue: 'club',
                        description: `Upgrade de bestaande coach-account van ${selectedUser.naam || selectedUser.email} naar een Club licentie.`
                      })}
                      className="p-3.5 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-left transition-all group cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                            Upgrade naar Club
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Schaal op naar organisatie-niveau
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>

                    {/* Zet terug naar Pending */}
                    <button
                      onClick={() => handleTriggerAction({
                        type: 'membership',
                        title: 'Status Reset naar Pending',
                        actionLabel: 'Zet terug naar Pending',
                        targetValue: 'pending',
                        description: `Hiermee wordt de toegang van ${selectedUser.naam || selectedUser.email} geblokkeerd totdat de beheerder deze opnieuw goedkeurt.`
                      })}
                      className="p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-left transition-all group cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                          <RotateCcw size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                            Zet terug naar Pending
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Plaats account opnieuw in afwachting
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>

                {/* Sectie 3: Rol (System Role Management) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                      <ShieldCheck size={14} className="text-amber-400" />
                      <span>Systeemrol</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400">
                      Huidig: {selectedUser.role}
                    </span>
                  </div>

                  {/* Self-protection Warning Banner */}
                  {isSelf && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                      <Lock size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-200/90 leading-relaxed">
                        <span className="font-bold text-amber-400 block mb-0.5">Eigen beheerderaccount</span>
                        Je bent momenteel ingelogd als deze beheerder. Om te voorkomen dat je jezelf buitensluit, kun je je eigen rol niet wijzigen.
                      </div>
                    </div>
                  )}

                  {/* Role Selector Controls */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* User Option */}
                    <button
                      disabled={isSelf}
                      onClick={() => handleTriggerAction({
                        type: 'role',
                        title: 'Systeemrol Wijzigen naar Gebruiker',
                        actionLabel: 'Wijzig Rol naar Gebruiker',
                        targetValue: 'user',
                        description: `Hiermee verliest ${selectedUser.naam || selectedUser.email} de beheerdersrechten en wordt een standaard gebruiker.`
                      })}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        selectedUser.role === 'user'
                          ? 'bg-white/10 border-white/20 text-white font-bold'
                          : 'bg-background/40 border-white/5 text-text-muted hover:border-white/10'
                      } ${isSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2">
                        <UserIcon size={16} className={selectedUser.role === 'user' ? 'text-primary' : 'text-text-muted'} />
                        <div>
                          <div className="text-xs font-bold text-white">Gebruiker</div>
                          <div className="text-[10px] text-text-muted">Standaard rol</div>
                        </div>
                      </div>
                      {selectedUser.role === 'user' && <Check size={14} className="text-primary" />}
                    </button>

                    {/* Admin Option */}
                    <button
                      disabled={isSelf}
                      onClick={() => handleTriggerAction({
                        type: 'role',
                        title: 'Systeemrol Wijzigen naar Beheerder',
                        actionLabel: 'Promoveer tot Admin',
                        targetValue: 'admin',
                        description: `Hiermee krijgt ${selectedUser.naam || selectedUser.email} volledige beheerdersrechten en toegang tot het Admin Dashboard.`
                      })}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        selectedUser.role === 'admin'
                          ? 'bg-amber-500/20 border-amber-500/30 text-amber-300 font-bold'
                          : 'bg-background/40 border-white/5 text-text-muted hover:border-white/10'
                      } ${isSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className={selectedUser.role === 'admin' ? 'text-amber-400' : 'text-text-muted'} />
                        <div>
                          <div className="text-xs font-bold text-white">Beheerder</div>
                          <div className="text-[10px] text-text-muted">Admin rechten</div>
                        </div>
                      </div>
                      {selectedUser.role === 'admin' && <Check size={14} className="text-amber-400" />}
                    </button>
                  </div>
                </div>

                {/* Sectie 4: Accountinformatie (Alleen-Lezen) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                    <Info size={14} className="text-blue-400" />
                    <span>Accountinformatie</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Registratiedatum */}
                    <div className="bg-background/50 p-3.5 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase flex items-center gap-1">
                        <Calendar size={12} /> Registratiedatum
                      </span>
                      <span className="text-xs font-bold text-white block">
                        {formatDate(selectedUser.createdAt)}
                      </span>
                    </div>

                    {/* Laatste login */}
                    <div className="bg-background/50 p-3.5 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase flex items-center gap-1">
                        <Clock size={12} /> Laatste Login
                      </span>
                      <span className="text-xs font-bold text-white block">
                        {formatDateTime(selectedUser.lastLogin)}
                      </span>
                    </div>

                    {/* Aantal teams */}
                    <div className="bg-background/50 p-3.5 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase flex items-center gap-1">
                        <Shield size={12} /> Aantal Teams
                      </span>
                      <span className="text-sm font-black font-mono text-primary block">
                        {selectedUser.teamCount ?? 0}
                      </span>
                    </div>

                    {/* Aantal spelers */}
                    <div className="bg-background/50 p-3.5 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase flex items-center gap-1">
                        <Users size={12} /> Aantal Spelers
                      </span>
                      <span className="text-sm font-black font-mono text-emerald-400 block">
                        {selectedUser.playerCount ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sectie 5: Activiteit */}
                <div className="space-y-3 pb-6">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                    <Activity size={14} className="text-purple-400" />
                    <span>Activiteit</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-background/30 border border-white/5 text-center text-xs text-text-muted italic flex items-center justify-center gap-2">
                    <Layers size={14} className="text-text-muted/60" />
                    <span>Activiteit wordt in een volgende versie toegevoegd.</span>
                  </div>
                </div>

              </div>

              {/* Panel Footer */}
              <div className="p-4 border-t border-white/10 bg-surface/90 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] font-mono text-text-muted">
                  ID: {selectedUser.id.substring(0, 12)}...
                </span>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Modal Placeholder */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {confirmDialog.title}
                  </h3>
                  <span className="text-[11px] font-mono text-primary">
                    Bevestigingsstap (Voorbereiding)
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs text-text-muted">
                <p className="text-white font-medium leading-relaxed">
                  {confirmDialog.description}
                </p>

                <div className="p-3.5 rounded-2xl bg-background/80 border border-white/5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Doelgebruiker:</span>
                    <span className="text-white">{selectedUser?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Actie:</span>
                    <span className="text-primary font-bold">{confirmDialog.actionLabel}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] flex items-center gap-2">
                  <Info size={14} className="flex-shrink-0" />
                  <span>
                    In de volgende stap wordt deze actie rechtstreeks doorgestuurd naar Firestore.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleConfirmActionDemo}
                  className="px-5 py-2 rounded-xl bg-primary text-slate-950 font-black text-xs hover:bg-primary-hover transition-all active:scale-95 cursor-pointer shadow-lg shadow-primary/20"
                >
                  Bevestigen (Demo)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
