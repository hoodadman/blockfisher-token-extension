import type { PillarBrief, SummaryFacts } from './types';

function named(facts: SummaryFacts) {
  return facts.name ?? 'This token';
}

function scoreWords(score: number | null, good: string, ok: string, poor: string, none: string) {
  if (score === null) return none;
  if (score >= 90) return good;
  if (score >= 60) return ok;
  return poor;
}

export function localBrief(facts: SummaryFacts): PillarBrief {
  const token = named(facts);
  const warnings = facts.security.groups.filter((group) => group.status === 'issue');
  const security = scoreWords(
    facts.security.score,
    `${token} passed the safety checks we could run. That is a good sign, not a promise.`,
    warnings.length
      ? `${warnings[0].summary} The rest of the safety checks we could run looked ordinary.`
      : `${token} has no serious traps in the checks we ran, but it is not a clean bill of health.`,
    warnings.length
      ? `${warnings[0].summary} Treat this as high risk until that is explained.`
      : `We found enough gaps in the safety checks that this is hard to trust.`,
    `We could not run enough safety checks to judge ${token}.`,
  );

  const community = facts.community.handle
    ? scoreWords(
        facts.community.score,
        `Lots of people are talking on the official page (@${facts.community.handle}). That suggests a real audience, but talk can be faked.`,
        `There is some conversation on @${facts.community.handle}, but it is not a very busy page.`,
        `The official page is quiet. A thin crowd makes it easier for a few people to set the mood.`,
        `We could not read recent talk on the official page.`,
      )
    : 'We did not find an official page, so we cannot tell if a real community is behind this.';

  const funding = facts.foundation.facts.find((fact) => fact.label === 'Funding' && fact.status === 'good');
  const weak = facts.foundation.facts.find((fact) => fact.status === 'bad')
    ?? facts.foundation.facts.find((fact) => fact.label === 'Funding' && fact.status === 'unknown');
  const foundation = scoreWords(
    facts.foundation.score,
    funding
      ? `${funding.summary} That kind of backing is a stronger sign than most new tokens, not a guarantee.`
      : `${token} has been around a while and has a public write-up or a named backer. That is more established than most new tokens, not a guarantee.`,
    weak
      ? `${weak.summary} The rest of the public record is mixed.`
      : `${token} looks partly established — some history, but not a full public paper trail.`,
    weak
      ? `${weak.summary} That makes it harder to judge who stands behind it.`
      : `${token} has little public history to judge it by.`,
    `We could not tell how established ${token} is.`,
  );

  return { security, community, foundation };
}
