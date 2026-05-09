import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ArrowLeft, Phone, User, Lock, ExternalLink } from 'lucide-react';
import { 
  signInWithGoogle, 
  db, 
  handleFirestoreError, 
  OperationType,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  auth
} from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const FLOATING_WORDS = [
  { text: 'Аналітика', color: 'text-white' },
  { text: 'Шахеди', color: 'text-[black] dark:text-gray-400' },
  { text: 'Ракети', color: 'text-[#D4AF37]' },
  { text: 'Дашборд', color: 'text-white' },
  { text: 'Загроза', color: 'text-black dark:text-gray-400' },
  { text: 'Моніторинг', color: 'text-[#D4AF37]' },
  { text: 'Сирена', color: 'text-white' },
  { text: 'Безпека', color: 'text-black dark:text-gray-400' },
  { text: 'Радар', color: 'text-[#D4AF37]' },
  { text: 'ППО', color: 'text-white' },
];

const WORDS_CONFIG = FLOATING_WORDS.map((word) => {
  const startX = Math.random() * 100;
  const startY = Math.random() * 100;
  const rX = Math.random() * 60;
  const rY = Math.random() * 60;
  return {
    word,
    startX,
    startY,
    duration: 15 + Math.random() * 25,
    delay: Math.random() * -20,
    nextX: (startX + 40 + rX) % 100,
    nextY: (startY + 40 + rY) % 100,
  };
});

const FloatingTextGroup = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
      {WORDS_CONFIG.map((config, i) => (
          <motion.div
            key={i}
            initial={{ x: `${config.startX}vw`, y: `${config.startY}vh`, opacity: 0.1 }}
            animate={{
              x: [`${config.startX}vw`, `${config.nextX}vw`, `${config.startX}vw`],
              y: [`${config.startY}vh`, `${config.nextY}vh`, `${config.startY}vh`],
              opacity: [0.1, 0.4, 0.1],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: config.duration,
              repeat: Infinity,
              ease: "linear",
              delay: config.delay
            }}
            className={`absolute font-black text-3xl sm:text-5xl lg:text-7xl blur-[2px] ${config.word.color}`}
            style={{ textShadow: '0 0 20px rgba(255,255,255,0.1)' }}
          >
            {config.word.text}
          </motion.div>
      ))}
    </div>
  );
};

import { SunsetScreen, SunsetConfig } from '../components/SunsetScreen';

