import type { TokenSignals } from '../scoring';

export function compact(signals: Partial<TokenSignals>): Partial<TokenSignals> {
  return Object.fromEntries(Object.entries(signals).filter(([, value]) => value !== undefined));
}

export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** True if any flag is true, false only when every flag is known to be false. */
export function anyTrue(...flags: Array<boolean | undefined>): boolean | undefined {
  if (flags.some((flag) => flag === true)) return true;
  return flags.every((flag) => flag === false) ? false : undefined;
}
