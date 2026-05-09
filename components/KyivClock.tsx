
import React, { useState, useEffect } from 'react';

export const KyivClock: React.FC = () => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTime(new Intl.DateTimeFormat('uk-UA', {
        timeZone: 'Europe/Kyiv',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date()));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Kyiv Time</div>
      <div className="text-lg font-mono font-bold leading-none">{time}</div>
    </div>
  );
};