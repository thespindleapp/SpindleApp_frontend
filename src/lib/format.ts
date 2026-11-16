import type { FieldDisplayStatus } from '../types';

export const FIELD_ORDER = [
  'quantity',
  'stage',
  'status',
  'color',
  'fabric',
  'costFob',
  'currency',
  'deliveryDate',
  'season',
  'inspectionType',
  'factoryName',
  'name',
  'styleNumber',
  'sizeRange',
  'styleAssignment',
] as const;

const LABELS: Record<string, string> = {
  quantity: 'Quantity',
  stage: 'Stage',
  status: 'Status',
  color: 'Color',
  fabric: 'Fabric',
  costFob: 'Cost FOB',
  currency: 'Currency',
  deliveryDate: 'Delivery',
  season: 'Season',
  inspectionType: 'Inspection',
  factoryName: 'Factory',
  name: 'Name',
  styleNumber: 'Style number',
  sizeRange: 'Size range',
  styleAssignment: 'Style identity',
};

export function fieldLabel(field: string) {
  return LABELS[field] ?? field;
}

export function isCheckedStatus(status: FieldDisplayStatus | string | undefined) {
  return status === 'CONFIRMED' || status === 'NEEDS_REVIEW';
}

export function statusLabel(status: FieldDisplayStatus | string) {
  switch (status) {
    case 'PROPOSED':
    case 'PENDING':
    case 'UNCONFIRMED':
    case 'NEEDS_REVIEW':
      return 'From email, check';
    case 'CONFIRMED':
      return '';
    case 'REJECTED':
      return 'Dismissed';
    case 'NOT_STATED':
      return 'Not recorded';
    default:
      return status;
  }
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Drop a leading style number so the title is the garment name. */
export function presentStyleName(value: string, styleNumber: string, evidence?: unknown): string | null {
  const number = styleNumber.trim();
  let name = value.trim().replace(new RegExp(`^(?:style\\s*)?#?\\s*${escapeRegExp(number)}\\s*[-–:]\\s*`, 'i'), '');
  name = name.replace(/^(?:style\s+)?#?\d{5,8}\s*[-–:]\s*/i, '').replace(/\s*[-–]\s*$/, '').trim();
  if (!name || name.toLowerCase() === number.toLowerCase() || /^style\s+\S+$/i.test(name)) {
    return null;
  }
  const evidenceText =
    typeof evidence === 'string'
      ? evidence
      : evidence && typeof evidence === 'object' && typeof (evidence as { text?: unknown }).text === 'string'
        ? (evidence as { text: string }).text
        : null;
  if (evidenceText) {
    const found = evidenceText.match(new RegExp(name.split(/\s+/).map(escapeRegExp).join('\\s+'), 'i'));
    if (found?.[0] && found[0].toLowerCase() === name.toLowerCase()) {
      return found[0].replace(/\s+/g, ' ').trim();
    }
  }
  if (name === name.toUpperCase() && /[A-Z]/.test(name)) {
    return name.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }
  return name;
}

/** The card title is the style name. The style number stays in the Style # fact. */
export function styleTitle(style: {
  styleNumber: string;
  name: string;
  fields?: {
    name?: {
      proposedValue?: unknown;
      confirmedValue?: unknown;
      displayValue?: unknown;
      confirmationStatus?: string;
      evidence?: unknown;
    };
  };
}): string {
  const nameField = style.fields?.name;
  const trusted =
    nameField && (nameField.confirmationStatus === 'CONFIRMED' || nameField.confirmationStatus === 'NEEDS_REVIEW')
      ? textValue(nameField.confirmedValue) ?? textValue(nameField.displayValue)
      : null;
  const raw =
    trusted ??
    textValue(nameField?.proposedValue) ??
    textValue(nameField?.displayValue) ??
    (style.name.trim() && style.name.trim() !== style.styleNumber.trim() ? style.name.trim() : null);
  const titled = raw ? presentStyleName(raw, style.styleNumber, nameField?.evidence) : null;
  return titled ?? `Style ${style.styleNumber}`;
}

/** Headline facts are checked values only. Unchecked proposals stay in the to-check list. */
type HeadlineField = {
  confirmationStatus: FieldDisplayStatus | string;
  confirmedValue: unknown;
  displayValue: unknown;
  proposedValue?: unknown;
};

/** Parse a pound amount. A dollar string is not treated as GBP. */
export function parseMoneyAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/£/g, '').replace(/,/g, '').replace(/\s/g, '');
    if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
  }
  return null;
}

export function moneyMinorUnits(value: unknown): number | null {
  const amount = parseMoneyAmount(value);
  return amount == null ? null : Math.round(amount * 100);
}

/** Format an integer pence count. Avoids binary fractions in the displayed pounds. */
export function formatGbpFromMinor(minor: number): string {
  if (!Number.isSafeInteger(minor)) return '—';
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const pounds = Math.trunc(abs / 100);
  const pence = abs % 100;
  const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(pounds);
  return `${negative ? '-' : ''}£${grouped}.${String(pence).padStart(2, '0')}`;
}

