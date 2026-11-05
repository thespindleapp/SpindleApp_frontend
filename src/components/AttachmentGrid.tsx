import { useEffect, useRef, useState } from 'react';
import { canPreviewInline, fileExtension, formatFileSize, isImageAttachment } from '../lib/attachments';
import { api } from '../api';
import type { EmailAttachment } from '../types';

export type GridAttachment = EmailAttachment & { emailId: string };

interface AttachmentGridProps {
  attachments: GridAttachment[];
  emptyMessage: string;
}

export function AttachmentGrid({ attachments, emptyMessage }: AttachmentGridProps) {
  const [openError, setOpenError] = useState<string | null>(null);

  if (attachments.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <>
      {openError ? <div className="error">{openError}</div> : null}
      <div className="attach-grid">
        {attachments.map((attachment) => (
          <AttachmentCard
            key={attachment.id}
            attachment={attachment}
            onOpenError={setOpenError}
          />
        ))}
      </div>
    </>
  );
}

function AttachmentCard({
  attachment,
  onOpenError,
}: {
  attachment: GridAttachment;
  onOpenError: (message: string | null) => void;
}) {
  const isImage = isImageAttachment(attachment.mimeType);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbStatus, setThumbStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(isImage ? 'loading' : 'idle');
  const blobRef = useRef<Blob | null>(null);
  const thumbUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isImageAttachment(attachment.mimeType)) {
      return undefined;
    }

    setThumbStatus('loading');
    void api
      .getAttachmentBlob(attachment.emailId, attachment.id)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        thumbUrlRef.current = url;
        setThumbUrl(url);
        setThumbStatus('ready');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setThumbStatus('error');
      });

    return () => {
      cancelled = true;
      if (thumbUrlRef.current) {
        URL.revokeObjectURL(thumbUrlRef.current);
        thumbUrlRef.current = null;
      }
      blobRef.current = null;
      setThumbUrl(null);
    };
  }, [attachment.emailId, attachment.id, attachment.mimeType]);

  async function open() {
    onOpenError(null);
    try {
      if (thumbUrl && isImage) {
        window.open(thumbUrl, '_blank', 'noopener');
        return;
      }
      const blob = await api.getAttachmentBlob(attachment.emailId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.rel = 'noopener';
      if (canPreviewInline(blob.type || attachment.mimeType)) {
        link.target = '_blank';
      } else {
        link.download = attachment.filename;
      }
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      onOpenError(err instanceof Error ? err.message : 'Unable to open attachment');
    }
  }

  const ext = fileExtension(attachment.filename, attachment.mimeType);

  return (
    <button type="button" className="attach" onClick={() => void open()} aria-label={`Open ${attachment.filename}`}>
      <div
        className={`preview${thumbStatus === 'loading' ? ' is-loading' : ''}${thumbStatus === 'error' ? ' is-error' : ''}${thumbUrl ? ' has-thumb' : ''}`}
      >
        <span className="ext">{ext}</span>
        {thumbUrl ? (
          <img src={thumbUrl} alt={attachment.filename} />
        ) : thumbStatus === 'loading' ? (
          <span className="preview-status">Loading</span>
        ) : thumbStatus === 'error' ? (
          <span className="preview-status">Preview unavailable</span>
        ) : (
          <span className="preview-status">{ext}</span>
        )}
      </div>
      <div className="info">
        <div className="name">{attachment.filename}</div>
        <div className="meta">
          <span>{formatFileSize(attachment.sizeBytes)}</span>
        </div>
      </div>
    </button>
  );
}
