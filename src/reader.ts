import { findTokens } from './readers/page';

/**
 * Injected into the active tab when the user clicks the toolbar icon (activeTab).
 * Leaves its answer where the popup's follow-up call can pick it up.
 */
(globalThis as { __blockfisherFound?: unknown }).__blockfisherFound = findTokens(document, location.href);
