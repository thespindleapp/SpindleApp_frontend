export interface InboxProgress {
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
  openDuplicates: number;
}

export function progressSignature(progress: Pick<InboxProgress, 'received' | 'queued' | 'processing' | 'processed' | 'review' | 'failed'>): string {
  return [progress.received, progress.queued, progress.processing, progress.processed, progress.review, progress.failed].join(':');
}

export function progressHeadline(progress: InboxProgress): string {
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

export function progressPercent(progress: InboxProgress): number {
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
