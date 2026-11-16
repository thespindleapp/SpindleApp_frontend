import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { FieldBlock } from '../components/FieldBlock';
import {
  LEGACY_STAGE_LABELS,
  STAGE_COLUMNS,
  STAGE_LABELS,
  boardColumnForStyle,
  currentStageTone,
  legacyStageValue,
  styleCreatedFromEmail,
} from '../lib/board';
import { styleCardIsEmpty } from '../lib/empty';
import { pickForwardingAddress } from '../lib/shell';
import {
  fieldLabel,
  formatFactValue,
  formatFieldValue,
  headlineFact,
  isCheckedStatus,
  styleTitle,
  isActionableConfirmationStatus,
  revisionLabel,
  showStatusTag,
  statusLabel,
} from '../lib/format';
import { colourChips } from '../lib/garment';
import { displayFact, statusBadge } from '../lib/range';
import { evidenceSnippet, stageTimelineEntry, stageTimelineLabel } from '../lib/stage-timeline';
import { AttachmentGrid, AttachmentUpload } from '../components/AttachmentGrid';
import { isImageAttachment, mergeAttachments, uniqueAttachmentsFromEmails } from '../lib/attachments';
import type { ConfirmAllResult, FieldRevision, StyleCard, StyleEmail, StyleFieldView } from '../types';

const PRODUCTION_FIELDS = ['fabric', 'color', 'sizeRange', 'season', 'factoryName', 'inspectionType'];
const COMMERCIAL_FIELDS = ['quantity', 'costFob', 'currency', 'deliveryDate', 'status'];

function rowStatusLabel(status: string) {
  if (status === 'NEEDS_REVIEW') return 'Emails disagree';
  return statusLabel(status);
}

function emailPreview(bodyText: string | null) {
  if (!bodyText) return '';
  return bodyText.replace(/\s+/g, ' ').trim().slice(0, 140);
}

