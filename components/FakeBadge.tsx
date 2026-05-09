import React from 'react';
import { AlertOctagon } from 'lucide-react';

export const FakeBadge: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <div className={`inline-flex items-center justify-center bg-red-500/10 text-red-500 rounded-full p-0.5 ${className}`} title="FAKE - Користувач не є тим, за кого себе видає">
    <AlertOctagon className="w-full h-full" />
  </div>
);
