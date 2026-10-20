import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space / K', desc: 'Play or Pause playback' },
    { key: '← / →', desc: 'Seek backward / forward 5 seconds' },
    { key: 'J / L', desc: 'Seek backward / forward 10 seconds' },
    { key: '↑ / ↓', desc: 'Adjust volume up / down 10%' },
    { key: 'M', desc: 'Toggle mute / unmute audio' },
    { key: 'F', desc: 'Toggle fullscreen video mode' },
    { key: 'P', desc: 'Toggle Picture-in-Picture window' },
    { key: 'C', desc: 'Toggle subtitles / captions' },
    { key: 'D', desc: 'Toggle P2P Stream Diagnostics HUD (Stats for Nerds)' },
    { key: '?', desc: 'Open this keyboard shortcuts cheat-sheet' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-neutral-950/95 border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.9)] relative text-white max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5 pr-8">
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/10 border border-white/15 text-white shrink-0">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">Shortcuts & Controls</h2>
            <p className="text-xs text-neutral-400">Desktop shortcuts and mobile touch controls</p>
          </div>
        </div>

        {/* Mobile Gestures Box */}
        <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300 flex flex-col gap-1.5">
          <span className="font-semibold text-white">📱 Mobile Touch Gestures:</span>
          <div className="flex flex-col gap-1 text-[11px] text-neutral-400 font-mono">
            <span>• Single tap: Show or hide controls</span>
            <span>• Double tap left/right: Seek 10s backward/forward</span>
            <span>• Hardware buttons: Control personal volume</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 divide-y divide-white/5">
          <div className="pb-1 text-[11px] font-mono uppercase tracking-wider text-neutral-500">
            Keyboard Shortcuts (Desktop)
          </div>
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2 text-xs">
              <span className="text-neutral-400">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/15 font-mono text-[10px] sm:text-[11px] text-white shadow-inner shrink-0">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
