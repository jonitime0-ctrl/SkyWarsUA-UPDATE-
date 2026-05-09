import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ExternalLink, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { auth } from '../firebase';

export interface SunsetConfig {
  blockMessage?: string;
  blockImage?: string;
  blockImages?: string[];
  blockLink?: string;
}

export const SunsetScreen: React.FC<{ config?: SunsetConfig; onLogoClick?: () => void; onSignOut?: () => void }> = ({ config, onLogoClick, onSignOut }) => {
  const displayImages = config?.blockImages?.length 
    ? config.blockImages 
    : (config?.blockImage ? [config.blockImage] : []);
    
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (displayImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % displayImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [displayImages.length]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx(prev => (prev + 1) % displayImages.length);
  };
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx(prev => (prev - 1 + displayImages.length) % displayImages.length);
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-[#050505] text-white overflow-hidden relative">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-600/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-orange-600/10 rounded-full blur-[120px]" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative z-10 flex flex-col items-center"
      >
        {displayImages.length > 0 ? (
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 mb-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.2, duration: 0.7, type: 'spring' }}
              onClick={onLogoClick}
              className="w-full h-full rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.3)] border border-white/10 relative cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
              <AnimatePresence mode="wait">
                <motion.img 
                  key={currentIdx}
                  src={displayImages[currentIdx]} 
                  alt="Block Avatar" 
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 w-full h-full object-cover" 
                />
              </AnimatePresence>

              {displayImages.length > 1 && (
                <>
                  <div className="absolute inset-y-0 left-0 w-1/3 z-20 flex items-center justify-start p-2" onClick={handlePrev}>
                     <div className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 md:opacity-50 transition-opacity">
                        <ChevronLeft className="w-5 h-5 text-white" />
                     </div>
                  </div>
                  <div className="absolute inset-y-0 right-0 w-1/3 z-20 flex items-center justify-end p-2" onClick={handleNext}>
                     <div className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 md:opacity-50 transition-opacity">
                        <ChevronRight className="w-5 h-5 text-white" />
                     </div>
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5 flex-wrap px-4">
                    {displayImages.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} 
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            onClick={onLogoClick}
            className="w-28 h-28 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl backdrop-blur-xl relative cursor-pointer"
          >
            <div className="absolute inset-0 bg-red-500/20 rounded-[2.5rem] blur-xl" />
            <AlertCircle className="w-12 h-12 text-red-500 relative z-10" />
          </motion.div>
        )}

        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-4xl sm:text-5xl font-black mb-6 tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50"
        >
          Сервіс зупинено
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-slate-300 text-[16px] sm:text-[18px] leading-relaxed mb-10 font-medium px-4 text-center max-w-sm"
        >
          {config?.blockMessage || 'Прийнято рішення про поступове завершення функціонування сервісу. Детальнішу інформацію можна переглянути:'}
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full flex flex-col gap-4 items-center"
        >
          <a 
            href={config?.blockLink || "https://t.me/ppdodatok/41"}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-sm flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-black font-black py-4 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-1 group uppercase tracking-widest text-[13px]"
          >
            <span>Докладніше</span>
            <ExternalLink className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>

          <button 
            onClick={() => {
              auth.signOut();
              if (onSignOut) onSignOut();
            }}
            className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-2 px-4 py-2"
          >
            <LogOut className="w-4 h-4" />
            Вийти з акаунта
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};
