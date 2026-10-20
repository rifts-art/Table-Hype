import { PlaybackSettings } from '../types';

const SETTINGS_KEY = 'table_player_settings_v1';
const NICKNAME_KEY = 'table_user_nickname_v1';
const RECENT_TABLES_KEY = 'table_recent_rooms_v1';

export const DEFAULT_SETTINGS: PlaybackSettings = {
  volume: 0.85,
  muted: false,
  speed: 1.0,
  objectFit: 'contain',
  subtitleTrackUrl: null,
  subtitleFontSize: 'medium',
  subtitleBackground: true,
  loop: false,
  ambientGlow: true,
  rememberSettings: true,
};

export function loadPlaybackSettings(): PlaybackSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function savePlaybackSettings(settings: Partial<PlaybackSettings>): void {
  try {
    const current = loadPlaybackSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save settings to localStorage:', err);
  }
}

export function getStoredNickname(): string | null {
  try {
    return localStorage.getItem(NICKNAME_KEY);
  } catch {
    return null;
  }
}

export function setStoredNickname(name: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, name.trim().slice(0, 30));
  } catch {
    // Ignore storage issues
  }
}

export function getRecentTables(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TABLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentTable(key: string): void {
  try {
    const current = getRecentTables();
    const updated = [key, ...current.filter(k => k !== key)].slice(0, 6);
    localStorage.setItem(RECENT_TABLES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}
