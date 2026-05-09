import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store as StoreIcon, Plus, Trash2, ExternalLink, Image as ImageIcon, ShoppingCart, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';

interface StoreItem {
  id: string;
  title: string;
  description: string;
  price: string;
  contactLink: string;
  image?: string;
  createdAt: any;
}

export const StorePage: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [contactLink, setContactLink] = useState('');
  const [image, setImage] = useState('');
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const q = query(collection(db, 'storeItems'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StoreItem[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'storeItems');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !price.trim() || !contactLink.trim()) return;

    setAdding(true);
    try {
      await addDoc(collection(db, 'storeItems'), {
        title: title.trim(),
        description: description.trim(),
        price: price.trim(),
        contactLink: contactLink.trim(),
        image: image.trim() || null,
        createdAt: serverTimestamp()
      });
      setShowAddForm(false);
      setTitle('');
      setDescription('');
      setPrice('');
      setContactLink('');
      setImage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'storeItems');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Видалити цей товар?')) return;
    try {
      await deleteDoc(doc(db, 'storeItems', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `storeItems/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-160px)]">
        <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Завантаження магазину...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-24 md:pb-6 overflow-y-auto w-full md:max-w-[420px] md:mx-auto md:border-x md:border-black/5 dark:md:border-white/5 md:shadow-2xl">
      <div className="bg-white/80 dark:bg-[#111111]/80 backdrop-blur-xl border-b border-black/5 dark:border-white/5 p-4 sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-emerald-500/10 flex items-center justify-center">
            <StoreIcon className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="font-bold text-lg dark:text-white uppercase tracking-tight">Магазин</h1>
            <p className="text-xs text-slate-500 font-medium">Офіційні товари та послуги</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-all ${
              showAddForm 
                ? 'bg-rose-500/10 text-rose-500 rotate-45' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4">
        {isAdmin && showAddForm && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#1A1A1A] p-5 rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-xl mb-6 space-y-4"
            onSubmit={handleAddItem}
          >
            <h3 className="font-bold text-lg border-b border-black/5 dark:border-white/5 pb-3">Додати товар</h3>
            
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Назва</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-slate-100 dark:bg-[#111] border border-transparent focus:border-emerald-500 rounded-xl px-4 py-3 outline-none transition-colors" placeholder="Наприклад: Підписка Premium" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Опис</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full h-24 resize-none bg-slate-100 dark:bg-[#111] border border-transparent focus:border-emerald-500 rounded-xl px-4 py-3 outline-none transition-colors" placeholder="Детальний опис товару або послуги..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Вартість / Ціна</label>
                <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} required className="w-full bg-slate-100 dark:bg-[#111] border border-transparent focus:border-emerald-500 rounded-xl px-4 py-3 outline-none transition-colors" placeholder="Наприклад: 500 грн" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Картинка (опц.)</label>
                {!image ? (
                  <div className="flex items-center gap-2">
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
                      className="w-full bg-slate-100 dark:bg-[#111] hover:bg-slate-200 dark:hover:bg-[#222] border border-transparent focus:border-emerald-500 rounded-xl px-4 py-3 outline-none transition-colors flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 font-medium"
                    >
                      <ImageIcon className="w-5 h-5" />
                      Завантажити
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full h-[46px] flex items-center">
                    <div className="h-full w-full bg-slate-100 dark:bg-[#111] rounded-xl overflow-hidden flex items-center justify-between px-3 border border-emerald-500">
                      <div className="flex items-center gap-2 truncate">
                         <img src={image} alt="preview" className="w-6 h-6 rounded-md object-cover" />
                         <span className="text-xs text-slate-500 truncate">Зображення додано</span>
                      </div>
                      <button type="button" onClick={() => setImage('')} className="text-red-500 p-1 hover:bg-red-500/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Посилання для покупки</label>
              <input type="url" value={contactLink} onChange={(e) => setContactLink(e.target.value)} required className="w-full bg-slate-100 dark:bg-[#111] border border-transparent focus:border-emerald-500 rounded-xl px-4 py-3 outline-none transition-colors" placeholder="https://t.me/your_contact_bot" />
            </div>

            <button type="submit" disabled={adding} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">
              {adding ? 'Додаємо...' : 'Опублікувати товар'}
            </button>
          </motion.form>
        )}

        <div className="space-y-6">
          {items.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#1A1A1A] rounded-[2rem] border border-black/5 dark:border-white/5 shadow-xl overflow-hidden group relative"
            >
              {isAdmin && (
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {item.image && (
                <div className="w-full h-48 bg-slate-200 dark:bg-[#222] relative overflow-hidden">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="inline-block bg-emerald-500 text-white font-black text-sm px-3 py-1 rounded-lg backdrop-blur-md shadow-lg">
                      {item.price}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-5">
                {!item.image && (
                   <span className="inline-block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-sm px-3 py-1 rounded-lg mb-3">
                     {item.price}
                   </span>
                )}
                
                <h3 className="font-bold text-xl mb-2 pr-8 leading-tight dark:text-white">
                  {item.title}
                </h3>
                
                <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-6">
                  {item.description}
                </p>

                <a 
                  href={item.contactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-[1.25rem] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 group active:scale-95"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Купити / Зв'язатися</span>
                  <ExternalLink className="w-4 h-4 opacity-50 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </a>
              </div>
            </motion.div>
          ))}

          {items.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                <StoreIcon className="w-10 h-10 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Магазин поки що порожній</p>
              <p className="text-sm text-slate-500 mt-1">Тут скоро з'являться нові товари</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
