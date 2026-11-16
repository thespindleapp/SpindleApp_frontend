import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { ConfirmationRow } from '../types';
import { CandidatePicker } from './CandidatePicker';

vi.mock('../api', () => ({
  api: { confirm: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function row(overrides: Partial<ConfirmationRow> = {}): ConfirmationRow {
  return {
    id: 'conf-1',
    field: 'styleNumber',
    styleId: null,
    emailId: 'email-1',
    status: 'PENDING',
    proposedValue: '3401069',
    confirmedValue: null,
    alternatives: ['3401069', '7456622'],
    evidence: null,
    source: 'PARSER',
    reason: 'Style number detected, but no style card could be created.',
    isCurrent: true,
    confirmedById: null,
    resolvedAt: null,
    email: { id: 'email-1', subject: 'Style 3401069' },
    style: null,
    ...overrides,
  };
}

describe('CandidatePicker', () => {
  it('shows one button when the proposed style number is repeated in alternatives', () => {
    render(
      <MemoryRouter>
        <CandidatePicker row={row()} onResolved={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button', { name: 'Use this style' })).toHaveLength(2);
    expect(screen.getAllByText('3401069')).toHaveLength(1);
    expect(screen.getByText('7456622')).toBeTruthy();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Brand' })).toBeNull();
  });

  it('confirms the chosen style number without a brand', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirm).mockResolvedValue({} as never);
    const onResolved = vi.fn();
    render(
      <MemoryRouter>
        <CandidatePicker row={row()} onResolved={onResolved} />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole('button', { name: 'Use this style' })[0]!);

    expect(api.confirm).toHaveBeenCalledWith('conf-1', '3401069');
    expect(onResolved).toHaveBeenCalled();
  });

  it('keeps the candidate available when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirm).mockRejectedValue(new Error('Could not save this style'));
    const onResolved = vi.fn();
    render(
      <MemoryRouter>
        <CandidatePicker row={row()} onResolved={onResolved} />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole('button', { name: 'Use this style' })[0]!);
    expect(onResolved).not.toHaveBeenCalled();
    expect(await screen.findByText('Could not save this style')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Use this style' }).length).toBeGreaterThan(0);
  });
});
