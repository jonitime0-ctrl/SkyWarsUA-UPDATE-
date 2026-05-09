import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ChevronRight, X, Mail } from 'lucide-react';

export const AccountFrozenBanner: React.FC<{ user: any }> = ({ user }) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatFeatureName = (id: string) => {
    const names: Record<string, string> = {
      gifts: 'Подарунки',
      titles: 'Титули та звання',
      verification: 'Верифікація',
      chat: 'Чати та повідомлення',
      profile_edit: 'Редагування профілю',
      avatar_upload: 'Зміна аватарки',
      community: 'Спільнота'
    };
    return names[id] || id;
  };

  return (
    <>
      <div 
        onClick={() => setShowDetails(true)}
        className="w-full shrink-0 bg-[#1C1C1E] border-b border-[#2C2C2E] cursor-pointer flex items-center justify-between px-4 py-3 hover:bg-[#2C2C2E] transition-colors shadow-md z-50"
      >
        <div className="flex flex-col">
          <span className="text-[#FF453A] font-bold text-[15px]">Ваш аккаунт заморожен</span>
          <span className="text-[#8E8E93] text-[13px] leading-tight mt-0.5">
            Нажмите, чтобы узнать подробности или оспорить ограничение.
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-[#8E8E93] shrink-0" />
      </div>

      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1C1C1E] border border-[#2C2C2E] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2C2E]">
                <h3 className="text-white font-bold text-[17px]">Деталі обмеження</h3>
                <button onClick={() => setShowDetails(false)} className="text-[#8E8E93] hover:text-white transition-colors bg-[#2C2C2E] p-1.5 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-5 overflow-y-auto max-h-[70vh]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6 text-[#FF453A]" />
                  </div>
                  <p className="text-[#E5E5EA] text-[15px] leading-tight">
                    Ваш обліковий запис було частково заморожено адміністратором. Ви можете користуватися базовим функціоналом, але деякі дії обмежені.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider mb-2">Причина заморозки</h4>
                    <div className="bg-[#000000] rounded-xl p-3 text-[#E5E5EA] text-[14px]">
                      {user.freezeReason || 'Порушення правил спільноти'}
                    </div>
                  </div>

                  {user.frozenFeatures && user.frozenFeatures.length > 0 && (
                     <div>
                       <h4 className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider mb-2">Обмежені функції</h4>
                       <ul className="bg-[#000000] rounded-xl overflow-hidden">
                         {user.frozenFeatures.map((f: string, i: number) => (
                           <li key={f} className={`px-4 py-3 text-[14px] text-[#E5E5EA] ${i !== user.frozenFeatures.length - 1 ? 'border-b border-[#1C1C1E]' : ''}`}>
                             <span className="inline-block w-2 h-2 rounded-full bg-[#FF453A] mr-2"></span>
                             {formatFeatureName(f)}
                           </li>
                         ))}
                       </ul>
                     </div>
                  )}
                </div>

                <div className="mt-8">
                  <a 
                    href="mailto:olegkucher2311@gmail.com?subject=Апеляція щодо заморозки акаунту" 
                    className="w-full flex items-center justify-center gap-2 bg-[#007AFF] hover:bg-[#005bb5] transition-colors text-white py-3.5 rounded-[14px] font-semibold text-[16px] shadow-sm"
                  >
                    <Mail className="w-5 h-5" />
                    Оскаржити через Email
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
