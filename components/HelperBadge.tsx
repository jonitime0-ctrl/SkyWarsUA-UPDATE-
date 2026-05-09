import React from 'react';

export const HelperBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 border-2 border-[#FFFF00] text-[#FFFF00] font-black uppercase tracking-widest text-[8px] rounded-md ${className}`}>
    HELPER
  </span>
);
