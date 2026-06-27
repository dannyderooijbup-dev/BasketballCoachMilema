import React, { useState } from 'react';
import { 
  updatePassword, 
  linkWithPopup, 
  deleteUser, 
  User 
} from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { 
  User as UserIcon, 
  Mail, 
  Building, 
  Briefcase, 
  Newspaper, 
  KeyRound, 
  Link, 
  LogOut, 
  Trash2, 
  Check, 
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AccountScreenProps {
  currentUser: User;
  name: string;
  club: string;
  role: string;
  newsletter: boolean;
  onSaveProfile: (profile: { name: string; club: string; role: string; newsletter: boolean }) => Promise<void>;
  onLogout: () => Promise<void>;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export default function AccountScreen({
  currentUser,
  name,
  club,
  role,
  newsletter,
  onSaveProfile,
  onLogout,
  theme,
  onThemeChange
}: AccountScreenProps) {
  // Local state for draft profile settings
  const [localName, setLocalName] = useState(name);
  const [localClub, setLocalClub] = useState(club);
  const [localRole, setLocalRole] = useState(role);
  const [localNewsletter, setLocalNewsletter] = useState(newsletter);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(null);

  // Sync state if props change (e.g. on load)
  React.useEffect(() => {
    setLocalName(name);
  }, [name]);

  React.useEffect(() => {
    setLocalClub(club);
  }, [club]);

  React.useEffect(() => {
    setLocalRole(role);
  }, [role]);

  React.useEffect(() => {
    setLocalNewsletter(newsletter);
  }, [newsletter]);

  // Local state for interactive actions
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Status flags
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Check if Google is already linked
  const isGoogleLinked = currentUser.providerData.some(
    (provider) => provider.providerId === 'google.com'
  );

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSavedMessage(null);
    try {
      await onSaveProfile({
        name: localName.trim(),
        club: localClub.trim(),
        role: localRole.trim(),
        newsletter: localNewsletter
      });
      setProfileSavedMessage('Profielgegevens succesvol opgeslagen!');
      setTimeout(() => setProfileSavedMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: 'Opslaan mislukt. Probeer het opnieuw.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Wachtwoorden komen niet overeen.');
      return;
    }

    setPasswordLoading(true);
    try {
      await updatePassword(currentUser, newPassword);
      setPasswordSuccess('Wachtwoord is succesvol gewijzigd!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setPasswordError('Om veiligheidsredenen moet je opnieuw inloggen om je wachtwoord te wijzigen.');
      } else {
        setPasswordError('Er is een fout opgetreden. Probeer het opnieuw.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (isGoogleLinked) return;
    setMsg(null);
    setLinkLoading(true);
    try {
      await linkWithPopup(currentUser, googleProvider);
      setMsg({ type: 'success', text: 'Google account succesvol gekoppeld!' });
    } catch (err: any) {
      console.error("Fout bij koppelen met Google:", err);
      let errorMessage = 'Koppelen mislukt. Probeer het opnieuw.';
      
      if (err.code === 'auth/credential-already-in-use') {
        errorMessage = 'Dit Google account is al gekoppeld aan een ander basketball coach account.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Inlog popup geblokkeerd door je browser. Sta popups toe of open de app in een nieuw tabblad.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google inloggen/koppelen is niet ingeschakeld in de Firebase Console. Schakel de Google provider in onder Authentication > Sign-in method.';
      } else if (err.message) {
        errorMessage = `Koppelen mislukt: ${err.message} (Code: ${err.code || 'onbekend'})`;
      }
      
      setMsg({ type: 'error', text: errorMessage });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      // 1. Delete user document from Firestore first
      const docRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(docRef);

      // 2. Erase local storage
      localStorage.removeItem('players');
      localStorage.removeItem('matchesHistory');
      localStorage.removeItem('isMatchActive');
      localStorage.removeItem('opponent');
      localStorage.removeItem('gameClockRunning');
      localStorage.removeItem('currentPeriod');
      localStorage.removeItem('periodElapsed');
      localStorage.removeItem('matchClockStartTime');
      localStorage.removeItem('globalActionsLog');
      localStorage.removeItem('currentStarting5');

      // 3. Delete Firebase Auth user
      await deleteUser(currentUser);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        alert('Om veiligheidsredenen moet je opnieuw inloggen voordat je je account kunt verwijderen.');
      } else {
        alert('Fout bij het verwijderen van account: ' + err.message);
      }
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black font-display uppercase tracking-tight text-white italic">
          Mijn Account
        </h2>
        <p className="text-xs text-text-muted">
          Beheer je persoonlijke coachprofiel, accountinstellingen en synchronisatie.
        </p>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 text-xs border ${
          msg.type === 'success' 
            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Coach Profile */}
        <div className="bg-surface/55 border border-white/5 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <UserIcon size={18} className="text-primary" />
            Coach Profiel
          </h3>

          <div className="space-y-4">
            {/* Email Address (Read-only) */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5 flex items-center gap-1.5">
                <Mail size={12} /> E-mailadres (Alleen lezen)
              </label>
              <input
                type="email"
                disabled
                value={currentUser.email || ''}
                className="w-full bg-dark/40 border border-white/5 rounded-xl py-3 px-4 text-sm text-text-muted/70 cursor-not-allowed font-mono"
              />
            </div>

            {/* Coach Name */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5 flex items-center gap-1.5">
                <UserIcon size={12} /> Coach Naam
              </label>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Bijv. Coach Jeremy"
                className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
              />
            </div>

            {/* Club Name */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5 flex items-center gap-1.5">
                <Building size={12} /> Club / Vereniging
              </label>
              <input
                type="text"
                value={localClub}
                onChange={(e) => setLocalClub(e.target.value)}
                placeholder="Bijv. BC Triple Threat"
                className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
              />
            </div>

            {/* Coach Role/Function */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5 flex items-center gap-1.5">
                <Briefcase size={12} /> Functie
              </label>
              <input
                type="text"
                value={localRole}
                onChange={(e) => setLocalRole(e.target.value)}
                placeholder="Bijv. Hoofdcoach Heren 1 of Jeugdcoach"
                className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
              />
            </div>

            {/* Newsletter toggle */}
            <div className="pt-4 border-t border-white/5 pb-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={localNewsletter}
                    onChange={(e) => setLocalNewsletter(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-white/10"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <Newspaper size={14} /> Nieuwsbrief ontvangen
                  </span>
                  <span className="text-[10px] text-text-muted">Blijf op de hoogte van tactieken en tips.</span>
                </div>
              </label>
            </div>

            {/* Save Button for Coach Profile */}
            <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="w-full bg-primary hover:bg-primary/95 text-white font-display font-black uppercase italic tracking-widest py-3 px-4 rounded-xl text-xs sm:text-sm active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Bezig met opslaan...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Gegevens Opslaan</span>
                  </>
                )}
              </button>
              {profileSavedMessage && (
                <p className="text-[11px] text-green-400 font-medium text-center flex items-center justify-center gap-1.5 animate-pulse mt-1">
                  <Check size={12} fill="currentColor" className="text-green-400 bg-transparent" />
                  {profileSavedMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Password, Linking, Settings */}
        <div className="space-y-8">
          
          {/* Theme Selection Panel */}
          <div className="bg-surface/55 border border-white/5 shadow-xl rounded-3xl p-6 sm:p-8 space-y-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sun size={18} className="text-primary" />
              Weergave & Thema
            </h3>
            <p className="text-xs text-text-muted">
              Pas de weergave van de coach-app aan naar jouw voorkeur.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              {/* Dark Theme Option */}
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer select-none group relative ${
                  theme === 'dark'
                    ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                    : 'bg-dark/40 border-white/5 hover:border-white/10 hover:bg-dark/65'
                }`}
              >
                <div className={`p-3 rounded-full mb-3 transition-colors ${
                  theme === 'dark' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-muted group-hover:text-white'
                }`}>
                  <Moon size={22} />
                </div>
                <span className={`text-xs font-bold tracking-wide uppercase font-display ${
                  theme === 'dark' ? 'text-white' : 'text-text-muted group-hover:text-white'
                }`}>
                  Donker (Dark)
                </span>
                {theme === 'dark' && (
                  <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check size={10} className="text-white font-black" />
                  </div>
                )}
              </button>

              {/* Light Theme Option */}
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer select-none group relative ${
                  theme === 'light'
                    ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                    : 'bg-dark/40 border-white/5 hover:border-white/10 hover:bg-dark/65'
                }`}
              >
                <div className={`p-3 rounded-full mb-3 transition-colors ${
                  theme === 'light' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-muted group-hover:text-white'
                }`}>
                  <Sun size={22} />
                </div>
                <span className={`text-xs font-bold tracking-wide uppercase font-display ${
                  theme === 'light' ? 'text-white' : 'text-text-muted group-hover:text-white'
                }`}>
                  Licht (Light)
                </span>
                {theme === 'light' && (
                  <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check size={10} className="text-white font-black" />
                  </div>
                )}
              </button>
            </div>
          </div>
          
          {/* Change Password Panel */}
          <div className="bg-surface/55 border border-white/5 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound size={18} className="text-primary" />
              Wachtwoord Wijzigen
            </h3>

            {passwordError && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3.5 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5 flex items-center gap-1.5">
                  <Lock size={12} /> Nieuw Wachtwoord
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="minimaal 6 tekens"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">
                  Bevestig Nieuw Wachtwoord
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="herhaal wachtwoord"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {passwordLoading ? 'Wachtwoord wijzigen...' : 'Wachtwoord Opslaan'}
              </button>
            </form>
          </div>

          {/* Social connections & Danger tools */}
          <div className="bg-surface/55 border border-white/5 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Link size={18} className="text-primary" />
              Koppelingen & Acties
            </h3>

            <div className="space-y-4">
              {/* Google Link Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-dark/40 border border-white/5 gap-4">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22l.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white">Google Inloggen</span>
                    <span className="text-[10px] text-text-muted">
                      {isGoogleLinked ? 'Gekoppeld aan Google' : 'Niet gekoppeld'}
                    </span>
                  </div>
                </div>

                {isGoogleLinked ? (
                  <span className="bg-green-500/15 text-green-400 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-1 border border-green-500/10">
                    <Check size={12} /> Actief
                  </span>
                ) : (
                  <button
                    onClick={handleLinkGoogle}
                    disabled={linkLoading}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-[11px] uppercase tracking-wider py-2 px-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {linkLoading ? 'Koppelen...' : 'Google koppelen'}
                  </button>
                )}
              </div>

              {typeof window !== 'undefined' && window.self !== window.top && !isGoogleLinked && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-[10px] text-primary/80 leading-relaxed text-left">
                  <strong>Let op preview restrictie:</strong> De browser kan de Google popup of accountkoppeling blokkeren binnen dit iframe. Klik rechtsboven in AI Studio op <strong>"Open in a new tab"</strong> om de app rechtstreeks te openen en succesvol te koppelen.
                </div>
              )}

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-dark/40 hover:bg-red-500/5 group/logout border border-white/5 hover:border-red-500/10 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <LogOut size={18} className="text-text-muted group-hover/logout:text-red-400 transition-colors" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white group-hover/logout:text-red-400 transition-colors">Veilig Uitloggen</span>
                    <span className="text-[10px] text-text-muted">Meld je af op dit apparaat.</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-text-muted group-hover/logout:text-red-400 uppercase tracking-wider">Log uit</span>
              </button>

              {/* Delete Account Button */}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-500/5 hover:bg-red-500/10 group/delete border border-red-500/10 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Trash2 size={18} className="text-red-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-red-400">Account Verwijderen</span>
                    <span className="text-[10px] text-red-400/70">Verwijder al je gegevens en statistieken permanent.</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Verwijder</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-dark/95 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-red-500/30 max-w-sm w-full rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl glass text-center"
            >
              <div className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mx-auto">
                <AlertTriangle size={36} className="animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black font-display uppercase italic tracking-tight text-white">Weet je het zeker?</h3>
                <p className="text-xs text-text-muted">
                  Dit zal al je spelers, wedstrijdgeschiedenis en accountgegevens definitief wissen. Deze actie kan niet ongedaan worden gemaakt.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleteLoading}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase py-3 rounded-xl transition-all cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase py-3 rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {deleteLoading ? 'Wissen...' : 'Ja, Verwijder'}
                  {!deleteLoading && <Trash2 size={13} />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
