import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Users,
  MessageSquare,
  Crown,
  Key,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Smile,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { ChatMessage, UserPresence } from '../types';
import { chatAudio } from '../utils/audioNotification';

interface RoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tableKey: string;
  users: UserPresence[];
  myClientId: string;
  isHost: boolean;
  chatMessages: ChatMessage[];
  typingUsers?: Array<{ id: string; name: string }>;
  onSendMessage: (text: string) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onSendMessageReaction?: (messageId: string, emoji: string) => void;
  onSendReaction: (emoji: string) => void;
}

export const RoomDrawer: React.FC<RoomDrawerProps> = ({
  isOpen,
  onClose,
  tableKey,
  users,
  myClientId,
  isHost,
  chatMessages,
  typingUsers = [],
  onSendMessage,
  onSendTyping,
  onSendMessageReaction,
  onSendReaction
}) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'people'>('chat');
  const [copiedKey, setCopiedKey] = useState(false);
  const [isMuted, setIsMuted] = useState(() => chatAudio.getMuted());
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrolledUpRef = useRef(false);

  // Quick message presets
  const quickPresets = [
    '🍿 Popcorn ready!',
    '⏸️ Wait a sec!',
    '🔥 What a scene!',
    '👀 Did you see that?',
    '😂 LOL',
    '🔊 Audio is good!'
  ];

  // Quick reaction emojis
  const messageEmojis = ['❤️', '🔥', '🍿', '😂', '👏', '😱'];

  // Handle Scroll to detect if user has scrolled up
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    isUserScrolledUpRef.current = !isNearBottom;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setShowScrollBottom(false);
    isUserScrolledUpRef.current = false;
  }, []);

  // Auto scroll on new messages if near bottom
  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      scrollToBottom(true);
    }
  }, [chatMessages.length, scrollToBottom]);

  // Scroll to bottom when opening drawer
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [isOpen, activeTab, scrollToBottom]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (onSendTyping) {
      if (val.trim()) {
        onSendTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          onSendTyping(false);
        }, 2000);
      } else {
        onSendTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (onSendTyping) onSendTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTimeout(() => scrollToBottom(true), 50);
  };

  const handleSendPreset = (preset: string) => {
    onSendMessage(preset);
    setTimeout(() => scrollToBottom(true), 50);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(tableKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleSoundMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    chatAudio.setMuted(next);
  };

  const formatMessageTime = (ts: number) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  // Filter typing users other than self
  const activeTypers = typingUsers.filter((u) => u.id !== myClientId);

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-88 md:w-96 bg-neutral-950/95 backdrop-blur-2xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.85)] flex flex-col animate-slide-left"
      aria-label="Room details and chat"
    >
      {/* Top Drawer Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/10 text-white border border-white/10">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Table Room</h3>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-400">
              <span>{tableKey}</span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="hover:text-white transition-colors cursor-pointer"
                title="Copy Table Key"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Audio Chime Mute Toggle */}
          <button
            type="button"
            onClick={toggleSoundMute}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isMuted ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-300 hover:text-white'
            }`}
            title={isMuted ? 'Chat sounds muted (Click to unmute)' : 'Chat sounds enabled (Click to mute)'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Drawer (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="px-4 pt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-white text-black shadow-md'
              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
          }`}
        >
          Chat ({chatMessages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('people')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'people'
              ? 'bg-white text-black shadow-md'
              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
          }`}
        >
          Viewers ({users.length})
        </button>
      </div>

      {/* Tab 1: Chat Messages */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Messages Scroll Area */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 min-h-0"
          >
            {chatMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500 text-xs">
                <MessageSquare className="w-8 h-8 stroke-1 mb-2 text-neutral-600" />
                <p>No messages yet.</p>
                <p className="text-[11px] text-neutral-600 mt-1">
                  Say hi or drop a reaction while streaming together!
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.senderId === myClientId;

                if (msg.isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="py-1 px-3 rounded-xl bg-white/[0.03] border border-white/5 text-center text-[11px] font-mono text-neutral-400 my-0.5"
                    >
                      {msg.text}
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col group/msg ${isMe ? 'items-end' : 'items-start'} relative`}
                    onMouseEnter={() => setActiveReactionMessageId(msg.id)}
                    onMouseLeave={() => setActiveReactionMessageId(null)}
                  >
                    {/* Sender Name & Timestamp */}
                    <div className="flex items-center gap-1.5 px-1 mb-1 text-[10px] text-neutral-500">
                      <span className="font-medium text-neutral-400">{isMe ? 'You' : msg.senderName}</span>
                      <span>•</span>
                      <span>{formatMessageTime(msg.timestamp)}</span>
                      {isMe && msg.status === 'sending' && (
                        <span className="text-neutral-500 font-mono">(sending...)</span>
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`relative px-3.5 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                        isMe
                          ? 'bg-white text-black font-medium rounded-tr-xs shadow-md'
                          : 'bg-white/10 text-white rounded-tl-xs border border-white/10'
                      }`}
                    >
                      {msg.text}

                      {/* Hover Quick Emoji Reaction Picker */}
                      {onSendMessageReaction && activeReactionMessageId === msg.id && (
                        <div
                          className={`absolute -top-7 ${
                            isMe ? 'right-0' : 'left-0'
                          } flex items-center gap-1 p-1 rounded-full bg-neutral-900 border border-white/15 shadow-xl z-20 animate-scale-up`}
                        >
                          {messageEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => onSendMessageReaction(msg.id, emoji)}
                              className="w-5 h-5 flex items-center justify-center hover:scale-125 transition-transform text-xs cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* In-Message Reaction Badges */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {Object.entries(msg.reactions).map(([emoji, userList]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => onSendMessageReaction && onSendMessageReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
                              userList.includes(users.find((u) => u.id === myClientId)?.name || '')
                                ? 'bg-white/20 border-white/30 text-white'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                            }`}
                            title={`Reacted by: ${userList.join(', ')}`}
                          >
                            <span>{emoji}</span>
                            <span>{userList.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Jump to Newest Messages Button */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black font-semibold text-[11px] shadow-2xl flex items-center gap-1 cursor-pointer hover:bg-neutral-200 transition-all z-20 animate-bounce"
            >
              <ArrowDown className="w-3 h-3" />
              <span>New messages</span>
            </button>
          )}

          {/* Typing Indicator Bar */}
          {activeTypers.length > 0 && (
            <div className="px-4 py-1.5 text-[11px] text-neutral-400 font-mono flex items-center gap-2 border-t border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse delay-150" />
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse delay-300" />
              </div>
              <span className="truncate">
                {activeTypers.map((t) => t.name).join(', ')} {activeTypers.length > 1 ? 'are typing...' : 'is typing...'}
              </span>
            </div>
          )}

          {/* Quick Preset Reactions Row */}
          <div className="px-3 py-2 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x shrink-0">
            {quickPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSendPreset(preset)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-neutral-300 hover:text-white transition-all cursor-pointer shrink-0"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSend} className="p-3 pb-safe border-t border-white/10 flex items-center gap-2 bg-neutral-950/90 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Say something to the room..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-base sm:text-xs focus:outline-none focus:border-white/30 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Connected People */}
      {activeTab === 'people' && (
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2">
          <div className="text-[11px] font-mono uppercase text-neutral-500 tracking-wider mb-1">
            Active in Table ({users.length})
          </div>

          {users.map((u) => {
            const isMe = u.id === myClientId;
            return (
              <div
                key={u.id}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center font-bold text-xs text-white">
                    {u.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">{u.name}</span>
                      {isMe && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-neutral-300">
                          You
                        </span>
                      )}
                      {u.isHost && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                          <Crown className="w-3 h-3" />
                          <span>Host</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500">
                      ID: {u.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-mono text-neutral-400">Online</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
