import type { InboxEmail } from './lib/inbox';
import type {
  Brand,
  ConfirmAllResult,
  EmailAccount,
  EmailDetail,
  InvitationPreview,
  CreateStyleFromEmailInput,
  CreateStyleFromEmailResult,
  StyleCard,
  StyleDraft,
  StyleEmail,
  Workspace,
} from './types';

const LEGACY_TOKEN_KEY = 'spindle.accessToken';
const WORKSPACE_KEY = 'spindle.workspaceId';
const SIGNED_OUT_KEY = 'spindle.signedOut';
const LOGOUT_NOTICE_KEY = 'spindle.logoutNotice';
const AUTH_CHANNEL = 'spindle-auth';

let accessToken: string | null = null;
const authListeners = new Set<() => void>();
let unauthorizedHandler: (() => void) | null = null;

try {
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
} catch {
  // Access tokens are kept in memory. Leftover browser storage is discarded.
}

function emitAuth() {
  for (const listener of authListeners) listener();
}

export function subscribeAuth(listener: () => void) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getToken() {
  return accessToken;
}

export function setToken(token: string, options?: { silent?: boolean }) {
  accessToken = token;
  try {
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // The in-memory token is still updated.
  }
  if (!options?.silent) emitAuth();
}

export function clearAccessToken() {
  accessToken = null;
}

export function isSignedOut() {
  try {
    return sessionStorage.getItem(SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearSession() {
  accessToken = null;
  try {
    sessionStorage.removeItem(WORKSPACE_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // The in-memory token is already gone.
  }
  emitAuth();
}

function browserLocalStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
}

export function publishSignOut() {
  const notice = String(Date.now());
  try {
    browserLocalStorage()?.setItem(LOGOUT_NOTICE_KEY, notice);
  } catch {
    // Other tabs can still receive the channel message.
  }
  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage({ type: 'signed-out' });
    channel.close();
  } catch {
    // This tab has already dropped its own session.
  }
}

export function applyRemoteSignOut() {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, '1');
  } catch {
    // The in-memory token is still dropped below.
  }
  clearSession();
}

export function subscribeRemoteSignOut(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== LOGOUT_NOTICE_KEY || event.newValue == null) return;
    listener();
  }
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ type?: unknown }>) => {
      if (event.data?.type === 'signed-out') listener();
    };
  } catch {
    channel = null;
  }
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}

export function markSignedOut(options?: { broadcast?: boolean }) {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, '1');
  } catch {
    // This tab still drops the in-memory token below.
  }
  if (options?.broadcast) publishSignOut();
  clearSession();
}

export function getWorkspaceId() {
  return sessionStorage.getItem(WORKSPACE_KEY);
}

export function setWorkspaceId(id: string) {
  sessionStorage.setItem(WORKSPACE_KEY, id);
}

class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const PUBLIC_AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/signup',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/invitations',
];

