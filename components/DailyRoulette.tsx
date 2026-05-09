import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { RouletteConfig, RouletteItem } from './RouletteSettings';
import { Dices } from 'lucide-react';

export const DailyRoulette: React.FC = () => {
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RouletteItem | null>(null);
  const [timeUntilNextSpin, setTimeUntilNextSpin] = useState<string>('');
  
  const rouletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConfigAndStatus = async () => {
      if (!auth.currentUser) return;

      try {
        // Fetch config
        const docRef = doc(db, 'settings', 'roulette');
        const docSnap = await getDoc(docRef);
        let currentConfig: RouletteConfig | null = null;
        
        if (docSnap.exists()) {
          currentConfig = docSnap.data() as RouletteConfig;
          setConfig(currentConfig);
        }

        if (currentConfig?.enabled) {
          // Check last spin
          const q = query(
            collection(db, 'rouletteSpins'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('timestamp', 'desc'),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const lastSpin = querySnapshot.docs[0].data();
            const lastSpinTime = lastSpin.timestamp?.toDate() || new Date(0);
            const now = new Date();
            const diffHours = (now.getTime() - lastSpinTime.getTime()) / (1000 * 60 * 60);
            
            if (diffHours >= 24) {
              setCanSpin(true);
            } else {
              setCanSpin(false);
              // Calculate time remaining
              const nextSpinTime = new Date(lastSpinTime.getTime() + 24 * 60 * 60 * 1000);
              const updateRemainingTime = () => {
                const currentNow = new Date();
                const diffMs = nextSpinTime.getTime() - currentNow.getTime();
                if (diffMs <= 0) {
                  setCanSpin(true);
                  setTimeUntilNextSpin('');
                } else {
                  const h = Math.floor(diffMs / (1000 * 60 * 60));
                  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                  setTimeUntilNextSpin(`${h}г ${m}хв`);
                }
              };
              updateRemainingTime();
              const interval = setInterval(updateRemainingTime, 60000);
              return () => clearInterval(interval);
            }
          } else {
            setCanSpin(true);
          }
        }
      } catch (error) {
        console.error("Error fetching roulette data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigAndStatus();
  }, []);

  const spinRoulette = async () => {
    if (!canSpin || !config || spinning || !auth.currentUser) return;

    setSpinning(true);
    setResult(null);

    // Determine winner based on chances
    const totalChance = config.items.reduce((sum, item) => sum + item.chance, 0);
    let random = Math.random() * totalChance;
    let winningItem = config.items[0];

    for (const item of config.items) {
      if (random < item.chance) {
        winningItem = item;
        break;
      }
      random -= item.chance;
    }

    // Visual spinning logic
    // We'll create a long array of items to scroll through
    const spinItems = [];
    for (let i = 0; i < 50; i++) {
      spinItems.push(config.items[Math.floor(Math.random() * config.items.length)]);
    }
    // Ensure the winning item is near the end
    spinItems[45] = winningItem;

    // We'll just simulate a delay for the animation
    setTimeout(async () => {
      setResult(winningItem);
      setSpinning(false);
      setCanSpin(false);

      // Save to DB
      try {
        await addDoc(collection(db, 'rouletteSpins'), {
          userId: auth.currentUser?.uid,
          userName: auth.currentUser?.displayName || 'Невідомий',
          userEmail: auth.currentUser?.email || 'Без пошти',
          prizeName: winningItem.name,
          prizeType: winningItem.type,
          prizeValue: winningItem.value,
          timestamp: serverTimestamp()
        });
        
        // Start countdown
        setTimeUntilNextSpin('23г 59хв');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'rouletteSpins');
      }
    }, 3000); // 3 seconds spin
  };

  if (loading || !config?.enabled) return null;

  return (
    <div className="bg-[#0F172A] rounded-[2rem] p-8 shadow-2xl border border-slate-800 relative overflow-hidden my-8">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4 text-white flex items-center gap-3">
          Щоденна Рулетка
        </h2>
        <p className="text-slate-300 mb-8 max-w-md mx-auto">
          Крути рулетку кожен день і вигравай подарунки в телеграм, або знижки на них. Подивися на свою удачу прямо зараз!
        </p>

        {/* Roulette Wheel Area */}
        <div className="w-full max-w-lg mb-8 relative">
          {/* Selection Pointer */}
          <div className="absolute left-1/2 -top-3 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[15px] border-t-emerald-500 z-20"></div>
          <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[15px] border-b-emerald-500 z-20"></div>

          <div className="bg-[#1E293B] border-2 border-emerald-500/30 rounded-2xl p-2 overflow-hidden relative h-32 flex items-center shadow-inner">
            {spinning ? (
              <motion.div 
                className="flex gap-2 absolute left-1/2"
                initial={{ x: 0 }}
                animate={{ x: -45 * 120 }} // Assuming each item is ~120px wide, scroll 45 items
                transition={{ duration: 3, ease: "circOut" }}
              >
                {/* Generate dummy items for animation */}
                {Array.from({ length: 50 }).map((_, i) => {
                  const item = config.items[Math.floor(Math.random() * config.items.length)];
                  return (
                    <div 
                      key={i} 
                      className="w-28 h-24 rounded-xl flex flex-col items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: item.color }}
                    >
                      <span className="text-white font-bold text-sm text-center px-2">{item.name}</span>
                    </div>
                  );
                })}
              </motion.div>
            ) : result ? (
              <div className="w-full flex justify-center">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-32 h-28 rounded-xl flex flex-col items-center justify-center border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                  style={{ backgroundColor: result.color }}
                >
                  <span className="text-white font-black text-center px-2">{result.name}</span>
                </motion.div>
              </div>
            ) : (
              <div className="w-full flex justify-center gap-2 overflow-hidden opacity-50">
                {config.items.slice(0, 3).map((item, i) => (
                  <div 
                    key={i} 
                    className="w-28 h-24 rounded-xl flex flex-col items-center justify-center shrink-0 border border-white/10"
                    style={{ backgroundColor: item.color }}
                  >
                    <span className="text-white font-bold text-sm text-center px-2">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Area */}
        <div className="flex flex-col items-center">
          <button
            onClick={spinRoulette}
            disabled={!canSpin || spinning}
            className={`px-10 py-4 rounded-2xl font-black text-xl uppercase tracking-wider transition-all shadow-lg ${
              canSpin && !spinning
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-white hover:scale-105 hover:shadow-emerald-500/25'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {spinning ? 'Крутимо...' : 'Крутити'}
          </button>
          
          {!canSpin && !spinning && (
            <p className="mt-4 text-emerald-400 font-medium">
              *Крутити можна раз в 24 години! Наступна спроба через: {timeUntilNextSpin}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
