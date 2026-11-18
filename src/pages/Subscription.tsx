import { useEffect, useState } from 'react';
import { api, getWorkspaceId } from '../api';
import { roleLabel } from '../lib/shell';

export function SubscriptionPage() {
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getWorkspaceId()) {
        setError('Select a workspace before opening settings.');
        setLoading(false);
        return;
      }
      try {
        const workspace = await api.getWorkspace();
        if (!cancelled) setPlan(roleLabel(workspace.plan));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load the subscription');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page settings-page">
      <header>
        <span className="forwarding-kicker">Settings · Subscription</span>
        <h1>Subscription</h1>
      </header>

      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="plan-card" aria-labelledby="plan-heading">
        <span className="forwarding-kicker" id="plan-heading">
          Current plan
        </span>
        <p className="plan-name">{loading ? 'Loading…' : (plan ?? 'Unknown')}</p>
        <p className="settings-note">Billing and invoices are not connected for this workspace.</p>
      </section>
    </div>
  );
}
