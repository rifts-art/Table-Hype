import React, { useState } from 'react';
import { X, Film, AlertCircle, ArrowRight, Info, HardDrive } from 'lucide-react';
import { analyzeVideoUrl } from '../utils/videoUtils';

interface ChangeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeVideo: (url: string, title: string) => void;
  onOpenConverter?: () => void;
  currentUrl?: string;
}

export const ChangeVideoModal: React.FC<ChangeVideoModalProps> = ({
  isOpen,
  onClose,
  onChangeVideo,
  onOpenConverter,
  currentUrl = ''
}) => {
  const [videoUrl, setVideoUrl] = useState(currentUrl);
  const [videoTitle, setVideoTitle] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setVideoUrl(val);
    if (!val.trim()) {
      setWarning(null);
      return;
    }
    const check = analyzeVideoUrl(val);
    if (!check.isValid) {
      setWarning(check.warning || 'Unsupported URL');
    } else {
      setWarning(check.warning || null);
      if (check.suggestedTitle && !videoTitle) {
        setVideoTitle(check.suggestedTitle);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    const finalTitle = videoTitle.trim() || 'Shared Video';
    onChangeVideo(videoUrl.trim(), finalTitle);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-neutral-950/95 border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.9)] relative text-white max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5 pr-8">
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/10 border border-white/15 text-white shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">Change Stream</h2>
            <p className="text-xs text-neutral-400">Updates the video stream simultaneously for everyone at the Table</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-300">Video Stream URL</label>
              {onOpenConverter && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenConverter();
                  }}
                  className="text-[11px] font-mono text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer underline"
                >
                  <HardDrive className="w-3 h-3" />
                  <span>Convert File / Link</span>
                </button>
              )}
            </div>
            <input
              id="change-video-url-input"
              type="url"
              value={videoUrl}
              onChange={handleUrlChange}
              placeholder="Paste direct MP4, WebM, or HLS link"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-base sm:text-xs placeholder-neutral-600 focus:outline-none focus:border-white/50 transition-colors"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-300">Custom Title (Optional)</label>
            <input
              id="change-video-title-input"
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. Episode 1 / Movie Name"
              maxLength={60}
              className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-white/50 transition-colors"
            />
          </div>

          {warning && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          <button
            id="change-video-submit-btn"
            type="submit"
            disabled={!videoUrl.trim()}
            className="w-full mt-2 py-3 rounded-xl bg-white text-black font-semibold text-xs sm:text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg active:scale-98"
          >
            <span>Update Shared Stream</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
