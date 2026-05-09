import React from 'react';

export const AdminBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 border-2 border-[#FF00FF] text-[#FF00FF] font-black uppercase tracking-widest text-[8px] rounded-md ${className}`}>
    ADMIN
  </span>
);
