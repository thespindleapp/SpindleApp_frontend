import type { InboxEmail } from './inbox';

const READING_STATUSES = new Set(['QUEUED', 'PROCESSING']);

export type GettingStartedStep = {
  id: string;
  label: string;
  done: boolean;
  available: boolean;
};

export type InboxSurface = 'loading' | 'error' | 'listening' | 'reading' | 'clear' | 'review';

export function isReadingStatus(status: string) {
  return READING_STATUSES.has(status);
}

/** Zero received emails is the listening empty state. A review queue with nothing left is separate. */
export function inboxSurface(input: {
  loading: boolean;
  error: boolean;
  emails: Array<Pick<InboxEmail, 'status'>>;
  reviewCount: number;
}): InboxSurface {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.emails.length === 0) return 'listening';
  if (input.emails.every((email) => isReadingStatus(email.status))) return 'reading';
  if (input.reviewCount === 0) return 'clear';
  return 'review';
}

/**
 * Season, drops, and team are not products yet, so they stay unavailable.
 * Forwarding is done only when mail has actually been received.
 */
export function gettingStartedSteps(hasForwardedEmail: boolean): GettingStartedStep[] {
  return [
    { id: 'season', label: 'Pick your current season', done: false, available: false },
    { id: 'forward', label: 'Forward your first email', done: hasForwardedEmail, available: true },
    { id: 'drops', label: 'Add drops and delivery windows', done: false, available: false },
    { id: 'team', label: 'Invite your team', done: false, available: false },
  ];
}

export function gettingStartedProgress(steps: GettingStartedStep[]) {
  const done = steps.filter((step) => step.done).length;
  return `${done} of ${steps.length}`;
}

export function styleCardIsEmpty(emailCount: number, attachmentCount: number) {
  return emailCount === 0 && attachmentCount === 0;
}

/** Message a supplier can be sent. Requires the workspace's real forwarding address. */
export function supplierForwardMessage(address: string) {
  return [
    'Hi,',
    '',
    `Please copy ${address} on every email about our styles: costs, lab dips, samples, POs and shipping. Put the style number in the subject line where you can.`,
    '',
    'Thank you',
  ].join('\n');
}
