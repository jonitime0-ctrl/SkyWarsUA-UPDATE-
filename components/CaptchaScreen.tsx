import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, RefreshCw, LogOut } from 'lucide-react';
import { logOut } from '../firebase';

interface CaptchaScreenProps {
  onVerify: () => void;
}

export const CaptchaScreen: React.FC<CaptchaScreenProps> = ({ onVerify }) => {
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [challengeMode, setChallengeMode] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(false);

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setInputValue('');
    setError(false);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleSimpleVerify = () => {
    setChecking(true);
    // 50% chance to require manual captcha typing
    const requireExtraChallenge = Math.random() > 0.5;
    
    setTimeout(() => {
      if (requireExtraChallenge) {
        setChecking(false);
        setChallengeMode(true);
      } else {
        setVerified(true);
        setTimeout(onVerify, 1000);
      }
    }, 1500);
  };

  const handleChallengeVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.toUpperCase() === captchaCode) {
        setChecking(true);
        setError(false);
        setTimeout(() => {
            setVerified(true);
            setTimeout(onVerify, 1000);
        }, 800);
    } else {
        setError(true);
        setInputValue('');
        generateCaptcha();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 z-50 fixed inset-0">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-8 text-center bg-blue-600 dark:bg-blue-900/20 border-b border-blue-500/20 relative">
          <button 
            onClick={() => logOut()}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors"
            title="Скасувати вхід"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 text-white mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider">Перевірка безпеки</h1>
          <p className="text-blue-100 dark:text-blue-300/70 text-sm mt-2">Будь ласка, підтвердіть, що ви людина</p>
        </div>

        <div className="p-8 flex flex-col items-center">
          {!challengeMode ? (
            <div 
              className={`w-full p-4 border-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                  verified 
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              onClick={!checking && !verified ? handleSimpleVerify : undefined}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 border-2 rounded flex items-center justify-center overflow-hidden transition-colors ${
                        verified ? 'border-green-500 bg-green-500' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 line-through decoration-slate-400/30'
                    }`}>
                        {checking && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                        {verified && (
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <span className="font-medium text-sm">Я не робот</span>
                </div>
                <div className="flex flex-col items-center opacity-70">
                    <ShieldCheck className="w-6 h-6 text-blue-500" />
                    <span className="text-[8px] font-bold mt-1 uppercase tracking-widest text-slate-400">SecureAuth</span>
                </div>
            </div>
          ) : (
            <form onSubmit={handleChallengeVerify} className="w-full flex flex-col gap-4">
               <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-2">Нам потрібно додаткове підтвердження.</p>
               
               <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl flex items-center justify-between">
                   <div 
                     className="font-mono text-2xl font-black text-slate-800 dark:text-slate-200 tracking-[0.5em] mx-auto select-none opacity-80 decoration-slate-500 line-through blur-[0.5px]"
                     style={{ WebkitUserSelect: 'none' }}
                   >
                       {captchaCode}
                   </div>
                   <button 
                     type="button" 
                     onClick={generateCaptcha}
                     className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                   >
                       <RefreshCw className="w-4 h-4" />
                   </button>
               </div>

               <div>
                 <input 
                   type="text" 
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   disabled={checking || verified}
                   placeholder="Введіть код з картинки"
                   className={`w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border text-center font-bold uppercase ${
                       error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
                   } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                   required
                 />
                 {error && <p className="text-xs text-red-500 text-center mt-2 font-medium">Неправильний код, спробуйте ще раз.</p>}
               </div>

               <button 
                type="submit"
                disabled={checking || verified || !inputValue}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors mt-2 flex items-center justify-center gap-2"
               >
                 {checking ? <RefreshCw className="w-5 h-5 animate-spin" /> : verified ? 'Підтверджено ✓' : 'Підтвердити'}
               </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
