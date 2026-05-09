import React, { useState, useEffect } from 'react';
import { ScanFace, Fingerprint } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const isWebAuthnAvailable = () => {
  return window.PublicKeyCredential !== undefined;
};

interface AuthLockScreenProps {
  onUnlock: () => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [mode, setMode] = useState<'setup1' | 'setup2' | 'prompt_biometrics' | 'lock' | 'blocked' | 'recovery'>('lock');
  const [error, setError] = useState('');
  
  const [failedAttempts, setFailedAttempts] = useState(() => parseInt(localStorage.getItem('pinAttempts') || '0'));
  const [blockUntil, setBlockUntil] = useState<number | null>(() => {
    const time = parseInt(localStorage.getItem('pinBlockUntil') || '0');
    return time > Date.now() ? time : null;
  });
  const [timeLeft, setTimeLeft] = useState(0);

  const [recoveryCode, setRecoveryCode] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');

  const biometricPref = localStorage.getItem('biometricPreference') || 'face';
  const BioIcon = biometricPref === 'fingerprint' ? Fingerprint : ScanFace;

  useEffect(() => {
    if (localStorage.getItem('isPinEnabled') === 'false') {
      onUnlock();
      return;
    }

    const savedPin = localStorage.getItem('appPin');
    if (!savedPin) {
      setMode('setup1');
    } else {
      if (blockUntil && blockUntil > Date.now()) {
        setMode('blocked');
      } else {
         if (localStorage.getItem('biometricsEnabled') === 'true') {
             handleBiometricUnlock();
         }
      }
    }
  }, []);

  useEffect(() => {
    if (blockUntil) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((blockUntil - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) {
          setBlockUntil(null);
          setMode('lock');
          setPin('');
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [blockUntil]);

  const blockAccountForever = async () => {
    if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            isPermanentlyBlocked: true,
            blockedReason: 'Failed PIN attempts'
        });
        window.location.reload();
    }
  };

  const handlePinSubmit = async (enteredPin: string) => {
    if (mode === 'setup1') {
        setSetupPin(enteredPin);
        setPin('');
        setMode('setup2');
    } else if (mode === 'setup2') {
        if (enteredPin === setupPin) {
            localStorage.setItem('appPin', enteredPin);
            if (isWebAuthnAvailable()) {
                setMode('prompt_biometrics');
            } else {
                onUnlock();
            }
        } else {
            setError('Пін-коди не співпадають');
            setPin('');
            setMode('setup1');
        }
    } else if (mode === 'lock') {
        const savedPin = localStorage.getItem('appPin');
        if (enteredPin === savedPin) {
            setFailedAttempts(0);
            localStorage.setItem('pinAttempts', '0');
            onUnlock();
        } else {
            const newAttempts = failedAttempts + 1;
            setFailedAttempts(newAttempts);
            localStorage.setItem('pinAttempts', newAttempts.toString());
            
            if (newAttempts === 3) {
                const blockTime = Date.now() + 5 * 60 * 1000;
                setBlockUntil(blockTime);
                localStorage.setItem('pinBlockUntil', blockTime.toString());
                setMode('blocked');
            } else if (newAttempts >= 4) {
                await blockAccountForever();
            } else {
                setError(`Неправильний пін-код. Спроба ${newAttempts}/3`);
                setPin('');
            }
        }
    }
  };

  const handlePadClick = (val: string) => {
    if (val === 'del') {
        setPin(prev => prev.slice(0, -1));
        setError('');
    } else if (val === 'bio') {
        handleBiometricUnlock();
    } else {
        if (pin.length < 4) {
            const newPin = pin + val;
            setPin(newPin);
            if (newPin.length === 4) {
                setTimeout(() => handlePinSubmit(newPin), 150);
            }
        }
    }
  };

