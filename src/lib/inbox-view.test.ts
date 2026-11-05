import { describe, expect, it } from 'vitest';
import type { ConfirmationRow, StyleDraft } from '../types';
import type { InboxEmail } from './inbox';
import {
  applyDraftChoice,
  draftNeedsStyleChoice,
  exactCopyKey,
  groupMail,
  isTextEntryTarget,
  stepException,
  visibleThreads,
} from './inbox-view';

function email(overrides: Partial<InboxEmail> = {}): InboxEmail {
  return {
    id: 'email-1',
    subject: 'Re: HS-5512 shipping',
    fromAddress: 'iris@hollis.example',
    fromName: 'Iris',
    receivedAt: '2026-10-20T09:00:00.000Z',
    status: 'PARSED',
    bodyText: 'Ex-factory is now 14 Feb.',
    style: { id: 'style-1', styleNumber: 'HS-5512', name: 'Sun dress', listedAt: '2026-10-01T00:00:00.000Z' },
    ...overrides,
  };
}

function confirmation(overrides: Partial<ConfirmationRow> = {}): ConfirmationRow {
  return {
    id: 'conf-1',
    field: 'deliveryDate',
    styleId: 'style-1',
    emailId: 'email-1',
    status: 'NEEDS_REVIEW',
    proposedValue: '14 Feb',
    confirmedValue: '7 Feb',
    alternatives: [],
    evidence: null,
    source: 'PARSER',
    isCurrent: true,
    confirmedById: null,
    resolvedAt: null,
    ...overrides,
  };
}

function draft(disposition: StyleDraft['disposition']): Pick<StyleDraft, 'disposition'> {
  return { disposition };
}

describe('inbox mail view', () => {
  it('keeps ordinary pending fields out of Needs you', () => {
    const threads = groupMail(
      [
        email({ id: 'filed', subject: 'Cost update' }),
        email({
          id: 'open',
          subject: 'Lab dips',
          status: 'NEEDS_CONFIRMATION',
          style: null,
          receivedAt: '2026-10-21T09:00:00.000Z',
        }),
      ],
      [
        confirmation({
          id: 'qty',
          emailId: 'filed',
          field: 'quantity',
          status: 'PENDING',
          proposedValue: 860,
          confirmedValue: null,
        }),
        confirmation({
          id: 'identity',
          emailId: 'open',
          field: 'styleNumber',
          styleId: null,
          status: 'PENDING',
          proposedValue: 'LD-2',
          confirmedValue: null,
        }),
      ],
    );

    expect(visibleThreads(threads, 'needs').map((thread) => thread.email.id)).toEqual(['open']);
    expect(visibleThreads(threads, 'all')).toHaveLength(2);
    expect(threads.find((thread) => thread.email.id === 'open')?.exceptions).toEqual(['which-style']);
  });

  it('marks a contradictory proposal as Emails disagree and leaves the checked value in place', () => {
    const threads = groupMail([email()], [confirmation()]);
    const thread = threads[0];
    expect(thread?.exceptions).toEqual(['disagree']);
    expect(thread?.disagreements[0]?.confirmedValue).toBe('7 Feb');
    expect(thread?.disagreements[0]?.proposedValue).toBe('14 Feb');
  });

  it('folds an exact later copy onto the original and keeps both records', () => {
    const original = email({ id: 'original', receivedAt: '2026-10-20T09:00:00.000Z' });
    const copy = email({
      id: 'copy',
      fromName: 'Sam',
      receivedAt: '2026-10-22T09:00:00.000Z',
      status: 'NEEDS_CONFIRMATION',
      style: null,
    });
    const different = email({
      id: 'different',
      bodyText: 'Ex-factory is now 21 Feb.',
      receivedAt: '2026-10-23T09:00:00.000Z',
    });

    expect(exactCopyKey(original)).toBe(exactCopyKey(copy));
    expect(exactCopyKey(different)).not.toBe(exactCopyKey(original));

    const threads = groupMail([copy, original, different], []);
    expect(threads.map((thread) => thread.email.id)).toEqual(['different', 'original']);
    const folded = threads.find((thread) => thread.email.id === 'original');
    expect(folded?.copies.map((item) => item.id)).toEqual(['copy']);
    expect(folded?.exceptions).toEqual([]);
    expect(visibleThreads(threads, 'needs').map((thread) => thread.email.id)).toEqual([]);
  });

  it('does not treat a shared subject without a body as a copy', () => {
    const threads = groupMail(
      [
        email({ id: 'a', bodyText: null, subject: 'Fwd: Winter PJs' }),
        email({ id: 'b', bodyText: null, subject: 'Fwd: Winter PJs', receivedAt: '2026-10-21T09:00:00.000Z' }),
      ],
      [],
    );
    expect(threads.map((thread) => thread.email.id)).toEqual(['b', 'a']);
  });

  it('uses a style draft only as a which-style exception, never as a create', () => {
    const open = groupMail([email({ id: 'open', style: null, status: 'PARSED' })], [])[0]!;
    expect(draftNeedsStyleChoice(draft('create'), false)).toBe(false);
    expect(draftNeedsStyleChoice(draft('needs_identity'), false)).toBe(true);
    expect(draftNeedsStyleChoice(draft('match'), true)).toBe(false);
    expect(applyDraftChoice(open, draft('needs_identity')).exceptions).toEqual(['which-style']);
    expect(applyDraftChoice(open, draft('conflict')).exceptions).toEqual(['which-style']);
    expect(applyDraftChoice(open, draft('create')).exceptions).toEqual([]);
  });

  it('moves J and K through exceptions and ignores text fields', () => {
    const threads = groupMail(
      [
        email({ id: 'calm', subject: 'Shipped', receivedAt: '2026-10-23T09:00:00.000Z' }),
        email({ id: 'style', subject: 'Lab dips', status: 'NEEDS_CONFIRMATION', style: null, receivedAt: '2026-10-22T09:00:00.000Z' }),
        email({ id: 'failed', subject: 'Scan', status: 'FAILED', style: null, receivedAt: '2026-10-21T09:00:00.000Z' }),
      ],
      [],
    );
    expect(stepException(threads, 'calm', 1)).toBe('style');
    expect(stepException(threads, 'style', 1)).toBe('failed');
    expect(stepException(threads, 'failed', 1)).toBe('failed');
    expect(stepException(threads, 'style', -1)).toBe('style');
    expect(isTextEntryTarget({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'BUTTON', isContentEditable: false })).toBe(false);
  });
});
