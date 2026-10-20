/**
 * Video utility helpers for format checking, time formatting, and validation.
 */

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export interface UrlCheckResult {
  isValid: boolean;
  isDirectMedia: boolean;
  warning?: string;
  suggestedTitle?: string;
}

export function analyzeVideoUrl(rawUrl: string): UrlCheckResult {
  const url = (rawUrl || '').trim();
  if (!url) {
    return { isValid: false, isDirectMedia: false, warning: 'Please enter a video URL.' };
  }

  try {
    const parsed = new URL(url);

    // Check for web page video platforms that block direct HTML5 video playback
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return {
        isValid: false,
        isDirectMedia: false,
        warning: 'YouTube page URLs cannot be streamed directly into a raw HTML5 video element due to CORS & DRM policies. Please use a direct MP4, WebM, or HLS stream (or try one of our curated cinema samples below).'
      };
    }

    if (hostname.includes('vimeo.com') && !url.includes('.mp4')) {
      return {
        isValid: false,
        isDirectMedia: false,
        warning: 'Standard Vimeo web pages cannot be directly embedded into an HTML5 player without their direct video CDN file (.mp4/.m3u8). Try a direct file stream or our test samples.'
      };
    }

    if (hostname.includes('tiktok.com') || hostname.includes('instagram.com') || hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return {
        isValid: false,
        isDirectMedia: false,
        warning: 'Social media post links require extraction of the raw video file (.mp4). Please provide a direct video media link.'
      };
    }

    // Check direct media extensions
    const pathname = parsed.pathname.toLowerCase();
    const isDirectMedia = pathname.endsWith('.mp4') ||
      pathname.endsWith('.webm') ||
      pathname.endsWith('.ogg') ||
      pathname.endsWith('.mov') ||
      pathname.endsWith('.m4v') ||
      pathname.endsWith('.m3u8') ||
      url.includes('.mp4?') ||
      url.includes('.webm?') ||
      url.includes('googlevideo.com') ||
      url.includes('commondatastorage.googleapis.com');

    // Extract suggested title from path
    let filename = pathname.split('/').pop() || '';
    filename = decodeURIComponent(filename).replace(/\.[a-zA-Z0-9]+$/, '').replace(/[-_]/g, ' ');
    const suggestedTitle = filename.length > 2 ? filename.charAt(0).toUpperCase() + filename.slice(1) : parsed.hostname;

    return {
      isValid: true,
      isDirectMedia,
      suggestedTitle,
      warning: isDirectMedia
        ? undefined
        : 'Note: This URL does not end in a common video extension (.mp4, .webm). TABLE will attempt to stream it if your browser and the remote server permit CORS.'
    };
  } catch {
    return {
      isValid: false,
      isDirectMedia: false,
      warning: 'Invalid URL format. Please enter a valid URL starting with http:// or https://'
    };
  }
}

export function validateTableKeyFormat(key: string): boolean {
  if (!key) return false;
  const clean = key.trim().toUpperCase();
  // Standard format TAB-XXXX-XX or any 6-16 char alphanumeric code
  return /^[A-Z0-9]{3,4}-[A-Z0-9]{3,6}-[A-Z0-9]{2,4}$/.test(clean) || /^[A-Z0-9_-]{4,16}$/.test(clean);
}

export function getRandomNickname(): string {
  const adjectives = ['Cosmic', 'Monochrome', 'Lunar', 'Smoky', 'Neon', 'Silica', 'Velvet', 'Astral', 'Ghost', 'Zenith'];
  const nouns = ['Spectator', 'Voyager', 'Auditor', 'Cinephile', 'Drifter', 'Pilot', 'Curator', 'Nomad', 'Watcher'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adj} ${noun} #${num}`;
}
