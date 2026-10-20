import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Check,
  Share2,
  Users,
  Crown,
  LogOut,
  Sparkles,
  MessageSquare,
  Send,
  X,
  RefreshCw,
  Film,
  Key,
  Trash2,
  Shield,
  Wifi,
  WifiOff
} from 'lucide-react';
import { TableRoomState, UserPresence, ChatMessage, SyncStatus } from '../types';
import { Watermark } from './Watermark';

interface RoomDashboardProps {
  roomState: TableRoomState;
  myClientId: string;
  isHost: boolean;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  latencyMs: number;
  syncStatus: SyncStatus;
  reactions: Array<{ id: string; emoji: string; senderName: string }>;
  onLeaveTable: () => void;
  onOpenChangeVideo: () => void;
  onGenerateNewKey: () => void;
  onCloseRoom: () => void;
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

export const RoomDashboard: React.FC<RoomDashboardProps> = ({
  roomState,
  myClientId,
  isHost,
  connectionStatus,
  latencyMs,
  syncStatus,
  reactions,
  onLeaveTable,
  onOpenChangeVideo,
  onGenerateNewKey,
  onCloseRoom,
  onSendChat,
  onSendReaction
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hostMenuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showChatDrawer) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomState.chatMessages, showChatDrawer]);

  // Handle outside click for host menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (hostMenuRef.current && !hostMenuRef.current.contains(e.target as Node)) {
        setShowHostMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(roomState.id);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?table=${roomState.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  const quickEmojis = ['🍿', '🔥', '👏', '❤️', '😱', '⚡'];

  const otherUsers = roomState.users.filter((u) => u.id !== myClientId);
  const me = roomState.users.find((u) => u.id === myClientId);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Glass Control Banner */}
      <div className="w-full p-4 sm:p-5 rounded-3xl bg-neutral-950/60 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Side: Table Key Badge & Copy Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">
              Table
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.08] border border-white/20 font-mono text-sm sm:text-base font-bold text-white tracking-wider shadow-inner">
              <Key className="w-3.5 h-3.5 text-neutral-400" />
              <span>{roomState.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="table-copy-key-btn"
              type="button"
              onClick={handleCopyKey}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Copy Table Key"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
              <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
            </button>

            <button
              id="table-share-link-btn"
              type="button"
              onClick={handleCopyShareLink}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Copy Direct Invite Link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-neutral-400" />}
              <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
            </button>
          </div>
        </div>

        {/* Center: Sync & Connection Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300">
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            )}
            <span className="capitalize">{connectionStatus}</span>
            {latencyMs > 0 && <span className="text-neutral-500">• {latencyMs}ms</span>}
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
              syncStatus === 'synced'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : syncStatus === 'seeking'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-white/5 border-white/15 text-neutral-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="font-semibold uppercase text-[11px] tracking-wider">
              {syncStatus === 'synced' ? 'Timeline Synced' : syncStatus === 'seeking' ? 'Syncing Seek...' : 'Synchronizing...'}
            </span>
          </div>
        </div>

        {/* Right Side: Connected Users, Host Controls, Leave */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Connected Participants Count Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300">
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-semibold text-white">{roomState.users.length}</span>
            <span className="text-neutral-400 hidden sm:inline">watching</span>
          </div>

          {/* Change Video Button (Host or any viewer in duo) */}
          <button
            id="table-change-video-btn"
            type="button"
            onClick={onOpenChangeVideo}
            className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
            title="Change the stream URL for everyone"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Change Video</span>
          </button>

          {/* Host Options Dropdown */}
          {isHost && (
            <div className="relative" ref={hostMenuRef}>
              <button
                id="table-host-menu-btn"
                type="button"
                onClick={() => setShowHostMenu(!showHostMenu)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer"
                title="Host Options"
              >
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Host Controls</span>
              </button>

              {showHostMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 p-2 rounded-2xl bg-neutral-900/95 border border-white/15 backdrop-blur-2xl shadow-2xl z-50 flex flex-col gap-1 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-white/10">
                    Host Privileges
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onGenerateNewKey();
                      setShowHostMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-neutral-200 hover:bg-white/10 transition-colors text-left cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Generate New Key</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCloseRoom();
                      setShowHostMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Close Table</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Toggle Chat Drawer Button */}
          <button
            id="table-toggle-chat-btn"
            type="button"
            onClick={() => setShowChatDrawer(!showChatDrawer)}
            className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
              showChatDrawer
                ? 'bg-white text-black border-white'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
            title="Chat & Activity Feed"
            aria-label="Toggle chat"
          >
            <MessageSquare className="w-4 h-4" />
            {roomState.chatMessages.length > 0 && !showChatDrawer && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white animate-pulse" />
            )}
          </button>

          {/* Leave Table Button */}
          <button
            id="table-leave-btn"
            type="button"
            onClick={onLeaveTable}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-xs font-medium text-neutral-400 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Leave this Table"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave Table</span>
          </button>
        </div>
      </div>

      {/* Floating Reaction Animation layer over screen */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r, index) => (
          <div
            key={r.id}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-4xl sm:text-5xl animate-float-up opacity-90 flex flex-col items-center"
            style={{
              left: `${45 + (index % 5) * 5}%`,
              animationDuration: '2.5s'
            }}
          >
            <span>{r.emoji}</span>
            <span className="text-[10px] font-mono bg-black/60 px-2 py-0.5 rounded-full text-white mt-1 border border-white/20">
              {r.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Connected Users bar & Quick Emoji reactions */}
      <div className="flex items-center justify-between gap-3 px-2 flex-wrap">
        {/* User Presence Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {me && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/20 text-xs font-medium text-white shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{me.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/15 font-mono text-neutral-300">You</span>
              {me.isHost && <Crown className="w-3 h-3 text-amber-300" />}
            </div>
          )}

          {otherUsers.map((u) => (
            <div
              key={u.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-neutral-300"
            >
              <div className="w-2 h-2 rounded-full bg-neutral-400" />
              <span>{u.name}</span>
              {u.isHost ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Host
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-neutral-400 font-mono">Duo</span>
              )}
            </div>
          ))}

          {otherUsers.length === 0 && (
            <div className="text-xs text-neutral-500 italic flex items-center gap-1.5 font-mono">
              <span>Waiting for partner to join with key</span>
              <span className="text-neutral-400 underline cursor-pointer" onClick={handleCopyKey}>
                {roomState.id}
              </span>
            </div>
          )}
        </div>

        {/* Quick Reaction Bar */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSendReaction(emoji)}
              className="w-8 h-8 rounded-xl hover:bg-white/15 flex items-center justify-center text-sm transition-transform active:scale-125 cursor-pointer"
              title={`Send ${emoji} reaction`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Lightweight Chat & Activity Drawer (Toggled from header) */}
      {showChatDrawer && (
        <div className="w-full p-4 rounded-3xl bg-neutral-950/80 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col gap-3 max-h-72">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white" />
              <span className="text-xs font-semibold text-white tracking-wide">Table Room Feed</span>
              <span className="text-[10px] font-mono text-neutral-500">Live</span>
            </div>
            <button
              type="button"
              onClick={() => setShowChatDrawer(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 max-h-44">
            {roomState.chatMessages.map((msg) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="text-[11px] font-mono text-neutral-400 italic py-0.5 text-center">
                    • {msg.text}
                  </div>
                );
              }
              const isMine = msg.senderId === myClientId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-0.5">
                    <span className="font-semibold text-neutral-300">{msg.senderName}</span>
                    <span className="font-mono text-neutral-600">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-2xl text-xs max-w-[80%] ${
                      isMine
                        ? 'bg-white text-black font-medium rounded-tr-none'
                        : 'bg-white/10 text-white border border-white/10 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input field */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2 border-t border-white/10">
            <input
              id="table-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send message to Table..."
              maxLength={500}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 transition-colors font-sans"
            />
            <button
              id="table-send-chat-btn"
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-white text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-200 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
