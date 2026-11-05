import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, getWorkspaceId, markSignedOut } from './api';
import { App } from './App';
import type { EmailAccount } from './types';

vi.mock('./api', () => ({
  api: {
    me: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue({ loggedOut: true }),
    listStyles: vi.fn(),
    listEmailAccounts: vi.fn(),
    listInboxEmails: vi.fn(),
    listConfirmations: vi.fn(),
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
  vi.mocked(api.listEmailAccounts).mockReset();
  vi.mocked(api.listInboxEmails).mockReset();
  vi.mocked(api.listConfirmations).mockReset();
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

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
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
    expect(screen.getAllByText('hello@studio.resend.app').length).toBeGreaterThan(0);
    expect(screen.getByText('Forward to')).toBeTruthy();
    expect(screen.queryByText(/in\.spindle\.app/)).toBeNull();
    expect(screen.queryByText('Rhea Khanna')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Brands' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Factories' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'POs' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'POPPI' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Suppliers' })).toBeNull();
    expect(screen.getByText('Soon')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();

    const inbox = screen.getByRole('link', { name: 'Inbox, 2 need you' });
    expect(inbox.textContent).toContain('2');
    expect(view.container.querySelector('.butter-dot')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Range/ }).textContent).toContain('0');

    await userEvent.click(screen.getByRole('button', { name: /Srishti Dhawan/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Forwarding addresses' })).toBeTruthy();
    expect(within(menu).getByText('srishti@example.com')).toBeTruthy();
    expect(within(menu).getAllByText('Not available yet').length).toBe(3);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(api.logout).toHaveBeenCalled();
    expect(markSignedOut).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('does not invent a forwarding address or an attention dot when those requests fail', async () => {
    signedIn();
    vi.mocked(api.listEmailAccounts).mockRejectedValue(new Error('accounts down'));
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
    expect(screen.getAllByText('hello@studio.resend.app').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Inbox, 2 need you' })).toBeTruthy();
    expect(view.container.querySelector('.tab-badge')?.textContent).toBe('2');
    expect(view.container.querySelector('.butter-dot')).toBeNull();
  });
});
