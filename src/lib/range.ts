import type { StyleCard, StyleFieldView } from '../types';
import { hasOutstandingProposal, isCheckedStatus, formatFieldValue, formatMoneyAmount, revisionLabel } from './format';

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
export function checkedCurrencyCode(field: StyleFieldView | null | undefined): string | null {
  if (!field || !isCheckedStatus(field.confirmationStatus)) return null;
  const code = String(field.confirmedValue ?? field.displayValue ?? '')
    .trim()
    .toUpperCase();
  if (!code || code === 'NOT_STATED') return null;
  return code;
}

export interface OrderTotal {
  currency: string;
  total: number;
}

/**
 * Qty × cost, grouped by confirmed currency.
 * Unchecked amounts and unstated currencies are left out. Currencies are never added together.
 */
export function orderTotals(styles: Array<Pick<StyleCard, 'fields'>>): OrderTotal[] {
  const buckets = new Map<string, number>();
  for (const style of styles) {
    const quantity = checkedNumber(style.fields.quantity);
    const cost = checkedNumber(style.fields.costFob);
    const currency = checkedCurrencyCode(style.fields.currency);
    if (quantity == null || cost == null || !currency) continue;
    buckets.set(currency, (buckets.get(currency) ?? 0) + quantity * cost);
  }
  return [...buckets.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export function formatOrderTotal(total: OrderTotal): string {
  return formatMoneyAmount(total.total, {
    confirmationStatus: 'CONFIRMED',
    confirmedValue: total.currency,
    displayValue: total.currency,
  });
}

/** Line value only when qty, cost, and currency are all checked. Otherwise the column stays empty. */
export function lineOrderValue(style: Pick<StyleCard, 'fields'>): string | null {
  const totals = orderTotals([style]);
  return totals[0] ? formatOrderTotal(totals[0]) : null;
}

export function displayFact(
  field: StyleFieldView | null | undefined,
  options: { money?: boolean; currency?: StyleFieldView | null } = {},
): { text: string; unchecked: boolean } {
  if (!field || field.confirmationStatus === 'NOT_STATED' || field.confirmationStatus === 'REJECTED') {
    return { text: '—', unchecked: false };
  }
  if (isCheckedStatus(field.confirmationStatus)) {
    const value = field.confirmedValue ?? field.displayValue;
    if (value == null || value === '') return { text: '—', unchecked: hasOutstandingProposal(field) };
    const text = options.money ? formatMoneyAmount(value, options.currency) : formatFieldValue(value);
    return { text, unchecked: hasOutstandingProposal(field) };
  }
  if (hasOutstandingProposal(field)) {
    const text = options.money ? formatMoneyAmount(field.proposedValue, options.currency) : formatFieldValue(field.proposedValue);
    return { text, unchecked: true };
  }
  return { text: '—', unchecked: false };
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
