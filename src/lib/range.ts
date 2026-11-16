import type { StyleCard, StyleFieldView } from '../types';
import { blocksGbp, hasOutstandingProposal, isCheckedStatus, formatFieldValue, formatGbpFromMinor, formatMoneyAmount, moneyMinorUnits, revisionLabel } from './format';

/** Fields a style card can actually carry. Not prototype columns such as drop, mill, or target cost. */
export const RANGE_FIELDS = [
  'quantity',
  'costFob',
  'stage',
  'deliveryDate',
  'status',
  'color',
  'fabric',
  'season',
  'factoryName',
  'currency',
] as const;

export type RangeField = (typeof RANGE_FIELDS)[number];

export const DEFAULT_RANGE_FIELDS: RangeField[] = [
  'quantity',
  'costFob',
  'stage',
  'deliveryDate',
  'status',
  'color',
  'factoryName',
];

const RANGE_LABELS: Record<RangeField, string> = {
  quantity: 'Quantity',
  costFob: 'Cost',
  stage: 'Stage',
  deliveryDate: 'Delivery',
  status: 'Status',
  color: 'Color',
  fabric: 'Fabric',
  season: 'Season',
  factoryName: 'Factory',
  currency: 'Currency',
};

export function rangeFieldLabel(field: RangeField) {
  return RANGE_LABELS[field];
}

const STATUS_BADGES: Record<string, { label: string; tone: 'risk' | 'track' | 'blocked' | 'waiting' | 'shipped' }> = {
  'at risk': { label: 'At risk', tone: 'risk' },
  at_risk: { label: 'At risk', tone: 'risk' },
  'on track': { label: 'On track', tone: 'track' },
  on_track: { label: 'On track', tone: 'track' },
  blocked: { label: 'Blocked', tone: 'blocked' },
  'waiting on supplier': { label: 'Waiting on supplier', tone: 'waiting' },
  waiting_on_supplier: { label: 'Waiting on supplier', tone: 'waiting' },
  waiting: { label: 'Waiting', tone: 'waiting' },
  shipped: { label: 'Shipped', tone: 'shipped' },
};

/** A badge only when a status was recorded. Known phrases use the client colours. Anything else stays as written. */
export function statusBadge(text: string): { label: string; tone: string } | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === '—') return null;
  return STATUS_BADGES[trimmed.toLowerCase()] ?? { label: trimmed, tone: 'neutral' };
}

export function checkedNumber(field: StyleFieldView | null | undefined): number | null {
  if (!field || !isCheckedStatus(field.confirmationStatus)) return null;
  const value = field.confirmedValue ?? field.displayValue;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A currency symbol is allowed only for a checked code. NOT_STATED contributes nothing. */
export interface OrderTotal {
  currency: 'GBP';
  total: number;
}

function poundsFromMinor(minor: number): number {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const pounds = Math.trunc(abs / 100);
  const pence = abs % 100;
  return Number(`${negative ? '-' : ''}${pounds}.${String(pence).padStart(2, '0')}`);
}

/**
 * Checked quantity × checked cost, summed in integer pence, as GBP.
 * Unchecked amounts are left out. A stated non-GBP currency is left out.
 */
export function orderTotals(styles: Array<Pick<StyleCard, 'fields'>>): OrderTotal[] {
  let minor = 0;
  let counted = 0;
  for (const style of styles) {
    if (blocksGbp(style.fields.currency)) continue;
    const quantity = checkedNumber(style.fields.quantity);
    const costMinor = moneyMinorUnits(checkedNumber(style.fields.costFob));
    if (quantity == null || !Number.isInteger(quantity) || quantity <= 0 || costMinor == null || costMinor < 0) {
      continue;
    }
    minor += quantity * costMinor;
    counted += 1;
  }
  if (counted === 0) return [];
  return [{ currency: 'GBP', total: poundsFromMinor(minor) }];
}

export function formatOrderTotal(total: OrderTotal): string {
  const text = total.total.toFixed(2);
  const negative = text.startsWith('-');
  const [pounds, pence] = text.replace('-', '').split('.');
  const minor = (negative ? -1 : 1) * (Number(pounds) * 100 + Number(pence));
  return formatGbpFromMinor(minor);
}

/** Line value only when qty, cost, and currency are all checked. Otherwise the column stays empty. */
export function lineOrderValue(style: Pick<StyleCard, 'fields'>): string | null {
  const totals = orderTotals([style]);
  return totals[0] ? formatOrderTotal(totals[0]) : null;
}

export function displayFact(
  field: StyleFieldView | null | undefined,
  options: { money?: boolean; currency?: StyleFieldView | null } = {},
): { text: string; unchecked: boolean; disagree: boolean } {
  const disagree = field?.confirmationStatus === 'NEEDS_REVIEW' || field?.proposedDiffersFromConfirmed === true;
  if (!field || field.confirmationStatus === 'NOT_STATED' || field.confirmationStatus === 'REJECTED') {
    return { text: '—', unchecked: false, disagree: false };
  }
  if (isCheckedStatus(field.confirmationStatus)) {
    const value = field.confirmedValue ?? field.displayValue;
    if (value == null || value === '') return { text: '—', unchecked: hasOutstandingProposal(field), disagree };
    const text = options.money ? formatMoneyAmount(value, options.currency) : formatFieldValue(value);
    return { text, unchecked: hasOutstandingProposal(field), disagree };
  }
  const raw = field.proposedValue ?? field.displayValue;
  if (raw == null || raw === '') return { text: '—', unchecked: false, disagree: false };
  const text = options.money ? formatMoneyAmount(raw, options.currency) : formatFieldValue(raw);
  if (text === '—') return { text: '—', unchecked: false, disagree: false };
  return { text, unchecked: true, disagree };
}

export function emailsDisagree(style: Pick<StyleCard, 'fields'>): boolean {
  return Object.values(style.fields).some(
    (field) => field?.confirmationStatus === 'NEEDS_REVIEW' || field?.proposedDiffersFromConfirmed === true,
  );
}

export interface OutstandingCheck {
  styleId: string;
  styleNumber: string;
  field: StyleFieldView;
}

/** One real outstanding confirmation. Identity filing stays in the inbox. */
export function outstandingChecks(styles: Array<Pick<StyleCard, 'id' | 'styleNumber' | 'fields'>>): OutstandingCheck[] {
  const checks: OutstandingCheck[] = [];
  for (const style of styles) {
    for (const field of Object.values(style.fields)) {
      if (!field?.confirmationId) continue;
      if (field.field === 'styleAssignment') continue;
      if (!hasOutstandingProposal(field)) continue;
      checks.push({ styleId: style.id, styleNumber: style.styleNumber, field });
    }
  }
  return checks;
}

export interface HistoryEntry {
  id: string;
  styleNumber: string;
  field: string;
  label: string;
  createdAt: string;
}

export function historyEntries(styles: Array<Pick<StyleCard, 'styleNumber' | 'fieldRevisions'>>): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const style of styles) {
    for (const revision of style.fieldRevisions ?? []) {
      entries.push({
        id: revision.id,
        styleNumber: style.styleNumber,
        field: revision.field,
        label: revisionLabel(revision),
        createdAt: revision.createdAt,
      });
    }
  }
  return entries.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
}