export const AuthPage: React.FC<{ onGuestLogin?: () => void; securityConfig?: SunsetConfig & { isSiteBlocked?: boolean } }> = ({ onGuestLogin, securityConfig }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'sunset' | 'main' | 'telegram-phone'>('main');
  const [clickCount, setClickCount] = useState(0);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (securityConfig?.isSiteBlocked && clickCount < 5) {
      setView('sunset');
    }
  }, [securityConfig?.isSiteBlocked]);
  
  // Registration / Login Form
  const [phone, setPhone] = useState('+380');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setView('main');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        try {
          await setDoc(userRef, {
            email: user.email || '',
            displayName: user.displayName || 'Користувач',
            photoURL: user.photoURL || null,
            createdAt: serverTimestamp(),
            isVerified: false,
            role: 'user',
            registrationMethod: 'google'
          });
        } catch (dbError) {
          handleFirestoreError(dbError, OperationType.CREATE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Ви закрили вікно авторизації');
      } else {
        setError(err.message || 'Сталася помилка при вході');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { signInWithApple } = await import('../firebase');
      const user = await signInWithApple();
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        try {
          await setDoc(userRef, {
            email: user.email || '',
            displayName: user.displayName || 'Користувач Apple',
            photoURL: user.photoURL || null,
            createdAt: serverTimestamp(),
            isVerified: false,
            role: 'user',
            registrationMethod: 'apple'
          });
        } catch (dbError) {
          handleFirestoreError(dbError, OperationType.CREATE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Ви закрили вікно авторизації');
      } else {
        setError(err.message || 'Помилка Apple ID. Переконайтеся, що ви налаштували Apple Provider в консолі Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNotImplemented = () => {
    setError('Наразі ці доступи не працюють окрім Google та Telegram (номер)');
  };

  const cleanPhoneForEmail = (p: string) => {
    return p.replace(/[^0-9]/g, '') + '@skytrack.ua';
  };

  const validatePassword = (pass: string) => {
    return pass.length >= 6 && /[A-ZА-ЯІЇЄҐ]/.test(pass);
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (phone.replace(/[^0-9]/g, '').length < 10) {
      setError('Введіть коректний номер телефону');
      setLoading(false);
      return;
    }

    if (!validatePassword(password)) {
      setError('Пароль має містити мінімум 6 символів та хоча б одну велику літеру');
      setLoading(false);
      return;
    }

    const fakeEmail = cleanPhoneForEmail(phone);

    try {
      if (authMode === 'register') {
        if (!firstName.trim() || !lastName.trim()) {
          setError('Введіть ім\'я та прізвище');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        const userRef = doc(db, 'users', userCredential.user.uid);
        
        await setDoc(userRef, {
          email: fakeEmail,
          phone: phone,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`,
          photoURL: null,
          createdAt: serverTimestamp(),
          isVerified: false,
          role: 'user',
          registrationMethod: 'telegram_phone'
        });
      } else {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Користувач з таким номером вже існує. Спробуйте увійти.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Невірний номер телефону або пароль');
      } else {
        setError(err.message || 'Сталася помилка');
      }
    } finally {
      setLoading(false);
    }
  };

  if (view === 'sunset') {
    return <SunsetScreen config={securityConfig} onLogoClick={handleLogoClick} />;
  }

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <FloatingTextGroup />

      <div className="w-full max-w-sm flex flex-col items-center gap-4 z-10">
        <div className="mb-4 text-center cursor-pointer select-none" onClick={handleLogoClick}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[22px] bg-blue-600 text-white mb-4 shadow-[0_0_20px_rgba(37,99,235,0.4)] backdrop-blur-sm border border-white/10 mx-auto transition-transform active:scale-95">
            <ShieldAlert className="w-8 h-8 pointer-events-none" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-[#111] dark:text-white drop-shadow-md">SkyTrackUa</h1>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-2">
            {view === 'main' ? 'Вхід у систему' : authMode === 'login' ? 'Авторизація' : 'Реєстрація'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 backdrop-blur-md text-red-600 dark:text-red-400 p-4 rounded-[1.5rem] text-sm w-full font-bold border border-red-500/20 text-center mb-2 shadow-lg"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {view === 'main' ? (
            <motion.div 
              key="main"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full space-y-3"
            >
              <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white/90 backdrop-blur-md text-black font-bold text-[17px] py-[18px] rounded-[2rem] transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95 flex items-center justify-center gap-3 shadow-sm border border-white/40"
              >
                {loading ? (
                  <span className="animate-pulse">Зачекайте...</span>
                ) : (
                  <>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-[22px] h-[22px]" />
                    Google
                  </>
                )}
              </button>

              <button 
                onClick={() => setView('telegram-phone')}
                className="w-full bg-[#2AABEE]/90 backdrop-blur-md text-white font-bold text-[17px] py-[18px] rounded-[2rem] transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(42,171,238,0.3)] active:scale-95 flex items-center justify-center gap-3 shadow-md border border-[#2AABEE]/50"
              >
                <img src="https://www.svgrepo.com/show/354443/telegram.svg" alt="Telegram" className="w-6 h-6 invert" />
                Telegram (Номер)
              </button>

              <button 
                onClick={handleNotImplemented}
                className="w-full bg-[#1877F2]/90 backdrop-blur-md text-white font-bold text-[17px] py-[18px] rounded-[2rem] transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(24,119,242,0.3)] active:scale-95 flex items-center justify-center gap-3 shadow-md border border-[#1877F2]/50"
              >
                <svg className="w-[22px] h-[22px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.203h3.312z"/>
                </svg>
                Facebook
              </button>

              <button 
                onClick={handleAppleSignIn}
                className="w-full bg-black/90 backdrop-blur-md text-white font-bold text-[17px] py-[18px] rounded-[2rem] transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] active:scale-95 flex items-center justify-center gap-3 shadow-md border border-white/10"
              >
                <img src="https://www.svgrepo.com/show/511330/apple-173.svg" alt="Apple" className="w-[22px] h-[22px] invert" />
                Apple
              </button>

              <button 
                onClick={onGuestLogin}
                className="w-full bg-slate-800/80 dark:bg-white/10 backdrop-blur-md text-white font-bold text-[17px] py-[18px] rounded-[2rem] transition-all hover:bg-slate-800 dark:hover:bg-white/20 active:scale-95 flex items-center justify-center gap-3 shadow-sm mt-4 border border-white/5"
              >
                <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Увійти як Гість
              </button>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handlePhoneAuth}
              className="w-full space-y-4"
            >
              <div className="bg-white/60 dark:bg-[#111]/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/40 dark:border-white/10 shadow-2xl space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-4">Номер телефону</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Phone className="w-5 h-5" />
                    </div>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 rounded-[1.5rem] py-3.5 pl-12 pr-4 font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                      placeholder="+380"
                    />
                  </div>
                </div>

                {authMode === 'register' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-4">Ім'я</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <User className="w-5 h-5" />
                        </div>
                        <input 
                          type="text"
                          value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 rounded-[1.5rem] py-3.5 pl-12 pr-4 font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                          placeholder="Іван"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-4">Прізвище</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <User className="w-5 h-5" />
                        </div>
                        <input 
                          type="text"
                          value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 rounded-[1.5rem] py-3.5 pl-12 pr-4 font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                          placeholder="Хмельницький"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-4">Пароль (від 6 символів, 1 велика літера)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input 
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 rounded-[1.5rem] py-3.5 pl-12 pr-4 font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white font-bold text-[17px] py-4 rounded-[1.5rem] transition-all hover:bg-blue-700 active:scale-95 shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? 'Зачекайте...' : authMode === 'login' ? 'Увійти' : 'Зареєструватися'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-2">
                <button 
                  type="button"
                  onClick={() => {
                    setView('main');
                    setError('');
                  }}
                  className="p-3 bg-white/50 dark:bg-white/10 backdrop-blur-md rounded-full text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/20 transition-colors border border-white/40 dark:border-white/10 shadow-sm"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setError('');
                  }}
                  className="px-6 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-md rounded-[1.5rem] text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/20 transition-colors border border-white/40 dark:border-white/10 shadow-sm"
                >
                  {authMode === 'login' ? 'Створити акаунт' : 'Вже є акаунт?'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

