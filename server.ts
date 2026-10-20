import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Setup Uploads Directory for Converted Videos
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration for standard uploads (up to 30MB)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }
});

// Memory storage for small slices (1.5MB per chunk - guaranteed to bypass 413 limits)
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.json({ limit: '30mb' }));

interface ClientSession {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  ws: WebSocket;
  tableKey: string;
}

interface ChatMessageRecord {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  type?: 'text' | 'system' | 'reaction';
  clientTempId?: string;
  reactions?: Record<string, string[]>; // emoji -> [userNames]
}

interface DeviceVideoInfo {
  title: string;
  size: number;
  fileType: string;
  hostClientId: string;
}

interface RoomRecord {
  id: string;
  hostId: string;
  videoUrl: string;
  videoTitle: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  clients: Map<string, ClientSession>;
  chatMessages: ChatMessageRecord[];
  createdAt: number;
  typingUsers: Map<string, { name: string; timeout: NodeJS.Timeout }>;
  deviceVideoInfo?: DeviceVideoInfo;
}

const rooms = new Map<string, RoomRecord>();

// Helper to generate Table Key format: TAB-7X4K-92
function generateTableKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TAB-${part1}-${part2}`;
}

// Periodic cleanup: rooms inactive > 3 hours and uploaded files > 24 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, room] of rooms.entries()) {
    if (room.clients.size === 0 && now - room.lastUpdated > 3 * 60 * 60 * 1000) {
      rooms.delete(key);
    }
  }

  // Cleanup old uploaded converted files
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err || !files) return;
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      fs.stat(filePath, (statErr, stats) => {
        if (!statErr && stats && now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          fs.unlink(filePath, () => {});
        }
      });
    }
  });
}, 10 * 60 * 1000);

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeTables: rooms.size,
    timestamp: Date.now()
  });
});

app.get('/api/tables/:key', (req, res) => {
  const key = req.params.key.trim().toUpperCase();
  const room = rooms.get(key);
  if (!room) {
    res.status(404).json({ exists: false, message: 'Table not found' });
    return;
  }
  res.json({
    exists: true,
    id: room.id,
    userCount: room.clients.size,
    videoTitle: room.videoTitle,
    isPlaying: room.isPlaying,
    hasHost: !!room.clients.get(room.hostId),
    deviceVideoInfo: room.deviceVideoInfo
  });
});

app.post('/api/tables', (req, res) => {
  let key = generateTableKey();
  while (rooms.has(key)) {
    key = generateTableKey();
  }

  const defaultVideoUrl = req.body.videoUrl || '';
  const defaultTitle = req.body.videoTitle || (req.body.videoUrl ? 'Synchronized Video' : 'No Video Loaded');

  const room: RoomRecord = {
    id: key,
    hostId: '',
    videoUrl: defaultVideoUrl,
    videoTitle: defaultTitle,
    isPlaying: false,
    currentTime: 0,
    lastUpdated: Date.now(),
    clients: new Map(),
    chatMessages: [
      {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'TABLE System',
        text: `Table ${key} initialized. Invite your partner using your Table Key.`,
        timestamp: Date.now(),
        isSystem: true,
        type: 'system',
        reactions: {}
      }
    ],
    createdAt: Date.now(),
    typingUsers: new Map()
  };

  rooms.set(key, room);
  res.json({ success: true, key, room: serializeRoom(room) });
});

// Single File Upload (for small videos under 30MB)
app.post('/api/convert/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No video file provided.' });
    return;
  }

  const fileId = req.file.filename;
  const originalName = req.file.originalname;
  const streamUrl = `/api/stream/${fileId}`;

  res.json({
    success: true,
    fileId,
    url: streamUrl,
    originalName,
    size: req.file.size,
    mimeType: req.file.mimetype
  });
});

// Chunked Upload Endpoint - NEVER triggers HTTP 413 Payload Too Large!
app.post('/api/convert/upload-chunk', chunkUpload.single('chunk'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No chunk provided' });
    return;
  }

  const { uploadId, chunkIndex, totalChunks, fileName } = req.body;
  const safeUploadId = (uploadId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const tempPath = path.join(UPLOADS_DIR, `temp_${safeUploadId}.part`);

  try {
    fs.appendFileSync(tempPath, req.file.buffer);

    const idx = parseInt(chunkIndex, 10);
    const total = parseInt(totalChunks, 10);

    if (idx === total - 1) {
      // Final chunk reached - finalize file
      const ext = path.extname(fileName) || '.mp4';
      const cleanBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const finalName = `${cleanBase}-${uniqueSuffix}${ext}`;
      const finalPath = path.join(UPLOADS_DIR, finalName);

      fs.renameSync(tempPath, finalPath);

      res.json({
        success: true,
        completed: true,
        fileId: finalName,
        url: `/api/stream/${finalName}`,
        originalName: fileName
      });
    } else {
      res.json({
        success: true,
        completed: false,
        chunkIndex: idx
      });
    }
  } catch (err) {
    console.error('Error handling chunk upload:', err);
    res.status(500).json({ success: false, message: 'Failed to write chunk' });
  }
});

// Video Streaming Endpoint with Full HTTP 206 Range Request Support
app.get('/api/stream/:fileId', (req, res) => {
  const fileId = path.basename(req.params.fileId);
  const filePath = path.join(UPLOADS_DIR, fileId);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Video stream not found or expired.');
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Determine mime type
  const ext = path.extname(fileId).toLowerCase();
  let contentType = 'video/mp4';
  if (ext === '.webm') contentType = 'video/webm';
  if (ext === '.mov') contentType = 'video/quicktime';
  if (ext === '.mkv') contentType = 'video/x-matroska';
  if (ext === '.ogg' || ext === '.ogv') contentType = 'video/ogg';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, Content-Type');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Video Proxy Stream for CORS Bypassing Third-Party Video URLs
app.get('/api/proxy-stream', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('Target URL required');
    return;
  }

  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.status(400).send('Invalid protocol');
      return;
    }

    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };
    if (req.headers.range) {
      forwardHeaders['Range'] = req.headers.range;
    }

    const response = await fetch(targetUrl, {
      headers: forwardHeaders,
      redirect: 'follow'
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const contentRange = response.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    const contentLength = response.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    res.status(response.status);

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
            }
            if (!res.write(value)) {
              await new Promise((resolve) => res.once('drain', resolve));
            }
          }
        } catch {
          res.end();
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (err) {
    res.status(502).send('Error proxying video stream.');
  }
});

function serializeRoom(room: RoomRecord) {
  return {
    id: room.id,
    hostId: room.hostId,
    videoUrl: room.videoUrl,
    videoTitle: room.videoTitle,
    isPlaying: room.isPlaying,
    currentTime: room.currentTime,
    lastUpdated: room.lastUpdated,
    users: Array.from(room.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      isHost: c.isHost,
      joinedAt: c.joinedAt
    })),
    chatMessages: room.chatMessages.slice(-100),
    deviceVideoInfo: room.deviceVideoInfo
  };
}

function broadcastToRoom(room: RoomRecord, payload: object, excludeClientId?: string) {
  const data = JSON.stringify(payload);
  for (const [clientId, client] of room.clients.entries()) {
    if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(data);
      } catch (err) {
        console.error(`Failed to send to client ${clientId}:`, err);
      }
    }
  }
}

// WebSocket Server for Ultra-Smooth Synchronized Duo Watching & Chat
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let currentClientId = `usr_${Math.random().toString(36).substring(2, 9)}`;
  let currentTableKey: string | null = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          clientTime: msg.clientTime,
          serverTime: Date.now()
        }));
        return;
      }

      if (msg.type === 'join') {
        const tableKey = (msg.tableKey || '').trim().toUpperCase();
        const userName = (msg.userName || 'Viewer').trim().slice(0, 30);
        const clientId = msg.clientId || currentClientId;
        currentClientId = clientId;

        let room = rooms.get(tableKey);

        if (!room) {
          room = {
            id: tableKey,
            hostId: clientId,
            videoUrl: '',
            videoTitle: 'No Video Loaded',
            isPlaying: false,
            currentTime: 0,
            lastUpdated: Date.now(),
            clients: new Map(),
            chatMessages: [
              {
                id: `sys-${Date.now()}`,
                senderId: 'system',
                senderName: 'TABLE System',
                text: `Table ${tableKey} opened. Share the key to sync streams.`,
                timestamp: Date.now(),
                isSystem: true,
                type: 'system',
                reactions: {}
              }
            ],
            createdAt: Date.now(),
            typingUsers: new Map()
          };
          rooms.set(tableKey, room);
        }

        const isHost = room.clients.size === 0 || room.hostId === clientId || !room.hostId;
        if (isHost) {
          room.hostId = clientId;
        }

        const clientSession: ClientSession = {
          id: clientId,
          name: userName,
          isHost,
          joinedAt: Date.now(),
          ws,
          tableKey
        };

        room.clients.set(clientId, clientSession);
        currentTableKey = tableKey;
        room.lastUpdated = Date.now();

        // Welcome payload with current state
        ws.send(JSON.stringify({
          type: 'init',
          clientId,
          room: serializeRoom(room)
        }));

        // Broadcast join event
        const joinMsg: ChatMessageRecord = {
          id: `join-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          senderId: 'system',
          senderName: 'TABLE',
          text: `${userName} joined the Table${isHost ? ' (Host)' : ''}.`,
          timestamp: Date.now(),
          isSystem: true,
          type: 'system',
          reactions: {}
        };
        room.chatMessages.push(joinMsg);

        broadcastToRoom(room, {
          type: 'user_joined',
          user: {
            id: clientId,
            name: userName,
            isHost,
            joinedAt: clientSession.joinedAt
          },
          message: joinMsg
        }, clientId);

        return;
      }

      if (!currentTableKey) return;
      const room = rooms.get(currentTableKey);
      if (!room) return;
      const client = room.clients.get(currentClientId);
      const senderName = client?.name || 'Viewer';

      if (msg.type === 'play') {
        const time = typeof msg.currentTime === 'number' ? Math.max(0, msg.currentTime) : room.currentTime;
        room.isPlaying = true;
        room.currentTime = time;
        room.lastUpdated = Date.now();

        broadcastToRoom(room, {
          type: 'play',
          currentTime: time,
          senderId: currentClientId,
          senderName
        }, currentClientId);
      } else if (msg.type === 'pause') {
        const time = typeof msg.currentTime === 'number' ? Math.max(0, msg.currentTime) : room.currentTime;
        room.isPlaying = false;
        room.currentTime = time;
        room.lastUpdated = Date.now();

        broadcastToRoom(room, {
          type: 'pause',
          currentTime: time,
          senderId: currentClientId,
          senderName
        }, currentClientId);
      } else if (msg.type === 'seek') {
        const time = typeof msg.currentTime === 'number' ? Math.max(0, msg.currentTime) : 0;
        room.currentTime = time;
        room.lastUpdated = Date.now();

        broadcastToRoom(room, {
          type: 'seek',
          currentTime: time,
          senderId: currentClientId,
          senderName
        }, currentClientId);
      } else if (msg.type === 'change_video') {
        const url = (msg.videoUrl || '').trim().slice(0, 2048);
        const title = (msg.videoTitle || 'Custom Stream').trim().slice(0, 100);
        if (!url) return;

        room.videoUrl = url;
        room.videoTitle = title;
        room.currentTime = 0;
        room.isPlaying = false;
        room.lastUpdated = Date.now();
        delete room.deviceVideoInfo;

        const changeMsg: ChatMessageRecord = {
          id: `vid-${Date.now()}`,
          senderId: 'system',
          senderName: 'TABLE',
          text: `${senderName} changed video to "${title}".`,
          timestamp: Date.now(),
          isSystem: true,
          type: 'system',
          reactions: {}
        };
        room.chatMessages.push(changeMsg);

        broadcastToRoom(room, {
          type: 'video_changed',
          videoUrl: url,
          videoTitle: title,
          senderName
        });
      } else if (msg.type === 'local_device_video') {
        // Host adds a video directly from their device (100% local, P2P WebRTC streaming)
        const title = (msg.title || 'Device Video').trim().slice(0, 100);
        const size = typeof msg.size === 'number' ? msg.size : 0;
        const fileType = (msg.fileType || 'video/mp4').slice(0, 50);

        room.videoUrl = 'local-device-p2p://stream';
        room.videoTitle = title;
        room.currentTime = 0;
        room.isPlaying = false;
        room.lastUpdated = Date.now();
        room.deviceVideoInfo = {
          title,
          size,
          fileType,
          hostClientId: currentClientId
        };

        const devMsg: ChatMessageRecord = {
          id: `dev-${Date.now()}`,
          senderId: 'system',
          senderName: 'TABLE',
          text: `${senderName} is streaming "${title}" directly from their device via P2P.`,
          timestamp: Date.now(),
          isSystem: true,
          type: 'system',
          reactions: {}
        };
        room.chatMessages.push(devMsg);

        broadcastToRoom(room, {
          type: 'local_device_video',
          title,
          size,
          fileType,
          senderId: currentClientId,
          senderName
        });
      } else if (msg.type === 'p2p_mode_change') {
        broadcastToRoom(room, {
          type: 'p2p_mode_change',
          mode: msg.mode,
          senderId: currentClientId
        }, currentClientId);
      } else if (msg.type === 'sync_heartbeat') {
        const time = typeof msg.currentTime === 'number' ? Math.max(0, msg.currentTime) : room.currentTime;
        room.currentTime = time;
        room.isPlaying = Boolean(msg.isPlaying);
        room.lastUpdated = Date.now();
        broadcastToRoom(room, {
          type: 'sync_heartbeat',
          currentTime: time,
          isPlaying: room.isPlaying,
          hostTime: Date.now()
        }, currentClientId);
      } else if (msg.type === 'webrtc_signal') {
        // Direct WebRTC signaling relay between host and viewer
        const targetClientId = msg.targetClientId;
        if (targetClientId) {
          const target = room.clients.get(targetClientId);
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({
              type: 'webrtc_signal',
              senderId: currentClientId,
              signal: msg.signal
            }));
          }
        } else {
          // Broadcast to all other room members
          broadcastToRoom(room, {
            type: 'webrtc_signal',
            senderId: currentClientId,
            signal: msg.signal
          }, currentClientId);
        }
      } else if (msg.type === 'chat') {
        const text = (msg.text || '').trim().slice(0, 600);
        if (!text) return;

        if (room.typingUsers.has(currentClientId)) {
          clearTimeout(room.typingUsers.get(currentClientId)!.timeout);
          room.typingUsers.delete(currentClientId);
          broadcastToRoom(room, {
            type: 'typing',
            userId: currentClientId,
            userName: senderName,
            isTyping: false
          });
        }

        const chatItem: ChatMessageRecord = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          senderId: currentClientId,
          senderName,
          text,
          timestamp: Date.now(),
          type: 'text',
          clientTempId: msg.clientTempId,
          reactions: {}
        };

        room.chatMessages.push(chatItem);
        if (room.chatMessages.length > 150) {
          room.chatMessages = room.chatMessages.slice(-150);
        }

        broadcastToRoom(room, {
          type: 'chat',
          message: chatItem
        });
      } else if (msg.type === 'typing') {
        const isTyping = Boolean(msg.isTyping);

        if (isTyping) {
          if (room.typingUsers.has(currentClientId)) {
            clearTimeout(room.typingUsers.get(currentClientId)!.timeout);
          }
          const timeout = setTimeout(() => {
            room.typingUsers.delete(currentClientId);
            broadcastToRoom(room, {
              type: 'typing',
              userId: currentClientId,
              userName: senderName,
              isTyping: false
            });
          }, 3500);

          room.typingUsers.set(currentClientId, { name: senderName, timeout });
        } else {
          if (room.typingUsers.has(currentClientId)) {
            clearTimeout(room.typingUsers.get(currentClientId)!.timeout);
            room.typingUsers.delete(currentClientId);
          }
        }

        broadcastToRoom(room, {
          type: 'typing',
          userId: currentClientId,
          userName: senderName,
          isTyping
        }, currentClientId);
      } else if (msg.type === 'message_reaction') {
        const messageId = msg.messageId;
        const emoji = (msg.emoji || '').slice(0, 8);
        if (!messageId || !emoji) return;

        const targetMsg = room.chatMessages.find((m) => m.id === messageId);
        if (targetMsg) {
          if (!targetMsg.reactions) targetMsg.reactions = {};
          if (!targetMsg.reactions[emoji]) targetMsg.reactions[emoji] = [];

          const existingIndex = targetMsg.reactions[emoji].indexOf(senderName);
          if (existingIndex > -1) {
            targetMsg.reactions[emoji].splice(existingIndex, 1);
            if (targetMsg.reactions[emoji].length === 0) {
              delete targetMsg.reactions[emoji];
            }
          } else {
            targetMsg.reactions[emoji].push(senderName);
          }

          broadcastToRoom(room, {
            type: 'message_reaction',
            messageId,
            emoji,
            userId: currentClientId,
            userName: senderName,
            reactions: targetMsg.reactions
          });
        }
      } else if (msg.type === 'reaction') {
        const emoji = (msg.emoji || '✨').slice(0, 8);
        broadcastToRoom(room, {
          type: 'reaction',
          emoji,
          senderName
        });
      } else if (msg.type === 'new_table_key') {
        if (room.hostId === currentClientId) {
          let newKey = generateTableKey();
          while (rooms.has(newKey)) {
            newKey = generateTableKey();
          }
          rooms.delete(room.id);
          room.id = newKey;
          rooms.set(newKey, room);

          for (const c of room.clients.values()) {
            c.tableKey = newKey;
          }
          currentTableKey = newKey;

          broadcastToRoom(room, {
            type: 'table_key_updated',
            newKey
          });
        }
      } else if (msg.type === 'close_room') {
        if (room.hostId === currentClientId) {
          broadcastToRoom(room, {
            type: 'room_closed',
            reason: 'Host has closed this Table.'
          });
          rooms.delete(room.id);
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (!currentTableKey) return;
    const room = rooms.get(currentTableKey);
    if (!room) return;

    if (room.typingUsers.has(currentClientId)) {
      clearTimeout(room.typingUsers.get(currentClientId)!.timeout);
      room.typingUsers.delete(currentClientId);
    }

    const leavingClient = room.clients.get(currentClientId);
    room.clients.delete(currentClientId);
    room.lastUpdated = Date.now();

    let newHostId: string | undefined = undefined;

    if (room.hostId === currentClientId) {
      const nextClient = room.clients.values().next().value;
      if (nextClient) {
        nextClient.isHost = true;
        room.hostId = nextClient.id;
        newHostId = nextClient.id;
      } else {
        room.hostId = '';
      }
    }

    const leaveMsg: ChatMessageRecord = {
      id: `leave-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: 'system',
      senderName: 'TABLE',
      text: `${leavingClient?.name || 'A user'} left the Table.${newHostId ? ` Host passed to ${room.clients.get(newHostId)?.name}.` : ''}`,
      timestamp: Date.now(),
      isSystem: true,
      type: 'system',
      reactions: {}
    };

    if (room.clients.size > 0) {
      room.chatMessages.push(leaveMsg);
      broadcastToRoom(room, {
        type: 'user_left',
        userId: currentClientId,
        newHostId,
        message: leaveMsg
      });
    }
  });
});

// Vite middleware / Production build handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TABLE server running on port ${PORT}`);
  });
}

startServer();
