import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { AttachmentGrid } from '../components/AttachmentGrid';
import type { EmailDetail } from '../types';

export function EmailDetailPage() {
  const { emailId } = useParams();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!emailId) return;
    void api
      .getEmail(emailId)
      .then(setEmail)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load email'));
  }, [emailId]);

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
          {!email.styleId ? (
            <Link className="btn btn-primary" to={`/emails/${email.id}/new`}>
              New from email
            </Link>
          ) : null}
          <Link className="btn btn-secondary" to={email.styleId ? `/styles/${email.styleId}` : '/inbox'}>
            {email.styleId ? 'Open style card' : 'Back to inbox'}
          </Link>
        </div>
      </div>
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
        </div>
        <AttachmentGrid
          attachments={(email.attachments ?? []).map((attachment) => ({ ...attachment, emailId: email.id }))}
          emptyMessage="No attachments."
        />
      </section>
    </div>
  );
}
