import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Shield, Save, Image as ImageIcon, X } from 'lucide-react';

export interface SecurityConfig {
  captchaEnabled: boolean;
  isSiteBlocked?: boolean;
  blockMessage?: string;
  blockImage?: string;
  blockImages?: string[];
  blockLink?: string;
}

const DEFAULT_CONFIG: SecurityConfig = {
  captchaEnabled: true,
  isSiteBlocked: false,
};

export const SecuritySettings: React.FC = () => {
  const [config, setConfig] = useState<SecurityConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentImages = config.blockImages || (config.blockImage ? [config.blockImage] : []);

    const processImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            resolve(dataUrl);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    };

    const newImages = await Promise.all(files.map(processImage));
    setConfig(prev => {
      const nextConfig = { ...prev };
      nextConfig.blockImages = [...currentImages, ...newImages];
      delete nextConfig.blockImage;
      return nextConfig;
    });
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'security');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as SecurityConfig);
        } else {
          await setDoc(docRef, DEFAULT_CONFIG);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/security');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof SecurityConfig] === undefined) {
          delete payload[key as keyof SecurityConfig];
        }
      });
      await setDoc(doc(db, 'settings', 'security'), payload);
      alert('Налаштування безпеки збережено!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/security');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Завантаження налаштувань безпеки...</div>;

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-lg border border-slate-200 dark:border-slate-800 mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-500">
          <Shield className="w-6 h-6" />
          Безпека та Антибот
        </h2>
        
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Вимкнути / Увімкнути капчу при вході на сайт</span>
            <label className="flex items-center cursor-pointer">
            <div className="relative">
                <input 
                type="checkbox" 
                className="sr-only" 
                checked={config.captchaEnabled}
                onChange={(e) => setConfig({ ...config, captchaEnabled: e.target.checked })}
                />
                <div className={`block w-14 h-8 rounded-full transition-colors ${config.captchaEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.captchaEnabled ? 'transform translate-x-6' : ''}`}></div>
            </div>
            </label>
        </div>

        <div className="flex items-center justify-between mt-4">
            <span className="font-medium text-sm text-red-500 flex items-center gap-2">
              Блокування сайту (Режим «Завершення роботи»)
            </span>
            <label className="flex items-center cursor-pointer">
            <div className="relative">
                <input 
                type="checkbox" 
                className="sr-only" 
                checked={config.isSiteBlocked || false}
                onChange={(e) => setConfig({ ...config, isSiteBlocked: e.target.checked })}
                />
                <div className={`block w-14 h-8 rounded-full transition-colors ${config.isSiteBlocked ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.isSiteBlocked ? 'transform translate-x-6' : ''}`}></div>
            </div>
            </label>
        </div>

        {config.isSiteBlocked && (
          <div className="space-y-4 p-4 mt-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Причина закриття (повідомлення)</label>
              <textarea 
                value={config.blockMessage || ''} 
                onChange={(e) => setConfig({ ...config, blockMessage: e.target.value })} 
                className="w-full h-24 resize-none bg-white dark:bg-[#111] border border-transparent focus:border-red-500 rounded-xl px-4 py-3 outline-none transition-colors" 
                placeholder="Прийнято рішення про поступове завершення..." 
              />
            </div>
            
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Посилання для кнопки "Докладніше" (опц.)</label>
              <input 
                type="url"
                value={config.blockLink || ''} 
                onChange={(e) => setConfig({ ...config, blockLink: e.target.value })} 
                className="w-full bg-white dark:bg-[#111] border border-transparent focus:border-red-500 rounded-xl px-4 py-3 outline-none transition-colors" 
                placeholder="https://t.me/ppdodatok" 
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Фото (опц.)</label>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    multiple
                    className="hidden" 
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-full bg-white dark:bg-[#111] hover:bg-slate-50 dark:hover:bg-[#222] border border-transparent focus:border-red-500 rounded-xl px-4 py-3 outline-none transition-colors flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 font-medium"
                  >
                    <ImageIcon className="w-5 h-5" />
                    Завантажити фото з галереї
                  </button>
                </div>
                
                {((config.blockImages && config.blockImages.length > 0) || config.blockImage) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {/* Legacy single image fallback */}
                    {config.blockImage && !config.blockImages?.includes(config.blockImage) && (
                      <div className="relative aspect-square bg-white dark:bg-[#111] rounded-xl overflow-hidden border border-red-500/50">
                        <img src={config.blockImage} alt="preview" className="w-full h-full object-cover opacity-80" />
                        <button 
                          type="button" 
                          onClick={() => setConfig({ ...config, blockImage: undefined })} 
                          className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors backdrop-blur-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {/* New multiple images */}
                    {config.blockImages?.map((img, idx) => (
                      <div key={idx} className="relative aspect-square bg-white dark:bg-[#111] rounded-xl overflow-hidden border border-red-500/50">
                        <img src={img} alt={`preview ${idx}`} className="w-full h-full object-cover opacity-80" />
                        <button 
                          type="button" 
                          onClick={() => {
                            const newImages = [...(config.blockImages || [])];
                            newImages.splice(idx, 1);
                            setConfig({ ...config, blockImages: newImages });
                          }} 
                          className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors backdrop-blur-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          {saving ? 'Збереження...' : (
            <>
              <Save className="w-5 h-5" />
              Зберегти налаштування безпеки
            </>
          )}
        </button>
      </div>
    </div>
  );
};
