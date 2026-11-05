import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, setToken, setWorkspaceId } from '../api';
import { safeReturnPath } from '../lib/return-path';

type Mode = 'signin' | 'signup';

const ROLES = ['Founder', 'Head of product', 'Merchandiser', 'Buyer', 'Sourcing'] as const;

const GARMENTS: Record<string, string[]> = {
  dress: [
    'M38 10 L46 14 Q50 19 54 14 L62 10 L72 22 L64 30 L66 48 L82 108 L18 108 L34 48 L36 30 L28 22 Z',
    'M34 48 L66 48',
  ],
  shirt: [
    'M34 8 L46 8 Q50 14 54 8 L66 8 L84 28 L76 38 L68 30 L68 112 L32 112 L32 30 L24 38 L16 28 Z',
    'M50 14 L50 112',
  ],
  trouser: ['M30 8 L70 8 L74 112 L56 112 L50 40 L44 112 L26 112 Z', 'M30 18 L70 18'],
  skirt: ['M34 10 L66 10 L66 18 L80 112 L20 112 L34 18 Z', 'M34 18 L66 18'],
  jacket: [
    'M34 8 L46 8 L50 20 L54 8 L66 8 L86 30 L78 40 L70 32 L70 112 L30 112 L30 32 L22 40 L14 30 Z',
    'M50 20 L50 112',
  ],
  knit: [
    'M30 14 Q50 22 70 14 L86 30 L80 42 L72 36 L72 108 L28 108 L28 36 L20 42 L14 30 Z',
    'M28 100 L72 100',
  ],
};

type SampleStyle = {
  name: string;
  code: string;
  kind: keyof typeof GARMENTS;
  fill: string;
  stage: string;
  date: string;
  step: number;
};

const SAMPLE_STYLES: SampleStyle[] = [
  { name: 'Sun Embroidered Dress', code: 'HS-5512', kind: 'dress', fill: '#ECE7DC', stage: 'TOP', date: '14 Feb', step: 6 },
  { name: 'Linen Camp Shirt', code: 'HS-5530', kind: 'shirt', fill: '#DCDFD2', stage: 'PP sample', date: '2 Jan', step: 5 },
  { name: 'Wide Pleat Trouser', code: 'MV-2107', kind: 'trouser', fill: '#C9C6C9', stage: 'Fit sample', date: '5 Feb', step: 4 },
  { name: 'Boxy Twill Jacket', code: 'MV-2112', kind: 'jacket', fill: '#D9D1C2', stage: 'Strike-off', date: '4 Mar', step: 3 },
  { name: 'Bias Slip Skirt', code: 'HS-5541', kind: 'skirt', fill: '#ECE7DC', stage: 'Bulk', date: '2 Jan', step: 7 },
  { name: 'Fine Rib Cardigan', code: 'AT-0904', kind: 'knit', fill: '#E6DFD1', stage: 'Lab dip', date: '4 Mar', step: 2 },
  { name: 'Poplin Tunic Dress', code: 'AT-0911', kind: 'dress', fill: '#D7DDE0', stage: 'Shipped', date: '4 Jan', step: 8 },
  { name: 'Crop Utility Shirt', code: 'MV-2128', kind: 'shirt', fill: '#D3D3C2', stage: 'Costing', date: '20 Mar', step: 1 },
  { name: 'Tailored Short', code: 'HS-5560', kind: 'trouser', fill: '#DDD6CB', stage: 'Tech pack', date: '2 Apr', step: 0 },
];

const WALL_COLUMNS: Array<{ items: SampleStyle[]; direction: 'up' | 'down'; duration: string }> = [
  { items: [SAMPLE_STYLES[0], SAMPLE_STYLES[3], SAMPLE_STYLES[6], SAMPLE_STYLES[1]], direction: 'up', duration: '42s' },
  { items: [SAMPLE_STYLES[4], SAMPLE_STYLES[7], SAMPLE_STYLES[2], SAMPLE_STYLES[5]], direction: 'down', duration: '50s' },
  { items: [SAMPLE_STYLES[8], SAMPLE_STYLES[1], SAMPLE_STYLES[5], SAMPLE_STYLES[3]], direction: 'up', duration: '46s' },
];

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

