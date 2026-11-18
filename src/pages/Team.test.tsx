import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, getWorkspaceId } from '../api';
import type { WorkspaceMember } from '../types';
import { TeamPage } from './Team';

vi.mock('../api', () => ({
  api: {
    me: vi.fn(),
    listMembers: vi.fn(),
    inviteMember: vi.fn(),
    removeMember: vi.fn(),
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

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    userId: 'user-1',
    email: 'srishti@hollisandrow.com',
    firstName: 'Srishti',
    lastName: 'Dhawan',
    avatar: null,
    role: 'OWNER',
    joinedAt: '2026-10-01T00:00:00.000Z',
    status: 'ACTIVE',
    ...overrides,
  };
}

function ownerSession() {
  vi.mocked(api.me).mockResolvedValue({
    user: { email: 'srishti@hollisandrow.com', firstName: 'Srishti', lastName: 'Dhawan' },
    workspaces: [{ id: 'workspace-selected', name: 'Hollis & Row', slug: 'hollis', role: 'OWNER' }],
  });
}

describe('TeamPage', () => {
  it('lists the team and invites a person by email', async () => {
    ownerSession();
    vi.mocked(api.listMembers)
      .mockResolvedValueOnce([member()])
      .mockResolvedValueOnce([
        member(),
        member({
          userId: null,
          email: 'priya@hollisandrow.com',
          firstName: null,
          lastName: null,
          role: 'MEMBER',
          status: 'PENDING',
          joinedAt: null,
        }),
      ]);
    vi.mocked(api.inviteMember).mockResolvedValue(
      member({
        userId: null,
        email: 'priya@hollisandrow.com',
        firstName: null,
        lastName: null,
        role: 'MEMBER',
        status: 'PENDING',
        joinedAt: null,
      }),
    );
    const user = userEvent.setup();

    render(<TeamPage />);

    expect(await screen.findByRole('heading', { name: 'Team and roles' })).toBeTruthy();
    expect(screen.getByText('Srishti Dhawan')).toBeTruthy();
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
    expect(screen.getByText('Sees cost')).toBeTruthy();
    expect(screen.getByText('Last active')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What each role can do' })).toBeTruthy();
    expect(screen.getByText('See cost and value')).toBeTruthy();
    expect(screen.getByText('1 person')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Srishti Dhawan' })).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'Priya@Hollisandrow.com');
    await user.click(screen.getByRole('button', { name: 'Invite' }));

    expect(api.inviteMember).toHaveBeenCalledWith('priya@hollisandrow.com');
    expect((await screen.findByRole('status')).textContent).toContain('priya@hollisandrow.com is invited');
    expect(await screen.findByText('2 people')).toBeTruthy();
    expect(screen.getByText('Invited')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove priya/i })).toBeNull();
  });

  it('does not send an invalid invitation', async () => {
    ownerSession();
    vi.mocked(api.listMembers).mockResolvedValue([member()]);
    const user = userEvent.setup();

    render(<TeamPage />);
    await screen.findByText('Srishti Dhawan');
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Invite' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Enter a valid email address.');
    expect(api.inviteMember).not.toHaveBeenCalled();
  });

  it('lets an owner remove a member', async () => {
    ownerSession();
    const sam = member({
      userId: 'user-2',
      email: 'sam@hollisandrow.com',
      firstName: 'Sam',
      lastName: 'Okafor',
      role: 'MEMBER',
    });
    vi.mocked(api.listMembers).mockResolvedValueOnce([member(), sam]).mockResolvedValueOnce([member()]);
    vi.mocked(api.removeMember).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<TeamPage />);
    await user.click(await screen.findByRole('button', { name: 'Remove Sam Okafor' }));

    expect(api.removeMember).toHaveBeenCalledWith('user-2');
    expect(await screen.findByText('1 person')).toBeTruthy();
    expect(screen.queryByText('Sam Okafor')).toBeNull();
  });

  it('tells a member they cannot invite', async () => {
    vi.mocked(api.me).mockResolvedValue({
      user: { email: 'sam@hollisandrow.com', firstName: 'Sam', lastName: 'Okafor' },
      workspaces: [{ id: 'workspace-selected', name: 'Hollis & Row', slug: 'hollis', role: 'MEMBER' }],
    });
    vi.mocked(api.listMembers).mockResolvedValue([member()]);
    vi.mocked(api.inviteMember).mockRejectedValue(new ApiError(403, 'Only the workspace owner can do this'));
    const user = userEvent.setup();

    render(<TeamPage />);
    await screen.findByText('Srishti Dhawan');
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'lena@hollisandrow.com');
    await user.click(screen.getByRole('button', { name: 'Invite' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Only an owner can invite people.');
  });

  it('does not call the API when no workspace is selected', async () => {
    vi.mocked(getWorkspaceId).mockReturnValue(null);

    render(<TeamPage />);

    expect((await screen.findByRole('alert')).textContent?.toLowerCase()).toContain('select a workspace');
    expect(api.listMembers).not.toHaveBeenCalled();
  });
});
