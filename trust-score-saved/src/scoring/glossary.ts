/** CertiK-style glossary. Tooltips use userFriendly + risk. Technical and source are for the later Read more doc. */
export interface GlossaryEntry {
  term: string;
  userFriendly: string;
  risk: string;
  technical: string;
  source: string;
}

export const GLOSSARY: Readonly<Record<string, GlossaryEntry>> = {
  feesChangeable: {
    term: 'Tax modifiable',
    userFriendly: 'The creator can change the buy or sell fee after the token is launched.',
    risk: 'They could raise the sell fee so high that you are stuck, or only leave at a heavy loss.',
    technical:
      'Smart contract contains privileged setter functions that permit admin addresses to manipulate fee state variables post-deployment.',
    source: 'Initial concepts have been expanded from CertiK Token Scan parameters.',
  },
  externalCall: {
    term: 'External call',
    userFriendly:
      'While a normal transfer is happening, the token can run outside code that is not part of the token itself.',
    risk: 'That outside code could steal funds, block the transfer, or change the token mid-transaction.',
    technical:
      'The contract executes external instructions during execution flows, handing temporary control flow and execution context to an external contract address.',
    source: 'Initial concepts have been expanded from CertiK Token Scan parameters.',
  },
  ownership: {
    term: 'Ownership renounced',
    userFriendly: 'We check whether the original creator has given up owner status, so they can no longer use admin tools.',
    risk: 'If they still own it, they may still pause trading, mint tokens, or change fees. If they have given it up, bugs in the code can never be patched.',
    technical:
      'The smart contract state variable for the contract owner address has been permanently set to a zero or burn address, therefore revoking access to functions protected by administrative access-control modifiers.',
    source: 'Initial concepts have been expanded from CertiK Token Scan parameters.',
  },
  hiddenControl: {
    term: 'Hidden owner',
    userFriendly: 'Someone may still have admin control even though a normal ownership check looks clean.',
    risk: 'The token can look safe because ownership appears given up, while a hidden controller can still change fees, block sales, mint tokens, or drain the trading pot.',
    technical:
      'The smart contract utilises indirect access-control mechanisms that allow a specific address to bypass standard owner limitations and execute privileged functions.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken context.',
  },
  publicCode: {
    term: 'Open source',
    userFriendly: 'The token’s code should be public, so the risks can actually be checked.',
    risk: 'If the code is not public, the other checks cannot be trusted with certainty.',
    technical:
      'The contract bytecode deployed on-chain matches verified, human-readable source code compiled and submitted to a public block explorer.',
    source: 'Initial concepts have been expanded from CertiK Token Scan.',
  },
  honeypot: {
    term: 'Honeypot',
    userFriendly: 'You can buy the token, but selling is blocked, restricted, or extremely expensive.',
    risk: 'Your money is usually stuck. The price may keep rising as others buy in, until the creator drains the trading pot.',
    technical:
      'Smart contract logic containing conditional trade execution barriers that permit buy functions while sell functions fail or revert.',
    source: 'Initial concepts have been expanded from CertiK published blog and SlowMist.',
  },
  upgradeable: {
    term: 'Proxy contract',
    userFriendly: 'The creator can later swap the rules for a completely different set of rules.',
    risk: 'A token that looks safe today can be changed into a honeypot, or have balances rewritten, without you doing anything.',
    technical:
      'A setup where a proxy contract holds the token’s data but forwards execution to a separate contract. The proxy address stays the same, but an admin can point it at brand-new code.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken context.',
  },
  mintable: {
    term: 'Mintable',
    userFriendly: 'The creator can increase the supply, so each existing token is worth a smaller share.',
    risk: 'They can print new tokens and sell them into the pool, which can collapse the price.',
    technical:
      'The smart contract contains state-increasing functions protected by access-control modifiers. These functions allow admin addresses to increase the total supply and assign newly created tokens to arbitrary wallet addresses after deployment.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken context.',
  },
  pause: {
    term: 'Transfer pausable',
    userFriendly: 'The creator can freeze all transfers, so buying, selling, or sending the token becomes impossible.',
    risk: 'Your tokens can be stuck until they choose to switch trading back on — if they ever do.',
    technical:
      'The smart contract incorporates an emergency stop mechanism where transfer functions are affected. Designated admin roles can trigger pause and unpause functions restricting core transfer methods.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken.',
  },
  tradingCooldown: {
    term: 'Trading cooldown',
    userFriendly: 'The creator can force a wait between buys, sells, or transfers, and can stretch that wait.',
    risk: 'In a fast-moving market, even a short lock can mean a large loss. A longer cooldown can trap wallets.',
    technical:
      'The smart contract tracks time parameters for individual wallet addresses or globally within transfer functions. A conditional check enforces a mandatory delay between consecutive executions, and privileged admin roles can reconfigure it.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and SlowMist.',
  },
  sellLimits: {
    term: 'Can’t sell all',
    userFriendly: 'You may have to keep a minimum balance, so you can never sell your whole holding.',
    risk: 'You stay exposed to the price, and in a rug pull that leftover amount can become worthless.',
    technical:
      'Smart contract transfer functions include a conditional check that evaluates a wallet’s remaining balance after a sell order. If the post-transaction balance drops below a required minimum, the transaction reverts.',
    source: 'Initial concepts have been expanded from CertiK Token Scan.',
  },
  canTakeTokens: {
    term: 'Owner can change balance',
    userFriendly: 'The creator can change any wallet’s balance without that person’s say-so.',
    risk: 'They can zero your balance and take the tokens without a normal transfer.',
    technical:
      'The smart contract exposes privileged setter functions that directly manipulate the balances mapping for specific address keys, allowing designated admin roles to set, increase, or reset user token balances without standard transfer logs or user signatures.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken context.',
  },
  hasBlacklist: {
    term: 'Has blacklist',
    userFriendly: 'The creator can lock a chosen wallet out of buying, selling, or sending.',
    risk: 'Your wallet can be blocked with no notice, in a single transaction.',
    technical:
      'The smart contract maintains a mapping of addresses to boolean values controlled by administrative functions. Core transfer methods revert if initiated by or routed to a flagged address.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and SlowMist.',
  },
  hasWhitelist: {
    term: 'Has whitelist',
    userFriendly:
      'Some wallets — usually the creator’s — can skip taxes, trade while others are paused, or sell before the public can.',
    risk: 'They can sell freely while you cannot, so the market is stacked against ordinary holders.',
    technical:
      'The smart contract maintains a mapping of addresses to boolean status flags managed via administrative functions. Core transfer methods check these states to bypass fees, cooldowns, or a global pause for designated addresses.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and SlowMist.',
  },
  fees: {
    term: 'Buy and sell tax',
    userFriendly:
      'A buy tax takes a cut when you purchase. A sell tax takes a cut when you exit. The creator should disclose a fixed rate.',
    risk: 'A high or hidden fee shrinks what you receive. If they can also change it later, the fee can become a trap.',
    technical:
      'Transfer functions calculate a percentage fee when a buy or sell swap is detected against a decentralised exchange pair, then redirect that portion before completing the trade.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and Hacken context.',
  },
  antiWhale: {
    term: 'Is anti-whale',
    userFriendly: 'The creator can cap how much anyone may buy, sell, or hold — and usually exempt their own wallets.',
    risk: 'Rules they can change at will can be used to limit how much you can buy or how fast you can sell, while they trade freely.',
    technical:
      'Transfer functions contain conditional checks enforcing maximum transaction limits or maximum wallet balance thresholds. Transactions over those limits revert, while admin or whitelisted addresses are bypassed.',
    source: 'Initial concepts have been expanded from CertiK Token Scan.',
  },
  topHolders: {
    term: 'Holder count',
    userFriendly: 'Holder spread shows whether many people own the token, or only a few wallets do.',
    risk: 'If most of the supply sits with the creator or a handful of wallets, one sale can crash the price.',
    technical:
      'An off-chain indexed metric of unique non-zero balance addresses for the contract, excluding pool, burn, and bridge accounts.',
    source: 'Initial concepts have been expanded from CertiK Token Scan.',
  },
  knownScamCreator: {
    term: 'Creator address',
    userFriendly: 'We check whether the creator’s wallet is linked to other scam tokens.',
    risk: 'A wallet tied to earlier scams, especially if it can still mint, pause, or block selling, is a serious warning.',
    technical:
      'A cross-reference against other known scam deployments. A single deploying address that controls minting, pausing, or blacklisting is a systematic governance risk. A link to another scam does not prove this token is a scam, but it warrants extra caution.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken context.',
  },
  devHoldings: {
    term: 'Creator balance',
    userFriendly: 'This is how much of the supply the owner or creator still holds.',
    risk: 'A large unlocked holding can be dumped on the market. That is worse if they can still mint, or have not given up ownership.',
    technical:
      'Percentage of supply held by the creator. Unlike locked liquidity, there is no selling restriction. Combined with a mintable contract or non-renounced ownership, this can indicate a pump and dump.',
    source: 'Initial concepts have been expanded from CertiK Token Scan.',
  },
  obfuscated: {
    term: 'Has obfuscated address',
    userFriendly: 'The contract cannot be fully verified, so a complete security check was impossible.',
    risk: 'We cannot be sure the contract is safe.',
    technical:
      'Closed-source code, proxy redirection, or hidden-owner mechanics can hide what functions exist, what triggers them, and who controls them.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken context.',
  },
  suspiciousFunctions: {
    term: 'Has suspicious functions',
    userFriendly: 'The contract has potentially malicious functions, or the owner has more control than they should.',
    risk: 'They may be able to block wallets, drain balances, or change how transfers work after launch.',
    technical:
      'Self-destruct, hidden mint, external calls, balance modifications, and ownership retrievals may be hidden. Contract behaviour may deviate from expected ERC-20 behaviour.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and supporting Hacken context.',
  },
  canFreeze: {
    term: 'Has blacklist',
    userFriendly: 'The creator can lock a wallet so those tokens cannot be sold or sent.',
    risk: 'Your wallet can be frozen with no notice.',
    technical:
      'A freeze authority or blacklist mapping lets an admin stop chosen addresses from transferring.',
    source: 'Initial concepts have been expanded from CertiK Token Scan and SlowMist.',
  },
  liquidityLock: {
    term: 'Locked trading pool',
    userFriendly: 'We check how much of the shared pot used for trading is locked so it cannot be pulled out.',
    risk: 'If most of the pot is unlocked, the creator can empty it and leave holders unable to sell at a fair price.',
    technical: 'Share of LP tokens marked as locked in holder lists.',
    source: '',
  },
  liquidity: {
    term: 'Trading pool size',
    userFriendly: 'This is how much money sits in the shared pot used for buying and selling.',
    risk: 'A tiny pot makes selling harder and more expensive, and a modest sale can crash the price.',
    technical: 'Reported USD liquidity of the deepest pool.',
    source: '',
  },
  tokenAge: {
    term: 'Token age',
    userFriendly: 'Newer tokens have less history, so there is less to judge them by.',
    risk: 'Many scams happen in the first hours or days after launch.',
    technical: 'Time since the earliest pair was created.',
    source: '',
  },
  socials: {
    term: 'Website and social media',
    userFriendly: 'A public website or social page is a basic sign that someone is standing behind the project.',
    risk: 'Missing links make the people behind the token harder to check.',
    technical: 'Presence of a website or social URL on the market listing.',
    source: '',
  },
  clusters: {
    term: 'Linked wallets',
    userFriendly: 'We look for groups of wallets that seem to belong to the same people.',
    risk: 'A large group can sell together and dump the price.',
    technical: 'Clustered share of supply from shared funding or trading patterns.',
    source: '',
  },
  bundlers: {
    term: 'Coordinated buying',
    userFriendly: 'We look for people who bought with many wallets at once at launch.',
    risk: 'That can hide a single large buyer who later dumps.',
    technical: 'Share of supply bought in bundled launch transactions.',
    source: '',
  },
  snipers: {
    term: 'Launch snipers',
    userFriendly: 'We look for wallets that bought in the first seconds, often bots.',
    risk: 'They can sell into later buyers and knock the price down.',
    technical: 'Share of supply still held by first-block or first-minute buyers.',
    source: '',
  },
  metadataMutable: {
    term: 'Name and logo',
    userFriendly: 'The creator can still change the token’s name, symbol, and picture.',
    risk: 'That can be used to make this token look like a different, better-known one.',
    technical: 'Metadata update authority is still held.',
    source: '',
  },
};

export function tooltipFor(id: string): string {
  const entry = GLOSSARY[id];
  if (!entry) return '';
  return `${entry.userFriendly} ${entry.risk}`;
}