  const setupBiometrics = async () => {
    if (!isWebAuthnAvailable()) {
        onUnlock();
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
        }
    } catch (err) {
        console.error("Biometrics setup failed", err);
    } finally {
        onUnlock();
    }
  };

  const handleBiometricUnlock = async () => {
    if (!isWebAuthnAvailable()) return;
    const savedId = localStorage.getItem('credentialId');
    if (!savedId) return;
    
    try {
        const rawId = new Uint8Array(savedId.split(',').map(Number));
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                allowCredentials: [{
                    id: rawId,
                    type: 'public-key',
                }],
                userVerification: "required",
                timeout: 60000,
            }
        });
        
        if (assertion) {
            setFailedAttempts(0);
            localStorage.setItem('pinAttempts', '0');
            onUnlock();
        }
    } catch (err) {
        console.error("Biometric unlock failed", err);
    }
  };

  const handleSendRecovery = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedCode(code);
    alert(`[СИМУЛЯЦІЯ ВІДПРАВКИ EMAIL]\nНа вашу пошту ${auth.currentUser?.email} відправлено лист.\nКод відновлення: ${code}`);
  };

  const handleVerifyRecovery = () => {
    if (recoveryCode === simulatedCode && simulatedCode !== '') {
        localStorage.removeItem('appPin');
        localStorage.removeItem('pinAttempts');
        localStorage.removeItem('pinBlockUntil');
        localStorage.removeItem('credentialId');
        localStorage.removeItem('biometricsEnabled');
        setFailedAttempts(0);
        setMode('setup1');
        setPin('');
        setRecoveryCode('');
        setSimulatedCode('');
        setError('');
    } else {
        setError('Неправильний код відновлення');
    }
  };

  if (mode === 'blocked') {
     return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-8 text-center overflow-hidden" 
             style={{ background: 'radial-gradient(circle at center, #3f0914 0%, #000000 100%)' }}>
            <h1 className="text-[22px] font-bold text-white mb-6 tracking-wide">Ваш аккаунт тимчасово заблоковано</h1>
            <p className="text-sm text-gray-200/90 mb-8 max-w-sm leading-relaxed">
                ваш аккаунт було заблоковано на {Math.ceil(timeLeft / 60) || 1} хвилин оскільки ви три рази вели неправильні пароль. наступний раз якщо видати неправильний пароль ваш аккаунт буде заблокований назавжди.
            </p>
            <div className="absolute bottom-16 left-0 right-0 flex justify-between px-8 text-sm">
               <button onClick={() => setMode('recovery')} className="text-white font-semibold opacity-90 hover:opacity-100">Забули пароль?</button>
               <button onClick={() => auth.signOut()} className="text-white font-semibold opacity-90 hover:opacity-100">Зареєструвати новий акаунт</button>
            </div>
        </div>
     );
  }

  if (mode === 'recovery') {
      return (
          <div className="fixed inset-0 z-[99999] bg-[#0B0F19] text-white flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-sm">
                  <button onClick={() => { setMode('lock'); setPin(''); }} className="mb-8 text-blue-500 font-medium tracking-wide">← Повернутись</button>
                  <h2 className="text-2xl font-bold mb-4 tracking-wide">Відновлення доступу</h2>
                  <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                      Ми надішлемо код підтвердження на вашу адресу<br/>
                      <span className="font-bold text-white tracking-wide">{auth.currentUser?.email}</span>
                  </p>
                  
                  {!simulatedCode ? (
                      <button 
                        onClick={handleSendRecovery}
                        className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold tracking-wide transition-colors"
                      >
                          Надіслати код на email
                      </button>
                  ) : (
                      <div className="flex flex-col gap-4">
                          <input 
                              type="text" 
                              placeholder="Введіть 6-значний код" 
                              value={recoveryCode}
                              onChange={(e) => setRecoveryCode(e.target.value)}
                              className="w-full bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 text-center text-xl tracking-[0.5em] font-bold focus:outline-none focus:border-blue-500 transition-colors"
                              maxLength={6}
                          />
                          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                          <button 
                            onClick={handleVerifyRecovery}
                            disabled={recoveryCode.length !== 6}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700/50 disabled:text-slate-400 py-4 rounded-2xl font-bold tracking-wide transition-colors"
                          >
                              Підтвердити код
                          </button>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  if (mode === 'prompt_biometrics') {
      return (
          <div className="fixed inset-0 z-[99999] bg-[#0B0F19] text-white flex flex-col items-center justify-center p-6">
              <BioIcon className="w-24 h-24 text-blue-500 mb-8" />
              <h2 className="text-2xl font-bold mb-4 tracking-wide text-center">Використовувати біометрію?</h2>
              <p className="text-gray-400 text-center mb-12 max-w-sm leading-relaxed">
                  Ви можете використовувати Face ID або Touch ID для швидкого розблокування застосунку наступного разу.
              </p>
              <div className="w-full max-w-sm flex flex-col gap-4">
                  <button onClick={setupBiometrics} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold tracking-wide transition-colors">
                      Увімкнути
                  </button>
                  <button onClick={onUnlock} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-bold tracking-wide transition-colors text-slate-300">
                      Пропустити
                  </button>
              </div>
          </div>
      );
  }

  const getHeaderText = () => {
      switch(mode) {
          case 'setup1': return 'Створіть пін-код';
          case 'setup2': return 'Повторіть пін-код';
          case 'lock': return 'Введіть пін-код';
          default: return '';
      }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#000000] text-white flex flex-col items-center justify-center">
        <h2 className="text-xl font-medium mt-12 mb-8 tracking-wider">{getHeaderText()}</h2>
        
        <div className="flex gap-6 mb-16">
            {[0, 1, 2, 3].map((i) => (
                <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        i < pin.length ? 'bg-white border-white' : 'border-slate-500/50'
                    }`}
                />
            ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-6 -mt-10 animate-bounce">{error}</p>}

        <div className="grid grid-cols-3 gap-x-12 gap-y-6 max-w-[320px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button 
                  key={num}
                  onClick={() => handlePadClick(num)}
                  className="w-20 h-20 rounded-full bg-slate-800/40 hover:bg-slate-700/60 active:bg-slate-600 flex items-center justify-center text-4xl hover:opacity-100 font-light transition-all"
                >
                    {num}
                </button>
            ))}
            
            <div className="flex items-center justify-center">
                {mode === 'lock' && localStorage.getItem('biometricsEnabled') === 'true' && (
                    <button onClick={() => handlePadClick('bio')} className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <BioIcon className="w-8 h-8" />
                    </button>
                )}
            </div>
            
            <button 
                onClick={() => handlePadClick('0')}
                className="w-20 h-20 rounded-full bg-slate-800/40 hover:bg-slate-700/60 active:bg-slate-600 flex items-center justify-center text-4xl font-light transition-all"
            >
                0
            </button>
            
            <div className="flex items-center justify-center">
                <button onClick={() => handlePadClick('del')} className="w-16 h-16 rounded-full flex items-center flex-col justify-center text-slate-400 hover:text-white transition-colors">
                    <span className="text-[16px] tracking-wide font-medium">Скасувати</span> 
                </button>
            </div>
        </div>

        {mode === 'lock' && (
            <div className="absolute bottom-12 flex items-center gap-1">
               <button onClick={() => setMode('recovery')} className="text-sm font-semibold text-white/70 tracking-wide hover:text-white">Забули пароль?</button>
            </div>
        )}
    </div>
  );
};
