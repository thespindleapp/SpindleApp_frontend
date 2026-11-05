import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { Brand, ConfirmationRow } from '../types';
import { BRAND_REQUIRED_MESSAGE, CandidatePicker } from './CandidatePicker';

vi.mock('../api', () => ({
  api: { confirm: vi.fn(), listBrands: vi.fn(), createBrand: vi.fn() },
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
    reason: 'Style number detected, but no style card could be created because a brand has not been selected.',
    isCurrent: true,
    confirmedById: null,
    resolvedAt: null,
    email: { id: 'email-1', subject: 'Style 3401069' },
    style: null,
    ...overrides,
  };
}

const brands: Brand[] = [
  { id: 'brand-1', name: 'North', slug: 'north' },
  { id: 'brand-2', name: 'South', slug: 'south' },
];

describe('CandidatePicker', () => {
  afterEach(() => {
    vi.mocked(api.listBrands).mockReset();
    vi.mocked(api.createBrand).mockReset();
    vi.mocked(api.confirm).mockReset();
  });

  it('shows one button when the proposed style number is repeated in alternatives', async () => {
    vi.mocked(api.listBrands).mockResolvedValue(brands);
    render(
      <MemoryRouter>
        <CandidatePicker row={row()} onResolved={() => undefined} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('combobox', { name: 'Brand' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Use this style' })).toHaveLength(2);
    expect(screen.getAllByText('3401069')).toHaveLength(1);
    expect(screen.getByText('7456622')).toBeTruthy();
    expect(api.confirm).not.toHaveBeenCalled();
    expect((screen.getAllByRole('button', { name: 'Use this style' })[0] as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(BRAND_REQUIRED_MESSAGE)).toBeTruthy();
  });

  it('sends the selected brand with the style number', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBrands).mockResolvedValue(brands);
    vi.mocked(api.confirm).mockResolvedValue({});
    const onResolved = vi.fn();
    render(
      <MemoryRouter>
        <CandidatePicker row={row()} onResolved={onResolved} />
      </MemoryRouter>,
    );

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Brand' }), 'brand-2');
    await user.click(screen.getAllByRole('button', { name: 'Use this style' })[0]!);

    expect(api.confirm).toHaveBeenCalledWith('conf-1', '3401069', 'brand-2');
    expect(onResolved).toHaveBeenCalled();
  });

  it('creates a brand when the workspace has none, then confirms', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBrands).mockResolvedValue([]);
    vi.mocked(api.createBrand).mockResolvedValue({ id: 'brand-new', name: 'Atelier', slug: 'atelier' });
    vi.mocked(api.confirm).mockResolvedValue({});
    render(
      <MemoryRouter>
        <CandidatePicker row={row()} onResolved={() => undefined} />
      </MemoryRouter>,
    );

    await user.type(await screen.findByRole('textbox', { name: 'Brand' }), 'Atelier');
    await user.click(screen.getAllByRole('button', { name: 'Use this style' })[0]!);

    expect(api.createBrand).toHaveBeenCalledWith({ name: 'Atelier' });
    expect(api.confirm).toHaveBeenCalledWith('conf-1', '3401069', 'brand-new');
  });

  it('uses the brand extracted from the email without asking again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBrands).mockResolvedValue(brands);
    vi.mocked(api.confirm).mockResolvedValue({});
    render(
      <MemoryRouter>
        <CandidatePicker
          row={row({ evidence: { brandName: 'South' } })}
          onResolved={() => undefined}
        />
      </MemoryRouter>,
    );

    const button = (await screen.findAllByRole('button', { name: 'Use this style' }))[0] as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await user.click(button);
    expect(api.createBrand).not.toHaveBeenCalled();
    expect(api.confirm).toHaveBeenCalledWith('conf-1', '3401069', 'brand-2');
  });

  it('keeps the candidate available when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBrands).mockResolvedValue(brands);
    vi.mocked(api.confirm).mockRejectedValue(new Error('Could not save this style'));
    const onResolved = vi.fn();
    render(
      <MemoryRouter>
        <CandidatePicker row={row()} onResolved={onResolved} />
      </MemoryRouter>,
    );

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Brand' }), 'brand-2');
    await user.click(screen.getAllByRole('button', { name: 'Use this style' })[0]!);
    expect(onResolved).not.toHaveBeenCalled();
    expect(await screen.findByText('Could not save this style')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Use this style' }).length).toBeGreaterThan(0);
  });
});
