import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Users, 
  UserPlus, 
  Shield, 
  Crown, 
  Pencil, 
  CheckCircle2, 
  Clock, 
  Info, 
  Sparkles, 
  X, 
  Check, 
  RefreshCw,
  User,
  Mail,
  Users2,
  Send,
  Ban,
  Settings,
  AlertCircle
} from 'lucide-react';
import { ClubWorkspace, ClubMember, ClubMemberRole, UserMembership, Team, ClubInvite, InviteRole } from '../types';
import { 
  getClubForUser, 
  getClubMembers, 
  updateClubName, 
  ensureClubWorkspaceForUser,
  getClubTeams
} from '../services/clubService';
import {
  createInvite,
  cancelInvite,
  subscribeToClubInvites
} from '../services/clubInviteService';

interface ClubDashboardProps {
  currentUserId?: string;
  membership?: UserMembership | null;
}

type TabType = 'leden' | 'uitnodigingen' | 'instellingen';

export default function ClubDashboard({ currentUserId, membership }: ClubDashboardProps) {
  const [club, setClub] = useState<ClubWorkspace | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [clubTeams, setClubTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('leden');

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Invite Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('coach');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Confirm Cancel Invite Modal State
  const [inviteToCancel, setInviteToCancel] = useState<ClubInvite | null>(null);
  const [isCancellingInvite, setIsCancellingInvite] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadClubData = async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let userClub = await getClubForUser(currentUserId);
      if (!userClub && membership?.type === 'club' && membership?.status === 'active') {
        userClub = await ensureClubWorkspaceForUser(currentUserId);
      }

      setClub(userClub);
      if (userClub) {
        setNewClubName(userClub.naam);
        const [clubMembersList, teamsList] = await Promise.all([
          getClubMembers(userClub.id),
          getClubTeams(userClub.id)
        ]);
        setMembers(clubMembersList);
        setClubTeams(teamsList);
      }
    } catch (err) {
      console.error("Fout bij laden van Club Workspace gegevens:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClubData();
  }, [currentUserId, membership]);

  // Realtime subscription for invites
  useEffect(() => {
    if (!club?.id) return;

    const unsubscribe = subscribeToClubInvites(club.id, (updatedInvites) => {
      setInvites(updatedInvites);
    });

    return () => unsubscribe();
  }, [club?.id]);

  const handleSaveClubName = async () => {
    if (!club || !newClubName.trim()) return;
    setIsSavingName(true);
    try {
      await updateClubName(club.id, newClubName.trim());
      setClub(prev => prev ? { ...prev, naam: newClubName.trim() } : null);
      setIsEditingName(false);
      showToast("Clubnaam succesvol bijgewerkt!");
    } catch (err) {
      console.error("Fout bij opslaan clubnaam:", err);
      showToast("Er is een fout opgetreden bij het opslaan van de clubnaam.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCreateInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !club) return;

    if (!inviteName.trim()) {
      setInviteError("Vul een naam in.");
      return;
    }
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError("Vul een geldig e-mailadres in.");
      return;
    }

    setInviteError(null);
    setIsSubmittingInvite(true);

    try {
      await createInvite(
        currentUserId,
        club.id,
        inviteEmail.trim(),
        inviteName.trim(),
        inviteRole
      );

      showToast(`Uitnodiging aangemaakt voor ${inviteName.trim()} (${inviteEmail.trim()})!`);
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('coach');
    } catch (err) {
      console.error("Fout bij aanmaken uitnodiging:", err);
      setInviteError(err instanceof Error ? err.message : "Er is een fout opgetreden bij het aanmaken van de uitnodiging.");
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleConfirmCancelInvite = async () => {
    if (!inviteToCancel || !currentUserId || !club) return;
    setIsCancellingInvite(true);

    try {
      await cancelInvite(currentUserId, club.id, inviteToCancel.id, inviteToCancel);
      showToast(`Uitnodiging voor ${inviteToCancel.displayName} is geannuleerd.`);
      setInviteToCancel(null);
    } catch (err) {
      console.error("Fout bij annuleren van uitnodiging:", err);
      showToast("Kon de uitnodiging niet annuleren. Probeer het opnieuw.");
    } finally {
      setIsCancellingInvite(false);
    }
  };

  const getRoleBadge = (role: ClubMemberRole | InviteRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <Crown size={12} />
            <span>Admin</span>
          </span>
        );
      case 'coach':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
            <Shield size={12} />
            <span>Coach</span>
          </span>
        );
      case 'assistant':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25">
            <User size={12} />
            <span>Assistent-coach</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-text-muted border border-white/10">
            <span>{role}</span>
          </span>
        );
    }
  };

  const getInviteStatusBadge = (status: ClubInvite['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <Clock size={12} className="animate-pulse" />
            <span>Openstaand</span>
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 size={12} />
            <span>Geaccepteerd</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <Ban size={12} />
            <span>Geannuleerd</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <RefreshCw size={32} className="text-primary animate-spin" />
        <p className="text-sm text-text-muted font-bold uppercase tracking-wider">Club Workspace laden...</p>
      </div>
    );
  }

  const pendingInvitesCount = invites.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Melding */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[150] bg-surface border border-primary/40 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Sparkles size={16} />
            </div>
            <span className="text-sm font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20">
                <Building2 size={24} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                  Club Workspace
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={newClubName}
                      onChange={(e) => setNewClubName(e.target.value)}
                      className="bg-dark border border-primary/50 text-white font-display font-black italic text-xl sm:text-2xl px-3 py-1 rounded-xl focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveClubName}
                      disabled={isSavingName}
                      className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all cursor-pointer"
                      title="Opslaan"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false);
                        if (club) setNewClubName(club.naam);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                      title="Annuleren"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mt-1">
                    <h1 className="text-2xl sm:text-3xl font-display font-black italic uppercase tracking-tight text-white">
                      {club?.naam || 'Mijn Club Workspace'}
                    </h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Clubnaam bewerken"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted max-w-2xl">
              Beheer je clubomgeving, coaches, uitnodigingen en teamrollen binnen Basketball Coach GameStats.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setInviteError(null);
                setShowInviteModal(true);
              }}
              className="px-5 py-3.5 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-primary/25 active:scale-95 cursor-pointer"
            >
              <UserPlus size={18} />
              <span>Lid Uitnodigen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistieken Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider">Aantal Leden</span>
            <Users size={18} className="text-primary" />
          </div>
          <div className="text-3xl font-mono font-black text-white">
            {members.length} {members.length === 1 ? 'lid' : 'leden'}
          </div>
          <div className="text-[11px] text-text-muted">
            {members.filter(m => m.status === 'active').length} actief in club
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider">Open Uitnodigingen</span>
            <Send size={18} className="text-amber-400" />
          </div>
          <div className="text-3xl font-mono font-black text-white">
            {pendingInvitesCount} {pendingInvitesCount === 1 ? 'uitnodiging' : 'uitnodigingen'}
          </div>
          <div className="text-[11px] text-text-muted">
            Wachten op accordering
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider">Club Teams</span>
            <Shield size={18} className="text-cyan-400" />
          </div>
          <div className="text-3xl font-mono font-black text-white">
            {clubTeams.length} {clubTeams.length === 1 ? 'team' : 'teams'}
          </div>
          <div className="text-[11px] text-text-muted">
            Gedeeld binnen club workspace
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider">Lidmaatschap</span>
            <Crown size={18} className="text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white uppercase tracking-tight">
            Club Premium
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>Onbeperkt teams & clubbeheer</span>
          </div>
        </div>
      </div>

      {/* Navigatie Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1">
        <button
          onClick={() => setActiveTab('leden')}
          className={`px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'leden'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Users2 size={18} />
          <span>Leden</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
            activeTab === 'leden' ? 'bg-white/20 text-white' : 'bg-white/10 text-text-muted'
          }`}>
            {members.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('uitnodigingen')}
          className={`px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'uitnodigingen'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Send size={18} />
          <span>Uitnodigingen</span>
          {pendingInvitesCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500 text-dark">
              {pendingInvitesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('instellingen')}
          className={`px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'instellingen'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings size={18} />
          <span>Instellingen</span>
        </button>
      </div>

      {/* TAB 1: LEDEN */}
      {activeTab === 'leden' && (
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xl font-display font-black italic uppercase tracking-tight text-white flex items-center gap-2">
                <Users2 className="text-primary" size={20} />
                <span>Ledenlijst</span>
              </h2>
              <p className="text-xs text-text-muted">
                Overzicht van alle actieve coaches en beheerders binnen de club workspace.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-text-muted bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
              Totaal: {members.length} {members.length === 1 ? 'Lid' : 'Leden'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase font-bold text-text-muted tracking-wider">
                  <th className="py-3 px-4">Lid / Coach</th>
                  <th className="py-3 px-4">E-mailadres</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Lid Sinds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-semibold text-white flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center border border-primary/20 shrink-0">
                        {(member.userName || member.userEmail || 'C')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white">
                          {member.userName || 'Coach'}
                        </div>
                        {member.userUid === currentUserId && (
                          <span className="text-[10px] text-primary font-bold uppercase tracking-wider">(Jij)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-text-muted font-mono text-xs">
                      {member.userEmail || member.userUid}
                    </td>
                    <td className="py-4 px-4">
                      {getRoleBadge(member.role)}
                    </td>
                    <td className="py-4 px-4">
                      {member.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Actief</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          <Clock size={12} />
                          <span>In behandeling</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-text-muted font-mono text-xs">
                      {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                  </tr>
                ))}

                {members.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-text-muted">
                      <Users className="mx-auto mb-3 opacity-20" size={40} />
                      <p className="text-sm font-semibold">Nog geen leden aanwezig in deze club.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UITNODIGINGEN */}
      {activeTab === 'uitnodigingen' && (
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xl font-display font-black italic uppercase tracking-tight text-white flex items-center gap-2">
                <Send className="text-primary" size={20} />
                <span>Club Uitnodigingen</span>
              </h2>
              <p className="text-xs text-text-muted">
                Overzicht van alle aangemaakte uitnodigingen voor deze Club Workspace.
              </p>
            </div>
            
            <button
              onClick={() => {
                setInviteError(null);
                setShowInviteModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-primary/20 cursor-pointer self-start sm:self-auto"
            >
              <UserPlus size={16} />
              <span>Nieuwe Uitnodiging</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase font-bold text-text-muted tracking-wider">
                  <th className="py-3 px-4">Naam</th>
                  <th className="py-3 px-4">E-mailadres</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Aanmaakdatum</th>
                  <th className="py-3 px-4 text-right">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">
                      {invite.displayName}
                    </td>
                    <td className="py-4 px-4 text-text-muted font-mono text-xs">
                      {invite.email}
                    </td>
                    <td className="py-4 px-4">
                      {getRoleBadge(invite.role)}
                    </td>
                    <td className="py-4 px-4">
                      {getInviteStatusBadge(invite.status)}
                    </td>
                    <td className="py-4 px-4 text-text-muted font-mono text-xs">
                      {new Date(invite.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {invite.status === 'pending' && (
                        <button
                          onClick={() => setInviteToCancel(invite)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Ban size={14} />
                          <span>Annuleren</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {invites.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      <Send className="mx-auto mb-3 opacity-20" size={40} />
                      <p className="text-sm font-semibold">Nog geen uitnodigingen aangemaakt.</p>
                      <p className="text-xs text-text-muted mt-1">Klik op "Nieuwe Uitnodiging" om een coach of assistent uit te nodigen.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INSTELLINGEN */}
      {activeTab === 'instellingen' && (
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-xl font-display font-black italic uppercase tracking-tight text-white flex items-center gap-2">
              <Settings className="text-primary" size={20} />
              <span>Workspace Instellingen</span>
            </h2>
            <p className="text-xs text-text-muted">
              Beheer de basisgegevens en configuratie van je Club Workspace.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* Clubnaam bewerken */}
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
              <label className="block text-xs uppercase font-bold text-text-muted">Clubnaam</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  className="bg-dark border border-white/10 focus:border-primary text-white rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none"
                />
                <button
                  onClick={handleSaveClubName}
                  disabled={isSavingName}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer"
                >
                  {isSavingName ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>

            {/* Details overzicht */}
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Workspace Details</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-text-muted block">Club Workspace ID:</span>
                  <span className="font-mono text-white font-semibold">{club?.id}</span>
                </div>

                <div>
                  <span className="text-text-muted block">Eigenaar UID:</span>
                  <span className="font-mono text-white font-semibold">{club?.ownerUid}</span>
                </div>

                <div>
                  <span className="text-text-muted block">Aangemaakt Op:</span>
                  <span className="font-mono text-white font-semibold">
                    {club?.createdAt ? new Date(club.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </span>
                </div>

                <div>
                  <span className="text-text-muted block">Lidmaatschap Type:</span>
                  <span className="font-bold text-amber-400 uppercase">Club Workspace</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Architectuur & Informatie Banner */}
      <div className="bg-gradient-to-r from-surface to-dark p-6 sm:p-8 rounded-3xl border border-white/10 shadow-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Info size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display uppercase tracking-tight">
              Club Workspace Uitnodigingssysteem
            </h3>
            <p className="text-xs text-text-muted">
              Volledig in-app uitnodigingssysteem via Firestore met automatische auditlogs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Send size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">In-App Uitnodigingen</span>
              <span className="text-text-muted leading-relaxed">Sla uitnodigingen direct op in Firestore in de collectie <code className="text-primary">club_invites</code> met 30 dagen geldigheid.</span>
            </div>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Shield size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Automatische Auditlogs</span>
              <span className="text-text-muted leading-relaxed">Elke aanmaak of annulering wordt vastgelegd in <code className="text-cyan-400">audit_logs</code> met actie, beheerder en waarden.</span>
            </div>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Realtime Synchronisatie</span>
              <span className="text-text-muted leading-relaxed">Wijzigingen in uitnodigingen worden direct realtime bijgewerkt via Firestore snapshot listeners.</span>
            </div>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Crown size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Voorbereid op Registratie</span>
              <span className="text-text-muted leading-relaxed">Gegevensstructuur is klaar voor automatische koppeling zodra een coach zich registreert.</span>
            </div>
          </div>
        </div>
      </div>

      {/* DIALOG MODAL: Lid Uitnodigen */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative overflow-hidden"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display italic uppercase tracking-tighter text-white">
                      Lid Uitnodigen
                    </h3>
                    <span className="text-[11px] text-text-muted">Club Workspace Uitnodiging</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-text-muted hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {inviteError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              <form onSubmit={handleCreateInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-text-muted mb-2">
                    Naam van genodigde *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="bijv. Jan de Vries"
                    className="w-full bg-dark border border-white/10 focus:border-primary text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold text-text-muted mb-2">
                    E-mailadres van genodigde *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="coach@basketballclub.nl"
                    className="w-full bg-dark border border-white/10 focus:border-primary text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold text-text-muted mb-2">
                    Rol toewijzen *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInviteRole('coach')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        inviteRole === 'coach'
                          ? 'bg-primary/15 border-primary text-white'
                          : 'bg-dark/50 border-white/10 text-text-muted hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm text-cyan-400 mb-1">
                        <Shield size={16} />
                        <span>Coach</span>
                      </div>
                      <span className="text-[11px] text-text-muted leading-tight block">
                        Wedstrijdbeheer en teamcoaching
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInviteRole('assistant')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        inviteRole === 'assistant'
                          ? 'bg-primary/15 border-primary text-white'
                          : 'bg-dark/50 border-white/10 text-text-muted hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm text-purple-400 mb-1">
                        <User size={16} />
                        <span>Assistent-coach</span>
                      </div>
                      <span className="text-[11px] text-text-muted leading-tight block">
                        Ondersteunend bij wedstrijden en stats
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInvite}
                    className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-primary/25 cursor-pointer"
                  >
                    {isSubmittingInvite ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Aanmaken...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Uitnodiging Aanmaken</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG MODAL: Bevestig Annuleren Uitnodiging */}
      <AnimatePresence>
        {inviteToCancel && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                  <Ban size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display italic uppercase tracking-tighter text-white">
                    Uitnodiging Annuleren
                  </h3>
                  <span className="text-[11px] text-text-muted">Bevestiging vereist</span>
                </div>
              </div>

              <p className="text-sm text-text-muted leading-relaxed">
                Weet je zeker dat je de uitnodiging voor <strong className="text-white">{inviteToCancel.displayName}</strong> (<span className="text-primary font-mono">{inviteToCancel.email}</span>) wilt annuleren?
              </p>

              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 text-xs text-text-muted space-y-1">
                <div>• De status van de uitnodiging wordt gewijzigd naar <span className="text-rose-400 font-bold">Geannuleerd</span>.</div>
                <div>• Het document blijft bewaard voor de administratie.</div>
                <div>• Er wordt direct een auditlog vastgelegd.</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteToCancel(null)}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Nee, Behouden
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelInvite}
                  disabled={isCancellingInvite}
                  className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-rose-500/25 cursor-pointer"
                >
                  {isCancellingInvite ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verwerken...</span>
                    </>
                  ) : (
                    <>
                      <Ban size={14} />
                      <span>Ja, Annuleren</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
