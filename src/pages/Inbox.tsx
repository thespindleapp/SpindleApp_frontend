import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { AttachmentGrid } from '../components/AttachmentGrid';
import { MailboxMark } from '../components/EmptyMarks';
import { CandidatePicker } from '../components/CandidatePicker';
import { FieldBlock } from '../components/FieldBlock';
import { inboxSurface, isReadingStatus, supplierForwardMessage } from '../lib/empty';
import { inboxItems, redeliveryNote, type InboxEmail } from '../lib/inbox';
import {
  canRetryEmail,
  currentBatch,
  progressHeadline,
  progressPercent,
  INBOX_NEEDS_YOU_EVENT,
  progressWatchKey,
  showsCurrentBatch,
  type InboxProgress,
} from '../lib/inbox-progress';
import {
  EXCEPTION_LABEL,
  applyDraftChoice,
  deliveryProblems,
  groupFiledThreads,
  groupMail,
  inboxSnippet,
  inboxWhen,
  isTextEntryTarget,
  senderLabel,
  stepException,
  styleChip,
  visibleThreads,
  type InboxFilter,
  type MailThread,
} from '../lib/inbox-view';
import { pickForwardingAddress } from '../lib/shell';
import { matchKindLabel } from '../lib/style-draft';
import type { ConfirmationRow, DuplicateReview, StyleDraft, StyleEmail, StyleFieldView } from '../types';

function reviewField(row: ConfirmationRow): StyleFieldView {
  return {
    field: row.field,
    confirmationId: row.id,
    emailId: row.emailId,
    sourceSubject: row.email?.subject ?? null,
    proposedValue: row.proposedValue,
    confirmedValue: row.confirmedValue,
    displayValue: row.confirmedValue ?? row.proposedValue,
    confirmationStatus: 'NEEDS_REVIEW',
    evidence: row.evidence,
    confirmedBy: row.confirmedById,
    confirmedAt: row.resolvedAt,
    source: row.source,
    proposedDiffersFromConfirmed: true,
  };
}

