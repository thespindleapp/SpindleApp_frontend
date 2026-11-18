/** Inbox publishes the latest Needs you total. The sidebar listens and does not reload the mail list. */
export const INBOX_NEEDS_YOU_EVENT = 'spindle:needs-you';

export interface ProgressSlice {
  received: number;
  queued: number;
  processing: number;
  processed: number;
  review: number;
  failed: number;
  ignored: number;
  progress: number;
  active: boolean;
  complete: boolean;
  state: 'empty' | 'processing' | 'completed' | 'completed_with_errors';
}

/** Latest ingestion burst. Counts are that burst only. */
export interface IngestionBatchProgress extends ProgressSlice {
  id: string;
  source: string;
  startedAt: string;
  completedAt: string | null;
}

/** Workspace lifetime totals, plus the latest batch when one exists. */
export interface InboxProgress extends ProgressSlice {
  /** Live emails that need a person. Same number as the inbox tab and the sidebar badge. */
  needsYou: number;
  openDuplicates: number;
  batch?: IngestionBatchProgress | null;
}

export function progressSignature(progress: Pick<ProgressSlice, 'received' | 'queued' | 'processing' | 'processed' | 'review' | 'failed'>): string {
  return [progress.received, progress.queued, progress.processing, progress.processed, progress.review, progress.failed].join(':');
}

/** The strip shows the latest batch. Lifetime totals stay on the parent object. */
export function currentBatch(progress: InboxProgress): ProgressSlice {
  if (progress.batch && progress.batch.received > 0) {
    return progress.batch;
  }
  return progress;
}

export function showsCurrentBatch(progress: InboxProgress): boolean {
  return Boolean(progress.batch && progress.batch.received > 0);
}

/** Changes when the visible batch's counts change, or when a different batch replaces it. */
export function progressWatchKey(progress: InboxProgress): string {
  const current = currentBatch(progress);
  return `${progress.batch?.id ?? 'inbox'}:${progressSignature(current)}:${current.state}:${progress.needsYou}`;
}

export function progressHeadline(progress: ProgressSlice): string {
  const done = Math.max(0, progress.received - progress.queued - progress.processing);
  if (progress.state === 'processing') {
    return `${done} of ${progress.received} settled`;
  }
  if (progress.state === 'completed_with_errors') {
    const noun = progress.failed === 1 ? 'email needs' : 'emails need';
    return `Finished, and ${progress.failed} ${noun} another look`;
  }
  if (progress.state === 'completed' && progress.review > 0) {
    return `Finished. ${progress.review} still need you`;
  }
  if (progress.state === 'completed') {
    return 'Finished';
  }
  return '';
}

export function progressPercent(progress: ProgressSlice): number {
  if (!Number.isFinite(progress.progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress.progress * 100)));
}

export function canRetryEmail(email: {
  status: string;
  issueKind?: string | null;
  duplicateOfEmailId?: string | null;
}): boolean {
  if (email.duplicateOfEmailId) return false;
  if (email.issueKind === 'UNSUPPORTED_FORMAT') return false;
  return (
    email.status === 'FAILED' ||
    email.issueKind === 'PARSE_FAILURE' ||
    email.issueKind === 'TEMPORARY_FAILURE' ||
    email.issueKind === 'REPEATED_FAILURE' ||
    email.issueKind === 'MISSING_ATTACHMENT'
  );
}
