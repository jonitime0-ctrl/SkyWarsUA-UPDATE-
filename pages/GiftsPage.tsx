import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Gift, Plus, Image as ImageIcon, X, Send, Search, ExternalLink, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GiftsPageProps {
  isAdmin?: boolean;
}

interface GiftItem {
  id: string;
  name: string;
  imageUrl: string;
  backgroundColor: string;
  rarity: string;
  model: string;
  symbol: string;
  price: string;
  currency: string;
  animationType?: 'none' | 'float' | 'pulse' | 'spin' | 'bounce';
  createdAt: any;
}

export const GiftsPage: React.FC<GiftsPageProps> = ({ isAdmin }) => {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [giftEmail, setGiftEmail] = useState('');
  const [isGifting, setIsGifting] = useState(false);
  const [giftSuccess, setGiftSuccess] = useState(false);
  const [giftError, setGiftError] = useState('');

  // Create form state
  const [newName, setNewName] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newBgColor, setNewBgColor] = useState('#8B5CF6');
  const [newRarity, setNewRarity] = useState('Звичайний');
  const [newModel, setNewModel] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCurrency, setNewCurrency] = useState('UAH');
  const [newAnimationType, setNewAnimationType] = useState('none');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        setNewImageUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const q = query(collection(db, 'gifts_catalog'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const giftsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem));
      setGifts(giftsData);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newImageUrl) return;

    try {
      await addDoc(collection(db, 'gifts_catalog'), {
        name: newName,
        imageUrl: newImageUrl,
        backgroundColor: newBgColor,
        rarity: newRarity,
        model: newModel,
        symbol: newSymbol,
        price: newPrice,
        currency: newCurrency,
        animationType: newAnimationType,
        createdAt: serverTimestamp()
      });
      setIsCreateModalOpen(false);
      // Reset form
      setNewName(''); setNewImageUrl(''); setNewBgColor('#8B5CF6');
      setNewRarity('Звичайний'); setNewModel(''); setNewSymbol('');
      setNewPrice(''); setNewCurrency('UAH'); setNewAnimationType('none');
    } catch (error) {
      console.error("Error creating gift:", error);
    }
  };

  const handleDeleteGift = async (giftId: string) => {
    if (!window.confirm('Видалити цей подарунок з каталогу?')) return;
    try {
      await deleteDoc(doc(db, 'gifts_catalog', giftId));
      setSelectedGift(null);
    } catch (error) {
      console.error("Error deleting gift:", error);
    }
  };

  const handleSendGift = async () => {
    if (!selectedGift || !giftEmail.trim()) return;
    setIsGifting(true);
    setGiftError('');
    setGiftSuccess(false);

    try {
      // Find user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', giftEmail.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setGiftError('Користувача з таким email не знайдено');
        setIsGifting(false);
        return;
      }

      const targetUser = querySnapshot.docs[0];
      
      // Add gift to user's gifts subcollection
      await addDoc(collection(db, 'users', targetUser.id, 'received_gifts'), {
        giftId: selectedGift.id,
        senderId: auth.currentUser?.uid || 'admin',
        receivedAt: serverTimestamp(),
        giftDetails: selectedGift
      });

      setGiftSuccess(true);
      setTimeout(() => {
        setGiftSuccess(false);
        setSelectedGift(null);
        setGiftEmail('');
      }, 2000);
    } catch (error) {
      console.error("Error sending gift:", error);
      setGiftError('Помилка при відправці подарунка');
    } finally {
      setIsGifting(false);
    }
  };

  const getAnimationProps = (type?: string) => {
    switch (type) {
      case 'float':
        return { animate: { y: [-5, 5, -5] }, transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' } };
      case 'pulse':
        return { animate: { scale: [1, 1.1, 1] }, transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' } };
      case 'spin':
        return { animate: { rotate: [0, 360] }, transition: { repeat: Infinity, duration: 4, ease: 'linear' } };
      case 'bounce':
        return { animate: { y: [0, -15, 0] }, transition: { repeat: Infinity, duration: 1, ease: 'easeOut' } };
      default:
        return {};
    }
  };

  return (
    <div className="pb-24 p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-10 mt-6 relative">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 bg-purple-50 dark:bg-purple-500/10 rounded-[1.25rem] flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
            <Gift className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Подарунки</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Ексклюзивний каталог</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-[1.25rem] font-bold transition-all shadow-xl hover:-translate-y-1 hover:shadow-2xl relative z-10"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline tracking-wide">Створити</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10">
        {gifts.map(gift => (
          <motion.div
            key={gift.id}
            whileHover={{ y: -5 }}
            onClick={() => setSelectedGift(gift)}
            className="cursor-pointer bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 flex flex-col items-center justify-center gap-4 relative overflow-hidden group shadow-xl hover:shadow-2xl transition-shadow"
          >
            {/* Ambient Background Glow based on gift color */}
            <div 
              className="absolute inset-0 opacity-10 dark:opacity-[0.03] transition-opacity group-hover:opacity-20 dark:group-hover:opacity-10 pointer-events-none"
              style={{ backgroundColor: gift.backgroundColor }}
            />
            
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-md z-10"
                 style={{ backgroundColor: gift.backgroundColor }}>
              {gift.rarity}
            </div>
            
            <div className="relative w-24 h-24 mt-4 mb-2 flex items-center justify-center z-10 group-hover:scale-110 transition-transform duration-500">
               <motion.img 
                 src={gift.imageUrl} 
                 alt={gift.name} 
                 className="w-full h-full object-contain drop-shadow-2xl"
                 {...getAnimationProps(gift.animationType)}
               />
               <div 
                 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full blur-[20px] -z-10 mix-blend-multiply dark:mix-blend-screen opacity-50"
                 style={{ backgroundColor: gift.backgroundColor }}
               />
            </div>
            
            <div className="text-center z-10 w-full mt-2">
              <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight truncate px-2">{gift.name}</h3>
              {gift.price && (
                <p className="text-xs font-bold uppercase tracking-wider mt-1 opacity-80" style={{ color: gift.backgroundColor }}>
                  {gift.price} {gift.currency}
                </p>
              )}
            </div>
          </motion.div>
        ))}
        {gifts.length === 0 && (
           <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
             <Gift className="w-16 h-16 mb-4 opacity-50" />
             <p className="font-bold tracking-widest uppercase">Подарунки відсутні</p>
           </div>
        )}
      </div>

      {/* Gift Details Modal */}
      <AnimatePresence>
        {selectedGift && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-white/10 flex flex-col"
            >
              <div 
                className="h-64 relative flex items-center justify-center shrink-0 w-full"
              >
                <div 
                  className="absolute inset-0 opacity-80 mix-blend-multiply dark:mix-blend-screen"
                  style={{ backgroundColor: selectedGift.backgroundColor }}
                />
                <button 
                  onClick={() => setSelectedGift(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/40 dark:bg-black/20 dark:hover:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 dark:text-white transition-colors z-20"
                >
                  <X className="w-5 h-5" />
                </button>
                <motion.img 
                  src={selectedGift.imageUrl} 
                  alt={selectedGift.name} 
                  className="w-40 h-40 object-contain drop-shadow-2xl relative z-10 hover:scale-110 transition-transform duration-500" 
                  {...getAnimationProps(selectedGift.animationType)}
                />
                <div className="absolute bottom-4 left-6 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-slate-900 bg-white shadow-xl z-20">
                  {selectedGift.rarity}
                </div>
              </div>
              
              <div className="p-8 flex flex-col flex-1">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-4">{selectedGift.name}</h2>
                <div className="flex flex-wrap gap-2 mb-8">
                  {selectedGift.model && (
                    <span className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold uppercase tracking-wider">
                      Model: {selectedGift.model}
                    </span>
                  )}
                  {selectedGift.symbol && (
                    <span className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold uppercase tracking-wider">
                      {selectedGift.symbol}
                    </span>
                  )}
                </div>

                {isAdmin ? (
                  <div className="space-y-4 flex-1">
                    <div className="p-5 bg-slate-50 dark:bg-[#111] rounded-[1.5rem] border border-slate-100 dark:border-white/5 shadow-inner">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Надіслати користувачу</h3>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={giftEmail}
                          onChange={(e) => setGiftEmail(e.target.value)}
                          placeholder="Email користувача"
                          className="flex-1 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-[1rem] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/50 font-medium"
                        />
                        <button
                          onClick={handleSendGift}
                          disabled={isGifting || !giftEmail.trim()}
                          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 rounded-[1rem] transition-colors flex items-center justify-center shadow-lg"
                        >
                          {isGifting ? '...' : <Send className="w-5 h-5" />}
                        </button>
                      </div>
                      {giftError && <p className="text-red-500 text-xs font-bold mt-3 px-1">{giftError}</p>}
                      {giftSuccess && <p className="text-emerald-500 text-xs font-bold mt-3 px-1">Відправлено успішно!</p>}
                    </div>
                    
                    <button
                      onClick={() => handleDeleteGift(selectedGift.id)}
                      className="w-full flex items-center justify-center gap-2 py-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-[1.5rem] font-bold transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                      Видалити з каталогу
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#111] rounded-[1.5rem] border border-slate-100 dark:border-white/5 shadow-inner">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Вартість</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                          {selectedGift.price ? `${selectedGift.price} ${selectedGift.currency}` : 'Free'}
                        </p>
                      </div>
                      <a
                        href="https://t.me/compani77"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-6 py-4 rounded-[1.25rem] font-black uppercase tracking-wide transition-transform hover:-translate-y-0.5 shadow-xl flex items-center gap-2"
                      >
                        Придбати <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-xs font-bold text-center text-slate-400 uppercase tracking-widest mb-2">
                       Зверніться до адміністратора
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Gift Modal */}
      <AnimatePresence>
        {isCreateModalOpen && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-slate-100 dark:border-white/10 max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-white/5">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Новий подарунок</h2>
                <button 
                  onClick={() => setIsCreateModalOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors bg-white dark:bg-black shadow-sm"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleCreateGift} className="space-y-6 flex flex-col">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Назва *</label>
                    <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-bold transition-all" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Зображення (URL або завантаження) *</label>
                    <div className="flex gap-2">
                       <div className="flex-1 relative">
                          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                             <ImageIcon className="w-5 h-5" />
                          </div>
                          <input 
                            type="text" 
                            required
                            value={newImageUrl} 
                            onChange={e => setNewImageUrl(e.target.value)} 
                            placeholder="https://..." 
                            className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-medium transition-all" 
                          />
                       </div>
                       <input 
                         type="file" 
                         ref={fileInputRef} 
                         onChange={handleImageUpload} 
                         accept="image/*" 
                         className="hidden" 
                       />
                       <button
                         type="button"
                         onClick={() => fileInputRef.current?.click()}
                         className="px-6 py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-[1.25rem] font-bold transition-colors flex items-center shrink-0"
                       >
                         Обрати
                       </button>
                    </div>
                    {newImageUrl && newImageUrl.startsWith('data:image') && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.5rem] w-fit">
                        <img src={newImageUrl} alt="Preview" className="w-20 h-20 object-contain drop-shadow-xl" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Колір фону</label>
                      <div className="flex gap-3">
                        <div className="relative w-14 h-14 rounded-[1.25rem] overflow-hidden border-2 border-white/10 shadow-inner group shrink-0">
                           <input 
                             type="color" 
                             value={newBgColor} 
                             onChange={e => setNewBgColor(e.target.value)} 
                             className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer border-none p-0"
                           />
                        </div>
                        <input 
                           type="text" 
                           value={newBgColor} 
                           onChange={e => setNewBgColor(e.target.value)} 
                           className="flex-1 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-4 py-4 outline-none text-slate-900 dark:text-white font-mono uppercase font-bold focus:ring-2 focus:ring-purple-500/50" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Рідкість</label>
                      <input type="text" value={newRarity} onChange={e => setNewRarity(e.target.value)} placeholder="Епічний" className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-bold" />
                    </div>
                  </div>

                  <div>
                     <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Анімація іконки</label>
                     <select value={newAnimationType} onChange={e => setNewAnimationType(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-bold appearance-none cursor-pointer">
                        <option value="none">Без анімації</option>
                        <option value="float">Левітація (Вверх-вниз)</option>
                        <option value="pulse">Пульсація (Збільшення)</option>
                        <option value="spin">Обертання</option>
                        <option value="bounce">Стрибки</option>
                     </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Модель</label>
                      <input type="text" value={newModel} onChange={e => setNewModel(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Символ</label>
                      <input type="text" value={newSymbol} onChange={e => setNewSymbol(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Ціна</label>
                      <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0" className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Валюта</label>
                      <input type="text" value={newCurrency} onChange={e => setNewCurrency(e.target.value)} placeholder="UAH" className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-white/5 rounded-[1.25rem] px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white font-bold uppercase" />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-black tracking-widest uppercase py-5 rounded-[1.5rem] transition-all shadow-xl hover:-translate-y-1 mt-6">
                    Створити подарунок
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
