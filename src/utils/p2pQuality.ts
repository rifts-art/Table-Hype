/**
 * Adaptive Video Quality (AVQ) Controller for WebRTC P2P Video Streaming.
 * Actively monitors network health, RTT, packet loss, and frame drops,
 * adapting encoding bitrate and resolution to prevent buffering and stutter.
 */

import { P2PConnectionStats, VideoQualityMode, QualityProfile } from './p2pTypes';

export const QUALITY_PROFILES: Record<VideoQualityMode, QualityProfile> = {
  AUTO: {
    name: 'AUTO',
    label: 'Auto (Adaptive)',
    maxBitrateKbps: 3500,
    scaleResolutionDownBy: 1.0,
    maxFramerate: 60,
    description: 'Dynamically adapts resolution and bitrate based on real-time network conditions'
  },
  HIGH: {
    name: 'HIGH',
    label: 'High (1080p target)',
    maxBitrateKbps: 4500,
    scaleResolutionDownBy: 1.0,
    maxFramerate: 60,
    description: 'Maximum visual fidelity for high-speed Wi-Fi or broadband'
  },
  BALANCED: {
    name: 'BALANCED',
    label: 'Balanced (720p target)',
    maxBitrateKbps: 2000,
    scaleResolutionDownBy: 1.5,
    maxFramerate: 30,
    description: 'Smooth 720p performance optimized for standard internet connections'
  },
  LOW_DATA: {
    name: 'LOW_DATA',
    label: 'Data Saver (480p target)',
    maxBitrateKbps: 750,
    scaleResolutionDownBy: 2.0,
    maxFramerate: 24,
    description: 'Reduced bandwidth footprint for mobile cellular data or weak networks'
  }
};

export class VideoQualityController {
  private peerConnection: RTCPeerConnection | null = null;
  private currentMode: VideoQualityMode = 'AUTO';
  private statsInterval: any = null;
  private listeners: Array<(stats: P2PConnectionStats) => void> = [];

  // Previous stats for delta calculations
  private lastTimestamp: number = 0;
  private lastBytesSent: number = 0;
  private lastBytesReceived: number = 0;
  private lastPacketsReceived: number = 0;
  private lastPacketsLost: number = 0;

  // Auto-adaptation damping state
  private autoTierIndex: number = 2; // 0: LOW, 1: BALANCED, 2: HIGH
  private stableCount: number = 0;

  constructor() {}

  public attachPeer(pc: RTCPeerConnection) {
    this.peerConnection = pc;
    this.startMonitoring();
  }

  public detachPeer() {
    this.stopMonitoring();
    this.peerConnection = null;
  }

  public setQualityMode(mode: VideoQualityMode) {
    this.currentMode = mode;
    this.applyEncodingProfile();
  }

  public getQualityMode(): VideoQualityMode {
    return this.currentMode;
  }

  public onStats(callback: (stats: P2PConnectionStats) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private startMonitoring() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.statsInterval = setInterval(() => {
      this.pollStats();
    }, 1200);
  }

