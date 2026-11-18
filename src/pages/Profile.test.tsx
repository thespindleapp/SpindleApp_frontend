import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, getWorkspaceId } from '../api';
import { ProfilePage } from './Profile';

vi.mock('../api', () => ({
  api: {
    me: vi.fn(),
    getWorkspace: vi.fn(),
    updateProfile: vi.fn(),
    updateWorkspace: vi.fn(),
  },
  getWorkspaceId: vi.fn(() => 'ws-1'),
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

function workspace(role = 'OWNER') {
  return {
    id: 'ws-1',
    name: 'Hollis & Row',
    slug: 'hollis',
    role,
    plan: 'STUDIO',
    timezone: 'Europe/London',
  };
}

describe('ProfilePage', () => {
  it('saves the name and time zone for an owner', async () => {
    vi.mocked(getWorkspaceId).mockReturnValue('ws-1');
    vi.mocked(api.me).mockResolvedValue({
      user: { email: 'srishti@example.com', firstName: 'Srishti', lastName: 'Dhawan' },
      workspaces: [],
    });
    vi.mocked(api.getWorkspace).mockResolvedValue(workspace());
    vi.mocked(api.updateProfile).mockResolvedValue({
      id: 'user-1',
      email: 'srishti@example.com',
      firstName: 'Srishti',
      lastName: 'Shah',
      avatarUrl: null,
    });
    vi.mocked(api.updateWorkspace).mockResolvedValue({ ...workspace(), timezone: 'Asia/Kolkata' });

    render(<ProfilePage />);
    const name = await screen.findByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Srishti Shah');
    const zone = screen.getByLabelText('Time zone');
    await userEvent.clear(zone);
    await userEvent.type(zone, 'Asia/Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.updateProfile).toHaveBeenCalledWith({ firstName: 'Srishti', lastName: 'Shah' });
    expect(api.updateWorkspace).toHaveBeenCalledWith({ timezone: 'Asia/Kolkata' });
    expect(await screen.findByText('Saved.')).toBeTruthy();
  });

  it('keeps the time zone read-only for a member', async () => {
    vi.mocked(getWorkspaceId).mockReturnValue('ws-1');
    vi.mocked(api.me).mockResolvedValue({
      user: { email: 'sam@example.com', firstName: 'Sam', lastName: 'Okafor' },
      workspaces: [],
    });
    vi.mocked(api.getWorkspace).mockResolvedValue(workspace('MEMBER'));

    render(<ProfilePage />);
    expect(await screen.findByDisplayValue('Europe/London')).toBeTruthy();
    expect(screen.getByLabelText('Time zone')).toHaveProperty('disabled', true);
    expect(screen.getByText('Only an owner can change the time zone.')).toBeTruthy();
  });
});
