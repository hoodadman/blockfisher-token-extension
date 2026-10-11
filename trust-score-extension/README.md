# Token trust score — Chrome extension

Test build. It watches DexScreener, Uniswap, GMGN and Birdeye. When the URL has a token or pair address, it runs the same scan as the frozen web app in `trust-score-saved`.

The live web app is still in `trust-score`. This folder does not change it.

## Load it in Chrome

1. In this folder run `npm install` then `npm run build`.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose `trust-score-extension/dist`.
5. Open a token page, for example `https://dexscreener.com/ethereum/` plus a pair or token address.

On a DexScreener **pair** page it resolves the **base token** (so ETH/USDC becomes WETH), then scores that contract.

## Keys (optional)

Right-click the extension → **Options**. Security and DexScreener still run with no keys. InsightX and X only run if you paste keys there. Keys stay in `chrome.storage` on this computer.
