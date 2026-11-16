import { groupMail } from './inbox-view';
import type { InboxEmail } from './inbox';
import type { ConfirmationRow, EmailAccount, Workspace } from '../types';

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

/** Matches the inbox Needs you tab. Confirmations with no email in the inbox do not count. */
export function needsAttentionCount(emails: InboxEmail[], confirmations: ConfirmationRow[]): number {
  return groupMail(emails, confirmations).filter((thread) => thread.exceptions.length > 0).length;
}
