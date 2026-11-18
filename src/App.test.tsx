import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, getWorkspaceId, markSignedOut } from './api';
import { App } from './App';
import { INBOX_NEEDS_YOU_EVENT } from './lib/inbox-progress';
import { publishRangeCount } from './lib/range-count';
import type { EmailAccount } from './types';

vi.mock('./api', () => ({
  api: {
    me: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue({ loggedOut: true }),
    listStyles: vi.fn(),
    countStyles: vi.fn(),
    listEmailAccounts: vi.fn(),
    listMembers: vi.fn(),
    getWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    updateProfile: vi.fn(),
    listInboxEmails: vi.fn(),
    listConfirmations: vi.fn(),
    inboxProgress: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getToken: vi.fn(() => 'token'),
  getWorkspaceId: vi.fn(() => 'ws-1'),
  setToken: vi.fn(),
  setWorkspaceId: vi.fn(),
  clearSession: vi.fn(),
  clearAccessToken: vi.fn(),
  isSignedOut: vi.fn(() => false),
  markSignedOut: vi.fn(),
  applyRemoteSignOut: vi.fn(),
  subscribeAuth: vi.fn(() => () => undefined),
  subscribeRemoteSignOut: vi.fn(() => () => undefined),
  setUnauthorizedHandler: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(api.me).mockReset();
  vi.mocked(api.listStyles).mockReset();
  vi.mocked(api.countStyles).mockReset();
  vi.mocked(api.listEmailAccounts).mockReset();
  vi.mocked(api.listMembers).mockReset();
  vi.mocked(api.getWorkspace).mockReset();
  vi.mocked(api.updateProfile).mockReset();
  vi.mocked(api.listInboxEmails).mockReset();
  vi.mocked(api.listConfirmations).mockReset();
  vi.mocked(api.inboxProgress).mockReset();
  vi.mocked(markSignedOut).mockReset();
  vi.mocked(api.logout).mockReset();
  vi.mocked(api.logout).mockResolvedValue({ loggedOut: true });
});

function account(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: 'acc-1',
    workspaceId: 'ws-1',
    userId: 'user-1',
    provider: 'FORWARD',
    emailAddress: 'hello@studio.resend.app',
    displayName: null,
    status: 'CONNECTED',
    watchScope: {},
    lastSyncAt: null,
    lastError: null,
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    ...overrides,
  };
}

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function signedIn() {
  vi.mocked(getWorkspaceId).mockReturnValue('ws-1');
  vi.mocked(api.me).mockResolvedValue({
    user: { email: 'srishti@example.com', firstName: 'Srishti', lastName: 'Dhawan' },
    workspaces: [
      { id: 'ws-other', name: 'Other', slug: 'other', role: 'MEMBER' },
      { id: 'ws-1', name: 'Hollis & Row', slug: 'hollis', role: 'OWNER' },
    ],
  });
  vi.mocked(api.listStyles).mockResolvedValue([]);
  vi.mocked(api.countStyles).mockResolvedValue(0);
  vi.mocked(api.listEmailAccounts).mockResolvedValue([account()]);
  vi.mocked(api.listInboxEmails).mockResolvedValue([
    {
      id: 'email-1',
      subject: 'PO 5512',
      fromAddress: 'iris@mill.example',
      fromName: 'Iris',
      receivedAt: '2026-10-22T12:00:00.000Z',
      status: 'RECEIVED',
      style: null,
    },
  ]);
  vi.mocked(api.inboxProgress).mockResolvedValue({
    received: 2,
    queued: 0,
    processing: 0,
    processed: 0,
    review: 0,
    failed: 0,
    ignored: 0,
    progress: 1,
    active: false,
    complete: true,
    state: 'completed',
    needsYou: 1,
    openDuplicates: 0,
    batch: null,
  });
  vi.mocked(api.listConfirmations).mockResolvedValue([
    {
      id: 'c1',
      field: 'styleNumber',
      styleId: null,
      emailId: 'email-1',
      status: 'PENDING',
      proposedValue: 'HS-5512',
      confirmedValue: null,
      alternatives: null,
      evidence: null,
      source: 'PARSER',
      isCurrent: true,
      confirmedById: null,
      resolvedAt: null,
    },
    {
      id: 'c2',
      field: 'quantity',
      styleId: 'style-1',
      emailId: 'email-2',
      status: 'NEEDS_REVIEW',
      proposedValue: 100,
      confirmedValue: 80,
      alternatives: null,
      evidence: null,
      source: 'PARSER',
      isCurrent: true,
      confirmedById: null,
      resolvedAt: null,
    },
  ]);
}

describe('Application shell', () => {
  it('shows the workspace, registered address, account menu, and a real attention count', async () => {
    signedIn();
    const view = renderApp();

    expect(await screen.findByText('Srishti Dhawan')).toBeTruthy();
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByText('SD')).toBeTruthy();
    expect(screen.getByText('Hollis & Row')).toBeTruthy();
    expect((await screen.findAllByText('hello@studio.resend.app')).length).toBeGreaterThan(0);
    expect(screen.getByText('Forward to')).toBeTruthy();
    expect(screen.queryByText(/in\.spindle\.app/)).toBeNull();
    expect(screen.queryByText('Rhea Khanna')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Brands' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Factories' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'POs' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'POPPI' })).toBeNull();
    expect(screen.getByRole('link', { name: /^Suppliers/ }).getAttribute('href')).toBe('/suppliers');
    expect(screen.queryByText('Soon')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();

    const inbox = screen.getByRole('link', { name: 'Inbox, 1 need you' });
    expect(inbox.textContent).toContain('1');
    expect(view.container.querySelector('.butter-dot')).toBeTruthy();
    expect((await screen.findByRole('link', { name: /^Range/ })).textContent).toContain('0');
    expect(await screen.findByText('Getting started')).toBeTruthy();
    expect(await screen.findByText('2 of 4')).toBeTruthy();
    expect(screen.getByText('Pick your current season')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /Srishti Dhawan/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Forwarding addresses' })).toBeTruthy();
    expect(within(menu).getByText('srishti@example.com')).toBeTruthy();
    expect(within(menu).queryByText('Not available yet')).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Account settings' }).getAttribute('href')).toBe('/settings/profile');
    expect(within(menu).getByRole('menuitem', { name: 'Team members' }).getAttribute('href')).toBe('/settings/team');
    expect(within(menu).getByRole('menuitem', { name: 'Subscription and invoices' }).getAttribute('href')).toBe(
      '/settings/subscription',
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(api.logout).toHaveBeenCalled();
    expect(markSignedOut).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('switches settings sections from the side nav', async () => {
    signedIn();
    vi.mocked(api.getWorkspace).mockResolvedValue({
      id: 'ws-1',
      name: 'Hollis & Row',
      slug: 'hollis',
      role: 'OWNER',
      plan: 'STUDIO',
      timezone: 'Europe/London',
    });
    vi.mocked(api.listMembers).mockResolvedValue([]);
    renderApp('/settings/profile');

    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    expect(within(nav).getByRole('link', { name: /Team and roles/ })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: /Forwarding/ }).getAttribute('href')).toBe('/settings/email-connections');
    expect(within(nav).getByRole('link', { name: /Subscription/ }).textContent).toContain('Studio');
    expect(screen.getByRole('link', { name: '← Back to range' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('link', { name: /^Range/ })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByDisplayValue('Srishti Dhawan')).toBeTruthy();
    expect(screen.getByText('srishti@example.com')).toBeTruthy();
    expect(screen.getByDisplayValue('Europe/London')).toBeTruthy();
    expect(screen.queryByText('Founding')).toBeNull();

    await userEvent.click(within(nav).getByRole('link', { name: /Notifications/ }));
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByText('Daily digest')).toBeTruthy();
    expect(screen.getByText('When two emails disagree')).toBeTruthy();
    expect(screen.getByText('Weekly range summary')).toBeTruthy();
    expect(screen.getAllByText('Not sent yet').length).toBe(3);

    await userEvent.click(screen.getByRole('link', { name: /Subscription/ }));
    expect(await screen.findByRole('heading', { name: 'Subscription' })).toBeTruthy();
    expect(screen.getByText('Billing and invoices are not connected for this workspace.')).toBeTruthy();
    expect(screen.queryByText(/£/)).toBeNull();
  });

  it('does not invent a forwarding address or an attention dot when those requests fail', async () => {
    signedIn();
    vi.mocked(api.listEmailAccounts).mockRejectedValue(new Error('accounts down'));
    vi.mocked(api.inboxProgress).mockRejectedValue(new Error('progress down'));
    vi.mocked(api.listInboxEmails).mockRejectedValue(new Error('inbox down'));
    const view = renderApp();

    expect(await screen.findByText('Hollis & Row')).toBeTruthy();
    expect(screen.queryByText(/in\.spindle\.app/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Register a forwarding address' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Inbox, 0/ })).toBeNull();
    expect(view.container.querySelector('.butter-dot')).toBeNull();
  });

  it('uses the phone tab bar at 390px and hides the desktop sidebar', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('720px'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    signedIn();
    const view = renderApp();

    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
    expect(screen.queryByText('Suppliers')).toBeNull();
    expect(screen.getByText('Hollis & Row')).toBeTruthy();
    expect((await screen.findAllByText('hello@studio.resend.app')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Inbox, 1 need you' })).toBeTruthy();
    expect(view.container.querySelector('.tab-badge')?.textContent).toBe('1');
    expect(view.container.querySelector('.butter-dot')).toBeNull();
  });

  it('uses the workspace Needs you count for the badge and refreshes it without the inbox page', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    signedIn();
    vi.mocked(api.listInboxEmails).mockResolvedValue([
      {
        id: 'only-loaded',
        subject: 'One row',
        fromAddress: 'iris@mill.example',
        fromName: 'Iris',
        receivedAt: '2026-10-22T12:00:00.000Z',
        status: 'PARSED',
        style: null,
      },
    ]);
    vi.mocked(api.inboxProgress)
      .mockResolvedValueOnce({
        received: 80,
        queued: 0,
        processing: 0,
        processed: 40,
        review: 4,
        failed: 1,
        ignored: 0,
        progress: 1,
        active: false,
        complete: true,
        state: 'completed',
        needsYou: 40,
        openDuplicates: 2,
        batch: null,
      })
      .mockResolvedValueOnce({
        received: 80,
        queued: 0,
        processing: 0,
        processed: 41,
        review: 3,
        failed: 1,
        ignored: 0,
        progress: 1,
        active: false,
        complete: true,
        state: 'completed',
        needsYou: 39,
        openDuplicates: 1,
        batch: null,
      });

    renderApp();

    expect(await screen.findByRole('link', { name: 'Inbox, 40 need you' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Inbox, 1 need you' })).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(INBOX_NEEDS_YOU_EVENT, { detail: 12 }));
    });
    expect(await screen.findByRole('link', { name: 'Inbox, 12 need you' })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(await screen.findByRole('link', { name: 'Inbox, 39 need you' })).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows the styles on the board in the range count and updates when more are filed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    signedIn();
    vi.mocked(api.countStyles).mockResolvedValueOnce(0).mockResolvedValue(3);
    renderApp();

    expect((await screen.findByRole('link', { name: /^Range/ })).textContent).toContain('0');
    expect(screen.getByText('Getting started')).toBeTruthy();

    await act(async () => {
      publishRangeCount(3);
    });
    expect(screen.getByRole('link', { name: /^Range/ }).textContent).toContain('3');
    expect(screen.queryByText('Getting started')).toBeNull();

    await act(async () => {
      publishRangeCount(0);
    });
    expect(screen.getByRole('link', { name: /^Range/ }).textContent).toContain('0');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect((await screen.findByRole('link', { name: /^Range/ })).textContent).toContain('3');
    expect(screen.queryByText('Getting started')).toBeNull();
    vi.useRealTimers();
  });
});
