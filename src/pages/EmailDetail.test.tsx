import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { EmailAttachment, EmailDetail } from '../types';
import { EmailDetailPage } from './EmailDetail';

vi.mock('../api', () => ({
  api: {
    getEmail: vi.fn(),
    getAttachmentBlob: vi.fn(async () => new Blob([new Uint8Array([1])], { type: 'image/png' })),
    reprocessEmail: vi.fn(),
  },
}));

beforeEach(() => {
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:email-thumb'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.mocked(api.getEmail).mockReset();
});

function email(overrides: Partial<EmailDetail> = {}): EmailDetail {
  return {
    id: 'email-1',
    subject: 'Style 7456621 proto',
    fromAddress: 'mill@supplier.example',
    fromName: 'Mill',
    bodyText: 'Please proceed',
    receivedAt: '2026-10-23T13:43:00.000Z',
    status: 'NEEDS_CONFIRMATION',
    styleId: null,
    attachments: [],
    ...overrides,
  };
}

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

describe('Email detail', () => {
  it('returns an unassigned email to the inbox without a new-style form', async () => {
    vi.mocked(api.getEmail).mockResolvedValue(email());
    render(
      <MemoryRouter initialEntries={['/emails/email-1']}>
        <Routes>
          <Route path="/emails/:emailId" element={<EmailDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Back to inbox' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'New from email' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to inbox' }).getAttribute('href')).toBe('/inbox');
  });

  it('does not offer New from email once a style is linked', async () => {
    vi.mocked(api.getEmail).mockResolvedValue(email({ styleId: 'style-1' }));
    render(
      <MemoryRouter initialEntries={['/emails/email-1']}>
        <Routes>
          <Route path="/emails/:emailId" element={<EmailDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect((await screen.findByRole('link', { name: 'Open style card' })).getAttribute('href')).toBe('/styles/style-1');
    expect(screen.queryByRole('link', { name: 'New from email' })).toBeNull();
  });

  it('lists the email attachments', async () => {
    vi.mocked(api.getEmail).mockResolvedValue(
      email({
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
      }),
    );
    render(
      <MemoryRouter initialEntries={['/emails/email-1']}>
        <Routes>
          <Route path="/emails/:emailId" element={<EmailDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('img-waist-position-fit-comment.png')).toBeTruthy();
    expect(screen.getByText('img-mini-dress-comparison.png')).toBeTruthy();
    expect(screen.getByText('pdf-tiered-mini-dress-RSS-5602341.pdf')).toBeTruthy();
  });

  it('shows an empty attachments state', async () => {
    vi.mocked(api.getEmail).mockResolvedValue(email({ attachments: [] }));
    render(
      <MemoryRouter initialEntries={['/emails/email-1']}>
        <Routes>
          <Route path="/emails/:emailId" element={<EmailDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('No attachments.')).toBeTruthy();
  });

  it('keeps a failed email on screen and can queue it again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getEmail).mockResolvedValue(
      email({
        status: 'FAILED',
        issueKind: 'PARSE_FAILURE',
        issueReason: 'The parser stopped on this message.',
      }),
    );
    vi.mocked(api.reprocessEmail).mockResolvedValue({ queued: true, emailId: 'email-1' });
    render(
      <MemoryRouter initialEntries={['/emails/email-1']}>
        <Routes>
          <Route path="/emails/:emailId" element={<EmailDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('The parser stopped on this message.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(api.reprocessEmail).toHaveBeenCalledWith('email-1');
    expect(await screen.findByText('Queued to be read again.')).toBeTruthy();
  });
});
