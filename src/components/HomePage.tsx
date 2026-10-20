import React, { useState } from 'react';
import {
  Play,
  Users,
  Sparkles,
  ArrowRight,
  Sliders,
  Shield,
  Film,
  Key,
  Clock,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Radio,
  Share2,
  Tv,
  FileVideo,
  Cloud,
  Lock,
  Upload,
  HardDrive
} from 'lucide-react';
import { analyzeVideoUrl } from '../utils/videoUtils';
import { Watermark } from './Watermark';

interface HomePageProps {
  onCreateTable: () => void;
  onJoinTable: () => void;
  onQuickStream: (url: string, title?: string) => void;
  onOpenConverter: () => void;
  recentTables: string[];
  onSelectRecentTable: (key: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onCreateTable,
  onJoinTable,
  onQuickStream,
  onOpenConverter,
  recentTables,
  onSelectRecentTable
}) => {
  const [quickUrl, setQuickUrl] = useState('');
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleQuickUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuickUrl(val);
    if (!val.trim()) {
      setUrlWarning(null);
      return;
    }
    const check = analyzeVideoUrl(val);
    if (!check.isValid) {
      setUrlWarning(check.warning || 'Unsupported link format');
    } else {
      setUrlWarning(check.warning || null);
    }
  };

  const handleQuickStreamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    const check = analyzeVideoUrl(quickUrl);
    onQuickStream(quickUrl.trim(), check.suggestedTitle || 'Direct Video Stream');
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'How does duo synchronization work on TABLE?',
      a: 'TABLE uses a server-authoritative WebSocket timeline relay. When you or your partner press play, pause, or scrub to a new timestamp, a sub-second synchronization packet coordinates both players simultaneously across the web.'
    },
    {
      q: 'How does the default Vid to URL Converter work?',
      a: 'If you have a local video file on your computer/phone or a cloud share link (from Google Drive, Dropbox, OneDrive, Discord, etc.), click "Vid to URL Converter". You can upload local video files up to 500MB to receive an instant, HTTP 206 range-supported stream URL that both participants can watch in sync, or resolve messy cloud links into direct HTML5 streams with automatic CORS bypass.'
    },
    {
      q: 'Will changing my volume or speed change it for my partner?',
      a: 'No! All personal audio controls (volume, muting), playback rates (0.25× up to 2× speed), subtitle styling, and aspect ratio adjustments operate strictly on your local device. Only play, pause, scrub timeline, and video source changes are shared.'
    },
    {
      q: 'What video links and streams are supported?',
      a: 'Any direct HTML5 video URL accessible over HTTP or HTTPS works natively. This includes .mp4 and .webm video files, and HLS .m3u8 adaptive streams. Direct links from AWS S3, Google Cloud Storage, Cloudflare R2, Discord media CDN, Supabase, and self-hosted media servers are fully supported.'
    },
    {
      q: 'Do I or my partner need to register an account?',
      a: 'No account, password, or credit card is ever required. TABLE is 100% ephemeral and frictionless. You simply create a room, copy your 8-character Table Key or invite link, and start watching immediately.'
    },
    {
      q: 'How long do Table rooms remain active?',
      a: 'Rooms remain active for the duration of your watch session. If everyone leaves, idle rooms automatically expire and disappear from memory after two hours of inactivity to safeguard privacy.'
    }
  ];

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 sm:py-12 px-4 sm:px-6 relative">
      {/* Ambient background light aura */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-96 sm:w-[700px] h-96 sm:h-[600px] bg-white/[0.025] rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Hero Container */}
      <div className="w-full max-w-4xl flex flex-col items-center text-center">
        {/* Top Product Badge */}
        <div className="mb-6 flex items-center gap-2">
          <Watermark variant="badge" />
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-5 leading-[1.08] max-w-3xl">
          WATCH TOGETHER.<br />
          <span className="text-neutral-400">ANYWHERE.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-lg text-neutral-400 max-w-xl mb-10 leading-relaxed font-normal">
          Minimalist, real-time duo synchronized video streaming. Zero accounts, zero ads, and sub-second timeline precision.
        </p>

        {/* Primary Action Grid (3 Cards: Create, Join, Convert Vid) */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-8">
          {/* Create Table Card */}
          <button
            id="home-create-table-btn"
            type="button"
            onClick={onCreateTable}
            className="group relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 hover:border-white/40 backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-left transition-all duration-300 flex flex-col justify-between cursor-pointer active:scale-98"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white text-black shadow-md group-hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide mb-1">
                Create Table
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Start a private room and get an 8-character Table Key to invite a friend.
              </p>
            </div>
          </button>

          {/* Join Table Card */}
          <button
            id="home-join-table-btn"
            type="button"
            onClick={onJoinTable}
            className="group relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-neutral-900/60 hover:bg-neutral-900/90 border border-white/15 hover:border-white/30 backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-left transition-all duration-300 flex flex-col justify-between cursor-pointer active:scale-98"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/10 text-white border border-white/15 group-hover:scale-110 transition-transform">
                <Key className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide mb-1">
                Join Table
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Enter your partner's Table Key (e.g. TAB-7X4K-92) to lock timelines.
              </p>
            </div>
          </button>

          {/* Add from Device / Converter Card */}
          <button
            id="home-convert-vid-btn"
            type="button"
            onClick={onOpenConverter}
            className="group relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-neutral-900/60 hover:bg-neutral-900/90 border border-white/15 hover:border-white/30 backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-left transition-all duration-300 flex flex-col justify-between cursor-pointer active:scale-98"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/10 text-white border border-white/15 group-hover:scale-110 transition-transform">
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide mb-1 flex items-center gap-1.5">
                <span>Add from Device</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Local P2P</span>
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Add any video file directly from your device. Stream peer-to-peer with zero upload limits.
              </p>
            </div>
          </button>
        </div>

        {/* Direct URL Instant Streaming Box */}
        <div className="w-full max-w-2xl mb-12">
          <form
            onSubmit={handleQuickStreamSubmit}
            className="p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl bg-neutral-950/70 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col sm:flex-row items-center gap-2"
          >
            <div className="flex items-center gap-2.5 px-3 py-2 w-full flex-1">
              <Film className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                id="home-quick-stream-input"
                type="url"
                value={quickUrl}
                onChange={handleQuickUrlChange}
                placeholder="Or paste direct video URL (.mp4, .webm, .m3u8)..."
                className="w-full bg-transparent text-base sm:text-sm text-white placeholder-neutral-500 focus:outline-none font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                id="home-stream-solo-btn"
                type="submit"
                disabled={!quickUrl.trim()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl sm:rounded-2xl bg-white text-black font-semibold text-xs sm:text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Stream Solo</span>
              </button>
            </div>
          </form>

          {urlWarning && (
            <p className="text-left mt-2 px-3 text-[11px] text-amber-300 font-mono">
              {urlWarning}
            </p>
          )}
        </div>

        {/* Recent Tables (if any) */}
        {recentTables.length > 0 && (
          <div className="w-full max-w-2xl mb-16 flex flex-col items-center">
            <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-500 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Recent Tables
            </span>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {recentTables.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectRecentTable(key)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-mono text-xs text-white hover:border-white/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Key className="w-3 h-3 text-neutral-400" />
                  <span>{key}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section 1: How Table Works (3-Step Visual Guide) */}
        <div id="how-it-works" className="w-full max-w-4xl text-left mb-16 pt-4 border-t border-white/5">
          <div className="flex flex-col mb-8">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
              Architecture & Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              How Table Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-neutral-500 font-bold mb-4 block">01 / ROOM</span>
                <h3 className="text-base font-semibold text-white mb-2">Create & Get Key</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Start an ephemeral room in one click. Receive a unique Table Key (e.g. TAB-7X4K-92) to share with your watch partner.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Zero registration</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-neutral-500 font-bold mb-4 block">02 / STREAM</span>
                <h3 className="text-base font-semibold text-white mb-2">Load Any Video or File</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Paste a direct video link or convert local files and cloud storage links into synchronized stream URLs with HTTP 206 range support.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Vid to URL converter built-in</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-neutral-500 font-bold mb-4 block">03 / SYNC</span>
                <h3 className="text-base font-semibold text-white mb-2">Watch in Lockstep</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Timeline actions (play, pause, scrub) propagate over sub-second WebSockets, while volume and speed remain totally personal.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Independent audio & speed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Features Grid */}
        <div id="features" className="w-full max-w-4xl text-left mb-16 pt-4 border-t border-white/5">
          <div className="flex flex-col mb-8">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Designed for Distraction-Free Watching
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white shrink-0">
                <Sliders className="w-5 h-5 text-neutral-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Independent Settings</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  You prefer 1.25× speed with English subtitles, while your partner prefers 1.0× with high volume? Both remain perfectly synced without overriding each other.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white shrink-0">
                <HardDrive className="w-5 h-5 text-neutral-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Default Vid to URL Converter</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Upload local files or resolve messy Google Drive / Dropbox share links into high-speed byte-range stream URLs with automatic CORS bypass.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white shrink-0">
                <Tv className="w-5 h-5 text-neutral-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Minimized & Edge Controls</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Zero clutter in front of the video canvas. Controls tuck smoothly into the top edge and bottom bar, fading away automatically during playback.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white shrink-0">
                <Lock className="w-5 h-5 text-neutral-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Ephemeral & Private</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Rooms and chat stay in memory during your watch party and vanish once the party ends. No databases, trackers, or cookies required.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Supported Formats Guide */}
        <div id="supported-formats" className="w-full max-w-4xl text-left mb-16 pt-4 border-t border-white/5">
          <div className="flex flex-col mb-8">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
              Compatibility Guide
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Supported Formats & Storage Providers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
              <span className="text-xs font-mono font-bold text-white">.MP4 / .WEBM</span>
              <span className="text-[11px] text-neutral-400">Direct progressive HTML5 video downloads with byte-range scrubbing.</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
              <span className="text-xs font-mono font-bold text-white">Local Video Upload</span>
              <span className="text-[11px] text-neutral-400">Upload any video file from your computer or phone to stream together in sync.</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
              <span className="text-xs font-mono font-bold text-white">Google Drive / Dropbox</span>
              <span className="text-[11px] text-neutral-400">Auto-resolved into direct stream URLs with built-in CORS proxy support.</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
              <span className="text-xs font-mono font-bold text-white">S3 / R2 / Discord CDN</span>
              <span className="text-[11px] text-neutral-400">Public object storage buckets, Discord attachments, and self-hosted URLs.</span>
            </div>
          </div>
        </div>

        {/* Section 4: Interactive FAQ Accordion */}
        <div id="faq" className="w-full max-w-4xl text-left mb-16 pt-4 border-t border-white/5">
          <div className="flex flex-col mb-8">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
              Answers & Details
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-neutral-900/30 border border-white/10 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm font-semibold text-white tracking-wide">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs text-neutral-400 leading-relaxed border-t border-white/5 animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
