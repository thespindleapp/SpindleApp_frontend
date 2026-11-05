import type { ConfirmationRow, StyleCard } from '../types';

export const STAGE_COLUMNS = ['LAB_DIP', 'PROTO', 'SMS', 'PP', 'BULK', 'SHIP'] as const;

export type StageDotState = 'done' | 'current' | 'upcoming';

/**
 * Dots follow the one stored stage. Earlier stages are drawn complete, the stored stage is current,
 * and later stages are upcoming. A proposal does not move the marker.
 */
export function stageDots(current: (typeof STAGE_COLUMNS)[number] | 'UNCONFIRMED'): StageDotState[] {
  const index = current === 'UNCONFIRMED' ? -1 : STAGE_COLUMNS.indexOf(current);
  return STAGE_COLUMNS.map((_, position) => {
    if (index < 0 || position > index) return 'upcoming';
    if (position === index) return 'current';
    return 'done';
  });
}

/** Column placement uses a confirmed stage only. A parser proposal never selects a column. */
export function boardColumnForStyle(style: Pick<StyleCard, 'fields'>): (typeof STAGE_COLUMNS)[number] | 'UNCONFIRMED' {
  const field = style.fields.stage;
  const trusted =
    field && (field.confirmationStatus === 'CONFIRMED' || field.confirmationStatus === 'NEEDS_REVIEW')
      ? (field.confirmedValue ?? field.displayValue)
      : null;
  if (typeof trusted === 'string' && (STAGE_COLUMNS as readonly string[]).includes(trusted)) {
    return trusted as (typeof STAGE_COLUMNS)[number];
  }
  return 'UNCONFIRMED';
}

/** Style number proposed on an unresolved confirmation. Null when the email did not yield one. */
export function candidateStyleNumber(row: Pick<ConfirmationRow, 'proposedValue'>): string | null {
  const value = row.proposedValue;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === 'object') {
    const styleNumber = (value as { styleNumber?: unknown }).styleNumber;
    if (typeof styleNumber === 'string' && styleNumber.trim()) {
      return styleNumber.trim();
    }
  }
  return null;
}

/** Identity rows the board can show before a style number is known. */
export function unresolvedIdentityRows(rows: ConfirmationRow[]): ConfirmationRow[] {
  return rows.filter((row) => (row.field === 'styleNumber' || row.field === 'styleAssignment') && !row.styleId);
}

/**
 * One candidate card per email. A linked style is not listed again.
 * Rows without a detected style number stay out of the board table.
 */
export function unresolvedCandidateCards(rows: ConfirmationRow[]): ConfirmationRow[] {
  const byEmail = new Map<string, ConfirmationRow>();
  for (const row of rows) {
    if (row.styleId || !candidateStyleNumber(row)) {
      continue;
    }
    if (row.field !== 'styleNumber' && row.field !== 'styleAssignment') {
      continue;
    }
    const key = row.emailId ?? row.id;
    const current = byEmail.get(key);
    if (!current || (row.field === 'styleNumber' && current.field !== 'styleNumber')) {
      byEmail.set(key, row);
    }
  }
  return [...byEmail.values()];
}
