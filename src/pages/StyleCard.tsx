import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { FieldBlock } from '../components/FieldBlock';
import { GarmentMark } from '../components/GarmentMark';
import {
  LEGACY_STAGE_LABELS,
  STAGE_COLUMNS,
  STAGE_LABELS,
  boardColumnForStyle,
  currentStageTone,
  legacyStageValue,
  styleCreatedFromEmail,
} from '../lib/board';
import { EmptyThreadMark } from '../components/EmptyMarks';
import { CURRENT_SEASON, styleCardIsEmpty } from '../lib/empty';
import { pickForwardingAddress } from '../lib/shell';
import {
  fieldLabel,
  formatFactValue,
  formatFieldValue,
  isCheckedStatus,
  styleTitle,
  isActionableConfirmationStatus,
  revisionLabel,
} from '../lib/format';
import { colourChips } from '../lib/garment';
import { displayFact, lineOrderValue, statusBadge } from '../lib/range';
import { evidenceSnippet, stageTimelineEntry, stageTimelineLabel } from '../lib/stage-timeline';
import { AttachmentGrid, AttachmentUpload } from '../components/AttachmentGrid';
import { isImageAttachment, mergeAttachments, uniqueAttachmentsFromEmails } from '../lib/attachments';
import type { FieldRevision, StyleCard, StyleEmail, StyleFieldView } from '../types';

const KEY_FIELDS = ['color', 'fabric', 'deliveryDate', 'quantity', 'costFob', 'currency', 'season', 'factoryName'] as const;

const STAGE_CODES: Record<(typeof STAGE_COLUMNS)[number], string> = {
  TECH_PACK: 'TP',
  COSTING: 'CT',
  LAB_DIP: 'LD',
  STRIKE_OFF: 'SO',
  FIT_SAMPLE: 'FS',
  PP: 'PP',
  TOP: 'TO',
  BULK: 'BK',
  SHIP: 'SH',
};

const DETAIL_FIELDS = ['factoryName', 'color', 'fabric', 'deliveryDate'];

type CardTab = 'overview' | 'emails' | 'files' | 'history';

