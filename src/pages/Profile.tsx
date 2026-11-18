import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, getWorkspaceId } from '../api';

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function ProfilePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('');
  const [savedName, setSavedName] = useState('');
  const [savedTimezone, setSavedTimezone] = useState('');
  const [owner, setOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getWorkspaceId()) {
        setError('Select a workspace before opening settings.');
        setLoading(false);
        return;
      }
      try {
        const [session, workspace] = await Promise.all([api.me(), api.getWorkspace()]);
        if (cancelled) return;
        const fullName = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ');
        setName(fullName);
        setSavedName(fullName);
        setEmail(session.user.email);
        setTimezone(workspace.timezone);
        setSavedTimezone(workspace.timezone);
        setOwner(workspace.role === 'OWNER');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load your profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = name.trim() !== savedName || (owner && timezone.trim() !== savedTimezone);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;
    const nextName = splitName(name);
    if (!nextName) {
      setError('Enter a first and last name.');
      setSuccess(null);
      return;
    }
    const nextTimezone = timezone.trim();
    if (owner && !nextTimezone) {
      setError('Enter a time zone.');
      setSuccess(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (name.trim() !== savedName) {
        const profile = await api.updateProfile(nextName);
        const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
        setName(fullName);
        setSavedName(fullName);
        setEmail(profile.email);
      }
      if (owner && nextTimezone !== savedTimezone) {
        const workspace = await api.updateWorkspace({ timezone: nextTimezone });
        setTimezone(workspace.timezone);
        setSavedTimezone(workspace.timezone);
      }
      setSuccess('Saved.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Only an owner can change the time zone.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to save your profile');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="page settings-page" onSubmit={(event) => void onSave(event)} noValidate>
      <header>
        <span className="forwarding-kicker">Settings · Profile</span>
        <h1>Profile</h1>
      </header>

      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="flash" role="status">
          {success}
        </div>
      ) : null}

      <div className="settings-rows">
        <div className="settings-row">
          <span className="settings-row-copy">
            <label className="settings-row-title" htmlFor="profile-name">
              Name
            </label>
            <span className="settings-row-detail">Shown to your team</span>
          </span>
          <input
            id="profile-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading || saving}
            autoComplete="name"
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-copy">
            <span className="settings-row-title">Work email</span>
            <span className="settings-row-detail">Used to sign in</span>
          </span>
          <span className="settings-row-value">{loading ? 'Loading…' : email}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-copy">
            <label className="settings-row-title" htmlFor="profile-timezone">
              Time zone
            </label>
            <span className="settings-row-detail">Dates on the board use this</span>
          </span>
          <input
            id="profile-timezone"
            name="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            disabled={loading || saving || !owner}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {owner ? null : <p className="settings-note">Only an owner can change the time zone.</p>}

      <button className="settings-save" type="submit" disabled={loading || saving || !dirty}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
