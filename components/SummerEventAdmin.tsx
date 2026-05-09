import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Sun, Trash2 } from 'lucide-react';

export const SummerEventAdmin: React.FC = () => {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'summerClaims'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClaims(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'summerClaims');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити цей запис?')) {
      try {
        await deleteDoc(doc(db, 'summerClaims', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `summerClaims/${id}`);
      }
    }
  };

  if (loading) return <div className="p-4 text-center">Завантаження...</div>;

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg space-y-4">
      <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2 text-orange-500">
        <Sun className="w-6 h-6" />
        Історія літнього івенту
      </h2>
      <div className="space-y-2">
        {claims.map(claim => (
          <div key={claim.id} className="p-4 bg-gray-50 dark:bg-[#111] rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold">{claim.userName || 'Невідомий'}</p>
              <p className="text-sm text-gray-500">{claim.userEmail}</p>
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                {claim.rewardText ? (
                  <p className="font-bold text-orange-500 text-sm">{claim.rewardText}</p>
                ) : (
                  <p className="font-bold text-gray-500 text-sm">Без нагороди</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {claim.timestamp ? format(claim.timestamp.toDate(), 'dd.MM.yyyy HH:mm', { locale: uk }) : '---'}
                </p>
              </div>
              <button 
                onClick={() => handleDelete(claim.id)}
                className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Видалити запис"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {claims.length === 0 && <p className="text-center text-gray-500">Поки що ніхто не знаходив предмети.</p>}
      </div>
    </div>
  );
};
