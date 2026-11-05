import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { StyleFieldView } from '../types';
import { FieldBlock } from './FieldBlock';

vi.mock('../api', () => ({
  api: {
    confirm: vi.fn().mockResolvedValue({}),
    reject: vi.fn().mockResolvedValue({}),
    keep: vi.fn().mockResolvedValue({}),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function field(overrides: Partial<StyleFieldView>): StyleFieldView {
  return {
    field: 'quantity',
    confirmationId: 'conf-1',
    emailId: 'email-1',
    sourceSubject: 'Re: Style UI-TEST-001',
    proposedValue: 480,
    confirmedValue: null,
    displayValue: 480,
    confirmationStatus: 'PROPOSED',
    evidence: { text: 'Quantity: 480 pcs' },
    confirmedBy: null,
    confirmedAt: null,
    source: 'PARSER',
    proposedDiffersFromConfirmed: false,
    ...overrides,
  };
}

function renderField(value: StyleFieldView, compact = false) {
  return render(
    <MemoryRouter>
      <FieldBlock field={value} revisions={[]} onChanged={() => undefined} compact={compact} />
    </MemoryRouter>,
  );
}

describe('field block states', () => {
  it('shows a proposed quantity as from email, check', () => {
    renderField(field({}));
    expect(screen.getByText(/From email:/)).toBeTruthy();
    expect(screen.getByText('480')).toBeTruthy();
    expect(screen.getByText('From email, check')).toBeTruthy();
    expect(screen.getByText('“Quantity: 480 pcs”')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Re: Style UI-TEST-001' }).getAttribute('href')).toBe('/emails/email-1');
    expect(screen.getByRole('button', { name: 'Looks right' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not right' })).toBeTruthy();
  });

  it('shows a checked value without a confirmation pill or outstanding proposal', () => {
    renderField(
      field({
        confirmationStatus: 'CONFIRMED',
        confirmedValue: 800,
        proposedValue: 1200,
        displayValue: 800,
        proposedDiffersFromConfirmed: true,
        evidence: { text: 'Quantity: 1200 pcs later contradiction' },
      }),
    );
    expect(screen.getByText('800')).toBeTruthy();
    expect(screen.queryByText(/Confirmed/)).toBeNull();
    expect(screen.queryByText(/Latest proposal:/)).toBeNull();
    expect(screen.queryByText(/New proposal:/)).toBeNull();
    expect(screen.queryByText(/1200/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Looks right' })).toBeNull();
  });

  it('keeps resolved parser proposals in field history only', () => {
    render(
      <MemoryRouter>
        <FieldBlock
          field={field({
            confirmationStatus: 'CONFIRMED',
            confirmedValue: 800,
            proposedValue: 1200,
            displayValue: 800,
            proposedDiffersFromConfirmed: true,
            evidence: { text: 'Quantity: 1200 pcs later contradiction' },
          })}
          revisions={[
            {
              id: 'r1',
              field: 'quantity',
              previousValue: 480,
              newValue: 1200,
              source: 'PARSER',
              kind: 'PROPOSAL',
              actorId: null,
              confirmationId: 'conf-1',
              sourceEmailId: 'email-1',
              createdAt: '2026-09-29T00:00:00.000Z',
            },
            {
              id: 'r2',
              field: 'quantity',
              previousValue: 480,
              newValue: 800,
              source: 'USER',
              kind: 'CONFIRMATION',
              actorId: 'user-1',
              confirmationId: 'conf-1',
              sourceEmailId: null,
              createdAt: '2026-09-29T01:00:00.000Z',
            },
          ]}
          onChanged={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/1200 · PARSER proposal/)).toBeTruthy();
    expect(screen.getByText(/800 · Edited/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Looks right 1200' })).toBeNull();
  });

  it('shows a dismissed proposal without a looks-right action', () => {
    renderField(
      field({
        field: 'color',
        confirmationStatus: 'REJECTED',
        proposedValue: 'Navy',
        displayValue: 'Navy',
        evidence: { text: 'Color: Navy' },
      }),
    );
    expect(screen.getByText(/Dismissed:/).textContent).toContain('Navy');
    expect(screen.getByText('Dismissed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Looks right' })).toBeNull();
  });

  it('shows needs review with looks right, edit', () => {
    renderField(
      field({
        confirmationStatus: 'NEEDS_REVIEW',
        confirmedValue: 800,
        proposedValue: 1200,
        displayValue: 800,
        proposedDiffersFromConfirmed: true,
      }),
    );
    expect(screen.getByText(/Checked:/).textContent).toContain('800');
    expect(screen.getByText(/New from email:/).textContent).toContain('1200');
    expect(screen.getByText('From email, check')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Looks right 800' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Looks right 1200' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Not right' })).toBeNull();
  });

  it('checks the proposed quantity', async () => {
    const user = userEvent.setup();
    renderField(field({}));
    await user.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(api.confirm).toHaveBeenCalledWith('conf-1');
  });

  it('sends an edited quantity as a number', async () => {
    const user = userEvent.setup();
    renderField(field({}));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByRole('textbox', { name: 'Edit quantity' });
    await user.clear(input);
    await user.type(input, '800');
    await user.click(screen.getByRole('button', { name: 'Save edit' }));
    expect(api.confirm).toHaveBeenCalledWith('conf-1', 800);
  });

  it('marks the proposal as not right', async () => {
    const user = userEvent.setup();
    renderField(field({}));
    await user.click(screen.getByRole('button', { name: 'Not right' }));
    expect(api.reject).toHaveBeenCalledWith('conf-1');
  });
});
