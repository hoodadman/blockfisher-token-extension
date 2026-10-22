# Blockfisher auto scan

A Chrome extension that spots the token you're looking at and offers to check it. Open a token on DexScreener, CoinGecko, jup.ag, Uniswap, GMGN or Birdeye and a small card asks "Run a safety scan?". On any other site, click the Blockfisher icon. You can tick "Run auto scan on this site in future" to make that site work like the named ones.

The scan itself runs on the Blockfisher token scanner (`blockfisher-token-scanner-v2`, endpoints described in its `docs/extension-api.md`). The extension holds no API keys.

## Build and load it

1. `npm install`, then `npm run build`.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `dist`.

The build points at `https://blockfisher-token-scanner-v2.onrender.com` by default. To use another scanner, set `BLOCKFISHER_API` when building, for example a local one started with `npm start` in the scanner repo:

```
BLOCKFISHER_API=http://localhost:5181 npm run build
```

`npm test` runs the page reader, card and flow tests. `npm run typecheck` checks types.

## How it finds tokens

| Where | How |
| --- | --- |
| DexScreener | `/<chain>/<pair or token>` in the page address. The scanner turns a pair into its base token. |
| CoinGecko | `/coins/<id>` in the page address. The scanner looks up the coin's contracts. |
| jup.ag | `/swap/<sell>-<buy>`, `?sell=&buy=`, `?inputMint=&outputMint=` or `/tokens/<mint>`. The buy side comes first. |
| Uniswap, GMGN, Birdeye | The token address in the page address. |
| Any other site | Links to explorers and charts (Etherscan, Basescan, BscScan, Solscan, pump.fun, DexScreener and the sites above), then addresses in the page text, with ones labelled "CA" or "Contract" first. |

The scanner checks each address trades somewhere before the card shows, which drops wallet addresses. Stablecoins and wrapped SOL/ETH are listed last.

## Code

| File | Does |
| --- | --- |
| `src/readers/` | Finding tokens: page address (`url.ts`), links and text (`page.ts`), address checks (`address.ts`). |
| `src/content.ts` | Runs on named and remembered sites; shows the card. |
| `src/popup.ts`, `src/reader.ts` | The toolbar popup, which reads the current tab on click. |
| `src/background.ts` | Talks to the scanner; keeps remembered sites registered. |
| `src/sites.ts`, `src/settings.ts` | Remembered sites and per-site choices (Ask me / Scan automatically / Off), in Chrome's synced storage. |
| `src/ui/` | The card. |

## Permissions

- `storage`: per-site choices and remembered sites.
- `activeTab`, `scripting`: read the current tab only when the user clicks the icon.
- Content scripts on the six named sites.
- `optional_host_permissions`: asked for one site at a time, only when the user ticks "Run auto scan on this site in future".
- Host access to the scanner, to send it the token address.

Only the token address and chain are sent to Blockfisher. Not the page address, browsing history or wallet.
