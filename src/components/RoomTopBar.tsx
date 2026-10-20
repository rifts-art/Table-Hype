import React, { useState, useRef, useEffect } from 'react';
import {
  Key,
  Copy,
  Check,
  Users,
  Film,
  MessageSquare,
  Sparkles,
  Crown,
  Share2,
  LogOut,
  RefreshCw,
  Trash2,
  ChevronDown,
  Smile,
  Radio
} from 'lucide-react';
import { UserPresence, SyncStatus } from '../types';

interface RoomTopBarProps {
  tableKey: string;
  users: UserPresence[];
  myClientId: string;
  isHost: boolean;
  syncStatus: SyncStatus;
  latencyMs: number;
  videoTitle?: string;
  unreadChatCount: number;
  isChatOpen: boolean;
  onToggleChat: () => void;
  onOpenChangeVideo: () => void;
  onOpenConverter?: () => void;
  onSendReaction: (emoji: string) => void;
  onLeaveTable: () => void;
  onGenerateNewKey: () => void;
  onCloseRoom: () => void;
}

export const RoomTopBar: React.FC<RoomTopBarProps> = ({
  tableKey,
  users,
  myClientId,
  isHost,
  syncStatus,
  latencyMs,
  videoTitle,
  unreadChatCount,
  isChatOpen,
  onToggleChat,
  onOpenChangeVideo,
  onOpenConverter,
  onSendReaction,
  onLeaveTable,
  onGenerateNewKey,
  onCloseRoom
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);

  const roomMenuRef = useRef<HTMLDivElement>(null);
  const reactionsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (roomMenuRef.current && !roomMenuRef.current.contains(e.target as Node)) {
        setShowRoomMenu(false);
      }
      if (reactionsMenuRef.current && !reactionsMenuRef.current.contains(e.target as Node)) {
        setShowReactionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(tableKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?table=${tableKey}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const quickEmojis = ['🍿', '🔥', '👏', '❤️', '😱', '⚡'];
  const otherUsers = users.filter((u) => u.id !== myClientId);
  const me = users.find((u) => u.id === myClientId);

  return (
    <div className="w-full flex items-center justify-between gap-1.5 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl bg-neutral-950/85 backdrop-blur-2xl border border-white/10 shadow-lg text-xs transition-all">
      {/* Left: Table Key Pill with Click-to-Copy */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={handleCopyKey}
          title="Click to copy Table Key"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-mono font-semibold transition-all cursor-pointer active:scale-95 group shrink-0 text-[11px] sm:text-xs"
        >
          <Key className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
          <span>{tableKey}</span>
          {copiedKey ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3 text-neutral-400 group-hover:text-white" />
          )}
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          title="Copy direct invite link"
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer hidden sm:flex shrink-0"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>

        {/* Sync & Viewer status */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{users.length} {users.length === 1 ? 'Viewer' : 'Viewers'}</span>
          <span className="text-neutral-500">•</span>
          <span className="text-emerald-400">Synced</span>
          {latencyMs > 0 && <span className="text-neutral-500">({latencyMs}ms)</span>}
        </div>
      </div>

      {/* Center: Stream Title (Truncated if long) */}
      <div className="hidden lg:flex items-center gap-2 truncate max-w-xs text-neutral-400 text-xs">
        <Film className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
        <span className="truncate text-white font-medium">{videoTitle || 'Synchronized Stream'}</span>
      </div>

      {/* Right: Minimized Action Buttons (Zero-overlap guaranteed) */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Change Video Stream */}
        <button
          id="topbar-change-video-btn"
          type="button"
          onClick={onOpenChangeVideo}
          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
          title="Change video stream for everyone"
        >
          <Film className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Change Stream</span>
        </button>

        {/* Vid to URL Converter Trigger */}
        {onOpenConverter && (
          <button
            type="button"
            onClick={onOpenConverter}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
            title="Convert local video file or cloud link"
          >
            <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden md:inline">Vid to URL</span>
          </button>
        )}

        {/* Quick Reaction Popover */}
        <div className="relative" ref={reactionsMenuRef}>
          <button
            type="button"
            onClick={() => setShowReactionsMenu(!showReactionsMenu)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
            title="Send quick reaction"
          >
            <Smile className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">React</span>
          </button>

          {showReactionsMenu && (
            <div className="absolute right-0 top-full mt-2 p-2 rounded-2xl bg-neutral-950/95 border border-white/20 shadow-2xl backdrop-blur-2xl flex items-center gap-1.5 z-50 animate-scale-up max-w-[calc(100vw-2rem)]">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSendReaction(emoji);
                    setShowReactionsMenu(false);
                  }}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/20 hover:scale-125 transition-all text-base flex items-center justify-center cursor-pointer shrink-0"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Drawer Toggle with Unread Badge */}
        <button
          id="topbar-chat-btn"
          type="button"
          onClick={onToggleChat}
          className={`relative p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0 ${
            isChatOpen
              ? 'bg-white text-black font-semibold border-white'
              : 'bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white'
          }`}
          title="Toggle Room Chat & Info"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Chat</span>
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="w-4 h-4 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center shrink-0">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Room / Host Options Dropdown */}
        <div className="relative" ref={roomMenuRef}>
          <button
            type="button"
            onClick={() => setShowRoomMenu(!showRoomMenu)}
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer shrink-0"
            title="Room details and settings"
          >
            <Users className="w-3.5 h-3.5" />
            <ChevronDown className="w-3 h-3 text-neutral-500" />
          </button>

          {showRoomMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-2xl bg-neutral-950/95 border border-white/20 shadow-2xl backdrop-blur-2xl flex flex-col gap-2.5 z-50 animate-scale-up text-left">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-semibold text-white">Table Room</span>
                <span className="font-mono text-[10px] text-neutral-400">{tableKey}</span>
              </div>

              {/* Viewers list */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  Connected Viewers ({users.length})
                </span>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/5 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="truncate text-white font-medium">
                          {u.name} {u.id === myClientId ? '(You)' : ''}
                        </span>
                      </div>
                      {u.isHost && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-300 font-mono">
                          <Crown className="w-3 h-3 text-amber-400" />
                          Host
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Host actions if host */}
              {isHost && (
                <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                    Host Controls
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onGenerateNewKey();
                      setShowRoomMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs text-left transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate Key</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Close this Table for everyone?')) {
                        onCloseRoom();
                        setShowRoomMenu(false);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs text-left transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Close Room</span>
                  </button>
                </div>
              )}

              {/* Exit Room */}
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onLeaveTable}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Table</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
