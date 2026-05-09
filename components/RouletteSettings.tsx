import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Settings, Plus, Trash2, Dices } from 'lucide-react';

export interface RouletteItem {
  id: string;
  name: string;
  type: 'stars' | 'nothing';
  value: number;
  chance: number;
  color: string;
}

export interface RouletteConfig {
  enabled: boolean;
  items: RouletteItem[];
}

const DEFAULT_CONFIG: RouletteConfig = {
  enabled: false,
  items: [
    { id: '1', name: 'Нічого', type: 'nothing', value: 0, chance: 50, color: '#475569' },
    { id: '2', name: '15 Зірок', type: 'stars', value: 15, chance: 20, color: '#eab308' },
    { id: '3', name: '50 Зірок', type: 'stars', value: 50, chance: 10, color: '#eab308' },
    { id: '4', name: '100 Зірок', type: 'stars', value: 100, chance: 5, color: '#eab308' },
  ]
};

export const RouletteSettings: React.FC = () => {
  const [config, setConfig] = useState<RouletteConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'roulette');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as RouletteConfig);
        } else {
          await setDoc(docRef, DEFAULT_CONFIG);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/roulette');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'roulette'), config);
      alert('Налаштування рулетки збережено!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/roulette');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index: number, field: keyof RouletteItem, value: any) => {
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
          name: 'Новий приз',
          type: 'stars',
          value: 15,
          chance: 10,
          color: '#eab308'
        }
      ]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...config.items];
    newItems.splice(index, 1);
    setConfig({ ...config, items: newItems });
  };

  if (loading) return <div className="p-4 text-center">Завантаження налаштувань...</div>;

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-lg border border-slate-200 dark:border-slate-800 mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-500">
          <Dices className="w-6 h-6" />
          Щоденна Рулетка
        </h2>
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input 
              type="checkbox" 
              className="sr-only" 
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            <div className={`block w-14 h-8 rounded-full transition-colors ${config.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.enabled ? 'transform translate-x-6' : ''}`}></div>
          </div>
          <span className="ml-3 font-medium text-sm">
            {config.enabled ? 'Увімкнено' : 'Вимкнено'}
          </span>
        </label>
      </div>

      {config.enabled && (
        <div className="space-y-6">
          <h3 className="font-bold text-lg">Призи рулетки</h3>
          
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
                  <label className="block text-sm font-medium mb-1">Назва призу</label>
                  <input 
                    type="text" 
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Тип</label>
                  <select 
                    value={item.type}
                    onChange={(e) => updateItem(index, 'type', e.target.value)}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="stars">Зірки Telegram</option>
                    <option value="nothing">Нічого</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {item.type === 'stars' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Кількість (від 15 до 100)</label>
                    <input 
                      type="number" 
                      min="15" max="100"
                      value={item.value}
                      onChange={(e) => updateItem(index, 'value', Number(e.target.value))}
                      className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Шанс випадіння (%)</label>
                  <input 
                    type="number" 
                    min="0" max="100"
                    value={item.chance}
                    onChange={(e) => updateItem(index, 'chance', Number(e.target.value))}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Колір фону</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={item.color}
                      onChange={(e) => updateItem(index, 'color', e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={item.color}
                      onChange={(e) => updateItem(index, 'color', e.target.value)}
                      className="flex-1 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button 
            onClick={addItem}
            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Додати приз
          </button>
        </div>
      )}

      <div className="mt-6">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          {saving ? 'Збереження...' : (
            <>
              <Save className="w-5 h-5" />
              Зберегти налаштування рулетки
            </>
          )}
        </button>
      </div>
    </div>
  );
};
