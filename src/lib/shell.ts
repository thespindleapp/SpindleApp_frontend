import { inboxItems, type InboxEmail } from './inbox';
import type { ConfirmationRow, EmailAccount, Workspace } from '../types';

const OUTSTANDING = new Set(['PENDING', 'UNCONFIRMED', 'NEEDS_REVIEW', 'PROPOSED']);
const IDENTITY_FIELDS = new Set(['styleNumber', 'styleAssignment']);

export function roleLabel(role: string) {
  const known: Record<string, string> = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MEMBER: 'Member',
  };
  return (
    known[role] ??
    role
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

export function initials(firstName: string, lastName: string, fallback: string) {
  const pair = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
  if (pair.trim()) {
    return pair;
  }
  return fallback.trim().charAt(0).toUpperCase() || '';
}

export function workspaceForSession(workspaces: Workspace[], workspaceId: string | null) {
  if (workspaceId) {
    const matched = workspaces.find((item) => item.id === workspaceId);
    if (matched) {
      return matched;
    }
  }
  return workspaces[0] ?? null;
}

/** First registered forwarding address. Never synthesizes a host or local-part. */
export function pickForwardingAddress(accounts: EmailAccount[]): string | null {
  const forwards = accounts.filter(
    (account) =>
      account.provider === 'FORWARD' &&
      account.emailAddress.trim() &&
      account.status !== 'DISCONNECTED',
  );
  const preferred =
    forwards.find((account) => account.status === 'CONNECTED') ??
    forwards.find((account) => account.status === 'PENDING') ??
    forwards[0];
  return preferred?.emailAddress.trim() ?? null;
}

export function needsAttentionCount(emails: InboxEmail[], confirmations: ConfirmationRow[]): number {
  const inbox = inboxItems(emails, confirmations).length;
  const fieldChecks = confirmations.filter((row) => {
    if (row.isCurrent === false) {
      return false;
    }
    if (!OUTSTANDING.has(row.status)) {
      return false;
    }
    if (IDENTITY_FIELDS.has(row.field)) {
      return false;
    }
    return true;
  }).length;
  return inbox + fieldChecks;
}
