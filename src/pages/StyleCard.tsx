import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { FieldBlock } from '../components/FieldBlock';
import { STAGE_COLUMNS, boardColumnForStyle } from '../lib/board';
import { styleCardIsEmpty } from '../lib/empty';
import { pickForwardingAddress } from '../lib/shell';
import {
  fieldLabel,
  formatFieldValue,
  headlineFact,
  styleTitle,
  isActionableConfirmationStatus,
  revisionLabel,
  showStatusTag,
  statusLabel,
} from '../lib/format';
import { evidenceSnippet, stageTimelineEntry, stageTimelineLabel } from '../lib/stage-timeline';
import { AttachmentGrid } from '../components/AttachmentGrid';
import { uniqueAttachmentsFromEmails } from '../lib/attachments';
import type { ConfirmAllResult, FieldRevision, StyleCard, StyleEmail, StyleFieldView } from '../types';

const STAGE_NAME: Record<string, string> = {
  LAB_DIP: 'Lab Dip',
  PROTO: 'Proto',
  SMS: 'SMS',
  PP: 'PP',
  BULK: 'Bulk',
  SHIP: 'Ship',
};

const PRODUCTION_FIELDS = ['fabric', 'color', 'season', 'factoryName', 'inspectionType'];
const COMMERCIAL_FIELDS = ['quantity', 'costFob', 'currency', 'deliveryDate', 'status'];

function emailPreview(bodyText: string | null) {
  if (!bodyText) return '';
  return bodyText.replace(/\s+/g, ' ').trim().slice(0, 140);
}

