import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, getWorkspaceId } from '../api';
import { initials, publishTeamCount, roleLabel } from '../lib/shell';
import type { WorkspaceMember } from '../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLORS = ['#E9D98A', '#C9D3B4', '#D3D7CF', '#D6CEDF', '#E5BBA4', '#EFEAE0'];
const ROLE_OPTIONS = ['OWNER', 'MEMBER'] as const;
const PERMISSIONS = [
  { label: 'See cost and value', owner: true, member: true },
  { label: 'Check values', owner: true, member: true },
  { label: 'Edit styles', owner: true, member: true },
  { label: 'Invite people', owner: true, member: false },
  { label: 'Remove people', owner: true, member: false },
  { label: 'Change workspace settings', owner: true, member: false },
] as const;

function personName(member: WorkspaceMember) {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name || member.email;
}

function canRemove(member: WorkspaceMember, viewerIsOwner: boolean) {
  return viewerIsOwner && member.status === 'ACTIVE' && member.role !== 'OWNER' && Boolean(member.userId);
}

function seesCost(member: WorkspaceMember) {
  return member.status === 'ACTIVE';
}

function lastActive(member: WorkspaceMember, now = Date.now()) {
  if (member.status === 'PENDING') return 'Invited';
  if (!member.lastLoginAt) return '—';
  const then = new Date(member.lastLoginAt).getTime();
  if (Number.isNaN(then)) return '—';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 h ago' : `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function TeamPage() {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    setListError(null);
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      setMembers([]);
      setListError('Select a workspace before inviting your team.');
      setLoading(false);
      return;
    }
    try {
      const [people, session] = await Promise.all([api.listMembers(), api.me()]);
      const workspace = session.workspaces.find((item) => item.id === workspaceId);
      setViewerRole(workspace?.role ?? null);
      setMembers(people);
      publishTeamCount(people.length);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unable to load the team');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const viewerIsOwner = viewerRole === 'OWNER';
  const countLabel = `${members.length} ${members.length === 1 ? 'person' : 'people'}`;

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const address = email.trim().toLowerCase();
    if (!address) {
      setFormError('Enter an email address.');
      setSuccess(null);
      return;
    }
    if (!EMAIL_PATTERN.test(address)) {
      setFormError('Enter a valid email address.');
      setSuccess(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setSuccess(null);
    try {
      const invited = await api.inviteMember(address);
      setEmail('');
      setSuccess(
        invited.status === 'PENDING' ? `${invited.email} is invited.` : `${personName(invited)} is on the team.`,
      );
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setFormError('Only an owner can invite people.');
      } else if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message || 'That person is already on the team.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Unable to send this invitation');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function removePerson(member: WorkspaceMember) {
    if (!member.userId) return;
    setRemovingId(member.userId);
    setFormError(null);
    try {
      await api.removeMember(member.userId);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to remove this person');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="page team-page">
      <header className="team-head">
        <div>
          <span className="forwarding-kicker">Settings · Team</span>
          <h1>Team and roles</h1>
          <p className="forwarding-lede">{loading ? 'Loading the team…' : countLabel}</p>
        </div>
        <form className="team-invite" onSubmit={(event) => void onInvite(event)} noValidate>
          <label className="sr-only" htmlFor="team-email">
            Email address
          </label>
          <input
            id="team-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@yourbrand.com"
            aria-invalid={formError ? true : undefined}
            disabled={submitting}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Inviting…' : 'Invite'}
          </button>
        </form>
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

      <div className="team-table" role="table" aria-label="Team">
        <div className="team-row team-head-row" role="row">
          <span role="columnheader">Person</span>
          <span role="columnheader">Role</span>
          <span className="team-cost" role="columnheader">
            Sees cost
          </span>
          <span className="team-last" role="columnheader">
            Last active
          </span>
          <span role="columnheader" />
        </div>
        {!loading && members.length === 0 && !listError ? (
          <p className="fwd-empty-row">No one is on the team yet.</p>
        ) : null}
        {members.map((member, index) => {
          const name = personName(member);
          const removable = canRemove(member, viewerIsOwner);
          const cost = seesCost(member);
          return (
            <div className="team-row" role="row" key={member.userId ?? member.email}>
              <span className="team-person" role="cell">
                <span className="team-avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }} aria-hidden="true">
                  {initials(member.firstName ?? '', member.lastName ?? '', member.email)}
                </span>
                <span className="team-id">
                  <span className="team-name">{name}</span>
                  <span className="team-email">{member.email}</span>
                </span>
              </span>
              <span role="cell">
                <select className="team-role" aria-label={`Role for ${name}`} value={member.role} disabled>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </span>
              <span className="team-cost" role="cell">
                <span className="team-cost-swatch" style={{ background: cost ? '#C9D3B4' : '#DCD4C6' }} aria-hidden="true" />
                {cost ? 'Yes' : 'Hidden'}
              </span>
              <span className="team-last" role="cell">
                {lastActive(member)}
              </span>
              <span role="cell">
                {removable ? (
                  <button
                    type="button"
                    className="team-remove"
                    aria-label={`Remove ${name}`}
                    disabled={removingId === member.userId}
                    onClick={() => void removePerson(member)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <section className="team-roles" aria-labelledby="roles-heading">
        <div className="team-roles-head">
          <h2 id="roles-heading">What each role can do</h2>
          <p>Owner is fixed. People you invite join as members.</p>
        </div>
        <div className="team-matrix">
          <span />
          <span className="team-matrix-role">Owner</span>
          <span className="team-matrix-role">Member</span>
          {PERMISSIONS.map((permission) => (
            <PermissionRow key={permission.label} label={permission.label} owner={permission.owner} member={permission.member} />
          ))}
        </div>
        <p className="team-roles-note">
          Suppliers don't need an account. They keep emailing you as they do now. Anyone without cost access sees “—” in
          cost and value columns, and in exports.
        </p>
      </section>
    </div>
  );
}

function PermissionMark({ on }: { on: boolean }) {
  return (
    <span className={on ? 'team-check is-on' : 'team-check'}>
      {on ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F8F5EE" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : null}
    </span>
  );
}

function PermissionRow({ label, owner, member }: { label: string; owner: boolean; member: boolean }) {
  return (
    <>
      <span className="team-matrix-label">{label}</span>
      <span className="team-matrix-cell" aria-label={`${owner ? 'Allowed' : 'Not allowed'}: ${label} for Owner`}>
        <PermissionMark on={owner} />
      </span>
      <span className="team-matrix-cell" aria-label={`${member ? 'Allowed' : 'Not allowed'}: ${label} for Member`}>
        <PermissionMark on={member} />
      </span>
    </>
  );
}