  private stopMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private async pollStats() {
    if (!this.peerConnection || this.peerConnection.connectionState === 'closed') {
      return;
    }

    try {
      const statsReport = await this.peerConnection.getStats();
      const currentStats: Partial<P2PConnectionStats> = {
        connectionState: this.peerConnection.connectionState,
        iceConnectionState: this.peerConnection.iceConnectionState,
        iceGatheringState: this.peerConnection.iceGatheringState,
        rttMs: 0,
        packetLossPercent: 0,
        packetsLost: 0,
        packetsReceived: 0,
        jitterMs: 0,
        videoBitrateKbps: 0,
        audioBitrateKbps: 0,
        videoWidth: 0,
        videoHeight: 0,
        framesPerSecond: 0,
        framesDecoded: 0,
        framesDropped: 0,
        candidateType: 'unknown',
        qualityLimitation: 'none'
      };

      const now = Date.now();
      const timeDeltaSec = (now - this.lastTimestamp) / 1000;

      statsReport.forEach((report: any) => {
        // Candidate pair details
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (typeof report.currentRoundTripTime === 'number') {
            currentStats.rttMs = Math.round(report.currentRoundTripTime * 1000);
          } else if (typeof report.roundTripTime === 'number') {
            currentStats.rttMs = Math.round(report.roundTripTime * 1000);
          }

          if (report.availableOutgoingBitrate) {
            currentStats.availableOutgoingBitrateKbps = Math.round(report.availableOutgoingBitrate / 1000);
          }
        }

        // Local candidate type (privacy safe)
        if (report.type === 'local-candidate') {
          if (report.candidateType === 'host') {
            currentStats.candidateType = 'direct';
          } else if (report.candidateType === 'srflx') {
            currentStats.candidateType = 'stun-reflected';
          } else if (report.candidateType === 'relay') {
            currentStats.candidateType = 'relay';
          }
        }

        // Outbound video RTP (Host perspective)
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          if (report.bytesSent && timeDeltaSec > 0 && this.lastBytesSent > 0) {
            const bytesDiff = report.bytesSent - this.lastBytesSent;
            currentStats.videoBitrateKbps = Math.round((bytesDiff * 8) / (timeDeltaSec * 1000));
          }
          this.lastBytesSent = report.bytesSent || 0;

          if (report.frameWidth) currentStats.videoWidth = report.frameWidth;
          if (report.frameHeight) currentStats.videoHeight = report.frameHeight;
          if (report.framesPerSecond) currentStats.framesPerSecond = Math.round(report.framesPerSecond);
          if (report.qualityLimitationReason) currentStats.qualityLimitation = report.qualityLimitationReason;
        }

        // Inbound video RTP (Viewer perspective)
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          if (report.bytesReceived && timeDeltaSec > 0 && this.lastBytesReceived > 0) {
            const bytesDiff = report.bytesReceived - this.lastBytesReceived;
            currentStats.videoBitrateKbps = Math.round((bytesDiff * 8) / (timeDeltaSec * 1000));
          }
          this.lastBytesReceived = report.bytesReceived || 0;

          if (typeof report.packetsLost === 'number') {
            currentStats.packetsLost = report.packetsLost;
            const deltaLost = Math.max(0, report.packetsLost - this.lastPacketsLost);
            const deltaReceived = Math.max(0, (report.packetsReceived || 0) - this.lastPacketsReceived);
            const totalPackets = deltaLost + deltaReceived;
            if (totalPackets > 0) {
              currentStats.packetLossPercent = parseFloat(((deltaLost / totalPackets) * 100).toFixed(1));
            }
            this.lastPacketsLost = report.packetsLost;
            this.lastPacketsReceived = report.packetsReceived || 0;
          }

          if (typeof report.jitter === 'number') {
            currentStats.jitterMs = Math.round(report.jitter * 1000);
          }
          if (typeof report.framesDecoded === 'number') {
            currentStats.framesDecoded = report.framesDecoded;
          }
          if (typeof report.framesDropped === 'number') {
            currentStats.framesDropped = report.framesDropped;
          }
          if (report.frameWidth) currentStats.videoWidth = report.frameWidth;
          if (report.frameHeight) currentStats.videoHeight = report.frameHeight;
          if (report.framesPerSecond) currentStats.framesPerSecond = Math.round(report.framesPerSecond);
        }
      });

      this.lastTimestamp = now;

      // Handle AUTO mode adaptation
      if (this.currentMode === 'AUTO') {
        this.evaluateAutoMode(currentStats);
      }

      // Notify listeners
      const fullStats = currentStats as P2PConnectionStats;
      this.listeners.forEach((cb) => cb(fullStats));
    } catch (err) {
      // Ignore transient errors when connection re-negotiating
    }
  }

  private evaluateAutoMode(stats: Partial<P2PConnectionStats>) {
    const loss = stats.packetLossPercent || 0;
    const rtt = stats.rttMs || 0;
    const drops = stats.framesDropped || 0;

    // Severe degradation: downgrade immediately
    if (loss > 5 || rtt > 350 || stats.qualityLimitation === 'bandwidth') {
      if (this.autoTierIndex > 0) {
        this.autoTierIndex -= 1;
        this.stableCount = 0;
        this.applyTier(this.autoTierIndex);
      }
      return;
    }

    // Good conditions: require 4 consecutive stable polls (~5s) before stepping up
    if (loss < 1.0 && rtt < 120) {
      this.stableCount += 1;
      if (this.stableCount >= 4 && this.autoTierIndex < 2) {
        this.autoTierIndex += 1;
        this.stableCount = 0;
        this.applyTier(this.autoTierIndex);
      }
    } else {
      this.stableCount = Math.max(0, this.stableCount - 1);
    }
  }

  private applyTier(tier: number) {
    const tiers: VideoQualityMode[] = ['LOW_DATA', 'BALANCED', 'HIGH'];
    const chosen = tiers[tier] || 'BALANCED';
    this.applyProfileParams(QUALITY_PROFILES[chosen]);
  }

  public applyEncodingProfile() {
    if (this.currentMode === 'AUTO') {
      this.applyTier(this.autoTierIndex);
    } else {
      this.applyProfileParams(QUALITY_PROFILES[this.currentMode]);
    }
  }

  private async applyProfileParams(profile: QualityProfile) {
    if (!this.peerConnection) return;

    try {
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (!videoSender || !videoSender.getParameters || !videoSender.setParameters) {
        return;
      }

      const params = videoSender.getParameters();
      if (!params || !params.encodings || params.encodings.length === 0) {
        return;
      }

      const encoding = params.encodings[0];
      encoding.maxBitrate = profile.maxBitrateKbps * 1000;
      encoding.scaleResolutionDownBy = profile.scaleResolutionDownBy;
      if (profile.maxFramerate) {
        encoding.maxFramerate = profile.maxFramerate;
      }

      await videoSender.setParameters(params);
    } catch (err) {
      console.warn('Could not set WebRTC encoding parameters:', err);
    }
  }
}

export const videoQualityController = new VideoQualityController();