function isPublicAuthPath(path: string) {
  return PUBLIC_AUTH_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function noteUnauthorized(path: string, status: number) {
  if (status === 401 && !isPublicAuthPath(path)) {
    unauthorizedHandler?.();
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const workspaceId = getWorkspaceId();
  if (workspaceId) {
    headers.set('X-Workspace-Id', workspaceId);
  }

  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  noteUnauthorized(path, response.status);
  if (response.status === 204) {
    return undefined as T;
  }
  const body = (await response.json().catch(() => null)) as
    | { success: true; data: T; meta?: unknown }
    | { success: false; error?: { message?: string; code?: string; details?: unknown } }
    | null;
  if (!response.ok || !body || body.success === false) {
    const error = body && 'error' in body ? body.error : undefined;
    throw new ApiError(response.status, error?.message ?? 'Request failed', error?.code, error?.details);
  }
  return body.data;
}

export const api = {
  login(email: string, password: string) {
    return request<{ accessToken: string; workspaces: Workspace[] }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  signup(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    workspaceName: string;
  }) {
    return request<{ accessToken: string; workspace: Workspace }>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  getInvitation(token: string) {
    return request<InvitationPreview>(`/api/v1/auth/invitations/${encodeURIComponent(token)}`);
  },
  acceptInvitation(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    return request<{ accessToken: string; workspaces: Workspace[] }>('/api/v1/auth/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  refresh() {
    return request<{ accessToken: string; workspaces: Workspace[] }>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
  logout() {
    return request<{ loggedOut: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
  me() {
    return request<{ user: { email: string; firstName: string; lastName: string }; workspaces: Workspace[] }>(
      '/api/v1/auth/me',
    );
  },
  listStyles(query: { stage?: string; status?: string; search?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(query.limit ?? 100));
    if (query.stage) params.set('stage', query.stage);
    if (query.status) params.set('status', query.status);
    if (query.search) params.set('search', query.search);
    return request<StyleCard[]>(`/api/v1/styles?${params.toString()}`);
  },
  getStyle(id: string) {
    return request<StyleCard>(`/api/v1/styles/${id}`);
  },
  listStyleOnBoard(id: string) {
    return request<StyleCard>(`/api/v1/styles/${id}/list`, { method: 'POST' });
  },
  async listInboxEmails() {
    const all: InboxEmail[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const items = await request<InboxEmail[]>(`/api/v1/emails?limit=100&page=${page}`);
      all.push(...items);
      if (items.length < 100) {
        break;
      }
    }
    return all;
  },
  listEmails(query: { styleId?: string; threadId?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(query.limit ?? 50));
    if (query.styleId) params.set('styleId', query.styleId);
    if (query.threadId) params.set('threadId', query.threadId);
    return request<StyleEmail[]>(`/api/v1/emails?${params.toString()}`);
  },
  listConfirmations(query: { styleId?: string; status?: string; limit?: number; page?: number } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(query.limit ?? 100));
    if (query.page) params.set('page', String(query.page));
    if (query.styleId) params.set('styleId', query.styleId);
    if (query.status) params.set('status', query.status);
    return request<import('./types').ConfirmationRow[]>(`/api/v1/confirmations?${params.toString()}`);
  },
  confirm(id: string, value?: unknown, brandId?: string) {
    return request(`/api/v1/confirmations/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        ...(value !== undefined ? { value } : {}),
        ...(brandId ? { brandId } : {}),
      }),
    });
  },
  listBrands() {
    return request<Brand[]>('/api/v1/brands?limit=100');
  },
  createBrand(input: { name: string }) {
    return request<Brand>('/api/v1/brands', {
      method: 'POST',
      body: JSON.stringify({ name: input.name }),
    });
  },
  reject(id: string) {
    return request(`/api/v1/confirmations/${id}/reject`, { method: 'POST', body: '{}' });
  },
  keep(id: string) {
    return request(`/api/v1/confirmations/${id}/keep`, { method: 'POST' });
  },
  confirmAll(input: { styleId?: string; emailId?: string }) {
    return request<ConfirmAllResult>('/api/v1/confirmations/confirm-all', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  getEmail(id: string) {
    return request<EmailDetail>(`/api/v1/emails/${id}`);
  },
  async getAttachmentBlob(emailId: string, attachmentId: string) {
    const headers = new Headers();
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const workspaceId = getWorkspaceId();
    if (workspaceId) {
      headers.set('X-Workspace-Id', workspaceId);
    }
    const response = await fetch(`/api/v1/emails/${emailId}/attachments/${attachmentId}/content`, {
      headers,
      credentials: 'include',
    });
    noteUnauthorized(`/api/v1/emails/${emailId}/attachments/${attachmentId}/content`, response.status);
    if (!response.ok) {
      throw new ApiError(response.status, 'Unable to open attachment');
    }
    const buffer = await response.arrayBuffer();
    const type = response.headers.get('content-type') || 'application/octet-stream';
    return new Blob([buffer], { type });
  },
  getStyleDraft(emailId: string) {
    return request<StyleDraft>(`/api/v1/emails/${emailId}/style-draft`);
  },
  createStyleFromEmail(emailId: string, input: CreateStyleFromEmailInput) {
    return request<CreateStyleFromEmailResult>(`/api/v1/emails/${emailId}/styles`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  listEmailAccounts() {
    return request<EmailAccount[]>('/api/v1/email-accounts');
  },
  createEmailAccount(input: { emailAddress: string; displayName?: string }) {
    return request<EmailAccount>('/api/v1/email-accounts', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'FORWARD',
        emailAddress: input.emailAddress,
        ...(input.displayName ? { displayName: input.displayName } : {}),
      }),
    });
  },
};

export { ApiError };
