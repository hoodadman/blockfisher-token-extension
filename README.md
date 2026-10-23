# Blockfisher auto scan

A Chrome extension that spots the token you're looking at and offers to check it. Open a token on DexScreener, CoinGecko, jup.ag, Uniswap, GMGN or Birdeye and a small card asks "Run a safety scan?". On any other site, click the Blockfisher icon. You can tick "Run auto scan on this site in future" to make that site work like the named ones.

Three switches, in the icon's popup under **Settings** and on the settings page, change how it behaves at any time:

| Switch | On (default) | Off |
| --- | --- | --- |
| Auto scan | Looks for tokens on supported sites by itself. | Only works when you click the icon. |
| Auto pop up | Shows the card on the page. | Stays out of the way. The icon's badge shows the number of tokens found, or the score once scanned. Click the icon to see the card. |
| Confirm token before scan | Asks "Run a safety scan?" first. | Scans the main token straight away. On a swap page it scans the likelier one (not a stablecoin or wrapped SOL/ETH) and offers "Scan X as well?" under the results. |

Each site can also be turned on or off on the settings page, and new sites can be added there by address before visiting them.

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
| Any site, named or not | Any token address in the page address: path parts (`/token/<address>`) and query values (`?sell=..&buy=..`, `outputMint=`). On a swap the token being bought ranks first, and both are offered. |
| Any other site | Also links to explorers and charts (Etherscan, Basescan, BscScan, Solscan, pump.fun, DexScreener and the sites above), then addresses in the page text, with ones labelled "CA" or "Contract" first. Failing all that, the coin named in the page title ("Bittensor (TAO)", "Bittensor price today, TAO to USD"), accepted only when CoinGecko has a coin with that name and ticker. |

The scanner checks each address trades somewhere before the card shows, which drops wallet addresses. Stablecoins and wrapped SOL/ETH are listed last.

## Code

| File | Does |
| --- | --- |
| `src/readers/` | Finding tokens: page address (`url.ts`), links and text (`page.ts`), address checks (`address.ts`). |
| `src/content.ts` | Runs on named and remembered sites; shows the card. |
| `src/popup.ts`, `src/reader.ts` | The toolbar popup, which reads the current tab on click. |
| `src/background.ts` | Talks to the scanner; keeps remembered sites registered. |
| `src/sites.ts`, `src/settings.ts` | Remembered sites, per-site on/off and the three switches, in Chrome's synced storage. `src/ui/switches.ts` draws the switches. |
| `src/ui/` | The card. |

## Permissions

- `storage`: switches, per-site choices and remembered sites.
- `activeTab`, `scripting`: read the current tab only when the user clicks the icon.
- Content scripts on the six named sites.
- `optional_host_permissions`: asked for one site at a time, only when the user ticks "Run auto scan on this site in future".
- Host access to the scanner, to send it the token address.
- Host access to api.dexscreener.com and api.coingecko.com. Market data is fetched from the user's browser, because both services rate-limit the shared addresses the scanner runs on, and sent with the scan.

Only the token address and chain (and the token's public market data) are sent to Blockfisher, DexScreener and CoinGecko. Not the page address, browsing history or wallet.
