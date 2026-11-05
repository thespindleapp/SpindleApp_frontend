import { describe, expect, it } from 'vitest';
import { correctionPayload, formatMoneyAmount, hasOutstandingProposal, headlineFact, presentStyleName, revisionLabel, showResolvedProposalEvidence, statusLabel, styleTitle } from './format';
import { findExplicitStageApproval, stageTimelineEntry, stageTimelineLabel } from './stage-timeline';

describe('revision labels', () => {
  it('labels an unchanged check as looks right', () => {
    expect(
      revisionLabel({ kind: 'CONFIRMATION', source: 'USER', previousValue: 480, newValue: 480 }),
    ).toBe('Looks right');
  });

  it('labels a changed check as edited', () => {
    expect(
      revisionLabel({ kind: 'CONFIRMATION', source: 'USER', previousValue: 480, newValue: 800 }),
    ).toBe('Edited');
  });
});

describe('style title', () => {
  it('uses the garment name instead of the style number', () => {
    expect(presentStyleName('FRUITY KAFTAN', '3401069', { text: '#3401069 – Fruity Kaftan' })).toBe('Fruity Kaftan');
    expect(
      styleTitle({
        styleNumber: '3401069',
        name: '3401069',
        fields: {
          name: {
            proposedValue: 'FRUITY KAFTAN',
            confirmationStatus: 'PROPOSED',
            evidence: { text: '#3401069 – Fruity Kaftan' },
          },
        },
      }),
    ).toBe('Fruity Kaftan');
  });

  it('keeps a style-number fallback when no name was found', () => {
    expect(styleTitle({ styleNumber: '3401069', name: '3401069' })).toBe('Style 3401069');
  });
});

describe('headline facts', () => {
  it('does not present a proposed quantity as a trusted headline value', () => {
    expect(
      headlineFact({
        confirmationStatus: 'PROPOSED',
        proposedValue: 600,
        confirmedValue: null,
        displayValue: 600,
      }),
    ).toBe('From email, check');
  });

  it('presents a checked quantity as the headline value', () => {
    expect(
      headlineFact({
        confirmationStatus: 'CONFIRMED',
        proposedValue: 600,
        confirmedValue: 600,
        displayValue: 600,
      }),
    ).toBe('600');
  });

  it('does not present a pending cost as a trusted monetary headline', () => {
    expect(
      headlineFact(
        {
          confirmationStatus: 'PROPOSED',
          proposedValue: 19.25,
          confirmedValue: null,
          displayValue: 19.25,
        },
        { money: true, currency: { confirmationStatus: 'PROPOSED', confirmedValue: 'GBP', displayValue: 'GBP' } },
      ),
    ).toBe('From email, check');
  });

  it('formats checked costs from confirmed currency and omits a symbol when currency is not stated', () => {
    const cost = {
      confirmationStatus: 'CONFIRMED' as const,
      proposedValue: 19.25,
      confirmedValue: 19.25,
      displayValue: 19.25,
    };
    expect(
      headlineFact(cost, {
        money: true,
        currency: { confirmationStatus: 'CONFIRMED', confirmedValue: 'GBP', displayValue: 'GBP' },
      }),
    ).toBe('£19.25');
    expect(
      headlineFact(cost, {
        money: true,
        currency: { confirmationStatus: 'CONFIRMED', confirmedValue: 'USD', displayValue: 'USD' },
      }),
    ).toBe('$19.25');
    expect(
      headlineFact(cost, {
        money: true,
        currency: { confirmationStatus: 'CONFIRMED', confirmedValue: 'EUR', displayValue: 'EUR' },
      }),
    ).toBe('€19.25');
    expect(
      headlineFact(cost, {
        money: true,
        currency: { confirmationStatus: 'CONFIRMED', confirmedValue: 'INR', displayValue: 'INR' },
      }),
    ).toBe('₹19.25');
    expect(
      headlineFact(cost, {
        money: true,
        currency: { confirmationStatus: 'NOT_STATED', confirmedValue: null, displayValue: 'USD' },
      }),
    ).toBe('19.25');
    expect(formatMoneyAmount(19.25, { confirmationStatus: 'NOT_STATED', displayValue: 'USD' })).toBe('19.25');
  });
});

describe('status labels', () => {
  it('uses checking language instead of formal confirmation', () => {
    expect(statusLabel('PROPOSED')).toBe('From email, check');
    expect(statusLabel('NEEDS_REVIEW')).toBe('From email, check');
    expect(statusLabel('REJECTED')).toBe('Dismissed');
    expect(statusLabel('CONFIRMED')).toBe('');
  });
});

describe('outstanding proposal presentation', () => {
  it('does not treat a leftover parser value on a confirmed field as outstanding', () => {
    expect(
      hasOutstandingProposal({
        confirmationStatus: 'CONFIRMED',
        proposedValue: 1200,
        confirmedValue: 800,
      }),
    ).toBe(false);
    expect(
      showResolvedProposalEvidence({
        confirmationStatus: 'CONFIRMED',
        proposedValue: 1200,
        confirmedValue: 800,
      }),
    ).toBe(false);
  });

  it('keeps a needs-review contradiction outstanding until resolved', () => {
    expect(
      hasOutstandingProposal({
        confirmationStatus: 'NEEDS_REVIEW',
        proposedValue: 1200,
        confirmedValue: 800,
      }),
    ).toBe(true);
  });
});

describe('correction payload', () => {
  it('sends quantity as a number', () => {
    expect(correctionPayload('quantity', '800')).toBe(800);
    expect(correctionPayload('costFob', '19.50')).toBe(19.5);
  });
});

describe('stage timeline', () => {
  it('treats a mentioned stage without approval language as not recorded complete', () => {
    expect(findExplicitStageApproval('PP', ['Currently at PP sample, qty 600'])).toBeNull();
    expect(
      stageTimelineEntry('LAB_DIP', {
        stageField: {
          field: 'stage',
          confirmationId: 'c1',
          emailId: 'e1',
          sourceSubject: 'Re: Style REAL-TEST-001',
          proposedValue: 'PP',
          confirmedValue: null,
          displayValue: 'PP',
          confirmationStatus: 'PROPOSED',
          evidence: { text: 'Currently at PP sample' },
          confirmedBy: null,
          confirmedAt: null,
          source: 'PARSER',
          proposedDiffersFromConfirmed: false,
        },
        texts: ['Currently at PP sample'],
      }).state,
    ).toBe('not_recorded');
    expect(stageTimelineLabel('not_recorded')).toBe('Not recorded');
  });

  it('marks a stage complete only with explicit approval evidence', () => {
    expect(findExplicitStageApproval('PP', ['PP sample approved 4 Jan, please proceed'])).toContain('PP');
    expect(
      stageTimelineEntry('PP', {
        texts: ['PP sample approved 4 Jan, please proceed'],
      }).state,
    ).toBe('approved');
  });
});
