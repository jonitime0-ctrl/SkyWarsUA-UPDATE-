import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Shield, Crosshair, CheckCircle2, Radar, X, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { playTyping, playError, playRadarTick, playLock, playSuccess } from '../lib/sounds';

interface SkyOperationQuestProps {
  onClose: () => void;
  onComplete: () => void;
}

export const SkyOperationQuest: React.FC<SkyOperationQuestProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(0);

  // --- STEP 0: AUTHENTICATION ---
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);

  const handleCodeSubmit = () => {
    if (code === '2026') {
      setCodeError(false);
      playSuccess();
      setStep(1);
    } else {
      playError();
      setCodeError(true);
      setTimeout(() => setCodeError(false), 800);
    }
  };

  // --- STEP 1: CALIBRATION ---
  const [frequency, setFrequency] = useState(50);
  const isFreqCorrect = frequency >= 103 && frequency <= 105;

  // --- STEP 2: RADAR LOCK ---
  const [dotPos, setDotPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 2) {
      interval = setInterval(() => {
        playRadarTick();
        setDotPos({
          x: 10 + Math.random() * 80,
          y: 10 + Math.random() * 80,
        });
      }, 750); // Jumps every 750ms
    }
    return () => clearInterval(interval);
  }, [step]);

  const generateCallsign = () => {
    const prefixes = ['ФАНТОМ', 'СОКІЛ', 'БАРС', 'ВІТЕР', 'ГРІМ', 'ТІНЬ', 'МЕЧ', 'КАБАН', 'ВОВК', 'ОРЕЛ'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(Math.random() * 99) + 1;
    return `${prefix}-${number}`;
  };

  const [isFinishing, setIsFinishing] = useState(false);

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    playSuccess();
    try {
      if (auth.currentUser) {
        await setDoc(doc(db, 'operation_sky_participants', auth.currentUser.uid), {
           callsign: generateCallsign(),
           score: 0,
           tasks: {
             telegram_sub: false,
             invites: 0,
             test_passed: false
           },
           dailyCiphersDone: [],
           joinedAt: serverTimestamp(),
           lastActive: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
    }
    setIsFinishing(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#050505]/90 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-[#0a0a0a] border border-indigo-500/30 shadow-[0_0_80px_rgba(79,70,229,0.15)] rounded-3xl overflow-hidden relative z-10 flex flex-col"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white/60 font-mono text-xs uppercase tracking-widest">
              Secured Connection // Node 0x7F
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-10 flex-1 relative overflow-hidden min-h-[400px] flex items-center justify-center">
          
          <AnimatePresence mode="wait">
            
            {/* --- PHASE 0: AUTHENTICATION --- */}
            {step === 0 && (
              <motion.div 
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-md mx-auto space-y-8"
              >
                <div className="flex flex-col items-center text-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase">Автентифікація</h2>
                    <p className="text-slate-400 text-sm mt-2 font-mono leading-relaxed">
                      Увага, оператор. Система переведена у режим бойової готовності. Введіть рік операції для доступу.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500/50" />
                    <input 
                      type="text" 
                      maxLength={4}
                      value={code}
                      onChange={(e) => { 
                         playTyping(); 
                         setCode(e.target.value.replace(/\D/g, '')); 
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                      placeholder="Введіть код..."
                      className={`w-full bg-[#111] border ${codeError ? 'border-red-500 text-red-400' : 'border-indigo-500/30 text-white'} rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-center tracking-[0.5em] text-xl`}
                    />
                  </div>
                  <button 
                    onClick={handleCodeSubmit}
                    disabled={code.length < 4}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold uppercase tracking-widest py-4 rounded-xl transition-all active:scale-[0.98]"
                  >
                    Перевірка доступу
                  </button>
                </div>
              </motion.div>
            )}

            {/* --- PHASE 1: RADAR CALIBRATION --- */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-md mx-auto space-y-8"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                    <Radar className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase">Калібрування РЛС</h2>
                    <p className="text-slate-400 text-xs mt-2 font-mono leading-relaxed">
                      Виявлено перешкоди в ефірі. Синхронізуйте приймач частот. Цільова частота: <span className="text-orange-400 font-bold">104.0 МГц</span>.
                    </p>
                  </div>
                </div>

                <div className="bg-[#111] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px)] bg-[size:20px] pointer-events-none" />
                  
                  <div className="flex justify-between items-end mb-4 font-mono text-xs text-slate-500">
                    <span>80 МГц</span>
                    <span className={`text-2xl font-black ${isFreqCorrect ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {frequency.toFixed(1)} МГц
                    </span>
                    <span>120 МГц</span>
                  </div>

                  <input 
                    type="range" 
                    min="80" 
                    max="120" 
                    step="0.1"
                    value={frequency}
                    onChange={(e) => setFrequency(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 relative z-10"
                  />

                  <div className="mt-6 flex justify-center">
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${isFreqCorrect ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                      {isFreqCorrect ? 'СИГНАЛ ЗАХОПЛЕНО' : 'ШУМ В ЕФІРІ'}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setStep(2)}
                  disabled={!isFreqCorrect}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(234,88,12,0.2)]"
                >
                  Продовжити
                </button>
              </motion.div>
            )}

            {/* --- PHASE 2: TARGET LOCK --- */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                      <Crosshair className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">Перехоплення Цілі</h2>
                      <p className="text-slate-400 text-[10px] font-mono leading-none mt-1">
                        ШВИДКІСТЬ МАХ 0.8 // ВИСОТА 15М
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-red-500/20 border border-red-500/50 rounded text-red-400 font-mono text-[10px] uppercase font-bold animate-pulse">
                    ВИЯВЛЕНО РУХ
                  </div>
                </div>

                <div className="w-full h-72 sm:h-80 bg-[#050505] border border-red-500/30 rounded-2xl relative overflow-hidden group">
                  {/* Grid overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ef444415_1px,transparent_1px),linear-gradient(to_bottom,#ef444415_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
                  {/* Radar sweep */}
                  <div className="absolute top-1/2 left-1/2 w-full h-full border-t border-red-500/50 origin-top-left animate-[spin_4s_linear_infinite] pointer-events-none -mt-[1px] -ml-[1px]" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#000_100%)] pointer-events-none" />

                  {/* Aiming texts */}
                  <span className="absolute top-4 left-4 text-red-500/50 font-mono text-[10px]">LAT 48.3794</span>
                  <span className="absolute bottom-4 right-4 text-red-500/50 font-mono text-[10px]">LNG 31.1656</span>

                  <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 font-bold uppercase tracking-[0.5em] pointer-events-none text-xl sm:text-3xl text-center leading-none">
                    CLICK TO<br/>LOCK
                  </p>

                  <button
                    onClick={() => { playLock(); setStep(3); }}
                    className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex flex-col items-center justify-center group/dot focus:outline-none"
                    style={{ left: `${dotPos.x}%`, top: `${dotPos.y}%`, transition: 'all 0.5s ease-out' }}
                  >
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
                    <div className="w-3 h-3 bg-red-500 rounded-full relative z-10" />
                    <div className="absolute inset-[-10px] border border-red-500/0 rounded-full group-hover/dot:border-red-500 transition-colors" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* --- PHASE 3: SUCCESS --- */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full text-center space-y-8"
              >
                <div className="relative inline-flex">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                  <div className="w-24 h-24 rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 relative z-10">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                </div>
                
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tight uppercase mb-4">ДОСТУП НАДАНО</h2>
                  <p className="text-emerald-400/80 font-mono text-sm leading-relaxed max-w-md mx-auto">
                    Вітаємо, оператор. Всі системи синхронізовано.
                    Вас зараховано до складу елітного споттинг-підрозділу.
                  </p>
                </div>

                <div className="pt-8 flex justify-center">
                  <button 
                    onClick={handleFinish}
                    disabled={isFinishing}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 disabled:text-emerald-950 text-emerald-950 font-black uppercase tracking-[0.2em] px-10 py-5 rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                  >
                    ПОЧАТИ ОПЕРАЦІЮ
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer indicators */}
        <div className="bg-white/5 border-t border-white/5 p-4 flex gap-2 justify-center shrink-0">
          {[0, 1, 2].map((i) => (
            <div 
              key={i} 
              className={`w-12 h-1.5 rounded-full transition-all ${
                i < step ? 'bg-emerald-500' : i === step ? 'bg-indigo-500' : 'bg-white/10'
              }`} 
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
