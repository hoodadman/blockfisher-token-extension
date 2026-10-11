/** Saved 2026-10-03: original light triangle. In App.tsx, import ScoreTriangle from this file to restore. */
import { useState } from 'react';
import { toneFor, type ScoreTone } from '../scoring';
import './ScoreTriangle.classic.css';

export interface PillarScore {
  id: 'security' | 'community' | 'foundation';
  label: string;
  score: number | null;
}

interface ScoreTriangleProps {
  overall: number | null;
  pillars: readonly PillarScore[];
}

const CX = 180;
const CY = 168;
const TIP = 128;
const INNER = 62;
const SPREAD = 34;

function polar(radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function points(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  return `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`;
}

const ANGLES: Record<PillarScore['id'], number> = {
  security: 0,
  community: 120,
  foundation: 240,
};

export function ScoreTriangle({ overall, pillars }: ScoreTriangleProps) {
  const [hover, setHover] = useState<string | null>(null);
  const tone = toneFor(overall);

  return (
    <section className={`tri tri--${tone}`} aria-label="Overall token score">
      <svg className="tri__svg" viewBox="0 0 360 340" role="presentation">
        {pillars.map((pillar) => {
          const angle = ANGLES[pillar.id];
          const tip = polar(TIP, angle);
          const left = polar(INNER, angle - SPREAD);
          const right = polar(INNER, angle + SPREAD);
          const mid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
          const fill = (pillar.score ?? 0) / 100;
          const fillTip = { x: mid.x + (tip.x - mid.x) * fill, y: mid.y + (tip.y - mid.y) * fill };
          const label = polar(TIP + 22, angle);
          const petalTone = toneFor(pillar.score);
          const active = hover === pillar.id;

          return (
            <g
              key={pillar.id}
              className={`tri-petal tri-petal--${petalTone}`}
              data-active={active || undefined}
              tabIndex={0}
              role="img"
              aria-label={
                pillar.score === null
                  ? `${pillar.label}: no score yet`
                  : `${pillar.label}: ${pillar.score} out of 100`
              }
              onPointerEnter={(event) => event.pointerType === 'mouse' && setHover(pillar.id)}
              onPointerLeave={(event) => event.pointerType === 'mouse' && setHover((value) => (value === pillar.id ? null : value))}
              onFocus={() => setHover(pillar.id)}
              onBlur={() => setHover((value) => (value === pillar.id ? null : value))}
            >
              <polygon className="tri-petal__track" points={points(tip, left, right)} />
              {pillar.score !== null && pillar.score > 0 && (
                <polygon className="tri-petal__fill" points={points(fillTip, left, right)} />
              )}
              <text className="tri-petal__label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                {pillar.label}
              </text>
            </g>
          );
        })}
        <circle className="tri__ring-track" cx={CX} cy={CY} r="50" />
        <circle className="tri__core" cx={CX} cy={CY} r="46" />
      </svg>

      <div className="tri__score" aria-hidden={overall !== null ? undefined : true}>
        {overall === null ? (
          <>
            <span className="tri__number">?</span>
            <span className="tri__max">no score</span>
          </>
        ) : (
          <>
            <span className="tri__number">{overall}</span>
            <span className="tri__max">out of 100</span>
          </>
        )}
      </div>

      {pillars.map((pillar) => {
        if (hover !== pillar.id) return null;
        const angle = ANGLES[pillar.id];
        const spot = polar((INNER + TIP) / 2, angle);
        return (
          <p
            key={`${pillar.id}-hover`}
            className="tri__hover"
            style={{ left: `${(spot.x / 360) * 100}%`, top: `${(spot.y / 340) * 100}%` }}
          >
            {pillar.score === null ? 'No score yet' : `${pillar.score} / 100`}
          </p>
        );
      })}
    </section>
  );
}

export type { ScoreTone };
