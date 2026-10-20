import React from 'react';
import {
  Activity,
  Wifi,
  HardDrive,
  Cpu,
  Layers,
  X,
  Gauge,
  Film,
  Zap
} from 'lucide-react';
import { P2PConnectionStats, VideoQualityMode } from '../utils/p2pTypes';

interface StreamDiagnosticsHUDProps {
  stats: P2PConnectionStats | null;
  qualityMode: VideoQualityMode;
  onSelectQualityMode: (mode: VideoQualityMode) => void;
  syncDriftMs?: number;
  onClose: () => void;
}

export const StreamDiagnosticsHUD: React.FC<StreamDiagnosticsHUDProps> = ({
  stats,
  qualityMode,
  onSelectQualityMode,
  syncDriftMs = 0,
  onClose
}) => {
  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'SYNCHRONIZED_LOCAL':
        return { title: 'Local File Sync', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'DIRECT_P2P_STREAM':
        return { title: 'Direct WebRTC Stream', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
      case 'PROGRESSIVE_FILE_DELIVERY':
        return { title: 'Progressive P2P Transfer', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      default:
        return { title: 'Direct Media Playback', color: 'text-neutral-300 bg-white/5 border-white/10' };
    }
  };

  const modeInfo = getModeLabel(stats?.currentMode);

  return (
    <div
      className="absolute top-14 right-3 sm:right-6 z-50 w-72 sm:w-80 rounded-2xl bg-neutral-950/92 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-3 sm:p-4 text-xs font-mono text-neutral-300 select-none animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-white tracking-wide">P2P Stream HUD</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close HUD (Shortcut: D)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode Status Badge */}
      <div className="flex items-center justify-between mb-3 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10">
        <span className="text-[11px] text-neutral-400">Mode</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${modeInfo.color}`}>
          {modeInfo.title}
        </span>
      </div>

      {/* Grid of Key Real-Time Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Latency / RTT */}
        <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-0.5">
            <Wifi className="w-3 h-3 text-cyan-400" />
            <span>RTT / Latency</span>
          </div>
          <span className="text-sm font-bold text-white">
            {stats?.rttMs ? `${stats.rttMs} ms` : 'Local / Direct'}
          </span>
        </div>

        {/* Video Bitrate */}
        <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-0.5">
            <Gauge className="w-3 h-3 text-amber-400" />
            <span>Video Bitrate</span>
          </div>
          <span className="text-sm font-bold text-white">
            {stats?.videoBitrateKbps
              ? stats.videoBitrateKbps > 1000
                ? `${(stats.videoBitrateKbps / 1000).toFixed(2)} Mbps`
                : `${stats.videoBitrateKbps} kbps`
              : 'Direct Source'}
          </span>
        </div>

        {/* Resolution & FPS */}
        <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-0.5">
            <Film className="w-3 h-3 text-emerald-400" />
            <span>Resolution</span>
          </div>
          <span className="text-sm font-bold text-white truncate">
            {stats?.videoWidth && stats?.videoHeight
              ? `${stats.videoWidth}x${stats.videoHeight} @ ${stats.framesPerSecond || 30}fps`
              : 'Source Native'}
          </span>
        </div>

        {/* Packet Loss & Drops */}
        <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-0.5">
            <Layers className="w-3 h-3 text-rose-400" />
            <span>Loss / Drops</span>
          </div>
          <span className={`text-sm font-bold ${stats?.packetLossPercent && stats.packetLossPercent > 3 ? 'text-rose-400' : 'text-white'}`}>
            {stats?.packetLossPercent !== undefined ? `${stats.packetLossPercent}%` : '0.0%'}
            {stats?.framesDropped ? ` (${stats.framesDropped} drp)` : ''}
          </span>
        </div>
      </div>

      {/* Sync Drift & ICE details */}
      <div className="space-y-1.5 text-[11px] border-t border-white/10 pt-2.5 mb-3">
        <div className="flex justify-between">
          <span className="text-neutral-400">Sync Offset:</span>
          <span className={`font-semibold ${Math.abs(syncDriftMs) < 100 ? 'text-emerald-400' : 'text-amber-300'}`}>
            {Math.abs(syncDriftMs)} ms {Math.abs(syncDriftMs) < 100 ? '(Perfect)' : '(Compensating)'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">P2P Connection:</span>
          <span className="text-white capitalize">{stats?.connectionState || 'Ready'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-400">Topology:</span>
          <span className="text-neutral-200">
            {stats?.candidateType === 'direct'
              ? 'Direct LAN'
              : stats?.candidateType === 'stun-reflected'
              ? 'STUN Reflected (P2P)'
              : 'Peer-to-Peer'}
          </span>
        </div>
        {stats?.transferProgressPercent !== undefined && (
          <div className="flex justify-between">
            <span className="text-neutral-400">File Cache:</span>
            <span className="text-cyan-400 font-semibold">{stats.transferProgressPercent}%</span>
          </div>
        )}
      </div>

      {/* Quality Profile Quick Selector */}
      <div className="border-t border-white/10 pt-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">AVQ Profile</span>
          <span className="text-[10px] text-neutral-400">Adaptive Encoding</span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
          {(['AUTO', 'HIGH', 'BALANCED', 'LOW_DATA'] as VideoQualityMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSelectQualityMode(mode)}
              className={`py-1 rounded-lg transition-all cursor-pointer font-semibold ${
                qualityMode === mode
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              {mode === 'LOW_DATA' ? 'SAVER' : mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
