/**
 * Micro-drift correction engine for synchronized video playback.
 * Dynamically adjusts playback rate to eliminate video stuttering and audio popping
 * instead of frequently executing abrupt, disruptive timeline seeks.
 */

export interface DriftCorrectionState {
  currentDriftSeconds: number;
  isAdjustingSpeed: boolean;
  effectiveSpeed: number;
}

export class DriftSyncEngine {
  private userSpeed: number = 1.0;
  private isSeeking: boolean = false;

  public setUserSpeed(speed: number) {
    this.userSpeed = speed;
  }

  public calculateCorrection(
    localCurrentTime: number,
    hostCurrentTime: number,
    videoElement: HTMLVideoElement | null
  ): DriftCorrectionState {
    if (!videoElement || this.isSeeking) {
      return {
        currentDriftSeconds: 0,
        isAdjustingSpeed: false,
        effectiveSpeed: this.userSpeed
      };
    }

    const drift = hostCurrentTime - localCurrentTime;
    const absDrift = Math.abs(drift);

    // Imperceptible threshold: within 50ms is perfect
    if (absDrift <= 0.05) {
      if (videoElement.playbackRate !== this.userSpeed) {
        videoElement.playbackRate = this.userSpeed;
      }
      return {
        currentDriftSeconds: drift,
        isAdjustingSpeed: false,
        effectiveSpeed: this.userSpeed
      };
    }

    // Micro-adjustment tier (50ms - 800ms drift):
    // Smooth imperceptible 2% pitch-preserving speed shift
    if (absDrift <= 0.8) {
      const modifier = drift > 0 ? 1.02 : 0.98;
      const targetRate = parseFloat((this.userSpeed * modifier).toFixed(3));
      if (videoElement.playbackRate !== targetRate) {
        videoElement.playbackRate = targetRate;
      }
      return {
        currentDriftSeconds: drift,
        isAdjustingSpeed: true,
        effectiveSpeed: targetRate
      };
    }

    // Moderate drift tier (800ms - 2.0s):
    // 5% rate compensation
    if (absDrift <= 2.0) {
      const modifier = drift > 0 ? 1.05 : 0.95;
      const targetRate = parseFloat((this.userSpeed * modifier).toFixed(3));
      if (videoElement.playbackRate !== targetRate) {
        videoElement.playbackRate = targetRate;
      }
      return {
        currentDriftSeconds: drift,
        isAdjustingSpeed: true,
        effectiveSpeed: targetRate
      };
    }

    // Large desync (> 2.0s): perform hard seek and restore base rate
    this.isSeeking = true;
    videoElement.currentTime = hostCurrentTime;
    videoElement.playbackRate = this.userSpeed;

    setTimeout(() => {
      this.isSeeking = false;
    }, 250);

    return {
      currentDriftSeconds: 0,
      isAdjustingSpeed: false,
      effectiveSpeed: this.userSpeed
    };
  }
}

export const driftSyncEngine = new DriftSyncEngine();
