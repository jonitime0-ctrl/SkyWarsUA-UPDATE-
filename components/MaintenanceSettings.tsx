import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Settings, Save, AlertTriangle } from 'lucide-react';

export interface MaintenanceConfig {
  enabled: boolean;
  global: boolean;
  blockedSections: string[];
  message: string;
  endTime: string;
}

const DEFAULT_CONFIG: MaintenanceConfig = {
  enabled: false,
  global: true,
  blockedSections: [],
  message: 'Зараз на сайті ведуться технічні роботи. Спробуйте зайти пізніше. Вибачаємось за тимчасові незручності.',
  endTime: ''
};

const SECTIONS = [
  { id: 'dashboard', name: 'Дашборд' },
  { id: 'community', name: 'Стрічка' },
  { id: 'channel', name: 'Канали' },
  { id: 'ai', name: 'ШІ' },
  { id: 'search', name: 'Пошук' },
  { id: 'event', name: 'Івент' },
  { id: 'aviation', name: 'Авіація' },
  { id: 'notifications', name: 'Сповіщення' },
  { id: 'settings', name: 'Налаштування' },
  { id: 'profile', name: 'Профіль' }
];

export const MaintenanceSettings: React.FC = () => {
  const [config, setConfig] = useState<MaintenanceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'maintenance');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as MaintenanceConfig);
        } else {
          await setDoc(docRef, DEFAULT_CONFIG);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/maintenance');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'maintenance'), config);
      alert('Налаштування технічних робіт збережено!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/maintenance');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setConfig(prev => {
      const isBlocked = prev.blockedSections.includes(sectionId);
      if (isBlocked) {
        return { ...prev, blockedSections: prev.blockedSections.filter(id => id !== sectionId) };
      } else {
        return { ...prev, blockedSections: [...prev.blockedSections, sectionId] };
      }
    });
  };

  if (loading) return <div className="p-4 text-center">Завантаження налаштувань...</div>;

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-lg border border-slate-200 dark:border-slate-800 mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-orange-500">
          <Settings className="w-6 h-6" />
          Технічні роботи
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
          <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-200 dark:border-orange-900/30">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <p className="font-bold text-sm">Увага! Адміністратор (olegkucher2311@gmail.com) завжди матиме доступ до сайту.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500">Режим блокування</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={config.global}
                  onChange={() => setConfig({ ...config, global: true })}
                  className="w-4 h-4 text-orange-500"
                />
                <span>Весь сайт</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={!config.global}
                  onChange={() => setConfig({ ...config, global: false })}
                  className="w-4 h-4 text-orange-500"
                />
                <span>Окремі розділи</span>
              </label>
            </div>
          </div>

          {!config.global && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Виберіть розділи для блокування:</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SECTIONS.map(section => (
                  <label key={section.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={config.blockedSections.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium">{section.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500">Повідомлення для користувачів</label>
            <textarea
              value={config.message}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none resize-none h-24"
              placeholder="Введіть текст повідомлення..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-500">Час завершення робіт (необов'язково)</label>
            <input
              type="datetime-local"
              value={config.endTime}
              onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none"
            />
          </div>
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
              Зберегти налаштування
            </>
          )}
        </button>
      </div>
    </div>
  );
};
