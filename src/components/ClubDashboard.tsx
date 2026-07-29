import { useState, useEffect } from 'react';
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
  Users2
} from 'lucide-react';
import { ClubWorkspace, ClubMember, ClubMemberRole, UserMembership, Team } from '../types';
import { 
  getClubForUser, 
  getClubMembers, 
  updateClubName, 
  ensureClubWorkspaceForUser,
  getClubTeams
} from '../services/clubService';

interface ClubDashboardProps {
  currentUserId?: string;
  membership?: UserMembership | null;
}

export default function ClubDashboard({ currentUserId, membership }: ClubDashboardProps) {
  const [club, setClub] = useState<ClubWorkspace | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [clubTeams, setClubTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  
  // Toast & Modal state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

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
      // 1. Zorg dat de workspace gegarandeerd is voor deze gebruiker
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

  const getRoleBadge = (role: ClubMemberRole) => {
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
            <span>Assistent</span>
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <RefreshCw size={32} className="text-primary animate-spin" />
        <p className="text-sm text-text-muted font-bold uppercase tracking-wider">Club Workspace laden...</p>
      </div>
    );
  }

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
              Beheer je clubomgeving, coaches, teamrollen en samenwerking binnen Basketball Coach GameStats.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Action button Lid Uitnodigen (Placeholder) */}
            <button
              onClick={() => setShowInviteModal(true)}
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
            {members.filter(m => m.status === 'active').length} actief
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider">Aantal Club Teams</span>
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
            <span className="text-xs uppercase font-bold tracking-wider">Lidmaatschap Type</span>
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

        <div className="bg-surface p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs uppercase font-bold tracking-wider">Aangemaakt Op</span>
            <Clock size={18} className="text-cyan-400" />
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {club?.createdAt ? new Date(club.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Onbekend'}
          </div>
          <div className="text-[11px] text-text-muted">
            Eigenaar: {members.find(m => m.role === 'admin')?.userName || 'Beheerder'}
          </div>
        </div>
      </div>

      {/* Ledenlijst Module */}
      <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-display font-black italic uppercase tracking-tight text-white flex items-center gap-2">
              <Users2 className="text-primary" size={20} />
              <span>Ledenlijst</span>
            </h2>
            <p className="text-xs text-text-muted">
              Overzicht van alle coaches en beheerders binnen de club workspace.
            </p>
          </div>
          <div className="text-xs font-mono font-bold text-text-muted bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
            Totaal: {members.length} {members.length === 1 ? 'Lid' : 'Leden'}
          </div>
        </div>

        {/* Leden Tabel */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase font-bold text-text-muted tracking-wider">
                <th className="py-3 px-4">Lid / Coach</th>
                <th className="py-3 px-4">E-mailadres</th>
                <th className="py-3 px-4">Rol per Lid</th>
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

      {/* Architectuur & Toekomstige Uitbreidingen Info */}
      <div className="bg-gradient-to-r from-surface to-dark p-6 sm:p-8 rounded-3xl border border-white/10 shadow-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Info size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display uppercase tracking-tight">
              Club Workspace Architectuur
            </h3>
            <p className="text-xs text-text-muted">
              Fundamentele fase geactiveerd. Modulair voorbereid op de volgende uitbreidingen:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Mail size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">E-mailuitnodigingen</span>
              <span className="text-text-muted leading-relaxed">Direct nieuwe coaches of assistenten per e-mail uitnodigen voor je club.</span>
            </div>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Shield size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Gedeelde Teams</span>
              <span className="text-text-muted leading-relaxed">Teams koppelen aan de club zodat meerdere coaches samen de wedstrijdstatistieken bijhouden.</span>
            </div>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Crown size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Rolbeheer</span>
              <span className="text-text-muted leading-relaxed">Geavanceerde rechten per speler en team toewijzen (Admin, Coach, Assistent).</span>
            </div>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5">
            <Building2 size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Meerdere Clubs per Gebruiker</span>
              <span className="text-text-muted leading-relaxed">Schakelen tussen verschillende clubomgevingen vanuit één account.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Lid Uitnodigen (Placeholder) */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 relative"
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

              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-primary">
                  <Sparkles size={16} />
                  <span>Nieuwe Functionaliteit Binnenkort Bestchikbaar</span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  De basisarchitectuur voor de Club Workspace is succesvol geïnstalleerd. In een volgende update kun je hier direct coaches en assistenten via hun e-mailadres uitnodigen om samen te werken.
                </p>
              </div>

              <div className="space-y-4 opacity-50 pointer-events-none">
                <div>
                  <label className="block text-xs uppercase font-bold text-text-muted mb-2">E-mailadres van coach</label>
                  <input
                    type="email"
                    disabled
                    placeholder="coach@basketballclub.nl"
                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-text-muted mb-2">Toewijzen Rol</label>
                  <select disabled className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm">
                    <option>Coach</option>
                    <option>Assistent</option>
                    <option>Admin</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    showToast("Uitnodigingsfunctionaliteit wordt geactiveerd in de volgende fase!");
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-primary/20 cursor-pointer"
                >
                  Begrepen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
