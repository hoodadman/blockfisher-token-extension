import { useMemo, type ReactNode } from 'react';
import { ScorePanel } from '@engine/components/ScorePanel';
import { ScoreTriangle } from '@engine/components/ScoreTriangle';
import { formatCount, MetricList, MetricRow } from '@engine/components/Metrics';
import { averageScore } from '@engine/scoring';
import { localBrief } from '@engine/summary';
import { summaryFacts } from '@engine/summary/facts';
import type { CommunityReport } from '@engine/community';
import type { DetectedTarget } from './detect';
import type { View } from './messages';

export function Overlay({
  view,
  onClose,
  onRetry,
}: {
  view: View;
  onClose: () => void;
  onRetry: (target: DetectedTarget) => void;
}) {
  if (view.status === 'idle') return null;

  return (
    <aside className="tts" aria-label="Token trust score">
      <header className="tts__bar">
        <strong>Token trust score</strong>
        <span className="tts__actions">
          {view.status === 'error' && (
            <button type="button" className="tts__textbtn" onClick={() => onRetry(view.target)}>
              Try again
            </button>
          )}
          <button type="button" className="tts__iconbtn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </span>
      </header>
      {view.status === 'loading' && (
        <div className="tts__pad">
          <p className="tts__status">Checking this token…</p>
          <p className="tts__mono">{shorten(view.target.address)}</p>
        </div>
      )}
      {view.status === 'error' && (
        <div className="tts__pad">
          <p className="tts__status">{view.message}</p>
        </div>
      )}
      {view.status === 'done' && <Result result={view.result} />}
    </aside>
  );
}

function Result({ result }: { result: Extract<View, { status: 'done' }>['result'] }) {
  const { name, symbol, chain, address, failures, community, foundation, report } = result;
  const showSymbol = symbol && symbol !== name;
  const overall = averageScore([report.score, community?.score, foundation.score]);
  const facts = useMemo(
    () => summaryFacts({ name, overall, security: report, community, foundation }),
    [name, overall, report, community, foundation],
  );
  const brief = localBrief(facts);
  const missingKeys = failures.some(({ source, status }) => (source === 'holders' || source === 'community') && (status === 401 || status === 403));

  return (
    <div className="tts__body">
      <div className="token">
        <p className="token__name">
          {name ?? 'Unnamed token'}
          {showSymbol && <span className="token__symbol">{symbol}</span>}
        </p>
        <p className="token__meta">
          {chain.name} · <span className="token__address">{shorten(address)}</span>
        </p>
      </div>
      {missingKeys && (
        <p className="notice">
          Community and holder extras need keys. Right-click the extension icon, open Options, then paste them. Security still ran.
        </p>
      )}
      <ScoreTriangle
        overall={overall}
        pillars={[
          { id: 'security', label: 'Security', score: report.score },
          { id: 'community', label: 'Community', score: community?.score ?? null },
          { id: 'foundation', label: 'Foundation', score: foundation.score },
        ]}
      />
      <section className="brief" aria-label="Plain-English summary">
        <div className="brief__block">
          <h3>Security</h3>
          <p>{brief.security}</p>
        </div>
        <BriefDrop title="Community" text={brief.community}>
          <CommunityRows report={community} />
        </BriefDrop>
        <BriefDrop title="Foundation" text={brief.foundation}>
          {foundation.facts.map((fact) => (
            <MetricRow key={fact.id} title={fact.label} note={fact.summary} tone={fact.status} tip={fact.details} />
          ))}
        </BriefDrop>
      </section>
      <ScorePanel security={report} defaultOpen={false} />
    </div>
  );
}

function BriefDrop({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <details className="brief__block">
      <summary>
        <h3>{title}</h3>
        <p>{text}</p>
        <span className="brief__toggle">See the details</span>
      </summary>
      <MetricList>{children}</MetricList>
    </details>
  );
}

function CommunityRows({ report }: { report?: CommunityReport }) {
  if (!report?.official) {
    return (
      <>
        <MetricRow title="No official Twitter page found" tip="Without an official page we can only look at other people talking about the token." />
        <MentionRow report={report} />
      </>
    );
  }
  const { official } = report;
  return (
    <>
      <MetricRow title={`@${official.handle}`} note={`${formatCount(official.followers)} followers`} tip="The token’s own page." />
      <MetricRow title={`${formatCount(official.averageReplies)} replies per post`} tip="Comments on official posts." />
      <MentionRow report={report} />
    </>
  );
}

function MentionRow({ report }: { report?: CommunityReport }) {
  return (
    <MetricRow
      title={report?.mentions.counted ? `${report.mentions.counted} other recent posts` : 'No recent posts from other accounts'}
      note={report?.mentions.ignoredBots ? `${report.mentions.ignoredBots} tiny accounts left out` : undefined}
      tip="Larger accounts count for more."
    />
  );
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

