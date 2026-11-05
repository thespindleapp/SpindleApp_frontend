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

export function formatMoneyAmount(
  value: unknown,
  currency:
    | {
        confirmationStatus?: FieldDisplayStatus | string;
        confirmedValue?: unknown;
        displayValue?: unknown;
      }
    | null
    | undefined,
) {
  const amount = formatFieldValue(value);
  if (amount === '—') {
    return amount;
  }
  if (!currency || !isCheckedStatus(currency.confirmationStatus)) {
    return amount;
  }
  const code = String(currency.confirmedValue ?? currency.displayValue ?? '')
    .trim()
    .toUpperCase();
  if (!code) {
    return amount;
  }
  if (code === 'GBP') return `£${amount}`;
  if (code === 'USD') return `$${amount}`;
  if (code === 'EUR') return `€${amount}`;
  if (code === 'INR') return `₹${amount}`;
  return `${amount} ${code}`;
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
