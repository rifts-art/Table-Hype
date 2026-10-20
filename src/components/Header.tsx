import React from 'react';
import { Sparkles, Key, Plus, Keyboard } from 'lucide-react';
import { Watermark } from './Watermark';

interface HeaderProps {
  currentTableKey: string | null;
  onGoHome: () => void;
  onCreateTable: () => void;
  onJoinTable: () => void;
  onOpenShortcuts: () => void;
  onOpenConverter: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTableKey,
  onGoHome,
  onCreateTable,
  onJoinTable,
  onOpenShortcuts,
  onOpenConverter
}) => {
  const scrollToSection = (id: string) => {
    onGoHome();
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <header className="sticky top-0 z-40 w-full px-3 sm:px-8 py-2.5 sm:py-3 bg-neutral-950/85 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between gap-2 transition-all">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 sm:gap-6 min-w-0 shrink-0">
        <div
          onClick={onGoHome}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none shrink-0"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white text-black flex items-center justify-center font-black tracking-tighter text-sm sm:text-base shadow-[0_0_20px_rgba(255,255,255,0.4)] group-hover:scale-105 transition-transform">
            T
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-lg font-extrabold tracking-widest text-white leading-none">
              TABLE
            </span>
            <span className="text-[8px] sm:text-[9px] font-mono tracking-widest text-neutral-400 uppercase hidden xs:inline">
              Synchronized Video
            </span>
          </div>
        </div>

        {/* Website Navigation Links */}
        {!currentTableKey && (
          <nav className="hidden md:flex items-center gap-5 text-xs text-neutral-400">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('supported-formats')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Formats
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </nav>
        )}
      </div>

      {/* Right Actions (Guaranteed No-Overlap on Mobile) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Vid to URL Converter Button */}
        <button
          id="header-converter-btn"
          type="button"
          onClick={onOpenConverter}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          title="Convert Local Video File or Cloud Link into Direct Stream URL"
        >
          <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
          <span className="hidden md:inline">Vid to URL</span>
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors hidden sm:flex cursor-pointer shrink-0"
          title="Keyboard Shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {!currentTableKey ? (
          <>
            <button
              id="header-join-btn"
              type="button"
              onClick={onJoinTable}
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
            >
              <Key className="w-3.5 h-3.5 text-neutral-400" />
              <span>Join<span className="hidden sm:inline"> Table</span></span>
            </button>

            <button
              id="header-create-btn"
              type="button"
              onClick={onCreateTable}
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create<span className="hidden sm:inline"> Table</span></span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onGoHome}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-all cursor-pointer active:scale-95 shrink-0"
          >
            Leave<span className="hidden sm:inline"> Room</span>
          </button>
        )}
      </div>
    </header>
  );
};
