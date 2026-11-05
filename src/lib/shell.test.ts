import { describe, expect, it } from 'vitest';
import type { ConfirmationRow, EmailAccount } from '../types';
import type { InboxEmail } from './inbox';
import { needsAttentionCount, pickForwardingAddress, workspaceForSession } from './shell';

function account(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: 'acc-1',
    workspaceId: 'ws-1',
    userId: 'user-1',
    provider: 'FORWARD',
    emailAddress: 'inbox@mill.example',
    displayName: null,
    status: 'CONNECTED',
    watchScope: {},
    lastSyncAt: null,
    lastError: null,
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    ...overrides,
  };
}

function confirmation(overrides: Partial<ConfirmationRow> = {}): ConfirmationRow {
  return {
    id: 'c1',
    field: 'quantity',
    styleId: 'style-1',
    emailId: 'email-1',
    status: 'PENDING',
    proposedValue: 600,
    confirmedValue: null,
    alternatives: null,
    evidence: null,
    source: 'PARSER',
    isCurrent: true,
    confirmedById: null,
    resolvedAt: null,
    ...overrides,
  };
}

function email(overrides: Partial<InboxEmail> = {}): InboxEmail {
  return {
    id: 'email-1',
    subject: 'Re: HS-5512',
    fromAddress: 'iris@hollis.example',
    fromName: 'Iris',
    receivedAt: '2026-10-22T12:00:00.000Z',
    status: 'RECEIVED',
    style: null,
    ...overrides,
  };
}

describe('pickForwardingAddress', () => {
  it('returns a registered forwarding address and does not invent one', () => {
    expect(pickForwardingAddress([])).toBeNull();
    expect(
      pickForwardingAddress([
        account({ provider: 'GMAIL', emailAddress: 'team@gmail.com' }),
        account({ status: 'DISCONNECTED', emailAddress: 'old@mill.example' }),
        account({ status: 'PENDING', emailAddress: 'pending@mill.example' }),
        account({ status: 'CONNECTED', emailAddress: 'live@mill.example' }),
      ]),
    ).toBe('live@mill.example');
    expect(pickForwardingAddress([account({ status: 'PENDING', emailAddress: 'pending@mill.example' })])).toBe(
      'pending@mill.example',
    );
    expect(pickForwardingAddress([account({ emailAddress: '  ' })])).toBeNull();
  });
});

describe('workspaceForSession', () => {
  it('prefers the session workspace over the first listed workspace', () => {
    const workspaces = [
      { id: 'ws-other', name: 'Other', slug: 'other', role: 'MEMBER' },
      { id: 'ws-1', name: 'Hollis & Row', slug: 'hollis', role: 'OWNER' },
    ];
    expect(workspaceForSession(workspaces, 'ws-1')?.name).toBe('Hollis & Row');
    expect(workspaceForSession(workspaces, null)?.name).toBe('Other');
  });
});

describe('needsAttentionCount', () => {
  it('counts unlisted inbox mail and outstanding field checks once', () => {
    expect(needsAttentionCount([], [])).toBe(0);
    expect(
      needsAttentionCount([email()], [confirmation({ field: 'styleNumber', styleId: null, status: 'PENDING' })]),
    ).toBe(1);
    expect(
      needsAttentionCount(
        [email({ style: { id: 'style-1', styleNumber: 'HS-5512', name: 'Sun', listedAt: '2026-10-01' } })],
        [
          confirmation({ field: 'quantity', status: 'PENDING' }),
          confirmation({ id: 'c2', field: 'costFob', status: 'NEEDS_REVIEW' }),
          confirmation({ id: 'c3', field: 'name', status: 'PROPOSED' }),
          confirmation({ id: 'c4', field: 'delivery', status: 'CONFIRMED' }),
          confirmation({ id: 'c5', field: 'stage', status: 'PENDING', isCurrent: false }),
        ],
      ),
    ).toBe(3);
  });
});
