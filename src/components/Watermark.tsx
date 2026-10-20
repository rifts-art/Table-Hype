import React from 'react';

interface WatermarkProps {
  className?: string;
  variant?: 'subtle' | 'badge' | 'minimal';
}

export const Watermark: React.FC<WatermarkProps> = ({ className = '', variant = 'badge' }) => {
  if (variant === 'minimal') {
    return (
      <span className={`text-[10px] tracking-widest uppercase font-mono text-neutral-400 select-none ${className}`}>
        Leme Product
      </span>
    );
  }

  if (variant === 'subtle') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-[11px] text-neutral-300 font-medium select-none ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse"></span>
        <span className="tracking-wider uppercase text-[10px] text-neutral-200 font-mono">Leme Product</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/60 border border-white/10 backdrop-blur-xl shadow-lg select-none ${className}`}>
      <div className="w-2 h-2 rounded-sm bg-white rotate-45 opacity-80" />
      <span className="text-xs font-semibold tracking-wider uppercase text-neutral-200">
        Leme Product
      </span>
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono">
        ORIGINAL
      </span>
    </div>
  );
};
