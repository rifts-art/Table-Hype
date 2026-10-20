import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Link,
  Sparkles,
  Check,
  Copy,
  Film,
  AlertCircle,
  Play,
  ArrowRight,
  HardDrive,
  Globe,
  Loader2,
  Radio,
  Zap
} from 'lucide-react';
import {
  convertVideoUrl,
  convertLocalDeviceVideo,
  uploadLocalVideo,
  formatBytes
} from '../utils/videoConverter';
import { VideoConversionResult } from '../types';

interface VidConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStream: (streamUrl: string, title: string, file?: File) => void;
}

export const VidConverterModal: React.FC<VidConverterModalProps> = ({
  isOpen,
  onClose,
  onSelectStream
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deviceResult, setDeviceResult] = useState<VideoConversionResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isChunkUploading, setIsChunkUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cloudStreamResult, setCloudStreamResult] = useState<VideoConversionResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link Converter State
  const [rawInputUrl, setRawInputUrl] = useState('');
  const [convertedResult, setConvertedResult] = useState<VideoConversionResult | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const handleSelectFile = (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setCloudStreamResult(null);

    // Instant 100% local device stream conversion (0ms delay, zero 413 error)
    const result = convertLocalDeviceVideo(file);
    setDeviceResult(result);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  // Optional chunked upload for users who want an HTTP server link
  const handleStartChunkedUpload = async () => {
    if (!selectedFile) return;
    setIsChunkUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const result = await uploadLocalVideo(selectedFile, (percent) => {
        setUploadProgress(percent);
      });
      setCloudStreamResult(result);
      setUploadProgress(100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setUploadError(message);
    } finally {
      setIsChunkUploading(false);
    }
  };

  const handleConvertUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInputUrl.trim()) return;
    const result = convertVideoUrl(rawInputUrl.trim());
    setConvertedResult(result);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleApplyStream = (result: VideoConversionResult, forceProxy = false) => {
    const finalUrl = forceProxy && result.proxyUrl ? result.proxyUrl : result.streamUrl;
    onSelectStream(finalUrl, result.title, result.file);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="converter-modal-title"
    >
      <div
        className="w-full max-w-xl bg-neutral-950/95 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col gap-4 sm:gap-5 text-white max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/10 border border-white/10 text-white shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-200" />
            </div>
            <div>
              <h2 id="converter-modal-title" className="text-sm sm:text-lg font-bold tracking-tight text-white">
                Video to Stream Converter
              </h2>
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                Add video from device or resolve cloud links.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons (Responsive compact labels) */}
        <div className="flex rounded-xl sm:rounded-2xl bg-white/5 p-1 border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span>Device<span className="hidden sm:inline"> (Local P2P)</span></span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>Cloud Links<span className="hidden sm:inline"> Resolver</span></span>
          </button>
        </div>

        {/* Tab 1: Local Device Video (100% Local, Zero 413 Error) */}
        {activeTab === 'upload' && (
          <div className="flex flex-col gap-4">
            {/* Info notice about zero server limits */}
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-2.5 text-xs text-neutral-300">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">100% Local Device Streaming: </span>
                <span>
                  Load any video directly from your phone or computer (up to 4K/10GB+). Your partner streams it directly from your device peer-to-peer. Zero server size limits, zero 413 errors!
                </span>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3 ${
                isDragOver
                  ? 'border-white bg-white/10'
                  : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 rounded-2xl bg-white/10 text-white">
                <Upload className="w-6 h-6 text-neutral-300" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-white">
                  {selectedFile ? selectedFile.name : 'Select video from device or drag & drop'}
                </span>
                <span className="text-xs text-neutral-400">
                  Direct support for MP4, WebM, MOV, and MKV files
                </span>
              </div>
              {selectedFile && (
                <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-mono text-neutral-300 flex items-center gap-2">
                  <Film className="w-3.5 h-3.5" />
                  <span>{formatBytes(selectedFile.size)}</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Ready to Stream Card */}
            {deviceResult && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/15 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-white">Device Stream Ready</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {deviceResult.sizeFormatted} • Local P2P
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-white truncate">{deviceResult.title}</span>
                  <span className="text-[11px] text-neutral-400">
                    Will be streamed directly to your room partner through peer-to-peer WebRTC.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyStream(deviceResult)}
                    className="w-full sm:flex-1 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Stream in TABLE Room</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setDeviceResult(null);
                      setCloudStreamResult(null);
                    }}
                    className="w-full sm:w-auto px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-xs transition-colors cursor-pointer"
                  >
                    Change File
                  </button>
                </div>

                {/* Optional chunked cloud link section */}
                {!cloudStreamResult && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400">
                      Need a permanent server URL instead?
                    </span>
                    <button
                      type="button"
                      onClick={handleStartChunkedUpload}
                      disabled={isChunkUploading}
                      className="text-[11px] font-mono text-neutral-300 hover:text-white underline cursor-pointer disabled:opacity-50"
                    >
                      {isChunkUploading
                        ? `Chunk uploading (${uploadProgress}%)...`
                        : 'Upload in 1.5MB chunks'}
                    </button>
                  </div>
                )}

                {cloudStreamResult && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                    <span className="text-[11px] text-emerald-400 font-mono">
                      ✓ Chunked Cloud URL Generated:
                    </span>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-neutral-300">
                      <span className="truncate flex-1">{cloudStreamResult.streamUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(cloudStreamResult.streamUrl)}
                        className="p-1 text-neutral-400 hover:text-white"
                        title="Copy"
                      >
                        {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Cloud Video Link Resolver */}
        {activeTab === 'link' && (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleConvertUrl} className="flex flex-col gap-3">
              <label htmlFor="raw-cloud-url" className="text-xs font-medium text-neutral-300">
                Paste Cloud Storage or Web Video Link
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  id="raw-cloud-url"
                  type="url"
                  value={rawInputUrl}
                  onChange={(e) => setRawInputUrl(e.target.value)}
                  placeholder="e.g. drive.google.com/file/d/... or dropbox.com/s/..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-xs placeholder-neutral-500 focus:outline-none focus:border-white/40 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!rawInputUrl.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shadow-md flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Convert</span>
                </button>
              </div>

              {/* Supported Provider Badges */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-neutral-400">
                <span className="text-neutral-500">Auto-converts:</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Google Drive</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Dropbox</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">OneDrive</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">GitHub Raw</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Discord CDN</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Archive.org</span>
              </div>
            </form>

            {/* Resolved Link Output */}
            {convertedResult && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/15 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-white">
                      Detected: {convertedResult.provider}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                    {convertedResult.format}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-neutral-400">Direct Stream URL:</span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-neutral-300">
                    <span className="truncate flex-1">{convertedResult.streamUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(convertedResult.streamUrl)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy URL"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* CORS Proxy Option */}
                {convertedResult.proxyUrl && (
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={useProxy}
                      onChange={(e) => setUseProxy(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-white focus:ring-0"
                    />
                    <span>Stream via TABLE CORS Proxy (Recommended if remote server blocks CORS)</span>
                  </label>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyStream(convertedResult, useProxy)}
                    className="flex-1 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Load Stream into Player</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRawInputUrl('');
                      setConvertedResult(null);
                    }}
                    className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-xs transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
