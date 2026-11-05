import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { ConfirmationRow } from '../types';
import type { InboxEmail } from '../lib/inbox';
import { InboxPage } from './Inbox';

vi.mock('../api', () => ({
  api: {
    listInboxEmails: vi.fn(),
    listConfirmations: vi.fn(),
    listBrands: vi.fn(),
    confirm: vi.fn(),
    createBrand: vi.fn(),
    listStyleOnBoard: vi.fn(),
    createStyleFromEmail: vi.fn(),
    listEmailAccounts: vi.fn().mockResolvedValue([]),
    getStyleDraft: vi.fn().mockResolvedValue({
      emailId: 'email-1',
      disposition: 'create',
      canCreate: false,
      blockReasons: [],
      identityConfirmationId: null,
      brand: null,
      matches: [],
      extraction: {
        styleNumber: null,
        styleName: null,
        confidenceTier: null,
        candidates: [],
        fields: {},
      },
      email: {
        id: 'email-1',
        subject: 'Style 3401069',
        fromAddress: 'mill@supplier.example',
        fromName: 'Mill',
        receivedAt: '2026-10-23T13:43:00.000Z',
        status: 'NEEDS_CONFIRMATION',
        styleId: null,
        brandId: null,
      },
    }),
    keep: vi.fn(),
    reject: vi.fn(),
    listEmails: vi.fn().mockResolvedValue([]),
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(api.listInboxEmails).mockReset();
  vi.mocked(api.listConfirmations).mockReset();
  vi.mocked(api.listBrands).mockReset();
  vi.mocked(api.confirm).mockReset();
  vi.mocked(api.listStyleOnBoard).mockReset();
  vi.mocked(api.createStyleFromEmail).mockReset();
  vi.mocked(api.keep).mockReset();
  vi.mocked(api.reject).mockReset();
});

const received: InboxEmail = {
  id: 'email-1',
  subject: 'Style 3401069',
  fromAddress: 'mill@supplier.example',
  fromName: 'Mill',
  receivedAt: '2026-10-23T13:43:00.000Z',
  status: 'NEEDS_CONFIRMATION',
  style: null,
};

const proposal: ConfirmationRow = {
  id: 'conf-1',
  field: 'styleNumber',
  styleId: null,
  emailId: 'email-1',
  status: 'PENDING',
  proposedValue: '3401069',
  confirmedValue: null,
  alternatives: [],
  evidence: null,
  source: 'PARSER',
  reason: 'Style number detected. Confirm to save this style.',
  isCurrent: true,
  confirmedById: null,
  resolvedAt: null,
};

describe('Inbox', () => {
  it('shows a pending proposal and does not list it from Use this style', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listInboxEmails).mockResolvedValue([received]);
    vi.mocked(api.listConfirmations).mockResolvedValue([proposal]);
    vi.mocked(api.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'North', slug: 'north' }]);
    vi.mocked(api.confirm).mockResolvedValue({});

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('link', { name: 'Style 3401069' })).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'New from email' }).getAttribute('href')).toBe('/emails/email-1/new');
    expect(screen.getByRole('button', { name: 'Use this style' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to Range Board' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Use this style' }));
    expect(api.confirm).toHaveBeenCalled();
    expect(api.listStyleOnBoard).not.toHaveBeenCalled();
    expect(api.createStyleFromEmail).not.toHaveBeenCalled();
  });

  it('adds an identity-confirmed style to the Range Board once', async () => {
    const user = userEvent.setup();
    const unlisted: InboxEmail = {
      ...received,
      style: { id: 'style-1', styleNumber: '3401069', name: '3401069', listedAt: null },
    };
    vi.mocked(api.listInboxEmails).mockResolvedValueOnce([unlisted]).mockResolvedValueOnce([
      {
        ...unlisted,
        style: { id: 'style-1', styleNumber: '3401069', name: '3401069', listedAt: '2026-10-24T00:00:00.000Z' },
      },
    ]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);
    vi.mocked(api.listStyleOnBoard).mockResolvedValue({
      id: 'style-1',
      listedAt: '2026-10-24T00:00:00.000Z',
    } as never);

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Add to Range Board' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'New from email' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add to Range Board' }));
    expect(api.listStyleOnBoard).toHaveBeenCalledWith('style-1');
    expect(api.listStyleOnBoard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('option', { name: /Style 3401069/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Needs you/ }));
    expect(await screen.findByRole('heading', { name: 'Nothing needs you' })).toBeTruthy();
    expect(screen.getByText('Every forwarded email is on the right style.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /No emails yet/ })).toBeNull();
  });

  it('keeps loading, empty, and error states separate', async () => {
    vi.mocked(api.listInboxEmails).mockReturnValue(new Promise(() => undefined));
    vi.mocked(api.listConfirmations).mockReturnValue(new Promise(() => undefined));
    const loading = render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Loading the inbox…')).toBeTruthy();
    expect(screen.queryByText('No emails are waiting for review.')).toBeNull();
    expect(screen.queryByRole('heading', { name: /No emails yet/ })).toBeNull();
    loading.unmount();

    vi.mocked(api.listInboxEmails).mockResolvedValue([]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /No emails yet/ })).toBeTruthy();
    expect(screen.getByText(/Spindle is listening/)).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Register a forwarding address' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set up filter' })).toBeNull();
    expect(screen.queryByText(/in\.spindle\.app/)).toBeNull();
    expect(screen.queryByText('No emails are waiting for review.')).toBeNull();
    cleanup();

    vi.mocked(api.listInboxEmails).mockRejectedValue(new Error('inbox down'));
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('inbox down')).toBeTruthy();
    expect(screen.queryByText('No emails are waiting for review.')).toBeNull();
    expect(screen.queryByRole('heading', { name: /No emails yet/ })).toBeNull();
  });

  it('shows a real reading row, then the confirmation workflow once parsing finishes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const reading: InboxEmail = { ...received, status: 'QUEUED' };
    vi.mocked(api.listInboxEmails).mockResolvedValueOnce([reading]).mockResolvedValueOnce([received]);
    vi.mocked(api.listConfirmations).mockResolvedValueOnce([]).mockResolvedValueOnce([proposal]);
    vi.mocked(api.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'North', slug: 'north' }]);

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Reading')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Style 3401069' })).toBeTruthy();
    expect(screen.getByText('Nothing goes on the board until you check it.')).toBeTruthy();
    expect(screen.queryByText('£12.51')).toBeNull();
    expect(screen.queryByText('Sun Embroidered Dress')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use this style' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(await screen.findByRole('button', { name: 'Use this style' })).toBeTruthy();
    expect(screen.queryByText('Reading')).toBeNull();
    expect(screen.queryByRole('heading', { name: /No emails yet/ })).toBeNull();
    vi.useRealTimers();
  });

  it('replaces the listening empty state when the first email arrives', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.mocked(api.listInboxEmails).mockResolvedValueOnce([]).mockResolvedValueOnce([received]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /No emails yet/ })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(await screen.findByRole('link', { name: 'Style 3401069' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /No emails yet/ })).toBeNull();
    vi.useRealTimers();
  });

  it('shows exceptions in Needs you and keeps ordinary mail on All', async () => {
    const user = userEvent.setup();
    const filed: InboxEmail = {
      ...received,
      id: 'email-filed',
      subject: 'Cost update',
      status: 'PARSED',
      receivedAt: '2026-10-20T09:00:00.000Z',
      style: { id: 'style-2', styleNumber: 'HS-5512', name: 'Sun dress', listedAt: '2026-10-01T00:00:00.000Z' },
    };
    const open: InboxEmail = {
      ...received,
      id: 'email-open',
      subject: 'Lab dips round 2',
      receivedAt: '2026-10-22T09:00:00.000Z',
    };
    vi.mocked(api.listInboxEmails).mockResolvedValue([open, filed]);
    vi.mocked(api.listConfirmations).mockResolvedValue([
      proposal,
      {
        ...proposal,
        id: 'qty',
        emailId: 'email-filed',
        field: 'quantity',
        styleId: 'style-2',
        status: 'PENDING',
        proposedValue: 860,
        confirmedValue: null,
      },
    ]);

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('option', { name: /Cost update/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Lab dips round 2/ })).toBeTruthy();
    expect(screen.queryByText('Emails disagree')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Needs you/ }));
    expect(screen.getByRole('option', { name: /Which style/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Cost update/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'New from email' }).getAttribute('href')).toBe('/emails/email-open/new');
  });

  it('shows a real disagreement without confirming either value', async () => {
    const user = userEvent.setup();
    const conflict: InboxEmail = {
      ...received,
      id: 'email-conflict',
      subject: 'Re: HS-5512 shipping',
      status: 'PARSED',
      bodyText: 'Ex-factory is now 14 Feb.',
      style: { id: 'style-9', styleNumber: 'HS-5512', name: 'Sun dress', listedAt: '2026-10-01T00:00:00.000Z' },
    };
    const row: ConfirmationRow = {
      ...proposal,
      id: 'conf-date',
      emailId: 'email-conflict',
      field: 'deliveryDate',
      styleId: 'style-9',
      status: 'NEEDS_REVIEW',
      proposedValue: '14 Feb',
      confirmedValue: '7 Feb',
    };
    vi.mocked(api.listInboxEmails).mockResolvedValue([conflict]);
    vi.mocked(api.listConfirmations).mockResolvedValue([row]);
    vi.mocked(api.keep).mockResolvedValue({});

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText('Emails disagree')).length).toBeGreaterThan(0);
    expect(screen.getByText('Emails disagree. The checked value stays until you pick.')).toBeTruthy();
    expect(api.keep).not.toHaveBeenCalled();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Not right' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Looks right 7 Feb' }));
    expect(api.keep).toHaveBeenCalledWith('conf-date');
    expect(api.confirm).not.toHaveBeenCalled();
  });

  it('groups an exact forwarded copy under Also forwarded', async () => {
    const user = userEvent.setup();
    const body = 'PP sample is approved. Ex-factory is now 14 Feb.';
    const original: InboxEmail = {
      ...received,
      id: 'email-original',
      subject: 'Re: HS-5512 shipping',
      fromName: 'Iris',
      status: 'PARSED',
      bodyText: body,
      receivedAt: '2026-10-20T09:00:00.000Z',
      style: { id: 'style-9', styleNumber: 'HS-5512', name: 'Sun dress', listedAt: '2026-10-01T00:00:00.000Z' },
    };
    const copy: InboxEmail = {
      ...original,
      id: 'email-copy',
      fromName: 'Sam',
      receivedAt: '2026-10-22T15:00:00.000Z',
    };
    vi.mocked(api.listInboxEmails).mockResolvedValue([copy, original]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Also forwarded · 1')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText(/Also forwarded by Sam/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open email' }).getAttribute('href')).toBe('/emails/email-copy');
    await user.click(screen.getByRole('button', { name: /Needs you/ }));
    expect(screen.getByRole('heading', { name: 'Nothing needs you' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Sam/ })).toBeNull();
  });

  it('moves through exceptions with J and K and leaves text fields alone', async () => {
    const user = userEvent.setup();
    const open: InboxEmail = {
      ...received,
      id: 'email-open',
      subject: 'Lab dips round 2',
      receivedAt: '2026-10-24T09:00:00.000Z',
    };
    const failed: InboxEmail = {
      ...received,
      id: 'email-failed',
      subject: 'Unreadable scan',
      status: 'FAILED',
      receivedAt: '2026-10-21T09:00:00.000Z',
      style: null,
      attachments: [
        {
          id: 'file-1',
          filename: 'packing-list.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1200,
          createdAt: '2026-10-21T09:00:00.000Z',
        },
      ],
    };
    vi.mocked(api.listInboxEmails).mockResolvedValue([open, failed]);
    vi.mocked(api.listConfirmations).mockResolvedValue([{ ...proposal, emailId: 'email-open' }]);
    vi.mocked(api.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'North', slug: 'north' }]);

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('link', { name: 'Lab dips round 2' })).length).toBeGreaterThan(0);
    const brand = await screen.findByLabelText('Brand');
    await user.click(brand);
    await user.keyboard('j');
    expect(screen.getAllByRole('link', { name: 'Lab dips round 2' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Unreadable scan' })).toBeNull();

    brand.blur();
    await user.keyboard('j');
    expect(await screen.findByRole('link', { name: 'Unreadable scan' })).toBeTruthy();
    expect(screen.getByText('Spindle could not read this email. The file is still here to open.')).toBeTruthy();
    expect(screen.getByText('packing-list.pdf')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Lab dips round 2' })).toBeNull();

    await user.keyboard('k');
    expect((await screen.findAllByRole('link', { name: 'Lab dips round 2' })).length).toBeGreaterThan(0);
  });

  it('shows style-draft matches without filing the email', async () => {
    const open: InboxEmail = {
      ...received,
      id: 'email-match',
      subject: 'Bulk dispatch',
      status: 'PARSED',
      style: null,
    };
    vi.mocked(api.listInboxEmails).mockResolvedValue([open]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);
    vi.mocked(api.getStyleDraft).mockResolvedValueOnce({
      emailId: 'email-match',
      disposition: 'conflict',
      canCreate: false,
      blockReasons: ['An existing style may match this email. Review instead of creating a duplicate.'],
      identityConfirmationId: null,
      brand: null,
      matches: [{ styleId: 'style-9', styleNumber: 'HS-5512', name: 'Sun dress', kind: 'case-insensitive' }],
      extraction: {
        styleNumber: 'hs-5512',
        styleName: 'Sun dress',
        confidenceTier: 'NEEDS_REVIEW',
        candidates: [],
        fields: { costFob: { value: 12.51, confidence: 0.4, evidence: null, source: 'PARSER' } },
      },
      email: {
        id: 'email-match',
        subject: 'Bulk dispatch',
        fromAddress: 'mill@supplier.example',
        fromName: 'Mill',
        receivedAt: '2026-10-23T13:43:00.000Z',
        status: 'PARSED',
        styleId: null,
        brandId: null,
      },
    });

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText('Which style?')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open style' }).getAttribute('href')).toBe('/styles/style-9');
    expect(screen.queryByText('12.51')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not a style' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not about a style' })).toBeNull();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.createStyleFromEmail).not.toHaveBeenCalled();
  });
});
