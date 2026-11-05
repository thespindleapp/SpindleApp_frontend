import type { ConfirmationRow, StyleDraft } from '../types';
import { isReadingStatus } from './empty';
import type { InboxEmail } from './inbox';

export type InboxException = 'which-style' | 'disagree' | 'could-not-read';

export type InboxFilter = 'all' | 'needs';

export interface MailThread {
  email: InboxEmail;
  copies: InboxEmail[];
  exceptions: InboxException[];
  disagreements: ConfirmationRow[];
  identity: ConfirmationRow | null;
}

const EXCEPTION_ORDER: InboxException[] = ['disagree', 'which-style', 'could-not-read'];

export const EXCEPTION_LABEL: Record<InboxException, string> = {
  disagree: 'Emails disagree',
  'which-style': 'Which style?',
  'could-not-read': 'Could not read',
};

export function inboxWhen(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) {
    return '';
  }
  const delta = now - time;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return 'Just now';
  if (delta < hour) {
    const count = Math.max(1, Math.floor(delta / minute));
    return count === 1 ? '1 minute ago' : `${count} minutes ago`;
  }
  if (delta < day) {
    const count = Math.max(1, Math.floor(delta / hour));
    return count === 1 ? '1 hour ago' : `${count} hours ago`;
  }
  if (delta < 2 * day) return 'Yesterday';
  if (delta < 7 * day) {
    const count = Math.floor(delta / day);
    return `${count} days ago`;
  }
  return new Date(iso).toLocaleDateString();
}

export function inboxSnippet(body: string | null | undefined): string | null {
  if (!body) return null;
  const line = body
    .split('\n')
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

export function styleChip(email: Pick<InboxEmail, 'style'>): string {
  if (!email.style) return 'No style';
  const name = email.style.name.trim();
  if (!name || name === email.style.styleNumber) return email.style.styleNumber;
  return `${email.style.styleNumber} · ${name}`;
}

export function senderLabel(email: Pick<InboxEmail, 'fromName' | 'fromAddress'>): string {
  return email.fromName?.trim() || email.fromAddress;
}

/** Same sender, subject, and body. Missing body is not proof of a copy. */
export function exactCopyKey(email: Pick<InboxEmail, 'subject' | 'fromAddress' | 'bodyText'>): string | null {
  const body = email.bodyText?.replace(/\s+/g, ' ').trim();
  if (!body) return null;
  return `${email.fromAddress.trim().toLowerCase()}\n${email.subject.trim().toLowerCase()}\n${body}`;
}

function receivedTime(email: Pick<InboxEmail, 'receivedAt'>): number {
  const time = new Date(email.receivedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isCurrent(row: ConfirmationRow): boolean {
  return row.isCurrent !== false;
}

function isIdentityPending(row: ConfirmationRow): boolean {
  return (
    isCurrent(row) &&
    !row.styleId &&
    (row.field === 'styleNumber' || row.field === 'styleAssignment') &&
    (row.status === 'PENDING' || row.status === 'UNCONFIRMED')
  );
}

export function draftNeedsStyleChoice(
  draft: Pick<StyleDraft, 'disposition'> | null | undefined,
  emailHasStyle: boolean,
): boolean {
  if (!draft || emailHasStyle) return false;
  return draft.disposition === 'needs_identity' || draft.disposition === 'match' || draft.disposition === 'conflict';
}

function identityFor(emailId: string, confirmations: ConfirmationRow[]): ConfirmationRow | null {
  const rows = confirmations.filter((row) => row.emailId === emailId && isIdentityPending(row));
  return rows.find((row) => row.field === 'styleNumber') ?? rows[0] ?? null;
}

function disagreementsFor(ids: Set<string>, confirmations: ConfirmationRow[]): ConfirmationRow[] {
  return confirmations.filter(
    (row) => row.status === 'NEEDS_REVIEW' && isCurrent(row) && Boolean(row.emailId) && ids.has(row.emailId as string),
  );
}

function exceptionsFor(email: InboxEmail, identity: ConfirmationRow | null, disagreements: ConfirmationRow[]): InboxException[] {
  const kinds: InboxException[] = [];
  if (disagreements.length > 0) kinds.push('disagree');
  const readable = !isReadingStatus(email.status) && email.status !== 'IGNORED';
  if (readable && !email.style && (identity || email.status === 'NEEDS_CONFIRMATION')) {
    kinds.push('which-style');
  }
  if (email.status === 'FAILED') kinds.push('could-not-read');
  return EXCEPTION_ORDER.filter((kind) => kinds.includes(kind));
}

export function groupMail(emails: InboxEmail[], confirmations: ConfirmationRow[]): MailThread[] {
  const ordered = [...emails].sort((left, right) => receivedTime(left) - receivedTime(right) || left.id.localeCompare(right.id));
  const seen = new Set<string>();
  const groups: Array<{ email: InboxEmail; copies: InboxEmail[] }> = [];
  const byKey = new Map<string, { email: InboxEmail; copies: InboxEmail[] }>();

  for (const email of ordered) {
    if (seen.has(email.id)) continue;
    seen.add(email.id);
    const key = exactCopyKey(email);
    const existing = key ? byKey.get(key) : undefined;
    if (existing) {
      existing.copies.push(email);
      continue;
    }
    const group = { email, copies: [] as InboxEmail[] };
    groups.push(group);
    if (key) byKey.set(key, group);
  }

  return groups
    .map((group) => {
      const ids = new Set([group.email.id, ...group.copies.map((copy) => copy.id)]);
      const disagreements = disagreementsFor(ids, confirmations);
      const identity = identityFor(group.email.id, confirmations);
      return {
        email: group.email,
        copies: group.copies,
        disagreements,
        identity,
        exceptions: exceptionsFor(group.email, identity, disagreements),
      };
    })
    .sort((left, right) => receivedTime(right.email) - receivedTime(left.email) || right.email.id.localeCompare(left.email.id));
}

export function applyDraftChoice(thread: MailThread, draft: Pick<StyleDraft, 'disposition'> | null | undefined): MailThread {
  if (!draftNeedsStyleChoice(draft, Boolean(thread.email.style))) return thread;
  if (isReadingStatus(thread.email.status) || thread.email.status === 'FAILED' || thread.email.status === 'IGNORED') {
    return thread;
  }
  if (thread.exceptions.includes('which-style')) return thread;
  const exceptions = EXCEPTION_ORDER.filter((kind) => kind === 'which-style' || thread.exceptions.includes(kind));
  return { ...thread, exceptions };
}

export function visibleThreads(threads: MailThread[], filter: InboxFilter): MailThread[] {
  if (filter === 'needs') return threads.filter((thread) => thread.exceptions.length > 0);
  return threads;
}

export function isTextEntryTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(element.isContentEditable);
}

/** Next or previous exception. Calm rows are skipped. Stays put at either end. */
export function stepException(threads: MailThread[], currentId: string | null, direction: 1 | -1): string | null {
  const ids = threads.filter((thread) => thread.exceptions.length > 0).map((thread) => thread.email.id);
  if (ids.length === 0) return currentId;
  const index = currentId ? ids.indexOf(currentId) : -1;
  if (index === -1) return direction === 1 ? ids[0] : ids[ids.length - 1];
  const next = index + direction;
  if (next < 0 || next >= ids.length) return ids[index];
  return ids[next];
}
