import type { EmailAttachment, StyleEmail } from '../types';

export interface LinkedAttachment extends EmailAttachment {
  emailId: string;
}

export function uniqueAttachmentsFromEmails(emails: StyleEmail[]): LinkedAttachment[] {
  const seen = new Map<string, LinkedAttachment>();
  for (const email of emails) {
    for (const attachment of email.attachments ?? []) {
      if (!seen.has(attachment.id)) {
        seen.set(attachment.id, { ...attachment, emailId: email.id });
      }
    }
  }
  return [...seen.values()];
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(filename: string, mimeType?: string): string {
  const fromName = filename.split('.').pop();
  if (fromName && fromName !== filename) {
    return fromName.toUpperCase();
  }
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }
  if (mimeType?.startsWith('image/')) {
    return mimeType.slice('image/'.length).toUpperCase();
  }
  return 'FILE';
}

export function isImageAttachment(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function canPreviewInline(mimeType: string): boolean {
  return isImageAttachment(mimeType) || mimeType === 'application/pdf';
}
