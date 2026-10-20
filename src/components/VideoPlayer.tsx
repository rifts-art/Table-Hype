import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  AlertCircle,
  Loader2,
  RefreshCw,
  Film,
  Sparkles,
  VolumeX,
  Volume2,
  ArrowRight,
  HardDrive,
  Radio,
  Zap,
  Upload
} from 'lucide-react';
import { PlayerControls } from './PlayerControls';
import { PlaybackSettings, SyncStatus } from '../types';
import { loadPlaybackSettings, savePlaybackSettings } from '../utils/storage';
import { analyzeVideoUrl } from '../utils/videoUtils';
import { Watermark } from './Watermark';
import { p2pManager } from '../utils/p2pVideo';
import { videoQualityController } from '../utils/p2pQuality';
import { driftSyncEngine } from '../utils/driftSync';
import { StreamDiagnosticsHUD } from './StreamDiagnosticsHUD';
import { P2PConnectionStats, VideoQualityMode, P2PPlaybackMode } from '../utils/p2pTypes';
import { formatBytes } from '../utils/videoConverter';

interface VideoPlayerProps {
  videoUrl: string;
  videoTitle?: string;
  isTableMode?: boolean;
  syncStatus?: SyncStatus;
  isDeviceStream?: boolean;
  deviceMeta?: {
    title: string;
    size: number;
    fileType: string;
    hostClientId: string;
  };
  isHost?: boolean;
  onSyncPlay?: (time: number) => void;
  onSyncPause?: (time: number) => void;
  onSyncSeek?: (time: number) => void;
  onOpenChangeVideo?: () => void;
  onOpenShortcuts?: () => void;
  onOpenConverter?: () => void;
  onLoadUrl?: (url: string, title?: string) => void;
  onSelectLocalMatch?: (file: File) => void;
  onP2PModeChange?: (mode: P2PPlaybackMode) => void;
  onSyncHeartbeat?: (currentTime: number, isPlaying: boolean) => void;
  heartbeatSync?: { currentTime: number; isPlaying: boolean; hostTime: number } | null;
  remoteCommand?: {
    type: 'play' | 'pause' | 'seek';
    time: number;
    id: number;
    senderName?: string;
  } | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  videoTitle,
  isTableMode = false,
  syncStatus = 'synced',
  isDeviceStream = false,
  deviceMeta,
  isHost = false,
  onSyncPlay,
  onSyncPause,
  onSyncSeek,
  onOpenChangeVideo,
  onOpenShortcuts,
  onOpenConverter,
  onLoadUrl,
  onSelectLocalMatch,
  onP2PModeChange,
  onSyncHeartbeat,
  heartbeatSync,
  remoteCommand
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localMatchInputRef = useRef<HTMLInputElement>(null);

