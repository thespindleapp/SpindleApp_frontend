import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { StyleCard, StyleFieldView } from '../types';
import { BoardPage } from './Board';

vi.mock('../api', () => ({
  api: {
    listStyles: vi.fn(),
    listConfirmations: vi.fn(),
    listBrands: vi.fn(),
    confirm: vi.fn(),
    createBrand: vi.fn(),
    listEmailAccounts: vi.fn().mockResolvedValue([]),
    listInboxEmails: vi.fn().mockResolvedValue([]),
    getStyle: vi.fn(),
    reject: vi.fn(),
    keep: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.mocked(api.listStyles).mockReset();
});

const saved: StyleCard = {
  id: 'style-1',
  styleNumber: '3401069',
  name: 'Fruity Kaftan',
  listedAt: '2026-10-01T00:00:00.000Z',
  quantity: null,
  costFob: null,
  stage: null,
  status: null,
  brand: { id: 'brand-2', name: 'South', slug: 'south' },
  fields: {},
  needsConfirmationCount: 0,
};

describe('Range Board listing', () => {
  it('does not show a pending proposal on the board', async () => {
    vi.mocked(api.listStyles).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Your range starts with one supplier email.' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Range/ })).toBeTruthy();
    expect(screen.getByText('0 of 4')).toBeTruthy();
    expect(screen.getAllByText('Not available yet').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Upload sheet' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send a sample' })).toBeNull();
    expect(screen.queryByText(/in\.spindle\.app/)).toBeNull();
    const forward = await screen.findByRole('link', { name: 'Register a forwarding address' });
    expect(forward.getAttribute('href')).toBe('/settings/email-connections');
    expect(screen.queryByText('No styles match.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset filters' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Customise columns' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add style' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use this style' })).toBeNull();
    expect(screen.queryByText('Candidate')).toBeNull();
    expect(api.listConfirmations).not.toHaveBeenCalled();
  });

  it('does not show the filtered empty state while the board is loading', () => {
    vi.mocked(api.listStyles).mockReturnValue(new Promise(() => undefined));

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading the Range Board…')).toBeTruthy();
    expect(screen.queryByText('No styles match.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your range starts with one supplier email.' })).toBeNull();
  });

  it('does not show the filtered empty state after a fetch error', async () => {
    vi.mocked(api.listStyles).mockRejectedValue(new Error('board down'));

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('board down')).toBeTruthy();
    expect(screen.queryByText('No styles match.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your range starts with one supplier email.' })).toBeNull();
  });

  it('resets filters and shows the listed styles again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listStyles).mockResolvedValue([saved]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Fruity Kaftan')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Search styles, brands...'), 'missing-style');
    expect(screen.getByText('No styles match.')).toBeTruthy();
    const resets = screen.getAllByRole('button', { name: 'Reset filters' });
    await user.click(resets[resets.length - 1]!);
    expect(screen.getByText('Fruity Kaftan')).toBeTruthy();
    expect(screen.queryByText('No styles match.')).toBeNull();
  });

  it('shows the filtered empty state when styles exist but none match', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listStyles).mockResolvedValue([saved]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Fruity Kaftan')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Fruity Kaftan/ }).getAttribute('href')).toBe('/styles/style-1');
    expect(screen.getByRole('button', { name: 'Gallery' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Save current view' })).toBeNull();
    await user.type(screen.getByPlaceholderText('Search styles, brands...'), 'missing-style');
    expect(screen.getByText('No styles match.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Reset filters' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Your range starts with one supplier email.' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Register a forwarding address' })).toBeNull();
  });

  it('shows a registered forwarding address and then the listed styles', async () => {
    vi.mocked(api.listEmailAccounts).mockResolvedValue([
      {
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
      },
    ]);
    vi.mocked(api.listInboxEmails).mockResolvedValue([
      {
        id: 'email-1',
        subject: 'PO',
        fromAddress: 'mill@example.com',
        fromName: null,
        receivedAt: '2026-10-22T12:00:00.000Z',
        status: 'PARSED',
        style: null,
      },
    ]);
    vi.mocked(api.listStyles).mockResolvedValue([]);
    const empty = render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('hello@studio.resend.app')).toBeTruthy();
    expect(screen.getByText('1 of 4')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByText(/in\.spindle\.app/)).toBeNull();
    empty.unmount();

    vi.mocked(api.listStyles).mockResolvedValue([saved]);
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Fruity Kaftan')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Your range starts with one supplier email.' })).toBeNull();
    expect(screen.queryByText('hello@studio.resend.app')).toBeNull();
  });

  it('switches between gallery and table and hides a field', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listStyles).mockResolvedValue([
      styleCard({
        fields: {
          costFob: fact('costFob', { confirmationStatus: 'PROPOSED', proposedValue: 12.51, confirmedValue: null, displayValue: 12.51 }),
        },
      }),
    ]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('12.51')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gallery' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('.stage-pip')).toHaveLength(6);
    expect(screen.queryByText('Tech pack')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Gallery' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Fields' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cost' }));
    expect(screen.queryByText('12.51')).toBeNull();
    expect(screen.getByText('Fruity Kaftan')).toBeTruthy();
  });

  it('walks outstanding values one at a time and does not confirm them on its own', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirm).mockResolvedValue({});
    vi.mocked(api.listStyles).mockResolvedValue([
      styleCard({
        needsConfirmationCount: 1,
        fields: {
          quantity: fact('quantity', {
            confirmationId: 'qty-1',
            confirmationStatus: 'PROPOSED',
            proposedValue: 20,
            confirmedValue: null,
            displayValue: 20,
          }),
        },
      }),
    ]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Check 1' })).toBeTruthy();
    expect(api.confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Check 1' }));
    expect(screen.getByText('From email 20')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(api.confirm).toHaveBeenCalledTimes(1);
    expect(api.confirm).toHaveBeenCalledWith('qty-1');
  });

  it('keeps GBP and USD totals apart and does not invent a dollar sign', async () => {
    vi.mocked(api.listStyles).mockResolvedValue([
      styleCard({
        id: 'gbp',
        styleNumber: 'GBP-1',
        name: 'Pound dress',
        fields: {
          quantity: fact('quantity', { proposedValue: 2, confirmedValue: 2, displayValue: 2 }),
          costFob: fact('costFob', { proposedValue: 10, confirmedValue: 10, displayValue: 10 }),
          currency: fact('currency', { proposedValue: 'GBP', confirmedValue: 'GBP', displayValue: 'GBP' }),
        },
      }),
      styleCard({
        id: 'usd',
        styleNumber: 'USD-1',
        name: 'Dollar shirt',
        fields: {
          quantity: fact('quantity', { proposedValue: 4, confirmedValue: 4, displayValue: 4 }),
          costFob: fact('costFob', { proposedValue: 5, confirmedValue: 5, displayValue: 5 }),
          currency: fact('currency', { proposedValue: 'USD', confirmedValue: 'USD', displayValue: 'USD' }),
        },
      }),
      styleCard({
        id: 'bare',
        styleNumber: 'BARE-1',
        name: 'Bare coat',
        fields: {
          quantity: fact('quantity', { proposedValue: 100, confirmedValue: 100, displayValue: 100 }),
          costFob: fact('costFob', { proposedValue: 99, confirmedValue: 99, displayValue: 99 }),
          currency: fact('currency', {
            proposedValue: 'USD',
            confirmedValue: null,
            displayValue: 'USD',
            confirmationStatus: 'NOT_STATED',
          }),
        },
      }),
    ]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const totals = await screen.findByLabelText('Order value');
    expect(totals.textContent).toContain('£20');
    expect(totals.textContent).toContain('$20');
    expect(totals.textContent).not.toContain('$198');
    expect(totals.textContent).not.toContain('£198');
    expect(screen.getByText('99')).toBeTruthy();
    expect(screen.queryByText('$99')).toBeNull();
  });

  it('shows recorded history and a sticky check bar on a phone', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: true,
        media: '(max-width: 720px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.mocked(api.listStyles).mockResolvedValue([
      styleCard({
        needsConfirmationCount: 1,
        fields: {
          quantity: fact('quantity', {
            confirmationId: 'qty-1',
            confirmationStatus: 'PROPOSED',
            proposedValue: 4,
            confirmedValue: null,
            displayValue: 4,
          }),
        },
      }),
    ]);
    vi.mocked(api.getStyle).mockResolvedValue(
      styleCard({
        fieldRevisions: [
          {
            id: 'rev-1',
            field: 'quantity',
            previousValue: 4,
            newValue: 4,
            source: 'USER',
            kind: 'CONFIRMATION',
            actorId: null,
            confirmationId: 'qty-1',
            sourceEmailId: null,
            createdAt: '2026-10-02T00:00:00.000Z',
          },
        ],
      }),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('button', { name: 'Check 1' })).length).toBeGreaterThan(1);
    expect(document.querySelector('.range-check-bar')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText(/3401069 · Quantity · Looks right/)).toBeTruthy();
    expect(screen.queryByText('Priya Shah')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('keeps long style and factory names inside the card and the table row', async () => {
    const user = userEvent.setup();
    const longName = 'Hand-painted silk kaftan with an extremely long merchandising name';
    const longFactory = 'Sunrise Mills and Dye Works of the Northern District';
    vi.mocked(api.listStyles).mockResolvedValue([
      styleCard({
        name: longName,
        fields: {
          factoryName: fact('factoryName', {
            proposedValue: longFactory,
            confirmedValue: longFactory,
            displayValue: longFactory,
          }),
        },
      }),
    ]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const galleryName = await screen.findByText(longName);
    expect(galleryName.classList.contains('range-clip')).toBe(true);
    expect(screen.getAllByText(new RegExp(longFactory)).some((node) => node.closest('.range-clip'))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getAllByText(longName).some((node) => node.classList.contains('range-clip'))).toBe(true);
    expect(screen.getAllByText(longFactory).some((node) => node.classList.contains('range-clip'))).toBe(true);
  });

  it('selects a style without opening it or confirming a value', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listStyles).mockResolvedValue([saved]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const select = await screen.findByRole('button', { name: 'Select Fruity Kaftan' });
    expect(select.getAttribute('aria-pressed')).toBe('false');
    vi.mocked(api.confirm).mockClear();
    await user.click(select);
    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: /Fruity Kaftan/ }).getAttribute('href')).toBe('/styles/style-1');
    expect(api.confirm).not.toHaveBeenCalled();
  });

  it('marks the stored stage in butter and leaves a proposal unchecked', async () => {
    vi.mocked(api.listStyles).mockResolvedValue([
      styleCard({
        id: 'stored',
        styleNumber: 'PP-1',
        name: 'Stored stage',
        fields: {
          stage: fact('stage', { proposedValue: 'BULK', confirmedValue: 'PP', displayValue: 'PP' }),
          status: fact('status', { proposedValue: 'Blocked', confirmedValue: 'Blocked', displayValue: 'Blocked' }),
        },
      }),
      styleCard({
        id: 'proposed',
        styleNumber: 'PR-1',
        name: 'Proposed stage',
        fields: {
          stage: fact('stage', {
            confirmationStatus: 'PROPOSED',
            proposedValue: 'SHIP',
            confirmedValue: null,
            displayValue: 'SHIP',
          }),
        },
      }),
    ]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Stored stage')).toBeTruthy();
    expect(document.querySelector('.range-flag.is-blocked')?.textContent).toContain('Blocked');
    const stored = screen.getByRole('link', { name: /Stored stage/ });
    expect(stored.querySelector('.stage-pip.is-now')?.getAttribute('title')).toBe('PP');
    expect(stored.querySelectorAll('.stage-pip.is-done')).toHaveLength(3);
    const proposed = screen.getByRole('link', { name: /Proposed stage/ });
    expect(proposed.querySelector('.stage-pip.is-now')).toBeNull();
    expect(proposed.querySelector('.stage-pip.is-done')).toBeNull();
    expect(screen.queryByText('STATUS')).toBeNull();
  });

  it('groups by a checked fabric and keeps a proposed fabric out of the heading', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listStyles).mockResolvedValue([
      styleCard({
        id: 'linen',
        name: 'Linen shirt',
        fields: { fabric: fact('fabric', { proposedValue: 'Linen', confirmedValue: 'Linen', displayValue: 'Linen' }) },
      }),
      styleCard({
        id: 'silk',
        styleNumber: 'SILK-1',
        name: 'Silk dress',
        fields: {
          fabric: fact('fabric', {
            confirmationStatus: 'PROPOSED',
            proposedValue: 'Silk',
            confirmedValue: null,
            displayValue: 'Silk',
          }),
        },
      }),
    ]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await screen.findByText('Linen shirt');
    await user.click(screen.getByRole('button', { name: 'Fabric' }));
    expect(screen.getByText('Linen')).toBeTruthy();
    expect(screen.getByText('Not checked')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Silk' })).toBeNull();
    expect(screen.queryByText('Silk')).toBeNull();
  });

  it('keeps the style column pinned in the table scroller', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listStyles).mockResolvedValue([saved]);

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Table' }));
    const table = document.querySelector('.range-table') as HTMLElement;
    const rest = table.style.getPropertyValue('--range-rest');
    expect(rest).toContain('px');
    expect(rest).not.toMatch(/minmax|\bfr\b/);
    const row = table.querySelector('.range-table-row');
    const pin = row?.querySelector(':scope > .range-pin');
    expect(table.querySelector('.range-table-head .range-pin')?.textContent).toMatch(/Style/);
    expect(row?.firstElementChild).toBe(pin);
    expect(screen.getByRole('button', { name: 'Select Fruity Kaftan' }).closest('.range-pin')).toBe(pin);
    expect(screen.getByRole('link', { name: /Fruity Kaftan/ }).closest('.range-pin')).toBe(pin);
    expect(screen.getByRole('button', { name: 'Unit cost' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delivery' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Drop' })).toBeNull();
    expect(row?.textContent).toContain('—');
    table.scrollLeft = 480;
    expect(table.querySelector('.range-table-row .range-pin')).toBe(pin);
  });
});

function fact(name: string, overrides: Partial<StyleFieldView> = {}): StyleFieldView {
  return {
    field: name,
    confirmationId: `${name}-id`,
    emailId: null,
    sourceSubject: null,
    proposedValue: null,
    confirmedValue: null,
    displayValue: null,
    confirmationStatus: 'CONFIRMED',
    evidence: null,
    confirmedBy: null,
    confirmedAt: null,
    source: 'USER',
    proposedDiffersFromConfirmed: false,
    ...overrides,
  };
}

function styleCard(overrides: Partial<StyleCard> = {}): StyleCard {
  return {
    ...saved,
    ...overrides,
    fields: overrides.fields ?? {},
  };
}
