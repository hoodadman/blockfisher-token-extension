/**
 * The Blockfisher account key, pasted from the token scanner's website after paying. It is
 * kept in this computer's Chrome storage only (not synced) and sent with each scan, so the
 * scan runs on the plan the account pays for. Without one, scans run on the free plan.
 */
const KEY = 'accountKey';

/** Keys the scanner hands out look like "bf_" and 32 URL-safe characters. */
export const isAccountKey = (value: string) => /^bf_[A-Za-z0-9_-]{20,}$/.test(value);

export async function loadAccountKey(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(KEY);
  const value = stored[KEY];
  return typeof value === 'string' && isAccountKey(value) ? value : undefined;
}

export async function saveAccountKey(value: string | undefined): Promise<void> {
  if (value) await chrome.storage.local.set({ [KEY]: value });
  else await chrome.storage.local.remove(KEY);
}
