import { describe, expect, it } from 'vitest';
import { boardColumnForStyle, stageDots, unresolvedCandidateCards, unresolvedIdentityRows } from './board';
import type { ConfirmationRow, StyleFieldView } from '../types';

function stage(overrides: Partial<StyleFieldView>): StyleFieldView {
  return {
    field: 'stage',
    confirmationId: 'c1',
    emailId: null,
    sourceSubject: null,
    proposedValue: 'PP',
    confirmedValue: null,
    displayValue: 'PP',
    confirmationStatus: 'PROPOSED',
    evidence: null,
    confirmedBy: null,
    confirmedAt: null,
    source: 'PARSER',
    proposedDiffersFromConfirmed: false,
    ...overrides,
  };
}

describe('board column placement', () => {
  it('keeps a proposed stage out of the confirmed columns', () => {
    expect(boardColumnForStyle({ fields: { stage: stage({ confirmationStatus: 'PROPOSED', proposedValue: 'PP' }) } })).toBe(
      'UNCONFIRMED',
    );
  });

  it('marks only the stored stage as current', () => {
    expect(stageDots('PP')).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(stageDots('LAB_DIP')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(stageDots('UNCONFIRMED')).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('places a style by its confirmed stage', () => {
    expect(
      boardColumnForStyle({
        fields: {
          stage: stage({
            confirmationStatus: 'CONFIRMED',
            confirmedValue: 'PP',
            displayValue: 'PP',
            proposedValue: 'BULK',
          }),
        },
      }),
    ).toBe('PP');
  });

  it('keeps a needs-review style in the confirmed stage, not the new proposal', () => {
    expect(
      boardColumnForStyle({
        fields: {
          stage: stage({
            confirmationStatus: 'NEEDS_REVIEW',
            confirmedValue: 'PROTO',
            displayValue: 'PROTO',
            proposedValue: 'BULK',
            proposedDiffersFromConfirmed: true,
          }),
        },
      }),
    ).toBe('PROTO');
  });
});

function confirmation(overrides: Partial<ConfirmationRow>): ConfirmationRow {
  return {
    id: 'conf-1',
    field: 'styleNumber',
    styleId: null,
    emailId: 'email-1',
    status: 'PENDING',
    proposedValue: '3401069',
    confirmedValue: null,
    alternatives: ['3401069'],
    evidence: null,
    source: 'PARSER',
    isCurrent: true,
    confirmedById: null,
    resolvedAt: null,
    email: { id: 'email-1', subject: 'Style 3401069' },
    ...overrides,
  };
}

describe('unresolved identity rows', () => {
  it('keeps a forwarded email visible when no style number was detected', () => {
    const rows = unresolvedIdentityRows([
      confirmation({
        id: 'conf-winter',
        emailId: 'email-winter',
        proposedValue: null,
        email: { id: 'email-winter', subject: 'Fwd: FW: Winter PJs - Nov' },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(unresolvedCandidateCards(rows)).toEqual([]);
  });
});

describe('unresolved candidate cards', () => {
  it('shows a subject style number that has no saved style or brand', () => {
    const cards = unresolvedCandidateCards([confirmation({})]);
    expect(cards.map((row) => row.proposedValue)).toEqual(['3401069']);
  });

  it('hides an email that did not yield a style number', () => {
    expect(
      unresolvedCandidateCards([
        confirmation({ id: 'conf-00032', emailId: 'email-00032', proposedValue: null, email: { id: 'email-00032', subject: 'style test: 00032' } }),
      ]),
    ).toEqual([]);
  });

  it('does not list a style that is already linked', () => {
    expect(unresolvedCandidateCards([confirmation({ styleId: 'style-1' })])).toEqual([]);
  });

  it('keeps one card when the same email is queued twice', () => {
    const cards = unresolvedCandidateCards([
      confirmation({ id: 'conf-a' }),
      confirmation({ id: 'conf-b', field: 'styleAssignment', proposedValue: { styleNumber: '3401069' } }),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.field).toBe('styleNumber');
  });
});
