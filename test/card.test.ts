// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ScanReport } from '../src/api';
import type { IdentifiedToken } from '../src/readers/types';
import { renderCard } from '../src/ui/card';

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
