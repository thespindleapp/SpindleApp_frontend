import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { EmailAttachment } from '../types';
import { AttachmentGrid } from './AttachmentGrid';

vi.mock('../api', () => ({
  api: {
    getAttachmentBlob: vi.fn(),
  },
}));

const pngBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const pdfBlob = new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' });

function attachment(overrides: Partial<EmailAttachment> & { emailId?: string } = {}) {
  return {
    id: 'att-1',
    emailId: 'email-1',
    filename: 'img-waist-position-fit-comment.png',
    mimeType: 'image/png',
    sizeBytes: 208380,
    createdAt: '2026-11-02T20:27:00.465Z',
    ...overrides,
  };
}

describe('AttachmentGrid previews', () => {
  beforeEach(() => {
    let n = 0;
    Object.assign(URL, {
      createObjectURL: vi.fn(() => `blob:test-${++n}`),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.mocked(api.getAttachmentBlob).mockReset();
  });

  it('loads an image thumbnail through the authenticated blob fetch', async () => {
    vi.mocked(api.getAttachmentBlob).mockResolvedValue(pngBlob);
    render(
      <AttachmentGrid
        attachments={[attachment()]}
        emptyMessage="No files linked to this style yet."
      />,
    );

    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.getByText('img-waist-position-fit-comment.png')).toBeTruthy();
    expect(screen.getByText('203 KB')).toBeTruthy();

    const image = await screen.findByRole('img', { name: 'img-waist-position-fit-comment.png' });
    expect(image.getAttribute('src')).toBe('blob:test-1');
    expect(api.getAttachmentBlob).toHaveBeenCalledWith('email-1', 'att-1');

    await userEvent.click(screen.getByRole('button', { name: 'Open img-waist-position-fit-comment.png' }));
    expect(window.open).toHaveBeenCalledWith('blob:test-1', '_blank', 'noopener');
  });

  it('keeps a PDF card without fetching until it is opened', async () => {
    vi.mocked(api.getAttachmentBlob).mockResolvedValue(pdfBlob);
    render(
      <AttachmentGrid
        attachments={[
          attachment({
            id: 'att-pdf',
            filename: 'pdf-tiered-mini-dress-RSS-5602341.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 3018000,
          }),
        ]}
        emptyMessage="No files linked to this style yet."
      />,
    );

    expect(screen.getByText('pdf-tiered-mini-dress-RSS-5602341.pdf')).toBeTruthy();
    expect(screen.getByText('2.9 MB')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('Loading')).toBeNull();
    expect(api.getAttachmentBlob).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Open pdf-tiered-mini-dress-RSS-5602341.pdf' }));
    await waitFor(() => expect(api.getAttachmentBlob).toHaveBeenCalledWith('email-1', 'att-pdf'));
  });

  it('shows a loading state until the image blob is ready', async () => {
    let resolveBlob: ((blob: Blob) => void) | undefined;
    vi.mocked(api.getAttachmentBlob).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBlob = resolve;
        }),
    );
    render(<AttachmentGrid attachments={[attachment()]} emptyMessage="none" />);

    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    resolveBlob?.(pngBlob);
    expect(await screen.findByRole('img', { name: 'img-waist-position-fit-comment.png' })).toBeTruthy();
    expect(screen.queryByText('Loading')).toBeNull();
  });

  it('shows a preview error without hiding the filename', async () => {
    vi.mocked(api.getAttachmentBlob).mockRejectedValue(new Error('Unable to open attachment'));
    render(<AttachmentGrid attachments={[attachment()]} emptyMessage="none" />);

    expect(await screen.findByText('Preview unavailable')).toBeTruthy();
    expect(screen.getByText('img-waist-position-fit-comment.png')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('revokes image blob URLs when the grid unmounts', async () => {
    vi.mocked(api.getAttachmentBlob).mockResolvedValue(pngBlob);
    const { unmount } = render(<AttachmentGrid attachments={[attachment()]} emptyMessage="none" />);
    await screen.findByRole('img', { name: 'img-waist-position-fit-comment.png' });
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });
});
