import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SummerItemDisplay } from '../components/SummerItemDisplay';
import { DailyRoulette } from '../components/DailyRoulette';
import { SkyOperationQuest } from '../components/SkyOperationQuest';
import { SkyOperationDashboard } from '../components/SkyOperationDashboard';
import { CheckCircle2, Lock } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';

export const Event: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
  const { t } = useLanguage();
  const [showQuest, setShowQuest] = useState(false);
  const [questDone, setQuestDone] = useState(false);

  useEffect(() => {
    // Check local storage primarily for quick UI update
    if (localStorage.getItem('quest_sky2026_done') === 'true') {
      setQuestDone(true);
    }
    
    // Check DB to ensure sync
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        onSnapshot(doc(db, 'operation_sky_participants', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setQuestDone(true);
            localStorage.setItem('quest_sky2026_done', 'true');
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleQuestComplete = () => {
    localStorage.setItem('quest_sky2026_done', 'true');
    setQuestDone(true);
    setShowQuest(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto pt-8 px-4 pb-24 min-h-screen relative"
    >
      <div className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] left-0 w-[40rem] h-[40rem] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="mb-12 flex flex-col items-center text-center relative z-10">
        <motion.h1 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 tracking-tighter mb-4 drop-shadow-sm"
        >
          {t('event.headTitle')}
        </motion.h1>
        <motion.p 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[13px]"
        >
          {t('event.subtitle')}
        </motion.p>
      </div>

      {/* EVENT BANNER: Операція: Небо 2026 (ENDED) */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mb-14 rounded-[3rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgb(0,0,0,0.4)] relative group bg-[#0a0a0a] border border-white/10 transition-all duration-500 cursor-pointer backdrop-blur-md"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
        <img 
          src="https://images.unsplash.com/photo-1549429457-3f338d4c29c8?auto=format&fit=crop&q=80&w=1200" 
          alt="Operation Sky 2026" 
          className="w-full h-80 object-cover opacity-50 mix-blend-luminosity group-hover:opacity-70 group-hover:scale-110 transition-all duration-700" 
        />
        <div className="absolute inset-x-8 bottom-8 z-20 flex flex-col justify-end">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/50 border border-white/10 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <span className="text-white/60 text-xs font-black uppercase tracking-[0.2em] bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">{t('event.completed')}</span>
          </div>
          <h2 
            className="text-4xl font-black text-white mb-2 leading-none uppercase tracking-tight drop-shadow-md"
            dangerouslySetInnerHTML={{ __html: t('event.operationSky') }}
          />
        </div>
      </motion.div>
      
      <SummerItemDisplay section="event" isAdmin={isAdmin} />
      
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-16 bg-white/80 dark:bg-[#0a0a0a]/80 p-8 md:p-10 rounded-[3rem] border border-slate-200/50 dark:border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-3xl"
      >
        {/* Decorative ambient glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-center flex-col text-center gap-4 mb-8">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-500/20 rounded-[1.5rem] text-indigo-500 shadow-inner border border-indigo-100 dark:border-indigo-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight drop-shadow-sm">{t('event.boost')}</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">{t('event.getReward')}</p>
            </div>
          </div>
          <DailyRoulette />
        </div>
      </motion.div>

      <AnimatePresence>
        {showQuest && (
          <SkyOperationQuest 
            onClose={() => setShowQuest(false)} 
            onComplete={handleQuestComplete} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
