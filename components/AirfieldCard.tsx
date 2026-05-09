
import React from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import { Airfield } from '../types';

interface AirfieldCardProps {
  airfield: Airfield;
  isMarked: boolean;
  onToggle: (id: string) => void;
  isAdmin: boolean;
}

export const AirfieldCard: React.FC<AirfieldCardProps> = ({ airfield, isMarked, onToggle, isAdmin }) => {
  return (
    <div className={`relative overflow-hidden rounded-[2rem] border-2 transition-all duration-500 
      ${isMarked ? 'border-[#FF3B30] bg-[#FF3B30]/5' : 'border-[#E5E5E5] dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A]'}`}>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="p-2 bg-[#F4F4F4] dark:bg-[#1A1A1A] rounded-lg text-[#A3A3A3]"><MapPin className="w-5 h-5" /></div>
          {isMarked && <span className="text-[10px] font-black uppercase text-[#FF3B30] flex items-center gap-1 animate-pulse"><AlertTriangle className="w-3 h-3" /> Пуск</span>}
        </div>
        <div>
          <h3 className="text-lg font-black">{airfield.name}</h3>
          <p className="text-xs text-[#A3A3A3] font-medium">{airfield.location}</p>
        </div>
        <button
          disabled={!isAdmin}
          onClick={() => onToggle(airfield.id)}
          className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all
            ${isMarked ? 'bg-[#FF3B30] text-white shadow-lg shadow-[#FF3B30]/30' : 'bg-[#F4F4F4] dark:bg-[#1A1A1A] text-[#A3A3A3]'}
            ${isAdmin ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
        >
          {isAdmin ? (isMarked ? "Скасувати пуск" : "Відмітити пуск") : (isMarked ? "⚠️ ЗАФІКСОВАНО ПУСК" : "Статус: Спокійно")}
        </button>
      </div>
    </div>
  );
};