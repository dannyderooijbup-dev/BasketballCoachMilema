import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  getAdditionalUserInfo,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  LogIn, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  Eye, 
  EyeOff,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthScreenProps {
  onSuccess?: (user: User) => void;
}

type AuthMode = 'login' | 'register' | 'forgot-password';

const sendRegistrationEmail = async (email: string, name?: string, uid?: string) => {
  try {
    const response = await fetch('/api/send-registration-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, name, uid }),
    });
    if (!response.ok) {
      console.error('Registration email failed:', await response.text());
    } else {
      console.log('Welcome email sent');
      console.log('Admin notification sent');
    }
  } catch (error) {
    console.error('Registration email failed:', error);
  }
};

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  
  // Form input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Auxiliary UI controls
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear errors and inputs on switching tab
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  // Convert Firebase auth errors into friendly Dutch messages
  const getDutchErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'Dit is geen geldig e-mailadres.';
      case 'auth/user-disabled':
        return 'Dit account is uitgeschakeld.';
      case 'auth/user-not-found':
        return 'Er is geen account gevonden met dit e-mailadres.';
      case 'auth/wrong-password':
        return 'Het ingevoerde wachtwoord is onjuist.';
      case 'auth/email-already-in-use':
        return 'Dit e-mailadres is al in gebruik door een ander account.';
      case 'auth/weak-password':
        return 'Het wachtwoord moet minimaal 6 tekens bevatten.';
      case 'auth/popup-blocked':
        return 'De login popup is geblokkeerd door je browser. Sta popups toe en probeer het opnieuw.';
      case 'auth/popup-closed-by-user':
        return 'Het inlogvenster is gesloten voordat het inloggen kon worden afgerond.';
      case 'auth/invalid-credential':
        return 'Ongeldige inloggegevens. Controleer e-mail en wachtwoord.';
      case 'auth/operation-not-allowed':
        return 'Google inloggen is niet ingeschakeld in de Firebase Console. Ga naar Authentication > Sign-in method en schakel Google in.';
      default:
        return 'Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.';
    }
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Initial basic client-side validation
    if (!email) {
      setErrorMsg('Vul een e-mailadres in.');
      return;
    }
    
    if (mode !== 'forgot-password' && !password) {
      setErrorMsg('Vul je wachtwoord in.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setErrorMsg('Wachtwoorden komen niet overeen.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Wachtwoord moet minimaal 6 tekens lang zijn.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (onSuccess) onSuccess(userCredential.user);
      } else if (mode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Registration created");
        
        // Step 2: Send official Firebase verification email
        try {
          await sendEmailVerification(userCredential.user);
          console.log("Verification email sent");
        } catch (verifErr: any) {
          console.error("Firebase verification failed:", verifErr);
        }

        // Step 3: Trigger welcome email and admin notification
        try {
          await sendRegistrationEmail(email, undefined, userCredential.user.uid);
        } catch (emailErr: any) {
          console.error("Registration email failed:", emailErr);
        }

        if (onSuccess) onSuccess(userCredential.user);
      } else if (mode === 'forgot-password') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('Er is een herstellink gestuurd naar je e-mailadres.');
        setEmail('');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(getDutchErrorMessage(err.code || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const additionalInfo = getAdditionalUserInfo(userCredential);
      if (additionalInfo?.isNewUser) {
        await sendRegistrationEmail(
          userCredential.user.email || '', 
          userCredential.user.displayName || undefined,
          userCredential.user.uid
        );
      }
      if (onSuccess) onSuccess(userCredential.user);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(getDutchErrorMessage(err.code || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[35rem] h-[35rem] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      {/* Main Logo Header */}
      <div className="mb-8 text-center z-10">
        <div className="inline-flex p-1.5 rounded-3xl bg-surface/50 border border-white/5 shadow-inner mb-4">
          <img 
            src="/logo.png" 
            alt="Basketball Coach Logo" 
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-lg" 
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black font-display italic uppercase tracking-tighter leading-none mb-2">
          <span className="text-white">Basketball</span>
          <span className="text-primary ml-1.5">Coach</span>
        </h1>
        <p className="text-[11px] sm:text-xs font-black text-text-muted uppercase tracking-[0.4em] font-sans">
          Game <span className="text-primary">Stats</span> Portal
        </p>
      </div>

      {/* Authentication Card */}
      <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl overflow-hidden glass shadow-2xl relative z-10 p-6 sm:p-8">
        
        {/* Forms and Transitions */}
        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl sm:text-2xl font-black font-display uppercase tracking-tight text-white mb-2 italic">
                Inloggen
              </h2>
              <p className="text-xs text-text-muted mb-6">
                Log in om toegang te krijgen tot je team en statistieken.
              </p>

              {errorMsg && (
                <div id="auth-error-login" className="mb-4 bg-red-400/10 border border-red-500/20 text-red-400 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">
                    E-mailadres
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="email"
                      required
                      placeholder="coach@team.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted">
                      Wachtwoord
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot-password')}
                      className="text-[10px] uppercase tracking-wider font-bold text-primary hover:underline"
                    >
                      Wachtwoord vergeten?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black font-display uppercase italic tracking-wider py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                  id="auth-submit-login"
                >
                  {loading ? 'Laden...' : 'Inloggen'}
                  {!loading && <LogIn size={16} />}
                </button>
              </form>
            </motion.div>
          )}

          {mode === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl sm:text-2xl font-black font-display uppercase tracking-tight text-white mb-2 italic">
                Registreren
              </h2>
              <p className="text-xs text-text-muted mb-6">
                Maak een gratis account aan om je coaching sessies op te slaan.
              </p>

              {errorMsg && (
                <div id="auth-error-register" className="mb-4 bg-red-400/10 border border-red-500/20 text-red-400 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">
                    E-mailadres
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="email"
                      required
                      placeholder="coach@team.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">
                    Wachtwoord
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="minimaal 6 tekens"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
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
                    Bevestig Wachtwoord
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="herhaal wachtwoord"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black font-display uppercase italic tracking-wider py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                  id="auth-submit-register"
                >
                  {loading ? 'Laden...' : 'Account Aanmaken'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </motion.div>
          )}

          {mode === 'forgot-password' && (
            <motion.div
              key="forgot-password"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl sm:text-2xl font-black font-display uppercase tracking-tight text-white mb-2 italic">
                Wachtwoord vergeten
              </h2>
              <p className="text-xs text-text-muted mb-6">
                Vul je e-mailadres in om een wachtwoord herstel link te ontvangen.
              </p>

              {errorMsg && (
                <div id="auth-error-forgot" className="mb-4 bg-red-400/10 border border-red-500/20 text-red-400 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div id="auth-success-forgot" className="mb-4 bg-green-400/10 border border-green-500/20 text-green-400 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs">
                  <CheckCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">
                    E-mailadres
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="email"
                      required
                      placeholder="coach@team.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-dark/60 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black font-display uppercase italic tracking-wider py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] text-xs text-center"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-primary hover:bg-primary/90 text-white font-black font-display uppercase italic tracking-wider py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {loading ? 'Laden...' : 'Wachtwoord aanvragen'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Third Party Login (Only if not resetting password) */}
        {mode !== 'forgot-password' && (
          <>
            <div className="relative my-6 select-none">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
                <span className="bg-surface px-3 text-text-muted">Of ga verder met</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-dark/40 hover:bg-dark/80 text-white border border-white/10 hover:border-white/20 font-bold text-xs py-3.5 px-5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
              id="auth-google-login"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22l.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              Inloggen met Google
            </button>

            {typeof window !== 'undefined' && window.self !== window.top && (
              <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10 text-[10px] text-primary/80 leading-relaxed text-center">
                <strong>Let op preview iframe:</strong> Google Inloggen kan geblokkeerd worden binnen de AI Studio preview. Klik rechtsboven op <strong>"Open in a new tab"</strong> om foutloos in te loggen via Google.
              </div>
            )}
          </>
        )}

        {/* Footer Link (Toggle login/register) */}
        <div className="mt-8 text-center text-xs text-text-muted">
          {mode === 'login' ? (
            <p>
              Nog geen account?{' '}
              <button
                onClick={() => switchMode('register')}
                className="text-primary font-bold hover:underline font-sans ml-1"
                id="auth-toggle-to-register"
              >
                Registreren
              </button>
            </p>
          ) : mode === 'register' ? (
            <p>
              Heb je al een account?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-primary font-bold hover:underline font-sans ml-1"
                id="auth-toggle-to-login"
              >
                Inloggen
              </button>
            </p>
          ) : (
            <p>
              Terug naar{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-primary font-bold hover:underline font-sans ml-1"
              >
                Inloggen
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
