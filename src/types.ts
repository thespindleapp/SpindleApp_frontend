export type FieldDisplayStatus =
  | 'CONFIRMED'
  | 'PROPOSED'
  | 'UNCONFIRMED'
  | 'REJECTED'
  | 'NOT_STATED'
  | 'NEEDS_REVIEW';

export interface StyleFieldView {
  field: string;
  confirmationId: string | null;
  emailId: string | null;
  sourceSubject: string | null;
  proposedValue: unknown;
  confirmedValue: unknown;
  displayValue: unknown;
  confirmationStatus: FieldDisplayStatus;
  evidence: unknown;
  confirmedBy: string | null;
  confirmedAt: string | null;
  source: string | null;
  proposedDiffersFromConfirmed: boolean;
}

export interface FieldRevision {
  id: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  source: string;
  kind: string;
  actorId: string | null;
  confirmationId: string | null;
  sourceEmailId: string | null;
  createdAt: string;
}

export interface ConfirmationRow {
  id: string;
  field: string;
  styleId: string | null;
  emailId: string | null;
  status: string;
  proposedValue: unknown;
  confirmedValue: unknown;
  alternatives: unknown;
  evidence: unknown;
  source: string | null;
  reason?: string | null;
  isCurrent: boolean;
  confirmedById: string | null;
  resolvedAt: string | null;
  email?: { id: string; subject: string; fromAddress?: string; receivedAt?: string } | null;
  style?: { id: string; styleNumber: string; name: string } | null;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface StyleEmail {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  bodyText: string | null;
  receivedAt: string;
  attachments?: EmailAttachment[];
}

export interface StyleCard {
  id: string;
  styleNumber: string;
  name: string;
  listedAt?: string | null;
  quantity: number | null;
  costFob: number | null;
  stage: string | null;
  status: string | null;
  brand?: { id: string; name: string; slug: string } | null;
  fields: Record<string, StyleFieldView>;
  needsConfirmationCount: number;
  fieldRevisions?: FieldRevision[];
  confirmations?: ConfirmationRow[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface InvitationPreview {
  valid: true;
  email: string;
  workspace: { id: string; name: string; slug: string };
  role: string;
  expiresAt: string;
}

export interface EmailDetail {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  bodyText: string | null;
  receivedAt: string;
  status: string;
  styleId: string | null;
  attachments?: EmailAttachment[];
}

export type StyleDraftDisposition = 'create' | 'match' | 'conflict' | 'needs_identity';

export type StyleMatchKind = 'exact' | 'case-insensitive' | 'unique-name';

export interface StyleDraftMatch {
  styleId: string;
  styleNumber: string;
  name: string;
  kind: StyleMatchKind;
}

export interface StyleDraftField {
  value: unknown;
  confidence: number | null;
  evidence: unknown;
  source: string | null;
  validationStatus?: string;
}

export interface StyleDraft {
  emailId: string;
  email: {
    id: string;
    subject: string;
    fromAddress: string;
    fromName: string | null;
    receivedAt: string;
    status: string;
    styleId: string | null;
    brandId: string | null;
  };
  disposition: StyleDraftDisposition;
  canCreate: boolean;
  blockReasons: string[];
  identityConfirmationId: string | null;
  brand: { id: string; name: string; slug: string } | null;
  matches: StyleDraftMatch[];
  extraction: {
    styleNumber: string | null;
    styleName: string | null;
    confidenceTier: string | null;
    candidates: string[];
    fields: Record<string, StyleDraftField>;
  };
}

export interface CreateStyleFromEmailInput {
  brandId?: string;
  styleNumber: string;
  name?: string;
  fields?: Record<string, unknown>;
}

export interface CreateStyleFromEmailResult {
  style: StyleCard;
  emailId: string;
  styleId: string;
}

export type EmailProvider = 'GMAIL' | 'OUTLOOK' | 'FORWARD';

export type EmailAccountStatus = 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface EmailAccount {
  id: string;
  workspaceId: string;
  userId: string | null;
  provider: EmailProvider;
  emailAddress: string;
  displayName: string | null;
  status: EmailAccountStatus;
  watchScope: unknown;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmAllResult {
  count: number;
  confirmedCount: number;
  skippedCount: number;
  confirmed: Array<{ id: string; field: string; status: string }>;
  skipped: Array<{ id: string; field: string; status: string; reason: string }>;
}