function emailPreview(bodyText: string | null) {
  if (!bodyText) return '';
  return bodyText.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function shortWhen(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const SAMPLE_STYLE_ID = 'sample';

const SAMPLE_DETAILS = [
  ['Supplier', 'Hollis Garments', true],
  ['Quantity', '1,200 units', true],
  ['Delivery window', '—', false],
  ['Ex-factory date', 'From an email', false],
  ['Unit cost', 'From an email', false],
  ['Fabric', 'From the tech pack', false],
  ['PP sample', 'From an email', false],
] as const;

export function StyleCardPage() {
  const { styleId } = useParams();
  const preview = styleId === SAMPLE_STYLE_ID;
  const navigate = useNavigate();
  const [style, setStyle] = useState<StyleCard | null>(null);
  const [emails, setEmails] = useState<StyleEmail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [tab, setTab] = useState<CardTab>('overview');
  const [bannerOpen, setBannerOpen] = useState(true);
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
    if (preview) return;
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load style'));
  }, [styleId, preview]);

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

  async function checkDetails() {
    const ids = pendingFields
      .filter((fieldView) => DETAIL_FIELDS.includes(fieldView.field) && fieldView.confirmationId)
      .map((fieldView) => fieldView.confirmationId as string);
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        ids.map((id) =>
          api.confirm(id).catch((err: unknown) => {
            if (err instanceof Error && /already been resolved/i.test(err.message)) return null;
            throw err;
          }),
        ),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check these details');
    } finally {
      setBusy(false);
    }
  }

  if (preview) return <EmptyStylePreview />;

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

  const originEmail = [...emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
  const originWhen = originEmail ? shortWhen(originEmail.receivedAt) : '';
  const detailChecks = pendingFields.filter((fieldView) => DETAIL_FIELDS.includes(fieldView.field));

  function notedWhen(fieldView: StyleFieldView | undefined) {
    const match = fieldView?.emailId ? emails.find((email) => email.id === fieldView.emailId) : originEmail;
    return match ? shortWhen(match.receivedAt) : '';
  }

  const orderValue = lineOrderValue(loaded);
  const fabricFact = displayFact(style.fields.fabric);
  const seasonFact = displayFact(style.fields.season);
  const currencyFact = displayFact(style.fields.currency);
  const quantityFact = displayFact(quantityField);
  const costFact = displayFact(costField, { money: true, currency: style.fields.currency });
  const deliveryFact = displayFact(deliveryField);
  const uncheckedCount = [millFact, colorFact, fabricFact, deliveryFact, quantityFact, costFact].filter((fact) => fact.unchecked).length;
  const extraChecks = pendingFields.filter((fieldView) => fieldView.field !== 'brand' && !KEY_FIELDS.includes(fieldView.field as (typeof KEY_FIELDS)[number]));
  const fileCount = attachments.length;
  const emailCount = emails.length;

  function openFirstUnchecked() {
    const order = ['factoryName', 'color', 'fabric', 'deliveryDate', 'quantity', 'costFob', 'currency', 'season'] as const;
    const first = order.find((field) => displayFact(loaded.fields[field]).unchecked);
    setTab('overview');
    if (first) setExpandedField(first);
  }

  return (
    <div className="page style-sheet">
      <div className="wrap">
        {styleCreatedFromEmail(style) && bannerOpen ? (
          <div className="email-origin" role="status">
            <div>
              <p>Created from an email{originWhen ? ` on ${originWhen}` : ''}. Check the details below.</p>
              <p className="email-origin-note">
                Checks supplier, colourways, fabric and ex-factory date. Quantity and unit cost are checked one at a time.
              </p>
            </div>
            <div className="email-origin-actions">
              {detailChecks.length > 0 ? (
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void checkDetails()}>
                  Check {detailChecks.length} {detailChecks.length === 1 ? 'detail' : 'details'}
                </button>
              ) : null}
              <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void markNotAStyle()}>
                Not a style
              </button>
              <button className="email-origin-close" type="button" aria-label="Dismiss" onClick={() => setBannerOpen(false)}>
                ×
              </button>
            </div>
          </div>
        ) : null}

        <div className="style-phone-bar">
          <Link to="/">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {CURRENT_SEASON} range
          </Link>
        </div>
        <header className="style-sheet-head">
          <p className="style-kicker">
            {CURRENT_SEASON} range / <span>{style.styleNumber}</span>
          </p>
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
          <p className="style-meta">
            {cardEmpty && !supplier ? (
              <span>
                From your range sheet · {emailCount} emails, {fileCount} files
              </span>
            ) : (
              <>
                {supplier ? <span>{supplier}</span> : null}
                {millFact.text !== '—' ? <span>mill {millFact.text}</span> : null}
                {styleCreatedFromEmail(style) ? <span>new from email</span> : null}
                <span>
                  {emailCount} {emailCount === 1 ? 'email' : 'emails'}, {fileCount} {fileCount === 1 ? 'file' : 'files'}
                </span>
              </>
            )}
          </p>
          <div className="style-tabs" role="tablist" aria-label="Style card">
            {(
              [
                ['overview', 'Overview', null],
                ['emails', 'Emails', emailCount],
                ['files', 'Files', fileCount],
                ['history', 'History', style.fieldRevisions?.length ?? 0],
              ] as const
            ).map(([id, label, count]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
                {count ? (
                  <span className="tab-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}

        {tab === 'overview' ? (
          <div className="style-overview">
            <section className={`style-flat${cardEmpty && !heroAttachment ? ' is-empty' : ''}`} aria-label="Garment">
              {cardEmpty && !heroAttachment ? (
                <div
                  className="style-flat-drawing is-empty"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const files = [...event.dataTransfer.files];
                    if (files.length > 0) void uploadFiles(files);
                  }}
                >
                  <svg viewBox="0 0 100 120" width="120" height="144" aria-hidden="true">
                    <path d="M38 10 L46 14 Q50 19 54 14 L62 10 L72 22 L64 30 L66 48 L82 108 L18 108 L34 48 L36 30 L28 22 Z" />
                    <path d="M34 48 L66 48" />
                  </svg>
                  <p>The flat from your tech pack shows here. Drop a file or forward the tech pack email.</p>
                </div>
              ) : (
                <>
                  <StylePhoto attachment={heroAttachment} name={styleTitle(style)} />
                  <p className="style-flat-note">Flat · {heroAttachment?.filename ?? style.styleNumber}</p>
                </>
              )}
              <div className="timeline-steps" aria-label={`Nine stages, currently ${checkedStageLabel}`}>
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
                      <div className="stage-code">{STAGE_CODES[stg]}</div>
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
              {legacyStage ? (
                <p className="timeline-legacy">
                  {stageField && !isCheckedStatus(stageField.confirmationStatus) ? 'From email, not checked' : 'Recorded earlier'} as{' '}
                  {LEGACY_STAGE_LABELS[legacyStage]}. Not placed on the nine stages.
                </p>
              ) : null}
            </section>

            <section className="key-details" id="toConfirmSec" aria-labelledby="key-details-heading">
              <div className="key-head">
                <h2 id="key-details-heading">Key details</h2>
                {uncheckedCount > 0 ? <span>{uncheckedCount} not checked</span> : null}
                {uncheckedCount > 0 ? (
                  <button className="style-check-all" type="button" onClick={() => openFirstUnchecked()}>
                    <span className="butter-pip" aria-hidden="true" />
                    Check all {uncheckedCount}
                  </button>
                ) : null}
                {pendingFields.some((fieldView) => fieldView.field !== 'brand') ? <span className="sr-only">To check</span> : null}
              </div>
              <div className="facts-row">
                {supplier || millFact.text !== '—' ? (
                  <KeyRow
                    label="Supplier"
                    fieldView={style.fields.factoryName}
                    open={expandedField === 'factoryName'}
                    onToggle={() => setExpandedField(expandedField === 'factoryName' ? null : 'factoryName')}
                    revisions={historyByField.get('factoryName') ?? []}
                    onChanged={() => void load()}
                    currency={style.fields.currency}
                  >
                    <FactValue fact={supplier ? { text: supplier, unchecked: millFact.unchecked || millFact.text === '—', disagree: millFact.disagree } : millFact} />
                    {supplier && millFact.text !== '—' ? <span> · mill {millFact.text}</span> : null}
                    <FactNote fact={millFact.unchecked || millFact.text === '—' ? { ...millFact, unchecked: true } : millFact} fieldView={style.fields.factoryName} detail={notedWhen(style.fields.factoryName) ? `email ${notedWhen(style.fields.factoryName)}` : undefined} />
                  </KeyRow>
                ) : null}
                <KeyRow
                  label="Colourways"
                  fieldView={colorField}
                  open={expandedField === 'color'}
                  onToggle={() => setExpandedField(expandedField === 'color' ? null : 'color')}
                  revisions={historyByField.get('color') ?? []}
                  onChanged={() => void load()}
                  currency={style.fields.currency}
                >
                  {colourSwatches.length > 0 ? (
                    <span className="range-swatches" aria-hidden="true">
                      {colourSwatches.map((chip) => (
                        <span key={chip.name} style={{ background: chip.hex }} />
                      ))}
                    </span>
                  ) : null}
                  <FactValue fact={colorFact} />
                  <FactNote fact={colorFact} fieldView={colorField} detail={notedWhen(colorField) ? `email ${notedWhen(colorField)}` : undefined} />
                </KeyRow>
                <KeyRow
                  label="Fabric"
                  fieldView={style.fields.fabric}
                  open={expandedField === 'fabric'}
                  onToggle={() => setExpandedField(expandedField === 'fabric' ? null : 'fabric')}
                  revisions={historyByField.get('fabric') ?? []}
                  onChanged={() => void load()}
                  currency={style.fields.currency}
                >
                  <FactValue fact={fabricFact} />
                  <FactNote fact={fabricFact} fieldView={style.fields.fabric} detail={notedWhen(style.fields.fabric) ? `email ${notedWhen(style.fields.fabric)}` : undefined} />
                </KeyRow>
                <KeyRow
                  label="Ex-factory date"
                  fieldView={deliveryField}
                  open={expandedField === 'deliveryDate'}
                  onToggle={() => setExpandedField(expandedField === 'deliveryDate' ? null : 'deliveryDate')}
                  revisions={historyByField.get('deliveryDate') ?? []}
                  onChanged={() => void load()}
                  currency={style.fields.currency}
                >
                  <FactValue fact={deliveryFact} />
                  <FactNote fact={deliveryFact} fieldView={deliveryField} detail={notedWhen(deliveryField) ? `email ${notedWhen(deliveryField)}` : undefined} />
                </KeyRow>
                <KeyRow
                  label="Quantity"
                  fieldView={quantityField}
                  open={expandedField === 'quantity'}
                  onToggle={() => setExpandedField(expandedField === 'quantity' ? null : 'quantity')}
                  revisions={historyByField.get('quantity') ?? []}
                  onChanged={() => void load()}
                  currency={style.fields.currency}
                >
                  <FactValue fact={{ ...quantityFact, text: quantityFact.text === '—' ? '—' : `${quantityFact.text} pcs` }} />
                  <FactNote fact={quantityFact} fieldView={quantityField} detail="check on its own" />
                </KeyRow>
                <KeyRow
                  label="Unit cost"
                  fieldView={costField}
                  open={expandedField === 'costFob'}
                  onToggle={() => setExpandedField(expandedField === 'costFob' ? null : 'costFob')}
                  revisions={historyByField.get('costFob') ?? []}
                  onChanged={() => void load()}
                  currency={style.fields.currency}
                >
                  <FactValue fact={{ ...costFact, text: costFact.text === '—' ? '—' : `${costFact.text} FOB` }} />
                  {currencyFact.text !== '—' && currencyFact.text !== 'GBP' ? <span>{currencyFact.text}</span> : null}
                  <FactNote fact={costFact.unchecked || costFact.disagree ? costFact : currencyFact} fieldView={costField} detail={costFact.unchecked ? 'check on its own' : undefined} />
                </KeyRow>
                <div className="key-row fact">
                  <div className="l">Value</div>
                  <div className="v">
                    <span>{orderValue ?? '—'}</span>
                    {!orderValue ? <small>Not counted until quantity and cost are checked</small> : null}
                  </div>
                </div>
                {seasonFact.text === '—' && !style.fields.season?.confirmationId ? (
                  <div className="key-row fact">
                    <div className="l">Season</div>
                    <div className="v">
                      <span>{CURRENT_SEASON}</span>
                      <small>Current season</small>
                    </div>
                    <button type="button" disabled title="Not available yet">
                      Move
                    </button>
                  </div>
                ) : (
                  <KeyRow
                    label="Season"
                    fieldView={style.fields.season}
                    open={expandedField === 'season'}
                    onToggle={() => setExpandedField(expandedField === 'season' ? null : 'season')}
                    revisions={historyByField.get('season') ?? []}
                    onChanged={() => void load()}
                    currency={style.fields.currency}
                  >
                    <FactValue fact={seasonFact} />
                    <FactNote fact={seasonFact} fieldView={style.fields.season} />
                  </KeyRow>
                )}
              </div>
              {extraChecks.length > 0 ? (
                <div className="extra-checks">
                  {extraChecks.map((fieldView) => (
                    <KeyRow
                      key={fieldView.field}
                      label={fieldLabel(fieldView.field)}
                      fieldView={fieldView}
                      open={expandedField === fieldView.field}
                      onToggle={() => setExpandedField(expandedField === fieldView.field ? null : fieldView.field)}
                      revisions={historyByField.get(fieldView.field) ?? []}
                      onChanged={() => void load()}
                      currency={style.fields.currency}
                    >
                      <FactValue fact={displayFact(fieldView, { money: fieldView.field === 'costFob', currency: style.fields.currency })} />
                      <FactNote fact={displayFact(fieldView)} fieldView={fieldView} />
                    </KeyRow>
                  ))}
                </div>
              ) : null}
            </section>

              <aside className="latest-emails" aria-label="Latest emails">
              <h2>Latest emails</h2>
              {emailsLoaded && cardEmpty ? (
                <section className="style-empty" aria-labelledby="style-empty-heading">
                  <EmptyThreadMark />
                  <h2 id="style-empty-heading">No emails on this style yet.</h2>
                  <p>
                    Forward the latest thread that mentions {style.styleNumber}. Spindle matches it here by the style number,{' '}
                    {style.styleNumber}, or the style name.
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
                <EmailList emails={emails} failed={emailsFailed} supplier={supplier} />
              )}
            </aside>
          </div>
        ) : null}

        {tab === 'emails' ? (
          <section className="latest-emails" aria-label="Emails">
            <EmailList emails={emails} failed={emailsFailed} supplier={supplier} />
          </section>
        ) : null}

        {tab === 'files' ? (
          <section aria-label="Files">
            <div className="sec-head">
              <span className="ttl">Files</span>
              <AttachmentUpload onFiles={uploadFiles} />
            </div>
            {cardEmpty ? null : <AttachmentGrid attachments={attachments} emptyMessage="No files linked to this style yet." />}
          </section>
        ) : null}

        {tab === 'history' ? (
          <section aria-label="History">
            <div className="log-list">
              {(style.fieldRevisions ?? []).length === 0 ? (
                <p className="muted">No field revisions logged yet.</p>
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
          </section>
        ) : null}
        {uncheckedCount > 0 ? (
          <div className="style-check-bar">
            <span>
              <span className="butter-pip" aria-hidden="true" />
              {uncheckedCount} {uncheckedCount === 1 ? 'value' : 'values'} not checked yet
            </span>
            <button type="button" onClick={() => openFirstUnchecked()}>
              Check all {uncheckedCount}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FactValue({ fact }: { fact: { text: string; unchecked: boolean; disagree: boolean } }) {
  return (
    <span className={fact.unchecked || fact.disagree ? 'is-unchecked' : undefined}>
      {fact.disagree ? (
        <span className="range-disagree" title="Emails disagree">
          !
        </span>
      ) : fact.unchecked ? (
        <span className="butter-pip" aria-hidden="true" />
      ) : null}
      {fact.text}
    </span>
  );
}

function FactNote({
  fact,
  fieldView,
  detail,
}: {
  fact: { unchecked: boolean; disagree: boolean };
  fieldView?: StyleFieldView;
  detail?: string;
}) {
  if (fact.disagree && fieldView) {
    return <small>Emails disagree · {formatFieldValue(fieldView.proposedValue)} from email</small>;
  }
  if (fact.unchecked) return <small>Not checked yet{detail ? ` · ${detail}` : ''}</small>;
  return null;
}

function KeyRow({
  label,
  fieldView,
  open,
  onToggle,
  revisions,
  onChanged,
  currency,
  children,
}: {
  label: string;
  fieldView?: StyleFieldView;
  open: boolean;
  onToggle: () => void;
  revisions: FieldRevision[];
  onChanged: () => void;
  currency?: StyleFieldView;
  children: ReactNode;
}) {
  const canCheck = Boolean(fieldView?.confirmationId) && Boolean(fieldView && isActionableConfirmationStatus(fieldView.confirmationStatus));
  return (
    <div className="key-row fact">
      <div className="l">{label}</div>
      <div className="v">{children}</div>
      {canCheck ? (
        <button type="button" aria-expanded={open} onClick={onToggle}>
          Check
        </button>
      ) : (
        <span />
      )}
      {open && fieldView ? (
        <div className="key-check">
          <FieldBlock field={fieldView} revisions={revisions} onChanged={onChanged} compact currency={currency} />
        </div>
      ) : null}
    </div>
  );
}

function EmailList({ emails, failed, supplier }: { emails: StyleEmail[]; failed: boolean; supplier?: string }) {
  if (failed) {
    return (
      <div className="thread-list">
        <div className="thread-item">
          <div className="snippet">Emails for this style could not be loaded.</div>
        </div>
      </div>
    );
  }
  if (emails.length === 0) {
    return (
      <div className="thread-list">
        <div className="thread-item">
          <div className="snippet">No emails linked to this style yet.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="thread-list">
      {emails.map((email) => (
        <Link className="thread-item" key={email.id} to={`/emails/${email.id}`}>
          <div className="mail-preview-top">
            <span>
              {email.fromName || email.fromAddress}
              {supplier ? ` · ${supplier}` : ''}
            </span>
            <span className="when">{shortWhen(email.receivedAt)}</span>
          </div>
          <div className="who">{email.subject || '(no subject)'}</div>
          {emailPreview(email.bodyText) ? <div className="snippet">{emailPreview(email.bodyText)}</div> : null}
        </Link>
      ))}
    </div>
  );
}

function StylePhoto({
  attachment,
  name,
}: {
  attachment: { id: string; emailId: string | null; filename: string } | null;
  name: string;
}) {
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
      <div className="style-flat-drawing" title="Garment flat">
        <GarmentMark name={name} />
      </div>
    );
  }

  return (
    <div className="style-flat-drawing has-photo">
      <img src={url} alt={attachment?.filename ?? name} />
    </div>
  );
}

function EmptyStylePreview() {
  const [tab, setTab] = useState<CardTab>('overview');
  const [forwardAddress, setForwardAddress] = useState<string | null | undefined>(undefined);
  const [addressCopied, setAddressCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
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
  }, []);

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

  return (
    <div className="page style-sheet">
      <div className="wrap">
        <div className="style-phone-bar">
          <Link to="/">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {CURRENT_SEASON} range
          </Link>
        </div>
        <header className="style-sheet-head">
          <p className="style-kicker">
            {CURRENT_SEASON} range / <span>HS-5512</span>
          </p>
          <div className="card-head">
            <h1>Sun Embroidered Dress</h1>
          </div>
          <p className="style-meta">
            <span>From your range sheet · 0 emails, 0 files</span>
          </p>
          <div className="style-tabs" role="tablist" aria-label="Style card">
            {(
              [
                ['overview', 'Overview', null],
                ['emails', 'Emails', 0],
                ['files', 'Files', 0],
                ['history', 'History', 1],
              ] as const
            ).map(([id, label, count]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
                {count != null ? (
                  <span className="tab-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </header>

        {tab === 'overview' ? (
          <div className="style-overview">
            <section className="style-flat is-empty" aria-label="Garment">
              <div className="style-flat-drawing is-empty">
                <svg viewBox="0 0 100 120" width="120" height="144" aria-hidden="true">
                  <path d="M38 10 L46 14 Q50 19 54 14 L62 10 L72 22 L64 30 L66 48 L82 108 L18 108 L34 48 L36 30 L28 22 Z" />
                  <path d="M34 48 L66 48" />
                </svg>
                <p>The flat from your tech pack shows here. Drop a file or forward the tech pack email.</p>
              </div>
              <div className="timeline-steps" aria-label="Nine stages, currently not recorded">
                {STAGE_COLUMNS.map((stage) => (
                  <div key={stage} className="tl-step unrecorded">
                    <div className="mark" />
                    <div className="name">{STAGE_LABELS[stage]}</div>
                    <div className="stage-code">{STAGE_CODES[stage]}</div>
                  </div>
                ))}
              </div>
            </section>
            <section className="key-details" aria-labelledby="sample-key-details">
              <div className="key-head">
                <h2 id="sample-key-details">Key details</h2>
              </div>
              <div className="facts-row">
                {SAMPLE_DETAILS.map(([label, value, recorded]) => (
                  <div className="key-row fact" key={label}>
                    <div className="l">{label}</div>
                    <div className="v" style={{ color: recorded ? undefined : '#8C8176' }}>
                      <span>{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <aside className="latest-emails" aria-label="Latest emails">
              <h2>Latest emails</h2>
              <EmptyMailNote address={forwardAddress} copied={addressCopied} onCopy={() => void copyForwardingAddress()} />
            </aside>
          </div>
        ) : null}

        {tab === 'emails' ? (
          <section className="latest-emails" aria-label="Emails">
            <EmptyMailNote address={forwardAddress} copied={addressCopied} onCopy={() => void copyForwardingAddress()} />
          </section>
        ) : null}

        {tab === 'files' ? (
          <section aria-label="Files">
            <p className="muted">No files linked to this style yet.</p>
          </section>
        ) : null}

        {tab === 'history' ? (
          <section aria-label="History">
            <div className="log-list">
              <div className="log-item">
                <div className="log-field">Style</div>
                <div className="log-what">Added from the range sheet</div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function EmptyMailNote({
  address,
  copied,
  onCopy,
}: {
  address: string | null | undefined;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="style-empty" aria-labelledby="style-empty-heading">
      <EmptyThreadMark />
      <h2 id="style-empty-heading">No emails on this style yet.</h2>
      <p>Forward the latest thread with Hollis. Spindle matches it here by the style number, HS-5512, or the style name.</p>
      {address ? (
        <button type="button" className="btn btn-secondary" onClick={onCopy}>
          {copied ? 'Copied' : `Copy ${address}`}
        </button>
      ) : address === null ? (
        <Link className="btn btn-secondary" to="/settings/email-connections">
          Register a forwarding address
        </Link>
      ) : null}
    </section>
  );
}
