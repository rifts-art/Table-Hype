import { VideoConversionResult } from '../types';
import { p2pManager } from './p2pVideo';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Creates an instantaneous 100% local device stream from a local file.
 * Zero upload delay, zero server storage, zero 413 error.
 * Streams directly peer-to-peer to connected room partners via WebRTC!
 */
export function convertLocalDeviceVideo(file: File): VideoConversionResult {
  const localUrl = p2pManager.setLocalFile(file);
  const cleanTitle = file.name.replace(/\.[^/.]+$/, '');

  return {
    originalUrl: file.name,
    streamUrl: localUrl,
    proxyUrl: localUrl,
    title: cleanTitle || 'Device Video',
    provider: 'Device Video (P2P Direct)',
    format: file.type || 'video/mp4',
    sizeBytes: file.size,
    sizeFormatted: formatBytes(file.size),
    isLocalUpload: true,
    isDeviceVideo: true,
    file
  };
}

/**
 * Converts third-party or cloud storage links to direct browser-streamable video URLs.
 */
export function convertVideoUrl(rawUrl: string): VideoConversionResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      streamUrl: '',
      title: 'Empty Stream',
      provider: 'None'
    };
  }

  // Google Drive
  const gdriveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  const gdriveIdMatch = trimmed.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/i);
  const gdriveId = gdriveFileMatch ? gdriveFileMatch[1] : gdriveIdMatch ? gdriveIdMatch[1] : null;

  if (gdriveId) {
    const directUrl = `https://drive.google.com/uc?export=download&id=${gdriveId}`;
    const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(directUrl)}`;
    return {
      originalUrl: trimmed,
      streamUrl: directUrl,
      proxyUrl,
      title: `Google Drive Video (${gdriveId.slice(0, 8)})`,
      provider: 'Google Drive',
      format: 'Direct / Stream Proxy'
    };
  }

  // Dropbox
  if (trimmed.includes('dropbox.com')) {
    let directUrl = trimmed;
    if (trimmed.includes('dl.dropboxusercontent.com')) {
      directUrl = trimmed;
    } else {
      directUrl = trimmed
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('?dl=0', '')
        .replace('&dl=0', '');
    }
    const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(directUrl)}`;
    const filenameMatch = trimmed.match(/\/([^\/?#]+\.(mp4|webm|mov|mkv))/i);
    const title = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'Dropbox Video Stream';

    return {
      originalUrl: trimmed,
      streamUrl: directUrl,
      proxyUrl,
      title,
      provider: 'Dropbox',
      format: 'Direct Stream'
    };
  }

  // OneDrive
  if (trimmed.includes('1drv.ms') || trimmed.includes('onedrive.live.com')) {
    let directUrl = trimmed;
    if (!directUrl.includes('download=1')) {
      directUrl = directUrl.includes('?') ? `${directUrl}&download=1` : `${directUrl}?download=1`;
    }
    return {
      originalUrl: trimmed,
      streamUrl: directUrl,
      proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(directUrl)}`,
      title: 'OneDrive Video Stream',
      provider: 'OneDrive',
      format: 'Direct Stream'
    };
  }

  // GitHub Blob -> raw.githubusercontent.com
  const githubBlobMatch = trimmed.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/i);
  if (githubBlobMatch) {
    const [, user, repo, branch, filepath] = githubBlobMatch;
    const directUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filepath}`;
    const parts = filepath.split('/');
    const filename = parts[parts.length - 1];
    return {
      originalUrl: trimmed,
      streamUrl: directUrl,
      title: filename || `${repo} video`,
      provider: 'GitHub Releases / Raw',
      format: 'Raw Stream'
    };
  }

  // Archive.org Details -> Download MP4
  const archiveMatch = trimmed.match(/archive\.org\/details\/([^\/\?#]+)/i);
  if (archiveMatch) {
    const identifier = archiveMatch[1];
    const directUrl = `https://archive.org/download/${identifier}/${identifier}.mp4`;
    return {
      originalUrl: trimmed,
      streamUrl: directUrl,
      proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(directUrl)}`,
      title: `Internet Archive: ${identifier}`,
      provider: 'Archive.org',
      format: 'MP4 Archive'
    };
  }

  // Discord CDN
  if (trimmed.includes('cdn.discordapp.com') || trimmed.includes('media.discordapp.net')) {
    const filenameMatch = trimmed.match(/\/([^\/?#]+\.(mp4|webm|mov))/i);
    const title = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'Discord Video Stream';
    return {
      originalUrl: trimmed,
      streamUrl: trimmed,
      proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(trimmed)}`,
      title,
      provider: 'Discord CDN',
      format: 'MP4/WebM'
    };
  }

  // Catbox / File.io / Fastupload
  if (trimmed.includes('files.catbox.moe') || trimmed.includes('file.io')) {
    const filenameMatch = trimmed.match(/\/([^\/?#]+)/i);
    return {
      originalUrl: trimmed,
      streamUrl: trimmed,
      proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(trimmed)}`,
      title: filenameMatch ? filenameMatch[1] : 'Direct Cloud Stream',
      provider: 'Direct Host',
      format: 'Direct Stream'
    };
  }

  // Standard Direct Video Link (.mp4, .webm, .m3u8, .mov)
  const isDirect = /\.(mp4|webm|m3u8|ogv|ogg|mov)(\?.*)?$/i.test(trimmed);
  let title = 'Direct Stream';
  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart) {
      title = decodeURIComponent(lastPart).replace(/\.(mp4|webm|m3u8|mov)$/i, '');
    }
  } catch {
    title = 'Custom Stream';
  }

  return {
    originalUrl: trimmed,
    streamUrl: trimmed,
    proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(trimmed)}`,
    title: title || 'Direct Stream',
    provider: isDirect ? 'Direct HTML5' : 'Web Stream',
    format: isDirect ? 'Native Video' : 'Stream URL'
  };
}

/**
 * Uploads a video file using 1.5MB chunks.
 * This guarantees the request size NEVER exceeds 1.5MB, preventing HTTP 413 Payload Too Large!
 */
export async function uploadLocalVideo(
  file: File,
  onProgress?: (percentage: number) => void
): Promise<VideoConversionResult> {
  const CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5MB per chunk (safely under Cloud Run 32MB limit)
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(i));
    formData.append('totalChunks', String(totalChunks));
    formData.append('fileName', file.name);
    formData.append('fileSize', String(file.size));
    formData.append('mimeType', file.type || 'video/mp4');

    const res = await fetch('/api/convert/upload-chunk', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Upload error on chunk ${i + 1}/${totalChunks} (status ${res.status}). Use local device stream instead.`);
    }

    const data = await res.json();

    const progress = Math.round(((i + 1) / totalChunks) * 100);
    onProgress?.(progress);

    if (i === totalChunks - 1 && data.success && data.url) {
      const fullStreamUrl = data.url.startsWith('http')
        ? data.url
        : `${window.location.origin}${data.url}`;

      return {
        originalUrl: file.name,
        streamUrl: fullStreamUrl,
        proxyUrl: fullStreamUrl,
        title: file.name,
        provider: 'Chunked Cloud Stream',
        format: file.type || 'video/mp4',
        sizeBytes: file.size,
        sizeFormatted: formatBytes(file.size),
        isLocalUpload: true
      };
    }
  }

  throw new Error('Upload completed without server stream response.');
}
