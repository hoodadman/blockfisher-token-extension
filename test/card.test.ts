// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ScanReport } from '../src/api';
import type { IdentifiedToken } from '../src/readers/types';
import { ago, checkedText, renderCard } from '../src/ui/card';

const pepe: IdentifiedToken = { input: 'x', status: 'token', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', network: 'eth', chainName: 'Ethereum', symbol: 'PEPE' };
const bonk: IdentifiedToken = { input: 'y', status: 'token', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', network: 'sol', chainName: 'Solana', symbol: 'BONK' };

const click = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll('button')].find((button) => button.textContent === label)?.click();

describe('renderCard', () => {
  it('asks about a single token in plain words', () => {
    const root = document.createElement('div');
    const onScan = vi.fn();
    renderCard(root, { kind: 'ask', tokens: [pepe], notes: [], offerRemember: false }, { onScan, onDismiss: vi.fn() });
    expect(root.textContent).toContain('Blockfisher found PEPE on Ethereum. Run a safety scan?');
    click(root, 'Scan');
    expect(onScan).toHaveBeenCalledWith([pepe], false);
  });

  it('scans only the ticked tokens and passes the remember choice', () => {
    const root = document.createElement('div');
    const onScan = vi.fn();
    renderCard(root, { kind: 'ask', tokens: [pepe, bonk], notes: [], offerRemember: true }, { onScan, onDismiss: vi.fn() });
    const boxes = [...root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    expect(boxes.map((box) => box.checked)).toEqual([true, false, false]);
    boxes[1].checked = true;
    boxes[2].checked = true;
    click(root, 'Scan');
    expect(onScan).toHaveBeenCalledWith([pepe, bonk], true);
  });

  it('shows the score, readings, top issues and the unfinished note', () => {
    const report: ScanReport = {
      address: pepe.address!,
      chain: { name: 'Ethereum', network: 'eth' },
      symbol: 'PEPE',
      overall: 52,
      security: { score: 40, band: 'medium', issues: [{ id: 'mint', severity: 'warning', title: 'More can be made', summary: 'The owner can create new tokens.' }], notChecked: [{ id: 'holders', label: 'Holders' }] },
      community: { score: null },
      foundation: { score: 64 },
      brief: { security: 'S.', community: 'C.', foundation: 'F.' },
      failures: [],
    };
    const root = document.createElement('div');
    renderCard(root, { kind: 'results', results: [{ token: pepe, report }] }, { onScan: vi.fn(), onDismiss: vi.fn() });
    expect(root.querySelector('.bf__overall-value')?.textContent).toBe('52');
    expect(root.textContent).toContain('Medium risk');
    expect(root.textContent).toContain('More can be made');
    expect(root.textContent).toContain('unfinished');
    expect(root.querySelector('.bf__score--none')?.textContent).toContain('Community');
  });
});

describe('"as well?" button', () => {
  it('offers the page’s other tokens after a scan and asks for one when clicked', () => {
    const sol = { input: 'So11111111111111111111111111111111111111112', status: 'token' as const, address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', chainName: 'Solana', network: 'sol' as const };
    const onScanMore = vi.fn();
    const root = document.createElement('div');
    renderCard(root, { kind: 'results', results: [{ token: pepe, error: 'x' }], more: [sol] }, { onScan: vi.fn(), onDismiss: vi.fn(), onScanMore });
    click(root, 'Scan SOL as well?');
    expect(onScanMore).toHaveBeenCalledWith(sol);
    expect(root.textContent).toContain('Checking SOL on Solana');
  });
});

describe('shared answers', () => {
  const now = 1_000_000_000;
  const report: ScanReport = {
    address: pepe.address!,
    chain: { name: 'Ethereum', network: 'eth' },
    symbol: 'PEPE',
    overall: 80,
    security: { score: 80, band: 'low', issues: [], notChecked: [] },
    community: { score: 80 },
    foundation: { score: 80 },
    brief: { security: 'S.', community: 'C.', foundation: 'F.' },
    failures: [],
  };

  it('says how old shared parts are, and nothing when they are fresh', () => {
    expect(ago(now - 40 * 60_000, now)).toBe('40 minutes ago');
    expect(ago(now - 6 * 3_600_000, now)).toBe('6 hours ago');
    expect(checkedText({ ...report, checked: { community: now - 6 * 3_600_000, holders: now - 30_000 } }, now)).toBe(
      'Community checked 6 hours ago. Security checked just now.',
    );
    expect(checkedText({ ...report, checked: { community: now - 60_000 } }, now)).toBeNull();
    expect(checkedText(report, now)).toBeNull();
  });

  it('offers a re-check for an older shared result', () => {
    const onRecheck = vi.fn();
    const root = document.createElement('div');
    const old = { ...report, checked: { community: Date.now() - 3 * 3_600_000 } };
    renderCard(root, { kind: 'results', results: [{ token: pepe, report: old }] }, { onScan: vi.fn(), onDismiss: vi.fn(), onRecheck });
    expect(root.textContent).toContain('Community checked 3 hours ago');
    click(root, 'Re-check');
    expect(onRecheck).toHaveBeenCalledWith(0);
    expect(root.textContent).toContain('Checking…');
  });

  it('does not offer a re-check on Free, which the scanner refuses', () => {
    const onRecheck = vi.fn();
    const root = document.createElement('div');
    const old = { ...report, plan: 'free' as const, checked: { community: Date.now() - 3 * 3_600_000 } };
    renderCard(root, { kind: 'results', results: [{ token: pepe, report: old }] }, { onScan: vi.fn(), onDismiss: vi.fn(), onRecheck });
    expect(root.textContent).toContain('Community checked 3 hours ago');
    expect([...root.querySelectorAll('button')].some((button) => button.textContent === 'Re-check')).toBe(false);
    expect(root.textContent).toContain('Re-check is part of Pro.');
  });
});

describe('issues', () => {
  it('labels experimental holder checks', () => {
    const report: ScanReport = {
      address: bonk.address!,
      chain: { name: 'Solana', network: 'sol' },
      symbol: 'BONK',
      overall: 70,
      security: {
        score: 70,
        band: 'medium',
        issues: [
          { id: 'bundlers', severity: 'warning', title: 'Coordinated buying', summary: 'A few wallets bought together.', experimental: true },
          { id: 'tokenAge', severity: 'minor', title: 'New token', summary: 'It started trading 3 days ago.', experimental: false },
        ],
        notChecked: [],
      },
      community: { score: 70 },
      foundation: { score: 70 },
      brief: { security: 'S.', community: 'C.', foundation: 'F.' },
      failures: [],
    };
    const root = document.createElement('div');
    renderCard(root, { kind: 'results', results: [{ token: bonk, report }] }, { onScan: vi.fn(), onDismiss: vi.fn() });
    const titles = [...root.querySelectorAll('.bf__report > .bf__issues .bf__issue strong')].map((node) => node.textContent);
    expect(titles).toEqual(['Coordinated buying (experimental)', 'New token']);
  });
});

describe('view full scan', () => {
  const issue = (n: number) => ({ id: `i${n}`, severity: 'minor' as const, title: `Issue ${n}`, summary: `Summary ${n}.`, details: `Details ${n}.` });
  const report: ScanReport = {
    address: pepe.address!,
    chain: { name: 'Ethereum', network: 'eth' },
    symbol: 'PEPE',
    overall: 75,
    security: { score: 75, band: 'medium', issues: [1, 2, 3, 4].map(issue), notChecked: [], coverage: { checked: 18, total: 20 } },
    securityGroups: [
      { id: 'mint', label: 'Minting', status: 'pass', summary: 'No one can make more tokens.' },
      { id: 'holders', label: 'Holders', status: 'unknown', summary: 'Holder data was missing.' },
    ],
    community: {
      score: 70,
      official: { handle: 'pepecoineth', followers: 600_000, tweetsLookedAt: 20, averageLikes: 1234.4, averageReplies: 88 },
      mentions: { counted: 40, ignoredBots: 5, total: 1200 },
      telegram: { members: 5000, online: 3, quiet: true },
    },
    foundation: { score: 80, facts: [{ id: 'age', label: 'Age', status: 'good', summary: 'Trading for 3 years.' }], exchanges: ['Binance'] },
    brief: { security: 'S.', community: 'C.', foundation: 'F.' },
    failures: [{ source: 'holders' }],
    notes: ['Basic community check.'],
  };

  const render = (root = document.createElement('div')) => {
    renderCard(root, { kind: 'results', results: [{ token: pepe, report }] }, { onScan: vi.fn(), onDismiss: vi.fn(), onRecheck: vi.fn() });
    return root;
  };

  it('keeps the card short and folds everything else away', () => {
    const root = render();
    const short = [...root.querySelectorAll('.bf__report > .bf__issues .bf__issue strong')].map((node) => node.textContent);
    expect(short).toEqual(['Issue 1', 'Issue 2', 'Issue 3']);
    const full = root.querySelector<HTMLDetailsElement>('details.bf__full')!;
    expect(full.open).toBe(false);
    expect(full.querySelector('summary')?.textContent).toBe('View full scan');
  });

  it('shows every issue, check, community and foundation detail', () => {
    const text = render().querySelector('details.bf__full')!.textContent;
    expect(text).toContain('Issue 4');
    expect(text).toContain('Details 4.');
    expect(text).toContain('18 of 20 checks had data.');
    expect(text).toContain('Minting No one can make more tokens.');
    expect(text).toContain('@pepecoineth: 600,000 followers. Its last 20 posts averaged 1,234 likes and 88 replies.');
    expect(text).toContain('1,200 posts mentioned it this week. We read 40 from real accounts, 5 bot posts ignored.');
    expect(text).toContain('Telegram: 5,000 members, 3 online. Many members but almost nobody online');
    expect(text).toContain('Age Trading for 3 years.');
    expect(text).toContain('Listed on Binance.');
    expect(text).toContain('Basic community check.');
    expect(text).toContain('Couldn’t reach: holders.');
  });

  it('falls back to the brief when an older scanner sends only scores', () => {
    const root = document.createElement('div');
    const bare: ScanReport = { ...report, securityGroups: undefined, community: undefined, foundation: { score: 50 }, notes: undefined, failures: [] };
    renderCard(root, { kind: 'results', results: [{ token: pepe, report: bare }] }, { onScan: vi.fn(), onDismiss: vi.fn() });
    const text = root.querySelector('details.bf__full')!.textContent;
    expect(text).toContain('Community wasn’t checked on this scan.');
    expect(text).toContain('F.');
  });

  it('stays open when the card is drawn again', () => {
    const root = render();
    root.querySelector<HTMLDetailsElement>('details.bf__full')!.open = true;
    render(root);
    const full = root.querySelector<HTMLDetailsElement>('details.bf__full')!;
    expect(full.open).toBe(true);
    expect(full.querySelector('summary')?.textContent).toBe('Hide full scan');
  });
});
