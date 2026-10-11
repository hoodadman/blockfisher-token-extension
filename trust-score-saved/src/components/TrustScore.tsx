import { useId, useState } from 'react';
import type { CheckSummary, Issue, RiskBand, Severity, TrustReport } from '../scoring';
import { InfoTooltip } from './InfoTooltip';
import './TrustScore.css';

const BAND_COPY: Record<RiskBand, { label: string; tagline: string }> = {
  low: { label: 'Low risk', tagline: 'No serious warning signs found' },
  medium: { label: 'Medium risk', tagline: 'Some warning signs found' },
  high: { label: 'High risk', tagline: 'Serious warning signs found' },
};

const NO_SCORE_COPY = { label: 'Not enough data', tagline: 'We couldn’t run enough checks to give a score' };

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  minor: 'Minor',
};

export interface TrustScoreProps {
  report: TrustReport;
  docsUrl: string;
  defaultOpen?: boolean;
}

export function TrustScore({ report, docsUrl, defaultOpen = false }: TrustScoreProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const readMoreTipId = useId();
  const { score, band, issues } = report;
  const copy = band ? BAND_COPY[band] : NO_SCORE_COPY;
  const tagline = score === 100 ? 'Passed all our checks' : copy.tagline;
  const toggleLabel =
    issues.length === 0 ? 'See what we checked' : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} found`;

  return (
    <section className={`ts ts--${band ?? 'none'}`} aria-label="Trust score">
      <button
        type="button"
        className="ts__summary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <ScoreRing score={score} />
        <span className="ts__headline">
          <span className="ts__eyebrow">Trust score</span>
          <span className="ts__band">{copy.label}</span>
          <span className="ts__tagline">{tagline}</span>
          <span className="ts__toggle">
            {toggleLabel}
            <svg className="ts__chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </button>

      <div id={panelId} className="ts__panel" hidden={!open}>
        {issues.length > 0 && (
          <ul className="ts__issues">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        )}
        <CheckList variant="passed" title="Checks passed" items={report.passed} />
        <CheckList
          variant="unknown"
          title="Couldn’t check"
          note="We didn’t have the data for these, so they didn’t change the score."
          items={report.notChecked}
        />
      </div>

      <footer className="ts__footer">
        <span className="ts__readmore">
          <a href={docsUrl} target="_blank" rel="noopener noreferrer" aria-describedby={readMoreTipId}>
            Read more
          </a>
          <span role="tooltip" id={readMoreTipId} className="tip">
            How the score is worked out, and what each check means.
          </span>
        </span>
        <p className="ts__disclaimer">
          This score is a guide, not a guarantee. It’s based on automated checks and can’t catch every risk.
        </p>
      </footer>
    </section>
  );
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({ score }: { score: number | null }) {
  return (
    <span className="ts-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ts-ring__track" cx="50" cy="50" r={RADIUS} />
        {score !== null && score > 0 && (
          <circle
            className="ts-ring__value"
            cx="50"
            cy="50"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
          />
        )}
      </svg>
      {score === null ? (
        <span className="ts-ring__label">
          <span className="ts-ring__score" aria-hidden="true">?</span>
          <span className="ts-visually-hidden">No score</span>
        </span>
      ) : (
        <span className="ts-ring__label">
          <span className="ts-ring__score">{score}</span>
          <span className="ts-ring__max">out of 100</span>
        </span>
      )}
    </span>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <li className={`ts-issue ts-issue--${issue.severity}`}>
      <div className="ts-issue__body">
        <p className="ts-issue__title">
          <span>{issue.title}</span>
          <span className="ts-pill">{SEVERITY_LABEL[issue.severity]}</span>
          {issue.experimental && <span className="ts-pill ts-pill--beta">Beta</span>}
        </p>
        <p className="ts-issue__summary">{issue.summary}</p>
      </div>
      <InfoTooltip label={issue.title}>
        {issue.details}
        {issue.experimental && (
          <span className="tip__note">Beta check: based on wallet analysis, which isn’t always accurate.</span>
        )}
      </InfoTooltip>
    </li>
  );
}

interface CheckListProps {
  variant: 'passed' | 'unknown';
  title: string;
  note?: string;
  items: CheckSummary[];
}

function CheckList({ variant, title, note, items }: CheckListProps) {
  if (items.length === 0) return null;
  return (
    <details className={`ts-checks ts-checks--${variant}`}>
      <summary>
        {title} ({items.length})
      </summary>
      {note && <p className="ts-checks__note">{note}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.label}
            {item.experimental && <span className="ts-pill ts-pill--beta">Beta</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
