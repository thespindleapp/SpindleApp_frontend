import { describe, expect, it } from 'vitest';
import { isImageAttachment, uniqueAttachmentsFromEmails } from './attachments';
import type { EmailAttachment, StyleEmail } from '../types';

function attachment(overrides: Partial<EmailAttachment>): EmailAttachment {
  return {
    id: 'att-1',
    filename: 'img-waist-position-fit-comment.png',
    mimeType: 'image/png',
    sizeBytes: 208380,
    createdAt: '2026-11-02T20:27:00.465Z',
    ...overrides,
  };
}

function email(overrides: Partial<StyleEmail> = {}): StyleEmail {
  return {
    id: 'email-1',
    subject: 'RE: ST-4821',
    fromAddress: 'factory@example.com',
    fromName: 'Factory',
    bodyText: 'See attached.',
    receivedAt: '2026-11-02T20:27:00.465Z',
    attachments: [],
    ...overrides,
  };
}

describe('uniqueAttachmentsFromEmails', () => {
  it('flattens three files and drops duplicate ids', () => {
    const files = [
      attachment({ id: 'att-1', filename: 'img-waist-position-fit-comment.png' }),
      attachment({ id: 'att-2', filename: 'img-mini-dress-comparison.png', sizeBytes: 429615 }),
      attachment({
        id: 'att-3',
        filename: 'pdf-tiered-mini-dress-RSS-5602341.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3018000,
      }),
    ];
    const result = uniqueAttachmentsFromEmails([
      email({ attachments: files }),
      email({ id: 'email-2', attachments: [files[0]!] }),
    ]);
    expect(result.map((row) => row.filename)).toEqual([
      'img-waist-position-fit-comment.png',
      'img-mini-dress-comparison.png',
      'pdf-tiered-mini-dress-RSS-5602341.pdf',
    ]);
    expect(result).toHaveLength(3);
  });

  it('returns an empty list when emails have no attachments', () => {
    expect(uniqueAttachmentsFromEmails([email()])).toEqual([]);
    expect(uniqueAttachmentsFromEmails([])).toEqual([]);
  });
});

describe('isImageAttachment', () => {
  it('treats PNG as an image and PDF as a document', () => {
    expect(isImageAttachment('image/png')).toBe(true);
    expect(isImageAttachment('application/pdf')).toBe(false);
  });
});
