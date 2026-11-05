import { describe, expect, it } from 'vitest';
import type { ConfirmationRow } from '../types';
import { canStartNewFromEmail, inboxItems, type InboxEmail } from './inbox';

function email(overrides: Partial<InboxEmail> = {}): InboxEmail {
  return {
    id: 'email-1',
    subject: 'Fwd: Winter PJs',
    fromAddress: 'mill@supplier.example',
    fromName: 'Mill',
    receivedAt: '2026-10-23T13:43:00.000Z',
    status: 'NEEDS_CONFIRMATION',
    style: null,
    ...overrides,
  };
}

function confirmation(overrides: Partial<ConfirmationRow> = {}): ConfirmationRow {
  return {
    id: 'conf-1',
    field: 'styleNumber',
    styleId: null,
    emailId: 'email-1',
    status: 'PENDING',
    proposedValue: null,
    confirmedValue: null,
    alternatives: [],
    evidence: null,
    source: 'PARSER',
    isCurrent: true,
    confirmedById: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe('inbox items', () => {
  it('allows New from email only when the email has no style yet', () => {
    expect(canStartNewFromEmail(email())).toBe(true);
    expect(
      canStartNewFromEmail(
        email({ style: { id: 'style-1', styleNumber: '3401069', name: '3401069', listedAt: null } }),
      ),
    ).toBe(false);
  });

  it('keeps a pending proposal and hides a style that is already listed', () => {
    const items = inboxItems(
      [
        email(),
        email({
          id: 'email-listed',
          subject: 'Style 5602341',
          style: { id: 'style-1', styleNumber: '5602341', name: 'Dress', listedAt: '2026-10-01T00:00:00.000Z' },
        }),
      ],
      [confirmation({ reason: 'No style number detected in email or attachments' })],
    );

    expect(items.map((item) => item.email.id)).toEqual(['email-1']);
    expect(items[0]?.pending?.id).toBe('conf-1');
  });

  it('keeps an identity-confirmed style until it is listed', () => {
    const items = inboxItems(
      [
        email({
          style: { id: 'style-2', styleNumber: '3401069', name: '3401069', listedAt: null },
        }),
      ],
      [],
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.pending).toBeNull();
    expect(items[0]?.email.style?.listedAt).toBeNull();
  });

  it('keeps distinct emails that share a subject and collapses a repeated email id', () => {
    const items = inboxItems(
      [
        email({ id: 'email-a', subject: 'Fwd: FW: Winter PJs - Nov' }),
        email({ id: 'email-b', subject: 'Fwd: FW: Winter PJs - Nov' }),
        email({ id: 'email-a', subject: 'Fwd: FW: Winter PJs - Nov' }),
      ],
      [],
    );

    expect(items.map((item) => item.email.id)).toEqual(['email-a', 'email-b']);
  });
});
