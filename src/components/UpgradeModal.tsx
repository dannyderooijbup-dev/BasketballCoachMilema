import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, X, CheckCircle2, Info, Sparkles, ShieldAlert } from 'lucide-react';
import { UpgradeReason } from '../services/permissionsService';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: UpgradeReason | null;
  onMoreInfo?: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  reason,
  onMoreInfo,
}) => {
  const [showInfoToast, setShowInfoToast] = useState(false);

  if (!isOpen) return null;

  const isCoachSuggested = reason?.suggestedPlan === 'coach';

  const defaultTitle = isCoachSuggested ? "Upgrade naar Full Membership" : "Maximum aantal teams bereikt";
  const defaultText = isCoachSuggested
    ? "Je proefperiode geeft je tijdelijk toegang tot alle functies van Basketball Coach GameStats. Upgrade naar een Full Membership (Coach) om ongestoord verder te werken."
    : "Je Coach-lidmaatschap ondersteunt maximaal 3 teams.\nUpgrade naar Club om onbeperkt teams te beheren en toekomstige premiumfuncties te gebruiken.";

  const title = reason?.title || defaultTitle;
  const description = reason?.description || defaultText;

  const handleMoreInfoClick = () => {
    if (onMoreInfo) {
      onMoreInfo();
    } else {
      setShowInfoToast(true);
      setTimeout(() => setShowInfoToast(false), 4000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="bg-surface border border-amber-500/30 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-white"
        >
          {/* Subtle glow background */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-text-muted hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 cursor-pointer"
            aria-label="Sluiten"
          >
            <X size={20} />
          </button>

          {/* Icon header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/10">
              <Crown size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Upgrade Vereist
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-black italic uppercase tracking-tight text-white mt-1">
                {title}
              </h3>
            </div>
          </div>

          {/* Description */}
          <div className="bg-dark/60 border border-white/5 p-4 sm:p-5 rounded-2xl mb-6 text-sm text-text-muted leading-relaxed whitespace-pre-line">
            {description}
          </div>

          {/* Feature highlights */}
          <div className="space-y-2.5 mb-8">
            <div className="text-xs uppercase font-bold text-text-muted tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              {isCoachSuggested ? "Voordelen van Full Membership (Coach):" : "Voordelen van Club-lidmaatschap:"}
            </div>
            {isCoachSuggested ? (
              <>
                <div className="flex items-center gap-3 text-xs text-white/90 font-medium">
                  <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Blijvend toegang tot al je teams, spelers en wedstrijden</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/90 font-medium">
                  <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Tot 3 teams beheren met uitgebreide seizoensstatistieken</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/90 font-medium">
                  <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Live box scores, kwartanalyses en speler-export</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-xs text-white/90 font-medium">
                  <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Onbeperkt teams aanmaken en beheren</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/90 font-medium">
                  <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Volledige seizoen- en spelersstatistieken</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/90 font-medium">
                  <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Toekomstige clubbeheer- en exportfuncties</span>
                </div>
              </>
            )}
          </div>

          {/* Toast notice for More Info placeholder */}
          {showInfoToast && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 mb-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2"
            >
              <Info size={16} className="flex-shrink-0" />
              <span>
                {isCoachSuggested
                  ? "Neem contact op met de beheerder om je proefperiode om te zetten naar een Full Membership (Coach)."
                  : "Neem contact op met de beheerder om je lidmaatschap op te waarderen naar Club."}
              </span>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-white/5">
            <button
              onClick={handleMoreInfoClick}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/10"
            >
              <Info size={15} />
              <span>Meer informatie</span>
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              Sluiten
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
