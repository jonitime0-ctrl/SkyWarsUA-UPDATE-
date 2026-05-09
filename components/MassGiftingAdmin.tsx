import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Gift, Users, Mail, AlertTriangle, CheckCircle, Search, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

export const MassGiftingAdmin: React.FC = () => {
  const [targetType, setTargetType] = useState<'all' | 'email'>('email');
  const [email, setEmail] = useState('');
  const [prizeType, setPrizeType] = useState<'catalog' | 'custom'>('catalog');
  
  const [giftsCatalog, setGiftsCatalog] = useState<any[]>([]);
  const [selectedGiftId, setSelectedGiftId] = useState('');
  
  // Custom Prize State
  const [customName, setCustomName] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customRarity, setCustomRarity] = useState('Епічний');
  const [customColor, setCustomColor] = useState('#8B5CF6');

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Count to show how many will receive
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    let unsubscribeCatalog: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;

    const fetchCatalog = () => {
      try {
        const q = query(collection(db, 'gifts_catalog'));
        unsubscribeCatalog = onSnapshot(q, (snap) => {
           const gifts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setGiftsCatalog(gifts);
           if (gifts.length > 0 && !selectedGiftId) {
             setSelectedGiftId(gifts[0].id);
           }
        });

        unsubscribeUsers = onSnapshot(collection(db, 'users'), (usersSnap) => {
           setTotalUsers(usersSnap.size);
        });
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchCatalog();

    return () => {
      if (unsubscribeCatalog) unsubscribeCatalog();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [selectedGiftId]);

  const handleSend = async () => {
    setIsLoading(true);
    setSuccess('');
    setError('');

    try {
      let targetUsers: any[] = [];
      
      const usersRef = collection(db, 'users');
      if (targetType === 'all') {
        const snap = await getDocs(usersRef);
        targetUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        if (!email.trim()) {
          setError('Введіть email');
          setIsLoading(false);
          return;
        }
        const q = query(usersRef, where('email', '==', email.trim()));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError('Користувача з таким email не знайдено');
          setIsLoading(false);
          return;
        }
        targetUsers = [ { id: snap.docs[0].id, ...snap.docs[0].data() } ];
      }

      let giftDetails: any = null;
      let giftIdForRecord = '';

      if (prizeType === 'catalog') {
        if (!selectedGiftId) {
          setError('Виберіть подарунок з каталогу');
          setIsLoading(false);
          return;
        }
        const selected = giftsCatalog.find(g => g.id === selectedGiftId);
        giftDetails = selected;
        giftIdForRecord = selectedGiftId;
      } else {
        if (!customName.trim() || !customImageUrl.trim()) {
          setError('Введіть назву та посилання на зображення');
          setIsLoading(false);
          return;
        }
        giftDetails = {
          name: customName.trim(),
          imageUrl: customImageUrl.trim(),
          backgroundColor: customColor,
          rarity: customRarity,
          isCustomEventPrize: true
        };
        giftIdForRecord = 'custom_' + Date.now();
      }

      let successCount = 0;
      
      // Send one by one (or in small batches) to avoid freezing
      for (const user of targetUsers) {
        try {
          await addDoc(collection(db, 'users', user.id, 'received_gifts'), {
            giftId: giftIdForRecord,
            senderId: 'admin_mass',
            receivedAt: serverTimestamp(),
            giftDetails: giftDetails
          });
          successCount++;
        } catch (e) {
          console.error("Error sending to user:", user.id, e);
        }
      }

      setSuccess(`Успішно видано приз ${successCount} користувачам!`);
      
      // reset specific fields if not mass
      if (targetType === 'email') setEmail('');
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (err) {
      setError('Сталася помилка при видачі призів.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg">
      <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2 text-purple-500">
        <Trophy className="w-6 h-6" />
        Видача подарунків та призів
      </h2>

      <div className="space-y-6">
        
        {/* Step 1: Target Selection */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-500">Кому видати:</label>
          <div className="flex gap-4">
            <label className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors ${targetType === 'email' ? 'border-purple-500 bg-purple-500/10' : 'border-[#E5E5E5] dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#222]'}`}>
              <input type="radio" value="email" checked={targetType === 'email'} onChange={() => setTargetType('email')} className="hidden" />
              <Mail className={`w-6 h-6 ${targetType === 'email' ? 'text-purple-500' : 'text-gray-400'}`} />
              <span className="font-bold text-sm">Окремий email</span>
            </label>
            <label className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors ${targetType === 'all' ? 'border-purple-500 bg-purple-500/10' : 'border-[#E5E5E5] dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#222]'}`}>
              <input type="radio" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} className="hidden" />
              <Users className={`w-6 h-6 ${targetType === 'all' ? 'text-purple-500' : 'text-gray-400'}`} />
              <span className="font-bold text-sm">Всі користувачі ({totalUsers})</span>
            </label>
          </div>

          {targetType === 'email' && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Введіть email користувача..."
              className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
            />
          )}
        </div>

        {/* Step 2: Prize Type Selection */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-500">Що видати:</label>
          <div className="flex gap-4 mb-3">
            <button
              onClick={() => setPrizeType('catalog')}
              className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-colors ${prizeType === 'catalog' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-[#111] text-gray-500 hover:bg-gray-200'}`}
            >
              З каталогу подарунків
            </button>
            <button
              onClick={() => setPrizeType('custom')}
              className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-colors ${prizeType === 'custom' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-[#111] text-gray-500 hover:bg-gray-200'}`}
            >
              Кастомний (Івент)
            </button>
          </div>

          {prizeType === 'catalog' && (
            <div className="space-y-2">
              <select
                value={selectedGiftId}
                onChange={(e) => setSelectedGiftId(e.target.value)}
                className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="" disabled>Оберіть подарунок</option>
                {giftsCatalog.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.price ? `${g.price} ${g.currency}` : 'Безкоштовно'})</option>
                ))}
              </select>
            </div>
          )}

          {prizeType === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-[#111] p-4 rounded-xl border border-[#E5E5E5] dark:border-[#333]">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Назва призу</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Бронзова медаль..."
                  className="w-full bg-white dark:bg-[#222] border border-[#E5E5E5] dark:border-[#444] rounded-lg px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Зображення (URL)</label>
                <input
                  type="text"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white dark:bg-[#222] border border-[#E5E5E5] dark:border-[#444] rounded-lg px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Рідкість</label>
                <input
                  type="text"
                  value={customRarity}
                  onChange={(e) => setCustomRarity(e.target.value)}
                  placeholder="Епічний"
                  className="w-full bg-white dark:bg-[#222] border border-[#E5E5E5] dark:border-[#444] rounded-lg px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Колір фону</label>
                <div className="flex gap-2">
                  <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} className="w-8 h-8 rounded shrink-0 cursor-pointer" />
                  <input type="text" value={customColor} onChange={e => setCustomColor(e.target.value)} className="flex-1 bg-white dark:bg-[#222] border border-[#E5E5E5] dark:border-[#444] rounded-lg px-3 py-2 outline-none text-sm" />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <div className="p-4 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-between"><span className="text-sm font-bold">{error}</span></div>}
        {success && <div className="p-4 bg-green-500/20 text-green-500 rounded-xl flex items-center justify-between"><span className="text-sm font-bold">{success}</span><CheckCircle className="w-5 h-5"/></div>}

        <button
          onClick={handleSend}
          disabled={isLoading || (prizeType === 'catalog' && !selectedGiftId)}
          className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 mt-4"
        >
          {isLoading ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <Gift className="w-5 h-5" />
          )}
          {isLoading ? 'Видача...' : targetType === 'all' ? 'Затвердити та Видати всім' : 'Видати користувачу'}
        </button>

      </div>
    </div>
  );
};
