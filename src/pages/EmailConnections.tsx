import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, getWorkspaceId } from '../api';
import { pickForwardingAddress } from '../lib/shell';
import type { EmailAccount } from '../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function addedWhen(account: EmailAccount) {
  const date = new Date(account.createdAt);
  if (Number.isNaN(date.getTime())) return 'same Inbox';
  const when = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const name = account.displayName?.trim();
  return [name ? `Added as ${name}` : 'Added', when, 'same Inbox'].join(' · ');
}

function forwardingGuides(address: string | null) {
  const target = address ?? 'your forwarding address';
  return [
    {
      title: 'Gmail',
      steps: [
        `Settings → See all settings → Forwarding and POP/IMAP. Add ${target} and confirm the code Spindle sends you.`,
        'In Filters, create a filter for your suppliers’ addresses.',
        `Choose Forward it to ${target}. Tick Also apply to matching conversations to send past emails.`,
      ],
      note: 'Spindle shows the confirmation code in your Inbox, so you don’t have to look for it.',
    },
    {
      title: 'Outlook',
      steps: [
        'Settings → Mail → Rules → Add new rule.',
        'Condition: From, then add your suppliers’ addresses or domains.',
        `Action: Forward to ${target}. Save, then Run rule now to send past emails.`,
      ],
      note: 'Some company accounts block automatic forwarding. If yours does, your IT team can allow this address.',
    },
  ];
}

