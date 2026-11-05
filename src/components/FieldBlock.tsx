import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  correctionPayload,
  fieldLabel,
  formatFieldValue,
  isActionableConfirmationStatus,
  revisionLabel,
  showResolvedProposalEvidence,
  showStatusTag,
  statusLabel,
} from '../lib/format';
import type { FieldRevision, StyleFieldView } from '../types';

function evidenceText(evidence: unknown) {
  if (!evidence || typeof evidence !== 'object') return null;
  const text = (evidence as { text?: unknown }).text;
  return typeof text === 'string' ? text : null;
}

export function FieldBlock({
  field,
  revisions,
  onChanged,
  compact = false,
}: {
  field: StyleFieldView;
  revisions: FieldRevision[];
  onChanged: () => void;
  compact?: boolean;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evidence = evidenceText(field.evidence);
  const canAct = Boolean(field.confirmationId) && isActionableConfirmationStatus(field.confirmationStatus);
  const needsReview = field.confirmationStatus === 'NEEDS_REVIEW';
  const showEvidence = showResolvedProposalEvidence(field);

  async function run(action: () => Promise<unknown>) {
    if (!field.confirmationId) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      setCorrecting(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setCorrecting(!correcting);
    setDraft(
      formatFieldValue(field.confirmationStatus === 'NEEDS_REVIEW' ? field.confirmedValue : field.proposedValue),
    );
  }

  const editControls = correcting ? (
    <div className={compact ? 'correct-input-box' : 'actions'}>
      <input
        className={compact ? undefined : 'inline-input'}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={`Edit ${field.field}`}
        placeholder="Enter value..."
      />
      <button
        className={compact ? 'btn btn-primary btn-sm' : 'btn btn-accent'}
        type="button"
        disabled={busy || !draft.trim()}
        onClick={() => void run(() => api.confirm(field.confirmationId!, correctionPayload(field.field, draft)))}
      >
        Save edit
      </button>
    </div>
  ) : null;

  if (compact) {
    return (
      <div className="confirm-row">
        <div className="what">
          <b>{fieldLabel(field.field)}</b> —{' '}
          {needsReview ? (
            <>
              {formatFieldValue(field.confirmedValue)} checked →{' '}
              <span className="to">{formatFieldValue(field.proposedValue)} from email</span>
            </>
          ) : (
            <span className="to">From email {formatFieldValue(field.proposedValue ?? field.displayValue)}</span>
          )}
          {showEvidence && (evidence || field.emailId) ? (
            <div className="evidence">
              {evidence ? `"${evidence}"` : ''}
              {field.emailId ? (
                <span>
                  {' · '}
                  <Link to={`/emails/${field.emailId}`}>{field.sourceSubject ?? 'Source email'}</Link>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="confirm-actions">
          {needsReview ? (
            <>
              <button
                className="btn btn-keep"
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.keep(field.confirmationId!))}
              >
                Looks right {formatFieldValue(field.confirmedValue)}
              </button>
              <button
                className="btn btn-accept"
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.confirm(field.confirmationId!, field.proposedValue))}
              >
                Looks right {formatFieldValue(field.proposedValue)}
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={() => void run(() => api.confirm(field.confirmationId!))}
            >
              Looks right
            </button>
          )}

          <button className="btn btn-secondary" type="button" disabled={busy} onClick={startEdit}>
            Edit
          </button>

          {!needsReview ? (
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => void run(() => api.reject(field.confirmationId!))}
            >
              Not right
            </button>
          ) : null}
        </div>

        {editControls}
        {error ? <div className="error">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="sc-row">
      <div className="l">{fieldLabel(field.field)}</div>
      <div>
        {needsReview ? (
          <>
            <div>
              Checked: <strong>{formatFieldValue(field.confirmedValue)}</strong>
            </div>
            <div>
              New from email: <em>{formatFieldValue(field.proposedValue)}</em>
            </div>
          </>
        ) : field.confirmationStatus === 'CONFIRMED' ? (
          <div>
            <strong>{formatFieldValue(field.confirmedValue ?? field.displayValue)}</strong>
          </div>
        ) : field.confirmationStatus === 'REJECTED' ? (
          <div>Dismissed: {formatFieldValue(field.proposedValue)}</div>
        ) : (
          <div>
            From email: <em>{formatFieldValue(field.proposedValue ?? field.displayValue)}</em>
          </div>
        )}

        {showStatusTag(field.confirmationStatus) ? (
          <span
            className={`chip ${
              field.confirmationStatus === 'NEEDS_REVIEW'
                ? 'chip-review'
                : field.confirmationStatus === 'REJECTED'
                  ? 'chip-rejected'
                  : 'chip-proposed'
            }`}
          >
            {statusLabel(field.confirmationStatus)}
          </span>
        ) : null}

        {canAct ? (
          <div className="actions">
            {needsReview ? (
              <>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => api.keep(field.confirmationId!))}
                >
                  Looks right {formatFieldValue(field.confirmedValue)}
                </button>
                <button
                  className="btn btn-accent"
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => api.confirm(field.confirmationId!, field.proposedValue))}
                >
                  Looks right {formatFieldValue(field.proposedValue)}
                </button>
              </>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.confirm(field.confirmationId!))}
              >
                Looks right
              </button>
            )}
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setCorrecting(true);
                setDraft(
                  formatFieldValue(
                    field.confirmationStatus === 'NEEDS_REVIEW' ? field.confirmedValue : field.proposedValue,
                  ),
                );
              }}
            >
              Edit
            </button>
            {!needsReview ? (
              <button
                className="btn btn-ghost"
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.reject(field.confirmationId!))}
              >
                Not right
              </button>
            ) : null}
          </div>
        ) : null}

        {editControls}
        {error ? <div className="error">{error}</div> : null}

        {showEvidence && (evidence || field.emailId) ? (
          <div className="evidence">
            {evidence ? <div>“{evidence}”</div> : null}
            {field.emailId ? (
              <div>
                Source{' '}
                {field.sourceSubject ? (
                  <Link to={`/emails/${field.emailId}`}>{field.sourceSubject}</Link>
                ) : (
                  <Link to={`/emails/${field.emailId}`}>open email</Link>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {revisions.length > 0 ? (
          <div className="evidence">
            {revisions.map((revision) => (
              <div key={revision.id}>
                {formatFieldValue(revision.newValue)} · {revisionLabel(revision)} ·{' '}
                {new Date(revision.createdAt).toLocaleDateString()}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
