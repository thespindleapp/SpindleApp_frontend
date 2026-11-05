import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { candidateStyleNumber } from '../lib/board';
import type { Brand, ConfirmationRow } from '../types';

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

function suggestedBrandName(row: ConfirmationRow): string | null {
  const evidence = row.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return null;
  }
  const name = (evidence as { brandName?: unknown }).brandName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function needsBrandChoice(row: ConfirmationRow) {
  if (row.styleId || (row.field !== 'styleNumber' && row.field !== 'styleAssignment')) {
    return false;
  }
  const payload = row.proposedValue;
  if (payload && typeof payload === 'object' && typeof (payload as { styleId?: unknown }).styleId === 'string') {
    return false;
  }
  return Boolean(candidateStyleNumber(row));
}

export function CandidatePicker({ row, onResolved }: { row: ConfirmationRow; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const chooseBrand = needsBrandChoice(row);
  const suggested = suggestedBrandName(row);

  useEffect(() => {
    if (!chooseBrand) {
      return;
    }
    let cancelled = false;
    void api
      .listBrands()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setBrands(items);
        const match = suggested
          ? items.find((brand) => brand.name.localeCompare(suggested, undefined, { sensitivity: 'accent' }) === 0)
          : undefined;
        if (match) {
          setBrandId(match.id);
          setNewBrandName('');
        } else if (suggested) {
          setBrandId('');
          setNewBrandName(suggested);
        } else if (items.length === 1) {
          setBrandId(items[0]?.id ?? '');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load brands');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBrandsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chooseBrand, row.id, suggested]);

  const brandReady = !chooseBrand || Boolean(brandId) || newBrandName.trim().length > 0;

  async function useStyle(value: unknown) {
    setBusy(true);
    setError(null);
    try {
      let selectedBrandId = brandId;
      if (chooseBrand && !selectedBrandId && newBrandName.trim()) {
        const created = await api.createBrand({ name: newBrandName.trim() });
        selectedBrandId = created.id;
        setBrands((current) => (current.some((brand) => brand.id === created.id) ? current : [...current, created]));
        setBrandId(created.id);
      }
      if (chooseBrand && !selectedBrandId) {
        setError(BRAND_REQUIRED_MESSAGE);
        return;
      }
      await api.confirm(row.id, value, chooseBrand ? selectedBrandId : undefined);
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
      {chooseBrand && brandsLoaded && !brandReady ? <div className="error">{BRAND_REQUIRED_MESSAGE}</div> : null}
      {chooseBrand && brandsLoaded && brands.length > 0 ? (
        <div className="field">
          <label htmlFor={`brand-${row.id}`}>Brand</label>
          <select
            id={`brand-${row.id}`}
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
            disabled={busy}
          >
            <option value="">Select a brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {chooseBrand && brandsLoaded && (brands.length === 0 || newBrandName.trim().length > 0) ? (
        <div className="field">
          <label htmlFor={`brand-name-${row.id}`}>Brand</label>
          <input
            id={`brand-name-${row.id}`}
            value={newBrandName}
            onChange={(event) => setNewBrandName(event.target.value)}
            placeholder="Brand name"
            disabled={busy}
          />
        </div>
      ) : null}
      {candidates(row).map((value, index) => (
        <div className="candidate" key={`${row.id}-${index}`}>
          <span>{label(value)}</span>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || (chooseBrand && (!brandsLoaded || !brandReady))}
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
