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
    getStyle: vi.fn().mockResolvedValue({ fields: {} }),
    assignEmailStyle: vi.fn(),
    markEmailNotAboutStyle: vi.fn(),
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
    inboxProgress: vi.fn().mockResolvedValue({
      received: 0,
      queued: 0,
      processing: 0,
      processed: 0,
      review: 0,
      failed: 0,
      ignored: 0,
      progress: 0,
      active: false,
      complete: false,
      state: 'empty',
      needsYou: 0,
      openDuplicates: 0,
    }),
    reprocessEmail: vi.fn(),
    listEmailDuplicates: vi.fn().mockResolvedValue([]),
    dismissDuplicate: vi.fn(),
    confirmDuplicate: vi.fn(),
  },
}));

const idleProgress = {
  received: 0,
  queued: 0,
  processing: 0,
  processed: 0,
  review: 0,
  failed: 0,
  ignored: 0,
  progress: 0,
  active: false,
  complete: false,
  state: 'empty' as const,
  needsYou: 0,
  openDuplicates: 0,
  batch: null,
};

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
  vi.mocked(api.inboxProgress).mockReset();
  vi.mocked(api.inboxProgress).mockResolvedValue(idleProgress);
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
    expect(screen.queryByRole('link', { name: 'New from email' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use this style' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not about a style' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to Range Board' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Use this style' }));
    expect(api.confirm).toHaveBeenCalled();
    expect(api.listStyleOnBoard).not.toHaveBeenCalled();
    expect(api.createStyleFromEmail).not.toHaveBeenCalled();
  });

  it('keeps the Needs you count on the workspace total after an email is set aside', async () => {
    const user = userEvent.setup();
    const settled = { ...idleProgress, received: 4, processed: 1, progress: 1, active: false, complete: true, state: 'completed' as const };
    vi.mocked(api.listInboxEmails)
      .mockResolvedValueOnce([received])
      .mockResolvedValueOnce([{ ...received, status: 'PARSED', metadata: { filing: 'not_about_a_style' } }]);
    vi.mocked(api.listConfirmations).mockResolvedValueOnce([proposal]).mockResolvedValueOnce([]);
    vi.mocked(api.inboxProgress)
      .mockResolvedValueOnce({ ...settled, needsYou: 4 })
      .mockResolvedValueOnce({ ...settled, needsYou: 3 });
    vi.mocked(api.markEmailNotAboutStyle).mockResolvedValue(received);

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Needs you · 4' })).toBeTruthy();
    expect(screen.getByText('4 need you')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Not about a style' }));
    expect(await screen.findByRole('button', { name: 'Needs you · 3' })).toBeTruthy();
    expect(screen.getByText('3 need you')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Needs you · 3' }));
    expect(await screen.findByRole('heading', { name: 'Nothing needs you' })).toBeTruthy();
  });

  it('opens a filed style without an add-to-board action', async () => {
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

    expect(await screen.findByRole('link', { name: 'Open 3401069' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to Range Board' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New from email' })).toBeNull();
    expect(api.listStyleOnBoard).not.toHaveBeenCalled();
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
    expect(screen.getByText(/Register a forwarding address to start listening/)).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Register a forwarding address' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Set up filter' })).toBeTruthy();
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
    expect(screen.getByText(/filed on the Range board when the read finishes/)).toBeTruthy();
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
    expect(screen.getByLabelText('Tell me which style it is about')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not about a style' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'New from email' })).toBeNull();
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

  it('shows a provider redelivery and keeps a failed copy in Needs you', async () => {
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
      redeliveryCount: 2,
      style: { id: 'style-9', styleNumber: 'HS-5512', name: 'Sun dress', listedAt: '2026-10-01T00:00:00.000Z' },
    };
    const failed: InboxEmail = {
      ...original,
      id: 'email-failed-copy',
      fromName: 'Sam',
      receivedAt: '2026-10-22T15:00:00.000Z',
      status: 'FAILED',
      issueKind: 'PARSE_FAILURE',
      issueReason: 'The scan could not be read.',
      redeliveryCount: 0,
      duplicateOfEmailId: 'email-original',
      duplicateVerdict: 'CONFIRMED',
      style: null,
    };
    const healthy: InboxEmail = {
      ...original,
      id: 'email-healthy-copy',
      fromName: 'Ada',
      receivedAt: '2026-10-23T15:00:00.000Z',
      redeliveryCount: 0,
      duplicateOfEmailId: 'email-original',
      duplicateVerdict: 'CONFIRMED',
    };
    vi.mocked(api.listInboxEmails).mockResolvedValue([failed, healthy, original]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);
    vi.mocked(api.inboxProgress).mockResolvedValue({ ...idleProgress, received: 3, needsYou: 1 });

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText('Your mail provider sent this message again 2 times.')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Needs you · 1' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Needs you · 1' }));
    expect(screen.getByRole('option', { name: /Iris/ })).toBeTruthy();
    expect(screen.getByText(/Also forwarded by Sam/)).toBeTruthy();
    expect(screen.getAllByText(/Could not read/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open that delivery' }).getAttribute('href')).toBe('/emails/email-failed-copy');
    expect(screen.getByText(/Also forwarded by Ada/)).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(1);
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
    const styleNumber = await screen.findByLabelText('Tell me which style it is about');
    await user.click(styleNumber);
    await user.keyboard('j');
    expect(screen.getAllByRole('link', { name: 'Lab dips round 2' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Unreadable scan' })).toBeNull();

    styleNumber.blur();
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
    expect(screen.getByRole('button', { name: 'This style' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not about a style' })).toBeTruthy();
    expect(screen.queryByText('12.51')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not a style' })).toBeNull();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.createStyleFromEmail).not.toHaveBeenCalled();
  });

  it('shows persisted batch progress and retries a failed email without dropping it', async () => {
    const user = userEvent.setup();
    const failed: InboxEmail = {
      ...received,
      id: 'email-failed',
      subject: 'Tech pack',
      status: 'FAILED',
      issueKind: 'REPEATED_FAILURE',
      issueReason: 'Processing failed 5 times. Automatic retries have stopped.',
      style: null,
    };
    vi.mocked(api.listInboxEmails).mockResolvedValue([failed]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);
    vi.mocked(api.inboxProgress).mockResolvedValue({
      received: 1200,
      queued: 0,
      processing: 0,
      processed: 1100,
      review: 90,
      failed: 10,
      ignored: 0,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed_with_errors',
      needsYou: 10,
      openDuplicates: 0,
    });
    vi.mocked(api.reprocessEmail).mockResolvedValue({ queued: true, emailId: 'email-failed' });

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('1200 received')).toBeTruthy();
    expect(screen.getByText('10 need you')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Needs you · 10' })).toBeTruthy();
    expect(screen.getByText('10 could not be read')).toBeTruthy();
    expect(screen.getByText('Showing the latest 1 of 1200.')).toBeTruthy();
    expect((await screen.findAllByText(/Automatic retries have stopped/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(api.reprocessEmail).toHaveBeenCalledWith('email-failed');
    expect(await screen.findByText('Queued to be read again.')).toBeTruthy();
  });

  it('shows the active batch instead of the inbox totals', async () => {
    vi.mocked(api.listInboxEmails).mockResolvedValue([received]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);
    vi.mocked(api.inboxProgress).mockResolvedValue({
      received: 1200,
      queued: 0,
      processing: 0,
      processed: 1100,
      review: 90,
      failed: 10,
      ignored: 0,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed_with_errors',
      needsYou: 7,
      openDuplicates: 0,
      batch: {
        id: 'batch-live',
        source: 'webhook',
        startedAt: '2026-11-16T00:00:00.000Z',
        completedAt: null,
        received: 40,
        queued: 10,
        processing: 5,
        processed: 20,
        review: 4,
        failed: 1,
        ignored: 0,
        progress: 0.625,
        active: true,
        complete: false,
        state: 'processing',
      },
    });

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('This batch')).toBeTruthy();
    expect(screen.getByText('25 of 40 settled')).toBeTruthy();
    expect(screen.getByText('40 received')).toBeTruthy();
    expect(screen.getByText('10 queued')).toBeTruthy();
    expect(screen.getByText('5 processing')).toBeTruthy();
    expect(screen.getByText('20 filed')).toBeTruthy();
    expect(screen.getByText('7 need you')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Needs you · 7' })).toBeTruthy();
    expect(screen.queryByText('4 need you')).toBeNull();
    expect(screen.getByText('1 could not be read')).toBeTruthy();
    expect(screen.getByText('Whole inbox · 1200 received')).toBeTruthy();
    expect(screen.queryByText('1200 received')).toBeNull();
    expect(screen.queryByText('Finished, and 10 emails need another look')).toBeNull();
  });

  it('shows the settled batch outcome instead of older inbox failures', async () => {
    vi.mocked(api.listInboxEmails).mockResolvedValue([received]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);
    vi.mocked(api.inboxProgress).mockResolvedValue({
      received: 1200,
      queued: 0,
      processing: 0,
      processed: 1190,
      review: 0,
      failed: 10,
      ignored: 0,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed_with_errors',
      needsYou: 9,
      openDuplicates: 0,
      batch: {
        id: 'batch-done',
        source: 'webhook',
        startedAt: '2026-11-16T00:00:00.000Z',
        completedAt: '2026-11-16T00:05:00.000Z',
        received: 8,
        queued: 0,
        processing: 0,
        processed: 6,
        review: 2,
        failed: 0,
        ignored: 0,
        progress: 1,
        active: false,
        complete: true,
        state: 'completed',
      },
    });

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Finished. 9 still need you')).toBeTruthy();
    expect(screen.getByText('8 received')).toBeTruthy();
    expect(screen.getByText('9 need you')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Needs you · 9' })).toBeTruthy();
    expect(screen.queryByText('2 need you')).toBeNull();
    expect(screen.getByText('0 could not be read')).toBeTruthy();
    expect(screen.queryByText('Finished, and 10 emails need another look')).toBeNull();
    expect(screen.getByText('Whole inbox · 1200 received')).toBeTruthy();
  });

  it('notices a new batch after the inbox was idle and stops polling on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const idle = {
      received: 20,
      queued: 0,
      processing: 0,
      processed: 20,
      review: 0,
      failed: 0,
      ignored: 0,
      progress: 1,
      active: false,
      complete: true,
      state: 'completed' as const,
      needsYou: 0,
      openDuplicates: 0,
      batch: {
        id: 'batch-idle',
        source: 'webhook',
        startedAt: '2026-11-16T00:00:00.000Z',
        completedAt: '2026-11-16T00:05:00.000Z',
        received: 8,
        queued: 0,
        processing: 0,
        processed: 8,
        review: 0,
        failed: 0,
        ignored: 0,
        progress: 1,
        active: false,
        complete: true,
        state: 'completed' as const,
      },
    };
    const started = {
      ...idle,
      received: 23,
      queued: 3,
      processed: 20,
      progress: 20 / 23,
      active: true,
      complete: false,
      state: 'processing' as const,
      batch: {
        ...idle.batch,
        id: 'batch-next',
        completedAt: null,
        received: 3,
        queued: 3,
        processed: 0,
        progress: 0,
        active: true,
        complete: false,
        state: 'processing' as const,
      },
    };
    const snapshots = [idle, idle, started];
    let index = 0;
    vi.mocked(api.inboxProgress).mockImplementation(async () => snapshots[Math.min(index++, snapshots.length - 1)] ?? started);
    vi.mocked(api.listInboxEmails).mockResolvedValue([received]);
    vi.mocked(api.listConfirmations).mockResolvedValue([]);

    const view = render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Finished')).toBeTruthy();
    expect(screen.getByText('8 received')).toBeTruthy();
    expect(api.listInboxEmails).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(vi.mocked(api.inboxProgress).mock.calls.length).toBeGreaterThan(1);
    expect(api.listInboxEmails).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Finished')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(await screen.findByText('0 of 3 settled')).toBeTruthy();
    expect(screen.getByText('3 received')).toBeTruthy();
    expect(vi.mocked(api.listInboxEmails).mock.calls.length).toBeGreaterThan(1);

    const callsWhileMounted = vi.mocked(api.inboxProgress).mock.calls.length;
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    expect(vi.mocked(api.inboxProgress).mock.calls.length).toBe(callsWhileMounted);
    vi.useRealTimers();
  });
});
