import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const LanguageModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { language, setLanguage, t } = useLanguage();
  
  const languages = [
    { id: 'uk', label: 'Українська', flag: '🇺🇦' },
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'pl', label: 'Polski', flag: '🇵🇱' },
    { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">{t('settings.language')}</h3>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              {languages.map(lang => (
                <button
                  key={lang.id}
                  onClick={() => {
                    setLanguage(lang.id as any);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-[1.5rem] transition-all ${
                    language === lang.id 
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 shadow-inner' 
                      : 'hover:bg-slate-50 dark:hover:bg-white/5 border-transparent'
                  } border`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{lang.flag}</span>
                    <span className={`font-bold text-[15px] uppercase tracking-wide ${
                      language === lang.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {lang.label}
                    </span>
                  </div>
                  {language === lang.id && (
                    <Check className="w-5 h-5 text-indigo-500" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
