import type { ReactNode } from 'react';
import { InfoTooltip } from './InfoTooltip';

export function MetricList({ children }: { children: ReactNode }) {
  return <ul className="panel-metrics">{children}</ul>;
}

export function MetricRow({
  title,
  note,
  tip,
  tone,
  pill,
  experimental,
}: {
  title: string;
  note?: string;
  tip?: string;
  tone?: string;
  pill?: string;
  experimental?: boolean;
}) {
  return (
    <li className={`panel-metric${tone ? ` panel-metric--${tone}` : ''}`}>
      <div className="panel-metric__body">
        <p className="panel-metric__title">
          <span>{title}</span>
          {pill && <span className="ts-pill">{pill}</span>}
          {experimental && <span className="ts-pill ts-pill--beta">Beta</span>}
        </p>
        {note && <p className="panel-metric__note">{note}</p>}
      </div>
      {tip && <InfoTooltip label={title}>{tip}</InfoTooltip>}
    </li>
  );
}

export function formatCount(value: number) {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}m`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return Number(value.toFixed(value >= 10 ? 0 : 1)).toString();
}