/** £25.00, £1,250.00. Missing or non-numeric amounts stay blank. */
export function formatGbp(value: unknown): string {
  const minor = moneyMinorUnits(value);
  if (minor == null) return '—';
  return formatGbpFromMinor(minor);
}

function currencyText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/**
 * True when a currency field states a code other than GBP.
 * NOT_STATED defaults and rejected proposals do not count.
 */
export function blocksGbp(currency: unknown): boolean {
  if (!currency || typeof currency !== 'object') return false;
  const field = currency as {
    confirmationStatus?: string;
    confirmedValue?: unknown;
    proposedValue?: unknown;
    displayValue?: unknown;
  };
  const status = field.confirmationStatus;
  if (!status || status === 'NOT_STATED' || status === 'REJECTED') return false;
  const proposed = currencyText(field.proposedValue ?? field.displayValue);
  const confirmed = currencyText(field.confirmedValue ?? field.displayValue);
  if ((status === 'PROPOSED' || status === 'PENDING' || status === 'UNCONFIRMED' || status === 'NEEDS_REVIEW') && proposed && proposed !== 'GBP') {
    return true;
  }
  if ((status === 'CONFIRMED' || status === 'NEEDS_REVIEW') && confirmed && confirmed !== 'GBP') {
    return true;
  }
  return false;
}

export function formatFactValue(field: string, value: unknown, currency?: unknown) {
  if (field === 'costFob' && !blocksGbp(currency)) return formatGbp(value);
  return formatFieldValue(value);
}

/** A pound amount, unless the paired currency field states another code. */
export function formatMoneyAmount(value: unknown, currency?: unknown) {
  if (blocksGbp(currency)) return formatFieldValue(value);
  return formatGbp(value);
}

export function headlineFact(
  field: HeadlineField | null | undefined,
  options: { money?: boolean; currency?: HeadlineField | null } = {},
) {
  if (!field || field.confirmationStatus === 'NOT_STATED' || field.confirmationStatus === 'REJECTED') {
    return '—';
  }
  if (isCheckedStatus(field.confirmationStatus)) {
    const value = field.confirmedValue ?? field.displayValue;
    if (value == null || value === '') return '—';
    if (options.money) return formatMoneyAmount(value, options.currency);
    return formatFieldValue(value);
  }
  return 'From email, check';
}

export function showStatusTag(status: FieldDisplayStatus | string) {
  return status !== 'CONFIRMED' && status !== 'NOT_STATED';
}

export function formatFieldValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'styleNumber' in value) {
    return String((value as { styleNumber?: unknown }).styleNumber ?? JSON.stringify(value));
  }
  return JSON.stringify(value);
}

const ACTIONABLE_STATUSES: FieldDisplayStatus[] = ['PROPOSED', 'UNCONFIRMED', 'NEEDS_REVIEW'];

/** Pending, unconfirmed, or needs-review rows are the only current outstanding actions. */
export function isActionableConfirmationStatus(status: FieldDisplayStatus | string) {
  return ACTIONABLE_STATUSES.includes(status as FieldDisplayStatus);
}

function sameFieldValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** A resolved confirmation may still hold a leftover parser proposedValue. That is history, not a live proposal. */
export function hasOutstandingProposal(field: {
  confirmationStatus: FieldDisplayStatus | string;
  proposedValue: unknown;
  confirmedValue: unknown;
}) {
  if (!isActionableConfirmationStatus(field.confirmationStatus)) {
    return false;
  }
  if (field.confirmationStatus === 'NEEDS_REVIEW') {
    return true;
  }
  return field.proposedValue != null && field.proposedValue !== '';
}

export function showResolvedProposalEvidence(field: {
  confirmationStatus: FieldDisplayStatus | string;
  proposedValue: unknown;
  confirmedValue: unknown;
}) {
  if (isActionableConfirmationStatus(field.confirmationStatus)) {
    return true;
  }
  if (field.confirmationStatus === 'REJECTED') {
    return true;
  }
  if (field.confirmationStatus === 'CONFIRMED') {
    return sameFieldValue(field.proposedValue, field.confirmedValue);
  }
  return false;
}

export function revisionLabel(revision: {
  kind: string;
  source: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  if (revision.kind === 'PROPOSAL') return `${revision.source} proposal`;
  if (revision.kind === 'CONFIRMATION') {
    return sameRevisionValue(revision.previousValue, revision.newValue) ? 'Looks right' : 'Edited';
  }
  if (revision.kind === 'KEEP_CONFIRMED') return 'Kept checked value';
  if (revision.kind === 'REJECTION') return 'Not right';
  return `${revision.source} ${revision.kind}`;
}

function sameRevisionValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const STRICT_NUMERIC = /^-?\d+(?:\.\d+)?$/;

export function correctionPayload(field: string, raw: string): unknown {
  const trimmed = raw.trim();
  if ((field === 'quantity' || field === 'costFob') && STRICT_NUMERIC.test(trimmed)) {
    const parsed = Number(trimmed);
    return field === 'quantity' ? Math.round(parsed) : parsed;
  }
  return trimmed;
}
