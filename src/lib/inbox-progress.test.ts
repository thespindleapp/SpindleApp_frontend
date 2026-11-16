import { describe, expect, it } from 'vitest';
import { canRetryEmail, progressHeadline, progressPercent, progressSignature } from './inbox-progress';
import type { InboxProgress } from './inbox-progress';

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
    openDuplicates: 2,
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

  it('retries failed mail and leaves confirmed duplicates and unsupported files alone', () => {
    expect(canRetryEmail({ status: 'FAILED', issueKind: 'REPEATED_FAILURE' })).toBe(true);
    expect(canRetryEmail({ status: 'FAILED', issueKind: 'UNSUPPORTED_FORMAT' })).toBe(false);
    expect(canRetryEmail({ status: 'FAILED', duplicateOfEmailId: 'email-original' })).toBe(false);
  });
});