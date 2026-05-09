import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Save, Camera, Users, Settings as SettingsIcon } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface ChannelSettingsModalProps {
  channel: any;
  onClose: () => void;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({ channel, onClose }) => {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [type, setType] = useState(channel.type || 'public');
  const [avatarUrl, setAvatarUrl] = useState(channel.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'channels', channel.id), {
        name,
        description,
        type,
        avatarUrl
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `channels/${channel.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Налаштування каналу</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <input 
            value={avatarUrl} 
            onChange={(e) => setAvatarUrl(e.target.value)} 
            className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm" 
            placeholder="URL аватарки (https://...)"
          />
        </div>

        <input 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" 
          placeholder="Назва каналу"
        />
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" 
          placeholder="Опис (до 70 слів)"
          rows={3}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
          <option value="public">Публічний</option>
          <option value="private">Приватний</option>
        </select>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full p-3 rounded-xl bg-blue-600 text-white font-bold"
        >
          {isSaving ? 'Збереження...' : 'Зберегти'}
        </button>
      </motion.div>
    </div>
  );
};
