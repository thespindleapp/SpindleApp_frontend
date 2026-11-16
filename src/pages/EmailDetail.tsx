import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { AttachmentGrid, AttachmentUpload } from '../components/AttachmentGrid';
import { canRetryEmail } from '../lib/inbox-progress';
import type { EmailDetail } from '../types';

export function EmailDetailPage() {
  const { emailId } = useParams();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  function load(id: string) {
    return api
      .getEmail(id)
      .then(setEmail)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load email'));
  }

  useEffect(() => {
    if (!emailId) return;
    void load(emailId);
  }, [emailId]);

  async function retry() {
    if (!emailId) return;
    setRetrying(true);
    setNotice(null);
    setError(null);
    try {
      await api.reprocessEmail(emailId);
      setNotice('Queued to be read again.');
      await load(emailId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not retry this email');
    } finally {
      setRetrying(false);
    }
  }

  async function uploadFiles(files: File[]) {
    if (!emailId) return;
    setError(null);
    await api.uploadEmailAttachments(emailId, files);
    await load(emailId);
  }

  if (!email) {
    return (
      <div className="page">
        {error ? <div className="error">{error}</div> : <p className="muted">Loading email…</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Source email</div>
          <h1>{email.subject}</h1>
        </div>
        <div>
          <Link className="btn btn-secondary" to={email.styleId ? `/styles/${email.styleId}` : '/inbox'}>
            {email.styleId ? 'Open style card' : 'Back to inbox'}
          </Link>
        </div>
      </div>
      {notice ? <p className="muted">{notice}</p> : null}
      {error ? <div className="error">{error}</div> : null}
      {email.issueReason || email.duplicateVerdict || canRetryEmail(email) ? (
        <section className="panel">
          <div className="panel-head">
            <span>{email.status === 'FAILED' ? 'Could not read' : email.duplicateVerdict === 'CONFIRMED' ? 'Confirmed duplicate' : 'Needs a look'}</span>
          </div>
          {email.issueReason ? <p>{email.issueReason}</p> : null}
          {email.duplicateOfEmailId ? (
            <p>
              <Link to={`/emails/${email.duplicateOfEmailId}`}>Open the original email</Link>
            </p>
          ) : null}
          {email.redeliveryCount ? <p>Received again {email.redeliveryCount} {email.redeliveryCount === 1 ? 'time' : 'times'}.</p> : null}
          {canRetryEmail(email) ? (
            <button className="btn btn-secondary" type="button" disabled={retrying} onClick={() => void retry()}>
              {retrying ? 'Queuing…' : 'Try again'}
            </button>
          ) : null}
        </section>
      ) : null}
      <section className="panel">
        <div className="panel-head">
          <span>{email.fromName || email.fromAddress}</span>
          <span>{new Date(email.receivedAt).toLocaleString()}</span>
        </div>
        <div className="email-body">{email.bodyText || 'No text body.'}</div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <span>Attachments</span>
          <AttachmentUpload onFiles={uploadFiles} />
        </div>
        <AttachmentGrid
          attachments={(email.attachments ?? []).map((attachment) => ({ ...attachment, emailId: email.id }))}
          emptyMessage="No attachments."
        />
      </section>
    </div>
  );
}