export function StyleCardPage() {
  const { styleId } = useParams();
  const navigate = useNavigate();
  const [style, setStyle] = useState<StyleCard | null>(null);
  const [emails, setEmails] = useState<StyleEmail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function uploadFiles(files: File[]) {
    if (!styleId) return;
    setError(null);
    await api.uploadStyleAttachments(styleId, files);
    await load();
  }

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

  const attachments = useMemo(() => {
    const fromStyle = (style?.attachments ?? []).map((attachment) => ({
      ...attachment,
      emailId: attachment.emailId ?? null,
    }));
    return mergeAttachments(fromStyle, uniqueAttachmentsFromEmails(emails));
  }, [style, emails]);
  const heroAttachment = attachments.find((attachment) => isImageAttachment(attachment.mimeType)) ?? null;
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

  async function markNotAStyle() {
    if (!style) return;
    setBusy(true);
    setError(null);
    try {
      await api.markNotAStyle(style.id);
      navigate('/inbox');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark this as not a style');
      setBusy(false);
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

  const loaded = style;
  const checkedStage = boardColumnForStyle(loaded);
  const quantityField = style.fields.quantity;
  const costField = style.fields.costFob;
  const colorField = style.fields.color;
  const deliveryField = style.fields.deliveryDate;
  const stageField = style.fields.stage;
  const statusField = style.fields.status;
  const statusFact = displayFact(statusField);
  const colorFact = displayFact(colorField);
  const millFact = displayFact(style.fields.factoryName);
  const colourSwatches = colorFact.text === '—' ? [] : colourChips(colorFact.text);
  const supplier = loaded.supplierName?.trim() || '';

  const timelineTexts = [
    ...emails.map((email) => email.bodyText),
    ...emails.map((email) => email.subject),
    ...Object.values(style.fields).map((field) => evidenceSnippet(field.evidence)),
  ];

  const checkedStageLabel =
    checkedStage === 'UNCONFIRMED' ? 'not recorded' : (STAGE_LABELS[checkedStage] ?? checkedStage);
  const legacyStage = legacyStageValue(loaded);

  function detailValue(fieldView: StyleFieldView) {
    if (fieldView.confirmationStatus === 'REJECTED') return '—';
    const currency = fieldView.field === 'costFob' ? loaded.fields.currency : undefined;
    if (fieldView.confirmationStatus === 'CONFIRMED' || fieldView.confirmationStatus === 'NEEDS_REVIEW') {
      return formatFactValue(fieldView.field, fieldView.confirmedValue ?? fieldView.displayValue, currency);
    }
    return formatFactValue(fieldView.field, fieldView.proposedValue ?? fieldView.displayValue, currency);
  }

  return (
    <div className="page">
      <div className="wrap">
        <div className="head-main">
          <StylePhoto attachment={heroAttachment} />

          <div className="head-fields">
            <div className="head-row">
              <div className="card-head">
                <h1>{styleTitle(style)}</h1>
                {statusField && isCheckedStatus(statusField.confirmationStatus) && statusBadge(statusFact.text) ? (
                  <span className={`range-flag is-${statusBadge(statusFact.text)?.tone} ${statusFact.disagree ? 'is-unchecked' : ''}`}>
                    <span className="range-flag-swatch" />
                    {statusFact.disagree ? (
                      <span className="range-disagree" title="Emails disagree">
                        !
                      </span>
                    ) : null}
                    <span>{statusBadge(statusFact.text)?.label}</span>
                  </span>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Link className="btn btn-secondary" to="/">
                  ← Board
                </Link>
                {styleCreatedFromEmail(style) ? (
                  <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void markNotAStyle()}>
                    Not a style
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

            {supplier || millFact.text !== '—' ? (
              <p className="style-parties">
                {supplier ? <span>{supplier}</span> : null}
                {millFact.text !== '—' ? (
                  <span className={millFact.unchecked || millFact.disagree ? 'is-unchecked' : undefined}>
                    {supplier ? ' · mill ' : 'mill '}
                    {millFact.disagree ? (
                      <span className="range-disagree" title="Emails disagree">
                        !
                      </span>
                    ) : millFact.unchecked ? (
                      <span className="butter-pip" aria-hidden="true" />
                    ) : null}
                    {millFact.text}
                    {millFact.unchecked && !millFact.disagree ? ' · Not checked yet' : null}
                    {millFact.disagree ? ' · Emails disagree' : null}
                  </span>
                ) : null}
              </p>
            ) : null}

            {styleCreatedFromEmail(style) ? (
              <div className="email-origin" role="status">
                Created from an email. Check the values Spindle read, or mark this as not a style.
              </div>
            ) : null}

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
                    <small>Emails disagree · {formatFieldValue(quantityField.proposedValue)} from email</small>
                  ) : null}
                </div>
              </div>
              <div className="fact">
                <div className="l">Cost (FOB)</div>
                <div className="v">{headlineFact(costField, { money: true, currency: style.fields.currency })}</div>
              </div>
              <div className="fact">
                <div className="l">Colour</div>
                <div className={`v ${colorFact.unchecked || colorFact.disagree ? 'is-unchecked' : ''}`}>
                  {colourSwatches.length > 0 ? (
                    <span className="range-swatches" aria-hidden="true">
                      {colourSwatches.map((chip) => (
                        <span key={chip.name} style={{ background: chip.hex }} />
                      ))}
                    </span>
                  ) : null}
                  {colorFact.text === '—'
                    ? '—'
                    : colorFact.disagree
                      ? `${colorFact.text} · Emails disagree`
                      : colorFact.unchecked
                        ? `${colorFact.text} · Not checked yet`
                        : colorFact.text}
                </div>
              </div>
              <div className="fact">
                <div className="l">Ex-factory</div>
                <div className="v">
                  {headlineFact(deliveryField)}
                  {deliveryField?.confirmationStatus === 'NEEDS_REVIEW' ? (
                    <small>Emails disagree · {formatFieldValue(deliveryField.proposedValue)} from email</small>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {flash ? <div className="flash">{flash}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="sec-head">
          <span className="ttl">
            Approval timeline <em>9 stages · currently {checkedStageLabel}</em>
          </span>
        </div>
        {legacyStage ? (
          <p className="timeline-legacy">
            {stageField && !isCheckedStatus(stageField.confirmationStatus) ? 'From email, not checked' : 'Recorded earlier'} as{' '}
            {LEGACY_STAGE_LABELS[legacyStage]}. Not placed on the nine stages.
          </p>
        ) : null}
        <div className="timeline-steps">
          {STAGE_COLUMNS.map((stg) => {
            const entry = stageTimelineEntry(stg, { stageField, texts: timelineTexts });
            const tone = checkedStage === stg ? currentStageTone(loaded) : null;
            const step =
              entry.state === 'approved'
                ? { className: 'done', label: 'Recorded complete', mark: '✓' }
                : checkedStage === stg && tone === 'blocked'
                  ? { className: 'blocked', label: 'Blocked', mark: '!' }
                  : checkedStage === stg && tone === 'waiting'
                    ? { className: 'waiting', label: 'Waiting', mark: '' }
                    : checkedStage === stg
                      ? { className: 'current', label: 'Current', mark: '' }
                      : entry.state === 'proposed'
                        ? { className: 'unconfirmed', label: 'Not checked yet', mark: '' }
                        : entry.state === 'mentioned'
                          ? { className: 'mentioned', label: stageTimelineLabel(entry.state), mark: '' }
                          : { className: 'unrecorded', label: 'Not recorded', mark: '' };
            return (
              <div key={stg} className={`tl-step ${step.className}`} title={entry.evidence ?? step.label}>
                <div className="mark">{step.mark}</div>
                <div className="name">{STAGE_LABELS[stg]}</div>
                <div className="note">{step.label}</div>
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
                currency={style.fields.currency}
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
                          {rowStatusLabel(fieldView.confirmationStatus)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {isExpanded ? (
                    <div className="detail-expanded">
                      <FieldBlock field={fieldView} revisions={revisions} onChanged={() => void load()} currency={style.fields.currency} />
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
                          {rowStatusLabel(fieldView.confirmationStatus)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {isExpanded ? (
                    <div className="detail-expanded">
                      <FieldBlock field={fieldView} revisions={revisions} onChanged={() => void load()} currency={style.fields.currency} />
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
            <AttachmentUpload onFiles={uploadFiles} />
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
          <span className="meta">
            Click to preview <AttachmentUpload onFiles={uploadFiles} />
          </span>
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
                    {revision.previousValue != null
                      ? `${formatFactValue(revision.field, revision.previousValue, revision.field === 'costFob' ? loaded.fields.currency : undefined)} → `
                      : ''}
                    <strong>
                      {formatFactValue(revision.field, revision.newValue, revision.field === 'costFob' ? loaded.fields.currency : undefined)}
                    </strong>{' '}
                    ({revisionLabel(revision)})
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

function StylePhoto({ attachment }: { attachment: { id: string; emailId: string | null; filename: string } | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) {
      setUrl(null);
      return undefined;
    }
    let active = true;
    let objectUrl: string | null = null;
    void api
      .getAttachmentBlob(attachment.emailId, attachment.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment?.id, attachment?.emailId]);

  if (!url) {
    return (
      <div className="style-image" title="No style photo yet">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M9 5 L7 3 L5 5 L3 7 L3 19 L21 19 L21 7 L19 5 L17 3 L15 5 Z" />
          <path d="M9 5 Q12 8 15 5" />
        </svg>
        <div className="lbl">No photo yet</div>
      </div>
    );
  }

  return (
    <div className="style-image has-photo">
      <img src={url} alt={attachment?.filename ?? ''} />
    </div>
  );
}
