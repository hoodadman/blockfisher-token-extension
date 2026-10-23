/**
 * Per-site choices, kept in Chrome's synced storage so they follow the user to any
 * computer where they're signed in to Chrome. Nothing here is sent to Blockfisher.
 */
export type SiteMode = 'ask' | 'auto' | 'off';

export interface Settings {
  /** Keyed by host without "www.". Missing means "ask". */
  modes: Record<string, SiteMode>;
  /** Unknown sites the user asked us to auto scan in future. */
  remembered: string[];
}

const DEFAULTS: Settings = { modes: {}, remembered: [] };

export const hostKey = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '');

export async function loadSettings(): Promise<Settings> {
  const stored = (await chrome.storage.sync.get(['modes', 'remembered'])) as Partial<Settings>;
  return {
    modes: stored.modes && typeof stored.modes === 'object' ? stored.modes : DEFAULTS.modes,
    remembered: Array.isArray(stored.remembered) ? stored.remembered.filter((item) => typeof item === 'string') : DEFAULTS.remembered,
  };
}

export async function modeFor(hostname: string): Promise<SiteMode> {
  const settings = await loadSettings();
  return settings.modes[hostKey(hostname)] ?? 'ask';
}

export async function setMode(hostname: string, mode: SiteMode): Promise<void> {
  const settings = await loadSettings();
  await chrome.storage.sync.set({ modes: { ...settings.modes, [hostKey(hostname)]: mode } });
}

export async function setRemembered(hosts: string[]): Promise<void> {
  await chrome.storage.sync.set({ remembered: [...new Set(hosts.map(hostKey))].sort() });
}
