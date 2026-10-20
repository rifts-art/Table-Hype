export type P2PPlaybackMode = 'SYNCHRONIZED_LOCAL' | 'DIRECT_P2P_STREAM' | 'PROGRESSIVE_FILE_DELIVERY';

export type VideoQualityMode = 'AUTO' | 'HIGH' | 'BALANCED' | 'LOW_DATA';

export interface P2PConnectionStats {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  rttMs: number;
  packetLossPercent: number;
  packetsLost: number;
  packetsReceived: number;
  jitterMs: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  videoWidth: number;
  videoHeight: number;
  framesPerSecond: number;
  framesDecoded: number;
  framesDropped: number;
  candidateType: 'direct' | 'stun-reflected' | 'relay' | 'unknown';
  availableOutgoingBitrateKbps?: number;
  currentMode: P2PPlaybackMode;
  transferProgressPercent?: number;
  transferSpeedKbps?: number;
  bufferedAmountBytes?: number;
  qualityLimitation?: string;
}

export interface QualityProfile {
  name: VideoQualityMode;
  label: string;
  maxBitrateKbps: number;
  scaleResolutionDownBy: number;
  maxFramerate: number;
  description: string;
}
