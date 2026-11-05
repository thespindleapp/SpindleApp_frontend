import type { StyleFieldView } from '../types';

export const TIMELINE_STAGES = ['LAB_DIP', 'PROTO', 'SMS', 'PP', 'BULK', 'SHIP'] as const;
export type TimelineStage = (typeof TIMELINE_STAGES)[number];

export type StageTimelineState = 'approved' | 'mentioned' | 'proposed' | 'not_recorded';

const STAGE_ALIASES: Record<TimelineStage, string[]> = {
  LAB_DIP: ['lab dip', 'lab-dip', 'labdip'],
  PROTO: ['proto sample', 'proto', 'fit sample'],
  SMS: ['strike-off', 'strike off', 'sms'],
  PP: ['pp sample', 'pre-production', 'preproduction', 'pp'],
  BULK: ['bulk production', 'bulk'],
  SHIP: ['ex-factory', 'shipped', 'shipment'],
};

const APPROVAL_VERB = '(approved|approval|completed|complete|checked|cleared|signed off|passed)';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasPattern(alias: string) {
  return new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
}

function collectTexts(sources: Array<string | null | undefined>) {
  return sources.filter((text): text is string => typeof text === 'string' && text.trim().length > 0);
}

export function evidenceSnippet(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== 'object') return null;
  const text = (evidence as { text?: unknown }).text;
  return typeof text === 'string' ? text : null;
}

function explicitApprovalSnippet(text: string, alias: string) {
  const escaped = escapeRegExp(alias);
  const patterns = [
    new RegExp(`\\b${escaped}\\b(?:\\s+sample)?\\s+(?:was\\s+|is\\s+|has been\\s+|now\\s+)?${APPROVAL_VERB}\\b`, 'i'),
    new RegExp(`\\b${APPROVAL_VERB}\\s+(?:the\\s+|for\\s+)?\\b${escaped}\\b`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const start = Math.max(0, match.index - 12);
      const end = Math.min(text.length, match.index + match[0].length + 12);
      return text.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

/** True only when the source text pairs this stage with explicit approval/completion language. */
export function findExplicitStageApproval(stage: TimelineStage, texts: Array<string | null | undefined>) {
  const aliases = [...STAGE_ALIASES[stage]].sort((a, b) => b.length - a.length);
  for (const text of collectTexts(texts)) {
    for (const alias of aliases) {
      const snippet = explicitApprovalSnippet(text, alias);
      if (snippet) return snippet;
    }
  }
  return null;
}

export function stageIsMentioned(stage: TimelineStage, texts: Array<string | null | undefined>) {
  const aliases = [...STAGE_ALIASES[stage]].sort((a, b) => b.length - a.length);
  return collectTexts(texts).some((text) => aliases.some((alias) => aliasPattern(alias).test(text)));
}

export function stageTimelineEntry(
  stage: TimelineStage,
  options: {
    stageField?: StyleFieldView;
    texts?: Array<string | null | undefined>;
  },
): { state: StageTimelineState; evidence: string | null } {
  const texts = options.texts ?? [];
  const explicit = findExplicitStageApproval(stage, [...texts, evidenceSnippet(options.stageField?.evidence)]);
  if (explicit) {
    return { state: 'approved', evidence: explicit };
  }

  const proposed = options.stageField?.proposedValue;
  const confirmed = options.stageField?.confirmedValue;
  if (proposed === stage || confirmed === stage) {
    if (options.stageField?.confirmationStatus === 'PROPOSED' || options.stageField?.confirmationStatus === 'UNCONFIRMED') {
      return { state: 'proposed', evidence: evidenceSnippet(options.stageField.evidence) };
    }
    if (stageIsMentioned(stage, [...texts, evidenceSnippet(options.stageField?.evidence)])) {
      return { state: 'mentioned', evidence: evidenceSnippet(options.stageField?.evidence) };
    }
    return { state: 'mentioned', evidence: evidenceSnippet(options.stageField?.evidence) };
  }

  if (stageIsMentioned(stage, [...texts, evidenceSnippet(options.stageField?.evidence)])) {
    return { state: 'mentioned', evidence: evidenceSnippet(options.stageField?.evidence) };
  }

  return { state: 'not_recorded', evidence: null };
}

export function stageTimelineLabel(state: StageTimelineState) {
  if (state === 'approved') return 'Recorded complete';
  if (state === 'proposed' || state === 'mentioned') return 'From email, check';
  return 'Not recorded';
}
