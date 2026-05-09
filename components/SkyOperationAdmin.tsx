import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Radar, Users, Settings, Target } from 'lucide-react';

export const SkyOperationAdmin = () => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [baseOffset, setBaseOffset] = useState(1240);
  const [newOffset, setNewOffset] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'operation_sky_participants'), (snap) => {
      setParticipants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    onSnapshot(doc(db, 'settings', 'event_nebo'), (doc) => {
      if (doc.exists() && doc.data().fakeOffset !== undefined) {
        setBaseOffset(doc.data().fakeOffset);
        setNewOffset(String(doc.data().fakeOffset));
      } else {
        setNewOffset('1240');
      }
    });

    return () => unsub();
  }, []);

  const handleUpdateOffset = async () => {
    try {
      await setDoc(doc(db, 'settings', 'event_nebo'), { fakeOffset: Number(newOffset) }, { merge: true });
      alert('Збережено!');
    } catch (e) {
      console.error(e);
      alert('Помилка збереження');
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg mt-6">
      <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
        <Radar className="w-6 h-6 text-indigo-500" />
        Операція: НЕБО (Адмін)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 dark:bg-[#111] p-4 rounded-2xl border border-slate-200 dark:border-white/5">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-slate-500" />
            Зареєстровано (Реальних): {participants.length}
          </h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white dark:bg-[#1a1a1a] p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <div>
                  <div className="font-bold text-sm text-indigo-600 dark:text-indigo-400">{p.callsign}</div>
                  <div className="text-[10px] text-slate-500">ID: {p.id}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{p.score} pt</div>
                  <div className="text-[10px] text-emerald-500">
                    {p.tasks?.test_passed ? 'Тест пройдено' : 'В процесі'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-[#111] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            Налаштування Івенту
          </h3>
          
          <div>
            <label className="text-sm font-medium text-slate-500 block mb-2">Фейкова кількість учасників (Додається до реальних)</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                value={newOffset}
                onChange={(e) => setNewOffset(e.target.value)}
                className="flex-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333] rounded-xl px-4 py-2 outline-none"
              />
              <button 
                onClick={handleUpdateOffset}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700"
              >
                Зберегти
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Зараз користувачі бачать: <strong>{participants.length + baseOffset}</strong> учасників онлайн.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
