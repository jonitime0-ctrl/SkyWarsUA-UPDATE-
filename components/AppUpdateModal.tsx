import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Camera } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface AppUpdateModalProps {
  onClose: () => void;
  isAdmin: boolean;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ onClose, isAdmin }) => {
  const [updateInfo, setUpdateInfo] = useState({
    version: 'iOS 18.7',
    description: 'Оновлення включає в себе виправлення помилок та покращення.',
    logoUrl: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(updateInfo);
  const [localVersion, setLocalVersion] = useState(localStorage.getItem('lastInstalledAppVersion') || '');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string | null>(localStorage.getItem('scheduledAppUpdate'));
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'updateInfo'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as typeof updateInfo;
        setUpdateInfo(data);
        setEditData(data);
      }
    });
    return () => unsub();
  }, []);

  const isUpToDate = localVersion === updateInfo.version && !isEditing;

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'settings', 'updateInfo'), editData);
      setIsEditing(false);
      // When admin saves a new version, they themselves might need to update.
    } catch (e) {
      console.error(e);
    }
  };

  const clearServiceWorkers = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(const registration of registrations) {
          registration.unregister();
        }
      });
    }
  };

  const handleUpdateNow = () => {
    clearServiceWorkers();
    localStorage.setItem('lastInstalledAppVersion', updateInfo.version);
    localStorage.removeItem('scheduledAppUpdate');
    window.location.reload(true);
  };

  const handleScheduleUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    if (time) {
      setScheduledTime(time);
      localStorage.setItem('scheduledAppUpdate', time);
      localStorage.setItem('scheduledAppUpdateVersion', updateInfo.version);
      alert(`Оновлення заплановано на ${time}.`);
      setShowTimePicker(false);
    }
  };

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
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        ctx?.drawImage(img, x, y, size, size, 0, 0, 400, 400);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setEditData({ ...editData, logoUrl: dataUrl });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#F2F2F7] dark:bg-[#000000] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1C1C1E] sm:bg-[#F2F2F7] sm:dark:bg-[#000000] sm:border-b sm:border-gray-300 dark:border-gray-800 shrink-0 sticky top-0 z-10">
        <button onClick={onClose} className="flex items-center text-[#007AFF] text-[17px]">
          <ChevronLeft className="w-6 h-6 -ml-1" />
          <span>Назад</span>
        </button>
        <span className="font-semibold text-[17px] text-black dark:text-white">Оновлення ПЗ</span>
        <div className="w-16 flex justify-end">
          {isAdmin && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-[#007AFF] text-[17px]">Ред.</button>
          )}
          {isAdmin && isEditing && (
            <button onClick={handleSave} className="text-[#007AFF] font-semibold text-[17px]">Готово</button>
          )}
        </div>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 font-sans">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl px-4 py-3.5 mb-8 flex justify-between items-center shadow-sm">
          <span className="text-[17px] text-black dark:text-white">Автооновлення</span>
          <span className="text-[17px] text-[#8E8E93]">Увімкнено <span className="ml-1 text-gray-300 dark:text-gray-600 font-bold">{'>'}</span></span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-2xl shadow-sm mb-6 flex flex-col h-auto min-h-[400px]">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
            <div className={`relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-[18px] sm:rounded-[22px] overflow-hidden flex items-center justify-center text-4xl font-black text-gray-400 ${isUpToDate ? 'bg-transparent' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {isEditing ? (
                editData.logoUrl ? <img src={editData.logoUrl} className="w-full h-full object-cover" /> : <span className="bg-slate-100 dark:bg-slate-800 w-full h-full flex items-center justify-center">18</span>
              ) : (
                updateInfo.logoUrl ? <img src={updateInfo.logoUrl} className="w-full h-full object-cover" /> : <span className={`${isUpToDate ? 'hidden' : 'bg-slate-100 dark:bg-slate-800 w-full h-full flex items-center justify-center'}`}>18</span>
              )}
              {isEditing && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 text-white flex items-center justify-center"
                >
                  <Camera className="w-8 h-8" />
                </button>
              )}
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            </div>
            <div className="flex-1 flex flex-col justify-center w-full">
              {isEditing ? (
                <input 
                  value={editData.version} 
                  onChange={e => setEditData({...editData, version: e.target.value})} 
                  className="w-full text-2xl sm:text-[28px] font-bold bg-transparent outline-none border-b border-gray-300 dark:border-gray-700 text-black dark:text-white pb-1 text-center sm:text-left"
                />
              ) : (
                <h2 className="text-2xl sm:text-[28px] font-bold text-black dark:text-white text-center sm:text-left">{updateInfo.version}</h2>
              )}
              {isUpToDate && (
                <p className="text-[17px] text-[#8E8E93] text-center sm:text-left mt-1">Ви встановили останню версію.</p>
              )}
            </div>
          </div>

          <div className="flex-1 pt-2">
            {isUpToDate ? (
              <div className="text-[17px] text-center text-[#8E8E93] mt-20">
                Нових оновлень поки немає.
              </div>
            ) : isEditing ? (
              <textarea 
                value={editData.description} 
                onChange={e => setEditData({...editData, description: e.target.value})}
                className="w-full h-[250px] bg-transparent text-[16px] leading-relaxed text-black dark:text-white resize-none outline-none"
                placeholder="Введіть опис оновлення..."
              />
            ) : (
              <div className="text-[16px] leading-relaxed text-black dark:text-white whitespace-pre-wrap">
                {updateInfo.description}
              </div>
            )}
          </div>
        </div>

        {!isEditing && !isUpToDate && (
          <div className="space-y-3 mt-4">
            <button onClick={handleUpdateNow} className="w-full bg-[#007AFF] hover:bg-[#005bb5] transition-colors text-white font-semibold text-[17px] py-[14px] rounded-2xl shadow-sm">
              Оновити зараз
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowTimePicker(!showTimePicker)} 
                className="w-full text-[#007AFF] font-medium text-[17px] py-[14px] rounded-2xl transition-colors hover:bg-gray-100 dark:hover:bg-[#2C2C2E]"
              >
                Оновити вночі {scheduledTime && `(Заплановано на ${scheduledTime})`}
              </button>
              {showTimePicker && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-white dark:bg-[#2C2C2E] p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-20 flex flex-col items-center">
                  <span className="text-sm text-gray-500 mb-2">Оберіть час оновлення</span>
                  <input 
                    type="time" 
                    className="bg-transparent text-xl font-bold p-2 outline-none dark:text-white dark:[color-scheme:dark]"
                    onChange={handleScheduleUpdate}
                  />
                </div>
              )}
            </div>
            <div className="w-full px-4 text-center mt-2">
               <p className="text-[13px] text-[#8E8E93] leading-snug">
                 Якщо вибрати "Оновити вночі", пристрій спробує інсталювати це оновлення пізніше автоматично.
               </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
