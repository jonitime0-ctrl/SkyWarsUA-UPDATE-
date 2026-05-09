import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Dices, Trash2, AlertTriangle } from 'lucide-react';

export const RouletteAdmin: React.FC = () => {
  const [spins, setSpins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'rouletteSpins'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSpins(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rouletteSpins');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити цей запис?')) {
      try {
        await deleteDoc(doc(db, 'rouletteSpins', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `rouletteSpins/${id}`);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('УВАГА! Ви впевнені, що хочете видалити ВСІ записи рулетки? Цю дію неможливо скасувати.')) {
      setDeletingAll(true);
      try {
        const snapshot = await getDocs(collection(db, 'rouletteSpins'));
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        alert('Всі записи успішно видалено.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'rouletteSpins');
      } finally {
        setDeletingAll(false);
      }
    }
  };

  if (loading) return <div className="p-4 text-center">Завантаження...</div>;

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-emerald-500">
          <Dices className="w-6 h-6" />
          Історія Рулетки
        </h2>
        {spins.length > 0 && (
          <button 
            onClick={handleDeleteAll}
            disabled={deletingAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl transition-colors font-medium text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            {deletingAll ? 'Видалення...' : 'Очистити список'}
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {spins.map(spin => (
          <div key={spin.id} className="p-4 bg-gray-50 dark:bg-[#111] rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold">{spin.userName || 'Невідомий'}</p>
              <p className="text-sm text-gray-500">{spin.userEmail}</p>
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                <p className={`font-bold text-sm ${spin.prizeType === 'stars' ? 'text-yellow-500' : 'text-gray-500'}`}>
                  {spin.prizeName}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {spin.timestamp ? format(spin.timestamp.toDate(), 'dd.MM.yyyy HH:mm', { locale: uk }) : '---'}
                </p>
              </div>
              <button 
                onClick={() => handleDelete(spin.id)}
                className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Видалити запис"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {spins.length === 0 && <p className="text-center text-gray-500">Поки що ніхто не крутив рулетку.</p>}
      </div>
    </div>
  );
};
