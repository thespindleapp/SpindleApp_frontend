import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { ConfirmationRow } from '../types';

function candidates(row: ConfirmationRow) {
  const values: unknown[] = [];
  if (row.proposedValue != null) values.push(row.proposedValue);
  if (Array.isArray(row.alternatives)) {
    for (const alternative of row.alternatives) {
      if (!values.some((existing) => label(existing) === label(alternative))) {
        values.push(alternative);
      }
    }
  }
  return values;
}

function label(value: unknown) {
  if (value && typeof value === 'object') {
    const record = value as { styleNumber?: unknown; styleName?: unknown; styleId?: unknown };
    return String(record.styleNumber ?? record.styleName ?? record.styleId ?? JSON.stringify(value));
  }
  return String(value ?? 'Unknown');
}

export const BRAND_REQUIRED_MESSAGE = 'Brand is required before this style can be saved.';

export function CandidatePicker({ row, onResolved }: { row: ConfirmationRow; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useStyle(value: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api.confirm(row.id, value);
      onResolved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to assign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="muted">{row.reason ?? row.field}</div>
      {row.email ? (
        <div>
          Email: <Link to={`/emails/${row.email.id}`}>{row.email.subject}</Link>
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      {candidates(row).map((value, index) => (
        <div className="candidate" key={`${row.id}-${index}`}>
          <span>{label(value)}</span>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() => {
              void useStyle(value);
            }}
          >
            Use this style
          </button>
        </div>
      ))}
    </div>
  );
}
