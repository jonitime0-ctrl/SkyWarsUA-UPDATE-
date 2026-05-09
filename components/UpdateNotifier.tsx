import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

export const UpdateNotifier = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // У продакшені Vite додає хеш до скрипта (наприклад, /assets/index-D8gH_m.js)
        const currentScript = document.querySelector('script[type="module"][src^="/assets/index-"]');
        if (!currentScript) return; // У режимі розробника ігноруємо

        const currentSrc = currentScript.getAttribute('src');

        // Запитуємо свіжий index.html з сервера, уникаючи кешування
        const response = await fetch('/?cache-bust=' + Date.now(), { cache: 'no-store' });
        const html = await response.text();
        
        // Створюємо віртуальний DOM для парсингу нового html
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newScript = doc.querySelector('script[type="module"][src^="/assets/index-"]');
        
        if (newScript) {
          const newSrc = newScript.getAttribute('src');
          // Якщо хеш змінився — версія нова!
          if (currentSrc && newSrc && currentSrc !== newSrc) {
            setUpdateAvailable(true);
          }
        }
      } catch (error) {
        console.error('Помилка при перевірці оновлень:', error);
      }
    };

    // Перевіряємо через 10 секунд після завантаження програми
    const initialTimeout = setTimeout(checkForUpdates, 10000);
    
    // І далі кожні 5 хвилин
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = () => {
    // Очищаємо всі кеші браузера для цього сайту
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => caches.delete(name));
      });
    }
    // Форсовано перезавантажуємо сторінку з новим параметром, щоб обійти локальний кеш
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[99999] backdrop-blur-sm"
            onClick={() => setUpdateAvailable(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 z-[100000] w-[90%] max-w-sm bg-gradient-to-r from-blue-700 to-indigo-800 rounded-[2rem] p-5 shadow-2xl flex flex-col items-center text-center border border-blue-400/20"
          >
            <div className="flex items-center gap-3 text-white mb-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              >
                <RefreshCw className="w-6 h-6 text-blue-300" />
              </motion.div>
              <h3 className="font-bold text-lg tracking-wide">Доступне Оновлення</h3>
            </div>
            <p className="text-blue-100 text-sm mb-5 leading-relaxed">
              Ми випустили нову версію застосунку з новими функціями та виправленнями. Оновіть сторінку, щоб продовжити.
            </p>
            <button
              onClick={handleUpdate}
              className="w-full bg-white text-blue-700 font-bold py-3.5 rounded-2xl hover:bg-blue-50 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-[0.98]"
            >
              Оновити зараз
            </button>
            <button 
              onClick={() => setUpdateAvailable(false)}
              className="mt-4 text-white/50 hover:text-white text-xs font-medium uppercase tracking-wider transition-colors"
            >
              Відкласти на потім
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
