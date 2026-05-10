import React, { useState, useEffect, Component, ErrorInfo, ReactNode, useMemo, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Theme } from './types';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Radar, Info, Target } from 'lucide-react';
import { AIRFIELDS } from './constants';

import { AuthPage } from './pages/AuthPage';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Community } from './pages/Community';
import { Search } from './pages/Search';
import { Event } from './pages/Event';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
import { ChannelView } from './pages/ChannelView';
import { AdminPanel } from './pages/AdminPanel';
import { SectionBlocker } from './components/SectionBlocker';
import { Chat } from './pages/Chat';
import { CaptchaScreen } from './components/CaptchaScreen';
import { AuthLockScreen } from './components/AuthLockScreen';
import { UpdateNotifier } from './components/UpdateNotifier';
import { SunsetScreen } from './components/SunsetScreen';
import { StorePage } from './pages/Store';

import { AIPage } from './pages/AIPage';

import { GiftsPage } from './pages/GiftsPage';



interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center text-white p-8">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Сталася помилка</h1>
          <pre className="bg-slate-900 p-4 rounded-xl text-sm overflow-auto max-w-full">
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-blue-600 rounded-xl font-bold"
          >
            Оновити сторінку
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { LanguageProvider } from './contexts/LanguageContext';
import { CallProvider } from './contexts/CallContext';
import { CallScreen } from './components/CallScreen';

