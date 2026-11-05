import type { ConfirmationRow } from '../types';

export interface InboxAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface InboxEmail {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  receivedAt: string;
  status: string;
  bodyText?: string | null;
  threadId?: string | null;
  style: { id: string; styleNumber: string; name: string; listedAt: string | null } | null;
  attachments?: InboxAttachment[];
}

export interface InboxItem {
  email: InboxEmail;
  pending: ConfirmationRow | null;
}

/** Unassigned mail can open New from email. Assigned or listed styles cannot. */
export function canStartNewFromEmail(email: Pick<InboxEmail, 'style'>): boolean {
  return !email.style;
}

/** One review row per email that is not yet on the Range Board. */
export function inboxItems(emails: InboxEmail[], confirmations: ConfirmationRow[]): InboxItem[] {
  const pendingByEmail = new Map<string, ConfirmationRow>();
  for (const row of confirmations) {
    if (!row.emailId || row.styleId) {
      continue;
    }
    if (row.field !== 'styleNumber' && row.field !== 'styleAssignment') {
      continue;
    }
    if (row.status !== 'PENDING' && row.status !== 'UNCONFIRMED') {
      continue;
    }
    const current = pendingByEmail.get(row.emailId);
    if (!current || (row.field === 'styleNumber' && current.field !== 'styleNumber')) {
      pendingByEmail.set(row.emailId, row);
    }
  }

  const seen = new Set<string>();
  const items: InboxItem[] = [];
  for (const email of emails) {
    if (seen.has(email.id) || email.style?.listedAt) {
      continue;
    }
    seen.add(email.id);
    items.push({ email, pending: pendingByEmail.get(email.id) ?? null });
  }
  return items;
}
