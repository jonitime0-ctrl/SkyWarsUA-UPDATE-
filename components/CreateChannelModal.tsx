import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Camera, Lock, Users, Shield } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

interface CreateChannelModalProps {
  onClose: () => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [writeAccess, setWriteAccess] = useState<'admin_only' | 'all_members'>('admin_only');
  const [passcode, setPasscode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(users.filter(u => u.id !== auth.currentUser?.uid));
      } catch (error) {
        console.error("Error fetching users", error);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !auth.currentUser) return;

    setIsSubmitting(true);
    try {
      const channelData: any = {
        name: name.trim(),
        adminId: auth.currentUser.uid,
        members: [auth.currentUser.uid, ...selectedUsers],
        bannedUsers: [],
        writeAccess,
        createdAt: serverTimestamp(),
      };

      if (avatarUrl.trim()) {
        channelData.avatarUrl = avatarUrl.trim();
      }
      
      if (passcode.trim()) {
        channelData.passcode = passcode.trim();
      }

      console.log("Adding document to channels...", channelData);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Перевищено час очікування (Timeout). Перевірте з'єднання з інтернетом або налаштування Firebase.")), 15000)
      );
      
      await Promise.race([
        addDoc(collection(db, 'channels'), channelData),
        timeoutPromise
      ]);
      
      console.log("Document added successfully!");
      onClose();
    } catch (error) {
      console.error("Error adding document:", error);
      alert("Помилка при створенні каналу: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      console.log("Finally block executed");
      setIsSubmitting(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Створити канал</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Avatar URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Аватарка (URL)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Camera className="w-5 h-5" />
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Channel Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Назва каналу *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введіть назву"
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Write Access */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Хто може писати?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWriteAccess('admin_only')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-colors ${
                  writeAccess === 'admin_only' 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Shield className="w-6 h-6" />
                <span className="text-sm font-medium">Лише адмін</span>
              </button>
              <button
                type="button"
                onClick={() => setWriteAccess('all_members')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-colors ${
                  writeAccess === 'all_members' 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Users className="w-6 h-6" />
                <span className="text-sm font-medium">Всі учасники</span>
              </button>
            </div>
          </div>

          {/* Passcode */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Код-пароль (необов'язково)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="text"
                maxLength={4}
                pattern="\d{4}"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                placeholder="4 цифри"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <p className="text-xs text-slate-500">Залиште порожнім для відкритого каналу</p>
          </div>

          {/* Add Users */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Додати учасників</label>
              <button
                type="button"
                onClick={() => {
                  if (selectedUsers.length === allUsers.length) {
                    setSelectedUsers([]);
                  } else {
                    setSelectedUsers(allUsers.map(u => u.id));
                  }
                }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {selectedUsers.length === allUsers.length ? 'Скасувати всі' : 'Вибрати всіх'}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1">
              {allUsers.map(user => (
                <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                          {user.displayName?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{user.displayName || 'Невідомий'}</span>
                  </div>
                </label>
              ))}
              {allUsers.length === 0 && (
                <div className="text-center text-sm text-slate-500 py-4">Немає інших користувачів</div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Створення...' : 'Створити канал'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
