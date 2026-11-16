import type { EmailAttachment, StyleEmail } from '../types';

export interface LinkedAttachment extends EmailAttachment {
  emailId: string | null;
}

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 10;

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'csv',
  'xls',
  'xlsx',
  'doc',
  'docx',
]);

export const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.xls,.xlsx,.doc,.docx';

export function validateAttachmentFiles(files: File[]): string | null {
  if (files.length === 0) return 'Choose a file to upload';
  if (files.length > MAX_ATTACHMENT_COUNT) return `Upload up to ${MAX_ATTACHMENT_COUNT} files at a time`;
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return `${file.name} is not an allowed file type`;
    }
    if (file.size <= 0) return `${file.name} is empty`;
    if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is larger than 20 MB`;
  }
  return null;
}

export function mergeAttachments(...groups: LinkedAttachment[][]): LinkedAttachment[] {
  const seen = new Map<string, LinkedAttachment>();
  for (const group of groups) {
    for (const attachment of group) {
      const current = seen.get(attachment.id);
      if (!current || (!current.emailId && attachment.emailId)) {
        seen.set(attachment.id, attachment);
      }
    }
  }
  return [...seen.values()];
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
