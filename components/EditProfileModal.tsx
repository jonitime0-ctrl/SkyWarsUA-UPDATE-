import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, ChevronLeft, ChevronRight, Image as ImageIcon, MessageSquare } from 'lucide-react';

interface EditProfileModalProps {
  onClose: () => void;
  currentDisplayName: string;
  currentPhotoURL: string;
  onSave: (displayName: string, photoURL: string) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose, currentDisplayName, currentPhotoURL, onSave }) => {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [photoURL, setPhotoURL] = useState(currentPhotoURL);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);

  const handleAvatarUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
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
        setPhotoURL(dataUrl);
        setShowPhotoOptions(false);
        saveImmediate(displayName, dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveImmediate = async (name: string, photo: string) => {
     setIsSaving(true);
     await onSave(name, photo);
     setIsSaving(false);
  };

  const getInitials = (name: string) => {
    if (!name) return 'A';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  };

  if (showNameEdit) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#F5F5F5] dark:bg-[#0A0A0A]">
        <header className="flex items-center justify-between p-4 bg-transparent mt-4">
           <button onClick={() => setShowNameEdit(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-red-500">
              <X className="w-6 h-6" />
           </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-start mt-12 px-6">
           <div className="w-20 h-20 bg-gray-400 dark:bg-gray-600 rounded-2xl flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-white" />
           </div>
           
           <h2 className="text-3xl font-bold mb-2 text-center text-black dark:text-white">
              Як до вас звертатися?
           </h2>
           <p className="text-gray-600 dark:text-gray-400 text-center mb-10">
              Введіть бажаний варіант
           </p>

           <input 
              type="text" 
              className="w-full text-center text-xl font-medium bg-transparent border-b-2 border-gray-300 dark:border-gray-700 pb-2 outline-none focus:border-red-500 transition-colors text-black dark:text-white"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoFocus
           />
        </div>

        <div className="p-4 bg-[#F5F5F5] dark:bg-[#0A0A0A] pb-8 pt-4">
           <button 
              disabled={isSaving || !displayName.trim() || displayName === currentDisplayName}
              onClick={async () => {
                 await saveImmediate(displayName, photoURL);
                 setShowNameEdit(false);
              }}
              className="w-full py-4 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium text-sm transition-colors disabled:opacity-50"
              style={{ backgroundColor: (displayName.trim() && displayName !== currentDisplayName) ? '#E5E5E5' : undefined, color: (displayName.trim() && displayName !== currentDisplayName) ? '#000' : undefined }}
           >
              {isSaving ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ'}
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F5F5] dark:bg-[#0A0A0A]">
      <header className="flex items-center px-4 py-4 mt-2">
         <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-red-500">
            <ChevronLeft className="w-6 h-6" />
         </button>
         <h2 className="text-xl font-medium ml-2 text-black dark:text-white">Редагування даних</h2>
      </header>
      
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
         <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 flex flex-col items-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="w-24 h-24 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-4xl text-white font-medium overflow-hidden shadow-sm mb-6">
               {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                  <span>{getInitials(displayName)}</span>
               )}
            </div>
            
            <button 
                onClick={() => setShowPhotoOptions(true)} 
                className="w-full uppercase tracking-widest text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 py-3 rounded-xl transition-colors"
            >
               Додати фото
            </button>
         </div>

         <button 
            onClick={() => setShowNameEdit(true)}
            className="w-full bg-white dark:bg-[#1A1A1A] rounded-3xl p-4 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-gray-50 dark:hover:bg-[#222] transition-colors text-left"
         >
            <div className="w-12 h-12 rounded-2xl bg-gray-400 dark:bg-gray-600 flex items-center justify-center shrink-0">
               <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
               <h3 className="text-lg font-medium text-black dark:text-white">Як до вас звертатися?</h3>
               <p className="text-gray-500 dark:text-gray-400 text-sm">{displayName}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
         </button>
         <p className="text-xs text-gray-500 px-4">
            Це ім'я буде відображатися в застосунку
         </p>
      </div>

      <AnimatePresence>
      {showPhotoOptions && (
         <div className="fixed inset-0 z-[60] flex flex-col bg-[#F5F5F5] dark:bg-[#0A0A0A]">
            <header className="flex items-center justify-between p-4 bg-transparent mt-4">
               <button onClick={() => setShowPhotoOptions(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-red-500">
                  <X className="w-6 h-6" />
               </button>
            </header>

            <div className="flex-1 flex flex-col items-center justify-start mt-6 px-4">
               <div className="w-24 h-24 rounded-full bg-transparent border-2 border-red-500 p-1 mb-4">
                 <div className="w-full h-full bg-gray-400 dark:bg-gray-600 rounded-full flex items-center justify-center text-4xl text-white font-medium overflow-hidden">
                   {photoURL ? (
                      <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                   ) : (
                      <span>{getInitials(displayName)}</span>
                   )}
                 </div>
               </div>
               
               <h2 className="text-2xl font-bold mb-2 text-center text-black dark:text-white">
                  Фото профілю
               </h2>
               <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
                  Оберіть зручний спосіб заміни
               </p>

               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpdate} />
               
               <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                  <button 
                     onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }} 
                     className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors border-b border-gray-100 dark:border-gray-800 text-left"
                  >
                     <div className="w-12 h-12 rounded-xl bg-gray-800 dark:bg-gray-700 flex items-center justify-center shrink-0">
                        <Camera className="w-6 h-6 text-white" />
                     </div>
                     <span className="font-medium text-lg text-black dark:text-white flex-1">Зробити нове фото</span>
                     <ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                  <button 
                     onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }} 
                     className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors text-left"
                  >
                     <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-6 h-6 text-white" />
                     </div>
                     <span className="font-medium text-lg text-black dark:text-white flex-1">Вибрати з галереї</span>
                     <ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
               </div>
            </div>
         </div>
      )}
      </AnimatePresence>
    </div>
  );
};

