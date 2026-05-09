import React from 'react';
import { Crown } from 'lucide-react';

export const SponsorBadge: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <div className={`inline-flex items-center justify-center bg-yellow-500/20 text-yellow-500 rounded-full p-0.5 ${className}`} title="Спонсор">
    <Crown className="w-full h-full" />
  </div>
);
