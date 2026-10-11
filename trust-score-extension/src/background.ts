import { loadKeys } from './keys';
import { scanErrorMessage, scanTarget } from './lookup';
import type { ScanRequest, ScanResponse } from './messages';

chrome.runtime.onMessage.addListener((message: ScanRequest, _sender, sendResponse) => {
  if (message?.type !== 'scan') return;
  void (async () => {
    try {
      const result = await scanTarget(message.target, await loadKeys());
      const response: ScanResponse = { ok: true, result };
      sendResponse(response);
    } catch (error) {
      const response: ScanResponse = { ok: false, message: scanErrorMessage(error) };
      sendResponse(response);
    }
  })();
  return true;
});
