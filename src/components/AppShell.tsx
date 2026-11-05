import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { api, getWorkspaceId } from '../api';
import type { InboxEmail } from '../lib/inbox';
import {
  initials,
  needsAttentionCount,
  pickForwardingAddress,
  roleLabel,
  workspaceForSession,
} from '../lib/shell';
import type { ConfirmationRow, EmailAccount, StyleCard } from '../types';

const PHONE_QUERY = '(max-width: 720px)';

const TAB_ICONS = {
  range: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z',
  inbox: 'M4 13l2.5-7h11L20 13v6H4zM4 13h5l1 2h4l1-2h5',
  account: 'M12 12a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4',
};

type ShellAccount = {
  initials: string;
  name: string;
  email: string;
  role: string;
  workspaceName: string;
};

type LoadResult<T> = { ok: true; value: T } | { ok: false };

function phoneLayoutNow() {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
  } catch {
    return false;
  }
}

function usePhoneLayout() {
  const [phone, setPhone] = useState(phoneLayoutNow);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return phone;
}

async function load<T>(task: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, value: await task() };
  } catch {
    return { ok: false };
  }
}

function TabIcon({ d }: { d: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function AccountMenu({
  menuRef,
  id,
  account,
  onClose,
  onSignOut,
}: {
  menuRef: RefObject<HTMLDivElement>;
  id: string;
  account: ShellAccount | null;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="acct-menu" id={id} role="menu" ref={menuRef}>
      <div className="acct-menu-meta">
        <div>{account?.name ?? 'Account'}</div>
        {account?.email ? <div className="muted">{account.email}</div> : null}
        {account?.workspaceName ? <div className="muted">{account.workspaceName}</div> : null}
        {account?.role ? <div className="muted">{account.role}</div> : null}
      </div>
      <span className="acct-menu-unavailable" role="menuitem" aria-disabled="true">
        <span>Account settings</span>
        <span className="acct-menu-note">Not available yet</span>
      </span>
      <span className="acct-menu-unavailable" role="menuitem" aria-disabled="true">
        <span>Team members</span>
        <span className="acct-menu-note">Not available yet</span>
      </span>
      <span className="acct-menu-unavailable" role="menuitem" aria-disabled="true">
        <span>Subscription and invoices</span>
        <span className="acct-menu-note">Not available yet</span>
      </span>
      <NavLink to="/settings/email-connections" role="menuitem" onClick={onClose}>
        Forwarding addresses
      </NavLink>
      <button type="button" role="menuitem" className="acct-menu-logout" onClick={onSignOut}>
        Log out
      </button>
    </div>
  );
}

export function AppShell() {
  const { signOut: endSession } = useAuth();
  const { pathname } = useLocation();
  const phone = usePhoneLayout();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const [account, setAccount] = useState<ShellAccount | null>(null);
  const [forwardingAddress, setForwardingAddress] = useState<string | null>(null);
  const [forwardingKnown, setForwardingKnown] = useState(false);
  const [attention, setAttention] = useState<number | null>(null);
  const [rangeCount, setRangeCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const rangeActive = pathname === '/' || pathname.startsWith('/styles/');
  const inboxActive = pathname === '/inbox' || pathname.startsWith('/emails/');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [meResult, accountsResult, emailsResult, confirmationsResult, stylesResult] = await Promise.all([
        load(() => api.me()),
        load(() => api.listEmailAccounts()),
        load(() => api.listInboxEmails()),
        load(() => api.listConfirmations({ limit: 100 })),
        load(() => api.listStyles({ limit: 100 })),
      ]);
      if (cancelled) return;
      if (meResult.ok) {
        const workspace = workspaceForSession(meResult.value.workspaces, getWorkspaceId());
        const firstName = meResult.value.user.firstName.trim();
        const lastName = meResult.value.user.lastName.trim();
        const name = [firstName, lastName].filter(Boolean).join(' ') || meResult.value.user.email;
        setAccount({
          initials: initials(firstName, lastName, name),
          name,
          email: meResult.value.user.email,
          role: workspace ? roleLabel(workspace.role) : '',
          workspaceName: workspace?.name ?? '',
        });
      } else {
        setAccount(null);
      }
      if (accountsResult.ok) {
        setForwardingAddress(pickForwardingAddress(accountsResult.value as EmailAccount[]));
        setForwardingKnown(true);
      } else {
        setForwardingAddress(null);
        setForwardingKnown(false);
      }
      if (emailsResult.ok && confirmationsResult.ok) {
        setAttention(
          needsAttentionCount(emailsResult.value as InboxEmail[], confirmationsResult.value as ConfirmationRow[]),
        );
      } else {
        setAttention(null);
      }
      if (stylesResult.ok) {
        setRangeCount((stylesResult.value as StyleCard[]).length);
      } else {
        setRangeCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-account-trigger]')) return;
      setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  async function copyAddress() {
    if (!forwardingAddress || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(forwardingAddress);
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function signOut() {
    setMenuOpen(false);
    void endSession();
  }

  function toggleMenu() {
    setMenuOpen((open) => !open);
  }

  const inboxLabel =
    attention === null ? 'Inbox' : attention > 0 ? `Inbox, ${attention} need you` : 'Inbox, 0';

  const forwarding = forwardingKnown ? (
    forwardingAddress ? (
      <div className="side-forward">
        <span className="side-kicker">Forward to</span>
        <span className="side-address">{forwardingAddress}</span>
        <button type="button" className="forward-copy" onClick={() => void copyAddress()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    ) : (
      <NavLink to="/settings/email-connections" className="side-forward-link">
        Register a forwarding address
      </NavLink>
    )
  ) : null;

  const menu = menuOpen ? (
    <AccountMenu
      menuRef={menuRef}
      id={menuId}
      account={account}
      onClose={() => setMenuOpen(false)}
      onSignOut={signOut}
    />
  ) : null;

  return (
    <div className={phone ? 'app app-phone' : 'app'}>
      {phone ? (
        <header className="mobile-top">
          <div className="mobile-brand-block">
            <NavLink to="/" className="brand">
              <img className="brand-mark" src="/spindle-mark.svg" alt="" />
              <span className="mark">spindle</span>
            </NavLink>
            {account?.workspaceName ? <div className="mobile-workspace">{account.workspaceName}</div> : null}
            {forwarding}
          </div>
          <button
            type="button"
            className="mobile-acct"
            data-account-trigger
            aria-label="Account menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={toggleMenu}
          >
            <span className="av" aria-hidden="true">
              {account?.initials ?? ''}
            </span>
          </button>
        </header>
      ) : (
        <aside className="side" aria-label="Sidebar">
          <NavLink to="/" className="brand">
            <img className="brand-mark" src="/spindle-mark.svg" alt="" />
            <span className="mark">spindle</span>
          </NavLink>

          <nav className="side-nav" aria-label="Workspace">
            {account?.workspaceName ? <div className="side-label">{account.workspaceName}</div> : null}
            <NavLink to="/" end className={() => (rangeActive ? 'active' : '')}>
              <span>Range</span>
              {rangeCount !== null ? <span className="count">{rangeCount}</span> : null}
            </NavLink>
            <span className="nav-unavailable">
              <span>Suppliers</span>
              <span className="nav-soon">Soon</span>
            </span>
            <NavLink to="/inbox" className={() => (inboxActive ? 'active' : '')} aria-label={inboxLabel}>
              <span>Inbox</span>
              {attention !== null ? (
                <span className="nav-attention">
                  {attention > 0 ? <span className="butter-dot" aria-hidden="true" /> : null}
                  <span className="count">{attention}</span>
                </span>
              ) : null}
            </NavLink>
          </nav>

          <div className="side-foot">
            {forwarding}
            <div className="acct">
              <button
                type="button"
                className="acct-open"
                data-account-trigger
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={menuOpen ? menuId : undefined}
                onClick={toggleMenu}
              >
                <span className="av" aria-hidden="true">
                  {account?.initials ?? ''}
                </span>
                <span className="acct-id">
                  <span className="who">{account?.name ?? 'Account'}</span>
                  {account?.role ? <span className="role">{account.role}</span> : null}
                </span>
                <svg
                  className="acct-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d={menuOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
                </svg>
              </button>
              {menu}
            </div>
          </div>
        </aside>
      )}

      <main className="main">
        <Outlet />
      </main>

      {phone ? (
        <nav className="mobile-tabbar" aria-label="Primary">
          <NavLink to="/" end className={() => (rangeActive ? 'active' : '')}>
            <TabIcon d={TAB_ICONS.range} />
            Range
          </NavLink>
          <NavLink to="/inbox" className={() => (inboxActive ? 'active' : '')} aria-label={inboxLabel}>
            <TabIcon d={TAB_ICONS.inbox} />
            Inbox
            {attention !== null && attention > 0 ? <span className="tab-badge">{attention}</span> : null}
          </NavLink>
          <button
            type="button"
            data-account-trigger
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={toggleMenu}
          >
            <TabIcon d={TAB_ICONS.account} />
            Account
          </button>
        </nav>
      ) : null}
      {phone ? menu : null}
    </div>
  );
}