async function loadConfirmations() {
  const all: ConfirmationRow[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const items = await api.listConfirmations({ limit: 100, page });
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

export function InboxPage() {
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [confirmations, setConfirmations] = useState<ConfirmationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StyleDraft | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forwardAddress, setForwardAddress] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState<'address' | 'message' | null>(null);
  const [progress, setProgress] = useState<InboxProgress | null>(null);
  const [reviews, setReviews] = useState<DuplicateReview[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keyFocusId, setKeyFocusId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<StyleEmail[]>([]);
  const copiedTimer = useRef<number | null>(null);
  const loadRef = useRef<() => Promise<void>>(async () => undefined);
  const progressRef = useRef<InboxProgress | null>(null);

  async function load() {
    setError(null);
    try {
      const [received, pending, snapshot] = await Promise.all([
        api.listInboxEmails(),
        loadConfirmations(),
        api.inboxProgress().catch(() => null),
      ]);
      setEmails(received);
      setConfirmations(pending);
      progressRef.current = snapshot;
      setProgress(snapshot);
      if (snapshot) {
        window.dispatchEvent(new CustomEvent(INBOX_NEEDS_YOU_EVENT, { detail: snapshot.needsYou }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the inbox');
    } finally {
      setLoading(false);
    }
  }

  loadRef.current = load;
  const items = inboxItems(emails, confirmations);
  const surface = inboxSurface({
    loading,
    error: Boolean(error),
    emails,
    reviewCount: items.length,
  });
  const threads = groupMail(emails, confirmations).map((thread) => applyDraftChoice(thread, drafts[thread.email.id]));
  const visible = visibleThreads(threads, filter);
  const selected = visible.find((thread) => thread.email.id === selectedId) ?? visible[0] ?? null;
  const selectedEmailId = selected?.email.id ?? null;
  const selectedStatus = selected?.email.status ?? '';
  const selectedThreadId = selected?.email.threadId ?? null;
  const selectedHasStyle = Boolean(selected?.email.style);
  const loadedNeedCount = threads.filter((thread) => thread.exceptions.length > 0).length;
  const needCount = progress ? progress.needsYou : loadedNeedCount;
  const showReading = surface === 'reading';
  const showMail = !loading && !error && emails.length > 0 && !showReading;

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (surface === 'loading' || surface === 'error') return;
    const followList = surface === 'listening' || surface === 'reading';
    const id = window.setInterval(() => {
      if (followList) {
        void loadRef.current();
        return;
      }
      void api
        .inboxProgress()
        .then((next) => {
          const previous = progressRef.current;
          progressRef.current = next;
          setProgress(next);
          if (!previous || progressWatchKey(previous) !== progressWatchKey(next)) {
            void loadRef.current();
          }
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [surface]);

  useEffect(() => {
    if (surface === 'loading' || surface === 'error' || surface === 'reading') return;
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
  }, [surface]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!showMail || !selectedEmailId || selectedHasStyle || isReadingStatus(selectedStatus) || selectedStatus === 'FAILED') {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(drafts, selectedEmailId)) return;
    let cancelled = false;
    void api
      .getStyleDraft(selectedEmailId)
      .then((draft) => {
        if (!cancelled) setDrafts((current) => ({ ...current, [selectedEmailId]: draft }));
      })
      .catch(() => {
        if (!cancelled) setDrafts((current) => ({ ...current, [selectedEmailId]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [showMail, selectedEmailId, selectedHasStyle, selectedStatus, drafts]);

  useEffect(() => {
    if (!selectedThreadId) {
      setThreadMessages([]);
      return;
    }
    let cancelled = false;
    void api
      .listEmails({ threadId: selectedThreadId, limit: 50 })
      .then((messages) => {
        if (!cancelled) setThreadMessages(messages);
      })
      .catch(() => {
        if (!cancelled) setThreadMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmailId, selectedThreadId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'j' && key !== 'k') return;
      if (isTextEntryTarget(event.target)) return;
      if (!showMail) return;
      const next = stepException(threads, selectedEmailId, key === 'j' ? 1 : -1);
      if (!next || next === selectedEmailId) return;
      event.preventDefault();
      setSelectedId(next);
      setKeyFocusId(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMail, threads, selectedEmailId]);

  useEffect(() => {
    if (!keyFocusId) return;
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(keyFocusId) : keyFocusId.replace(/"/g, '');
    const node = document.querySelector<HTMLButtonElement>(`[data-mail-id="${escaped}"]`);
    node?.focus();
    if (typeof node?.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
    setKeyFocusId(null);
  }, [keyFocusId]);

  async function copyText(kind: 'address' | 'message', value: string) {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  useEffect(() => {
    if (!selectedEmailId || (!selected?.email.hasDuplicateReview && selected?.email.duplicateVerdict == null)) {
      setReviews([]);
      return;
    }
    let cancelled = false;
    void api
      .listEmailDuplicates(selectedEmailId)
      .then((rows) => {
        if (!cancelled) setReviews(rows);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmailId, selected?.email.hasDuplicateReview, selected?.email.duplicateVerdict]);

  async function retryEmail(emailId: string) {
    setRetryingId(emailId);
    setNotice(null);
    try {
      await api.reprocessEmail(emailId);
      setNotice('Queued to be read again.');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not retry this email');
    } finally {
      setRetryingId(null);
    }
  }

  async function resolveDuplicate(reviewId: string, action: 'confirm' | 'dismiss') {
    setNotice(null);
    try {
      if (action === 'confirm') {
        await api.confirmDuplicate(reviewId);
        setNotice('Marked as a duplicate. The style records were left as they are.');
      } else {
        await api.dismissDuplicate(reviewId);
        setNotice('Kept as separate.');
      }
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not update this duplicate');
    }
  }

  return (
    <div className={`page inbox-page${surface === 'listening' ? ' is-listening' : ''}${showMail ? ' is-mail' : ''}`}>
      {showReading ? (
        <div className="page-head">
          <div>
            <div className="eyebrow">Inbox</div>
            <h1>Review incoming styles</h1>
          </div>
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      {notice ? <p className="muted">{notice}</p> : null}
      {progress && progress.received > 0 ? <BatchProgress progress={progress} shown={emails.length} /> : null}
      {surface === 'loading' ? <p className="muted">Loading the inbox…</p> : null}
      {surface === 'listening' ? (
        <div className="inbox-workspace is-empty">
          <div className="inbox-list-pane">
            <div className="inbox-list-head">
              <span className="inbox-forwarded">{forwardAddress ? `Forwarded to ${forwardAddress}` : 'Forwarded to'}</span>
              <div className="inbox-title-row">
                <h1 className="inbox-title">Inbox</h1>
                <span className="range-count">· 0 emails</span>
              </div>
            </div>
            <div className="inbox-ghosts" aria-hidden="true">
              {(
                [
                  ['38%', '62%', 1],
                  ['30%', '70%', 0.7],
                  ['42%', '55%', 0.45],
                  ['34%', '66%', 0.25],
                ] as const
              ).map(([width, subject, opacity]) => (
                <div className="inbox-ghost" key={width} style={{ opacity }}>
                  <span className="inbox-ghost-top">
                    <span style={{ width }} />
                    <span />
                  </span>
                  <span className="inbox-ghost-subject" style={{ width: subject }} />
                  <span className="inbox-ghost-line" />
                </div>
              ))}
            </div>
          </div>
          <section className="inbox-empty" aria-labelledby="inbox-empty-heading">
            <MailboxMark />
            {forwardAddress ? (
              <p className="listening-line">
                <span className="listen-dot" aria-hidden="true" />
                Listening on {forwardAddress}
              </p>
            ) : null}
            {forwardAddress === null ? (
              <p className="listening-line">Register a forwarding address to start listening.</p>
            ) : null}
            <h2 id="inbox-empty-heading">No emails yet. Send one and watch it land here.</h2>
            <p>Spindle reads each email, finds the style it is about and pulls out dates, costs and approvals for you to check.</p>
            <div className="inbox-ways">
              <div className="inbox-way">
                <span className="n">1</span>
                <span>
                  <strong>Forward one email</strong>
                  <span>Pick a recent thread with a supplier and forward it as it is.</span>
                </span>
                {forwardAddress ? (
                  <button type="button" className="btn btn-secondary" onClick={() => void copyText('address', forwardAddress)}>
                    {copied === 'address' ? 'Copied' : 'Copy address'}
                  </button>
                ) : forwardAddress === null ? (
                  <Link className="btn btn-secondary" to="/settings/email-connections">
                    Register a forwarding address
                  </Link>
                ) : null}
              </div>
              <div className="inbox-way">
                <span className="n">2</span>
                <span>
                  <strong>Auto-forward from Gmail or Outlook</strong>
                  <span>A filter sends supplier emails here without you thinking about it.</span>
                </span>
                <Link className="btn btn-secondary" to="/settings/email-connections">
                  Set up filter
                </Link>
              </div>
              <div className="inbox-way">
                <span className="n">3</span>
                <span>
                  <strong>Ask suppliers to copy you in</strong>
                  <span>They add the address once. Every reply arrives here too.</span>
                </span>
                {forwardAddress ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void copyText('message', supplierForwardMessage(forwardAddress))}
                  >
                    {copied === 'message' ? 'Copied' : 'Copy message'}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {showReading ? (
        <section className="reading-layout" aria-label="First email">
          {emails.map((email) => {
            const pending = items.find((item) => item.email.id === email.id)?.pending ?? null;
            return (
              <article className="panel" key={email.id}>
                <div className="panel-head">
                  <span className="reading-tag">Reading</span>
                  <span>{email.fromName || email.fromAddress}</span>
                  <span>{new Date(email.receivedAt).toLocaleString()}</span>
                </div>
                <h2>
                  <Link to={`/emails/${email.id}`}>{email.subject || 'No subject'}</Link>
                </h2>
                <p>Spindle is reading this email. A clear style number is filed on the Range board when the read finishes.</p>
                {pending ? <CandidatePicker row={{ ...pending, email }} onResolved={() => void load()} /> : null}
              </article>
            );
          })}
        </section>
      ) : null}
      {showMail ? (
        <section className="inbox-workspace" aria-label="Inbox">
          <div className="inbox-list-pane" id="inbox-list">
            <div className="inbox-list-head">
              {forwardAddress ? <p className="inbox-forwarded">Forwarded to {forwardAddress}</p> : null}
              <div className="inbox-title-row">
                <h1 className="inbox-title">Inbox</h1>
                <span className="inbox-need">· {needCount} need you</span>
              </div>
              <div className="inbox-list-tools">
                <div className="inbox-seg" role="group" aria-label="Inbox view">
                  <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                    All · {threads.length}
                  </button>
                  <button type="button" aria-pressed={filter === 'needs'} onClick={() => setFilter('needs')}>
                    Needs you · {needCount}
                  </button>
                </div>
                <span className="inbox-sort">Newest first</span>
              </div>
            </div>
            <div className="inbox-rows" role="listbox" aria-label={filter === 'needs' ? 'Needs you' : filter === 'filed' ? 'Filed' : 'All mail'}>
              {filter === 'filed'
                ? groupFiledThreads(visible).map((group) => (
                    <div className="filed-group" key={group.key}>
                      <div className="filed-group-label">{group.label}</div>
                      {group.threads.map((thread) => (
                        <MailRow
                          key={thread.email.id}
                          thread={thread}
                          selected={selected?.email.id === thread.email.id}
                          onSelect={() => setSelectedId(thread.email.id)}
                        />
                      ))}
                    </div>
                  ))
                : visible.map((thread) => (
                    <MailRow
                      key={thread.email.id}
                      thread={thread}
                      selected={selected?.email.id === thread.email.id}
                      onSelect={() => setSelectedId(thread.email.id)}
                    />
                  ))}
              {filter === 'needs' && visible.length === 0 ? (
                <div className="inbox-clear">
                  <h2>Nothing needs you</h2>
                  <p>Every forwarded email is on the right style.</p>
                </div>
              ) : null}
            </div>
          </div>
          {selected ? (
            <MailDetail
              thread={selected}
              forwardAddress={forwardAddress}
              draft={drafts[selected.email.id] ?? null}
              threadMessages={threadMessages}
              reviews={reviews}
              retrying={retryingId === selected.email.id}
              onResolved={() => void load()}
              onRetry={() => void retryEmail(selected.email.id)}
              onReview={(reviewId, action) => void resolveDuplicate(reviewId, action)}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MailRow({ thread, selected, onSelect }: { thread: MailThread; selected: boolean; onSelect: () => void }) {
  const email = thread.email;
  const snippet = inboxSnippet(email.bodyText);
  return (
    <button
      type="button"
      role="option"
      className={`mail-row${selected ? ' is-selected' : ''}${thread.exceptions.length > 0 ? ' is-exception' : ''}`}
      data-mail-id={email.id}
      aria-selected={selected}
      onClick={onSelect}
    >
      <span className="mail-meta">
        <span className="mail-from">
          {thread.exceptions.length > 0 ? <span className={`mail-need-dot is-${thread.exceptions[0]}`} aria-hidden="true" /> : null}
          <span>{senderLabel(email)}</span>
        </span>
        <span>{inboxWhen(email.receivedAt)}</span>
      </span>
      <span className={`mail-subject${thread.exceptions.length === 0 && !email.style ? ' is-quiet' : ''}`}>{email.subject || 'No subject'}</span>
      {snippet ? <span className="mail-line">{snippet}</span> : null}
      <span className="mail-tags">
        {isReadingStatus(email.status) ? <span className="reading-tag">Reading</span> : null}
        {thread.exceptions.map((kind) => (
          <span className={`mail-tag mail-tag-${kind}`} key={kind}>
            {EXCEPTION_LABEL[kind]}
          </span>
        ))}
        <span className={`mail-style${email.style ? '' : ' is-none'}`}>{styleChip(email)}</span>
        {thread.copies.length > 0 ? <span className="mail-forwarded">Also forwarded · {thread.copies.length}</span> : null}
        {redeliveryNote(email.redeliveryCount) ? <span className="mail-forwarded">{redeliveryNote(email.redeliveryCount)}</span> : null}
      </span>
    </button>
  );
}

function BatchProgress({ progress, shown }: { progress: InboxProgress; shown: number }) {
  const current = currentBatch(progress);
  const percent = progressPercent(current);
  const headline =
    current.state === 'completed'
      ? progress.needsYou > 0
        ? `Finished. ${progress.needsYou} still need you`
        : 'Finished'
      : progressHeadline(current);
  const showingBatch = showsCurrentBatch(progress);
  return (
    <section className="inbox-progress" aria-label="Processing progress">
      {showingBatch ? <p className="muted">This batch</p> : null}
      <div className="inbox-progress-head">
        <strong>{headline}</strong>
        <span>{percent}%</span>
      </div>
      <div className="inbox-progress-track" aria-hidden="true">
        <div className="inbox-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="inbox-progress-counts">
        <span>{current.received} received</span>
        <span>{current.queued} queued</span>
        <span>{current.processing} processing</span>
        <span>{current.processed} filed</span>
        <span>{progress.needsYou} need you</span>
        <span>{current.failed} could not be read</span>
        {progress.openDuplicates > 0 ? <span>{progress.openDuplicates} possible duplicates</span> : null}
      </div>
      {showingBatch && progress.received !== current.received ? (
        <p className="muted">Whole inbox · {progress.received} received</p>
      ) : null}
      {shown > 0 && progress.received > shown ? <p className="muted">Showing the latest {shown} of {progress.received}.</p> : null}
    </section>
  );
}

function MailDetail({
  thread,
  forwardAddress,
  draft,
  threadMessages,
  reviews,
  retrying,
  onResolved,
  onRetry,
  onReview,
}: {
  thread: MailThread;
  forwardAddress?: string | null;
  draft: StyleDraft | null;
  threadMessages: StyleEmail[];
  reviews: DuplicateReview[];
  retrying: boolean;
  onResolved: () => void;
  onRetry: () => void;
  onReview: (reviewId: string, action: 'confirm' | 'dismiss') => void;
}) {
  const email = thread.email;
  const reading = isReadingStatus(email.status);
  const copyIds = new Set(thread.copies.map((copy) => copy.id));
  const conversation = threadMessages.filter((message) => message.id !== email.id && !copyIds.has(message.id));
  const attachments = (email.attachments ?? []).map((attachment) => ({ ...attachment, emailId: email.id }));

  return (
    <article className="inbox-detail" aria-label="Selected email">
      <header className="inbox-detail-head">
        <div className="mail-meta">
          <span>
            {senderLabel(email)}
            {forwardAddress ? ` · to ${forwardAddress}` : ''}
          </span>
          <span>{inboxWhen(email.receivedAt)}</span>
        </div>
        <h2>
          <Link className="inbox-subject-link" to={`/emails/${email.id}`}>
            {email.subject || 'No subject'}
          </Link>
        </h2>
        <div className="mail-tags">
          {reading ? <span className="reading-tag">Reading</span> : null}
          {thread.exceptions.map((kind) => (
            <span className={`mail-tag mail-tag-${kind}`} key={kind}>
              {EXCEPTION_LABEL[kind]}
            </span>
          ))}
          <span className={`mail-style${email.style ? '' : ' is-none'}`}>{styleChip(email)}</span>
        </div>
      </header>
      <div className="inbox-detail-grid">
        <div className="inbox-letter">
          <div className="mail-body">{email.bodyText?.trim() || 'No text body.'}</div>
          <AttachmentGrid attachments={attachments} emptyMessage="No attachments." />
          {thread.copies.length > 0 ? (
            <section className="also-forwarded" aria-label="Also forwarded">
              <h3>Also forwarded</h3>
              <ul>
                {thread.copies.map((copy) => {
                  const problems = deliveryProblems(copy).map((kind) => EXCEPTION_LABEL[kind]);
                  return (
                    <li key={copy.id}>
                      <span>
                        Also forwarded by {senderLabel(copy)} · {inboxWhen(copy.receivedAt)}
                        {problems.length > 0 ? ` · ${problems.join(', ')}` : ''}
                        {redeliveryNote(copy.redeliveryCount) ? ` · ${redeliveryNote(copy.redeliveryCount)}` : ''}
                      </span>
                      <Link to={`/emails/${copy.id}`}>Open email</Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {conversation.length > 0 ? (
            <section aria-label="Conversation">
              <h3>Conversation</h3>
              <div className="thread-list">
                {conversation.map((message) => (
                  <Link className="thread-item" key={message.id} to={`/emails/${message.id}`}>
                    <div className="who">{message.subject || 'No subject'}</div>
                    <div className="snippet">{message.fromName || message.fromAddress}</div>
                    <div className="when">{inboxWhen(message.receivedAt)}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="inbox-found">
          <span className="inbox-forwarded">What Spindle found</span>
          {reading ? <p>Spindle is reading this email. A clear style number is filed on the Range board when the read finishes.</p> : null}
          {!reading && thread.exceptions.includes('could-not-read') && deliveryProblems(email).includes('could-not-read') ? (
            <p>{email.issueReason || 'Spindle could not read this email. The file is still here to open.'}</p>
          ) : null}
          {thread.copies.map((copy) => {
            const problems = deliveryProblems(copy);
            if (problems.length === 0) return null;
            return (
              <p key={copy.id}>
                {problems.map((kind) => EXCEPTION_LABEL[kind]).join(', ')} on the delivery from {senderLabel(copy)}.{' '}
                <Link to={`/emails/${copy.id}`}>Open that delivery</Link>
              </p>
            );
          })}
          {!reading && email.issueKind === 'REPEATED_FAILURE' ? (
            <p>Automatic retries have stopped. You can try again when you are ready.</p>
          ) : null}
          {!reading && (email.issueKind === 'MISSING_ATTACHMENT' || email.issueKind === 'UNSUPPORTED_FORMAT' || email.issueKind === 'INCOMPLETE' || email.issueKind === 'MANUAL_REVIEW') && email.issueReason ? (
            <p>{email.issueReason}</p>
          ) : null}
          {email.duplicateVerdict === 'CONFIRMED' ? (
            <p>
              Confirmed duplicate.
              {email.duplicateOfEmailId ? (
                <>
                  {' '}
                  <Link to={`/emails/${email.duplicateOfEmailId}`}>Open the original</Link>
                </>
              ) : null}
            </p>
          ) : null}
          {redeliveryNote(email.redeliveryCount) ? <p>{redeliveryNote(email.redeliveryCount)}</p> : null}
          {canRetryEmail(email) ? (
            <button className="btn btn-secondary" type="button" disabled={retrying} onClick={onRetry}>
              {retrying ? 'Queuing…' : 'Try again'}
            </button>
          ) : null}
          {reviews.length > 0 ? (
            <div className="style-matches">
              {reviews.map((review) => (
                <div className="candidate" key={review.id}>
                  <span>
                    {review.verdict === 'CONFIRMED' ? 'Confirmed duplicate' : 'Possible duplicate'}
                    <span className="muted"> · {review.reason}</span>
                    {review.matchedStyle ? (
                      <span className="muted">
                        {' '}
                        · {review.matchedStyle.styleNumber} {review.matchedStyle.name}
                      </span>
                    ) : null}
                  </span>
                  <span className="mail-actions">
                    {review.matchedStyle ? (
                      <Link className="btn btn-secondary" to={`/styles/${review.matchedStyle.id}`}>
                        Open style
                      </Link>
                    ) : null}
                    {review.matchedEmail ? (
                      <Link className="btn btn-secondary" to={`/emails/${review.matchedEmail.id}`}>
                        Open email
                      </Link>
                    ) : null}
                    {review.status === 'OPEN' ? (
                      <>
                        <button className="btn btn-secondary" type="button" onClick={() => onReview(review.id, 'confirm')}>
                          Mark duplicate
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => onReview(review.id, 'dismiss')}>
                          Not a duplicate
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {!reading && thread.disagreements.length > 0 ? (
            <>
              <p>Emails disagree. The checked value stays until you pick.</p>
              {thread.disagreements.map((row) => (
                <FieldBlock key={row.id} field={reviewField(row)} revisions={[]} onChanged={onResolved} compact />
              ))}
            </>
          ) : null}
          {!reading && thread.exceptions.includes('which-style') ? (
            <WhichStyle thread={thread} draft={draft} onResolved={onResolved} />
          ) : null}
          {!reading && email.style ? <FoundValues styleId={email.style.id} emailId={email.id} onChanged={onResolved} /> : null}
          {!reading && thread.exceptions.length === 0 && email.style ? (
            <>
              <p>This email is on {styleChip(email)}.</p>
              <Link className="inbox-open-style" to={`/styles/${email.style.id}`}>
                Open {email.style.styleNumber}
              </Link>
            </>
          ) : null}
          {!reading && thread.exceptions.length === 0 && !email.style ? <p>Nothing to check on this email.</p> : null}
        </aside>
      </div>
    </article>
  );
}

function WhichStyle({
  thread,
  draft,
  onResolved,
}: {
  thread: MailThread;
  draft: StyleDraft | null;
  onResolved: () => void;
}) {
  const email = thread.email;
  const [styleNumber, setStyleNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function assign(body: { styleId?: string; styleNumber?: string }) {
    setBusy(true);
    setLocalError(null);
    try {
      await api.assignEmailStyle(email.id, body);
      onResolved();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to file this email');
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    setLocalError(null);
    try {
      await api.markEmailNotAboutStyle(email.id);
      onResolved();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to set this email aside');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p>This email doesn't name a style. Which one is it about?</p>
      {localError ? <div className="error">{localError}</div> : null}
      {thread.identity ? <CandidatePicker row={{ ...thread.identity, email }} onResolved={onResolved} /> : null}
      {draft && draft.matches.length > 0 ? (
        <div className="style-matches">
          {draft.matches.map((match) => (
            <div className="candidate" key={match.styleId}>
              <span>
                {match.styleNumber} · {match.name}
                <span className="muted"> · {matchKindLabel(match.kind)}</span>
              </span>
              <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void assign({ styleId: match.styleId })}>
                This style
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <form
        className="field"
        onSubmit={(event) => {
          event.preventDefault();
          const value = styleNumber.trim();
          if (!value) return;
          void assign({ styleNumber: value });
        }}
      >
        <label htmlFor={`tell-style-${email.id}`}>Tell me which style it is about</label>
        <input
          id={`tell-style-${email.id}`}
          value={styleNumber}
          onChange={(event) => setStyleNumber(event.target.value)}
          placeholder="Style number"
          disabled={busy}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || styleNumber.trim().length === 0}>
          File on this style
        </button>
      </form>
      <button className="inbox-dismiss" type="button" disabled={busy} onClick={() => void dismiss()}>
        Not about a style
      </button>
    </>
  );
}

function FoundValues({ styleId, emailId, onChanged }: { styleId: string; emailId: string; onChanged: () => void }) {
  const [fields, setFields] = useState<StyleFieldView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api
      .getStyle(styleId)
      .then((style) => {
        if (cancelled) return;
        const views = Object.values(style.fields ?? {}).filter((field) => field.field !== 'brand');
        const mine = views.filter((field) => field.emailId === emailId);
        const pending = views.filter(
          (field) =>
            field.confirmationStatus === 'PROPOSED' ||
            field.confirmationStatus === 'UNCONFIRMED' ||
            field.confirmationStatus === 'NEEDS_REVIEW' ||
            field.proposedDiffersFromConfirmed,
        );
        setFields(mine.length > 0 ? mine : pending);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [styleId, emailId]);

  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((field) => (
        <FieldBlock key={field.field} field={field} revisions={[]} onChanged={onChanged} compact />
      ))}
    </>
  );
}
