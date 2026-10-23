import { API_BASE, ApiError, identify, scan } from './api';
import type { IdentifyReply, Request, ScanReply } from './flow';
import { syncScripts } from './sites';

const failure = (error: unknown) => ({
  ok: false as const,
  text: error instanceof ApiError ? error.message : 'Something went wrong. Please try again in a minute.',
});

/**
 * Chrome stops an idle extension worker after 30 seconds, even while a fetch is waiting,
 * which dropped long scans. Calling any extension API resets that clock, so do that
 * while work is in flight.
 */
let inFlight = 0;
let heartbeat: ReturnType<typeof setInterval> | undefined;

function keepAlive<T>(work: Promise<T>): Promise<T> {
  inFlight += 1;
  heartbeat ??= setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);
  return work.finally(() => {
    inFlight -= 1;
    if (inFlight === 0 && heartbeat !== undefined) {
      clearInterval(heartbeat);
      heartbeat = undefined;
    }
  });
}

/** The scanner sleeps when unused and takes up to a minute to wake, so wake it as soon as a token is spotted. */
let lastWake = 0;
function wakeScanner() {
  if (Date.now() - lastWake < 60_000) return;
  lastWake = Date.now();
  void keepAlive(fetch(`${API_BASE}/`, { method: 'HEAD', signal: AbortSignal.timeout(90_000) }).catch(() => undefined));
}

chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
  if (message?.type === 'badge') {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      void chrome.action.setBadgeText({ tabId, text: message.text });
      void chrome.action.setBadgeBackgroundColor({ tabId, color: message.color });
    }
    return false;
  }
  if (message?.type === 'identify') {
    wakeScanner();
    keepAlive(identify(message.candidates)).then(
      (tokens): void => sendResponse({ ok: true, tokens } satisfies IdentifyReply),
      (error): void => sendResponse(failure(error) satisfies IdentifyReply),
    );
    return true;
  }
  if (message?.type === 'scan') {
    keepAlive(scan(message.address, message.network, message.refresh === true)).then(
      (report): void => sendResponse({ ok: true, report } satisfies ScanReply),
      (error): void => sendResponse(failure(error) satisfies ScanReply),
    );
    return true;
  }
  return false;
});

// Remembered sites: keep the registered page readers in step with the saved list and
// with what Chrome allows on this computer.
chrome.runtime.onInstalled.addListener(() => void syncScripts());
chrome.runtime.onStartup.addListener(() => void syncScripts());
chrome.permissions.onRemoved.addListener(() => void syncScripts());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.remembered) void syncScripts();
});