function StyleSketch({ kind }: { kind: keyof typeof GARMENTS }) {
  return (
    <svg viewBox="0 0 100 120" aria-hidden="true">
      {GARMENTS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function StyleSample({ style }: { style: SampleStyle }) {
  return (
    <article className="auth-sample">
      <div className="auth-sample-art" style={{ background: style.fill }}>
        <StyleSketch kind={style.kind} />
      </div>
      <div className="auth-sample-title">
        <span>{style.name}</span>
        <span>{style.code}</span>
      </div>
      <div className="auth-sample-steps" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} className={index === style.step ? 'is-current' : index < style.step ? 'is-done' : ''} />
        ))}
      </div>
      <div className="auth-sample-meta">
        <span>{style.stage}</span>
        <span>ex-fac {style.date}</span>
      </div>
    </article>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = safeReturnPath((location.state as { from?: unknown } | null)?.from);
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('Head of product');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const name = splitName(fullName);
        if (!name) {
          throw new Error('Enter your first and last name.');
        }
        const result = await api.signup({
          email,
          password,
          firstName: name.firstName,
          lastName: name.lastName,
          workspaceName,
        });
        setToken(result.accessToken);
        setWorkspaceId(result.workspace.id);
      } else {
        const result = await api.login(email, password);
        setToken(result.accessToken);
        const workspace = result.workspaces[0];
        if (!workspace) {
          throw new Error('No workspace on this account');
        }
        setWorkspaceId(workspace.id);
      }
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'signup' ? 'Unable to sign up' : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  const signingUp = mode === 'signup';

  return (
    <div className="auth">
      <aside className="auth-stage" aria-hidden="true">
        <div className="auth-wall">
          {WALL_COLUMNS.map((column) => (
            <div className="auth-col" key={column.direction + column.duration}>
              <div
                className={`auth-col-track ${column.direction === 'down' ? 'is-down' : ''}`}
                style={{ animationDuration: column.duration }}
              >
                {[...column.items, ...column.items].map((style, index) => (
                  <StyleSample key={`${style.code}-${index}`} style={style} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="auth-shade" />
        <div className="auth-brand">
          <img src="/spindle-mark.svg" alt="" />
          <span>spindle</span>
        </div>
        <div className="auth-pitch">
          <h2>Every style, every email, in one place.</h2>
          <p>
            Forward your supplier emails. Spindle files them by style and builds your production board from the values
            you check.
          </p>
        </div>
      </aside>

      <main className="auth-panel">
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-intro">
            <span className="auth-kicker">{signingUp ? 'Founding access' : 'Welcome back'}</span>
            <h1>{signingUp ? 'Start your first range' : 'Sign in'}</h1>
          </div>

          {error ? (
            <div className="error" role="alert">
              {error}
            </div>
          ) : null}

          {signingUp ? (
            <label className="auth-field">
              <span>Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Srishti Dhawan"
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Work email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@yourbrand.com"
              autoComplete="email"
              required
            />
          </label>

          {signingUp ? (
            <label className="auth-field">
              <span>Brand name</span>
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Your brand"
                autoComplete="organization"
                required
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={signingUp ? 'At least 10 characters' : 'Your password'}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              minLength={signingUp ? 10 : undefined}
              required
            />
          </label>

          {signingUp ? (
            <fieldset className="auth-roles">
              <legend>Your role</legend>
              <div>
                {ROLES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={role === item ? 'is-selected' : ''}
                    aria-pressed={role === item}
                    onClick={() => setRole(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? (signingUp ? 'Creating account…' : 'Signing in…') : 'Continue'}
          </button>
          <p className="auth-note">
            {signingUp
              ? 'Free while you set up your first range. No card needed.'
              : 'Use the email and password for your workspace.'}
          </p>
          <p className="auth-switch">
            {signingUp ? (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                Need an account?{' '}
                <button type="button" onClick={() => switchMode('signup')}>
                  Sign up
                </button>
              </>
            )}
          </p>
        </form>
      </main>
    </div>
  );
}
