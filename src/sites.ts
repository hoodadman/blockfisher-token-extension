import { hostKey, loadSettings, setRemembered } from './settings';

/**
 * Remembered sites: the user ticked "Run auto scan on this site in future" on a site we
 * don't know. Chrome asks them to allow that one site, then we run the page reader there
 * like on a named site. Permissions don't sync between computers, so a site remembered
 * elsewhere only runs here once it's allowed here too.
 */

export const originsFor = (host: string) => [`https://${hostKey(host)}/*`, `https://www.${hostKey(host)}/*`];

const scriptId = (host: string) => `site-${hostKey(host).replace(/[^a-z0-9.-]/g, '_')}`;

/** Must be called straight from a click: Chrome only shows its prompt during a user gesture. */
export function requestSite(host: string): Promise<boolean> {
  return chrome.permissions.request({ origins: originsFor(host) });
}

export async function rememberSite(host: string): Promise<void> {
  const settings = await loadSettings();
  await setRemembered([...settings.remembered, host]);
  await syncScripts();
}

export async function forgetSite(host: string): Promise<void> {
  const settings = await loadSettings();
  await setRemembered(settings.remembered.filter((item) => item !== hostKey(host)));
  await chrome.permissions.remove({ origins: originsFor(host) }).catch(() => false);
  await syncScripts();
}

export async function isAllowedHere(host: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: originsFor(host) });
}

/** Makes the registered content scripts match the remembered, allowed sites. */
export async function syncScripts(): Promise<void> {
  const settings = await loadSettings();
  const allowed = (await Promise.all(settings.remembered.map(async (host) => ((await isAllowedHere(host)) ? host : null)))).filter(
    (host): host is string => host !== null,
  );
  const wanted = new Map(allowed.map((host) => [scriptId(host), host]));
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const stale = existing.filter((script) => script.id.startsWith('site-') && !wanted.has(script.id)).map((script) => script.id);
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });
  const have = new Set(existing.map((script) => script.id));
  const fresh = [...wanted].filter(([id]) => !have.has(id));
  if (fresh.length) {
    await chrome.scripting.registerContentScripts(
      fresh.map(([id, host]) => ({ id, matches: originsFor(host), js: ['content.js'], runAt: 'document_idle', persistAcrossSessions: true })),
    );
  }
}
