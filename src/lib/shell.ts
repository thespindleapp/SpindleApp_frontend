import { groupMail } from './inbox-view';
import type { InboxEmail } from './inbox';
import type { ConfirmationRow, EmailAccount, Workspace } from '../types';

export const TEAM_COUNT_EVENT = 'spindle:team-count';

export function publishTeamCount(count: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<number>(TEAM_COUNT_EVENT, { detail: count }));
}

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

function receivedAt(account: EmailAccount) {
  if (!account.lastSyncAt) return 0;
  const time = new Date(account.lastSyncAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * The inbound address mail is delivered to. A personal address registered beside it
 * is not that mailbox. Never synthesizes a host or local-part.
 */
export function pickForwardingAddress(accounts: EmailAccount[]): string | null {
  const forwards = accounts.filter(
    (account) =>
      account.provider === 'FORWARD' &&
      account.emailAddress.trim() &&
      account.status !== 'DISCONNECTED',
  );
  const received = forwards
    .filter((account) => receivedAt(account) > 0)
    .sort((left, right) => receivedAt(right) - receivedAt(left));
  const preferred =
    received[0] ??
    forwards.find((account) => account.status === 'CONNECTED') ??
    forwards.find((account) => account.status === 'PENDING') ??
    forwards[0];
  return preferred?.emailAddress.trim() ?? null;
}

/**
 * Exceptions among the emails already loaded. The sidebar badge does not use this.
 * The badge, the Needs you tab, and the progress strip read `needsYou` from inbox progress.
 */
export function needsAttentionCount(emails: InboxEmail[], confirmations: ConfirmationRow[]): number {
  return groupMail(emails, confirmations).filter((thread) => thread.exceptions.length > 0).length;
}
