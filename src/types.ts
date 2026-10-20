export interface UserPresence {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  latencyMs?: number;
  isSelf?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  type?: 'text' | 'system' | 'reaction';
  clientTempId?: string;
  reactions?: Record<string, string[]>; // emoji -> array of user names
  status?: 'sending' | 'sent' | 'failed';
}

export interface TableRoomState {
  id: string;
  hostId: string;
  videoUrl: string;
  videoTitle: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  users: UserPresence[];
  chatMessages: ChatMessage[];
  deviceVideoInfo?: {
    title: string;
    size: number;
    fileType: string;
    hostClientId: string;
  };
}

export interface PlaybackSettings {
  volume: number;
  muted: boolean;
  speed: number;
  objectFit: 'contain' | 'cover';
  subtitleTrackUrl: string | null;
  subtitleFontSize: 'small' | 'medium' | 'large';
  subtitleBackground: boolean;
  loop: boolean;
  ambientGlow: boolean;
  rememberSettings: boolean;
}

export type SyncStatus = 'synced' | 'syncing' | 'seeking' | 'offline';

export interface SampleVideo {
  title: string;
  duration: string;
  format: string;
  url: string;
  subtitleUrl?: string;
  description: string;
  badge?: string;
}

export interface VideoConversionResult {
  originalUrl?: string;
  streamUrl: string;
  proxyUrl?: string;
  title: string;
  provider?: string;
  format?: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  isLocalUpload?: boolean;
  isDeviceVideo?: boolean;
  file?: File;
}

import { P2PPlaybackMode } from './utils/p2pTypes';

export type WSClientMessage =
  | { type: 'join'; tableKey: string; userName: string; clientId: string }
  | { type: 'play'; currentTime: number; tableKey: string }
  | { type: 'pause'; currentTime: number; tableKey: string }
  | { type: 'seek'; currentTime: number; tableKey: string }
  | { type: 'change_video'; videoUrl: string; videoTitle?: string; tableKey: string }
  | { type: 'local_device_video'; title: string; size: number; fileType: string; tableKey: string }
  | { type: 'p2p_mode_change'; mode: P2PPlaybackMode; tableKey: string }
  | { type: 'sync_heartbeat'; currentTime: number; isPlaying: boolean; tableKey: string }
  | { type: 'webrtc_signal'; targetClientId?: string; signal: any; tableKey: string }
  | { type: 'chat'; text: string; clientTempId?: string; tableKey: string }
  | { type: 'reaction'; emoji: string; tableKey: string }
  | { type: 'typing'; isTyping: boolean; tableKey: string }
  | { type: 'message_reaction'; messageId: string; emoji: string; tableKey: string }
  | { type: 'new_table_key'; tableKey: string }
  | { type: 'close_room'; tableKey: string }
  | { type: 'ping'; clientTime: number };

export type WSServerMessage =
  | { type: 'init'; room: TableRoomState; clientId: string }
  | { type: 'user_joined'; user: UserPresence; message: ChatMessage }
  | { type: 'user_left'; userId: string; newHostId?: string; message: ChatMessage }
  | { type: 'play'; currentTime: number; senderId: string; senderName: string }
  | { type: 'pause'; currentTime: number; senderId: string; senderName: string }
  | { type: 'seek'; currentTime: number; senderId: string; senderName: string }
  | { type: 'video_changed'; videoUrl: string; videoTitle: string; senderName: string }
  | { type: 'local_device_video'; title: string; size: number; fileType: string; senderId: string; senderName: string }
  | { type: 'p2p_mode_change'; mode: P2PPlaybackMode; senderId: string }
  | { type: 'sync_heartbeat'; currentTime: number; isPlaying: boolean; hostTime: number }
  | { type: 'webrtc_signal'; senderId: string; signal: any }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'reaction'; emoji: string; senderName: string }
  | { type: 'typing'; userId: string; userName: string; isTyping: boolean }
  | { type: 'message_reaction'; messageId: string; emoji: string; userId: string; userName: string; reactions: Record<string, string[]> }
  | { type: 'table_key_updated'; newKey: string }
  | { type: 'room_closed'; reason: string }
  | { type: 'pong'; clientTime: number; serverTime: number }
  | { type: 'error'; message: string };

