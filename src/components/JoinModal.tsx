import React, { useState } from 'react';
import { X, Key, ArrowRight, AlertCircle, Sparkles, User } from 'lucide-react';
import { validateTableKeyFormat } from '../utils/videoUtils';

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (key: string, nickname: string) => void;
  initialKey?: string;
  initialNickname?: string;
}

export const JoinModal: React.FC<JoinModalProps> = ({
  isOpen,
  onClose,
  onJoin,
  initialKey = '',
  initialNickname = ''
}) => {
  const [tableKey, setTableKey] = useState(initialKey);
  const [nickname, setNickname] = useState(initialNickname || 'Viewer');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = tableKey.trim().toUpperCase();
    const cleanNick = nickname.trim() || 'Viewer';

    if (!cleanKey) {
      setError('Please enter a Table Key.');
      return;
    }

    if (!validateTableKeyFormat(cleanKey)) {
      setError('Invalid Table Key format. Expected format like TAB-7X4K-92 or 6-12 characters.');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Check if table exists on server
      const res = await fetch(`/api/tables/${cleanKey}`);
      const data = await res.json();

      if (!res.ok || !data.exists) {
        setError('Table room not found. Please check the key or create a new Table.');
        setIsValidating(false);
        return;
      }

      onJoin(cleanKey, cleanNick);
      onClose();
    } catch {
      // In case of transient offline, allow joining via socket
      onJoin(cleanKey, cleanNick);
      onClose();
    } finally {
      setIsValidating(false);
    }
  };

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

        <div className="flex items-center gap-3 mb-5 sm:mb-6 pr-8">
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/10 border border-white/15 text-white shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">Join a Table</h2>
            <p className="text-xs text-neutral-400">Enter a Table Key to sync streams with your partner</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-neutral-400" />
              Table Key
            </label>
            <input
              id="join-table-key-input"
              type="text"
              value={tableKey}
              onChange={(e) => {
                setTableKey(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="e.g. TAB-7X4K-92"
              maxLength={24}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-base tracking-wider placeholder-neutral-600 focus:outline-none focus:border-white/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              Your Display Name
            </label>
            <input
              id="join-nickname-input"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-white/50 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              id="join-submit-btn"
              type="submit"
              disabled={isValidating || !tableKey.trim()}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
            >
              {isValidating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Connecting to Table...</span>
                </>
              ) : (
                <>
                  <span>Join Table</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
