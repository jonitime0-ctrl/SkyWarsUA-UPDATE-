import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { MaintenanceConfig } from './MaintenanceSettings';
import { MaintenanceScreen } from './MaintenanceScreen';

interface SectionBlockerProps {
  user: any;
  children: React.ReactNode;
}

export const SectionBlocker: React.FC<SectionBlockerProps> = ({ user, children }) => {
  const location = useLocation();
  const path = location.pathname.split('/')[1] || 'dashboard'; // e.g., 'community', 'aviation', '' -> 'dashboard'
  
  const [maintenance, setMaintenance] = useState<MaintenanceConfig | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'maintenance'), (docSnap) => {
      if (docSnap.exists()) {
        setMaintenance(docSnap.data() as MaintenanceConfig);
      }
    });
    return () => unsub();
  }, []);

  const isAdmin = user?.email === 'olegkucher2311@gmail.com';

  if (maintenance?.enabled && !isAdmin) {
    if (maintenance.global || maintenance.blockedSections.includes(path)) {
      return <MaintenanceScreen message={maintenance.message} endTime={maintenance.endTime} />;
    }
  }

  if (user?.isGuest && path !== 'dashboard' && path !== 'settings') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-blue-500/10 border border-blue-500/20 p-8 rounded-3xl max-w-md w-full flex flex-col items-center">
          <AlertTriangle className="w-16 h-16 text-blue-500 mb-6" />
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-4">
            Доступно після реєстрації
          </h2>
          <p className="text-blue-400 font-medium mb-6">
            Цей розділ доступний лише для авторизованих користувачів. Будь ласка, увійдіть або зареєструйтесь для доступу.
          </p>
          <a href="/" onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-2xl transition-colors">
            Перейти до авторизації
          </a>
        </div>
      </div>
    );
  }

  const blockedSections = user?.blockedSections || [];
  const frozenFeatures = user?.frozenFeatures || [];
  const isBlocked = blockedSections.includes(path) || 
                    (path === 'gifts' && frozenFeatures.includes('gifts')) || 
                    (path === 'community' && frozenFeatures.includes('community')) ||
                    ((path === 'chat' || path === 'channel') && frozenFeatures.includes('chat'));

  if (isBlocked) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl max-w-md w-full flex flex-col items-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-4">
            Доступ Заблоковано
          </h2>
          <p className="text-red-400 font-medium mb-6">
            ‼️ Доступ до даного розділу заблоковано! Причина вказана в біо. Якщо ви отримали бан не коректно зверніться до адміністратора.
          </p>
          {user?.description && (
            <div className="bg-black/20 p-4 rounded-xl w-full text-left">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Причина (Біо):</span>
              <span className="text-gray-300 text-sm">{user.description}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
