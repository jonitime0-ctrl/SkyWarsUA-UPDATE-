import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Sun, Plus, Trash2 } from 'lucide-react';

export interface SummerItem {
  id: string;
  section: string;
  photoUrl: string;
  rewardText: string;
  adminChance: number;
  userChance: number;
  emailChances?: { email: string; chance: number }[];
}

export interface SummerEventConfig {
  enabled: boolean;
  instructionEnabled: boolean;
  instructionPhotoUrl: string;
  items: SummerItem[];
}

const DEFAULT_CONFIG: SummerEventConfig = {
  enabled: false,
  instructionEnabled: false,
  instructionPhotoUrl: '',
  items: []
};

export const SummerEventSettings: React.FC = () => {
  const [config, setConfig] = useState<SummerEventConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'summerEvent');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as SummerEventConfig);
        } else {
          await setDoc(docRef, DEFAULT_CONFIG);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/summerEvent');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'summerEvent'), config);
      alert('Налаштування літнього івенту збережено!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/summerEvent');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index: number, field: keyof SummerItem, value: any) => {
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setConfig({ ...config, items: newItems });
  };

  const addItem = () => {
    setConfig({
      ...config,
      items: [
        ...config.items,
        {
          id: Date.now().toString(),
          section: 'dashboard',
          photoUrl: '',
          rewardText: '',
          adminChance: 100,
          userChance: 50,
          emailChances: []
        }
      ]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...config.items];
    newItems.splice(index, 1);
    setConfig({ ...config, items: newItems });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
          callback(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="p-4 text-center">Завантаження налаштувань...</div>;

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-lg border border-slate-200 dark:border-slate-800 mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-orange-500">
          <Sun className="w-6 h-6" />
          Івент "SUMMER"
        </h2>
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input 
              type="checkbox" 
              className="sr-only" 
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            <div className={`block w-14 h-8 rounded-full transition-colors ${config.enabled ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.enabled ? 'transform translate-x-6' : ''}`}></div>
          </div>
          <span className="ml-3 font-medium text-sm">
            {config.enabled ? 'Увімкнено' : 'Вимкнено'}
          </span>
        </label>
      </div>

      {config.enabled && (
        <div className="space-y-6">
          <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-200 dark:border-orange-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-orange-600 dark:text-orange-400">Інструкція у вкладці "Уводи"</h3>
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.instructionEnabled}
                  onChange={(e) => setConfig({ ...config, instructionEnabled: e.target.checked })}
                  className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="ml-2 text-sm font-medium">Показувати інструкцію</span>
              </label>
            </div>
            
            {config.instructionEnabled && (
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-1">Фото інструкції (URL або з галереї)</label>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={config.instructionPhotoUrl}
                    onChange={(e) => setConfig({ ...config, instructionPhotoUrl: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  />
                  <label className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl cursor-pointer transition-colors flex items-center justify-center">
                    <span>З галереї</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, (url) => setConfig({ ...config, instructionPhotoUrl: url }))}
                    />
                  </label>
                </div>
                {config.instructionPhotoUrl && (
                  <div className="mt-2">
                    <img src={config.instructionPhotoUrl} alt="Preview" className="h-32 rounded-md object-contain" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            )}
          </div>

          <h3 className="font-bold text-lg">Предмети івенту</h3>
          
          {config.items.map((item, index) => (
            <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative">
              <button 
                onClick={() => removeItem(index)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Розділ</label>
                  <select 
                    value={item.section}
                    onChange={(e) => updateItem(index, 'section', e.target.value)}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="dashboard">Дашборд</option>
                    <option value="dashboard_situation">Дашборд - Ситуація</option>
                    <option value="feed">Стрічка - Всі пости</option>
                    <option value="channels">Стрічка - Канали</option>
                    <option value="channel_view">Всередині каналу</option>
                    <option value="ai">ШІ</option>
                    <option value="search">Пошук</option>
                    <option value="aviation">Авіація</option>
                    <option value="notifications">Уводи (Сповіщення)</option>
                    <option value="profile">Профіль</option>
                    <option value="settings">Налаштування</option>
                    <option value="event">Івент</option>
                    <option value="admin">Адмін панель</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Нагорода (текст або порожньо)</label>
                  <input 
                    type="text" 
                    value={item.rewardText}
                    onChange={(e) => updateItem(index, 'rewardText', e.target.value)}
                    placeholder="Напр: промокод: SPACE на 5 гривень"
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Фото предмета (URL або з галереї)</label>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={item.photoUrl}
                    onChange={(e) => updateItem(index, 'photoUrl', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  />
                  <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl cursor-pointer transition-colors flex items-center justify-center">
                    <span>З галереї</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, (url) => updateItem(index, 'photoUrl', url))}
                    />
                  </label>
                </div>
                {item.photoUrl && (
                  <div className="mt-2">
                    <img src={item.photoUrl} alt="Preview" className="h-20 rounded-md object-contain" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Шанс для Адмінів (%)</label>
                  <input 
                    type="number" 
                    min="0" max="100"
                    value={item.adminChance}
                    onChange={(e) => updateItem(index, 'adminChance', Number(e.target.value))}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Шанс для Користувачів (%)</label>
                  <input 
                    type="number" 
                    min="0" max="100"
                    value={item.userChance}
                    onChange={(e) => updateItem(index, 'userChance', Number(e.target.value))}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-sm font-medium mb-2">Індивідуальні шанси (за Email)</label>
                {(item.emailChances || []).map((ec, ecIndex) => (
                  <div key={ecIndex} className="flex items-center gap-2 mb-2">
                    <input 
                      type="email" 
                      placeholder="Email користувача"
                      value={ec.email}
                      onChange={(e) => {
                        const newEc = [...(item.emailChances || [])];
                        newEc[ecIndex].email = e.target.value;
                        updateItem(index, 'emailChances', newEc);
                      }}
                      className="flex-1 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-sm"
                    />
                    <input 
                      type="number" 
                      min="0" max="100"
                      placeholder="Шанс (%)"
                      value={ec.chance}
                      onChange={(e) => {
                        const newEc = [...(item.emailChances || [])];
                        newEc[ecIndex].chance = Number(e.target.value);
                        updateItem(index, 'emailChances', newEc);
                      }}
                      className="w-24 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-sm"
                    />
                    <button 
                      onClick={() => {
                        const newEc = [...(item.emailChances || [])];
                        newEc.splice(ecIndex, 1);
                        updateItem(index, 'emailChances', newEc);
                      }}
                      className="text-red-500 hover:text-red-600 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const newEc = [...(item.emailChances || []), { email: '', chance: 100 }];
                    updateItem(index, 'emailChances', newEc);
                  }}
                  className="text-sm text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 mt-2"
                >
                  <Plus className="w-4 h-4" /> Додати індивідуальний шанс
                </button>
              </div>
            </div>
          ))}

          <button 
            onClick={addItem}
            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Додати ще один предмет
          </button>
        </div>
      )}

      <div className="mt-6">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          {saving ? 'Збереження...' : (
            <>
              <Save className="w-5 h-5" />
              Зберегти налаштування івенту
            </>
          )}
        </button>
      </div>
    </div>
  );
};
