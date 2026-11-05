import { describe, expect, it } from 'vitest';
import {
  confidenceLabel,
  draftAllowsCreate,
  evidenceText,
  initialProposalValues,
  proposalPayload,
} from './style-draft';

describe('style draft helpers', () => {
  it('formats evidence, confidence, and numeric proposal payloads', () => {
    expect(evidenceText('Quantity: 400 pcs')).toBe('Quantity: 400 pcs');
    expect(evidenceText({ text: 'FOB 8.50' })).toBe('FOB 8.50');
    expect(confidenceLabel(0.9)).toBe('90% confidence');
    expect(
      initialProposalValues({
        quantity: { value: 400, confidence: 0.9, evidence: 'Quantity: 400', source: 'body' },
      }).quantity,
    ).toBe('400');
    expect(proposalPayload({ quantity: '400', costFob: '8.5', color: ' IVORY ', fabric: '' })).toEqual({
      quantity: 400,
      costFob: 8.5,
      color: 'IVORY',
    });
  });

  it('allows create for create and needs_identity, not match or conflict', () => {
    expect(draftAllowsCreate({ disposition: 'create' })).toBe(true);
    expect(draftAllowsCreate({ disposition: 'needs_identity' })).toBe(true);
    expect(draftAllowsCreate({ disposition: 'match' })).toBe(false);
    expect(draftAllowsCreate({ disposition: 'conflict' })).toBe(false);
  });
});
