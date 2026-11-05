import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, getWorkspaceId } from '../api';
import type { EmailAccount } from '../types';
import { EmailConnectionsPage } from './EmailConnections';

vi.mock('../api', () => ({
  api: {
    listEmailAccounts: vi.fn(),
    createEmailAccount: vi.fn(),
  },
  getWorkspaceId: vi.fn(() => 'workspace-selected'),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function account(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: 'account-1',
    workspaceId: 'workspace-selected',
    userId: 'user-1',
    provider: 'FORWARD',
    emailAddress: 'inbox@mill.example',
    displayName: 'Mill inbox',
    status: 'CONNECTED',
    watchScope: {},
    lastSyncAt: null,
    lastError: null,
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    ...overrides,
  };
}

describe('EmailConnectionsPage', () => {
  it('shows an empty state when the workspace has no addresses', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([]);

    render(<EmailConnectionsPage />);

    expect(await screen.findByText(/no receiving addresses yet/i)).toBeTruthy();
    expect(api.listEmailAccounts).toHaveBeenCalledTimes(1);
  });

  it('does not submit an invalid email address', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<EmailConnectionsPage />);
    await screen.findByText(/no receiving addresses yet/i);

    await user.type(screen.getByRole('textbox', { name: 'Receiving address' }), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Register address' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Enter a valid email address.');
    expect(api.createEmailAccount).not.toHaveBeenCalled();
  });

  it('registers a receiving address without claiming a message was delivered', async () => {
    const registered = account({
      status: 'PENDING',
      lastSyncAt: null,
      emailAddress: 'hello@studio.resend.app',
    });
    vi.mocked(api.listEmailAccounts).mockResolvedValueOnce([]).mockResolvedValueOnce([registered]);
    vi.mocked(api.createEmailAccount).mockResolvedValue(registered);
    const user = userEvent.setup();

    render(<EmailConnectionsPage />);
    expect(screen.getByText(/exact To or recipient address/i)).toBeTruthy();
    await screen.findByText(/no receiving addresses yet/i);

    await user.type(screen.getByRole('textbox', { name: 'Receiving address' }), 'Hello@Studio.resend.app');
    await user.type(screen.getByLabelText(/display name/i), 'Mill inbox');
    await user.click(screen.getByRole('button', { name: 'Register address' }));

    expect(api.createEmailAccount).toHaveBeenCalledWith({
      emailAddress: 'hello@studio.resend.app',
      displayName: 'Mill inbox',
    });
    expect((await screen.findByRole('status')).textContent).toContain('hello@studio.resend.app is registered');
    expect(screen.getByText('hello@studio.resend.app')).toBeTruthy();
    expect(screen.getByText('Registered')).toBeTruthy();
    expect(screen.getByText(/no inbound message has been matched/i)).toBeTruthy();
    expect(screen.queryByText('Received')).toBeNull();
  });

  it('shows Received only after a delivery timestamp exists', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([
      account({ status: 'CONNECTED', lastSyncAt: '2026-10-22T12:00:00.000Z' }),
    ]);

    render(<EmailConnectionsPage />);

    expect(await screen.findByText('Received')).toBeTruthy();
    expect(screen.getByText(/a message was delivered to this address/i)).toBeTruthy();
  });

  it('refreshes the registered list', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([account()]);
    const user = userEvent.setup();

    render(<EmailConnectionsPage />);
    expect(await screen.findByText('inbox@mill.example')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(api.listEmailAccounts).toHaveBeenCalledTimes(2);
  });

  it('explains when the address is already registered', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([]);
    vi.mocked(api.createEmailAccount).mockRejectedValue(new ApiError(409, 'This receiving address is already registered'));
    const user = userEvent.setup();

    render(<EmailConnectionsPage />);
    await screen.findByText(/no receiving addresses yet/i);
    await user.type(screen.getByRole('textbox', { name: 'Receiving address' }), 'hello@studio.resend.app');
    await user.click(screen.getByRole('button', { name: 'Register address' }));

    expect((await screen.findByRole('alert')).textContent).toContain('This receiving address is already registered');
  });

  it('does not call the API when no workspace is selected', async () => {
    vi.mocked(getWorkspaceId).mockReturnValue(null);

    render(<EmailConnectionsPage />);

    expect((await screen.findByRole('alert')).textContent?.toLowerCase()).toContain('select a workspace');
    expect(api.listEmailAccounts).not.toHaveBeenCalled();
  });
});
