import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken, setWorkspaceId } from '../api';
import type { InvitationPreview } from '../types';

function displayRole(role: string) {
  if (role === 'OWNER') return 'Owner';
  if (role === 'MEMBER') return 'Member';
  return role;
}

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function AcceptInvitationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setInvitation(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setInvitation(null);

    api
      .getInvitation(token)
      .then((preview) => {
        if (!cancelled) setInvitation(preview);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'This invitation cannot be used');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!invitation) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await api.acceptInvitation({
        token,
        firstName,
        lastName,
        password,
      });
      const workspace =
        result.workspaces.find((item) => item.id === invitation.workspace.id) ?? result.workspaces[0];
      if (!workspace) {
        throw new Error('No workspace on this account');
      }
      setToken(result.accessToken);
      setWorkspaceId(workspace.id);
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to accept this invitation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="eyebrow">Invitation</div>
        <h1>Join workspace</h1>
        {!token ? (
          <>
            <p>This invitation link is missing its token. Ask the workspace owner to send a new invite.</p>
            <p className="login-switch">
              <Link to="/login">Sign in</Link>
            </p>
          </>
        ) : loading ? (
          <p>Checking this invitation…</p>
        ) : loadError ? (
          <>
            <div className="error">{loadError}</div>
            <p>Ask the workspace owner for a new invitation if this one has expired or already been used.</p>
            <p className="login-switch">
              <Link to="/login">Sign in</Link>
            </p>
          </>
        ) : invitation ? (
          <>
            <p>
              You are joining <strong>{invitation.workspace.name}</strong> as {displayRole(invitation.role)}. This
              link expires on {formatExpiry(invitation.expiresAt)}.
            </p>
            {formError ? <div className="error">{formError}</div> : null}
            <div className="field">
              <label htmlFor="invitedEmail">Email</label>
              <input id="invitedEmail" value={invitation.email} readOnly />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="firstName">First name</label>
                <input
                  id="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="lastName">Last name</label>
                <input
                  id="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
              <span className="field-hint">
                At least 10 characters. If this email already has a Spindle account, use that account&apos;s password.
              </span>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Joining…' : 'Accept invitation'}
            </button>
          </>
        ) : null}
      </form>
    </div>
  );
}
