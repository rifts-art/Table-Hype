/**
 * Advanced P2P WebRTC Video Streaming & Synchronized Direct Delivery Manager.
 * 
 * Supports three optimized playback paradigms:
 * 1. SYNCHRONIZED_LOCAL: Zero WebRTC video bandwidth; instant 4K local playback synchronized via WebSocket.
 * 2. DIRECT_P2P_STREAM: Direct low-latency WebRTC video track streaming via captureStream() with Adaptive Quality.
 * 3. PROGRESSIVE_FILE_DELIVERY: High-fidelity direct transfer over RTCDataChannel with backpressure and memory-safe IndexedDB.
 */

import { p2pStorage } from './p2pStorage';
import { videoQualityController } from './p2pQuality';
import { P2PPlaybackMode, P2PConnectionStats, VideoQualityMode } from './p2pTypes';

type SignalCallback = (targetClientId: string | undefined, signal: any) => void;

interface FileHeaderMeta {
  type: 'file_header';
  sessionId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export class P2PVideoManager {
  private localFile: File | null = null;
  private localBlobUrl: string | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalCallback: SignalCallback | null = null;
  private myClientId: string = '';
  private currentRemoteClientId: string | null = null;

  private remoteStream: MediaStream | null = null;
  private capturedStream: MediaStream | null = null;
  private activeVideoElement: HTMLVideoElement | null = null;

  // Active Playback Mode
  private currentMode: P2PPlaybackMode = 'DIRECT_P2P_STREAM';

  // File Transfer State
  private isSendingFile: boolean = false;
  private cancelFileTransferFlag: boolean = false;
  private currentSessionId: string = '';
  private expectedFileSize: number = 0;
  private expectedFileName: string = '';
  private expectedFileType: string = '';
  private receivedBytes: number = 0;
  private receivedChunkCount: number = 0;

  // Listeners
  private onRemoteStreamListeners: Array<(stream: MediaStream) => void> = [];
  private onFileProgressListeners: Array<(percent: number, received: number, total: number, speedKbps: number) => void> = [];
  private onFileCompleteListeners: Array<(fileUrl: string, fileName: string) => void> = [];
  private onConnectionStateListeners: Array<(state: RTCPeerConnectionState) => void> = [];
  private onModeChangeListeners: Array<(mode: P2PPlaybackMode) => void> = [];
  private onDiagnosticsListeners: Array<(stats: P2PConnectionStats) => void> = [];

  private isInitiator: boolean = false;
  private connectionWatchdogTimer: any = null;
  private iceRestartAttempts: number = 0;

  // Multi-server STUN configuration
  private iceConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ],
    iceCandidatePoolSize: 2
  };

  constructor() {
    // Pipe quality controller stats to diagnostics
    videoQualityController.onStats((stats) => {
      const augmented: P2PConnectionStats = {
        ...stats,
        currentMode: this.currentMode,
        transferProgressPercent: this.expectedFileSize > 0 ? Math.round((this.receivedBytes / this.expectedFileSize) * 100) : undefined,
        bufferedAmountBytes: this.dataChannel?.bufferedAmount || 0
      };
      this.onDiagnosticsListeners.forEach((cb) => cb(augmented));
    });
  }

  public init(myClientId: string, signalCallback: SignalCallback) {
    this.myClientId = myClientId;
    this.signalCallback = signalCallback;
  }

  public getPlaybackMode(): P2PPlaybackMode {
    return this.currentMode;
  }

  public setPlaybackMode(mode: P2PPlaybackMode) {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.onModeChangeListeners.forEach((cb) => cb(mode));

    // Mode-specific reconfiguration
    if (mode === 'SYNCHRONIZED_LOCAL') {
      // Both users have the file locally: stop streaming captured video tracks
      this.detachCapturedTracks();
    } else if (mode === 'DIRECT_P2P_STREAM') {
      // Stream live video from host: reattach tracks
      if (this.isInitiator && this.activeVideoElement) {
        this.captureStreamFromVideo(this.activeVideoElement);
        this.attachCapturedTracks();
      }
    }
  }

  public onModeChange(callback: (mode: P2PPlaybackMode) => void) {
    this.onModeChangeListeners.push(callback);
    callback(this.currentMode);
    return () => {
      this.onModeChangeListeners = this.onModeChangeListeners.filter((cb) => cb !== callback);
    };
  }

  public onDiagnostics(callback: (stats: P2PConnectionStats) => void) {
    this.onDiagnosticsListeners.push(callback);
    return () => {
      this.onDiagnosticsListeners = this.onDiagnosticsListeners.filter((cb) => cb !== callback);
    };
  }

  public setQualityMode(mode: VideoQualityMode) {
    videoQualityController.setQualityMode(mode);
  }

  public getQualityMode(): VideoQualityMode {
    return videoQualityController.getQualityMode();
  }

  public setLocalFile(file: File): string {
    this.localFile = file;
    if (this.localBlobUrl) {
      URL.revokeObjectURL(this.localBlobUrl);
    }
    this.localBlobUrl = URL.createObjectURL(file);
    return this.localBlobUrl;
  }

  public getLocalFile(): File | null {
    return this.localFile;
  }

  public getLocalBlobUrl(): string | null {
    return this.localBlobUrl;
  }

  public clearLocalFile() {
    this.localFile = null;
    if (this.localBlobUrl) {
      URL.revokeObjectURL(this.localBlobUrl);
      this.localBlobUrl = null;
    }
    this.cancelFileTransferFlag = true;
    this.cleanupPeer();
  }

  /**
   * Captures media stream from host video element
   */
  public captureStreamFromVideo(videoElement: HTMLVideoElement): MediaStream | null {
    this.activeVideoElement = videoElement;
    try {
      const vid = videoElement as any;
      if (vid.captureStream) {
        this.capturedStream = vid.captureStream();
      } else if (vid.mozCaptureStream) {
        this.capturedStream = vid.mozCaptureStream();
      }

      if (this.currentMode === 'DIRECT_P2P_STREAM' && this.peerConnection) {
        this.attachCapturedTracks();
      }
      return this.capturedStream;
    } catch (err) {
      console.warn('captureStream not available:', err);
      return null;
    }
  }

  private attachCapturedTracks() {
    if (!this.peerConnection || !this.capturedStream) return;

    try {
      const existingSenders = this.peerConnection.getSenders();
      const existingTrackIds = new Set(existingSenders.map((s) => s.track?.id).filter(Boolean));

      this.capturedStream.getTracks().forEach((track) => {
        if (!existingTrackIds.has(track.id)) {
          this.peerConnection?.addTrack(track, this.capturedStream!);
        }
      });

      // Apply initial quality profile
      videoQualityController.applyEncodingProfile();
    } catch (err) {
      console.warn('Error attaching captured tracks:', err);
    }
  }

  private detachCapturedTracks() {
    if (!this.peerConnection) return;
    try {
      const senders = this.peerConnection.getSenders();
      senders.forEach((sender) => {
        if (sender.track && (sender.track.kind === 'video' || sender.track.kind === 'audio')) {
          try {
            this.peerConnection?.removeTrack(sender);
          } catch {}
        }
      });
    } catch (err) {
      console.warn('Error detaching tracks:', err);
    }
  }

  /**
   * Host starts WebRTC connection to peer viewer
   */
  public async createOfferForPeer(targetClientId?: string) {
    this.isInitiator = true;
    this.currentRemoteClientId = targetClientId || null;
    this.iceRestartAttempts = 0;

    this.setupPeerConnection(targetClientId);
    if (!this.peerConnection) return;

    // In DIRECT_P2P_STREAM mode, attach live video tracks
    if (this.currentMode === 'DIRECT_P2P_STREAM' && this.capturedStream) {
      this.attachCapturedTracks();
    }

    // Create Data Channel for control signaling & on-demand file delivery
    try {
      this.dataChannel = this.peerConnection.createDataChannel('table-p2p-channel', {
        ordered: true
      });
      this.setupDataChannel(this.dataChannel);
    } catch (err) {
      console.warn('Failed to create data channel:', err);
    }

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.signalCallback?.(targetClientId, {
        type: 'offer',
        sdp: offer,
        mode: this.currentMode
      });

      this.startConnectionWatchdog();
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    }
  }

  /**
   * Viewer or Host handles incoming WebRTC signal
   */
  public async handleSignal(senderId: string, signal: any) {
    if (!signal) return;

    if (signal.type === 'offer') {
      this.isInitiator = false;
      this.currentRemoteClientId = senderId;
      this.iceRestartAttempts = 0;

      if (signal.mode) {
        this.currentMode = signal.mode;
        this.onModeChangeListeners.forEach((cb) => cb(this.currentMode));
      }

      this.setupPeerConnection(senderId);
      if (!this.peerConnection) return;

      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.signalCallback?.(senderId, {
          type: 'answer',
          sdp: answer
        });

        this.startConnectionWatchdog();
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    } else if (signal.type === 'answer') {
      if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          videoQualityController.applyEncodingProfile();
        } catch (err) {
          console.error('Error setting remote description from answer:', err);
        }
      }
    } else if (signal.type === 'candidate' && signal.candidate) {
      if (this.peerConnection) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.warn('Error adding ICE candidate:', err);
        }
      }
    } else if (signal.type === 'ice_restart_request') {
      if (this.isInitiator) {
        this.restartIceConnection();
      }
    }
  }

  private setupPeerConnection(remoteClientId?: string) {
    if (this.peerConnection) {
      // Prevent duplicate peer connections: teardown stale connection cleanly
      this.cleanupPeer(false);
    }

    try {
      this.peerConnection = new RTCPeerConnection(this.iceConfig);
      videoQualityController.attachPeer(this.peerConnection);

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.signalCallback) {
          this.signalCallback(remoteClientId, {
            type: 'candidate',
            candidate: event.candidate
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState || 'closed';
        this.onConnectionStateListeners.forEach((cb) => cb(state));

        if (state === 'connected') {
          this.clearConnectionWatchdog();
          this.iceRestartAttempts = 0;
        } else if (state === 'failed' || state === 'disconnected') {
          this.handleConnectionDegraded();
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const iceState = this.peerConnection?.iceConnectionState;
        if (iceState === 'failed') {
          this.handleConnectionDegraded();
        }
      };

      // Inbound media tracks (Viewer)
      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.onRemoteStreamListeners.forEach((cb) => cb(event.streams[0]));
        }
      };

      // Inbound DataChannel (Viewer)
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
    } catch (err) {
      console.error('Failed to initialize RTCPeerConnection:', err);
    }
  }

  private startConnectionWatchdog() {
    this.clearConnectionWatchdog();
    this.connectionWatchdogTimer = setTimeout(() => {
      if (
        this.peerConnection &&
        this.peerConnection.connectionState !== 'connected' &&
        this.peerConnection.connectionState !== 'closed'
      ) {
        console.warn('WebRTC connection timeout - triggering recovery');
        this.handleConnectionDegraded();
      }
    }, 12000);
  }

  private clearConnectionWatchdog() {
    if (this.connectionWatchdogTimer) {
      clearTimeout(this.connectionWatchdogTimer);
      this.connectionWatchdogTimer = null;
    }
  }

  private handleConnectionDegraded() {
    if (this.iceRestartAttempts < 2 && this.peerConnection) {
      this.iceRestartAttempts += 1;
      if (this.isInitiator) {
        this.restartIceConnection();
      } else {
        // Request host to restart ICE
        if (this.currentRemoteClientId) {
          this.signalCallback?.(this.currentRemoteClientId, { type: 'ice_restart_request' });
        }
      }
    }
  }

  public async restartIceConnection() {
    if (!this.peerConnection || !this.isInitiator) return;
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      this.signalCallback?.(this.currentRemoteClientId || undefined, {
        type: 'offer',
        sdp: offer,
        mode: this.currentMode
      });
      this.startConnectionWatchdog();
    } catch (err) {
      console.warn('ICE restart offer failed:', err);
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    // Backpressure threshold: 256 KB
    channel.bufferedAmountLowThreshold = 256 * 1024;

    channel.onopen = () => {
      // In PROGRESSIVE_FILE_DELIVERY mode only, initiate file stream
      if (this.isInitiator && this.currentMode === 'PROGRESSIVE_FILE_DELIVERY' && this.localFile) {
        this.sendFileOverDataChannel(this.localFile);
      }
    };

    channel.onmessage = async (event) => {
      const data = event.data;

      // JSON Control & Metadata Messages
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'file_header') {
            const meta = msg as FileHeaderMeta;
            this.currentSessionId = meta.sessionId || `session_${Date.now()}`;
            this.expectedFileName = meta.fileName;
            this.expectedFileSize = meta.fileSize;
            this.expectedFileType = meta.fileType || 'video/mp4';
            this.receivedBytes = 0;
            this.receivedChunkCount = 0;

            await p2pStorage.startSession(this.currentSessionId, this.expectedFileSize);
            this.onFileProgressListeners.forEach((cb) => cb(0, 0, this.expectedFileSize, 0));
          } else if (msg.type === 'request_file_transfer') {
            // Viewer explicitly requested progressive file download
            if (this.isInitiator && this.localFile) {
              this.sendFileOverDataChannel(this.localFile);
            }
          }
        } catch {
          // not JSON
        }
        return;
      }

      // Binary Chunk Reception
      if (data instanceof ArrayBuffer) {
        this.receivedBytes += data.byteLength;
        const currentChunkIdx = this.receivedChunkCount++;

        // Store chunk safely
        await p2pStorage.appendChunk(currentChunkIdx, data);

        const percent = this.expectedFileSize > 0
          ? Math.min(100, Math.round((this.receivedBytes / this.expectedFileSize) * 100))
          : 0;

        this.onFileProgressListeners.forEach((cb) => cb(percent, this.receivedBytes, this.expectedFileSize, 0));

        // When complete, assemble Blob URL
        if (this.receivedBytes >= this.expectedFileSize && this.expectedFileSize > 0) {
          const blob = await p2pStorage.assembleBlob(this.expectedFileType);
          const blobUrl = URL.createObjectURL(blob);
          this.onFileCompleteListeners.forEach((cb) => cb(blobUrl, this.expectedFileName));
        }
      }
    };
  }

  /**
   * Request host to begin progressive file delivery over DataChannel
   */
  public requestFileTransfer() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'request_file_transfer' }));
    }
  }

  /**
   * Transmits local file to peer using adaptive backpressure (bufferedamountlow event).
   * Dynamically throttles when live video track is active so media playback never stutters.
   */
  public async sendFileOverDataChannel(file: File) {
    const channel = this.dataChannel;
    if (!channel || channel.readyState !== 'open') return;

    if (this.isSendingFile) {
      console.warn('File transfer already in progress');
      return;
    }

    this.isSendingFile = true;
    this.cancelFileTransferFlag = false;

    const sessionId = `transfer_${Date.now()}`;
    channel.send(
      JSON.stringify({
        type: 'file_header',
        sessionId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })
    );

    // Adaptive chunk sizing: 32KB default, 16KB if live media is also active to avoid pipe congestion
    const CHUNK_SIZE = this.currentMode === 'DIRECT_P2P_STREAM' ? 16 * 1024 : 32 * 1024;
    const MAX_BUFFER = 512 * 1024; // 512KB buffer ceiling
    let offset = 0;
    let lastProgressTime = Date.now();
    let bytesSentSinceLastSpeedCheck = 0;

    const sendChunk = async () => {
      while (offset < file.size && !this.cancelFileTransferFlag && channel.readyState === 'open') {
        // Backpressure check: wait for bufferedamountlow if buffer exceeds ceiling
        if (channel.bufferedAmount > MAX_BUFFER) {
          await new Promise<void>((resolve) => {
            const onLow = () => {
              channel.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            channel.addEventListener('bufferedamountlow', onLow);
          });
        }

        if (this.cancelFileTransferFlag || channel.readyState !== 'open') break;

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        try {
          channel.send(buffer);
          offset += buffer.byteLength;
          bytesSentSinceLastSpeedCheck += buffer.byteLength;

          const now = Date.now();
          if (now - lastProgressTime >= 250 || offset >= file.size) {
            const timeDiffSec = (now - lastProgressTime) / 1000;
            const speedKbps = timeDiffSec > 0 ? Math.round((bytesSentSinceLastSpeedCheck * 8) / (timeDiffSec * 1000)) : 0;
            const percent = Math.min(100, Math.round((offset / file.size) * 100));

            this.onFileProgressListeners.forEach((cb) => cb(percent, offset, file.size, speedKbps));
            lastProgressTime = now;
            bytesSentSinceLastSpeedCheck = 0;
          }

          // If live video is playing concurrently, yield briefly to prioritize real-time RTP packets
          if (this.currentMode === 'DIRECT_P2P_STREAM') {
            await new Promise((r) => setTimeout(r, 2));
          }
        } catch (err) {
          console.warn('Error sending file chunk:', err);
          break;
        }
      }

      this.isSendingFile = false;
    };

    sendChunk();
  }

  public onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamListeners.push(callback);
    if (this.remoteStream) {
      callback(this.remoteStream);
    }
    return () => {
      this.onRemoteStreamListeners = this.onRemoteStreamListeners.filter((cb) => cb !== callback);
    };
  }

  public onFileProgress(callback: (percent: number, received: number, total: number, speedKbps: number) => void) {
    this.onFileProgressListeners.push(callback);
    return () => {
      this.onFileProgressListeners = this.onFileProgressListeners.filter((cb) => cb !== callback);
    };
  }

  public onFileComplete(callback: (fileUrl: string, fileName: string) => void) {
    this.onFileCompleteListeners.push(callback);
    return () => {
      this.onFileCompleteListeners = this.onFileCompleteListeners.filter((cb) => cb !== callback);
    };
  }

  public onConnectionState(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateListeners.push(callback);
    return () => {
      this.onConnectionStateListeners = this.onConnectionStateListeners.filter((cb) => cb !== callback);
    };
  }

  public cleanupPeer(full: boolean = true) {
    this.clearConnectionWatchdog();
    this.cancelFileTransferFlag = true;
    this.isSendingFile = false;

    videoQualityController.detachPeer();

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    this.remoteStream = null;
    if (full) {
      this.capturedStream = null;
      this.activeVideoElement = null;
      p2pStorage.clearSession();
    }
  }
}

export const p2pManager = new P2PVideoManager();
