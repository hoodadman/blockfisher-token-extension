import { useMemo, useRef, useState } from 'react';
import { LookupError, isTokenAddress, lookupToken, type TokenLookup } from './api/lookup';
import { ScoreBrief } from './components/ScoreBrief';
import { ScorePanel } from './components/ScorePanel';
import { ScoreTriangle } from './components/ScoreTriangle';
import { TokenSearch } from './components/TokenSearch';
import { averageScore, scoreToken, type TrustReport } from './scoring';
import { summaryFacts } from './summary/facts';

const MESSAGES = {
  invalid: 'That doesn’t look like a token address. Check you’ve copied all of it.',
  unavailable: 'We couldn’t reach the market data service. Check your connection and try again.',
  unexpected: 'Something went wrong. Please try again.',
};

type View =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; lookup: TokenLookup; report: TrustReport };

export function App() {
  const [view, setView] = useState<View>({ status: 'idle' });
  const inFlight = useRef<AbortController | null>(null);

  async function check(address: string) {
    inFlight.current?.abort();
    if (!isTokenAddress(address)) {
      setView({ status: 'error', message: MESSAGES.invalid });
      return;
    }

    const controller = new AbortController();
    inFlight.current = controller;
    setView({ status: 'loading' });
    try {
      const lookup = await lookupToken(address, controller.signal);
      if (controller.signal.aborted) return;
      setView({ status: 'done', lookup, report: scoreToken(lookup.signals) });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!(error instanceof LookupError)) console.error(error);
      setView({ status: 'error', message: errorMessage(error) });
    }
  }

  return (
    <main className="page">
      <header className="page__intro">
        <h1>Token trust score</h1>
        <p>Paste a token address to see a simple three-part score: security, community, and foundation.</p>
      </header>

      <TokenSearch onSearch={check} error={view.status === 'error' ? view.message : undefined} />

      <p className="visually-hidden" role="status">
        {view.status === 'loading' && 'Checking this token…'}
        {view.status === 'done' && `Results for ${view.lookup.name ?? 'this token'} on ${view.lookup.chain.name}.`}
      </p>

      {view.status === 'loading' && (
        <div className="loading" aria-hidden="true">
          <span className="loading__spinner" />
          Checking this token…
        </div>
      )}
      {view.status === 'done' && <Result lookup={view.lookup} report={view.report} />}
    </main>
  );
}

function Result({ lookup, report }: { lookup: TokenLookup; report: TrustReport }) {
  const { name, symbol, chain, address, failures, community, foundation } = lookup;
  const holdersNeedKey = failures.some(({ source, status }) => source === 'holders' && (status === 401 || status === 403));
  const twitterNeedKey = failures.some(({ source, status }) => source === 'community' && (status === 401 || status === 403));
  const showSymbol = symbol && symbol !== name;
  const overall = averageScore([report.score, community?.score, foundation.score]);
  const facts = useMemo(
    () => summaryFacts({ name, overall, security: report, community, foundation }),
    [name, overall, report, community, foundation],
  );

  return (
    <div className="result">
      <div className="token">
        <p className="token__name">
          {name ?? 'Unnamed token'}
          {showSymbol && <span className="token__symbol">{symbol}</span>}
        </p>
        <p className="token__meta">
          {chain.name} ·{' '}
          <span className="token__address" title={address}>
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </p>
      </div>

      {failures.length > 0 && (
        <p className="notice">
          {import.meta.env.DEV && holdersNeedKey
            ? 'Developer note: holder checks need an InsightX key. Add INSIGHTX_API_KEY to .env.local, then restart the dev server. The security score still ran.'
            : import.meta.env.DEV && twitterNeedKey
              ? 'Developer note: Twitter rejected the request. Check the bearer token in .env.local, then restart the dev server.'
              : 'Some checks couldn’t run because part of the data was unavailable. Try again in a minute.'}
        </p>
      )}

      <div className="result__split">
        <div className="result__visual">
          <ScoreTriangle
            overall={overall}
            pillars={[
              { id: 'security', label: 'Security', score: report.score },
              { id: 'community', label: 'Community', score: community?.score ?? null },
              { id: 'foundation', label: 'Foundation', score: foundation.score },
            ]}
          />
          <ScoreBrief facts={facts} community={community} foundation={foundation} />
        </div>
        <ScorePanel security={report} />
      </div>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (!(error instanceof LookupError)) return MESSAGES.unexpected;
  if (error.reason === 'not-found') {
    const chains = new Intl.ListFormat('en-GB', { type: 'disjunction' }).format(error.searched.map((chain) => chain.name));
    return `We couldn’t find this token on ${chains}. Check the address, or it may not be trading yet.`;
  }
  return MESSAGES[error.reason];
}
