export type FoundationBand = 'solid' | 'forming' | 'thin';
export type FactStatus = 'good' | 'mid' | 'bad' | 'unknown';

export interface FoundationFact {
  id: 'age' | 'backing' | 'docs' | 'funding';
  label: string;
  status: FactStatus;
  summary: string;
  details: string;
}

export interface NamedBacker {
  handle: string;
  followers: number;
}

export interface FoundationReport {
  score: number | null;
  band: FoundationBand | null;
  facts: FoundationFact[];
  backers: readonly NamedBacker[];
  brands: readonly string[];
  docsUrl?: string;
  exchanges: readonly string[];
  investors: readonly string[];
  presaleUsd?: number;
}
