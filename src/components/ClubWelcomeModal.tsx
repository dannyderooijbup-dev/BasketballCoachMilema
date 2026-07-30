import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Shield, User, Sparkles, Check, ArrowRight } from 'lucide-react';
import { InviteRole } from '../types';

interface ClubWelcomeModalProps {
  isOpen: boolean;
  clubName: string;
  role: InviteRole | string;
  onClose: () => void;
}

export default function ClubWelcomeModal({ isOpen, clubName, role, onClose }: ClubWelcomeModalProps) {
  if (!isOpen) return null;

  const roleTitle = role === 'coach' ? 'Coach' : role === 'assistant' ? 'Assistent-coach' : role;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-dark/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-surface w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-primary/30 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          {/* Header Icon & Tag */}
          <div className="flex flex-col items-center text-center space-y-3 relative z-10">
            <div className="w-16 h-16 rounded-3xl bg-primary/20 text-primary flex items-center justify-center border border-primary/40 shadow-xl shadow-primary/20">
              <Sparkles size={32} />
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              <Check size={14} />
              <span>Uitnodiging Geaccepteerd</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-display font-black italic uppercase tracking-tight text-white pt-1">
              Welkom bij {clubName}!
            </h2>
            
            <p className="text-sm text-text-muted leading-relaxed max-w-md">
              Je account is automatisch gekoppeld aan de Club Workspace. Je hebt nu direct toegang tot alle gedeelde teams, wedstrijden en statistieken van de club.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/10 space-y-3 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted font-semibold uppercase tracking-wider">Club Workspace:</span>
              <span className="text-white font-bold flex items-center gap-1.5">
                <Building2 size={14} className="text-primary" />
                <span>{clubName}</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
              <span className="text-text-muted font-semibold uppercase tracking-wider">Toegekende Rol:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                {role === 'coach' ? <Shield size={14} /> : <User size={14} />}
                <span>{roleTitle}</span>
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 relative z-10">
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl bg-primary hover:bg-primary-hover text-white font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-primary/30 active:scale-[0.98] cursor-pointer"
            >
              <span>Ga naar Club Workspace</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
