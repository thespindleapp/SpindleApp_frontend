import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import type { StyleDraft } from '../types';
import { NewFromEmailPage } from './NewFromEmail';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    api: {
      getStyleDraft: vi.fn(),
      createStyleFromEmail: vi.fn(),
      listBrands: vi.fn(),
      createBrand: vi.fn(),
    },
  };
});

afterEach(() => {
  cleanup();
  vi.mocked(api.getStyleDraft).mockReset();
  vi.mocked(api.createStyleFromEmail).mockReset();
  vi.mocked(api.listBrands).mockReset();
  vi.mocked(api.createBrand).mockReset();
});

function draft(overrides: Partial<StyleDraft> = {}): StyleDraft {
  return {
    emailId: 'email-1',
    email: {
      id: 'email-1',
      subject: 'Style 7456621 proto',
      fromAddress: 'mill@supplier.example',
      fromName: 'Mill',
      receivedAt: '2026-10-23T13:43:00.000Z',
      status: 'NEEDS_CONFIRMATION',
      styleId: null,
      brandId: 'brand-1',
    },
    disposition: 'create',
    canCreate: true,
    blockReasons: [],
    identityConfirmationId: 'conf-1',
    brand: { id: 'brand-1', name: 'North', slug: 'north' },
    matches: [],
    extraction: {
      styleNumber: '7456621',
      styleName: 'PJ SET',
      confidenceTier: 'NEEDS_REVIEW',
      candidates: [],
      fields: {
        quantity: { value: 400, confidence: 0.9, evidence: 'Quantity: 400 pcs', source: 'body' },
        costFob: { value: 8.5, confidence: 0.8, evidence: { text: 'FOB 8.50' }, source: 'body' },
      },
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/emails/email-1/new']}>
      <Routes>
        <Route path="/emails/:emailId/new" element={<NewFromEmailPage />} />
        <Route path="/styles/:styleId" element={<p>Opened style</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('New from email', () => {
  it('shows extracted identity and proposals, then creates without listing on the board', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStyleDraft).mockResolvedValue(draft());
    vi.mocked(api.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'North', slug: 'north' }]);
    vi.mocked(api.createStyleFromEmail).mockResolvedValue({
      style: { id: 'style-new', styleNumber: '7456621', name: 'PJ SET', fields: {}, needsConfirmationCount: 1 },
      emailId: 'email-1',
      styleId: 'style-new',
    } as never);

    renderPage();

    expect(await screen.findByDisplayValue('7456621')).toBeTruthy();
    expect(screen.getByDisplayValue('400')).toBeTruthy();
    expect(screen.getByText(/90% confidence/)).toBeTruthy();
    expect(screen.getByText(/Quantity: 400 pcs/)).toBeTruthy();
    expect(screen.getByText(/These stay pending after create/)).toBeTruthy();

    await user.clear(screen.getByLabelText('Quantity'));
    await user.type(screen.getByLabelText('Quantity'), '450');
    await user.click(screen.getByRole('button', { name: 'Create style from email' }));

    expect(api.createStyleFromEmail).toHaveBeenCalledWith('email-1', {
      brandId: 'brand-1',
      styleNumber: '7456621',
      name: 'PJ SET',
      fields: { quantity: 450, costFob: 8.5 },
    });
    expect(await screen.findByText('Opened style')).toBeTruthy();
  });

  it('shows an existing style on STYLE_EXISTS and does not create again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStyleDraft).mockResolvedValue(draft());
    vi.mocked(api.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'North', slug: 'north' }]);
    vi.mocked(api.createStyleFromEmail).mockRejectedValue(
      new ApiError(409, 'A style with this number already exists in the workspace', 'STYLE_EXISTS', {
        match: { styleId: 'style-existing', styleNumber: '7456621', name: '7456621', kind: 'exact' },
      }),
    );

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Create style from email' }));

    expect((await screen.findByRole('link', { name: 'Open existing style' })).getAttribute('href')).toBe(
      '/styles/style-existing',
    );
    expect(screen.queryByRole('button', { name: 'Create style from email' })).toBeNull();
    expect(api.createStyleFromEmail).toHaveBeenCalledTimes(1);
  });

  it('does not offer create when the draft is a match or conflict', async () => {
    vi.mocked(api.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'North', slug: 'north' }]);
    vi.mocked(api.getStyleDraft).mockResolvedValue(
      draft({
        disposition: 'conflict',
        canCreate: false,
        blockReasons: ['An existing style may match this email. Review instead of creating a duplicate.'],
        matches: [{ styleId: 'style-2', styleNumber: 'st-cam-velvet', name: 'Velvet', kind: 'case-insensitive' }],
      }),
    );

    renderPage();

    expect(await screen.findByRole('link', { name: 'Open existing style' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create style from email' })).toBeNull();
    expect(api.createStyleFromEmail).not.toHaveBeenCalled();
  });

  it('lets the user type a style number when identity is missing', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'North', slug: 'north' }]);
    vi.mocked(api.getStyleDraft).mockResolvedValue(
      draft({
        disposition: 'needs_identity',
        canCreate: false,
        blockReasons: ['A style number is required before this style can be saved.'],
        extraction: {
          styleNumber: null,
          styleName: null,
          confidenceTier: 'NOT_STATED',
          candidates: [],
          fields: {},
        },
      }),
    );
    vi.mocked(api.createStyleFromEmail).mockResolvedValue({
      style: { id: 'style-new', styleNumber: '9991111', name: '9991111', fields: {}, needsConfirmationCount: 0 },
      emailId: 'email-1',
      styleId: 'style-new',
    } as never);

    renderPage();
    const number = await screen.findByLabelText('Style number');
    await user.type(number, '9991111');
    await user.click(screen.getByRole('button', { name: 'Create style from email' }));
    expect(api.createStyleFromEmail).toHaveBeenCalledWith(
      'email-1',
      expect.objectContaining({ styleNumber: '9991111', brandId: 'brand-1' }),
    );
  });
});
