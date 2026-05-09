import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { SummerEventConfig, SummerItem } from './SummerEventSettings';

interface SummerItemDisplayProps {
  section: string;
  isAdmin?: boolean;
}

export const SummerItemDisplay: React.FC<SummerItemDisplayProps> = ({ section, isAdmin }) => {
  const [config, setConfig] = useState<SummerEventConfig | null>(null);
  const [activeItem, setActiveItem] = useState<SummerItem | null>(null);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'already_claimed' | 'just_claimed'>('idle');
  const [showResult, setShowResult] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchConfigAndCheckClaim = async () => {
      if (!userId) return;

      try {
        const docRef = doc(db, 'settings', 'summerEvent');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as SummerEventConfig;
          setConfig(data);

          if (data.enabled) {
            const sectionItems = data.items.filter(item => item.section === section);
            if (sectionItems.length > 0) {
              const item = sectionItems[Math.floor(Math.random() * sectionItems.length)];
              
              const userEmail = auth.currentUser?.email || '';
              const emailChanceObj = item.emailChances?.find(ec => ec.email === userEmail);
              
              let chance = item.userChance;
              if (emailChanceObj) {
                chance = emailChanceObj.chance;
              } else if (isAdmin) {
                chance = item.adminChance;
              }

              const randomValue = Math.random() * 100;
              if (randomValue <= chance) {
                const q = query(
                  collection(db, 'summerClaims'), 
                  where('userId', '==', userId),
                  where('itemId', '==', item.id)
                );
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  setClaimStatus('already_claimed');
                } else {
                  setClaimStatus('idle');
                }
                setActiveItem(item);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching summer event config:", error);
      }
    };

    fetchConfigAndCheckClaim();
  }, [section, isAdmin, userId]);

  const handleClaim = async () => {
    if (!activeItem || !userId) return;

    if (claimStatus === 'already_claimed') {
      setShowResult(true);
      return;
    }

    setShowResult(true);
    try {
      await addDoc(collection(db, 'summerClaims'), {
        userId: userId,
        userName: auth.currentUser?.displayName || 'Невідомий',
        userEmail: auth.currentUser?.email || 'Без пошти',
        itemId: activeItem.id,
        section: activeItem.section,
        rewardText: activeItem.rewardText,
        timestamp: serverTimestamp()
      });
      setClaimStatus('just_claimed');
    } catch (error) {
      console.error("Error claiming summer item:", error);
      setShowResult(false);
    }
  };

  if (!activeItem) return null;

  return (
    <div className="w-full flex justify-center my-8">
      <AnimatePresence mode="wait">
        {!showResult ? (
          <motion.div
            key="unclaimed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="flex flex-col items-center justify-center cursor-pointer relative group"
            onClick={handleClaim}
          >
            <div className="relative">
              <img 
                src={activeItem.photoUrl} 
                alt="Summer Item" 
                className="w-48 md:w-64 rounded-md shadow-2xl hover:scale-105 transition-transform duration-300 object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  const originalUrl = activeItem.photoUrl;
                  if (originalUrl.startsWith('data:')) {
                    if (!img.src.includes('placehold.co')) {
                      img.src = `https://placehold.co/400x400/1a1a1a/orange?text=Item`;
                    }
                    return;
                  }
                  if (!img.src.includes('wsrv.nl') && !img.src.includes('placehold.co')) {
                    img.src = `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}`;
                  } else if (!img.src.includes('placehold.co')) {
                    img.src = `https://placehold.co/400x400/1a1a1a/orange?text=Item`;
                  }
                }}
              />
            </div>
            <p className="mt-4 text-sm text-gray-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Натисніть, щоб забрати!
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="claimed"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-orange-500 to-yellow-500 p-[2px] rounded-2xl shadow-2xl"
          >
            <div className="bg-white dark:bg-[#1A1A1A] px-8 py-6 rounded-[14px] flex flex-col items-center text-center max-w-sm">
              <span className="text-4xl mb-4">☀️</span>
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-orange-500">
                {claimStatus === 'already_claimed' ? 'Вже знайдено!' : 'Чудово!'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 font-medium mb-4">
                {claimStatus === 'already_claimed' 
                  ? 'Ви вже знаходили цей предмет раніше.' 
                  : 'Ви успішно знайшли цей літній предмет!'}
              </p>
              {activeItem.rewardText && (
                <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-xl w-full border border-orange-200 dark:border-orange-800">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {activeItem.rewardText}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
