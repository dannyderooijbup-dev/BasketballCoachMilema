import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  isAdmin: boolean;
}

export default function AdminDashboard({ isAdmin }: AdminDashboardProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMembership, setFilterMembership] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Selected user for management modal placeholder
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

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

          return {
            id: docSnap.id,
            email: profiel.email || docSnap.id,
            naam: profiel.naam || '',
            club: profiel.club || '',
            role,
            membership,
            lastLogin: profiel.lastLogin || null
          };
        });

        setUsers(fetchedUsers);
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
    // Search query check
    const query = searchQuery.toLowerCase().trim();
    const matchQuery = 
      !query ||
      u.naam.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.club.toLowerCase().includes(query);

    // Membership type filter
    const matchMembership =
      filterMembership === 'all' || u.membership?.type === filterMembership;

    // Role filter
    const matchRole = filterRole === 'all' || u.role === filterRole;

    // Status filter
    const matchStatus =
      filterStatus === 'all' || u.membership?.status === filterStatus;

    return matchQuery && matchMembership && matchRole && matchStatus;
  });

  return (
    <div className="space-y-8 select-none">
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
                      className="hover:bg-white/[0.02] transition-colors"
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
                          className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ml-auto cursor-pointer"
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

      {/* Manage User Modal Placeholder */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-surface border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">
                    Gebruiker Beheren
                  </span>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                    {selectedUser.naam || 'Naamloze Gebruiker'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Overview Details */}
              <div className="space-y-4 bg-background/50 p-4 rounded-2xl border border-white/5 text-xs text-text-muted">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5"><Mail size={14} /> E-mail</span>
                  <span className="font-mono text-white">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5"><Building2 size={14} /> Club</span>
                  <span className="text-white">{selectedUser.club || 'Geen club opgegeven'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Huidige Rol</span>
                  <span className="font-bold text-primary capitalize">{selectedUser.role}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5"><Sparkles size={14} /> Membership Type</span>
                  <span className="font-bold text-emerald-400 capitalize">{selectedUser.membership?.type || 'pending'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5"><Clock size={14} /> Membership Status</span>
                  <span className="font-bold text-amber-400 capitalize">{selectedUser.membership?.status || 'pending'}</span>
                </div>
                {selectedUser.membership?.approvedAt && (
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="flex items-center gap-1.5"><Calendar size={14} /> Goedgekeurd op</span>
                    <span className="text-white/80">{new Date(selectedUser.membership.approvedAt).toLocaleDateString('nl-NL')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span>User Firestore ID</span>
                  <span className="font-mono text-[10px] text-text-muted">{selectedUser.id}</span>
                </div>
              </div>

              {/* Placeholder Notice for Step 5 */}
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary/90 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-primary">
                  <Sliders size={14} /> Beheersysteem Module
                </p>
                <p>
                  In de volgende stap worden hier de directe acties (zoals status wijzigen, rol toewijzen en account goedkeuren) geactiveerd.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
