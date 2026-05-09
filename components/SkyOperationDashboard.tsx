import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Send, Users, ShieldAlert, CheckCircle2, Medal, Terminal } from 'lucide-react';
import { playSuccess, playError } from '../lib/sounds';

export const SkyOperationDashboard = () => {
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const [baseOffset, setBaseOffset] = useState(1240);
  
  const [cipherInput, setCipherInput] = useState('');
  const [cipherResult, setCipherResult] = useState<'idle' | 'success' | 'error'>('idle');

  // Hardcoded cipher for today, in real app could be fetched from DB
  const todayCipher = {
    id: `cipher-${new Date().toISOString().split('T')[0]}`,
    question: 'Як називається український протикорабельний комплекс, який потопив "Москву"?',
    answer: 'НЕПТУН',
    points: 50
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'operation_sky_participants', auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        setParticipant({ id: doc.id, ...doc.data() });
      } else {
        setParticipant(null);
      }
      setLoading(false);
    });

    const unsubParams = onSnapshot(doc(db, 'settings', 'event_nebo'), (doc) => {
      if (doc.exists() && doc.data().fakeOffset !== undefined) {
        setBaseOffset(doc.data().fakeOffset);
      }
    });

    const unsubAll = onSnapshot(collection(db, 'operation_sky_participants'), (snap) => {
      setActiveCount(snap.docs.length);
    });

    return () => {
      unsub();
      unsubParams();
      unsubAll();
    };
  }, []);

  const handleCipherSubmit = async () => {
    if (!auth.currentUser || !participant) return;
    
    if (cipherInput.trim().toUpperCase() === todayCipher.answer.toUpperCase()) {
      playSuccess();
      setCipherResult('success');
      try {
        await updateDoc(doc(db, 'operation_sky_participants', auth.currentUser.uid), {
          score: increment(todayCipher.points),
          dailyCiphersDone: [...(participant.dailyCiphersDone || []), todayCipher.id]
        });
      } catch (e) {
         console.error(e);
      }
    } else {
      playError();
      setCipherResult('error');
      setTimeout(() => setCipherResult('idle'), 1500);
    }
  };

  const completeTask = async (taskId: string, points: number) => {
    if (!auth.currentUser || !participant) return;
    try {
      playSuccess();
      await updateDoc(doc(db, 'operation_sky_participants', auth.currentUser.uid), {
        [`tasks.${taskId}`]: true,
        score: increment(points)
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="mb-12 mt-8 flex flex-col items-center justify-center p-12 bg-slate-900 rounded-[2.5rem] border border-slate-800 animate-pulse">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Синхронізація з сервером...</p>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="mb-12 mt-8 flex flex-col items-center justify-center p-12 bg-slate-900 rounded-[2.5rem] border border-red-500/30">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-2xl font-black uppercase text-white mb-2">ПОМИЛКА ДОСТУПУ</h3>
        <p className="text-slate-400 font-bold text-center">
          Ваш профіль не знайдено у базі даних операції. Можливо сталася помилка під час реєстрації або немає інтернет-з'єднання.
        </p>
        <button 
           onClick={() => { localStorage.removeItem('quest_sky2026_done'); window.location.reload() }}
           className="mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all"
        >
          Пройти тестування знову
        </button>
      </div>
    );
  }

  const isCipherDone = participant.dailyCiphersDone?.includes(todayCipher.id);

  return (
    <div className="mb-12 mt-8 space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-2xl font-black uppercase tracking-widest text-slate-900 dark:text-white">Штаб Операції</h3>
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-xl font-bold text-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {activeCount + baseOffset} осіб в мережі
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 space-y-8 relative overflow-hidden border border-slate-800">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px)] bg-[size:40px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center relative z-10">
          <div>
            <span className="text-slate-400 font-mono text-xs uppercase tracking-widest block mb-1">Ваш Позивний</span>
            <div className="text-3xl font-black text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
              {participant.callsign}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <Medal className="w-8 h-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-black text-white">{participant.score}</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Балів</div>
            </div>
          </div>
        </div>

        {/* Daily Cipher */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h4 className="font-bold text-white uppercase tracking-widest text-sm">Щоденна Шифровка</h4>
          </div>
          
          {isCipherDone ? (
            <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-bold text-sm">Шифровку розгадано! Отримано {todayCipher.points} балів.</span>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm font-medium leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5">
                {todayCipher.question}
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={cipherInput}
                  onChange={(e) => setCipherInput(e.target.value)}
                  placeholder="Відповідь..."
                  className={`flex-1 bg-black/50 border ${cipherResult === 'error' ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 font-mono uppercase transition-colors`}
                  onKeyDown={(e) => e.key === 'Enter' && handleCipherSubmit()}
                />
                <button
                  onClick={handleCipherSubmit}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Tasks */}
        <div className="relative z-10">
          <h4 className="font-bold text-white uppercase tracking-widest text-sm mb-4">Швидкі Завдання</h4>
          <div className="space-y-3">
            
            <TaskCard 
              title="Підписка на СЕКРЕТНИЙ КАНАЛ" 
              points={100} 
              isDone={participant.tasks?.telegram_sub} 
              onComplete={() => completeTask('telegram_sub', 100)} 
            />
            
            <TaskCard 
              title="Запросити 3 побратимів" 
              points={300} 
              isDone={participant.tasks?.invites_done} 
              desc="Використайте реферальну систему (демо)"
              onComplete={() => completeTask('invites_done', 300)} 
            />
            
            <TaskCard 
              title="Пройти тест 'Військова техніка'" 
              points={250} 
              isDone={participant.tasks?.test_passed} 
              onComplete={() => completeTask('test_passed', 250)} 
            />

          </div>
        </div>

      </div>
    </div>
  );
};

const TaskCard = ({ title, desc, points, isDone, onComplete }: any) => {
  return (
    <div className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 rounded-2xl border transition-all ${isDone ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
      <div>
        <h5 className={`font-bold text-sm ${isDone ? 'text-emerald-400' : 'text-white'}`}>{title}</h5>
        {desc && <p className="text-slate-400 text-xs mt-1">{desc}</p>}
      </div>
      
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
        <span className="text-yellow-500 font-bold text-sm">+{points} pt</span>
        {isDone ? (
          <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/20 px-4 py-2 rounded-xl text-sm font-bold">
            <CheckCircle2 className="w-4 h-4" /> ВИКОНАНО
          </div>
        ) : (
          <button 
            onClick={onComplete}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
          >
            ПОЧАТИ
          </button>
        )}
      </div>
    </div>
  );
};
