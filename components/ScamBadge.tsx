import React from 'react';
import { Skull } from 'lucide-react';

export const ScamBadge: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <div className={`inline-flex items-center justify-center bg-orange-500/10 text-orange-500 rounded-full p-0.5 ${className}`} title="SCAM - Користувач був помічений за обманом">
    <Skull className="w-full h-full" />
  </div>
);
