import React from 'react';
import { Settings, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface MaintenanceScreenProps {
  message: string;
  endTime?: string;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ message, endTime }) => {
  return (
    <div className="min-h-screen bg-[#F4F4F4] dark:bg-[#0A0A0A] flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white dark:bg-[#1A1A1A] max-w-2xl w-full rounded-[2rem] p-8 md:p-12 shadow-2xl border border-[#E5E5E5] dark:border-[#333] flex flex-col items-center relative overflow-hidden">
        
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-orange-500 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-yellow-500 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-8">
            <Settings className="w-12 h-12 text-orange-500 animate-[spin_4s_linear_infinite]" />
          </div>

          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-6 text-slate-900 dark:text-white">
            Технічні роботи
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-lg whitespace-pre-wrap">
            {message || 'Зараз на сайті ведуться технічні роботи. Спробуйте зайти пізніше. Вибачаємось за тимчасові незручності.'}
          </p>

          {endTime && (
            <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 px-6 py-4 rounded-2xl border border-orange-200 dark:border-orange-800/50">
              <Clock className="w-6 h-6 text-orange-500" />
              <div className="text-left">
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Орієнтовний час завершення:</p>
                <p className="font-bold text-slate-900 dark:text-white">
                  {format(new Date(endTime), 'd MMMM yyyy, HH:mm', { locale: uk })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
