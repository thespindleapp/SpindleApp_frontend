import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setToken, setWorkspaceId } from '../api';
import { AcceptInvitationPage } from './AcceptInvitation';

vi.mock('../api', () => ({
  api: {
    getInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  },
  setToken: vi.fn(),
  setWorkspaceId: vi.fn(),
}));

const token = 'invite-token-not-a-secret-value';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/" element={<div>Board</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AcceptInvitationPage', () => {
  it('asks for a new invite when the link has no token', async () => {
    renderAt('/accept-invitation');

    expect(await screen.findByText(/missing its token/i)).toBeTruthy();
    expect(api.getInvitation).not.toHaveBeenCalled();
  });

  it('shows the invited workspace and does not display the token', async () => {
    vi.mocked(api.getInvitation).mockResolvedValue({
      valid: true,
      email: 'member@example.com',
      workspace: { id: 'ws-1', name: 'North Studio', slug: 'north-studio' },
      role: 'MEMBER',
      expiresAt: '2026-10-22T00:00:00.000Z',
    });

    renderAt(`/accept-invitation?token=${token}`);

    expect(await screen.findByText('North Studio')).toBeTruthy();
    expect(screen.getByDisplayValue('member@example.com')).toBeTruthy();
    expect(screen.getByText(/as Member/i)).toBeTruthy();
    expect(screen.queryByText(token)).toBeNull();
  });

  it('shows the server message when an invitation cannot be used', async () => {
    vi.mocked(api.getInvitation).mockRejectedValue(new Error('This invitation has expired'));

    renderAt(`/accept-invitation?token=${token}`);

    expect(await screen.findByText('This invitation has expired')).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('accepts the invitation into the invited workspace', async () => {
    vi.mocked(api.getInvitation).mockResolvedValue({
      valid: true,
      email: 'member@example.com',
      workspace: { id: 'ws-invited', name: 'North Studio', slug: 'north-studio' },
      role: 'MEMBER',
      expiresAt: '2026-10-22T00:00:00.000Z',
    });
    vi.mocked(api.acceptInvitation).mockResolvedValue({
      accessToken: 'access-token',
      workspaces: [
        { id: 'ws-other', name: 'Other', slug: 'other', role: 'OWNER' },
        { id: 'ws-invited', name: 'North Studio', slug: 'north-studio', role: 'MEMBER' },
      ],
    });

    renderAt(`/accept-invitation?token=${token}`);
    await screen.findByText('North Studio');

    await userEvent.type(screen.getByLabelText('First name'), 'Avery');
    await userEvent.type(screen.getByLabelText('Last name'), 'Cole');
    await userEvent.type(screen.getByLabelText('Password'), 'long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByText('Board')).toBeTruthy();
    expect(api.acceptInvitation).toHaveBeenCalledWith({
      token,
      firstName: 'Avery',
      lastName: 'Cole',
      password: 'long-password',
    });
    expect(setToken).toHaveBeenCalledWith('access-token');
    expect(setWorkspaceId).toHaveBeenCalledWith('ws-invited');
  });
});
