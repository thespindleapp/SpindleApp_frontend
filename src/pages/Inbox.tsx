import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { AttachmentGrid } from '../components/AttachmentGrid';
import { CandidatePicker } from '../components/CandidatePicker';
import { FieldBlock } from '../components/FieldBlock';
import { inboxSurface, isReadingStatus, supplierForwardMessage } from '../lib/empty';
import { canStartNewFromEmail, inboxItems, type InboxEmail } from '../lib/inbox';
import {
  EXCEPTION_LABEL,
  applyDraftChoice,
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
import type { ConfirmationRow, StyleDraft, StyleEmail, StyleFieldView } from '../types';

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
  const [listingId, setListingId] = useState<string | null>(null);
  const [forwardAddress, setForwardAddress] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState<'address' | 'message' | null>(null);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keyFocusId, setKeyFocusId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<StyleEmail[]>([]);
  const copiedTimer = useRef<number | null>(null);
  const loadRef = useRef<() => Promise<void>>(async () => undefined);

  async function load() {
    setError(null);
    try {
      const [received, pending] = await Promise.all([api.listInboxEmails(), loadConfirmations()]);
      setEmails(received);
      setConfirmations(pending);
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
  const needCount = threads.filter((thread) => thread.exceptions.length > 0).length;
  const showReading = surface === 'reading';
  const showMail = !loading && !error && emails.length > 0 && !showReading;

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (surface !== 'listening' && surface !== 'reading') return;
    const id = window.setInterval(() => {
      void loadRef.current();
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

  async function addToBoard(styleId: string) {
    setListingId(styleId);
    setError(null);
    try {
      await api.listStyleOnBoard(styleId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add this style to the Range Board');
    } finally {
      setListingId(null);
    }
  }

  return (
    <div className="page">
      {surface === 'listening' || showReading ? (
        <div className="page-head">
          <div>
            <div className="eyebrow">Inbox</div>
            <h1>{surface === 'listening' ? 'Inbox' : 'Review incoming styles'}</h1>
          </div>
        </div>
      ) : null}
      {surface === 'listening' ? <p className="lede">Spindle is listening for supplier email.</p> : null}
      {error ? <div className="error">{error}</div> : null}
      {surface === 'loading' ? <p className="muted">Loading the inbox…</p> : null}
      {surface === 'listening' ? (
        <section className="inbox-empty" aria-labelledby="inbox-empty-heading">
          {forwardAddress ? <p className="empty-kicker">Listening on {forwardAddress}</p> : null}
          {forwardAddress === null ? (
            <p className="empty-kicker">Register a forwarding address to start listening.</p>
          ) : null}
          <h2 id="inbox-empty-heading">No emails yet. Send one and watch it land here.</h2>
          <p>
            Spindle reads each email, finds the style it is about, and pulls out dates, costs and approvals for you to
            check.
          </p>
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
                <span>Not available yet. There is no mailbox sign-in.</span>
              </span>
            </div>
            <div className="inbox-way">
              <span className="n">3</span>
              <span>
                <strong>Ask suppliers to copy you in</strong>
                <span>They add the address once. Every reply can arrive here too.</span>
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
                <p>Nothing goes on the board until you check it.</p>
                {canStartNewFromEmail(email) ? (
                  <p>
                    <Link className="btn btn-secondary" to={`/emails/${email.id}/new`}>
                      New from email
                    </Link>
                  </p>
                ) : null}
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
              {forwardAddress ? <p className="empty-kicker">Forwarded to {forwardAddress}</p> : null}
              <div className="inbox-title-row">
                <h1 className="inbox-title">Inbox</h1>
                <span>
                  · {needCount} need you
                </span>
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
                <span className="muted">Newest first · J / K move through exceptions</span>
              </div>
            </div>
            <div className="inbox-rows" role="listbox" aria-label={filter === 'needs' ? 'Needs you' : 'All mail'}>
              {visible.map((thread) => (
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
              draft={drafts[selected.email.id] ?? null}
              threadMessages={threadMessages}
              listingId={listingId}
              onResolved={() => void load()}
              onAddToBoard={(styleId) => void addToBoard(styleId)}
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
        <span>{senderLabel(email)}</span>
        <span>{inboxWhen(email.receivedAt)}</span>
      </span>
      <span className="mail-subject">{email.subject || 'No subject'}</span>
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
      </span>
    </button>
  );
}

function MailDetail({
  thread,
  draft,
  threadMessages,
  listingId,
  onResolved,
  onAddToBoard,
}: {
  thread: MailThread;
  draft: StyleDraft | null;
  threadMessages: StyleEmail[];
  listingId: string | null;
  onResolved: () => void;
  onAddToBoard: (styleId: string) => void;
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
          <span>{senderLabel(email)}</span>
          <span>{inboxWhen(email.receivedAt)}</span>
        </div>
        <h2>
          <Link to={`/emails/${email.id}`}>{email.subject || 'No subject'}</Link>
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
                {thread.copies.map((copy) => (
                  <li key={copy.id}>
                    <span>
                      Also forwarded by {senderLabel(copy)} · {inboxWhen(copy.receivedAt)}
                      {copy.status === 'FAILED' ? ' · Could not read' : ''}
                    </span>
                    <Link to={`/emails/${copy.id}`}>Open email</Link>
                  </li>
                ))}
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
          <span className="empty-kicker">What Spindle found</span>
          {reading ? <p>Nothing goes on the board until you check it.</p> : null}
          {!reading && thread.exceptions.includes('could-not-read') ? (
            <p>Spindle could not read this email. The file is still here to open.</p>
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
            <>
              <p>This email is not on a style yet. Nothing is filed until you check it.</p>
              {thread.identity ? <CandidatePicker row={{ ...thread.identity, email }} onResolved={onResolved} /> : null}
              {draft && draft.matches.length > 0 ? (
                <div className="style-matches">
                  {draft.matches.map((match) => (
                    <div className="candidate" key={match.styleId}>
                      <span>
                        {match.styleNumber} · {match.name}
                        <span className="muted"> · {matchKindLabel(match.kind)}</span>
                      </span>
                      <Link className="btn btn-secondary" to={`/styles/${match.styleId}`}>
                        Open style
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}
              {canStartNewFromEmail(email) ? (
                <Link className="btn btn-secondary" to={`/emails/${email.id}/new`}>
                  New from email
                </Link>
              ) : null}
            </>
          ) : null}
          {!reading && thread.exceptions.length === 0 && email.style ? (
            <>
              <p>This email is on {styleChip(email)}.</p>
              <Link className="btn btn-secondary" to={`/styles/${email.style.id}`}>
                Open style
              </Link>
              {!email.style.listedAt ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={listingId === email.style.id}
                  onClick={() => onAddToBoard(email.style!.id)}
                >
                  Add to Range Board
                </button>
              ) : null}
            </>
          ) : null}
          {!reading && thread.exceptions.length === 0 && !email.style ? (
            <>
              <p>Nothing to check on this email.</p>
              {canStartNewFromEmail(email) ? (
                <Link className="btn btn-secondary" to={`/emails/${email.id}/new`}>
                  New from email
                </Link>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
