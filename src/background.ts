import { ApiError, identify, scan } from './api';
import type { IdentifyReply, Request, ScanReply } from './flow';
import { syncScripts } from './sites';

const failure = (error: unknown) => ({
  ok: false as const,
  text: error instanceof ApiError ? error.message : 'Something went wrong. Please try again in a minute.',
});

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
    identify(message.candidates).then(
      (tokens): void => sendResponse({ ok: true, tokens } satisfies IdentifyReply),
      (error): void => sendResponse(failure(error) satisfies IdentifyReply),
    );
    return true;
  }
  if (message?.type === 'scan') {
    scan(message.address, message.network).then(
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
