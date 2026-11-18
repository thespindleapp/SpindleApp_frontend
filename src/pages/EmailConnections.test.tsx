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
    removeEmailAccount: vi.fn(),
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
  it('shows the forwarding page when the workspace has no address yet', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([]);

    render(<EmailConnectionsPage />);

    expect(await screen.findByRole('heading', { name: 'Forwarding' })).toBeTruthy();
    expect(await screen.findByText(/Add the address mail is forwarded to/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Set up a forwarding rule' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Who Spindle reads' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Unknown and blocked' })).toBeTruthy();
    expect(screen.getByText('No unknown or blocked senders.')).toBeTruthy();
    expect(api.listEmailAccounts).toHaveBeenCalledTimes(1);
  });

  it('does not submit an invalid email address', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<EmailConnectionsPage />);
    await screen.findByText(/Add the address mail is forwarded to/);

    await user.type(screen.getByRole('textbox', { name: 'Forwarding address' }), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add address' }));

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
    await screen.findByText(/Add the address mail is forwarded to/);

    await user.type(screen.getByRole('textbox', { name: 'Forwarding address' }), 'Hello@Studio.resend.app');
    await user.click(screen.getByRole('button', { name: 'Add address' }));

    expect(api.createEmailAccount).toHaveBeenCalledWith({
      emailAddress: 'hello@studio.resend.app',
    });
    expect((await screen.findByRole('status')).textContent).toContain('hello@studio.resend.app is registered');
    expect(screen.getByText('hello@studio.resend.app')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByText(/a message was delivered/i)).toBeNull();
  });

  it('shows the address that receives mail, and lets a second address be removed', async () => {
    const inbound = account({
      id: 'inbound',
      emailAddress: 'hello@reluebelu.resend.app',
      displayName: 'Resend inbound',
      lastSyncAt: '2026-11-16T08:15:48.668Z',
    });
    const personal = account({
      id: 'gmail',
      emailAddress: 'snehangshu.work@gmail.com',
      displayName: null,
      lastSyncAt: null,
      createdAt: '2026-10-22T14:28:26.864Z',
    });
    vi.mocked(api.listEmailAccounts).mockResolvedValue([personal, inbound]);
    vi.mocked(api.removeEmailAccount).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EmailConnectionsPage />);

    expect(await screen.findByText('hello@reluebelu.resend.app')).toBeTruthy();
    expect(screen.getByText(/a message was delivered to this address/i)).toBeTruthy();
    expect(screen.getByText('snehangshu.work@gmail.com')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);

    vi.mocked(api.listEmailAccounts).mockResolvedValue([inbound]);
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(api.removeEmailAccount).toHaveBeenCalledWith('gmail');
    expect(await screen.findByText('hello@reluebelu.resend.app')).toBeTruthy();
    expect(screen.queryByText('snehangshu.work@gmail.com')).toBeNull();
  });

  it('uses the real address in the Gmail and Outlook steps', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([
      account({ emailAddress: 'hello@studio.resend.app', lastSyncAt: '2026-10-22T12:00:00.000Z' }),
    ]);

    render(<EmailConnectionsPage />);

    expect(await screen.findByText(/Forward it to hello@studio.resend.app/)).toBeTruthy();
    expect(screen.getByText(/Forward to hello@studio.resend.app/)).toBeTruthy();
  });

  it('explains when the address is already registered', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([]);
    vi.mocked(api.createEmailAccount).mockRejectedValue(new ApiError(409, 'This receiving address is already registered'));
    const user = userEvent.setup();

    render(<EmailConnectionsPage />);
    await screen.findByText(/Add the address mail is forwarded to/);
    await user.type(screen.getByRole('textbox', { name: 'Forwarding address' }), 'hello@studio.resend.app');
    await user.click(screen.getByRole('button', { name: 'Add address' }));

    expect((await screen.findByRole('alert')).textContent).toContain('This receiving address is already registered');
  });

  it('does not call the API when no workspace is selected', async () => {
    vi.mocked(getWorkspaceId).mockReturnValue(null);

    render(<EmailConnectionsPage />);

    expect((await screen.findByRole('alert')).textContent?.toLowerCase()).toContain('select a workspace');
    expect(api.listEmailAccounts).not.toHaveBeenCalled();
  });
});
