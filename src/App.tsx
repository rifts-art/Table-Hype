/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { VideoPlayer } from './components/VideoPlayer';
import { RoomTopBar } from './components/RoomTopBar';
import { RoomDrawer } from './components/RoomDrawer';
import { CreateModal } from './components/CreateModal';
import { JoinModal } from './components/JoinModal';
import { ChangeVideoModal } from './components/ChangeVideoModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { VidConverterModal } from './components/VidConverterModal';
import { Watermark } from './components/Watermark';
import { useTableSync } from './hooks/useTableSync';
import {
  getStoredNickname,
  setStoredNickname,
  getRecentTables,
  addRecentTable
} from './utils/storage';
import { getRandomNickname, analyzeVideoUrl } from './utils/videoUtils';
import { SyncStatus } from './types';
import { Users, ArrowLeft, Film, Keyboard, Sparkles, HardDrive } from 'lucide-react';
import { p2pManager } from './utils/p2pVideo';

export default function App() {
  const [view, setView] = useState<'home' | 'table' | 'solo'>('home');
  const [tableKey, setTableKey] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>(() => getStoredNickname() || getRandomNickname());
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoTitle, setVideoTitle] = useState<string>('No Video Loaded');
  const [recentTables, setRecentTables] = useState<string[]>(() => getRecentTables());

  // Modal open states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isChangeVideoOpen, setIsChangeVideoOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);

  // Chat Drawer state & unread tracking
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Remote sync action dispatcher
  const [remoteCommand, setRemoteCommand] = useState<{
    type: 'play' | 'pause' | 'seek';
    time: number;
    id: number;
    senderName?: string;
  } | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // Handle direct link query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    const videoParam = params.get('video');

    if (tableParam) {
      const cleanKey = tableParam.trim().toUpperCase();
      setTableKey(cleanKey);
      addRecentTable(cleanKey);
      setRecentTables(getRecentTables());
      setView('table');
    } else if (videoParam) {
      setVideoUrl(videoParam);
      const check = analyzeVideoUrl(videoParam);
      setVideoTitle(check.suggestedTitle || 'Direct Video');
      setView('solo');
    }
  }, []);

  // Save nickname updates
  const handleUpdateNickname = useCallback((name: string) => {
    setUserName(name);
    setStoredNickname(name);
  }, []);

  // Sync callbacks
  const handleRemotePlay = useCallback((time: number, senderName: string) => {
    setSyncStatus('syncing');
    setRemoteCommand({ type: 'play', time, id: Date.now(), senderName });
    setTimeout(() => setSyncStatus('synced'), 600);
  }, []);

  const handleRemotePause = useCallback((time: number, senderName: string) => {
    setSyncStatus('synced');
    setRemoteCommand({ type: 'pause', time, id: Date.now(), senderName });
  }, []);

  const handleRemoteSeek = useCallback((time: number, senderName: string) => {
    setSyncStatus('seeking');
    setRemoteCommand({ type: 'seek', time, id: Date.now(), senderName });
    setTimeout(() => setSyncStatus('synced'), 700);
  }, []);

  const handleRemoteVideoChange = useCallback((url: string, title: string) => {
    setVideoUrl(url);
    setVideoTitle(title);
    setSyncStatus('synced');
  }, []);

  const handleRemoteDeviceVideo = useCallback((title: string) => {
    setVideoTitle(title);
    if (!p2pManager.getLocalFile()) {
      setVideoUrl('local-device-p2p://stream');
    }
    setSyncStatus('synced');
  }, []);

  const handleTableKeyUpdated = useCallback((newKey: string) => {
    setTableKey(newKey);
    addRecentTable(newKey);
    setRecentTables(getRecentTables());
    window.history.replaceState(null, '', `?table=${newKey}`);
  }, []);

  const handleRoomClosed = useCallback((reason: string) => {
    alert(reason || 'The host has closed this Table.');
    p2pManager.clearLocalFile();
    setView('home');
    setTableKey(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const [heartbeatSync, setHeartbeatSync] = useState<{ currentTime: number; isPlaying: boolean; hostTime: number } | null>(null);

  // WebSocket sync hook
  const {
    connectionStatus,
    roomState,
    myClientId,
    isHost,
    latencyMs,
    reactions,
    typingUsers,
    sendPlay,
    sendPause,
    sendSeek,
    sendVideoChange,
    sendLocalDeviceVideo,
    sendP2PModeChange,
    sendSyncHeartbeat,
    sendChat,
    sendTyping,
    sendMessageReaction,
    sendReaction,
    generateNewTableKey,
    closeRoom
  } = useTableSync({
    tableKey: view === 'table' ? tableKey : null,
    userName,
    onRemotePlay: handleRemotePlay,
    onRemotePause: handleRemotePause,
    onRemoteSeek: handleRemoteSeek,
    onRemoteVideoChange: handleRemoteVideoChange,
    onRemoteDeviceVideo: handleRemoteDeviceVideo,
    onP2PModeChange: (mode) => {
      p2pManager.setPlaybackMode(mode);
    },
    onSyncHeartbeat: (currentTime, isPlaying, hostTime) => {
      setHeartbeatSync({ currentTime, isPlaying, hostTime });
    },
    onTableKeyUpdated: handleTableKeyUpdated,
    onRoomClosed: handleRoomClosed
  });

  // Sync state reflection
  useEffect(() => {
    if (roomState) {
      if (roomState.deviceVideoInfo) {
        setVideoTitle(roomState.deviceVideoInfo.title);
        if (!p2pManager.getLocalFile()) {
          setVideoUrl('local-device-p2p://stream');
        }
      } else if (roomState.videoUrl !== undefined && roomState.videoUrl !== videoUrl) {
        setVideoUrl(roomState.videoUrl);
        setVideoTitle(roomState.videoTitle || (roomState.videoUrl ? 'Synchronized Video' : 'No Video Loaded'));
      }
    }
  }, [roomState, videoUrl]);

  // Track unread messages when chat drawer is closed
  useEffect(() => {
    if (roomState?.chatMessages?.length) {
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + 1);
      }
    }
  }, [roomState?.chatMessages?.length, isChatOpen]);

  const toggleChatDrawer = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) setUnreadChatCount(0);
      return next;
    });
  };

  // Create Table Flow
  const handleCreateTable = async (url: string, title: string, hostName: string) => {
    handleUpdateNickname(hostName);

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url, videoTitle: title })
      });
      const data = await res.json();

      if (data.success && data.key) {
        setTableKey(data.key);
        setVideoUrl(url);
        setVideoTitle(title || (url ? 'Synchronized Video' : 'No Video Loaded'));
        addRecentTable(data.key);
        setRecentTables(getRecentTables());
        setView('table');
        window.history.replaceState(null, '', `?table=${data.key}`);
      }
    } catch {
      // Offline fallback: generate local key format
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const part2 = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const fallbackKey = `TAB-${part1}-${part2}`;

      setTableKey(fallbackKey);
      setVideoUrl(url);
      setVideoTitle(title || (url ? 'Synchronized Video' : 'No Video Loaded'));
      addRecentTable(fallbackKey);
      setRecentTables(getRecentTables());
      setView('table');
      window.history.replaceState(null, '', `?table=${fallbackKey}`);
    }
  };

  // Join Table Flow
  const handleJoinTable = (key: string, nickname: string) => {
    handleUpdateNickname(nickname);
    setTableKey(key);
    addRecentTable(key);
    setRecentTables(getRecentTables());
    setView('table');
    window.history.replaceState(null, '', `?table=${key}`);
  };

  // Quick Stream Solo Flow
  const handleQuickStream = (url: string, title?: string) => {
    setVideoUrl(url);
    setVideoTitle(title || 'Direct Video Stream');
    setView('solo');
    setTableKey(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Leave Table / Solo
  const handleLeaveTable = () => {
    p2pManager.clearLocalFile();
    setView('home');
    setTableKey(null);
    setIsChatOpen(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Switch video stream
  const handleChangeVideo = (newUrl: string, newTitle: string) => {
    setVideoUrl(newUrl);
    setVideoTitle(newTitle);
    if (view === 'table') {
      sendVideoChange(newUrl, newTitle);
    }
  };

  // Handle stream selected from VidConverterModal
  const handleSelectConvertedStream = (streamUrl: string, title: string, file?: File) => {
    if (file) {
      // 100% Local Device Video (No 413 error, instant local playback, P2P WebRTC relay)
      const localUrl = p2pManager.setLocalFile(file);
      setVideoUrl(localUrl);
      setVideoTitle(title || file.name.replace(/\.[^/.]+$/, ''));

      if (view === 'table') {
        sendLocalDeviceVideo(file.name, file.size, file.type);
      } else {
        setView('solo');
      }
    } else {
      if (view === 'table') {
        handleChangeVideo(streamUrl, title);
      } else {
        handleQuickStream(streamUrl, title);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col selection:bg-white/20 selection:text-white">
      {/* Header (On Home page or general website view) */}
      {view === 'home' && (
        <Header
          currentTableKey={null}
          onGoHome={handleLeaveTable}
          onCreateTable={() => setIsCreateOpen(true)}
          onJoinTable={() => setIsJoinOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenConverter={() => setIsConverterOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full flex flex-col items-center ${view === 'home' ? 'max-w-7xl mx-auto px-4 sm:px-6' : 'px-2 sm:px-6 py-2 sm:py-4 max-w-7xl mx-auto'}`}>
        {view === 'home' ? (
          <HomePage
            onCreateTable={() => setIsCreateOpen(true)}
            onJoinTable={() => setIsJoinOpen(true)}
            onQuickStream={handleQuickStream}
            onOpenConverter={() => setIsConverterOpen(true)}
            recentTables={recentTables}
            onSelectRecentTable={(key) => handleJoinTable(key, userName)}
          />
        ) : (
          <div className="w-full flex flex-col gap-2.5 sm:gap-3.5 animate-fade-in relative">
            {/* Top Options Bar ("Too Too" / Very Top): Minimized & Unobtrusive */}
            {view === 'table' && tableKey && (
              <RoomTopBar
                tableKey={tableKey}
                users={roomState?.users || []}
                myClientId={myClientId}
                isHost={isHost}
                syncStatus={syncStatus}
                latencyMs={latencyMs}
                videoTitle={videoTitle}
                unreadChatCount={unreadChatCount}
                isChatOpen={isChatOpen}
                onToggleChat={toggleChatDrawer}
                onOpenChangeVideo={() => setIsChangeVideoOpen(true)}
                onOpenConverter={() => setIsConverterOpen(true)}
                onSendReaction={sendReaction}
                onLeaveTable={handleLeaveTable}
                onGenerateNewKey={generateNewTableKey}
                onCloseRoom={closeRoom}
              />
            )}

            {/* Solo Player Top Bar ("Too Too" / Very Top) */}
            {view === 'solo' && (
              <div className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-neutral-950/85 backdrop-blur-2xl border border-white/10 flex items-center justify-between gap-2 text-xs transition-all">
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleLeaveTable}
                    className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Home</span>
                  </button>
                  <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-neutral-300 shrink-0">
                    Solo
                  </span>
                  <span className="text-white font-medium truncate max-w-[120px] sm:max-w-xs hidden sm:inline">
                    {videoTitle}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsConverterOpen(true)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
                    title="Add video from device or resolve cloud link"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="hidden md:inline">Add from Device</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsChangeVideoOpen(true)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
                    title="Change stream URL"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Change Stream</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateTable(videoUrl, videoTitle, userName)}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shrink-0 active:scale-95"
                    title="Create a Table room and share with someone"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Upgrade<span className="hidden sm:inline"> to Table Room</span></span>
                  </button>
                </div>
              </div>
            )}

            {/* Cinema Video Player Stage (Front and Center, Unobstructed) */}
            <div className="relative w-full">
              <VideoPlayer
                videoUrl={videoUrl}
                videoTitle={videoTitle}
                isTableMode={view === 'table'}
                syncStatus={syncStatus}
                isDeviceStream={Boolean(roomState?.deviceVideoInfo || p2pManager.getLocalFile())}
                deviceMeta={roomState?.deviceVideoInfo}
                isHost={isHost}
                onSyncPlay={sendPlay}
                onSyncPause={sendPause}
                onSyncSeek={sendSeek}
                onOpenChangeVideo={() => setIsChangeVideoOpen(true)}
                onOpenShortcuts={() => setIsShortcutsOpen(true)}
                onOpenConverter={() => setIsConverterOpen(true)}
                onLoadUrl={(url, title) => handleChangeVideo(url, title || 'Custom Video')}
                onP2PModeChange={sendP2PModeChange}
                onSyncHeartbeat={sendSyncHeartbeat}
                heartbeatSync={heartbeatSync}
                remoteCommand={remoteCommand}
              />

              {/* Floating Real-Time Animated Reactions Overlay (Non-blocking, elevated above controls) */}
              <div className="absolute bottom-24 sm:bottom-28 right-3 sm:right-4 pointer-events-none flex flex-col items-end gap-2 z-30">
                {reactions.slice(-4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white shadow-xl animate-float-up"
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span className="text-[10px] font-mono text-neutral-300">{r.senderName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Status & Shortcuts Tip ("Too Bottom") */}
            <div className="w-full flex items-center justify-between px-2 text-[10px] sm:text-[11px] font-mono text-neutral-500">
              <div className="flex items-center gap-2">
                <span className="sm:hidden">Tap screen for controls · Double-tap seek</span>
                <div className="hidden sm:flex items-center gap-2">
                  <span>Space: Play/Pause</span>
                  <span>•</span>
                  <span>M: Mute</span>
                  <span>•</span>
                  <span>F: Fullscreen</span>
                  <span>•</span>
                  <span>←/→: Seek 10s</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(true)}
                className="hover:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Keyboard className="w-3 h-3" />
                <span><span className="hidden sm:inline">All </span>Shortcuts</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Website Footer (Only rendered on Home page for proper website presentation) */}
      {view === 'home' && (
        <footer className="w-full py-8 px-6 border-t border-white/5 bg-neutral-950/60 backdrop-blur-xl mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-white text-black font-black flex items-center justify-center text-xs">
                T
              </div>
              <span className="font-extrabold tracking-widest text-white">TABLE</span>
              <span className="text-neutral-600">•</span>
              <span>Minimalist Duo Synchronized Video Streaming</span>
            </div>

            <div className="flex items-center gap-6 text-neutral-400">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('supported-formats');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Supported Formats
              </button>
              <button
                type="button"
                onClick={() => setIsConverterOpen(true)}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Add from Device
              </button>
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(true)}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Shortcuts
              </button>
              <Watermark variant="badge" />
            </div>
          </div>
        </footer>
      )}

      {/* Slide-Out Room & Chat Drawer (Renders on side when toggled, never blocks video) */}
      {view === 'table' && tableKey && (
        <RoomDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          tableKey={tableKey}
          users={roomState?.users || []}
          myClientId={myClientId}
          isHost={isHost}
          chatMessages={roomState?.chatMessages || []}
          typingUsers={typingUsers}
          onSendMessage={sendChat}
          onSendTyping={sendTyping}
          onSendMessageReaction={sendMessageReaction}
          onSendReaction={sendReaction}
        />
      )}

      {/* Modals */}
      <VidConverterModal
        isOpen={isConverterOpen}
        onClose={() => setIsConverterOpen(false)}
        onSelectStream={handleSelectConvertedStream}
      />

      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateTable}
        onOpenConverter={() => setIsConverterOpen(true)}
        initialVideoUrl={videoUrl}
        initialNickname={userName}
      />

      <JoinModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onJoin={handleJoinTable}
        initialKey={tableKey || ''}
        initialNickname={userName}
      />

      <ChangeVideoModal
        isOpen={isChangeVideoOpen}
        onClose={() => setIsChangeVideoOpen(false)}
        onChangeVideo={handleChangeVideo}
        onOpenConverter={() => setIsConverterOpen(true)}
        currentUrl={videoUrl}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
