import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ApiError,
  api,
  applyRemoteSignOut,
  clearAccessToken,
  getToken,
  getWorkspaceId,
  isSignedOut,
  markSignedOut,
  setToken,
  setUnauthorizedHandler,
  setWorkspaceId,
  subscribeAuth,
  subscribeRemoteSignOut,
} from './api';
import { safeReturnPath } from './lib/return-path';
import type { Workspace } from './types';

type Status = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

type AuthContextValue = {
  status: Status;
  retry: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isUnauthorized(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

function rememberWorkspace(workspaces: Workspace[]) {
  const current = getWorkspaceId();
  if (current && workspaces.some((workspace) => workspace.id === current)) return;
  const next = workspaces[0];
  if (next) setWorkspaceId(next.id);
}

async function establishFromCookie() {
  if (isSignedOut()) {
    throw new ApiError(401, 'Authentication required');
  }
  const refreshed = await api.refresh();
  if (isSignedOut()) {
    void api.logout();
    throw new ApiError(401, 'Authentication required');
  }
  if (!refreshed.accessToken) {
    throw new ApiError(401, 'Authentication required');
  }
  setToken(refreshed.accessToken, { silent: true });
  return refreshed;
}

async function loadSession() {
  if (isSignedOut()) {
    throw new ApiError(401, 'Authentication required');
  }
  if (!getToken()) {
    await establishFromCookie();
  }
  if (isSignedOut()) {
    throw new ApiError(401, 'Authentication required');
  }
  try {
    return await api.me();
  } catch (err) {
    if (!isUnauthorized(err)) throw err;
    clearAccessToken();
    await establishFromCookie();
    return api.me();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const statusRef = useRef<Status>('loading');
  const generation = useRef(0);
  const refreshInFlight = useRef(false);
  const navigate = useNavigate();
  statusRef.current = status;

  async function verify(id: number) {
    if (isSignedOut()) {
      clearAccessToken();
      if (id === generation.current) setStatus('anonymous');
      return;
    }
    try {
      const session = await loadSession();
      if (id !== generation.current) return;
      rememberWorkspace(session.workspaces);
      setStatus('authenticated');
    } catch (err) {
      clearAccessToken();
      if (id !== generation.current) return;
      setStatus(isUnauthorized(err) ? 'anonymous' : 'unavailable');
    }
  }

  function retry() {
    const id = ++generation.current;
    setStatus('loading');
    void verify(id);
  }

  async function signOut() {
    const id = ++generation.current;
    try {
      await api.logout();
    } catch {
      // The local session still ends when the server cannot be reached.
    }
    if (generation.current !== id) return;
    markSignedOut({ broadcast: true });
    setStatus('anonymous');
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    return subscribeAuth(() => {
      generation.current += 1;
      setStatus(isSignedOut() || !getToken() ? 'anonymous' : 'authenticated');
    });
  }, []);

  useEffect(() => {
    return subscribeRemoteSignOut(() => {
      if (statusRef.current === 'anonymous' && isSignedOut() && !getToken()) return;
      generation.current += 1;
      refreshInFlight.current = false;
      applyRemoteSignOut();
      setStatus('anonymous');
      navigate('/login', { replace: true });
      void api.logout();
    });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current !== 'authenticated' || refreshInFlight.current) return;
      refreshInFlight.current = true;
      const id = ++generation.current;
      void (async () => {
        try {
          clearAccessToken();
          await establishFromCookie();
          const session = await api.me();
          if (id !== generation.current) return;
          rememberWorkspace(session.workspaces);
          setStatus('authenticated');
        } catch {
          try {
            if (isSignedOut() || id !== generation.current) return;
            await establishFromCookie();
            const session = await api.me();
            if (id !== generation.current) return;
            rememberWorkspace(session.workspaces);
            setStatus('authenticated');
          } catch {
            if (id !== generation.current || isSignedOut()) return;
            markSignedOut();
            setStatus('anonymous');
          }
        } finally {
          refreshInFlight.current = false;
        }
      })();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    const id = ++generation.current;
    void verify(id);

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      const next = ++generation.current;
      setStatus('loading');
      void verify(next);
    }
    function onFocus() {
      if (statusRef.current !== 'authenticated' || refreshInFlight.current) return;
      void api.me().then(
        (session) => {
          if (statusRef.current === 'authenticated') rememberWorkspace(session.workspaces);
        },
        () => {
          // A 401 is handled by the request hook. Other failures keep the current page.
        },
      );
    }
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return <AuthContext.Provider value={{ status, retry, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('Authentication is unavailable');
  }
  return value;
}

export function SessionGate({ status, onRetry }: { status: 'loading' | 'unavailable'; onRetry?: () => void }) {
  return (
    <div className="session-gate">
      <div>
        <p role="status">{status === 'loading' ? 'Checking your session' : 'Spindle could not verify your session'}</p>
        {status === 'unavailable' && onRetry ? (
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { status, retry } = useAuth();
  const location = useLocation();
  if (status === 'loading' || status === 'unavailable') {
    return <SessionGate status={status} onRetry={status === 'unavailable' ? retry : undefined} />;
  }
  if (status !== 'authenticated') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}

export function LoginGate({ children }: { children: ReactNode }) {
  const { status, retry } = useAuth();
  const location = useLocation();
  if (status === 'loading' || status === 'unavailable') {
    return <SessionGate status={status} onRetry={status === 'unavailable' ? retry : undefined} />;
  }
  if (status === 'authenticated') {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeReturnPath(from)} replace />;
  }
  return children;
}
