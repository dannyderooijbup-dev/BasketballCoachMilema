import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crown, 
  ShieldCheck, 
  Clock, 
  Users, 
  Calendar, 
  ArrowUpRight, 
  AlertCircle, 
  Sparkles, 
  Mail, 
  CheckCircle2, 
  Info,
  ShieldAlert
} from 'lucide-react';
import { UserMembership } from '../types';
import { 
  getPermissions, 
  getMaxTeams, 
  isTrialExpired, 
  calculateTrialDetails 
} from '../services/permissionsService';

interface MembershipWidgetProps {
  membership: UserMembership | null;
  currentTeamCount?: number;
  onUpgradeClick?: () => void;
}

export const MembershipWidget: React.FC<MembershipWidgetProps> = ({
  membership,
  currentTeamCount = 0,
  onUpgradeClick,
}) => {
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSuccessMsg, setContactSuccessMsg] = useState(false);

  const permissions = getPermissions(membership);
  const maxTeams = getMaxTeams(membership);
  const trialDetails = calculateTrialDetails(membership);
  const isExpired = isTrialExpired(membership);

  const type = membership?.type?.toLowerCase() || 'pending';
  const status = membership?.status || 'pending';

  // Helper to format timestamps
  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return 'N.v.t.';
    return new Date(timestamp).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleContactClick = () => {
    setShowContactModal(true);
  };

  const handleSendContact = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSuccessMsg(true);
    setTimeout(() => {
      setContactSuccessMsg(false);
      setShowContactModal(false);
    }, 2500);
  };

  // Color mappings for trial status
  const trialColorStyles = {
    green: {
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
    orange: {
      bar: 'bg-amber-500',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    red: {
      bar: 'bg-rose-500',
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    },
    expired: {
      bar: 'bg-red-600',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    },
  };

  const currentColorStyle = trialColorStyles[trialDetails.statusColor] || trialColorStyles.green;

  // Render 1: TRIAL EXPIRED
  if (type === 'trial' && isExpired) {
    return (
      <>
        <div className="bg-surface/55 border border-red-500/30 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white space-y-6">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center flex-shrink-0 shadow-lg">
                <AlertCircle size={24} />
              </div>
              <div>
                <span className="inline-block text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 mb-1">
                  Verlopen
                </span>
                <h3 className="text-lg sm:text-xl font-display font-black italic uppercase tracking-tight text-white">
                  Proefperiode Verlopen
                </h3>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-text-muted leading-relaxed bg-dark/40 border border-white/5 p-4 rounded-2xl">
            Je proefperiode van 14 dagen is helaas afgelopen. Om verder te werken met je teams, spelers en wedstrijden raden wij aan om contact op te nemen voor een Coach- of Club-lidmaatschap.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleContactClick}
              className="w-full sm:w-auto flex-1 bg-red-500 hover:bg-red-400 text-slate-950 font-black text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
            >
              <Mail size={16} />
              <span>Contact Opnemen</span>
            </button>
            {onUpgradeClick && (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Crown size={16} className="text-amber-400" />
                <span>Bekijk Opties</span>
              </button>
            )}
          </div>
        </div>

        {/* Contact Modal */}
        {renderContactModal()}
      </>
    );
  }

  // Render 2: ACTIVE TRIAL
  if (type === 'trial' && !isExpired) {
    return (
      <>
        <div className="bg-surface/55 border border-amber-500/25 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white space-y-6">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/10">
                <Clock size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${currentColorStyle.badge}`}>
                    Proefperiode
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Actief
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-display font-black italic uppercase tracking-tight text-white mt-0.5">
                  14 Dagen Proefperiode
                </h3>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className={`text-xl sm:text-2xl font-display font-black italic ${currentColorStyle.text}`}>
                {trialDetails.remainingDays === 0 ? 'Laatste dag' : `Nog ${trialDetails.remainingDays} ${trialDetails.remainingDays === 1 ? 'dag' : 'dagen'}`}
              </span>
              <p className="text-[10px] text-text-muted">
                Verloopt op {trialDetails.expiryDateFormatted}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-text-muted">
              <span>Voortgang Proefperiode</span>
              <span className={currentColorStyle.text}>
                {trialDetails.usedDays} van {trialDetails.totalDays} dagen gebruikt
              </span>
            </div>
            <div className="w-full h-3 bg-dark/80 rounded-full overflow-hidden p-0.5 border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${trialDetails.remainingPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full transition-all ${currentColorStyle.bar}`}
              />
            </div>
          </div>

          {/* Usage Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-dark/40 border border-white/5 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users size={18} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Teams In Gebruik</div>
                <div className="text-sm font-bold text-white">
                  {currentTeamCount} van {maxTeams} teams
                </div>
              </div>
            </div>

            <div className="bg-dark/40 border border-white/5 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Calendar size={18} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Einddatum Proefperiode</div>
                <div className="text-sm font-bold text-white">
                  {trialDetails.expiryDateFormatted}
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade Trigger */}
          {onUpgradeClick && (
            <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-text-muted">
                Wil je onbeperkt teams beheren? Upgrade naar Club.
              </div>
              <button
                type="button"
                onClick={onUpgradeClick}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Crown size={15} />
                <span>Upgrade naar Club</span>
              </button>
            </div>
          )}
        </div>

        {renderContactModal()}
      </>
    );
  }

  // Render 3: COACH MEMBERSHIP
  if (type === 'coach') {
    return (
      <div className="bg-surface/55 border border-primary/25 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white space-y-6">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/10">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  Coach Licentie
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Actief
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-display font-black italic uppercase tracking-tight text-white mt-0.5">
                Coach Lidmaatschap
              </h3>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-dark/40 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Teams Gebruikt</div>
              <div className="text-base font-bold text-white">
                {currentTeamCount} van {maxTeams} teams
              </div>
            </div>
          </div>

          <div className="bg-dark/40 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Calendar size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Lid Sinds</div>
              <div className="text-base font-bold text-white">
                {formatDate(membership?.approvedAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade Call-to-action */}
        {onUpgradeClick && (
          <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-text-muted">
              Nodig voor meer dan 3 teams? Stap over naar een Club-licentie.
            </div>
            <button
              type="button"
              onClick={onUpgradeClick}
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-amber-400 border border-amber-500/30 font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Crown size={15} />
              <span>Upgrade naar Club</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Render 4: CLUB MEMBERSHIP
  if (type === 'club') {
    return (
      <div className="bg-surface/55 border border-amber-500/30 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white space-y-6">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/10">
              <Crown size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Club Licentie (Premium)
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Actief
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-display font-black italic uppercase tracking-tight text-white mt-0.5">
                Club Lidmaatschap
              </h3>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-dark/40 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Teams Limiet</div>
              <div className="text-base font-bold text-amber-300 flex items-center gap-1.5">
                <span>Onbeperkt</span>
                <Sparkles size={14} />
              </div>
            </div>
          </div>

          <div className="bg-dark/40 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Calendar size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Lid Sinds</div>
              <div className="text-base font-bold text-white">
                {formatDate(membership?.approvedAt)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render 5: SUSPENDED or PENDING
  return (
    <div className="bg-surface/55 border border-white/10 shadow-xl rounded-3xl p-6 sm:p-8 text-white space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted">
          <ShieldAlert size={20} />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-text-muted border border-white/10">
            {status === 'suspended' ? 'Geschorst' : 'In behandeling'}
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            {status === 'suspended' ? 'Lidmaatschap Opgeschort' : 'Toegang In Behandeling'}
          </h3>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {status === 'suspended'
          ? 'Je account is tijdelijk opgeschort. Neem contact op met de beheerder.'
          : 'Je registratie wordt beoordeeld door een beheerder.'}
      </p>
    </div>
  );

  // Helper Modal component for Contact button
  function renderContactModal() {
    return (
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-surface border border-white/10 max-w-md w-full rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative text-white"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Contact Opnemen</h3>
                  <p className="text-xs text-text-muted">Stuur een bericht voor een Coach of Club-licentie.</p>
                </div>
              </div>

              {contactSuccessMsg ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center space-y-2">
                  <CheckCircle2 size={24} className="mx-auto" />
                  <p className="font-bold">Bedankt for je bericht!</p>
                  <p className="text-[11px] text-emerald-400/80">Een beheerder neemt zo snel mogelijk contact op.</p>
                </div>
              ) : (
                <form onSubmit={handleSendContact} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">Onderwerp</label>
                    <input
                      type="text"
                      readOnly
                      value="Aanvraag Coach / Club Lidmaatschap"
                      className="w-full bg-dark/60 border border-white/10 rounded-xl p-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">Bericht</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Typ hier je vragen of wensen t.a.v. het lidmaatschap..."
                      className="w-full bg-dark/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowContactModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold"
                    >
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-lg shadow-primary/20"
                    >
                      Versturen
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }
};