import { AccountFrozenBanner } from './components/AccountFrozenBanner';
import { Mascot } from './components/Mascot';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) return savedTheme;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'dark';
  });

  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('appBrightness');
    return saved !== null ? parseFloat(saved) : 1;
  });

  const [navPosition, setNavPosition] = useState<'top' | 'bottom'>(() => {
    return (localStorage.getItem('navPosition') as 'top' | 'bottom') || 'bottom';
  });

  const [captchaVerified, setCaptchaVerified] = useState(() => {
    return sessionStorage.getItem('captchaVerified') === 'true';
  });

  const [userFont, setUserFont] = useState(() => {
    return localStorage.getItem('userCustomFont') || '';
  });

  useEffect(() => {
    const handleFontChange = () => {
      setUserFont(localStorage.getItem('userCustomFont') || '');
    };
    window.addEventListener('userFontChanged', handleFontChange);
    return () => window.removeEventListener('userFontChanged', handleFontChange);
  }, []);

  useEffect(() => {
    const fontId = 'user-custom-font';
    let styleEl = document.getElementById(fontId) as HTMLStyleElement;
    
    if (userFont) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = fontId;
        document.head.appendChild(styleEl);
      }
      
      // If it's a URL (starts with http) we @import it, otherwise just use it as string, or if it's base64 it's @font-face
      if (userFont.startsWith('data:font')) {
         styleEl.innerHTML = `
            @font-face {
              font-family: 'LocalUploadedFont';
              src: url('${userFont}');
              font-weight: normal;
              font-style: normal;
            }
            body, h1, h2, h3, h4, h5, h6, p, span, a, div, button, input {
              font-family: 'LocalUploadedFont', 'Inter', sans-serif !important;
            }
         `;
      } else {
         styleEl.innerHTML = `
            body, h1, h2, h3, h4, h5, h6, p, span, a, div, button, input {
              font-family: '${userFont}', 'Inter', sans-serif !important;
            }
         `;
      }
    } else if (styleEl) {
      styleEl.remove();
    }
  }, [userFont]);

  useEffect(() => {
    localStorage.setItem('navPosition', navPosition);
  }, [navPosition]);

  useEffect(() => {
    localStorage.setItem('appBrightness', brightness.toString());
  }, [brightness]);

  const [bgMusic, setBgMusic] = useState(() => localStorage.getItem('bgMusic') || '');
  const [bgMusicName, setBgMusicName] = useState(() => localStorage.getItem('bgMusicName') || '');
  const [bgVolume, setBgVolume] = useState(() => {
    const vol = localStorage.getItem('bgVolume');
    return vol !== null ? parseFloat(vol) : 0.5;
  });

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleMusicChange = () => {
      setBgMusic(localStorage.getItem('bgMusic') || '');
      setBgMusicName(localStorage.getItem('bgMusicName') || '');
    };
    const handleVolChange = () => {
      const vol = localStorage.getItem('bgVolume');
      if (vol) setBgVolume(parseFloat(vol));
    };
    window.addEventListener('bgMusicChanged', handleMusicChange);
    window.addEventListener('bgMusicVolumeChanged', handleVolChange);
    return () => {
      window.removeEventListener('bgMusicChanged', handleMusicChange);
      window.removeEventListener('bgMusicVolumeChanged', handleVolChange);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgVolume;
    }
  }, [bgVolume]);

  useEffect(() => {
    const interactHandler = () => {
      if (audioRef.current && bgMusic && audioRef.current.paused) {
        audioRef.current.play().catch(e => console.log('Autoplay prevented:', e));
      }
    };
    document.addEventListener('click', interactHandler);
    return () => document.removeEventListener('click', interactHandler);
  }, [bgMusic]);

  const [user, setUser] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManageThreats, setCanManageThreats] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appLockPassed, setAppLockPassed] = useState(false);

  const exitAdminMode = useCallback(() => {
    setIsAdmin(false);
    setCanManageThreats(false);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    localStorage.setItem('adminExited', 'true');
  }, []);

  useEffect(() => {
    let unsubscribeDoc: () => void;
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          unsubscribeDoc = onSnapshot(userRef, async (userDoc) => {
            const hasExited = localStorage.getItem('adminExited') === 'true';
            const role = userDoc.exists() ? userDoc.data().role : 'user';
            const isRealAdmin = !hasExited && (role === 'admin' || currentUser.email === 'olegkucher2311@gmail.com');
            const canManage = !hasExited && (role === 'admin' || role === 'moder' || currentUser.email === 'olegkucher2311@gmail.com');
            const blockedSections = userDoc.exists() ? userDoc.data().blockedSections || [] : [];
            const description = userDoc.exists() ? userDoc.data().description || '' : '';
            const isPermanentlyBlocked = userDoc.exists() ? userDoc.data().isPermanentlyBlocked : false;
            const isFrozen = userDoc.exists() ? userDoc.data().isFrozen : false;
            const freezeReason = userDoc.exists() ? userDoc.data().freezeReason : '';
            const frozenFeatures = userDoc.exists() ? userDoc.data().frozenFeatures || [] : [];
  
            const impersonatedId = localStorage.getItem('impersonatedUserId');
            if (isRealAdmin && impersonatedId) {
              const impDoc = await getDoc(doc(db, 'users', impersonatedId));
              if (impDoc.exists()) {
                const impData = impDoc.data();
                setUser({
                  uid: impersonatedId,
                  email: impData.email,
                  displayName: impData.displayName,
                  photoURL: impData.photoURL,
                  isImpersonated: true,
                  realUid: currentUser.uid,
                  role: impData.role,
                  blockedSections: impData.blockedSections || [],
                  description: impData.description || '',
                  isPermanentlyBlocked: impData.isPermanentlyBlocked || false,
                  isFrozen: impData.isFrozen || false,
                  freezeReason: impData.freezeReason || '',
                  frozenFeatures: impData.frozenFeatures || []
                });
                setIsAdmin(false); // Impersonated user is not admin
                setCanManageThreats(false);
              } else {
                setUser({ ...currentUser, role, blockedSections, description, isPermanentlyBlocked, isFrozen, freezeReason, frozenFeatures });
                setIsAdmin(isRealAdmin);
                setCanManageThreats(canManage);
              }
            } else {
              setUser({ ...currentUser, role, blockedSections, description, isPermanentlyBlocked, isFrozen, freezeReason, frozenFeatures });
              setIsAdmin(isRealAdmin);
              setCanManageThreats(canManage);
            }
            setIsAuthReady(true);
          });
        } catch (error) {
          console.error("Error checking admin status", error);
          setUser(currentUser);
          setIsAdmin(false);
          setCanManageThreats(false);
          setIsAuthReady(true);
        }
      } else {
        if (unsubscribeDoc) unsubscribeDoc();
        setUser(null);
        setIsAdmin(false);
        setCanManageThreats(false);
        localStorage.removeItem('adminExited');
        localStorage.removeItem('impersonatedUserId');
        sessionStorage.removeItem('captchaVerified');
        setCaptchaVerified(false);
        setIsAuthReady(true);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  useEffect(() => {
    if (!user) return;

    const userStatusRef = doc(db, 'presence', user.uid);

    const setOnlineStatus = async () => {
      try {
        await setDoc(userStatusRef, {
          state: 'online',
          lastChanged: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error setting presence:", error);
      }
    };

    setOnlineStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setDoc(userStatusRef, {
          state: 'offline',
          lastChanged: serverTimestamp(),
        }).catch(console.error);
      } else {
        setOnlineStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => {
      setDoc(userStatusRef, {
        state: 'offline',
        lastChanged: serverTimestamp(),
      }).catch(console.error);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const [securityConfig, setSecurityConfig] = useState<{ captchaEnabled: boolean, isSiteBlocked?: boolean } | null>(null);

  useEffect(() => {
    const settingsRef = doc(db, 'systemSettings', 'config');
    const unsubscribeConfig = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.forceReload) {
          const lastReload = localStorage.getItem('lastReload');
          if (lastReload !== data.forceReload.toString()) {
            localStorage.setItem('lastReload', data.forceReload.toString());
            window.location.reload();
          }
        }
      }
    });

    const securityRef = doc(db, 'settings', 'security');
    const unsubscribeSecurity = onSnapshot(securityRef, (docSnap) => {
      if (docSnap.exists()) {
        setSecurityConfig(docSnap.data() as { captchaEnabled: boolean, isSiteBlocked?: boolean });
      } else {
        setSecurityConfig({ captchaEnabled: true, isSiteBlocked: false }); // Default
      }
    });

    const appearanceRef = doc(db, 'settings', 'appearance');
    const unsubscribeAppearance = onSnapshot(appearanceRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fontId = 'custom-site-font';
        let styleEl = document.getElementById(fontId) as HTMLStyleElement;
        
        if (data.customFontBase64) {
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = fontId;
            document.head.appendChild(styleEl);
          }
          styleEl.innerHTML = `
            @font-face {
              font-family: 'UploadedCustomFont';
              src: url('${data.customFontBase64}');
              font-weight: normal;
              font-style: normal;
            }
            body, h1, h2, h3, h4, h5, h6, p, span, a, div, button, input {
              font-family: 'UploadedCustomFont', 'Inter', sans-serif !important;
            }
          `;
        } else if (styleEl) {
          styleEl.remove();
        }
      }
    });

    return () => {
      unsubscribeConfig();
      unsubscribeSecurity();
      unsubscribeAppearance();
    };
  }, []);

  const effectiveUser = user || (isGuest ? { uid: 'guest', isGuest: true, role: 'user', displayName: 'Гість' } : null);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center text-white">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
          }}
          className="relative"
        >
          <div className="absolute inset-0 bg-blue-500/30 blur-3xl rounded-full scale-150" />
          <img src="/icon.svg" alt="App Avatar" className="w-32 h-32 relative z-10 drop-shadow-2xl rounded-3xl" />
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-xl font-black tracking-widest uppercase text-slate-300"
        >
          Завантаження...
        </motion.h2>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <CallProvider>
          {bgMusic && <audio ref={audioRef} src={bgMusic} autoPlay loop playsInline style={{ display: 'none' }} />}
          <CallScreen />
          <BrowserRouter>
            <div className="h-[100dvh] w-full flex flex-col">
            <Mascot />
            <UpdateNotifier />
            {effectiveUser?.isFrozen && <AccountFrozenBanner user={effectiveUser} />}
            {effectiveUser?.isImpersonated && (
              <div className="fixed bottom-20 right-4 z-50">
              <button 
                onClick={() => {
                  localStorage.removeItem('impersonatedUserId');
                  window.location.reload();
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Припинити керування {effectiveUser.email}
              </button>
            </div>
          )}
          {effectiveUser?.isPermanentlyBlocked ? (
             <div className="min-h-screen bg-black flex flex-col items-center justify-center relative p-8 text-center" style={{ background: 'radial-gradient(circle at center, #3f0914 0%, #000000 100%)' }}>
                 <h1 className="text-2xl font-bold text-white mb-4 uppercase tracking-wider text-red-500">Доступ заблоковано</h1>
                 <p className="text-sm text-gray-300 mb-8 max-w-sm leading-relaxed">
                     Ваш акаунт було заблоковано назавжди через постійні спроби введення неправильного пароля.
                 </p>
                 <button onClick={() => { auth.signOut(); setIsGuest(false); }} className="text-white font-semibold underline opacity-70 hover:opacity-100 transition-opacity">Вийти з акаунта</button>
             </div>
          ) : effectiveUser && !isAdmin && securityConfig?.isSiteBlocked ? (
            <SunsetScreen config={securityConfig} onSignOut={() => setIsGuest(false)} />
          ) : effectiveUser ? (
            (securityConfig?.captchaEnabled !== false && !captchaVerified) ? (
              <CaptchaScreen onVerify={() => {
                sessionStorage.setItem('captchaVerified', 'true');
                setCaptchaVerified(true);
              }} />
            ) : !appLockPassed ? (
              <AuthLockScreen onUnlock={() => setAppLockPassed(true)} />
            ) : (
              <>
                <Routes>
                  <Route path="/" element={<Layout theme={theme} toggleTheme={toggleTheme} isAdmin={isAdmin} brightness={brightness} navPosition={navPosition} />}>
                    <Route index element={<SectionBlocker user={effectiveUser}><Dashboard isAdmin={canManageThreats} user={effectiveUser} /></SectionBlocker>} />
                  <Route path="community" element={<SectionBlocker user={effectiveUser}><Community isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="channel/:channelId" element={<SectionBlocker user={effectiveUser}><ChannelView isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="qa" element={<SectionBlocker user={effectiveUser}><AIPage isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="search" element={<SectionBlocker user={effectiveUser}><Search isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="store" element={<SectionBlocker user={effectiveUser}><StorePage isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="event" element={<SectionBlocker user={effectiveUser}><Event isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="gifts" element={<SectionBlocker user={effectiveUser}><GiftsPage isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="notifications" element={<SectionBlocker user={effectiveUser}><Notifications isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="settings" element={<SectionBlocker user={effectiveUser}><Settings theme={theme} setTheme={setTheme} brightness={brightness} setBrightness={setBrightness} navPosition={navPosition} setNavPosition={setNavPosition} exitAdminMode={exitAdminMode} isAdmin={isAdmin} /></SectionBlocker>} />
                  <Route path="admin" element={isAdmin ? <AdminPanel /> : <Navigate to="/" replace />} />
                  <Route path="profile" element={<SectionBlocker user={effectiveUser}><Profile isAdmin={isAdmin} user={effectiveUser} /></SectionBlocker>} />
                  <Route path="profile/:userId" element={<SectionBlocker user={effectiveUser}><Profile isAdmin={isAdmin} user={effectiveUser} /></SectionBlocker>} />
                  <Route path="chat/:userId" element={<SectionBlocker user={effectiveUser}><Chat /></SectionBlocker>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
              </>
            )
          ) : (
            <Routes>
              <Route path="/" element={<AuthPage onGuestLogin={() => setIsGuest(true)} securityConfig={securityConfig} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
          </div>
        </BrowserRouter>
        </CallProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
