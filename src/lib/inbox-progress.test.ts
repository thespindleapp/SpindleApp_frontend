import { describe, expect, it } from 'vitest';
import {
  canRetryEmail,
  currentBatch,
  progressHeadline,
  progressPercent,
  progressSignature,
  progressWatchKey,
  type IngestionBatchProgress,
  type InboxProgress,
} from './inbox-progress';

function progress(overrides: Partial<InboxProgress> = {}): InboxProgress {
  return {
    received: 1000,
    queued: 200,
    processing: 10,
    processed: 700,
    review: 80,
    failed: 10,
    ignored: 0,
    progress: 0.79,
    active: true,
    complete: false,
    state: 'processing',
    needsYou: 12,
    openDuplicates: 2,
    batch: null,
    ...overrides,
  };
}

function batch(overrides: Partial<IngestionBatchProgress> = {}): IngestionBatchProgress {
  return {
    id: 'batch-1',
    source: 'webhook',
    startedAt: '2026-11-16T00:00:00.000Z',
    completedAt: null,
    received: 40,
    queued: 10,
    processing: 5,
    processed: 20,
    review: 4,
    failed: 1,
    ignored: 0,
    progress: 0.625,
    active: true,
    complete: false,
    state: 'processing',
    ...overrides,
  };
}

describe('inbox progress', () => {
  it('describes a large batch without treating review mail as filed', () => {
    const snapshot = progress();
    expect(progressHeadline(snapshot)).toBe('790 of 1000 settled');
    expect(progressPercent(snapshot)).toBe(79);
    expect(progressSignature(snapshot)).toBe('1000:200:10:700:80:10');
  });

  it('keeps a finished batch with failures distinct from a clean finish', () => {
    expect(progressHeadline(progress({
      queued: 0,
      processing: 0,
      processed: 990,
      review: 0,
      failed: 10,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed_with_errors',
    }))).toBe('Finished, and 10 emails need another look');
    expect(progressHeadline(progress({
      received: 4,
      queued: 0,
      processing: 0,
      processed: 4,
      review: 0,
      failed: 0,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed',
    }))).toBe('Finished');
  });

  it('shows an active batch instead of the inbox totals', () => {
    const snapshot = progress({
      received: 1200,
      queued: 0,
      processing: 0,
      processed: 1100,
      review: 90,
      failed: 10,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed_with_errors',
      batch: batch(),
    });
    const current = currentBatch(snapshot);
    expect(current.received).toBe(40);
    expect(current.queued).toBe(10);
    expect(current.processing).toBe(5);
    expect(current.processed).toBe(20);
    expect(current.review).toBe(4);
    expect(current.failed).toBe(1);
    expect(progressHeadline(current)).toBe('25 of 40 settled');
    expect(progressHeadline(snapshot)).toBe('Finished, and 10 emails need another look');
    expect(snapshot.received).toBe(1200);
  });

  it('keeps a settled batch outcome distinct from older inbox failures', () => {
    const current = currentBatch(progress({
      received: 1200,
      queued: 0,
      processing: 0,
      processed: 1100,
      review: 90,
      failed: 10,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed_with_errors',
      batch: batch({
        id: 'batch-done',
        received: 8,
        queued: 0,
        processing: 0,
        processed: 6,
        review: 2,
        failed: 0,
        progress: 1,
        active: false,
        complete: true,
        state: 'completed',
        completedAt: '2026-11-16T00:05:00.000Z',
      }),
    }));
    expect(progressHeadline(current)).toBe('Finished. 2 still need you');
    expect(current.failed).toBe(0);
    expect(current.review).toBe(2);
  });

  it('changes the watch key when a new batch starts after an idle inbox', () => {
    const idle = progress({
      queued: 0,
      processing: 0,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed',
      batch: batch({
        id: 'batch-idle',
        received: 8,
        queued: 0,
        processing: 0,
        processed: 8,
        review: 0,
        failed: 0,
        progress: 1,
        active: false,
        complete: true,
        state: 'completed',
        completedAt: '2026-11-16T00:05:00.000Z',
      }),
    });
    const started = progress({
      batch: batch({ id: 'batch-next', received: 3, queued: 3, processing: 0, processed: 0, review: 0, failed: 0, progress: 0 }),
    });
    expect(progressWatchKey(started)).not.toBe(progressWatchKey(idle));
    expect(progressWatchKey(idle)).toBe(progressWatchKey({ ...idle }));
    expect(progressWatchKey({ ...idle, needsYou: idle.needsYou + 1 })).not.toBe(progressWatchKey(idle));
  });

  it('retries failed mail and leaves confirmed duplicates and unsupported files alone', () => {
    expect(canRetryEmail({ status: 'FAILED', issueKind: 'REPEATED_FAILURE' })).toBe(true);
    expect(canRetryEmail({ status: 'FAILED', issueKind: 'UNSUPPORTED_FORMAT' })).toBe(false);
    expect(canRetryEmail({ status: 'FAILED', duplicateOfEmailId: 'email-original' })).toBe(false);
  });
});