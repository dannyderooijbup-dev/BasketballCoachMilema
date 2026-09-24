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
  AlertCircle,
  MoreVertical,
  UserCheck,
  UserX,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ClubWorkspace, ClubMember, ClubMemberRole, ClubMemberStatus, UserMembership, Team, ClubInvite, InviteRole, Player } from '../types';
import { 
  getClubForUser, 
  getClubMembers, 
  updateClubName, 
  ensureClubWorkspaceForUser,
  getClubTeams,
  getClubMemberRole,
  updateClubMemberRole,
  updateClubMemberStatus,
  removeClubMember,
  getClubPlayers
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

type TabType = 'leden' | 'spelers' | 'uitnodigingen' | 'instellingen';

export default function ClubDashboard({ currentUserId, membership }: ClubDashboardProps) {
  const [club, setClub] = useState<ClubWorkspace | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [clubTeams, setClubTeams] = useState<Team[]>([]);
  const [clubPlayers, setClubPlayers] = useState<Player[]>([]);
  const [teamPlayerMappings, setTeamPlayerMappings] = useState<Array<{ teamId: string; playerId: string }>>([]);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('leden');
  const [ownerDisplay, setOwnerDisplay] = useState<string>('');
  const [userClubRole, setUserClubRole] = useState<ClubMemberRole | null>(null);

  // Member Action Menu & Modals
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  // Role Change Modal
  const [memberForRole, setMemberForRole] = useState<ClubMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<ClubMemberRole>('coach');
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Status Change Modal
  const [memberForStatus, setMemberForStatus] = useState<ClubMember | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ClubMemberStatus>('active');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Remove Member Modal
  const [memberToRemove, setMemberToRemove] = useState<ClubMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

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

        // Ophalen representatieve weergave voor eigenaar
        if (userClub.ownerUid === currentUserId) {
          setOwnerDisplay(auth.currentUser?.email ? `${auth.currentUser.email} (Jij)` : 'Jij (Clubbeheerder)');
        } else if (userClub.ownerUid) {
          try {
            const ownerSnap = await getDoc(doc(db, 'users', userClub.ownerUid));
            if (ownerSnap.exists()) {
              const oData = ownerSnap.data();
              const p = oData.profiel || {};
              setOwnerDisplay(p.email || oData.email || p.naam || 'Clubbeheerder');
            } else {
              setOwnerDisplay('Clubbeheerder');
            }
          } catch {
            setOwnerDisplay('Clubbeheerder');
          }
        }

        const [clubMembersList, teamsList, role, playersList] = await Promise.all([
          getClubMembers(userClub.id),
          getClubTeams(userClub.id),
          getClubMemberRole(userClub.id, currentUserId),
          getClubPlayers(userClub.id)
        ]);
        setMembers(clubMembersList);
        setClubTeams(teamsList);
        setUserClubRole(role);
        setClubPlayers(playersList);

        // Haal teamPlayers mappings op voor de clubteams om te tonen in welke teams spelers zitten
        if (teamsList.length > 0) {
          const tIds = teamsList.map(t => t.id);
          const chunks: string[][] = [];
          for (let i = 0; i < tIds.length; i += 10) {
            chunks.push(tIds.slice(i, i + 10));
          }
          const snaps = await Promise.all(
            chunks.map(c => getDocs(query(collection(db, 'teamPlayers'), where('teamId', 'in', c))))
          );
          const mappings: Array<{ teamId: string; playerId: string }> = [];
          snaps.forEach(snap => {
            snap.forEach(d => {
              const data = d.data();
              if (data.teamId && data.playerId) {
                mappings.push({ teamId: data.teamId, playerId: data.playerId });
              }
            });
          });
          setTeamPlayerMappings(mappings);
        }
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

  const isAdmin = userClubRole === 'admin' || club?.ownerUid === currentUserId;

  const handleSaveClubName = async () => {
    if (!club || !newClubName.trim()) return;
    if (!isAdmin) {
      showToast("Alleen clubbeheerders mogen de clubnaam wijzigen.");
      return;
    }
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
    if (!isAdmin) {
      setInviteError("Alleen clubbeheerders mogen uitnodigingen versturen.");
      return;
    }

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
    if (!isAdmin) {
      showToast("Alleen clubbeheerders mogen uitnodigingen annuleren.");
      return;
    }
    setIsCancellingInvite(true);

    try {
      await cancelInvite(currentUserId, club.id, inviteToCancel.id, inviteToCancel);
      showToast(`Uitnodiging voor ${inviteToCancel.displayName} is ingetrokken.`);
      setInviteToCancel(null);
    } catch (err) {
      console.error("Fout bij annuleren van uitnodiging:", err);
      showToast("Kon de uitnodiging niet annuleren. Probeer het opnieuw.");
    } finally {
      setIsCancellingInvite(false);
    }
  };

  const handleSaveRoleChange = async () => {
    if (!club || !memberForRole || !currentUserId) return;
    setIsSavingRole(true);
    try {
      await updateClubMemberRole(club.id, memberForRole.userUid, selectedRole, currentUserId);
      setMembers(prev => prev.map(m => m.userUid === memberForRole.userUid ? { ...m, role: selectedRole } : m));
      showToast(`Rol van ${memberForRole.userName || 'lid'} gewijzigd naar ${selectedRole === 'coach' ? 'Coach' : 'Assistent'}.`);
      setMemberForRole(null);
    } catch (err) {
      console.error("Fout bij wijzigen rol:", err);
      showToast(err instanceof Error ? err.message : "Fout bij wijzigen rol.");
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleSaveStatusChange = async () => {
    if (!club || !memberForStatus || !currentUserId) return;
    setIsSavingStatus(true);
    try {
      await updateClubMemberStatus(club.id, memberForStatus.userUid, selectedStatus, currentUserId);
      setMembers(prev => prev.map(m => m.userUid === memberForStatus.userUid ? { ...m, status: selectedStatus } : m));
      showToast(`Status van ${memberForStatus.userName || 'lid'} gewijzigd naar ${selectedStatus === 'active' ? 'Actief' : 'In behandeling'}.`);
      setMemberForStatus(null);
    } catch (err) {
      console.error("Fout bij wijzigen status:", err);
      showToast(err instanceof Error ? err.message : "Fout bij wijzigen status.");
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!club || !memberToRemove || !currentUserId) return;
    setIsRemovingMember(true);
    try {
      await removeClubMember(club.id, memberToRemove.userUid, currentUserId);
      setMembers(prev => prev.filter(m => m.userUid !== memberToRemove.userUid));
      showToast(`${memberToRemove.userName || 'Lid'} is verwijderd uit de Club Workspace.`);
      setMemberToRemove(null);
    } catch (err) {
      console.error("Fout bij verwijderen lid:", err);
      showToast(err instanceof Error ? err.message : "Fout bij verwijderen lid.");
    } finally {
      setIsRemovingMember(false);
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
                    {isAdmin && (
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Clubnaam bewerken"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted max-w-2xl">
              Beheer je clubomgeving, coaches, uitnodigingen en teamrollen binnen Basketball Coach GameStats.
            </p>
          </div>

          {isAdmin && (
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
          )}
        </div>
      </div>

      {/* Statistieken Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider truncate">Aantal Leden</span>
            <Users size={18} className="text-primary shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">{members.length}</span>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider truncate">
              {members.length === 1 ? 'lid' : 'leden'}
            </span>
          </div>
          <div className="text-[11px] text-text-muted truncate">
            {members.filter(m => m.status === 'active').length} actief in club
          </div>
        </div>

        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider truncate">Open Uitnodigingen</span>
            <Send size={18} className="text-amber-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">{pendingInvitesCount}</span>
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider truncate">
              {pendingInvitesCount === 1 ? 'uitnodiging' : 'uitnodigingen'}
            </span>
          </div>
          <div className="text-[11px] text-text-muted truncate">
            Wachten op accordering
          </div>
        </div>

        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider truncate">Club Teams</span>
            <Shield size={18} className="text-cyan-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white">{clubTeams.length}</span>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider truncate">
              {clubTeams.length === 1 ? 'team' : 'teams'}
            </span>
          </div>
          <div className="text-[11px] text-text-muted truncate">
            Gedeeld binnen club workspace
          </div>
        </div>

        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider truncate">Lidmaatschap</span>
            <Crown size={18} className="text-amber-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight truncate">
            Club Premium
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 truncate">
            <CheckCircle2 size={12} className="shrink-0" />
            <span className="truncate">Onbeperkt teams & clubbeheer</span>
          </div>
        </div>
      </div>

      {/* Navigatie Tabs (2e menu) */}
      <div className="w-full bg-surface/70 p-1 rounded-2xl border border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-1 sm:flex sm:bg-transparent sm:p-0 sm:border-0 sm:border-b sm:border-white/10 sm:pb-1 sm:rounded-none">
        <button
          onClick={() => setActiveTab('leden')}
          className={`py-2.5 px-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer ${
            activeTab === 'leden'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Users2 size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />
          <span className="truncate">Leden</span>
          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold shrink-0 ${
            activeTab === 'leden' ? 'bg-white/20 text-white' : 'bg-white/10 text-text-muted'
          }`}>
            {members.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('spelers')}
          className={`py-2.5 px-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer ${
            activeTab === 'spelers'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Users size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />
          <span className="truncate">Spelers</span>
          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold shrink-0 ${
            activeTab === 'spelers' ? 'bg-white/20 text-white' : 'bg-white/10 text-text-muted'
          }`}>
            {clubPlayers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('uitnodigingen')}
          className={`py-2.5 px-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer ${
            activeTab === 'uitnodigingen'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Send size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />
          <span className="truncate">Uitnodigingen</span>
          {pendingInvitesCount > 0 && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-amber-500 text-dark shrink-0">
              {pendingInvitesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('instellingen')}
          className={`py-2.5 px-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2.5 transition-all cursor-pointer ${
            activeTab === 'instellingen'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />
          <span className="truncate">Instellingen</span>
        </button>
      </div>

      {/* TAB 1: LEDEN */}
      {activeTab === 'leden' && (
        <div className="bg-surface rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10 shadow-xl space-y-6">
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
                  {isAdmin && <th className="py-3 px-4 text-right">Actie</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-semibold text-white flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center border border-primary/20 shrink-0">
                        {((member.userName || member.userEmail || (member.userUid === currentUserId && auth.currentUser?.email) || 'C')[0] || 'C').toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white">
                          {member.userName || (member.userEmail ? member.userEmail.split('@')[0] : (member.userUid === currentUserId && auth.currentUser?.displayName ? auth.currentUser.displayName : 'Coach'))}
                        </div>
                        {member.userUid === currentUserId && (
                          <span className="text-[10px] text-primary font-bold uppercase tracking-wider">(Jij)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono">
                      {member.userEmail ? (
                        <span className="text-white/85">{member.userEmail}</span>
                      ) : member.userUid === currentUserId && auth.currentUser?.email ? (
                        <span className="text-white/85">{auth.currentUser.email}</span>
                      ) : (
                        <span className="text-text-muted italic font-sans text-[11px]">Geen e-mailadres bekend</span>
                      )}
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
                    {isAdmin && (
                      <td className="py-4 px-4 text-right relative">
                        {member.userUid === club?.ownerUid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Crown size={11} />
                            <span>Eigenaar</span>
                          </span>
                        ) : member.userUid === currentUserId ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            <span>Jij</span>
                          </span>
                        ) : (
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setActiveMenuMemberId(activeMenuMemberId === member.id ? null : member.id)}
                              className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                              title="Beheer lid"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeMenuMemberId === member.id && (
                              <div 
                                className="absolute right-0 mt-2 w-48 bg-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 py-1.5 overflow-hidden text-left"
                                onMouseLeave={() => setActiveMenuMemberId(null)}
                              >
                                <button
                                  onClick={() => {
                                    setActiveMenuMemberId(null);
                                    setMemberForRole(member);
                                    setSelectedRole(member.role);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <Shield size={14} className="text-cyan-400" />
                                  <span>Rol wijzigen</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuMemberId(null);
                                    setMemberForStatus(member);
                                    setSelectedStatus(member.status);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <Clock size={14} className="text-amber-400" />
                                  <span>Status wijzigen</span>
                                </button>

                                <div className="my-1 border-t border-white/5" />

                                <button
                                  onClick={() => {
                                    setActiveMenuMemberId(null);
                                    setMemberToRemove(member);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} className="text-rose-400" />
                                  <span>Lid verwijderen</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}

                {members.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-text-muted">
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

      {/* TAB: SPELERS */}
      {activeTab === 'spelers' && (
        <div className="bg-surface rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xl font-display font-black italic uppercase tracking-tight text-white flex items-center gap-2">
                <Users className="text-primary" size={20} />
                <span>Club Spelers</span>
              </h2>
              <p className="text-xs text-text-muted">
                Overzicht van alle spelers die via Club Teams aan deze Club Workspace zijn gekoppeld.
              </p>
            </div>
            
            <div className="text-xs font-mono font-bold text-text-muted bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
              Totaal: {clubPlayers.length} {clubPlayers.length === 1 ? 'Speler' : 'Spelers'}
            </div>
          </div>

          {/* Informatieve toelichting over automatische koppeling */}
          <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 p-4 rounded-2xl text-xs flex items-center gap-3">
            <Sparkles size={18} className="shrink-0 text-cyan-400" />
            <span className="leading-relaxed">
              Spelers worden automatisch toegevoegd wanneer ze aan een Club Team zijn gekoppeld.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase font-bold text-text-muted tracking-wider">
                  <th className="py-3 px-4">Speler</th>
                  <th className="py-3 px-4">Rugnummer</th>
                  <th className="py-3 px-4">Positie</th>
                  <th className="py-3 px-4">Gekoppelde Club Teams</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clubPlayers.map((player) => {
                  const playerClubTeams = clubTeams.filter(t => 
                    teamPlayerMappings.some(tp => tp.teamId === t.id && tp.playerId === player.id)
                  );

                  return (
                    <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 font-semibold text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                          {player.number ? `#${player.number}` : (player.name ? player.name[0].toUpperCase() : 'S')}
                        </div>
                        <span>{player.name}</span>
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-white/90">
                        #{player.number}
                      </td>
                      <td className="py-4 px-4 text-xs text-text-muted uppercase font-bold">
                        {player.position || 'Speler'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {playerClubTeams.map(t => (
                            <span key={t.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Shield size={10} />
                              <span>{t.name}</span>
                            </span>
                          ))}
                          {playerClubTeams.length === 0 && (
                            <span className="text-[11px] text-text-muted italic">
                              Clubspeler
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {clubPlayers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-text-muted">
                      <Users className="mx-auto mb-3 opacity-20" size={40} />
                      <p className="text-sm font-semibold">Nog geen spelers aanwezig in deze club.</p>
                      <p className="text-xs text-text-muted mt-1">
                        Koppel spelers aan een Club Team om ze automatisch in de Club Workspace te zien.
                      </p>
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
        <div className="bg-surface rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10 shadow-xl space-y-6">
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
            
            {isAdmin && (
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
            )}
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
                  {isAdmin && <th className="py-3 px-4 text-right">Actie</th>}
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
                    {isAdmin && (
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
                    )}
                  </tr>
                ))}

                {invites.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-text-muted">
                      <Send className="mx-auto mb-3 opacity-20" size={40} />
                      <p className="text-sm font-semibold">Nog geen uitnodigingen aangemaakt.</p>
                      {isAdmin && (
                        <p className="text-xs text-text-muted mt-1">Klik op "Nieuwe Uitnodiging" om een coach of assistent uit te nodigen.</p>
                      )}
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
        <div className="bg-surface rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10 shadow-xl space-y-6">
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
              {isAdmin ? (
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
              ) : (
                <div className="text-white font-bold text-lg">
                  {club?.naam}
                </div>
              )}
            </div>

            {/* Details overzicht */}
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Workspace Details</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-text-muted block">Eigenaar:</span>
                  <span className="text-white font-semibold">{ownerDisplay || 'Clubbeheerder'}</span>
                </div>

                <div>
                  <span className="text-text-muted block">Geregistreerde Teams:</span>
                  <span className="text-white font-semibold">{clubTeams.length} {clubTeams.length === 1 ? 'team' : 'teams'}</span>
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
                Weet je zeker dat je de uitnodiging voor <strong className="text-white">{inviteToCancel.displayName}</strong> (<span className="text-primary font-mono">{inviteToCancel.email}</span>) wilt intrekken?
              </p>

              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 text-xs text-text-muted">
                De uitnodiging wordt geannuleerd. De genodigde kan met deze uitnodiging niet meer toetreden tot de Club Workspace.
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
                      <span>Ja, Intrekken</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG MODAL: Rol Wijzigen */}
      <AnimatePresence>
        {memberForRole && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display italic uppercase tracking-tighter text-white">
                      Rol Wijzigen
                    </h3>
                    <span className="text-[11px] text-text-muted">{memberForRole.userName || memberForRole.userEmail}</span>
                  </div>
                </div>
                <button
                  onClick={() => setMemberForRole(null)}
                  className="text-text-muted hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <span className="text-text-muted">Huidige rol:</span>
                <span className="font-bold text-white capitalize">{memberForRole.role}</span>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-text-muted mb-2">
                  Nieuwe rol selecteren
                </label>
                <div className="space-y-2">
                  <label 
                    onClick={() => setSelectedRole('coach')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedRole === 'coach'
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                        : 'bg-dark/50 border-white/10 text-text-muted hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield size={16} className="text-cyan-400" />
                      <div>
                        <div className="font-bold text-sm text-white">Coach</div>
                        <div className="text-[11px] text-text-muted">Volledig wedstrijd- en teamgebruik binnen club</div>
                      </div>
                    </div>
                    <input 
                      type="radio" 
                      name="roleChoice" 
                      checked={selectedRole === 'coach'} 
                      onChange={() => setSelectedRole('coach')}
                      className="accent-primary"
                    />
                  </label>

                  <label 
                    onClick={() => setSelectedRole('assistant')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedRole === 'assistant'
                        ? 'bg-purple-500/15 border-purple-500/40 text-white'
                        : 'bg-dark/50 border-white/10 text-text-muted hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <User size={16} className="text-purple-400" />
                      <div>
                        <div className="font-bold text-sm text-white">Assistent-coach</div>
                        <div className="text-[11px] text-text-muted">Ondersteunend bij wedstrijden en statistieken</div>
                      </div>
                    </div>
                    <input 
                      type="radio" 
                      name="roleChoice" 
                      checked={selectedRole === 'assistant'} 
                      onChange={() => setSelectedRole('assistant')}
                      className="accent-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setMemberForRole(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoleChange}
                  disabled={isSavingRole}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-primary/25 cursor-pointer"
                >
                  {isSavingRole ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Opslaan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Opslaan</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG MODAL: Status Wijzigen */}
      <AnimatePresence>
        {memberForStatus && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display italic uppercase tracking-tighter text-white">
                      Status Wijzigen
                    </h3>
                    <span className="text-[11px] text-text-muted">{memberForStatus.userName || memberForStatus.userEmail}</span>
                  </div>
                </div>
                <button
                  onClick={() => setMemberForStatus(null)}
                  className="text-text-muted hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <span className="text-text-muted">Huidige status:</span>
                <span className="font-bold text-white">
                  {memberForStatus.status === 'active' ? 'Actief' : 'In behandeling'}
                </span>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-text-muted mb-2">
                  Nieuwe status selecteren
                </label>
                <div className="space-y-2">
                  <label 
                    onClick={() => setSelectedStatus('active')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedStatus === 'active'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                        : 'bg-dark/50 border-white/10 text-text-muted hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <div>
                        <div className="font-bold text-sm text-white">Actief</div>
                        <div className="text-[11px] text-text-muted">Directe actieve toegang tot de Club Workspace</div>
                      </div>
                    </div>
                    <input 
                      type="radio" 
                      name="statusChoice" 
                      checked={selectedStatus === 'active'} 
                      onChange={() => setSelectedStatus('active')}
                      className="accent-primary"
                    />
                  </label>

                  <label 
                    onClick={() => setSelectedStatus('pending')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedStatus === 'pending'
                        ? 'bg-amber-500/15 border-amber-500/40 text-white'
                        : 'bg-dark/50 border-white/10 text-text-muted hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock size={16} className="text-amber-400" />
                      <div>
                        <div className="font-bold text-sm text-white">In behandeling</div>
                        <div className="text-[11px] text-text-muted">Toegang tijdelijk gepauzeerd</div>
                      </div>
                    </div>
                    <input 
                      type="radio" 
                      name="statusChoice" 
                      checked={selectedStatus === 'pending'} 
                      onChange={() => setSelectedStatus('pending')}
                      className="accent-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setMemberForStatus(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatusChange}
                  disabled={isSavingStatus}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-primary/25 cursor-pointer"
                >
                  {isSavingStatus ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Opslaan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Opslaan</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG MODAL: Lid Verwijderen Bevestiging */}
      <AnimatePresence>
        {memberToRemove && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display italic uppercase tracking-tighter text-white">
                    Lid Verwijderen
                  </h3>
                  <span className="text-[11px] text-text-muted">Bevestiging vereist</span>
                </div>
              </div>

              <p className="text-sm text-text-muted leading-relaxed">
                Wil je <strong className="text-white">{memberToRemove.userName || memberToRemove.userEmail}</strong> echt uit deze Club Workspace verwijderen?
              </p>

              <div className="bg-rose-500/10 p-3.5 rounded-2xl border border-rose-500/20 text-xs text-rose-300 leading-relaxed">
                Het account zelf wordt niet verwijderd. Alleen de toegang tot deze Club Workspace wordt verwijderd.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberToRemove(null)}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveMember}
                  disabled={isRemovingMember}
                  className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-rose-500/25 cursor-pointer"
                >
                  {isRemovingMember ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verwijderen...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Lid Verwijderen</span>
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
