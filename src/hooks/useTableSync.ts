import { useEffect, useRef, useState, useCallback } from 'react';
import { TableRoomState, ChatMessage, WSServerMessage, WSClientMessage } from '../types';
import { chatAudio } from '../utils/audioNotification';
import { p2pManager } from '../utils/p2pVideo';
import { P2PPlaybackMode } from '../utils/p2pTypes';

interface UseTableSyncOptions {
  tableKey: string | null;
  userName: string;
  onRemotePlay?: (time: number, senderName: string) => void;
  onRemotePause?: (time: number, senderName: string) => void;
  onRemoteSeek?: (time: number, senderName: string) => void;
  onRemoteVideoChange?: (url: string, title: string, senderName: string) => void;
  onRemoteDeviceVideo?: (title: string, size: number, fileType: string, senderId: string, senderName: string) => void;
  onP2PModeChange?: (mode: P2PPlaybackMode, senderId: string) => void;
  onSyncHeartbeat?: (currentTime: number, isPlaying: boolean, hostTime: number) => void;
  onTableKeyUpdated?: (newKey: string) => void;
  onRoomClosed?: (reason: string) => void;
}

export function useTableSync({
  tableKey,
  userName,
  onRemotePlay,
  onRemotePause,
  onRemoteSeek,
  onRemoteVideoChange,
  onRemoteDeviceVideo,
  onP2PModeChange,
  onSyncHeartbeat,
  onTableKeyUpdated,
  onRoomClosed
}: UseTableSyncOptions) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [roomState, setRoomState] = useState<TableRoomState | null>(null);
  const [myClientId, setMyClientId] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; senderName: string }>>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string }>>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  // Generate or retrieve persistent client ID per browser session
  const getClientId = useCallback(() => {
    let id = sessionStorage.getItem('table_client_id');
    if (!id) {
      id = `usr_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('table_client_id', id);
    }
    return id;
  }, []);

  const sendMessage = useCallback((msg: WSClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendWebRTCSignal = useCallback((targetClientId: string | undefined, signal: any) => {
    if (!tableKey) return;
    sendMessage({
      type: 'webrtc_signal',
      targetClientId,
      signal,
      tableKey
    });
  }, [tableKey, sendMessage]);

  const connect = useCallback(() => {
    if (!tableKey) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;

      const clientId = getClientId();
      setMyClientId(clientId);

      // Initialize P2P manager with this client ID and signaling dispatcher
      p2pManager.init(clientId, (targetId, signal) => {
        sendWebRTCSignal(targetId, signal);
      });

      // Join room
      sendMessage({
        type: 'join',
        tableKey,
        userName,
        clientId
      });

      // Start ping loop
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          sendMessage({ type: 'ping', clientTime: Date.now() });
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data: WSServerMessage = JSON.parse(event.data);

        switch (data.type) {
          case 'init': {
            setRoomState(data.room);
            setMyClientId(data.clientId);
            break;
          }
          case 'user_joined': {
            setRoomState((prev) => {
              if (!prev) return null;
              const exists = prev.users.some((u) => u.id === data.user.id);
              const updatedUsers = exists ? prev.users : [...prev.users, data.user];
              return {
                ...prev,
                users: updatedUsers,
                chatMessages: [...prev.chatMessages, data.message]
              };
            });

            // If we have a local device video loaded, initiate P2P WebRTC offer to new user
            if (p2pManager.getLocalFile()) {
              p2pManager.createOfferForPeer(data.user.id);
            }
            break;
          }
          case 'user_left': {
            setRoomState((prev) => {
              if (!prev) return null;
              const updatedUsers = prev.users.filter((u) => u.id !== data.userId).map((u) => ({
                ...u,
                isHost: data.newHostId ? u.id === data.newHostId : u.isHost
              }));
              return {
                ...prev,
                hostId: data.newHostId || prev.hostId,
                users: updatedUsers,
                chatMessages: [...prev.chatMessages, data.message]
              };
            });
            setTypingUsers((prev) => prev.filter((u) => u.id !== data.userId));
            break;
          }
          case 'play': {
            setRoomState((prev) => (prev ? { ...prev, isPlaying: true, currentTime: data.currentTime } : null));
            onRemotePlay?.(data.currentTime, data.senderName);
            break;
          }
          case 'pause': {
            setRoomState((prev) => (prev ? { ...prev, isPlaying: false, currentTime: data.currentTime } : null));
            onRemotePause?.(data.currentTime, data.senderName);
            break;
          }
          case 'seek': {
            setRoomState((prev) => (prev ? { ...prev, currentTime: data.currentTime } : null));
            onRemoteSeek?.(data.currentTime, data.senderName);
            break;
          }
          case 'video_changed': {
            setRoomState((prev) =>
              prev
                ? {
                    ...prev,
                    videoUrl: data.videoUrl,
                    videoTitle: data.videoTitle,
                    currentTime: 0,
                    isPlaying: false,
                    deviceVideoInfo: undefined
                  }
                : null
            );
            onRemoteVideoChange?.(data.videoUrl, data.videoTitle, data.senderName);
            break;
          }
          case 'local_device_video': {
            setRoomState((prev) =>
              prev
                ? {
                    ...prev,
                    videoUrl: 'local-device-p2p://stream',
                    videoTitle: data.title,
                    currentTime: 0,
                    isPlaying: false,
                    deviceVideoInfo: {
                      title: data.title,
                      size: data.size,
                      fileType: data.fileType,
                      hostClientId: data.senderId
                    }
                  }
                : null
            );
            onRemoteDeviceVideo?.(data.title, data.size, data.fileType, data.senderId, data.senderName);
            break;
          }
          case 'p2p_mode_change': {
            p2pManager.setPlaybackMode(data.mode);
            onP2PModeChange?.(data.mode, data.senderId);
            break;
          }
          case 'sync_heartbeat': {
            onSyncHeartbeat?.(data.currentTime, data.isPlaying, data.hostTime);
            break;
          }
          case 'webrtc_signal': {
            p2pManager.handleSignal(data.senderId, data.signal);
            break;
          }
          case 'chat': {
            setRoomState((prev) => {
              if (!prev) return null;
              const existingIndex = data.message.clientTempId
                ? prev.chatMessages.findIndex((m) => m.clientTempId === data.message.clientTempId)
                : -1;

              if (existingIndex > -1) {
                const copy = [...prev.chatMessages];
                copy[existingIndex] = { ...data.message, status: 'sent' };
                return { ...prev, chatMessages: copy };
              }

              const clientId = sessionStorage.getItem('table_client_id');
              if (data.message.senderId !== clientId && !data.message.isSystem) {
                chatAudio.playMessageChime();
              }

              return { ...prev, chatMessages: [...prev.chatMessages, data.message] };
            });
            break;
          }
          case 'typing': {
            setTypingUsers((prev) => {
              if (data.isTyping) {
                if (prev.some((u) => u.id === data.userId)) return prev;
                return [...prev, { id: data.userId, name: data.userName }];
              } else {
                return prev.filter((u) => u.id !== data.userId);
              }
            });
            break;
          }
          case 'message_reaction': {
            setRoomState((prev) => {
              if (!prev) return null;
              const copy = prev.chatMessages.map((msg) => {
                if (msg.id === data.messageId) {
                  return { ...msg, reactions: data.reactions };
                }
                return msg;
              });
              return { ...prev, chatMessages: copy };
            });
            break;
          }
          case 'reaction': {
            const reactionId = `react-${Date.now()}-${Math.random()}`;
            setReactions((prev) => [...prev, { id: reactionId, emoji: data.emoji, senderName: data.senderName }]);
            setTimeout(() => {
              setReactions((prev) => prev.filter((r) => r.id !== reactionId));
            }, 3000);
            break;
          }
          case 'table_key_updated': {
            setRoomState((prev) => (prev ? { ...prev, id: data.newKey } : null));
            onTableKeyUpdated?.(data.newKey);
            break;
          }
          case 'room_closed': {
            onRoomClosed?.(data.reason);
            break;
          }
          case 'pong': {
            const now = Date.now();
            const rtt = Math.max(1, now - data.clientTime);
            setLatencyMs(Math.round(rtt / 2));
            break;
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('disconnected');
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      if (tableKey && reconnectAttemptsRef.current < 8) {
        const timeout = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, timeout);
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error:', err);
      ws.close();
    };
  }, [tableKey, userName, getClientId, onRemotePlay, onRemotePause, onRemoteSeek, onRemoteVideoChange, onRemoteDeviceVideo, onTableKeyUpdated, onRoomClosed, sendMessage, sendWebRTCSignal]);

  useEffect(() => {
    isMountedRef.current = true;
    if (tableKey) {
      connect();
    } else {
      setRoomState(null);
      setConnectionStatus('disconnected');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [tableKey, connect]);

  // Actions
  const sendPlay = useCallback((currentTime: number) => {
    if (!tableKey) return;
    sendMessage({ type: 'play', currentTime, tableKey });
  }, [tableKey, sendMessage]);

  const sendPause = useCallback((currentTime: number) => {
    if (!tableKey) return;
    sendMessage({ type: 'pause', currentTime, tableKey });
  }, [tableKey, sendMessage]);

  const sendSeek = useCallback((currentTime: number) => {
    if (!tableKey) return;
    sendMessage({ type: 'seek', currentTime, tableKey });
  }, [tableKey, sendMessage]);

  const sendVideoChange = useCallback((videoUrl: string, videoTitle?: string) => {
    if (!tableKey) return;
    sendMessage({ type: 'change_video', videoUrl, videoTitle, tableKey });
  }, [tableKey, sendMessage]);

  const sendLocalDeviceVideo = useCallback((title: string, size: number, fileType: string) => {
    if (!tableKey) return;
    sendMessage({ type: 'local_device_video', title, size, fileType, tableKey });
  }, [tableKey, sendMessage]);

  const sendChat = useCallback((text: string) => {
    if (!tableKey || !text.trim()) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const clientId = getClientId();

    const optimisticMessage: ChatMessage = {
      id: tempId,
      senderId: clientId,
      senderName: userName,
      text: text.trim(),
      timestamp: Date.now(),
      type: 'text',
      clientTempId: tempId,
      reactions: {},
      status: 'sending'
    };

    setRoomState((prev) => (prev ? { ...prev, chatMessages: [...prev.chatMessages, optimisticMessage] } : null));
    sendMessage({ type: 'chat', text: text.trim(), clientTempId: tempId, tableKey });
  }, [tableKey, userName, getClientId, sendMessage]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!tableKey) return;
    sendMessage({ type: 'typing', isTyping, tableKey });
  }, [tableKey, sendMessage]);

  const sendMessageReaction = useCallback((messageId: string, emoji: string) => {
    if (!tableKey) return;
    sendMessage({ type: 'message_reaction', messageId, emoji, tableKey });
  }, [tableKey, sendMessage]);

  const sendReaction = useCallback((emoji: string) => {
    if (!tableKey) return;
    sendMessage({ type: 'reaction', emoji, tableKey });
  }, [tableKey, sendMessage]);

  const generateNewTableKey = useCallback(() => {
    if (!tableKey) return;
    sendMessage({ type: 'new_table_key', tableKey });
  }, [tableKey, sendMessage]);

  const sendP2PModeChange = useCallback((mode: P2PPlaybackMode) => {
    if (!tableKey) return;
    sendMessage({ type: 'p2p_mode_change', mode, tableKey });
  }, [tableKey, sendMessage]);

  const sendSyncHeartbeat = useCallback((currentTime: number, isPlaying: boolean) => {
    if (!tableKey) return;
    sendMessage({ type: 'sync_heartbeat', currentTime, isPlaying, tableKey });
  }, [tableKey, sendMessage]);

  const closeRoom = useCallback(() => {
    if (!tableKey) return;
    sendMessage({ type: 'close_room', tableKey });
  }, [tableKey, sendMessage]);

  const isHost = Boolean(roomState && myClientId && roomState.hostId === myClientId);

  return {
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
    sendWebRTCSignal,
    sendChat,
    sendTyping,
    sendMessageReaction,
    sendReaction,
    generateNewTableKey,
    closeRoom,
    reconnect: connect
  };
}
