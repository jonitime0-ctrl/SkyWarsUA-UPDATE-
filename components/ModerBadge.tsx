import React from 'react';

export const ModerBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 border-2 border-[#00FFFF] text-[#00FFFF] font-black uppercase tracking-widest text-[8px] rounded-md ${className}`}>
    MODER
  </span>
);
