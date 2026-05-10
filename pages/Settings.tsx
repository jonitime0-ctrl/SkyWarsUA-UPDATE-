import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Palette, ChevronLeft, Bell, Camera, Save, Image, Globe, Shield, Lock, LogOut, Trash2, Settings as SettingsIcon, Phone, Type, FileUp, X, Music, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { Theme } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  brightness: number;
  setBrightness: (brightness: number) => void;
  navPosition: 'top' | 'bottom';
  setNavPosition: (position: 'top' | 'bottom') => void;
  exitAdminMode?: () => void;
  isAdmin?: boolean;
}

import { SummerItemDisplay } from '../components/SummerItemDisplay';

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { EditProfileModal } from '../components/EditProfileModal';
import { LanguageModal } from '../components/LanguageModal';

export const Settings: React.FC<SettingsProps> = ({ theme, setTheme, brightness, setBrightness, navPosition, setNavPosition, exitAdminMode, isAdmin }) => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerColor, setBannerColor] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [registrationMethod, setRegistrationMethod] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  // Security States
  const [biometricsEnabled, setBiometricsEnabled] = useState(() => localStorage.getItem('biometricsEnabled') === 'true');
  const [biometricPreference, setBiometricPreference] = useState(() => localStorage.getItem('biometricPreference') || 'face');
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isPinEnabled, setIsPinEnabled] = useState(() => localStorage.getItem('isPinEnabled') !== 'false');

  // Interface states
  const [showNameEnabled, setShowNameEnabled] = useState(() => localStorage.getItem('showNameEnabled') !== 'false');
  const [showChangeFont, setShowChangeFont] = useState(false);
  const [tempUserFont, setTempUserFont] = useState(() => localStorage.getItem('userCustomFont') || '');
  const [tempUserFontName, setTempUserFontName] = useState(() => localStorage.getItem('userCustomFontName') || '');

  const [showMusicSettings, setShowMusicSettings] = useState(false);
  const [tempMusicFile, setTempMusicFile] = useState(() => localStorage.getItem('bgMusic') || '');
  const [tempMusicName, setTempMusicName] = useState(() => localStorage.getItem('bgMusicName') || '');
  const [tempMusicVolume, setTempMusicVolume] = useState(() => {
    const vol = localStorage.getItem('bgVolume');
    return vol !== null ? parseFloat(vol) : 0.5;
  });

  // Modal
  const [showEditData, setShowEditData] = useState(false);

  const handleBiometricsToggle = async (enabled: boolean) => {
    if (!enabled) {
      setBiometricsEnabled(false);
      localStorage.removeItem('biometricsEnabled');
      localStorage.removeItem('credentialId');
    } else {
      if (window.PublicKeyCredential === undefined) {
         alert("Біометрія не підтримується на цьому пристрої");
         return;
      }
      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge,
                rp: { id: window.location.hostname, name: "SkyTrack" },
                user: {
                    id: Uint8Array.from(auth.currentUser?.uid || "user", c => c.charCodeAt(0)),
                    name: auth.currentUser?.email || "user",
                    displayName: auth.currentUser?.displayName || "User",
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
                authenticatorSelection: { userVerification: "required" },
                timeout: 60000,
            }
        }) as PublicKeyCredential;
        
        if (credential) {
            localStorage.setItem('credentialId', Array.from(new Uint8Array(credential.rawId)).join(','));
            localStorage.setItem('biometricsEnabled', 'true');
            setBiometricsEnabled(true);
        }
      } catch (err) {
        console.error(err);
        setBiometricsEnabled(false);
      }
    }
  };

  const handleBiometricPreferenceChange = (val: string) => {
      setBiometricPreference(val);
      localStorage.setItem('biometricPreference', val);
  };

  const handleTogglePin = (enabled: boolean) => {
      setIsPinEnabled(enabled);
      if (enabled) {
          localStorage.setItem('isPinEnabled', 'true');
          // if no appPin exists, maybe we should prompt them to create one, but for now just toggle
          if (!localStorage.getItem('appPin')) {
              localStorage.setItem('appPin', '0000'); // default
          }
      } else {
          localStorage.setItem('isPinEnabled', 'false');
      }
  };

  const handleToggleShowName = (enabled: boolean) => {
      setShowNameEnabled(enabled);
      localStorage.setItem('showNameEnabled', enabled ? 'true' : 'false');
  };

  const handleChangePin = () => {
     const currentAppPin = localStorage.getItem('appPin');
     if (oldPin !== currentAppPin) {
         setPinError('Старий пін-код неправильний. Введіть існуючий пароль.');
         return;
     }
     if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
         setPinError('Новий пін-код має містити 4 цифри');
         return;
     }
     localStorage.setItem('appPin', newPin);
     setShowChangePin(false);
     setOldPin('');
     setNewPin('');
     setPinError('');
     alert('Пін-код успішно змінено!');
  };

  useEffect(() => {
    if (auth.currentUser) {
      setEmail(auth.currentUser.email || '');
      setDisplayName(auth.currentUser.displayName || t('settings.unknownUser'));
      setPhotoURL(auth.currentUser.photoURL || '');
      
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.allowMessages !== undefined) {
            setAllowMessages(data.allowMessages);
          }
          setBannerUrl(data.bannerUrl || '');
          setBannerColor(data.bannerColor || '');
          setRegistrationMethod(data.registrationMethod || '');
          setUserPhone(data.phone || '');
        }
      });
    }
  }, [t]);

  const handleToggleAllowMessages = async () => {
    if (!auth.currentUser) return;
    const newValue = !allowMessages;
    setAllowMessages(newValue);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        allowMessages: newValue
      });
    } catch (error) {
      console.error("Error updating allowMessages:", error);
      setAllowMessages(!newValue); // revert on error
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL
      });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName,
        photoURL,
        bannerUrl,
        bannerColor
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Помилка оновлення профілю:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'A';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  };

  return (
    <div className="bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 px-6 h-[88px] flex items-center gap-4 transition-all">
        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-black tracking-tighter">
          {t('settings.title')}
        </h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-12 mt-6">
        <SummerItemDisplay section="settings" isAdmin={isAdmin} />
        
        {/* Profile Centered Layout */}
        <div className="flex flex-col items-center pt-8 space-y-5 relative">
          {/* Decorative glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-[60px] pointer-events-none" />
          
          <button 
            className="relative group cursor-pointer" 
            onClick={() => setShowEditData(true)}
          >
            <div className="w-32 h-32 bg-slate-100 dark:bg-[#111] rounded-[2.5rem] flex items-center justify-center shrink-0 overflow-hidden shadow-2xl border-4 border-white dark:border-white/10 transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-indigo-500/20 group-hover:rotate-3 relative z-10">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-5xl text-slate-400 font-bold">{getInitials(displayName)}</span>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center border-4 border-slate-50 dark:border-[#0a0a0a] shadow-xl group-hover:scale-110 transition-transform z-20">
              <Camera className="w-4 h-4 text-white" />
            </div>
          </button>
          <div className="text-center relative z-10 flex flex-col items-center">
             <div className="flex items-center gap-2 drop-shadow-md">
               <h2 className="text-3xl font-black tracking-tight">{displayName || t('settings.unknownUser')}</h2>
             </div>
             
             <div className="flex items-center justify-center gap-2 mt-2 bg-slate-100 dark:bg-[#111] border border-slate-200 dark:border-white/5 py-1.5 px-3 rounded-full">
               {registrationMethod === 'telegram_phone' ? (
                 <>
                   <Phone className="w-4 h-4 text-blue-500" />
                   <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{userPhone || email}</span>
                 </>
               ) : (
                 <>
                   <Mail className="w-4 h-4 text-slate-400" />
                   <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{email}</span>
                 </>
               )}
             </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4">
           <button 
              onClick={() => setShowEditData(true)}
              className="bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-all duration-300 shadow-xl hover:-translate-y-1 group"
           >
              <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all">
                 <User className="w-6 h-6" />
              </div>
              <span className="text-[15px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Особисті дані</span>
           </button>
           <button 
              onClick={() => {
                window.scrollTo({ top: 600, behavior: 'smooth' });
              }}
              className="bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-all duration-300 shadow-xl hover:-translate-y-1 group"
           >
              <div className="w-14 h-14 rounded-[1.25rem] bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-400 shadow-inner group-hover:scale-110 group-hover:-rotate-6 transition-all">
                 <Lock className="w-6 h-6" />
              </div>
              <span className="text-[15px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Безпека</span>
           </button>
        </div>

        {/* Account Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{t('settings.account')}</h3>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
          </div>
          
          <div className="bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-6 relative overflow-hidden">
            {isEditing && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">{t('settings.username')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                      <User className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('settings.username')}
                      className="w-full bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white placeholder-slate-400 rounded-[1.5rem] pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">{t('settings.avatarUrl')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                      <Camera className="w-5 h-5" />
                    </div>
                    <input
                      type="url"
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white placeholder-slate-400 rounded-[1.5rem] pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">{t('settings.bannerUrl')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                      <Image className="w-5 h-5" />
                    </div>
                    <input
                      type="url"
                      value={bannerUrl}
                      onChange={(e) => {
                        setBannerUrl(e.target.value);
                        if (e.target.value) setBannerColor('');
                      }}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white placeholder-slate-400 rounded-[1.5rem] pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">{t('settings.bannerColor')}</label>
                  <div className="flex flex-wrap gap-3 px-2">
                    {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#1A1A1A', '#ec4899', '#06b6d4'].map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          setBannerColor(color);
                          setBannerUrl('');
                        }}
                        className={`w-10 h-10 rounded-full border-2 transition-transform shadow-inner ${bannerColor === color ? 'border-white scale-125 shadow-lg' : 'border-transparent hover:scale-110'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:scale-110 transition-transform">
                      <input 
                        type="color" 
                        value={bannerColor.startsWith('#') ? bannerColor : '#3B82F6'} 
                        onChange={(e) => {
                          setBannerColor(e.target.value);
                          setBannerUrl('');
                        }}
                        className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer border-none p-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(auth.currentUser?.displayName || t('settings.unknownUser'));
                      setPhotoURL(auth.currentUser?.photoURL || '');
                    }}
                    className="flex-1 py-4 rounded-[1.5rem] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                  >
                    {t('settings.cancel')}
                  </button>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex-1 py-4 rounded-[1.5rem] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_10px_40px_rgba(79,70,229,0.5)] hover:-translate-y-1 flex items-center justify-center gap-2"
                  >
                    {isSaving ? t('settings.saving') : (
                      <>
                        <Save className="w-5 h-5" />
                        {t('settings.save')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">{t('settings.email')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full bg-slate-50/50 dark:bg-[#0a0a0a]/50 border border-slate-200 dark:border-white/5 text-slate-500 rounded-[1.5rem] pl-12 pr-4 py-4 outline-none cursor-not-allowed font-medium"
                  />
                </div>
                <p className="text-xs text-slate-400 px-2 mt-2">{t('settings.emailDesc')}</p>
              </div>
            )}

            <div className="h-px bg-slate-100 dark:bg-white/5 my-6" />

            <div className="flex items-center justify-between group">
              <div>
                <h4 className="font-bold text-[15px] text-slate-900 dark:text-white uppercase tracking-wide">{t('settings.allowMessages')}</h4>
                <p className="text-sm text-slate-500 mt-1">{t('settings.allowMessagesDesc')}</p>
              </div>
              <button 
                onClick={handleToggleAllowMessages}
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner shrink-0 ${allowMessages ? 'bg-indigo-500/20' : 'bg-slate-200 dark:bg-white/10'}`}
              >
                <div className={`w-6 h-6 bg-white dark:bg-slate-200 rounded-full absolute top-1 transition-transform shadow-md ${allowMessages ? 'translate-x-7 !bg-indigo-500' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Shield className="w-4 h-4" /> Безпека
            </h3>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
          </div>

          <div className="bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-2">
            
            <div className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors gap-4">
               <div className="flex flex-col">
                  <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Відбиток або обличчя</span>
                  <span className="text-sm text-slate-500 mt-0.5">Вхід за біометрією</span>
               </div>
               <button 
                onClick={() => handleBiometricsToggle(!biometricsEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative shrink-0 shadow-inner ${biometricsEnabled ? 'bg-emerald-500/20' : 'bg-slate-200 dark:bg-white/10'}`}
               >
                <div className={`w-6 h-6 bg-white dark:bg-slate-200 rounded-full absolute top-1 transition-transform shadow-md ${biometricsEnabled ? 'translate-x-7 !bg-emerald-500' : 'translate-x-1'}`} />
              </button>
            </div>

            <div 
              onClick={() => setShowChangePin(!showChangePin)}
              className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors cursor-pointer gap-4"
            >
               <div className="flex flex-col">
                  <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Змініть код-пароль</span>
                  <span className="text-sm text-slate-500 mt-0.5">Для входу у застосунок</span>
               </div>
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500">
                 <ChevronLeft className="w-5 h-5 rotate-180" />
               </div>
            </div>

            <div className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors gap-4">
               <div className="flex flex-col">
                  <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Запитувати код-пароль</span>
                  <span className="text-sm text-slate-500 mt-0.5">Безпечний вхід</span>
               </div>
               <button 
                onClick={() => handleTogglePin(!isPinEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative shrink-0 shadow-inner ${isPinEnabled ? 'bg-indigo-500/20' : 'bg-slate-200 dark:bg-white/10'}`}
               >
                <div className={`w-6 h-6 bg-white dark:bg-slate-200 rounded-full absolute top-1 transition-transform shadow-md ${isPinEnabled ? 'translate-x-7 !bg-indigo-500' : 'translate-x-1'}`} />
              </button>
            </div>

            <div 
              onClick={() => navigate('/notifications')}
              className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors cursor-pointer gap-4"
            >
               <div className="flex flex-col">
                  <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Сповіщення</span>
                  <span className="text-sm text-slate-500 mt-0.5">Типи повідомлень та їх кількість</span>
               </div>
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500">
                 <ChevronLeft className="w-5 h-5 rotate-180" />
               </div>
            </div>

            {/* Change PIN Dropdown */}
            {showChangePin && (
               <div className="mt-4 p-6 border border-slate-200 dark:border-white/5 rounded-[1.5rem] bg-white dark:bg-[#0a0a0a] shadow-inner animate-in slide-in-from-top-4 duration-300">
                  <h4 className="font-black text-lg mb-6 uppercase tracking-tight">Зміна Пін-коду</h4>
                  {pinError && <p className="text-red-500 text-sm mb-4 font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{pinError}</p>}
                  
                  <div className="space-y-5">
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">Поточний пін-код</label>
                        <input 
                           type="password" 
                           maxLength={4}
                           value={oldPin}
                           onChange={(e) => setOldPin(e.target.value)}
                           className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-4 py-4 outline-none font-mono tracking-[0.5em] text-xl focus:ring-2 focus:ring-indigo-500/50 transition-all text-center placeholder:text-slate-300 dark:placeholder:text-slate-700"
                           placeholder="••••"
                        />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">Новий пін-код</label>
                        <input 
                           type="password" 
                           maxLength={4}
                           value={newPin}
                           onChange={(e) => setNewPin(e.target.value)}
                           className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-4 py-4 outline-none font-mono tracking-[0.5em] text-xl focus:ring-2 focus:ring-indigo-500/50 transition-all text-center placeholder:text-slate-300 dark:placeholder:text-slate-700"
                           placeholder="••••"
                        />
                     </div>
                     <div className="flex gap-4 pt-4">
                        <button 
                           onClick={() => { setShowChangePin(false); setPinError(''); setOldPin(''); setNewPin(''); }}
                           className="flex-1 py-4 rounded-[1.25rem] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                        >
                           Скасувати
                        </button>
                        <button 
                           onClick={handleChangePin}
                           className="flex-1 py-4 rounded-[1.25rem] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg shadow-indigo-500/25"
                        >
                           Зберегти
                        </button>
                     </div>
                  </div>
               </div>
            )}

          </div>
        </section>

        {/* Interface Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Palette className="w-4 h-4" /> Інтерфейс
            </h3>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
          </div>
          
          <div className="bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-2">
            
            <div className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors gap-4">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[1rem] bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Ім'я у застосунку</span>
               </div>
               <button 
                onClick={() => handleToggleShowName(!showNameEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative shrink-0 shadow-inner ${showNameEnabled ? 'bg-blue-500/20' : 'bg-slate-200 dark:bg-white/10'}`}
               >
                <div className={`w-6 h-6 bg-white dark:bg-slate-200 rounded-full absolute top-1 transition-transform shadow-md ${showNameEnabled ? 'translate-x-7 !bg-blue-500' : 'translate-x-1'}`} />
              </button>
            </div>

            <div 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors cursor-pointer gap-4 group"
            >
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[1rem] bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Palette className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Тема</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-slate-500 font-bold bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-full">
                  {theme === 'dark' ? 'Темна' : 'Світла'}
                  <ChevronLeft className="w-4 h-4 rotate-180" />
               </div>
            </div>

            <div 
               onClick={() => setIsLanguageModalOpen(true)}
               className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors cursor-pointer gap-4 group"
            >
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[1rem] bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black group-hover:scale-110 transition-transform text-lg">
                    A
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Мова / Language</span>
                    <span className="text-[12px] text-slate-500 uppercase tracking-widest mt-0.5">{
                      language === 'uk' ? 'Українська' : 
                      language === 'en' ? 'English' : 
                      language === 'pl' ? 'Polski' : 
                      language === 'de' ? 'Deutsch' : language
                    }</span>
                  </div>
               </div>
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500">
                 <ChevronLeft className="w-5 h-5 rotate-180" />
               </div>
            </div>

            <div 
              onClick={() => setShowChangeFont(!showChangeFont)}
              className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors cursor-pointer gap-4 group"
            >
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[1rem] bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Type className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Свій шрифт</span>
                    <span className="text-[12px] text-slate-500 uppercase tracking-widest mt-0.5">Змінити шрифт сайту</span>
                  </div>
               </div>
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500">
                 <ChevronLeft className="w-5 h-5 rotate-180" />
               </div>
            </div>

            {/* Change Font Dropdown */}
            {showChangeFont && (
               <div className="mt-4 p-6 border border-slate-200 dark:border-white/5 rounded-[1.5rem] bg-white dark:bg-[#0a0a0a] shadow-inner animate-in slide-in-from-top-4 duration-300">
                  <h4 className="font-black text-lg mb-4 uppercase tracking-tight">Налаштування шрифту</h4>
                  <p className="text-sm text-slate-500 mb-6">Ви можете завантажити свій шрифт (до 2 МБ) або вказати його власноруч. Він буде застосований одразу.</p>
                  
                  <div className="space-y-5">
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">Завантажити файл (.ttf, .woff, .woff2)</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            id="customFontFileSettings"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) {
                                alert('Розмір файлу не повинен перевищувати 2MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const base64 = event.target?.result as string;
                                setTempUserFont(base64);
                                setTempUserFontName(file.name);
                              };
                              reader.readAsDataURL(file);
                            }}
                            accept=".ttf,.woff,.woff2,font/ttf,font/woff,font/woff2"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('customFontFileSettings')?.click()}
                            className="bg-slate-100 dark:bg-[#111] hover:bg-slate-200 dark:hover:bg-[#222] text-slate-700 dark:text-slate-300 px-4 py-3 rounded-xl font-bold flex flex-1 justify-center items-center gap-2 transition-colors border border-dashed border-slate-300 dark:border-slate-500"
                          >
                            <FileUp className="w-5 h-5" />
                            Оглянути файли
                          </button>
                        </div>
                     </div>
                     
                     {tempUserFontName && (
                       <div className="flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                         <span className="font-medium text-sm truncate">{tempUserFontName}</span>
                         <button
                           onClick={() => {
                             setTempUserFont('');
                             setTempUserFontName('');
                             localStorage.removeItem('userCustomFont');
                             localStorage.removeItem('userCustomFontName');
                             window.dispatchEvent(new Event('userFontChanged'));
                           }}
                           className="hover:bg-indigo-200 dark:hover:bg-indigo-800 p-1 rounded-full text-indigo-600 dark:text-indigo-400 transition-colors shrink-0"
                         >
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                     )}

                     <div className="flex gap-4 pt-4">
                        <button 
                           onClick={() => { setShowChangeFont(false); }}
                           className="flex-1 py-4 rounded-[1.25rem] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                        >
                           Закрити
                        </button>
                        <button 
                           onClick={() => {
                             localStorage.setItem('userCustomFont', tempUserFont);
                             localStorage.setItem('userCustomFontName', tempUserFontName);
                             window.dispatchEvent(new Event('userFontChanged'));
                             setShowChangeFont(false);
                           }}
                           className="flex-1 py-4 rounded-[1.25rem] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg shadow-indigo-500/25"
                        >
                           Застосувати
                        </button>
                     </div>
                  </div>
               </div>
            )}
            
            {/* Background Music */}
            <div 
              onClick={() => setShowMusicSettings(!showMusicSettings)}
              className="flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-[1.5rem] transition-colors cursor-pointer gap-4 group mt-4"
            >
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[1rem] bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] uppercase tracking-wide text-slate-900 dark:text-white">Фонова музика</span>
                    <span className="text-[12px] text-slate-500 uppercase tracking-widest mt-0.5">Встановити музику сайту</span>
                  </div>
               </div>
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500">
                 <ChevronLeft className={`w-5 h-5 transition-transform ${showMusicSettings ? '-rotate-90' : 'rotate-180'}`} />
               </div>
            </div>

            {/* Change Music Dropdown */}
            {showMusicSettings && (
               <div className="mt-4 p-6 border border-slate-200 dark:border-white/5 rounded-[1.5rem] bg-white dark:bg-[#0a0a0a] shadow-inner animate-in slide-in-from-top-4 duration-300">
                  <h4 className="font-black text-lg mb-4 uppercase tracking-tight">Налаштування музики</h4>
                  <p className="text-sm text-slate-500 mb-6">Завантажте свій аудіофайл (до 4 МБ) .mp3 або .wav. Музика буде програватися на фоні.</p>
                  
                  <div className="space-y-5">
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">Завантажити файл (.mp3, .wav)</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            id="customMusicFileSettings"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 4 * 1024 * 1024) {
                                alert('Розмір файлу не повинен перевищувати 4MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const base64 = event.target?.result as string;
                                setTempMusicFile(base64);
                                setTempMusicName(file.name);
                              };
                              reader.readAsDataURL(file);
                            }}
                            accept=".mp3,.wav,audio/mpeg,audio/wav"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('customMusicFileSettings')?.click()}
                            className="bg-slate-100 dark:bg-[#111] hover:bg-slate-200 dark:hover:bg-[#222] text-slate-700 dark:text-slate-300 px-4 py-3 rounded-xl font-bold flex flex-1 justify-center items-center gap-2 transition-colors border border-dashed border-slate-300 dark:border-slate-500"
                          >
                            <FileUp className="w-5 h-5" />
                            Оглянути файли
                          </button>
                        </div>
                     </div>
                     
                     {tempMusicName && (
                       <div className="flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                         <span className="font-medium text-sm truncate">{tempMusicName}</span>
                         <button
                           onClick={() => {
                             setTempMusicFile('');
                             setTempMusicName('');
                             localStorage.removeItem('bgMusic');
                             localStorage.removeItem('bgMusicName');
                             window.dispatchEvent(new Event('bgMusicChanged'));
                           }}
                           className="hover:bg-indigo-200 dark:hover:bg-indigo-800 p-1 rounded-full text-indigo-600 dark:text-indigo-400 transition-colors shrink-0"
                         >
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                     )}

                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2 px-2">
                           <Volume2 className="w-4 h-4" /> Гучність: {Math.round(tempMusicVolume * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={tempMusicVolume}
                          onChange={(e) => {
                            const newVol = parseFloat(e.target.value);
                            setTempMusicVolume(newVol);
                            localStorage.setItem('bgVolume', newVol.toString());
                            window.dispatchEvent(new Event('bgMusicVolumeChanged'));
                          }}
                          className="w-full accent-indigo-600"
                        />
                     </div>

                     <div className="flex gap-4 pt-4">
                        <button 
                           onClick={() => { setShowMusicSettings(false); }}
                           className="flex-1 py-4 rounded-[1.25rem] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                        >
                           Закрити
                        </button>
                        <button 
                           onClick={() => {
                             localStorage.setItem('bgMusic', tempMusicFile);
                             localStorage.setItem('bgMusicName', tempMusicName);
                             localStorage.setItem('bgVolume', tempMusicVolume.toString());
                             window.dispatchEvent(new Event('bgMusicChanged'));
                             window.dispatchEvent(new Event('bgMusicVolumeChanged'));
                             setShowMusicSettings(false);
                           }}
                           className="flex-1 py-4 rounded-[1.25rem] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg shadow-indigo-500/25"
                        >
                           Застосувати
                        </button>
                     </div>
                  </div>
               </div>
            )}
            
          </div>
        </section>

        {/* System Controls */}
        <section className="space-y-4 pt-6">
          <div className="bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-4 shadow-xl">
            <button 
               onClick={async () => {
                 await auth.signOut();
                 navigate('/');
               }}
               className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 rounded-[1.5rem] transition-colors text-slate-700 dark:text-white group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <span className="font-bold text-[15px] uppercase tracking-wide">Змінити користувача</span>
              </div>
            </button>
            
            <div className="h-px bg-slate-100 dark:bg-white/5 my-2 mx-4" />
            
            <button 
               onClick={async () => {
                 await auth.signOut();
                 navigate('/');
               }}
               className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 rounded-[1.5rem] transition-colors text-slate-700 dark:text-white group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                  <LogOut className="w-5 h-5 rotate-180 text-slate-500" />
                </div>
                <span className="font-bold text-[15px] uppercase tracking-wide">Вийти з акаунта</span>
              </div>
            </button>
          </div>
          
          <div className="bg-white dark:bg-[#111] border border-red-100 dark:border-red-500/20 rounded-[2.5rem] p-4 shadow-xl">
            <button 
               onClick={async () => {
                 if (window.confirm('Ви впевнені, що хочете видалити свій обліковий запис? Цю дію неможливо скасувати.')) {
                    if (auth.currentUser) {
                       try {
                          await auth.currentUser.delete();
                          navigate('/');
                       } catch (e: any) {
                          alert('Помилка: ' + e.message + '. Будь ласка, вийдіть і увійдіть знову перед видаленням.');
                       }
                    }
                 }
               }}
               className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/5 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-[1.5rem] transition-colors text-red-600 dark:text-red-500 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-red-500/20 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span className="font-bold text-[15px] uppercase tracking-wide">Видалити акаунт</span>
              </div>
            </button>
          </div>
        </section>

        <div className="text-center font-black text-[10px] text-slate-300 dark:text-slate-600 uppercase tracking-[0.4em] py-8">
          Vers. 2.330.06 <span className="mx-2">•</span> SkyTrack
        </div>

        {isAdmin && (
          <section className="space-y-4 pt-4 pb-12 border-t border-slate-200 dark:border-white/10">
            <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] text-center mb-6">Панель Адміністратора</h3>
            <button
              onClick={() => navigate('/admin')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest transition-all shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.4)] hover:-translate-y-1"
            >
              Відкрити консоль
            </button>
            {exitAdminMode && (
              <button
                onClick={() => {
                  exitAdminMode();
                  navigate('/');
                }}
                className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all"
              >
                {t('settings.exitAdmin')}
              </button>
            )}
          </section>
        )}
      </div>

      <LanguageModal isOpen={isLanguageModalOpen} onClose={() => setIsLanguageModalOpen(false)} />

      {showEditData && (
        <EditProfileModal
          onClose={() => setShowEditData(false)}
          currentDisplayName={displayName}
          currentPhotoURL={photoURL}
          onSave={async (name, photo) => {
            setDisplayName(name);
            setPhotoURL(photo);
            if (auth.currentUser) {
              try {
                await updateProfile(auth.currentUser, { displayName: name, photoURL: photo });
                await updateDoc(doc(db, 'users', auth.currentUser.uid), { displayName: name, photoURL: photo });
              } catch (e) {
                console.error(e);
              }
            }
          }}
        />
      )}
    </div>
  );
};
