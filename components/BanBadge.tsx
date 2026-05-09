import React from 'react';
import { Ban } from 'lucide-react';

export const BanBadge: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <div className={`inline-flex items-center justify-center bg-slate-800 text-red-600 rounded-full p-0.5 ${className}`} title="BAN - Акаунт заблоковано">
    <Ban className="w-full h-full" />
  </div>
);
