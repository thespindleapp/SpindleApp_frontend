import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { EmailAttachment, StyleCard, StyleEmail, StyleFieldView } from '../types';
import { StyleCardPage } from './StyleCard';

vi.mock('../api', () => ({
  api: {
    getStyle: vi.fn(),
    listEmails: vi.fn(),
    confirmAll: vi.fn(),
    listStyleOnBoard: vi.fn(),
    getAttachmentBlob: vi.fn(async () => new Blob([new Uint8Array([1])], { type: 'image/png' })),
    listEmailAccounts: vi.fn().mockResolvedValue([]),
  },
}));

beforeEach(() => {
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:style-thumb'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function field(overrides: Partial<StyleFieldView>): StyleFieldView {
  return {
    field: 'quantity',
    confirmationId: 'conf-1',
    emailId: 'email-1',
    sourceSubject: 'Re: Style REAL-TEST-001',
    proposedValue: 600,
    confirmedValue: null,
    displayValue: 600,
    confirmationStatus: 'PROPOSED',
    evidence: { text: 'Qty 600, currently at PP sample' },
    confirmedBy: null,
    confirmedAt: null,
    source: 'PARSER',
    proposedDiffersFromConfirmed: false,
    ...overrides,
  };
}

function style(overrides: Partial<StyleCard> = {}): StyleCard {
  return {
    id: 'style-1',
    styleNumber: 'REAL-TEST-001',
    name: 'REAL-TEST-001',
    quantity: 600,
    costFob: null,
    stage: 'PP',
    status: null,
    brand: { id: 'b1', name: 'Reluebelu', slug: 'reluebelu' },
    needsConfirmationCount: 1,
    fieldRevisions: [],
    fields: {
      quantity: field({}),
      stage: field({
        field: 'stage',
        proposedValue: 'PP',
        displayValue: 'PP',
        evidence: { text: 'currently at PP sample' },
      }),
    },
    ...overrides,
  };
}

const realEmail: StyleEmail = {
  id: 'email-1',
  subject: 'Re: Style REAL-TEST-001',
  fromAddress: 'supplier@example.com',
  fromName: 'Vikram',
  bodyText: 'Qty 600, currently at PP sample.',
  receivedAt: '2026-10-05T08:15:00.000Z',
  attachments: [],
};

function attachment(overrides: Partial<EmailAttachment>): EmailAttachment {
  return {
    id: 'att-1',
    filename: 'img-waist-position-fit-comment.png',
    mimeType: 'image/png',
    sizeBytes: 208380,
    createdAt: '2026-11-02T20:27:00.465Z',
    ...overrides,
  };
}

async function renderCard(card: StyleCard, emails: StyleEmail[] = [realEmail]) {
  vi.mocked(api.getStyle).mockResolvedValue(card);
  vi.mocked(api.listEmails).mockResolvedValue(emails);
  render(
    <MemoryRouter initialEntries={['/styles/style-1']}>
      <Routes>
        <Route path="/styles/:styleId" element={<StyleCardPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { name: /Style REAL-TEST-001/ });
}

describe('style card checking presentation', () => {
  it('shows the garment name in the title and keeps the style number underneath', async () => {
    vi.mocked(api.getStyle).mockResolvedValue(
      style({
        styleNumber: '3401069',
        name: '3401069',
        fields: {
          name: field({
            field: 'name',
            proposedValue: 'FRUITY KAFTAN',
            displayValue: 'FRUITY KAFTAN',
            evidence: { text: '#3401069 – Fruity Kaftan' },
          }),
        },
      }),
    );
    vi.mocked(api.listEmails).mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/styles/style-1']}>
        <Routes>
          <Route path="/styles/:styleId" element={<StyleCardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Fruity Kaftan' })).toBeTruthy();
    expect(screen.getByText('3401069')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Style 3401069' })).toBeNull();
  });

  it('does not put a proposed quantity in the headline as a fact', async () => {
    await renderCard(style());
    const facts = document.querySelector('.facts-row')?.textContent ?? '';
    expect(facts).toContain('From email, check');
    expect(facts).not.toMatch(/Quantity\s*600/);
    expect(facts).not.toContain('Quantity600');
    expect(screen.getByText(/To check/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Looks right' }).length).toBeGreaterThan(0);
  });

  it('puts a checked quantity in the headline', async () => {
    await renderCard(
      style({
        needsConfirmationCount: 0,
        fields: {
          quantity: field({
            confirmationStatus: 'CONFIRMED',
            confirmedValue: 600,
            displayValue: 600,
            proposedValue: 600,
          }),
        },
      }),
    );
    const facts = document.querySelector('.facts-row')?.textContent ?? '';
    expect(facts).toMatch(/Quantity\s*600/);
    expect(facts).not.toContain('QuantityFrom email, check');
    expect(screen.queryByText('CONFIRMED')).toBeNull();
    expect(screen.queryByText('Confirmed')).toBeNull();
  });

  it('does not present a pending cost as a trusted monetary headline', async () => {
    await renderCard(
      style({
        fields: {
          quantity: field({}),
          costFob: field({
            field: 'costFob',
            proposedValue: 19.25,
            displayValue: 19.25,
            confirmationStatus: 'PROPOSED',
          }),
          currency: field({
            field: 'currency',
            proposedValue: 'GBP',
            displayValue: 'GBP',
            confirmationStatus: 'PROPOSED',
          }),
        },
      }),
    );
    const facts = document.querySelector('.facts-row')?.textContent ?? '';
    expect(facts).toContain('From email, check');
    expect(facts).not.toContain('£19.25');
    expect(facts).not.toContain('$19.25');
  });

  it('formats a checked GBP cost with a pound sign and a checked USD cost with a dollar sign', async () => {
    await renderCard(
      style({
        needsConfirmationCount: 0,
        fields: {
          costFob: field({
            field: 'costFob',
            proposedValue: 19.25,
            confirmedValue: 19.25,
            displayValue: 19.25,
            confirmationStatus: 'CONFIRMED',
          }),
          currency: field({
            field: 'currency',
            proposedValue: 'GBP',
            confirmedValue: 'GBP',
            displayValue: 'GBP',
            confirmationStatus: 'CONFIRMED',
          }),
        },
      }),
    );
    expect(document.querySelector('.facts-row')?.textContent ?? '').toContain('£19.25');
    cleanup();
    await renderCard(
      style({
        needsConfirmationCount: 0,
        fields: {
          costFob: field({
            field: 'costFob',
            proposedValue: 19.25,
            confirmedValue: 19.25,
            displayValue: 19.25,
            confirmationStatus: 'CONFIRMED',
          }),
          currency: field({
            field: 'currency',
            proposedValue: 'USD',
            confirmedValue: 'USD',
            displayValue: 'USD',
            confirmationStatus: 'CONFIRMED',
          }),
        },
      }),
    );
    expect(document.querySelector('.facts-row')?.textContent ?? '').toContain('$19.25');
  });

  it('shows a checked cost as a bare amount when currency is not stated', async () => {
    await renderCard(
      style({
        needsConfirmationCount: 0,
        fields: {
          costFob: field({
            field: 'costFob',
            proposedValue: 19.25,
            confirmedValue: 19.25,
            displayValue: 19.25,
            confirmationStatus: 'CONFIRMED',
          }),
          currency: field({
            field: 'currency',
            proposedValue: 'USD',
            confirmedValue: null,
            displayValue: 'USD',
            confirmationStatus: 'NOT_STATED',
          }),
        },
      }),
    );
    const facts = document.querySelector('.facts-row')?.textContent ?? '';
    expect(facts).toContain('19.25');
    expect(facts).not.toContain('$19.25');
    expect(facts).not.toContain('£19.25');
  });

  it('renders persisted email subjects and timestamps instead of mock conversation copy', async () => {
    await renderCard(style());
    expect(screen.getAllByText('Re: Style REAL-TEST-001').length).toBeGreaterThan(0);
    expect(screen.getByText(new Date('2026-10-05T08:15:00.000Z').toLocaleString())).toBeTruthy();
    expect(screen.queryByText('Initial development brief')).toBeNull();
    expect(screen.queryByText('12 days ago')).toBeNull();
    expect(screen.getAllByRole('link', { name: /Re: Style REAL-TEST-001/ }).length).toBeGreaterThan(0);
  });

  it('does not infer earlier stage approvals from a mentioned PP', async () => {
    await renderCard(style());
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText('Recorded complete')).toBeNull();
  });

  it('can mark a stage complete from explicit approval evidence', async () => {
    await renderCard(
      style({
        fields: {
          quantity: field({}),
          stage: field({
            field: 'stage',
            proposedValue: 'PP',
            displayValue: 'PP',
            evidence: { text: 'PP sample approved 4 Jan' },
          }),
        },
      }),
      [
        {
          ...realEmail,
          bodyText: 'PP sample approved 4 Jan. Qty 600.',
        },
      ],
    );
    expect(screen.getByText('Recorded complete')).toBeTruthy();
  });

  it('offers Add to Range Board only while the style is unlisted', async () => {
    await renderCard(style({ listedAt: null }));
    expect(screen.getByRole('button', { name: 'Add to Range Board' })).toBeTruthy();
    cleanup();
    await renderCard(style({ listedAt: '2026-10-01T00:00:00.000Z' }));
    expect(screen.queryByRole('button', { name: 'Add to Range Board' })).toBeNull();
  });

  it('shows linked email attachments and hides the hardcoded mock files', async () => {
    await renderCard(style(), [
      {
        ...realEmail,
        attachments: [
          attachment({ id: 'att-1', filename: 'img-waist-position-fit-comment.png' }),
          attachment({ id: 'att-2', filename: 'img-mini-dress-comparison.png', sizeBytes: 429615 }),
          attachment({
            id: 'att-3',
            filename: 'pdf-tiered-mini-dress-RSS-5602341.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 3018000,
          }),
        ],
      },
      {
        ...realEmail,
        id: 'email-2',
        attachments: [attachment({ id: 'att-1', filename: 'img-waist-position-fit-comment.png' })],
      },
    ]);
    expect(screen.getByText('img-waist-position-fit-comment.png')).toBeTruthy();
    expect(screen.getByText('img-mini-dress-comparison.png')).toBeTruthy();
    expect(screen.getByText('pdf-tiered-mini-dress-RSS-5602341.pdf')).toBeTruthy();
    expect(screen.getAllByText('img-waist-position-fit-comment.png')).toHaveLength(1);
    expect(screen.queryByText('tech_pack_v2.pdf')).toBeNull();
    expect(screen.queryByText('costing_sheet.xlsx')).toBeNull();
  });

  it('shows the style identity with no fabricated mail when the card has no emails', async () => {
    await renderCard(style({ listedAt: null }), []);
    expect(screen.getByRole('heading', { name: /Style REAL-TEST-001/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'No emails on this style yet.' })).toBeTruthy();
    expect(screen.getByText(/mentions REAL-TEST-001/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to Range Board' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Looks right' }).length).toBeGreaterThan(0);
    expect(await screen.findByRole('link', { name: 'Register a forwarding address' })).toBeTruthy();
    expect(screen.queryByText('tech_pack_v2.pdf')).toBeNull();
    expect(screen.queryByText(/in\.spindle\.app/)).toBeNull();
    expect(screen.queryByText('No files linked to this style yet.')).toBeNull();
    cleanup();

    await renderCard(style(), [realEmail]);
    expect(screen.getAllByText('Re: Style REAL-TEST-001').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'No emails on this style yet.' })).toBeNull();
    expect(screen.getByText('No files linked to this style yet.')).toBeTruthy();
  });

  it('shows an empty files state when linked emails have no attachments', async () => {
    await renderCard(style(), [{ ...realEmail, attachments: [] }]);
    expect(screen.getByText('No files linked to this style yet.')).toBeTruthy();
    expect(screen.queryByText('tech_pack_v2.pdf')).toBeNull();
  });
});
