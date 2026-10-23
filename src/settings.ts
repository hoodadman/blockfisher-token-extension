/**
 * The user's choices, kept in Chrome's synced storage so they follow the user to any
 * computer where they're signed in to Chrome. Nothing here is sent to Blockfisher.
 */
export type SiteMode = 'on' | 'off';

/** On/off switches that apply on every site. */
export interface Switches {
  /** Look for tokens on supported sites without being asked. Off: only when the icon is clicked. */
  autoScan: boolean;
  /** Show the card on the page by itself. Off: the icon's badge shows what was found. */
  autoPopup: boolean;
  /** Ask "Run a safety scan?" first. Off: scan the token straight away. */
  confirmToken: boolean;
}

export type SwitchName = keyof Switches;

export const DEFAULT_SWITCHES: Switches = { autoScan: true, autoPopup: true, confirmToken: true };

export interface Settings {
  /** Keyed by host without "www.". Missing means "on". */
  modes: Record<string, SiteMode>;
  /** Unknown sites the user asked us to auto scan in future. */
  remembered: string[];
  switches: Switches;
}

export const hostKey = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '');

export function readModes(value: unknown): Record<string, SiteMode> {
  if (!value || typeof value !== 'object') return {};
  // Earlier versions saved "ask" and "auto"; both now mean on.
  return Object.fromEntries(Object.entries(value).map(([host, mode]) => [host, mode === 'off' ? 'off' : 'on']));
}

export function readSwitches(value: unknown): Switches {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<SwitchName, unknown>>;
  const pick = (name: SwitchName) => (typeof raw[name] === 'boolean' ? (raw[name] as boolean) : DEFAULT_SWITCHES[name]);
  return { autoScan: pick('autoScan'), autoPopup: pick('autoPopup'), confirmToken: pick('confirmToken') };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(['modes', 'remembered', 'switches']);
  return {
    modes: readModes(stored.modes),
    remembered: Array.isArray(stored.remembered) ? stored.remembered.filter((item): item is string => typeof item === 'string') : [],
    switches: readSwitches(stored.switches),
  };
}

export async function modeFor(hostname: string): Promise<SiteMode> {
  const settings = await loadSettings();
  return settings.modes[hostKey(hostname)] ?? 'on';
}

export async function setMode(hostname: string, mode: SiteMode): Promise<void> {
  const settings = await loadSettings();
  await chrome.storage.sync.set({ modes: { ...settings.modes, [hostKey(hostname)]: mode } });
}

export async function setSwitch(name: SwitchName, value: boolean): Promise<void> {
  const settings = await loadSettings();
  await chrome.storage.sync.set({ switches: { ...settings.switches, [name]: value } });
}

export async function setRemembered(hosts: string[]): Promise<void> {
  await chrome.storage.sync.set({ remembered: [...new Set(hosts.map(hostKey))].sort() });
}
