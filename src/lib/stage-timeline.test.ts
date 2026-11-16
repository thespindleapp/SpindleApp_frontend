import { describe, expect, it } from 'vitest';
import { findExplicitStageApproval, stageTimelineEntry } from './stage-timeline';

describe('explicit stage approval', () => {
  it('does not treat "approved" inside another word as PP approval', () => {
    expect(findExplicitStageApproval('PP', ['The shipment was approved for costing only'])).toBeNull();
  });

  it('accepts lab dip approved as complete evidence', () => {
    const snippet = findExplicitStageApproval('LAB_DIP', ['Lab dip approved yesterday, proto next']);
    expect(snippet).toMatch(/Lab dip approved/i);
    expect(stageTimelineEntry('LAB_DIP', { texts: ['Lab dip approved yesterday, proto next'] }).state).toBe('approved');
    expect(stageTimelineEntry('FIT_SAMPLE', { texts: ['Lab dip approved yesterday, proto next'] }).state).toBe('not_recorded');
    expect(stageTimelineEntry('TECH_PACK', { texts: ['Lab dip approved yesterday, proto next'] }).state).toBe('not_recorded');
  });

  it('leaves a stage not recorded when the email does not mention it', () => {
    expect(stageTimelineEntry('COSTING', { texts: ['Lab dip approved yesterday'] }).state).toBe('not_recorded');
    expect(stageTimelineEntry('STRIKE_OFF', { texts: ['Fit sample approved'] }).state).toBe('not_recorded');
    expect(stageTimelineEntry('TOP', { texts: ['Fit sample approved'] }).state).toBe('not_recorded');
  });

  it('keeps an unconfirmed stage proposal out of recorded complete', () => {
    expect(
      stageTimelineEntry('PP', {
        texts: ['PP sample next week'],
        stageField: {
          field: 'stage',
          confirmationId: 'c1',
          emailId: null,
          sourceSubject: null,
          proposedValue: 'PP',
          confirmedValue: null,
          displayValue: 'PP',
          confirmationStatus: 'PROPOSED',
          evidence: { text: 'PP sample next week' },
          confirmedBy: null,
          confirmedAt: null,
          source: 'PARSER',
          proposedDiffersFromConfirmed: false,
        },
      }).state,
    ).toBe('proposed');
  });

  it('does not record bulk complete when approval is still conditional', () => {
    expect(findExplicitStageApproval('BULK', ['will submit the BRS sample once bulk is approved'])).toBeNull();
    expect(stageTimelineEntry('BULK', { texts: ['will submit the BRS sample once bulk is approved'] }).state).not.toBe('approved');
  });
});