export function StyleCardPage() {
  const { styleId } = useParams();
  const [style, setStyle] = useState<StyleCard | null>(null);
  const [emails, setEmails] = useState<StyleEmail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState(false);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [emailsLoaded, setEmailsLoaded] = useState(false);
  const [emailsFailed, setEmailsFailed] = useState(false);
  const [forwardAddress, setForwardAddress] = useState<string | null | undefined>(undefined);
  const [addressCopied, setAddressCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  async function load() {
    if (!styleId) return;
    const next = await api.getStyle(styleId);
    setStyle(next);
    try {
      const linkedEmails = await api.listEmails({ styleId, limit: 50 });
      setEmails(linkedEmails);
      setEmailsFailed(false);
    } catch {
      setEmails([]);
      setEmailsFailed(true);
    } finally {
      setEmailsLoaded(true);
    }
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load style'));
  }, [styleId]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  async function copyForwardingAddress() {
    if (!forwardAddress || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(forwardAddress);
      setAddressCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setAddressCopied(false), 1600);
    } catch {
      setAddressCopied(false);
    }
  }

  const historyByField = useMemo(() => {
    const map = new Map<string, FieldRevision[]>();
    for (const revision of style?.fieldRevisions ?? []) {
      const list = map.get(revision.field) ?? [];
      list.push(revision);
      map.set(revision.field, list);
    }
    return map;
  }, [style]);

  const attachments = useMemo(() => uniqueAttachmentsFromEmails(emails), [emails]);
  const cardEmpty = emailsLoaded && !emailsFailed && styleCardIsEmpty(emails.length, attachments.length);

  useEffect(() => {
    if (!cardEmpty) return;
    let cancelled = false;
    void api
      .listEmailAccounts()
      .then((accounts) => {
        if (!cancelled) setForwardAddress(pickForwardingAddress(accounts));
      })
      .catch(() => {
        if (!cancelled) setForwardAddress(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [cardEmpty]);

  const pendingFields = useMemo(() => {
    if (!style) return [];
    const list: StyleFieldView[] = [];
    for (const key of Object.keys(style.fields)) {
      const fieldView = style.fields[key];
      if (fieldView && fieldView.confirmationId && isActionableConfirmationStatus(fieldView.confirmationStatus)) {
        list.push(fieldView);
      }
    }
    return list;
  }, [style]);

  async function addToBoard() {
    if (!style) return;
    setListing(true);
    setError(null);
    try {
      const next = await api.listStyleOnBoard(style.id);
      setStyle(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add this style to the Range Board');
    } finally {
      setListing(false);
    }
  }

  async function checkAll() {
    if (!style) return;
    setBusy(true);
    setFlash(null);
    try {
      const result: ConfirmAllResult = await api.confirmAll({ styleId: style.id });
      const skipped = result.skipped.map((row) => `${row.field} (${row.reason})`).join(', ');
      setFlash(
        `Marked ${result.confirmedCount} as looking right. Skipped ${result.skippedCount}${skipped ? `: ${skipped}` : ''}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Looks right for all failed');
    } finally {
      setBusy(false);
    }
  }

  if (!style) {
    return (
      <div className="page">
        {error ? <div className="error">{error}</div> : <p className="muted">Loading style card…</p>}
      </div>
    );
  }

  const checkedStage = boardColumnForStyle(style);
  const quantityField = style.fields.quantity;
  const costField = style.fields.costFob;
  const colorField = style.fields.color;
  const deliveryField = style.fields.deliveryDate;
  const stageField = style.fields.stage;

  const timelineTexts = [
    ...emails.map((email) => email.bodyText),
    ...emails.map((email) => email.subject),
    ...Object.values(style.fields).map((field) => evidenceSnippet(field.evidence)),
  ];

  const checkedStageLabel = STAGE_NAME[checkedStage] ?? (checkedStage === 'UNCONFIRMED' ? 'not recorded' : checkedStage);

  function detailValue(fieldView: StyleFieldView) {
    if (fieldView.confirmationStatus === 'REJECTED') return '—';
    if (fieldView.confirmationStatus === 'CONFIRMED' || fieldView.confirmationStatus === 'NEEDS_REVIEW') {
      return formatFieldValue(fieldView.confirmedValue ?? fieldView.displayValue);
    }
    return formatFieldValue(fieldView.proposedValue ?? fieldView.displayValue);
  }

  return (
    <div className="page">
      <div className="wrap">
        <div className="head-main">
          <div className="style-image" title="Hero style photo placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M9 5 L7 3 L5 5 L3 7 L3 19 L21 19 L21 7 L19 5 L17 3 L15 5 Z" />
              <path d="M9 5 Q12 8 15 5" />
            </svg>
            <div className="lbl">No photo yet</div>
          </div>

          <div className="head-fields">
            <div className="crumb">{style.brand?.name ?? 'Studio'}</div>
            <div className="head-row">
              <div className="card-head">
                <h1>{styleTitle(style)}</h1>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Link className="btn btn-secondary" to="/">
                  ← Board
                </Link>
                {style.listedAt === null ? (
                  <button className="btn btn-primary" type="button" disabled={listing} onClick={() => void addToBoard()}>
                    Add to Range Board
                  </button>
                ) : null}
                <button
                  className="btn btn-accent"
                  type="button"
                  disabled={busy || pendingFields.length === 0}
                  onClick={() => void checkAll()}
                >
                  Looks right for all
                </button>
                {pendingFields.length > 0 ? (
                  <a className="jump-review" href="#toConfirmSec">
                    <span className="dot" />
                    {pendingFields.length} to check
                  </a>
                ) : null}
              </div>
            </div>

            <div className="facts-row">
              <div className="fact">
                <div className="l">Style #</div>
                <div className="v">{style.styleNumber}</div>
              </div>
              <div className="fact">
                <div className="l">Quantity</div>
                <div className="v">
                  {headlineFact(quantityField)}
                  {quantityField?.confirmationStatus === 'NEEDS_REVIEW' ? (
                    <small>{formatFieldValue(quantityField.proposedValue)} from email</small>
                  ) : null}
                </div>
              </div>
              <div className="fact">
                <div className="l">Cost (FOB)</div>
                <div className="v">{headlineFact(costField, { money: true, currency: style.fields.currency })}</div>
              </div>
              <div className="fact">
                <div className="l">Colour</div>
                <div className="v">{headlineFact(colorField)}</div>
              </div>
              <div className="fact">
                <div className="l">Delivery</div>
                <div className="v">{headlineFact(deliveryField)}</div>
              </div>
            </div>
          </div>
        </div>

        {flash ? <div className="flash">{flash}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="sec-head">
          <span className="ttl">
            Approval timeline <em>6 stages · currently {checkedStageLabel}</em>
          </span>
        </div>
        <div className="timeline-steps">
          {STAGE_COLUMNS.map((stg) => {
            const entry = stageTimelineEntry(stg, { stageField, texts: timelineTexts });
            const stepClass = entry.state === 'approved' ? 'done' : entry.state === 'not_recorded' ? 'unrecorded' : 'mentioned';
            return (
              <div key={stg} className={`tl-step ${stepClass}`} title={entry.evidence ?? stageTimelineLabel(entry.state)}>
                <div className="mark">{entry.state === 'approved' ? '✓' : ''}</div>
                <div className="name">{STAGE_NAME[stg] ?? stg}</div>
                <div className="note">{stageTimelineLabel(entry.state)}</div>
                {entry.state === 'approved' && (entry.evidence || stageField?.emailId) ? (
                  <div className="tl-evidence">
                    {entry.evidence ? <span>“{entry.evidence}”</span> : null}
                    {stageField?.emailId ? (
                      <Link to={`/emails/${stageField.emailId}`}>{stageField.sourceSubject ?? 'Source'}</Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {pendingFields.length > 0 ? (
          <div id="toConfirmSec">
            <div className="sec-head">
              <span className="ttl">To check ({pendingFields.length})</span>
            </div>
            {pendingFields.map((fieldView) => (
              <FieldBlock
                key={fieldView.field}
                field={fieldView}
                revisions={historyByField.get(fieldView.field) ?? []}
                onChanged={() => void load()}
                compact
              />
            ))}
          </div>
        ) : null}

        <div className="sec-head">
          <span className="ttl">Style Details</span>
        </div>
        <div className="group-row">
          <div className="group-box">
            <div className="gb-title">Production</div>
            {PRODUCTION_FIELDS.map((fieldName) => {
              const fieldView = style.fields[fieldName];
              if (!fieldView || fieldView.confirmationStatus === 'NOT_STATED') return null;
              const isExpanded = expandedField === fieldName;
              const revisions = historyByField.get(fieldName) ?? [];

              return (
                <div key={fieldName} className="detail-item" onClick={() => setExpandedField(isExpanded ? null : fieldName)}>
                  <div className="detail-row-header">
                    <div className="k">{fieldLabel(fieldName)}</div>
                    <div className="v">
                      <span className="val-num">{detailValue(fieldView)}</span>
                      {showStatusTag(fieldView.confirmationStatus) ? (
                        <span className={`tag tag-${fieldView.confirmationStatus.toLowerCase()}`}>
                          {statusLabel(fieldView.confirmationStatus)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {isExpanded ? (
                    <div className="detail-expanded">
                      <FieldBlock field={fieldView} revisions={revisions} onChanged={() => void load()} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="group-box">
            <div className="gb-title">Commercials</div>
            {COMMERCIAL_FIELDS.map((fieldName) => {
              const fieldView = style.fields[fieldName];
              if (!fieldView || fieldView.confirmationStatus === 'NOT_STATED') return null;
              const isExpanded = expandedField === fieldName;
              const revisions = historyByField.get(fieldName) ?? [];

              return (
                <div key={fieldName} className="detail-item" onClick={() => setExpandedField(isExpanded ? null : fieldName)}>
                  <div className="detail-row-header">
                    <div className="k">{fieldLabel(fieldName)}</div>
                    <div className="v">
                      <span className="val-num">{detailValue(fieldView)}</span>
                      {showStatusTag(fieldView.confirmationStatus) ? (
                        <span className={`tag tag-${fieldView.confirmationStatus.toLowerCase()}`}>
                          {statusLabel(fieldView.confirmationStatus)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {isExpanded ? (
                    <div className="detail-expanded">
                      <FieldBlock field={fieldView} revisions={revisions} onChanged={() => void load()} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {!emailsLoaded ? null : cardEmpty ? (
          <section className="style-empty" aria-labelledby="style-empty-heading">
            <h2 id="style-empty-heading">No emails on this style yet.</h2>
            <p>
              Forward a supplier email that mentions {style.styleNumber}. Spindle matches it here by that style number
              or the style name. Nothing is filed until you check it.
            </p>
            {forwardAddress ? (
              <button type="button" className="btn btn-secondary" onClick={() => void copyForwardingAddress()}>
                {addressCopied ? 'Copied' : `Copy ${forwardAddress}`}
              </button>
            ) : forwardAddress === null ? (
              <Link className="btn btn-secondary" to="/settings/email-connections">
                Register a forwarding address
              </Link>
            ) : null}
          </section>
        ) : (
          <>
        <div className="sec-head">
          <span className="ttl">Conversation Threads</span>
          <span className="meta">Tap any email to inspect original</span>
        </div>
        <div className="thread-list">
          {emailsFailed ? (
            <div className="thread-item">
              <div className="snippet">Emails for this style could not be loaded.</div>
            </div>
          ) : emails.length === 0 ? (
            <div className="thread-item">
              <div className="snippet">No emails linked to this style yet.</div>
            </div>
          ) : (
            emails.map((email) => (
              <Link className="thread-item" key={email.id} to={`/emails/${email.id}`}>
                <div className="who">{email.subject || '(no subject)'}</div>
                <div className="snippet">
                  {email.fromName || email.fromAddress}
                  {emailPreview(email.bodyText) ? ` · ${emailPreview(email.bodyText)}` : ''}
                </div>
                <div className="when">{new Date(email.receivedAt).toLocaleString()}</div>
              </Link>
            ))
          )}
        </div>

        <div className="sec-head">
          <span className="ttl">Files & Attachments</span>
          <span className="meta">Click to preview</span>
        </div>
        <AttachmentGrid attachments={attachments} emptyMessage="No files linked to this style yet." />
          </>
        )}

        <details className="history-disclosure">
          <summary>Full field history — every proposal, check, edit and not-right</summary>
          <div className="log-list">
            {(style.fieldRevisions ?? []).length === 0 ? (
              <p className="muted" style={{ padding: '8px 0' }}>
                No field revisions logged yet.
              </p>
            ) : (
              (style.fieldRevisions ?? []).map((revision) => (
                <div className="log-item" key={revision.id}>
                  <div className="log-field">{fieldLabel(revision.field)}</div>
                  <div className="log-what">
                    {revision.previousValue != null ? `${formatFieldValue(revision.previousValue)} → ` : ''}
                    <strong>{formatFieldValue(revision.newValue)}</strong> ({revisionLabel(revision)})
                  </div>
                  <div className="log-who">{new Date(revision.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
