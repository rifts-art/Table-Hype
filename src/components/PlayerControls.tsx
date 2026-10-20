import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  Settings,
  Tv,
  Subtitles,
  RotateCcw,
  Sparkles,
  Check,
  Radio,
  Sliders,
  Keyboard,
  Activity
} from 'lucide-react';
import { formatTime } from '../utils/videoUtils';
import { PlaybackSettings, SyncStatus } from '../types';
import { VideoQualityMode } from '../utils/p2pTypes';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedTime: number;
  settings: PlaybackSettings;
  syncStatus?: SyncStatus;
  isTableMode?: boolean;
  isFullscreen: boolean;
  isPipSupported: boolean;
  isDiagnosticsOpen?: boolean;
  qualityMode?: VideoQualityMode;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleFullscreen: () => void;
  onTogglePip: () => void;
  onToggleDiagnostics?: () => void;
  onSelectQualityMode?: (mode: VideoQualityMode) => void;
  onUpdateSettings: (newSettings: Partial<PlaybackSettings>) => void;
  onOpenShortcuts: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  bufferedTime,
  settings,
  syncStatus = 'synced',
  isTableMode = false,
  isFullscreen,
  isPipSupported,
  isDiagnosticsOpen = false,
  qualityMode = 'AUTO',
  onPlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onSpeedChange,
  onToggleFullscreen,
  onTogglePip,
  onToggleDiagnostics,
  onSelectQualityMode,
  onUpdateSettings,
  onOpenShortcuts
}) => {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
        setShowSpeedMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleProgressBarMouseLeave = () => {
    if (!isScrubbing) {
      setHoverPosition(null);
      setHoverTime(null);
    }
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    onSeek(targetTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  return (
    <div
      className="w-full flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-neutral-950/85 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)] transition-all"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Timeline Scrub Bar */}
      <div
        ref={progressBarRef}
        className="relative group w-full py-1.5 sm:py-2 cursor-pointer touch-none select-none"
        onMouseMove={handleProgressBarMouseMove}
        onMouseLeave={handleProgressBarMouseLeave}
        onClick={handleSeekClick}
      >
        {/* Track background */}
        <div className="relative w-full h-1.5 sm:h-2 rounded-full bg-white/15 overflow-hidden transition-all group-hover:h-3">
          {/* Buffered track */}
          <div
            className="absolute top-0 left-0 h-full bg-white/25 rounded-full transition-all duration-300 pointer-events-none"
            style={{ width: `${Math.min(100, Math.max(0, bufferedPercent))}%` }}
          />

          {/* Played track */}
          <div
            className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-75 pointer-events-none"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>

        {/* Scrubber Thumb Indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white border border-black shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-transform duration-75 group-hover:scale-125 pointer-events-none"
          style={{ left: `calc(${Math.min(100, Math.max(0, progressPercent))}% - 7px)` }}
        />

        {/* Hover Time Tooltip */}
        {hoverPosition !== null && hoverTime !== null && (
          <div
            className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded-md bg-neutral-900/95 border border-white/20 text-[11px] font-mono text-white shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: `${hoverPosition}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      {/* Controls row (Strict flex-nowrap to prevent button collisions on mobile) */}
      <div className="flex items-center justify-between gap-1 sm:gap-4 flex-nowrap min-w-0">
        {/* Left section: Play/Pause, Volume, Time, Sync status */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Play/Pause Button */}
          <button
            id="player-play-pause-btn"
            type="button"
            onClick={onPlayPause}
            className="p-1.5 sm:p-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer shrink-0"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
          </button>

          {/* Volume Control */}
          <div className="flex items-center group/vol relative shrink-0">
            <button
              id="player-mute-btn"
              type="button"
              onClick={onToggleMute}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer shrink-0"
              title={settings.muted ? 'Unmute (M)' : 'Mute (M)'}
              aria-label="Toggle mute"
            >
              {settings.muted || settings.volume === 0 ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : settings.volume < 0.5 ? (
                <Volume1 className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            {/* Volume Slider Expand on hover/focus (Desktop only) */}
            <div className="w-16 sm:w-20 transition-all hidden sm:flex items-center pl-1">
              <input
                id="player-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={settings.muted ? 0 : settings.volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                aria-label="Volume slider"
              />
            </div>
          </div>

          {/* Time Display */}
          <div className="flex items-center text-[10px] sm:text-xs font-mono text-neutral-300 tracking-tight select-none shrink-0">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-0.5 sm:mx-1 text-neutral-500">/</span>
            <span className="text-neutral-400">{formatTime(duration)}</span>
          </div>

          {/* Room Sync Status Badge (if in Table Mode) */}
          {isTableMode && (
            <div
              className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider select-none transition-colors shrink-0 ${
                syncStatus === 'synced'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : syncStatus === 'seeking'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-white/5 border-white/20 text-neutral-300'
              }`}
              title="Synchronization status with duo partner"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-400 animate-pulse'
                    : syncStatus === 'seeking'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-neutral-400'
                }`}
              />
              <span className="hidden sm:inline">
                {syncStatus === 'synced' ? 'Synced' : syncStatus === 'seeking' ? 'Seeking' : 'Syncing'}
              </span>
            </div>
          )}
        </div>

        {/* Right section: Speed, Subtitles, Settings, Shortcuts, PiP, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5 relative shrink-0" ref={settingsMenuRef}>
          {/* Playback Speed Quick Toggle */}
          <div className="relative">
            <button
              id="player-speed-btn"
              type="button"
              onClick={() => {
                setShowSpeedMenu(!showSpeedMenu);
                setShowSettingsMenu(false);
              }}
              className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-neutral-300 hover:text-white transition-all cursor-pointer select-none"
              title="Independent Playback Speed"
            >
              {settings.speed}×
            </button>

            {/* Speed popover menu */}
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-32 p-1 rounded-xl bg-neutral-900/95 border border-white/15 backdrop-blur-xl shadow-2xl z-50 flex flex-col gap-0.5">
                <div className="px-2 py-1 text-[10px] font-mono text-neutral-400 uppercase tracking-wider border-b border-white/10">
                  Speed (Local)
                </div>
                {speeds.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onSpeedChange(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                      settings.speed === s ? 'bg-white text-black font-semibold' : 'text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{s}×</span>
                    {settings.speed === s && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subtitles Quick Toggle */}
          <button
            id="player-subtitles-btn"
            type="button"
            onClick={() => {
              const current = settings.subtitleTrackUrl;
              onUpdateSettings({
                subtitleTrackUrl: current ? null : 'active'
              });
            }}
            className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              settings.subtitleTrackUrl
                ? 'bg-white text-black font-bold'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
            title="Subtitles / Captions (C)"
            aria-label="Subtitles"
          >
            <Subtitles className="w-4 h-4" />
          </button>

          {/* Diagnostics HUD Button */}
          {onToggleDiagnostics && (
            <button
              id="player-diagnostics-btn"
              type="button"
              onClick={onToggleDiagnostics}
              className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                isDiagnosticsOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:text-white hover:bg-white/10'
              }`}
              title="Stream Diagnostics HUD (D)"
              aria-label="Stream Diagnostics"
            >
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Settings Menu Button */}
          <div className="relative shrink-0">
            <button
              id="player-settings-btn"
              type="button"
              onClick={() => {
                setShowSettingsMenu(!showSettingsMenu);
                setShowSpeedMenu(false);
              }}
              className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                showSettingsMenu ? 'bg-white/20 text-white' : 'text-neutral-300 hover:text-white hover:bg-white/10'
              }`}
              title="Individual Playback Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Comprehensive Settings Popover */}
            {showSettingsMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-2xl bg-neutral-900/95 border border-white/15 backdrop-blur-2xl shadow-2xl z-50 text-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Personal Preferences
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">Independent</span>
                </div>

                {/* Adaptive Stream Quality Profile */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 text-[11px]">Stream Quality</span>
                    <span className="text-[10px] text-cyan-400 font-mono">AVQ</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5 text-center">
                    {(['AUTO', 'HIGH', 'BALANCED', 'LOW_DATA'] as VideoQualityMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onSelectQualityMode?.(mode)}
                        className={`py-1 rounded text-[10px] font-semibold transition-colors ${
                          qualityMode === mode ? 'bg-white text-black' : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        {mode === 'LOW_DATA' ? 'Saver' : mode === 'BALANCED' ? 'Bal' : mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Diagnostics HUD Toggle */}
                {onToggleDiagnostics && (
                  <div className="flex items-center justify-between py-1 border-t border-white/5">
                    <div className="flex flex-col">
                      <span className="text-white text-[11px] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        Stats for Nerds (HUD)
                      </span>
                      <span className="text-[10px] text-neutral-400">Real-time P2P metrics (D)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isDiagnosticsOpen}
                      onChange={() => onToggleDiagnostics()}
                      className="w-4 h-4 rounded bg-white/10 accent-white cursor-pointer"
                    />
                  </div>
                )}

                {/* Aspect Ratio / Fit */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                  <span className="text-neutral-400 text-[11px]">Video Aspect Fit</span>
                  <div className="grid grid-cols-2 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ objectFit: 'contain' })}
                      className={`py-1 rounded text-center text-xs transition-colors ${
                        settings.objectFit === 'contain' ? 'bg-white text-black font-semibold' : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      Contain (Original)
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ objectFit: 'cover' })}
                      className={`py-1 rounded text-center text-xs transition-colors ${
                        settings.objectFit === 'cover' ? 'bg-white text-black font-semibold' : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      Fill (Cover)
                    </button>
                  </div>
                </div>

                {/* Ambient Cinema Backglow */}
                <div className="flex items-center justify-between py-1 border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-white font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-neutral-400" />
                      Ambient Backglow
                    </span>
                    <span className="text-[10px] text-neutral-400">Smoky glass cinema halo</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.ambientGlow}
                    onChange={(e) => onUpdateSettings({ ambientGlow: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 accent-white cursor-pointer"
                  />
                </div>

                {/* Subtitle font size */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                  <span className="text-neutral-400 text-[11px]">Subtitle Size</span>
                  <div className="grid grid-cols-3 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5 text-center">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => onUpdateSettings({ subtitleFontSize: size })}
                        className={`py-1 rounded text-[11px] capitalize transition-colors ${
                          settings.subtitleFontSize === size ? 'bg-white text-black font-semibold' : 'text-neutral-300'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loop Video */}
                <div className="flex items-center justify-between py-1 border-t border-white/5">
                  <span className="text-white">Loop Playback</span>
                  <input
                    type="checkbox"
                    checked={settings.loop}
                    onChange={(e) => onUpdateSettings({ loop: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 accent-white cursor-pointer"
                  />
                </div>

                {/* Remember individual settings */}
                <div className="flex items-center justify-between py-1 border-t border-white/5">
                  <span className="text-white text-[11px]">Remember My Settings</span>
                  <input
                    type="checkbox"
                    checked={settings.rememberSettings}
                    onChange={(e) => onUpdateSettings({ rememberSettings: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 accent-white cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Guide */}
          <button
            id="player-shortcuts-btn"
            type="button"
            onClick={onOpenShortcuts}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer hidden sm:flex"
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Picture in Picture */}
          {isPipSupported && (
            <button
              id="player-pip-btn"
              type="button"
              onClick={onTogglePip}
              className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer hidden xs:flex"
              title="Picture in Picture (P)"
              aria-label="Picture in Picture"
            >
              <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            id="player-fullscreen-btn"
            type="button"
            onClick={onToggleFullscreen}
            className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            aria-label="Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
