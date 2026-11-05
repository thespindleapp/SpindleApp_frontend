import { describe, expect, it } from 'vitest';
import {
  gettingStartedProgress,
  gettingStartedSteps,
  inboxSurface,
  isReadingStatus,
  styleCardIsEmpty,
  supplierForwardMessage,
} from './empty';

describe('inbox empty surfaces', () => {
  it('listens only when no email has been received', () => {
    expect(inboxSurface({ loading: true, error: false, emails: [], reviewCount: 0 })).toBe('loading');
    expect(inboxSurface({ loading: false, error: true, emails: [], reviewCount: 0 })).toBe('error');
    expect(inboxSurface({ loading: false, error: false, emails: [], reviewCount: 0 })).toBe('listening');
  });

  it('shows reading for the first email still being processed, then a review or clear inbox', () => {
    expect(isReadingStatus('QUEUED')).toBe(true);
    expect(isReadingStatus('PROCESSING')).toBe(true);
    expect(isReadingStatus('NEEDS_CONFIRMATION')).toBe(false);

    expect(
      inboxSurface({
        loading: false,
        error: false,
        emails: [{ status: 'QUEUED' }],
        reviewCount: 1,
      }),
    ).toBe('reading');
    expect(
      inboxSurface({
        loading: false,
        error: false,
        emails: [{ status: 'NEEDS_CONFIRMATION' }],
        reviewCount: 1,
      }),
    ).toBe('review');
    expect(
      inboxSurface({
        loading: false,
        error: false,
        emails: [{ status: 'PARSED' }],
        reviewCount: 0,
      }),
    ).toBe('clear');
  });
});

describe('range getting started', () => {
  it('does not mark season, drops, or team done, and checks forwarding only after mail exists', () => {
    const before = gettingStartedSteps(false);
    expect(gettingStartedProgress(before)).toBe('0 of 4');
    expect(before.find((step) => step.id === 'season')).toMatchObject({ done: false, available: false });
    expect(before.find((step) => step.id === 'forward')).toMatchObject({ done: false, available: true });

    const after = gettingStartedSteps(true);
    expect(gettingStartedProgress(after)).toBe('1 of 4');
    expect(after.find((step) => step.id === 'forward')?.done).toBe(true);
    expect(after.find((step) => step.id === 'team')?.done).toBe(false);
  });
});

describe('style card empty', () => {
  it('is empty only with no emails and no attachments', () => {
    expect(styleCardIsEmpty(0, 0)).toBe(true);
    expect(styleCardIsEmpty(1, 0)).toBe(false);
    expect(styleCardIsEmpty(0, 2)).toBe(false);
  });
});

describe('supplier forward message', () => {
  it('uses the given address and does not invent one', () => {
    const message = supplierForwardMessage('hello@studio.resend.app');
    expect(message).toContain('hello@studio.resend.app');
    expect(message).not.toContain('in.spindle.app');
    expect(message).not.toContain('Sam');
  });
});
