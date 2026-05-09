import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { User as UserIcon, Search, Bell, Aperture, Layers, Bot, Target, MessageSquare, Gift, Store } from 'lucide-react';
import { motion } from 'motion/react';
import { BackButton } from './BackButton';
import { Theme } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  theme: Theme;
  toggleTheme: () => void;
  isAdmin: boolean;
  brightness: number;
  navPosition: 'top' | 'bottom';
}

export const Layout: React.FC<LayoutProps> = ({ theme, toggleTheme, isAdmin, brightness, navPosition }) => {
  const { t } = useLanguage();
  const location = useLocation();

  const navItems = [
    { to: '/community', icon: <Layers className="w-5 h-5 md:w-6 md:h-6" />, label: t('nav.community') },
    { to: '/store', icon: <Store className="w-5 h-5 md:w-6 md:h-6" />, label: 'Магазин' },
    { to: '/search', icon: <Search className="w-5 h-5 md:w-6 md:h-6" />, label: t('nav.search') },
    { to: '/event', icon: <Target className="w-5 h-5 md:w-6 md:h-6" />, label: t('nav.event') },
    { to: '/', icon: <Aperture className="w-7 h-7 md:w-8 md:h-8" />, label: t('nav.dashboard'), isSpecial: true },
    { to: '/gifts', icon: <Gift className="w-5 h-5 md:w-6 md:h-6" />, label: t('nav.gifts') },
    { to: '/notifications', icon: <Bell className="w-5 h-5 md:w-6 md:h-6" />, label: t('nav.notifications') },
    { to: '/profile', icon: <UserIcon className="w-5 h-5 md:w-6 md:h-6" />, label: t('nav.profile') },
  ];

  return (
    <div className={`relative flex-1 min-h-0 overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-[#F4F4F4] text-[#1A1A1A]'}`} style={{ filter: `brightness(${brightness})` }}>
      
      <button 
        onClick={toggleTheme}
        className="fixed bottom-28 right-4 z-[60] p-3 rounded-full bg-slate-900/80 dark:bg-white/10 backdrop-blur-xl border border-white/10 text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {navPosition === 'top' && (
        <nav className={`
          w-full shrink-0
          backdrop-blur-xl
          flex items-center justify-around py-3 px-2
          transition-colors duration-300
          z-50
          ${theme === 'dark' ? 'bg-[#111111]/90 border-b border-white/10' : 'bg-white/70 border-b border-black/10'}
        `}>
          {navItems.map((item) => {
            const isActiveClass = theme === 'dark'
              ? 'text-white font-bold bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)] scale-110'
              : 'text-black font-bold bg-black/5 shadow-[0_0_15px_rgba(0,0,0,0.05)] scale-110';
              
            const isInactiveClass = theme === 'dark'
              ? 'text-[#888888] hover:text-white hover:bg-white/5 hover:scale-105'
              : 'text-slate-500 hover:text-black hover:bg-black/5 hover:scale-105';

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `
                  flex flex-col items-center justify-center gap-1
                  p-2 rounded-xl transition-all duration-300
                  ${isActive ? isActiveClass : isInactiveClass}
                  ${item.isSpecial ? '-mt-4' : ''}
                `}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative flex flex-col pb-24">
        <div className="p-4 md:p-8 max-w-5xl mx-auto w-full flex-grow">
          <BackButton />
          <Outlet />
        </div>
        
        {/* Footer Configuration */}
        <footer className="w-full shrink-0 py-6 mt-8 border-t border-slate-500/10 text-center flex flex-col items-center justify-center opacity-70 relative z-[-1]">
           <p className="text-xs font-mono tracking-wider opacity-80 uppercase">{t('footer.rights')} 1.0.2</p>
        </footer>
      </main>

      {navPosition === 'bottom' && (
        <div className="absolute bottom-4 left-0 right-0 z-50 flex justify-center w-full px-2 pointer-events-none">
          <nav className={`
            pointer-events-auto
            flex items-center justify-between
            p-2 rounded-3xl
            backdrop-blur-2xl shadow-2xl
            w-full max-w-[420px] mx-auto
            border ${theme === 'dark' ? 'bg-[#0a0a0a]/80 border-white/10 shadow-black/50' : 'bg-white/80 border-black/5 shadow-indigo-500/10'}
          `}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              const isSpecial = item.isSpecial;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`
                    relative flex flex-col items-center justify-center
                    w-12 h-12 md:w-14 md:h-14 rounded-2xl
                    transition-all duration-300
                    ${isSpecial ? '-mt-8 bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/30 border-2 border-transparent' : ''}
                    ${!isSpecial && !isActive ? (theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800') : ''}
                    ${!isSpecial && isActive ? (theme === 'dark' ? 'text-white' : 'text-slate-900') : ''}
                    group
                  `}
                >
                  {!isSpecial && isActive && (
                    <motion.div
                      layoutId="activeTabBackground"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30
                      }}
                      className={`absolute inset-0 rounded-2xl -z-10 ${theme === 'dark' ? 'bg-white/10 border border-white/5 shadow-inner' : 'bg-slate-100 border border-slate-200/50 shadow-sm'}`}
                    />
                  )}

                  <motion.div
                    whileHover={{ scale: isSpecial ? 1.05 : 1.15, y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    className={`flex flex-col items-center justify-center gap-1 z-10`}
                  >
                    {React.cloneElement(item.icon as React.ReactElement, {
                      className: `${isSpecial ? 'w-6 h-6 md:w-7 md:h-7' : 'w-5 h-5 md:w-6 md:h-6'} transition-transform duration-300`
                    })}
                    {!isSpecial && (
                      <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 xl:opacity-100'}`}>
                        {item.label}
                      </span>
                    )}
                  </motion.div>
                </NavLink>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
};
