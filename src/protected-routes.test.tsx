import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, clearSession, getToken, isSignedOut, publishSignOut, setToken } from './api';
import { App } from './App';

const TOKEN = 'spindle-test-access-token';
const workspace = { id: 'ws-1', name: 'Hollis & Row', slug: 'hollis', role: 'OWNER' };
const user = { email: 'srishti@example.com', firstName: 'Srishti', lastName: 'Dhawan' };

const PRIVATE_ROUTES = [
  '/',
  '/inbox',
  '/styles/style-1',
  '/emails/email-1',
  '/emails/email-1/new',
  '/settings/email-connections',
  '/suppliers',
  '/history',
  '/settings',
];

const PRIVATE_MARKERS = [
  'Your range starts with one supplier email.',
  'Email connections',
  'Loading style card…',
  'Loading email…',
  'Loading extracted fields…',
];

type Mode = 'ok' | 'reject-session' | 'hold-me' | 'offline';

const server = {
  access: '',
  signedOut: false,
  mode: 'ok' as Mode,
  meGate: Promise.resolve() as Promise<void>,
  calls: [] as Array<{ url: string; authorization: string | null; credentials?: RequestCredentials }>,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ok(data: unknown) {
  return json(200, { success: true, data });
}

function fail(status: number, message: string) {
  return json(status, { success: false, error: { code: status === 401 ? 'UNAUTHORIZED' : 'ERROR', message } });
}

function resetServer() {
  server.access = '';
  server.signedOut = false;
  server.mode = 'ok';
  server.meGate = Promise.resolve();
  server.calls = [];
}

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const headers = new Headers(init?.headers);
      const authorization = headers.get('Authorization');
      server.calls.push({ url, authorization, credentials: init?.credentials });
      if (url.includes(TOKEN)) {
        throw new Error('access token leaked into a request URL');
      }
      if (server.mode === 'offline') {
        throw new TypeError('offline');
      }
      if (
        server.mode === 'reject-session' &&
        !url.includes('/api/v1/auth/login') &&
        !url.includes('/api/v1/auth/logout')
      ) {
        return fail(401, 'Invalid or expired access token');
      }
      if (url.includes('/api/v1/auth/login')) {
        server.signedOut = false;
        server.access = TOKEN;
        return ok({ accessToken: TOKEN, workspaces: [workspace] });
      }
      if (url.includes('/api/v1/auth/refresh')) {
        if (server.signedOut || server.mode === 'reject-session' || !server.access) {
          return fail(401, 'Refresh token missing');
        }
        return ok({ accessToken: server.access, workspaces: [workspace] });
      }
      if (url.includes('/api/v1/auth/logout')) {
        server.signedOut = true;
        server.access = '';
        return ok({ loggedOut: true });
      }
      if (url.includes('/api/v1/auth/me')) {
        if (server.mode === 'hold-me') await server.meGate;
        if (server.signedOut || server.mode === 'reject-session' || authorization !== `Bearer ${server.access}`) {
          return fail(401, 'Invalid or expired access token');
        }
        return ok({ user, workspaces: [workspace] });
      }
      if (url.includes('/api/v1/styles/style-1')) return fail(404, 'Missing style marker');
      if (authorization !== `Bearer ${server.access}`) return fail(401, 'Authentication required');
      return ok([]);
    }),
  );
}

function watchLeaks() {
  const leaks = new Set<string>();
  const scan = () => {
    if (document.querySelector('[aria-label="Sidebar"]')) leaks.add('sidebar');
    const text = document.body.textContent ?? '';
    for (const marker of PRIVATE_MARKERS) {
      if (text.includes(marker)) leaks.add(marker);
    }
  };
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return {
    stop() {
      scan();
      observer.disconnect();
      return [...leaks];
    },
  };
}

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="loc">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

function HistoryBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      History back
    </button>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationEcho />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  clearSession();
  resetServer();
  installFetch();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  clearSession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('protected routes', () => {
  it.each(PRIVATE_ROUTES)('sends an anonymous visitor from %s to login without private content', async (path) => {
    const leaks = watchLeaks();
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationEcho />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByTestId('loc').textContent).toBe('/login');
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
    expect(leaks.stop()).toEqual([]);
    expect(server.calls.some((call) => call.url.includes(TOKEN))).toBe(false);
  });

  it('keeps the invitation page public', async () => {
    renderAt('/accept-invitation');

    expect(await screen.findByRole('heading', { name: 'Join workspace' })).toBeTruthy();
    expect(screen.getByTestId('loc').textContent).toBe('/accept-invitation');
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
  });

  it('shows a loading state and hides private pages while a session is checked', async () => {
    let release: () => void = () => undefined;
    server.mode = 'hold-me';
    server.access = TOKEN;
    server.meGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setToken(TOKEN);
    const leaks = watchLeaks();
    renderAt('/');

    expect((await screen.findByRole('status')).textContent).toContain('Checking your session');
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
    expect(leaks.stop()).toEqual([]);

    release();
    expect(await screen.findByRole('heading', { name: /Your range starts with one supplier email/ })).toBeTruthy();
    expect(getToken()).toBe(TOKEN);
  });

  it('restores a valid session from the refresh cookie in a new tab', async () => {
    server.access = TOKEN;
    renderAt('/');

    expect(await screen.findByText('Srishti Dhawan')).toBeTruthy();
    expect(getToken()).toBe(TOKEN);
    const refresh = server.calls.find((call) => call.url.includes('/auth/refresh'));
    expect(refresh?.credentials).toBe('include');
    expect(refresh?.authorization).toBeNull();
    expect(server.calls.some((call) => call.url.includes(TOKEN))).toBe(false);
  });

  it('sends an expired session to login', async () => {
    setToken('stale-token');
    server.mode = 'reject-session';
    const leaks = watchLeaks();
    renderAt('/inbox');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(getToken()).toBeNull();
    expect(leaks.stop()).toEqual([]);
  });

  it('returns to the requested private page after login and ignores external targets', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/styles/style-1']}>
        <App />
        <LocationEcho />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Work email'), 'srishti@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Missing style marker')).toBeTruthy();
    expect(screen.getByTestId('loc').textContent).toBe('/styles/style-1');
    expect(server.calls.some((call) => call.url.includes('/api/v1/styles/style-1') && call.authorization === `Bearer ${TOKEN}`)).toBe(true);

    view.unmount();
    sessionStorage.clear();
    clearSession();
    resetServer();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: 'https://evil.example/inbox' } }]}>
        <App />
        <LocationEcho />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Work email'), 'srishti@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: /Your range starts with one supplier email/ })).toBeTruthy();
    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it('logs out, blocks the refresh cookie, and ignores browser back', async () => {
    const userEvents = userEvent.setup();
    server.access = TOKEN;
    render(
      <MemoryRouter initialEntries={['/inbox', '/']} initialIndex={1}>
        <App />
        <HistoryBack />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Srishti Dhawan')).toBeTruthy();
    await userEvents.click(screen.getByRole('button', { name: /Srishti Dhawan/ }));
    await userEvents.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(getToken()).toBeNull();
    expect(server.calls.some((call) => call.url.includes('/auth/logout') && call.credentials === 'include')).toBe(true);

    const leaks = watchLeaks();
    await userEvents.click(screen.getByRole('button', { name: 'History back' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
    expect(leaks.stop()).toEqual([]);

    server.access = TOKEN;
    server.signedOut = false;
    cleanup();
    const refreshCalls = server.calls.length;
    render(
      <MemoryRouter initialEntries={['/inbox']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(server.calls.slice(refreshCalls).some((call) => call.url.includes('/auth/refresh'))).toBe(false);
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
  });

  it('signs out another tab without restoring the revoked session', async () => {
    const heard: unknown[] = [];
    const channel = new BroadcastChannel('spindle-auth');
    channel.onmessage = (event) => heard.push(event.data);
    server.access = TOKEN;
    const view = render(
      <MemoryRouter initialEntries={['/inbox']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Srishti Dhawan')).toBeTruthy();
    const before = server.calls.filter((call) => call.url.includes('/auth/refresh')).length;

    window.dispatchEvent(new StorageEvent('storage', { key: 'spindle.logoutNotice', newValue: '1710000000000' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(document.body.textContent ?? '').not.toContain('Srishti Dhawan');
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
    expect(getToken()).toBeNull();
    expect(isSignedOut()).toBe(true);
    expect(server.calls.filter((call) => call.url.includes('/auth/refresh')).length).toBe(before);
    publishSignOut();
    expect(JSON.stringify(heard)).not.toContain(TOKEN);
    for (const message of heard) {
      expect(message).toEqual({ type: 'signed-out' });
    }
    try {
      const notice = localStorage.getItem('spindle.logoutNotice');
      expect(notice ?? '').not.toContain(TOKEN);
    } catch {
      // This jsdom build does not provide a working localStorage.
    }

    server.access = TOKEN;
    view.unmount();
    const refreshCalls = server.calls.length;
    render(
      <MemoryRouter initialEntries={['/inbox']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(server.calls.slice(refreshCalls).some((call) => call.url.includes('/auth/refresh'))).toBe(false);
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
    channel.close();
  });

  it('signs out when a private request returns 401', async () => {
    server.access = TOKEN;
    renderAt('/');
    expect(await screen.findByText('Srishti Dhawan')).toBeTruthy();
    server.mode = 'reject-session';
    await expect(api.listStyles()).rejects.toMatchObject({ status: 401 });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(getToken()).toBeNull();
    server.calls.length = 0;
    await expect(api.listStyles()).rejects.toMatchObject({ status: 401 });
    expect(server.calls[0]?.authorization ?? null).toBeNull();
  });

  it('fails closed when the session cannot be verified, then recovers to login', async () => {
    server.mode = 'offline';
    const leaks = watchLeaks();
    renderAt('/inbox');
    expect((await screen.findByRole('status')).textContent).toContain('Spindle could not verify your session');
    expect(leaks.stop()).toEqual([]);
    server.mode = 'reject-session';
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
  });

  it('does not write the access token to browser storage or logs', async () => {
    server.access = TOKEN;
    renderAt('/');
    expect(await screen.findByText('Srishti Dhawan')).toBeTruthy();
    expect(sessionStorage.getItem('spindle.accessToken')).toBeNull();
    expect(Object.keys(sessionStorage).some((key) => sessionStorage.getItem(key)?.includes(TOKEN))).toBe(false);
    const logged = [console.log, console.info, console.debug].flatMap((method) =>
      (method as unknown as { mock?: { calls: unknown[][] } }).mock?.calls ?? [],
    );
    expect(JSON.stringify(logged)).not.toContain(TOKEN);
    expect(sessionStorage.getItem('spindle.workspaceId')).toBe('ws-1');
  });
});