  // Individual persistent playback settings
  const [settings, setSettings] = useState<PlaybackSettings>(() => loadPlaybackSettings());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(videoUrl));
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [centerNotification, setCenterNotification] = useState<{
    icon: 'play' | 'pause' | 'seek' | 'vol';
    text?: string;
  } | null>(null);
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null);

  // P2P WebRTC State
  const [p2pTransferPercent, setP2PTransferPercent] = useState<number | null>(null);
  const [hasRemoteMediaStream, setHasRemoteMediaStream] = useState(false);
  const [localCompletedUrl, setLocalCompletedUrl] = useState<string | null>(null);

  // Diagnostics & Adaptive Quality State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [p2pStats, setP2PStats] = useState<P2PConnectionStats | null>(null);
  const [qualityMode, setQualityMode] = useState<VideoQualityMode>(() => videoQualityController.getQualityMode());
  const [syncDriftMs, setSyncDriftMs] = useState(0);

  // Inline URL input for empty state
  const [inlineInput, setInlineInput] = useState('');

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const centerNoticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInternalSeekingRef = useRef(false);
  const isExecutingRemoteRef = useRef(false);

  // Check PiP support
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsPipSupported('pictureInPictureEnabled' in document && Boolean(document.pictureInPictureEnabled));
    }
  }, []);

  // WebRTC P2P listeners for remote viewer
  useEffect(() => {
    const unsubStream = p2pManager.onRemoteStream((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasRemoteMediaStream(true);
        setIsLoading(false);
        setErrorMessage(null);
        videoRef.current.play().catch(() => {});
      }
    });

    const unsubProgress = p2pManager.onFileProgress((percent) => {
      setP2PTransferPercent(percent);
    });

    const unsubComplete = p2pManager.onFileComplete((blobUrl) => {
      setLocalCompletedUrl(blobUrl);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = blobUrl;
        setHasRemoteMediaStream(false);
        setIsLoading(false);
        setErrorMessage(null);
        videoRef.current.play().catch(() => {});
      }
    });

    const unsubDiagnostics = p2pManager.onDiagnostics((stats) => {
      setP2PStats(stats);
    });

    return () => {
      unsubStream();
      unsubProgress();
      unsubComplete();
      unsubDiagnostics();
    };
  }, []);

  // Keyboard shortcut: Toggle diagnostics HUD on 'D' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'd' || e.key === 'D') {
        setIsDiagnosticsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Host sends periodic heartbeat so viewers maintain drift compensation
  useEffect(() => {
    if (!isHost || !isTableMode || !isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        onSyncHeartbeat?.(videoRef.current.currentTime, true);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isHost, isTableMode, isPlaying, onSyncHeartbeat]);

  // Viewer receives heartbeat and compensates drift smoothly without stutter
  useEffect(() => {
    if (!heartbeatSync || isHost || !videoRef.current || isExecutingRemoteRef.current) return;
    const video = videoRef.current;

    if (heartbeatSync.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!heartbeatSync.isPlaying && !video.paused) {
      video.pause();
    }

    const correction = driftSyncEngine.calculateCorrection(video.currentTime, heartbeatSync.currentTime, video);
    setSyncDriftMs(Math.round(correction.currentDriftSeconds * 1000));
  }, [heartbeatSync, isHost]);

  // Determine actual video src:
  // If host has local device file: use local blob
  // If viewer has completed local blob: use completed blob
  // Else if plain URL: use plain URL
  const isP2PPlaceholder = videoUrl.startsWith('local-device-p2p://') || isDeviceStream;
  const hostLocalBlob = p2pManager.getLocalBlobUrl();

  let effectiveSrc = videoUrl;
  if (isP2PPlaceholder) {
    if (hostLocalBlob) {
      effectiveSrc = hostLocalBlob;
    } else if (localCompletedUrl) {
      effectiveSrc = localCompletedUrl;
    } else {
      effectiveSrc = ''; // will use srcObject for live WebRTC stream
    }
  }

  // Sync settings updates to localStorage
  const updateSettings = useCallback((newSettings: Partial<PlaybackSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (updated.rememberSettings) {
        savePlaybackSettings(updated);
      }
      return updated;
    });
  }, []);

  // Trigger brief visual center notification icon
  const flashCenterNotice = useCallback((icon: 'play' | 'pause' | 'seek' | 'vol', text?: string) => {
    setCenterNotification({ icon, text });
    if (centerNoticeTimeoutRef.current) clearTimeout(centerNoticeTimeoutRef.current);
    centerNoticeTimeoutRef.current = setTimeout(() => {
      setCenterNotification(null);
    }, 800);
  }, []);

  // Handle play / pause action
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || (!effectiveSrc && !hasRemoteMediaStream)) return;

    if (video.paused || video.ended) {
      video.play().catch((err) => {
        console.warn('Playback failed:', err);
      });
      flashCenterNotice('play');
      if (isTableMode && onSyncPlay) {
        onSyncPlay(video.currentTime);
      }
    } else {
      video.pause();
      flashCenterNotice('pause');
      if (isTableMode && onSyncPause) {
        onSyncPause(video.currentTime);
      }
    }
  }, [effectiveSrc, hasRemoteMediaStream, flashCenterNotice, isTableMode, onSyncPlay, onSyncPause]);

  // Handle Seek
  const handleSeek = useCallback((targetTime: number) => {
    const video = videoRef.current;
    if (!video || !effectiveSrc) return;

    const clampedTime = Math.max(0, Math.min(video.duration || targetTime, targetTime));
    isInternalSeekingRef.current = true;
    video.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    flashCenterNotice('seek');

    if (isTableMode && onSyncSeek) {
      onSyncSeek(clampedTime);
    }

    setTimeout(() => {
      isInternalSeekingRef.current = false;
    }, 200);
  }, [effectiveSrc, flashCenterNotice, isTableMode, onSyncSeek]);

  // Volume Change
  const handleVolumeChange = useCallback((newVol: number) => {
    const video = videoRef.current;
    const clamped = Math.max(0, Math.min(1, newVol));
    updateSettings({ volume: clamped, muted: clamped === 0 });
    if (video) {
      video.volume = clamped;
      video.muted = clamped === 0;
    }
    flashCenterNotice('vol', `${Math.round(clamped * 100)}%`);
  }, [updateSettings, flashCenterNotice]);

  // Toggle Mute
  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !settings.muted;
    updateSettings({ muted: newMuted });
    video.muted = newMuted;
    flashCenterNotice('vol', newMuted ? 'Muted' : `${Math.round(settings.volume * 100)}%`);
  }, [settings.muted, settings.volume, updateSettings, flashCenterNotice]);

  // Speed Change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    const video = videoRef.current;
    updateSettings({ speed: newSpeed });
    driftSyncEngine.setUserSpeed(newSpeed);
    if (video) {
      video.playbackRate = newSpeed;
    }
  }, [updateSettings]);

  // Toggle Fullscreen
  const handleToggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  }, []);

  // Toggle Picture-in-Picture
  const handleTogglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isPipSupported) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  }, [isPipSupported]);

  // Auto-hide controls when cursor is idle during playback
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Synchronize remote commands from partner
  useEffect(() => {
    if (!remoteCommand || !videoRef.current || (!effectiveSrc && !hasRemoteMediaStream)) return;

    isExecutingRemoteRef.current = true;
    const video = videoRef.current;

    if (remoteCommand.senderName) {
      const verb =
        remoteCommand.type === 'play'
          ? 'started stream'
          : remoteCommand.type === 'pause'
          ? 'paused stream'
          : 'scrubbed timeline';
      setRemoteNotice(`${remoteCommand.senderName} ${verb}`);
      setTimeout(() => setRemoteNotice(null), 2500);
    }

    if (remoteCommand.type === 'play') {
      if (Math.abs(video.currentTime - remoteCommand.time) > 0.5) {
        video.currentTime = remoteCommand.time;
      }
      video.play().catch(() => {});
    } else if (remoteCommand.type === 'pause') {
      video.pause();
      if (Math.abs(video.currentTime - remoteCommand.time) > 0.5) {
        video.currentTime = remoteCommand.time;
      }
    } else if (remoteCommand.type === 'seek') {
      video.currentTime = remoteCommand.time;
    }

    setTimeout(() => {
      isExecutingRemoteRef.current = false;
    }, 400);
  }, [remoteCommand, effectiveSrc, hasRemoteMediaStream]);

  // Reset video state on URL change
  useEffect(() => {
    if (!effectiveSrc && !hasRemoteMediaStream) {
      if (isP2PPlaceholder && !isHost) {
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
      setErrorMessage(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setIsPlaying(false);
    setCurrentTime(0);

    const video = videoRef.current;
    if (video) {
      video.playbackRate = settings.speed;
      video.volume = settings.volume;
      video.muted = settings.muted;
      if (effectiveSrc) {
        video.src = effectiveSrc;
        video.load();
      }
    }
  }, [effectiveSrc, isP2PPlaceholder, isHost, hasRemoteMediaStream, settings.speed, settings.volume, settings.muted]);

  // Native Video Event Handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    if (video.buffered.length > 0) {
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
          setBufferedTime(video.buffered.end(i));
          break;
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setIsLoading(false);
    video.playbackRate = settings.speed;
    video.volume = settings.volume;
    video.muted = settings.muted;

    // Capture media stream for WebRTC peers if host streaming local file
    if (isHost && p2pManager.getLocalFile()) {
      p2pManager.captureStreamFromVideo(video);
    }
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handleCanPlay = () => {
    setIsBuffering(false);
    setIsLoading(false);

    if (isHost && p2pManager.getLocalFile()) {
      const video = videoRef.current;
      if (video) p2pManager.captureStreamFromVideo(video);
    }
  };

  const handleError = () => {
    const video = videoRef.current;
    setIsLoading(false);
    setIsBuffering(false);
    if (!effectiveSrc && !hasRemoteMediaStream) return;

    if (video?.error) {
      const code = video.error.code;
      if (code === 4) {
        setErrorMessage('Stream format not supported or source lacks direct CORS permissions.');
      } else if (code === 2) {
        setErrorMessage('Network connection lost while loading media stream.');
      } else {
        setErrorMessage('Unable to decode video. Verify this is a valid MP4, WebM, or HLS stream.');
      }
    } else {
      setErrorMessage('Failed to connect to video stream.');
    }
  };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineInput.trim()) return;
    if (onLoadUrl) {
      const check = analyzeVideoUrl(inlineInput.trim());
      onLoadUrl(inlineInput.trim(), check.suggestedTitle || 'Direct Video Stream');
    } else if (onOpenChangeVideo) {
      onOpenChangeVideo();
    }
  };

  const handleLocalMatchSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const blobUrl = p2pManager.setLocalFile(file);
      p2pManager.setPlaybackMode('SYNCHRONIZED_LOCAL');
      onP2PModeChange?.('SYNCHRONIZED_LOCAL');
      setLocalCompletedUrl(blobUrl);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = blobUrl;
        videoRef.current.play().catch(() => {});
      }
      onSelectLocalMatch?.(file);
    }
  };

  const isAwaitingP2PStream = isP2PPlaceholder && !isHost && !hasRemoteMediaStream && !localCompletedUrl;

  return (
    <div
      ref={containerRef}
      id="table-cinema-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`relative w-full ${!videoUrl || isAwaitingP2PStream ? 'min-h-[380px] sm:min-h-[420px] sm:aspect-video' : 'aspect-video'} max-h-[85vh] bg-black rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.9)] select-none group/player flex items-center justify-center`}
    >
      {/* Ambient Cinema Backglow Halo */}
      {settings.ambientGlow && isPlaying && !errorMessage && (
        <div
          className="absolute -inset-4 opacity-30 pointer-events-none filter blur-3xl transition-opacity duration-1000 -z-10 bg-white/10"
          aria-hidden="true"
        />
      )}

      {/* Main Video Element */}
      <video
        ref={videoRef}
        id="table-native-video"
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={handleError}
        onClick={togglePlayPause}
        className={`w-full h-full cursor-pointer transition-all duration-300 ${
          settings.objectFit === 'cover' ? 'object-cover' : 'object-contain'
        } ${!videoUrl || isAwaitingP2PStream ? 'hidden' : 'block'}`}
      />

      {/* Awaiting P2P Host Stream View */}
      {isAwaitingP2PStream && (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-950/95 z-20">
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-white mb-4 shadow-xl animate-pulse">
            <Radio className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Connecting P2P Stream to Host Device
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mb-2 max-w-sm leading-relaxed">
            Host is streaming "{deviceMeta?.title || videoTitle}" directly from their device peer-to-peer.
          </p>

          {deviceMeta && (
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300 mb-5 flex items-center gap-2">
              <Film className="w-3.5 h-3.5" />
              <span>{formatBytes(deviceMeta.size)}</span>
              <span>•</span>
              <span>100% Local WebRTC</span>
            </div>
          )}

          {p2pTransferPercent !== null && (
            <div className="w-full max-w-xs flex flex-col gap-1.5 mb-5">
              <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                <span>Receiving direct P2P data...</span>
                <span>{p2pTransferPercent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-150"
                  style={{ width: `${p2pTransferPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Action options */}
          <div className="flex flex-col items-center gap-2.5 w-full max-w-md">
            <input
              ref={localMatchInputRef}
              type="file"
              accept="video/*"
              onChange={handleLocalMatchSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => localMatchInputRef.current?.click()}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
            >
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Have this file on your device? Match for Instant 4K Playback</span>
            </button>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => p2pManager.restartIceConnection()}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  p2pManager.setPlaybackMode('PROGRESSIVE_FILE_DELIVERY');
                  p2pManager.requestFileTransfer();
                }}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Request File Cache</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Canvas State when no video is loaded */}
      {!videoUrl && (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-950/95 z-20">
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-white mb-4 shadow-xl">
            <Film className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1 tracking-tight">No Video Loaded</h3>
          <p className="text-xs text-neutral-400 mb-6 max-w-sm leading-relaxed">
            Enter a direct video URL or add a video directly from your device to start synchronized streaming.
          </p>
          <form
            onSubmit={handleInlineSubmit}
            className="w-full max-w-md flex flex-col sm:flex-row items-center gap-2"
          >
            <input
              id="empty-player-url-input"
              type="url"
              value={inlineInput}
              onChange={(e) => setInlineInput(e.target.value)}
              placeholder="Paste direct video URL (.mp4, .webm, .m3u8)..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-base sm:text-xs placeholder-neutral-500 focus:outline-none focus:border-white/40 transition-colors"
            />
            <button
              id="empty-player-load-btn"
              type="submit"
              disabled={!inlineInput.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shadow-md flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>Load Stream</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {onOpenConverter && (
            <button
              type="button"
              onClick={onOpenConverter}
              className="mt-4 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md w-full sm:w-auto max-w-md text-center"
            >
              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Add Video Directly from Device (100% Local P2P)</span>
            </button>
          )}
        </div>
      )}

      {/* Subtitles Overlay if enabled */}
      {settings.subtitleTrackUrl && videoUrl && !isAwaitingP2PStream && (
        <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 pointer-events-none max-w-[85%] text-center z-20">
          <span
            className={`inline-block px-3 py-1 rounded-lg text-white font-medium ${
              settings.subtitleFontSize === 'large'
                ? 'text-lg sm:text-xl'
                : settings.subtitleFontSize === 'small'
                ? 'text-xs sm:text-sm'
                : 'text-sm sm:text-base'
            } ${settings.subtitleBackground ? 'bg-black/80 backdrop-blur-sm border border-white/10' : 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]'}`}
          >
            [Synchronized Video Audio Track]
          </span>
        </div>
      )}

      {/* Top Glass Header Bar (Over video) - auto fades when idle */}
      {videoUrl && !isAwaitingP2PStream && (
        <div
          className={`absolute top-0 left-0 right-0 p-2.5 sm:p-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-30 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-3 pointer-events-auto max-w-[70%]">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white">
              {isP2PPlaceholder ? <Zap className="w-4 h-4 text-emerald-400" /> : <Film className="w-4 h-4" />}
            </div>
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate">
                  {videoTitle || 'Direct Video Stream'}
                </span>
                {isP2PPlaceholder && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Local Device P2P
                  </span>
                )}
              </div>
              <span className="text-[10px] text-neutral-400 font-mono truncate">
                {isP2PPlaceholder ? (isHost ? 'Streaming directly from your device' : 'Streaming directly from host device') : videoUrl}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <Watermark variant="subtle" />
          </div>
        </div>
      )}

      {/* Brief Flash Notification in Center on play/pause/vol */}
      {centerNotification && (
        <div className="absolute z-40 pointer-events-none p-5 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 text-white shadow-2xl flex flex-col items-center justify-center animate-scale-up">
          {centerNotification.icon === 'play' && <Play className="w-8 h-8 fill-current" />}
          {centerNotification.icon === 'pause' && <Pause className="w-8 h-8 fill-current" />}
          {centerNotification.icon === 'vol' && <Volume2 className="w-8 h-8" />}
          {centerNotification.text && (
            <span className="text-xs font-mono font-bold mt-1 tracking-wider">
              {centerNotification.text}
            </span>
          )}
        </div>
      )}

      {/* Remote Sync Partner Action Toast */}
      {remoteNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-neutral-900/90 border border-white/15 text-white text-xs font-mono z-40 shadow-2xl backdrop-blur-xl animate-fade-in flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{remoteNotice}</span>
        </div>
      )}

      {/* Buffering Indicator */}
      {(isLoading || isBuffering) && videoUrl && !errorMessage && !isAwaitingP2PStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-xs z-30 pointer-events-none">
          <Loader2 className="w-10 h-10 text-white animate-spin stroke-[1.5]" />
          <span className="text-xs font-mono tracking-wider uppercase text-neutral-300">
            {isLoading ? 'Buffering Stream...' : 'Buffering...'}
          </span>
        </div>
      )}

      {/* Error State Overlay */}
      {errorMessage && !isAwaitingP2PStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-neutral-950/90 backdrop-blur-xl border border-red-500/20 z-40 text-center max-w-lg mx-auto rounded-3xl my-auto h-auto shadow-2xl">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white mb-3">
            <AlertCircle className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1 tracking-wide">
            Stream Unavailable
          </h3>
          <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
            {errorMessage}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Stream
            </button>
            {onOpenChangeVideo && (
              <button
                type="button"
                onClick={onOpenChangeVideo}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-medium text-xs transition-all cursor-pointer"
              >
                Change Video
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stream Diagnostics Overlay HUD (Toggle with 'D' or Player Button) */}
      {isDiagnosticsOpen && (
        <StreamDiagnosticsHUD
          stats={p2pStats}
          qualityMode={qualityMode}
          onSelectQualityMode={(m) => {
            setQualityMode(m);
            p2pManager.setQualityMode(m);
          }}
          syncDriftMs={syncDriftMs}
          onClose={() => setIsDiagnosticsOpen(false)}
        />
      )}

      {/* Bottom Floating Glass Controls */}
      {videoUrl && !isAwaitingP2PStream && (
        <div
          className={`absolute bottom-0 left-0 right-0 p-2 sm:p-5 z-30 transition-opacity duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            bufferedTime={bufferedTime}
            settings={settings}
            syncStatus={syncStatus}
            isTableMode={isTableMode}
            isFullscreen={isFullscreen}
            isPipSupported={isPipSupported}
            isDiagnosticsOpen={isDiagnosticsOpen}
            qualityMode={qualityMode}
            onPlayPause={togglePlayPause}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onSpeedChange={handleSpeedChange}
            onToggleFullscreen={handleToggleFullscreen}
            onTogglePip={handleTogglePip}
            onToggleDiagnostics={() => setIsDiagnosticsOpen((prev) => !prev)}
            onSelectQualityMode={(m) => {
              setQualityMode(m);
              p2pManager.setQualityMode(m);
            }}
            onUpdateSettings={updateSettings}
            onOpenShortcuts={() => onOpenShortcuts?.()}
          />
        </div>
      )}
    </div>
  );
};
