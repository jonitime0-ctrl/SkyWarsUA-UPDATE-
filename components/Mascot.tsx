import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const Mascot = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show mascot once on mount
    setIsVisible(true);
    // Hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          {/* SVG Teddy Bear */}
          <div className="relative pointer-events-auto">
            <svg width="150" height="150" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 30c-30 0-50 20-50 50s20 50 50 50 50-20 50-50-20-50-50-50z" fill="#D2A679" stroke="#8B5A2B" strokeWidth="4"/>
              <circle cx="75" cy="70" r="8" fill="#333"/>
              <circle cx="125" cy="70" r="8" fill="#333"/>
              <path d="M90 90h20l-10 15z" fill="#333"/>
              <path d="M85 105c30 0 30 15 0 15" stroke="#333" strokeWidth="3" fill="none"/>
              <circle cx="65" cy="35" r="20" fill="#D2A679" stroke="#8B5A2B" strokeWidth="4"/>
              <circle cx="135" cy="35" r="20" fill="#D2A679" stroke="#8B5A2B" strokeWidth="4"/>
              <path d="M40 120c-50 0-40 60 0 60" fill="#D2A679" stroke="#8B5A2B" strokeWidth="4"/>
              <path d="M160 120c50 0 40 60 0 60" fill="#D2A679" stroke="#8B5A2B" strokeWidth="4"/>
              <ellipse cx="100" cy="150" rx="40" ry="50" fill="#D2A679" stroke="#8B5A2B" strokeWidth="4"/>
            </svg>
            <motion.div
              animate={{ rotate: [0, 20, -20, 20, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute -top-6 -right-6 text-4xl"
            >
              👋
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
