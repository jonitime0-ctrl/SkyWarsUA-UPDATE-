import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, Heart, MessageCircle, UserPlus, CheckCircle2 } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface NotificationsProps {
  isAdmin?: boolean;
}

import { SummerItemDisplay } from '../components/SummerItemDisplay';
import { SummerEventConfig } from '../components/SummerEventSettings';
import { DailyRoulette } from '../components/DailyRoulette';

export const Notifications: React.FC<NotificationsProps> = ({ isAdmin }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summerConfig, setSummerConfig] = useState<SummerEventConfig | null>(null);

  useEffect(() => {
    const fetchSummerConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'summerEvent');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSummerConfig(docSnap.data() as SummerEventConfig);
        }
      } catch (error) {
        console.error("Error fetching summer config:", error);
      }
    };
    fetchSummerConfig();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}/notifications`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (notificationId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}/notifications/${notificationId}`);
    }
  };

  const markAllAsRead = async () => {
    if (!auth.currentUser || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        if (!notif.read) {
          const ref = doc(db, 'users', auth.currentUser!.uid, 'notifications', notif.id);
          batch.update(ref, { read: true });
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}/notifications`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-6 px-4 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">Сповіщення</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Історія ваших активностей</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">Прочитати всі</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Активності немає</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => !notification.read && markAsRead(notification.id)}
              className={`p-4 rounded-2xl border transition-colors cursor-pointer flex gap-4 ${
                notification.read
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50'
              }`}
            >
              <div className="shrink-0 mt-1">
                {notification.type === 'follow' && <UserPlus className="w-6 h-6 text-green-500" />}
                {notification.type === 'reaction' && <Heart className="w-6 h-6 text-red-500" />}
                {notification.type === 'comment' && <MessageCircle className="w-6 h-6 text-blue-500" />}
              </div>
              <div className="flex-1">
                <p className="text-slate-900 dark:text-white text-sm">
                  <span className="font-semibold">{notification.fromUserName}</span>
                  {notification.type === 'follow' && ' підписався(лась) на вас.'}
                  {notification.type === 'reaction' && ` відреагував(ла) ${notification.emoji} на ваш допис.`}
                  {notification.type === 'comment' && ' прокоментував(ла) ваш допис.'}
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  {notification.createdAt ? format(notification.createdAt.toDate(), 'd MMMM yyyy, HH:mm', { locale: uk }) : '...'}
                </span>
              </div>
              {!notification.read && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
              )}
            </motion.div>
          ))}
        </div>
      )}

      <SummerItemDisplay section="notifications" isAdmin={isAdmin} />
      <DailyRoulette />

      {summerConfig?.enabled && summerConfig?.instructionEnabled && summerConfig?.instructionPhotoUrl && (
        <div className="mt-8 mb-8 flex justify-center">
          <img 
            src={summerConfig.instructionPhotoUrl} 
            alt="Summer Event Instruction" 
            className="w-full max-w-md rounded-2xl shadow-xl"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};
