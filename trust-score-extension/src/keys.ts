export interface ExtensionKeys {
  insightx?: string;
  twitter?: string;
}

export async function loadKeys(): Promise<ExtensionKeys> {
  const stored = await chrome.storage.local.get(['insightx', 'twitter']);
  return {
    insightx: typeof stored.insightx === 'string' ? stored.insightx.trim() : undefined,
    twitter: typeof stored.twitter === 'string' ? stored.twitter.trim() : undefined,
  };
}
