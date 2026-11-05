import { describe, expect, it } from 'vitest';
import type { StyleCard, StyleFieldView } from '../types';
import { displayFact, formatOrderTotal, historyEntries, lineOrderValue, orderTotals, outstandingChecks, statusBadge } from './range';

function field(overrides: Partial<StyleFieldView> = {}): StyleFieldView {
  return {
    field: 'quantity',
    confirmationId: 'conf-1',
    emailId: null,
    sourceSubject: null,
    proposedValue: 10,
    confirmedValue: 10,
    displayValue: 10,
    confirmationStatus: 'CONFIRMED',
    evidence: null,
    confirmedBy: null,
    confirmedAt: null,
    source: 'USER',
    proposedDiffersFromConfirmed: false,
    ...overrides,
  };
}

function style(overrides: Partial<StyleCard> = {}): StyleCard {
  return {
    id: 'style-1',
    styleNumber: 'HS-1',
    name: 'Dress',
    quantity: null,
    costFob: null,
    stage: null,
    status: null,
    fields: {},
    needsConfirmationCount: 0,
    ...overrides,
  };
}

describe('range order totals', () => {
  it('groups confirmed GBP and USD separately and drops unstated currency', () => {
    const gbp = style({
      id: 'gbp',
      fields: {
        quantity: field({ field: 'quantity', proposedValue: 2, confirmedValue: 2, displayValue: 2 }),
        costFob: field({ field: 'costFob', proposedValue: 10, confirmedValue: 10, displayValue: 10 }),
        currency: field({ field: 'currency', proposedValue: 'GBP', confirmedValue: 'GBP', displayValue: 'GBP' }),
      },
    });
    const usd = style({
      id: 'usd',
      styleNumber: 'HS-2',
      fields: {
        quantity: field({ field: 'quantity', proposedValue: 4, confirmedValue: 4, displayValue: 4 }),
        costFob: field({ field: 'costFob', proposedValue: 5, confirmedValue: 5, displayValue: 5 }),
        currency: field({ field: 'currency', proposedValue: 'USD', confirmedValue: 'USD', displayValue: 'USD' }),
      },
    });
    const bare = style({
      id: 'bare',
      styleNumber: 'HS-3',
      fields: {
        quantity: field({ field: 'quantity', proposedValue: 100, confirmedValue: 100, displayValue: 100 }),
        costFob: field({ field: 'costFob', proposedValue: 99, confirmedValue: 99, displayValue: 99 }),
        currency: field({
          field: 'currency',
          proposedValue: 'USD',
          confirmedValue: null,
          displayValue: 'USD',
          confirmationStatus: 'NOT_STATED',
        }),
      },
    });
    const proposed = style({
      id: 'proposed',
      styleNumber: 'HS-4',
      fields: {
        quantity: field({
          field: 'quantity',
          confirmationStatus: 'PROPOSED',
          proposedValue: 8,
          confirmedValue: null,
          displayValue: 8,
        }),
        costFob: field({
          field: 'costFob',
          confirmationStatus: 'PROPOSED',
          proposedValue: 50,
          confirmedValue: null,
          displayValue: 50,
        }),
        currency: field({ field: 'currency', proposedValue: 'GBP', confirmedValue: 'GBP', displayValue: 'GBP' }),
      },
    });

    const totals = orderTotals([gbp, usd, bare, proposed]);
    expect(totals).toEqual([
      { currency: 'GBP', total: 20 },
      { currency: 'USD', total: 20 },
    ]);
    expect(totals.map(formatOrderTotal)).toEqual(['£20', '$20']);
    expect(formatOrderTotal(totals[0]!).includes('$')).toBe(false);
    expect(lineOrderValue(bare)).toBeNull();
    expect(lineOrderValue(proposed)).toBeNull();
    expect(lineOrderValue(gbp)).toBe('£20');
  });

  it('hides a total when nothing has a confirmed currency', () => {
    expect(orderTotals([style()])).toEqual([]);
  });
});

describe('unchecked range values', () => {
  it('shows a proposed amount as unchecked and a checked amount as checked', () => {
    expect(
      displayFact(
        field({
          field: 'costFob',
          confirmationStatus: 'PROPOSED',
          proposedValue: 12.51,
          confirmedValue: null,
          displayValue: 12.51,
        }),
        {
          money: true,
          currency: field({ field: 'currency', confirmationStatus: 'NOT_STATED', confirmedValue: null, displayValue: 'USD' }),
        },
      ),
    ).toEqual({ text: '12.51', unchecked: true });

    expect(
      displayFact(field({ confirmationStatus: 'CONFIRMED', proposedValue: 12, confirmedValue: 12, displayValue: 12 })),
    ).toEqual({ text: '12', unchecked: false });
  });

  it('lists outstanding confirmations and skips fields with nothing to check', () => {
    const checks = outstandingChecks([
      style({
        fields: {
          quantity: field({
            confirmationId: 'qty',
            confirmationStatus: 'PROPOSED',
            proposedValue: 20,
            confirmedValue: null,
            displayValue: 20,
          }),
          stage: field({ field: 'stage', confirmationId: null, confirmationStatus: 'NOT_STATED', proposedValue: null, confirmedValue: null, displayValue: null }),
          styleAssignment: field({
            field: 'styleAssignment',
            confirmationId: 'assign',
            confirmationStatus: 'PROPOSED',
            proposedValue: 'HS-1',
            confirmedValue: null,
            displayValue: 'HS-1',
          }),
        },
      }),
    ]);
    expect(checks.map((check) => check.field.confirmationId)).toEqual(['qty']);
  });
});

describe('range history', () => {
  it('uses recorded revisions only, newest first', () => {
    const entries = historyEntries([
      style({
        styleNumber: 'HS-1',
        fieldRevisions: [
          {
            id: 'old',
            field: 'quantity',
            previousValue: null,
            newValue: 10,
            source: 'USER',
            kind: 'CONFIRMATION',
            actorId: null,
            confirmationId: null,
            sourceEmailId: null,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
          {
            id: 'new',
            field: 'costFob',
            previousValue: 9,
            newValue: 10,
            source: 'USER',
            kind: 'CONFIRMATION',
            actorId: null,
            confirmationId: null,
            sourceEmailId: null,
            createdAt: '2026-10-02T00:00:00.000Z',
          },
        ],
      }),
      style({ styleNumber: 'HS-2' }),
    ]);
    expect(entries.map((entry) => entry.id)).toEqual(['new', 'old']);
    expect(entries[0]?.label).toBe('Edited');
    expect(entries[1]?.styleNumber).toBe('HS-1');
  });
});

describe('status badges', () => {
  it('uses the recorded words and does not invent a status', () => {
    expect(statusBadge('Blocked')).toEqual({ label: 'Blocked', tone: 'blocked' });
    expect(statusBadge('on_track')).toEqual({ label: 'On track', tone: 'track' });
    expect(statusBadge('Waiting on supplier')).toEqual({ label: 'Waiting on supplier', tone: 'waiting' });
    expect(statusBadge('In sampling')).toEqual({ label: 'In sampling', tone: 'neutral' });
    expect(statusBadge('—')).toBeNull();
    expect(statusBadge('')).toBeNull();
  });
});
