import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Type, Save, FileUp, X } from 'lucide-react';

export interface AppearanceConfig {
  customFontBase64?: string;
  customFontName?: string;
}

const DEFAULT_CONFIG: AppearanceConfig = {};

export const SiteAppearanceSettings: React.FC = () => {
  const [config, setConfig] = useState<AppearanceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'appearance');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as AppearanceConfig);
        } else {
          await setDoc(docRef, DEFAULT_CONFIG);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/appearance');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Розмір файлу не повинен перевищувати 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setConfig({ ...config, customFontBase64: base64, customFontName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof AppearanceConfig] === undefined) {
          delete payload[key as keyof AppearanceConfig];
        }
      });
      await setDoc(doc(db, 'settings', 'appearance'), payload);
      alert('Налаштування зовнішнього вигляду збережено!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/appearance');
      alert('Помилка при збереженні налаштувань.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-white dark:bg-[#1A1A1A] h-32 rounded-3xl" />;
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-slate-800 dark:text-white">
          <Type className="w-6 h-6 text-indigo-500" />
          Шрифт сайту
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors uppercase tracking-widest text-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? '...' : 'Зберегти'}
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Користувацький шрифт (TTF, WOFF, WOFF2)</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFontUpload}
              accept=".ttf,.woff,.woff2,font/ttf,font/woff,font/woff2"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-100 dark:bg-[#222] hover:bg-slate-200 dark:hover:bg-[#333] text-slate-700 dark:text-slate-300 px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors border border-dashed border-slate-300 dark:border-slate-500"
            >
              <FileUp className="w-5 h-5" />
              Завантажити шрифт (.ttf/woff)
            </button>
            {config.customFontName && (
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <span className="font-medium text-sm truncate max-w-[150px]">{config.customFontName}</span>
                <button
                  onClick={() => setConfig({ ...config, customFontBase64: undefined, customFontName: undefined })}
                  className="hover:bg-indigo-200 dark:hover:bg-indigo-800 p-1 rounded-full text-indigo-600 dark:text-indigo-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">Виберіть файл шрифту, який перекриє стандартні шрифти (max: 2MB).</p>
        </div>
      </div>
    </div>
  );
};
