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
    expect(stageTimelineEntry('PROTO', { texts: ['Lab dip approved yesterday, proto next'] }).state).toBe('mentioned');
  });
});