export function EmailConnectionsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setListError(null);
    if (!getWorkspaceId()) {
      setAccounts([]);
      setListError('Select a workspace before connecting a forwarding address.');
      setLoading(false);
      return;
    }
    try {
      setAccounts(await api.listEmailAccounts());
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unable to load forwarding addresses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const forwards = accounts.filter(
    (account) => account.provider === 'FORWARD' && account.status !== 'DISCONNECTED' && account.emailAddress.trim(),
  );
  const primaryAddress = pickForwardingAddress(accounts);
  const primary = forwards.find((account) => account.emailAddress.trim() === primaryAddress) ?? null;
  const extras = forwards.filter((account) => account.id !== primary?.id);
  const guides = forwardingGuides(primary?.emailAddress ?? null);

  async function copyAddress() {
    if (!primary || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(primary.emailAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const email = emailAddress.trim().toLowerCase();
    if (!email) {
      setFormError('Enter a forwarding email address.');
      setSuccess(null);
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setFormError('Enter a valid email address.');
      setSuccess(null);
      return;
    }
    if (!getWorkspaceId()) {
      setFormError('Select a workspace before connecting a forwarding address.');
      setSuccess(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setSuccess(null);
    try {
      const created = await api.createEmailAccount({ emailAddress: email });
      setEmailAddress('');
      setSuccess(`${created.emailAddress} is registered for this workspace.`);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message || 'This receiving address is already registered.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Unable to register this address');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function removeAddress(account: EmailAccount) {
    setRemovingId(account.id);
    setFormError(null);
    try {
      await api.removeEmailAccount(account.id);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to remove this address');
    } finally {
      setRemovingId(null);
    }
  }

  const addForm = (
    <form className="fwd-add" onSubmit={(event) => void onSubmit(event)} noValidate>
      <label className="sr-only" htmlFor="forwarding-email">
        Forwarding address
      </label>
      <input
        id="forwarding-email"
        name="emailAddress"
        type="email"
        inputMode="email"
        autoComplete="off"
        value={emailAddress}
        onChange={(event) => setEmailAddress(event.target.value)}
        placeholder="name@your-domain"
        aria-invalid={formError ? true : undefined}
        disabled={submitting}
        required
      />
      <button className="fwd-add-btn" type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add address'}
      </button>
    </form>
  );

  return (
    <div className="page forwarding-page">
      <header className="hero">
        <span className="forwarding-kicker">Settings · Forwarding</span>
        <h1>Forwarding</h1>
        <p className="forwarding-lede">How supplier emails reach Spindle, and who is allowed to send them.</p>
      </header>

      {listError ? (
        <div className="error" role="alert">
          {listError}
        </div>
      ) : null}
      {formError ? (
        <div className="error" role="alert">
          {formError}
        </div>
      ) : null}
      {success ? (
        <div className="flash" role="status">
          {success}
        </div>
      ) : null}

      <section className="fwd-grid" aria-label="Forwarding addresses">
        <div>
          <span className="fwd-kicker">Your address</span>
          {loading ? <p className="fwd-quiet">Loading your forwarding address…</p> : null}
          {!loading && primary ? (
            <div className="fwd-own">
              <span className="fwd-own-address">{primary.emailAddress}</span>
              <button type="button" className="fwd-copy" onClick={() => void copyAddress()}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : null}
          {!loading && !primary && !listError ? (
            <p className="fwd-note">Add the address mail is forwarded to. That address is the one that can receive email.</p>
          ) : null}
          {primary ? (
            <p className="fwd-note">
              One address for this workspace, for every season. Most emails arrive because someone on your team forwards them.
              Suppliers can also copy it in directly.
            </p>
          ) : null}
          {primary?.lastSyncAt ? <p className="fwd-quiet">A message was delivered to this address.</p> : null}
        </div>

        <div>
          <span className="fwd-kicker">A second address</span>
          {extras.map((account) => (
            <div className="fwd-extra" key={account.id}>
              <span>
                <span className="fwd-extra-address">{account.emailAddress}</span>
                <span className="fwd-extra-meta">{addedWhen(account)}</span>
              </span>
              <button
                type="button"
                className="fwd-text-btn"
                disabled={removingId === account.id}
                onClick={() => void removeAddress(account)}
              >
                {removingId === account.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
          {addForm}
          <p className="fwd-note">
            Useful when a team or a shared mailbox forwards separately. Every address feeds the same Inbox and range.
          </p>
        </div>
      </section>

      <section className="fwd-section" aria-labelledby="forward-rule-heading">
        <div className="fwd-section-head">
          <h2 id="forward-rule-heading">Set up a forwarding rule</h2>
          <p>Once, in your own email. Takes about two minutes.</p>
        </div>
        <div className="fwd-grid">
          {guides.map((guide) => (
            <div className="fwd-steps" key={guide.title}>
              <h3>{guide.title}</h3>
              {guide.steps.map((step, index) => (
                <div className="fwd-step" key={step}>
                  <span className="fwd-step-n">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
              <p className="fwd-aside">{guide.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fwd-section" aria-labelledby="who-reads-heading">
        <div className="fwd-section-head">
          <h2 id="who-reads-heading">Who Spindle reads</h2>
          <p>You don’t need to add suppliers. They are added the first time they appear in an email.</p>
        </div>
        <div className="fwd-read">
          <article className="fwd-read-card is-team">
            <div className="fwd-read-top">
              <h3>Your team</h3>
              <span className="fwd-pill is-trusted">Always trusted</span>
            </div>
            <p>People in this workspace.</p>
            <p>
              Everything a team member forwards is read, including forwards from a supplier Spindle hasn’t seen. That supplier
              is added to Suppliers for you.
            </p>
          </article>
          <article className="fwd-read-card">
            <div className="fwd-read-top">
              <h3>Known suppliers</h3>
              <span className="fwd-pill">Added for you</span>
            </div>
            <p>None yet.</p>
            <p>When a known supplier copies in your address or emails it directly, their email is read like a forward.</p>
          </article>
        </div>
        <div>
          <div className="fwd-table-head">
            <span>Known supplier</span>
            <span>Addresses</span>
            <span>Added</span>
            <span>Emails</span>
          </div>
          <div className="fwd-empty-row">Suppliers appear here the first time they email you.</div>
          <p className="fwd-aside">
            Remove stops direct emails from that supplier being read. Forwards from your team about them are still read.
          </p>
        </div>
      </section>

      <section className="fwd-section" aria-labelledby="unknown-heading">
        <div className="fwd-section-head">
          <h2 id="unknown-heading">Unknown and blocked</h2>
          <p>
            Emails sent straight to your address from someone who isn’t on your team or a known supplier. Nothing from them
            touches a style until you allow them. Unknown senders also wait in the Inbox.
          </p>
        </div>
        <div className="fwd-empty-row">No unknown or blocked senders.</div>
      </section>
    </div>
  );
}
