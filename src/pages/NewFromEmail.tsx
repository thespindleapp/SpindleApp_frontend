import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { BRAND_REQUIRED_MESSAGE } from '../components/CandidatePicker';
import { STAGE_COLUMNS } from '../lib/board';
import {
  confidenceLabel,
  draftAllowsCreate,
  evidenceText,
  initialProposalValues,
  matchKindLabel,
  proposalPayload,
  proposalRows,
} from '../lib/style-draft';
import type { Brand, StyleDraft, StyleDraftMatch } from '../types';

const STATUS_OPTIONS = ['BLOCKED', 'WAITING', 'ON_TRACK', 'SHIPPED', 'CANCELLED'] as const;

function isStyleMatchDetails(value: unknown): value is { match?: StyleDraftMatch } {
  return Boolean(value && typeof value === 'object');
}

export function NewFromEmailPage() {
  const { emailId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<StyleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<StyleDraftMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [styleNumber, setStyleNumber] = useState('');
  const [name, setName] = useState('');
  const [proposalValues, setProposalValues] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [newBrandName, setNewBrandName] = useState('');

  useEffect(() => {
    if (!emailId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([api.getStyleDraft(emailId), api.listBrands().catch(() => [] as Brand[])])
      .then(([next, brandList]) => {
        if (cancelled) {
          return;
        }
        setDraft(next);
        setStyleNumber(next.extraction.styleNumber ?? '');
        setName(next.extraction.styleName ?? '');
        setProposalValues(initialProposalValues(next.extraction.fields));
        setBrands(brandList);
        if (next.brand) {
          setBrandId(next.brand.id);
        } else if (brandList.length === 1) {
          setBrandId(brandList[0]?.id ?? '');
        }
        if (next.matches[0] && (next.disposition === 'match' || next.disposition === 'conflict')) {
          setConflict(next.matches[0]);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load extracted fields');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [emailId]);

  const rows = useMemo(() => (draft ? proposalRows(draft.extraction.fields) : []), [draft]);
  const candidates = draft
    ? [draft.extraction.styleNumber, ...draft.extraction.candidates].filter((value): value is string => Boolean(value))
    : [];
  const uniqueCandidates = [...new Set(candidates)];
  const brandReady = Boolean(brandId) || newBrandName.trim().length > 0;
  const canCreate = draft ? draftAllowsCreate(draft) && !conflict : false;

  async function submit() {
    if (!emailId || !draft) {
      return;
    }
    const number = styleNumber.trim();
    if (!number) {
      setError('A style number is required before this style can be saved.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let selectedBrandId = brandId;
      if (!selectedBrandId && newBrandName.trim()) {
        const created = await api.createBrand({ name: newBrandName.trim() });
        selectedBrandId = created.id;
        setBrands((current) => (current.some((brand) => brand.id === created.id) ? current : [...current, created]));
        setBrandId(created.id);
      }
      if (!selectedBrandId) {
        setError(BRAND_REQUIRED_MESSAGE);
        return;
      }
      const fields = proposalPayload(proposalValues);
      const result = await api.createStyleFromEmail(emailId, {
        brandId: selectedBrandId,
        styleNumber: number,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(Object.keys(fields).length > 0 ? { fields } : {}),
      });
      navigate(`/styles/${result.styleId}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.code === 'STYLE_EXISTS' || err.code === 'EMAIL_ALREADY_FILED')) {
        const match = isStyleMatchDetails(err.details) ? err.details.match : undefined;
        setConflict(match ?? draft.matches[0] ?? null);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unable to create this style');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!emailId) {
    return (
      <div className="page">
        <p className="muted">Email is missing.</p>
      </div>
    );
  }

  if (loading || !draft) {
    return (
      <div className="page">
        {error ? <div className="error">{error}</div> : <p className="muted">Loading extracted fields…</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">New from email</div>
          <h1>{draft.email.subject || 'No subject'}</h1>
        </div>
        <Link className="btn btn-secondary" to={`/emails/${emailId}`}>
          Back to email
        </Link>
      </div>
      <p className="lede">
        Review the extracted style identity. Quantity, cost, and other facts stay as proposals until you check them on
        the style card.
      </p>
      <p className="muted">
        {draft.email.fromName || draft.email.fromAddress} · {new Date(draft.email.receivedAt).toLocaleString()}
      </p>
      {error ? <div className="error">{error}</div> : null}
      {draft.blockReasons.length > 0 && draft.disposition !== 'create' ? (
        <p className="muted">{draft.blockReasons.join(' ')}</p>
      ) : null}

      {conflict ? (
        <section className="panel">
          <h2>Existing style needs review</h2>
          <p className="muted">
            {matchKindLabel(conflict.kind)}. This email was not filed automatically. Open the existing style instead of
            creating a duplicate.
          </p>
          <div className="candidate">
            <span>
              {conflict.styleNumber} · {conflict.name}
            </span>
            <Link className="btn btn-primary" to={`/styles/${conflict.styleId}`}>
              Open existing style
            </Link>
          </div>
        </section>
      ) : null}

      {draft.matches.length > 1 ? (
        <section className="panel">
          <h2>Other possible matches</h2>
          {draft.matches
            .filter((match) => match.styleId !== conflict?.styleId)
            .map((match) => (
              <div className="candidate" key={match.styleId}>
                <span>
                  {match.styleNumber} · {match.name} · {matchKindLabel(match.kind)}
                </span>
                <Link className="btn btn-secondary" to={`/styles/${match.styleId}`}>
                  Open style
                </Link>
              </div>
            ))}
        </section>
      ) : null}

      {canCreate ? (
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h2>Style identity</h2>
          {uniqueCandidates.length > 1 ? (
            <div className="field">
              <span>Candidates</span>
              {uniqueCandidates.map((value) => (
                <label key={value} className="candidate">
                  <input
                    type="radio"
                    name="style-number-candidate"
                    checked={styleNumber === value}
                    onChange={() => setStyleNumber(value)}
                    disabled={busy}
                  />
                  {value}
                </label>
              ))}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="draft-style-number">Style number</label>
            <input
              id="draft-style-number"
              value={styleNumber}
              onChange={(event) => setStyleNumber(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="draft-style-name">Name</label>
            <input id="draft-style-name" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} />
          </div>
          {brands.length > 0 ? (
            <div className="field">
              <label htmlFor="draft-brand">Brand</label>
              <select
                id="draft-brand"
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
          {brands.length === 0 || newBrandName.trim().length > 0 || !brandId ? (
            <div className="field">
              <label htmlFor="draft-brand-name">New brand</label>
              <input
                id="draft-brand-name"
                value={newBrandName}
                onChange={(event) => setNewBrandName(event.target.value)}
                placeholder="Brand name"
                disabled={busy}
              />
            </div>
          ) : null}
          {!brandReady ? <div className="error">{BRAND_REQUIRED_MESSAGE}</div> : null}

          {rows.length > 0 ? (
            <>
              <h2>Field proposals</h2>
              <p className="muted">These stay pending after create. They are not written as confirmed style values.</p>
              {rows.map(({ key, label, field }) => (
                <div className="field" key={key}>
                  <label htmlFor={`draft-${key}`}>{label}</label>
                  {key === 'stage' ? (
                    <select
                      id={`draft-${key}`}
                      value={proposalValues[key] ?? ''}
                      onChange={(event) => setProposalValues((current) => ({ ...current, [key]: event.target.value }))}
                      disabled={busy}
                    >
                      <option value="">Not stated</option>
                      {STAGE_COLUMNS.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  ) : key === 'status' ? (
                    <select
                      id={`draft-${key}`}
                      value={proposalValues[key] ?? ''}
                      onChange={(event) => setProposalValues((current) => ({ ...current, [key]: event.target.value }))}
                      disabled={busy}
                    >
                      <option value="">Not stated</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`draft-${key}`}
                      value={proposalValues[key] ?? ''}
                      onChange={(event) => setProposalValues((current) => ({ ...current, [key]: event.target.value }))}
                      disabled={busy}
                    />
                  )}
                  <p className="muted">
                    {[confidenceLabel(field.confidence), evidenceText(field.evidence), field.source]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </>
          ) : null}

          <button className="btn btn-primary" type="submit" disabled={busy || !brandReady || !styleNumber.trim()}>
            Create style from email
          </button>
        </form>
      ) : null}
    </div>
  );
}
