import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, getWorkspaceId } from '../api';
import type { EmailAccount, EmailAccountStatus, EmailProvider } from '../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX = 120;

const STATUS_LABEL: Record<EmailAccountStatus, string> = {
  PENDING: 'Registered',
  CONNECTED: 'Received',
  DISCONNECTED: 'Disconnected',
  ERROR: 'Error',
};

function deliveryState(account: EmailAccount): { label: string; note: string; tone: EmailAccountStatus } {
  if (account.status === 'CONNECTED' && account.lastSyncAt) {
    return {
      label: STATUS_LABEL.CONNECTED,
      note: 'A message was delivered to this address.',
      tone: 'CONNECTED',
    };
  }
  if (account.status === 'PENDING' || account.status === 'CONNECTED') {
    return {
      label: STATUS_LABEL.PENDING,
      note: 'Registered only. No inbound message has been matched to this address yet.',
      tone: 'PENDING',
    };
  }
  return {
    label: STATUS_LABEL[account.status],
    note: account.status === 'ERROR' ? 'The last delivery attempt failed.' : 'This address is not receiving mail.',
    tone: account.status,
  };
}

const PROVIDER_LABEL: Record<EmailProvider, string> = {
  FORWARD: 'Forwarding',
  GMAIL: 'Gmail',
  OUTLOOK: 'Outlook',
};

function formatWhen(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function EmailConnectionsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load(mode: 'initial' | 'refresh' = 'initial') {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setListError(null);
    if (!getWorkspaceId()) {
      setAccounts([]);
      setListError('Select a workspace before connecting a forwarding address.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const items = await api.listEmailAccounts();
      setAccounts(items);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unable to load email connections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const email = emailAddress.trim().toLowerCase();
    const name = displayName.trim();
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
    if (name.length > DISPLAY_NAME_MAX) {
      setFormError(`Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`);
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
      const created = await api.createEmailAccount({
        emailAddress: email,
        ...(name ? { displayName: name } : {}),
      });
      setEmailAddress('');
      setDisplayName('');
      setSuccess(`${created.emailAddress} is registered for this workspace.`);
      await load('refresh');
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

  const listBusy = loading || refreshing;

  return (
    <div className="page connections">
      <header className="hero">
        <div className="connections-kicker">Settings</div>
        <h1>Email connections</h1>
        <p className="lede">
          Register the inbound address that appears in Resend&apos;s To or recipient field. Spindle routes a message
          only when that address matches exactly one active workspace. A saved row is not a verified delivery, and
          Gmail or Outlook sign-in is not available.
        </p>
      </header>

      <div className="connections-layout">
        <section className="connections-card" aria-labelledby="forward-heading">
          <h2 id="forward-heading">Add a receiving address</h2>
          <p>
            Enter the address mail is received at, such as hello@your-domain.resend.app. Do not enter the sender&apos;s
            Gmail or Outlook address. Registration saves it for this workspace and does not prove a message has arrived.
          </p>
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
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="forwarding-email">Receiving address</label>
              <input
                id="forwarding-email"
                name="emailAddress"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={emailAddress}
                onChange={(event) => setEmailAddress(event.target.value)}
                placeholder="hello@your-domain.resend.app"
                aria-invalid={formError ? true : undefined}
                aria-describedby="forwarding-email-hint"
                disabled={submitting}
                required
              />
              <span id="forwarding-email-hint" className="field-hint">
                This must be the exact To or recipient address from Resend, not the address that sent the mail.
              </span>
            </div>
            <div className="field">
              <label htmlFor="forwarding-name">Display name</label>
              <input
                id="forwarding-name"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Optional, such as Factory inbox"
                maxLength={DISPLAY_NAME_MAX}
                autoComplete="off"
                disabled={submitting}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Registering…' : 'Register address'}
            </button>
          </form>
        </section>

        <section className="connections-card" aria-labelledby="accounts-heading">
          <div className="connections-list-head">
            <h2 id="accounts-heading">Registered addresses</h2>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void load('refresh')}
              disabled={listBusy}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {listError ? (
            <div className="error" role="alert">
              {listError}
            </div>
          ) : null}
          {loading ? <p className="connections-muted">Loading email connections…</p> : null}
          {!loading && !listError && accounts.length === 0 ? (
            <p className="connections-muted">No receiving addresses yet. Register the Resend recipient address for this workspace.</p>
          ) : null}
          {!loading && accounts.length > 0 ? (
            <ul className="connections-list">
              {accounts.map((account) => {
                const synced = formatWhen(account.lastSyncAt);
                const delivery = deliveryState(account);
                return (
                  <li key={account.id}>
                    <div className="connections-account">
                      <div>
                        <div className="connections-address">{account.emailAddress}</div>
                        <div className="connections-meta">
                          {account.displayName ? <span>{account.displayName}</span> : null}
                          <span>{PROVIDER_LABEL[account.provider]}</span>
                        </div>
                      </div>
                      <span className={`connections-status is-${delivery.tone.toLowerCase()}`}>{delivery.label}</span>
                    </div>
                    <p className="connections-detail">{delivery.note}</p>
                    {synced ? <p className="connections-detail">Last delivery {synced}</p> : null}
                    {account.lastError ? <p className="connections-detail">Last error: {account.lastError}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
