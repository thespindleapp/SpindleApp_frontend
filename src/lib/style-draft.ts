import { FIELD_ORDER, fieldLabel, formatFieldValue } from './format';
import type { StyleDraft, StyleDraftField, StyleDraftMatch } from '../types';

export const PROPOSAL_FIELD_KEYS = FIELD_ORDER.filter(
  (field) => field !== 'styleNumber' && field !== 'styleAssignment' && field !== 'name',
);

const NUMERIC_FIELDS = new Set(['quantity', 'costFob']);

export function evidenceText(evidence: unknown): string | null {
  if (typeof evidence === 'string' && evidence.trim()) {
    return evidence.trim();
  }
  if (evidence && typeof evidence === 'object' && !Array.isArray(evidence) && 'text' in evidence) {
    const text = (evidence as { text?: unknown }).text;
    if (typeof text === 'string' && text.trim()) {
      return text.trim();
    }
  }
  return null;
}

export function confidenceLabel(confidence: number | null | undefined): string | null {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return null;
  }
  return `${Math.round(confidence * 100)}% confidence`;
}

export function initialProposalValues(fields: Record<string, StyleDraftField>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of PROPOSAL_FIELD_KEYS) {
    const field = fields[key];
    if (!field || field.value == null || field.value === '') {
      continue;
    }
    values[key] = formatFieldValue(field.value);
  }
  return values;
}

export function proposalPayload(values: Record<string, string>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '—') {
      continue;
    }
    if (NUMERIC_FIELDS.has(key)) {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      fields[key] = key === 'quantity' ? Math.round(parsed) : parsed;
      continue;
    }
    fields[key] = trimmed;
  }
  return fields;
}

export function matchKindLabel(kind: StyleDraftMatch['kind']): string {
  if (kind === 'exact') {
    return 'Exact style number';
  }
  if (kind === 'case-insensitive') {
    return 'Same style number, different capitalisation';
  }
  return 'Unique style name';
}

export function draftAllowsCreate(draft: Pick<StyleDraft, 'disposition'>): boolean {
  return draft.disposition === 'create' || draft.disposition === 'needs_identity';
}

export function proposalRows(fields: Record<string, StyleDraftField>) {
  return PROPOSAL_FIELD_KEYS.filter((key) => fields[key] && fields[key]?.value != null && fields[key]?.value !== '').map(
    (key) => ({
      key,
      label: fieldLabel(key),
      field: fields[key]!,
    }),
  );
}
