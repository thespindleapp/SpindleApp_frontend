import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { EmptyGhosts } from '../components/EmptyGhosts';
import { HangerRail } from '../components/EmptyMarks';
import { FieldBlock } from '../components/FieldBlock';
import { GarmentMark } from '../components/GarmentMark';
import {
  LEGACY_STAGE_LABELS,
  STAGE_COLUMNS,
  STAGE_LABELS,
  boardColumnForStyle,
  currentStageTone,
  legacyStageValue,
  stageDots,
  styleCreatedFromEmail,
} from '../lib/board';
import { CURRENT_SEASON } from '../lib/empty';
import { publishLoadedRangeCount } from '../lib/range-count';
import { correctionPayload, fieldLabel, formatFieldValue, isCheckedStatus, styleTitle } from '../lib/format';
import {
  DEFAULT_RANGE_FIELDS,
  RANGE_FIELDS,
  checkedNumber,
  displayFact,
  emailsDisagree,
  formatOrderTotal,
  historyEntries,
  lineOrderValue,
  orderTotals,
  outstandingChecks,
  rangeFieldLabel,
  statusBadge,
  type RangeField,
} from '../lib/range';
import { pickForwardingAddress } from '../lib/shell';
import { colourChips, washFor } from '../lib/garment';
import type { StyleCard, StyleFieldView } from '../types';

type SortKey = 'styleNumber' | 'name' | 'quantity' | 'cost' | 'delivery' | 'status' | 'stage';
type BoardLayout = 'gallery' | 'table';
type BoardDensity = 'small' | 'medium' | 'large';
type GroupBy = 'none' | 'fabric' | 'factoryName';
type BoardColumn = { key: string; label: string; sort?: SortKey; width: string };

const COLUMN_PRESETS: Record<string, RangeField[]> = {
  Merchandiser: ['stage', 'status', 'deliveryDate', 'quantity', 'color', 'factoryName'],
  Buyer: ['factoryName', 'fabric', 'costFob', 'quantity', 'currency', 'color'],
};

const PHONE_QUERY = '(max-width: 720px)';

const SORT_LABEL: Record<SortKey, string> = {
  styleNumber: 'style number',
  name: 'name',
  quantity: 'quantity',
  cost: 'unit cost',
  delivery: 'ex-factory',
  status: 'status',
  stage: 'stage',
};

const STAGE_FILTER_LABELS: Record<string, string> = {
  ...STAGE_LABELS,
  UNCONFIRMED: 'Unchecked',
};

function phoneNow() {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
  } catch {
    return false;
  }
}

function checkedText(field: StyleFieldView | undefined): string {
  if (!field || !isCheckedStatus(field.confirmationStatus)) return '';
  return String(field.confirmedValue ?? field.displayValue ?? '');
}

export function BoardPage() {
  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('styleNumber');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [layout, setLayout] = useState<BoardLayout>('gallery');
  const [density, setDensity] = useState<BoardDensity>('medium');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [visibleFields, setVisibleFields] = useState<Set<RangeField>>(() => new Set(DEFAULT_RANGE_FIELDS));
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkIndex, setCheckIndex] = useState(0);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkEditing, setCheckEditing] = useState(false);
  const [checkDraft, setCheckDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStyles, setHistoryStyles] = useState<StyleCard[]>([]);
  const [phone, setPhone] = useState(phoneNow);
  const [forwardAddress, setForwardAddress] = useState<string | null | undefined>(undefined);
  const [addressCopied, setAddressCopied] = useState(false);
  const [soonNote, setSoonNote] = useState<string | null>(null);
  const copiedTimer = useRef<number | null>(null);

  async function load() {
    setError(null);
    try {
      const items = await api.listStyles();
      setStyles(items);
      publishLoadedRangeCount(items.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load board');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (loading || error || styles.length > 0) return;
    let cancelled = false;
    void (async () => {
      const accounts = await api.listEmailAccounts().then(
        (value) => ({ ok: true as const, value }),
        () => ({ ok: false as const }),
      );
      if (cancelled) return;
      setForwardAddress(accounts.ok ? pickForwardingAddress(accounts.value) : undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, error, styles.length]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  const totals = useMemo(() => orderTotals(styles), [styles]);

  const stats = useMemo(() => {
    let blockedCount = 0;
    let shipCount = 0;
    let attentionCount = 0;
    for (const style of styles) {
      const styleStatus = checkedText(style.fields.status).toUpperCase();
      const confirmedStage = boardColumnForStyle(style);
      if (styleStatus === 'BLOCKED') blockedCount += 1;
      if (confirmedStage === 'SHIP' || styleStatus === 'SHIPPED') shipCount += 1;
      if (style.needsConfirmationCount > 0 || styleStatus === 'BLOCKED' || style.fields.stage?.confirmationStatus === 'NEEDS_REVIEW') {
        attentionCount += 1;
      }
    }
    return { blockedCount, shipCount, attentionCount };
  }, [styles]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: styles.length, UNCONFIRMED: 0 };
    for (const col of STAGE_COLUMNS) counts[col] = 0;
    for (const style of styles) {
      const confirmedStage = boardColumnForStyle(style);
      counts[confirmedStage] = (counts[confirmedStage] ?? 0) + 1;
    }
    return counts;
  }, [styles]);

  const filteredStyles = useMemo(() => {
    return styles
      .filter((style) => {
        if (stageFilter !== 'ALL' && boardColumnForStyle(style) !== stageFilter) return false;
        if (statusFilter !== 'ALL') {
          const styleStatus = checkedText(style.fields.status).toLowerCase();
          if (statusFilter === 'attention') {
            const hasAttention =
              style.needsConfirmationCount > 0 || styleStatus === 'blocked' || style.fields.stage?.confirmationStatus === 'NEEDS_REVIEW';
            if (!hasAttention) return false;
          } else if (styleStatus !== statusFilter) {
            return false;
          }
        }
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const factory = checkedText(style.fields.factoryName).toLowerCase();
          const matches =
            style.styleNumber.toLowerCase().includes(query) ||
            style.name.toLowerCase().includes(query) ||
            (style.brand?.name.toLowerCase().includes(query) ?? false) ||
            factory.includes(query);
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const number = (style: StyleCard, key: 'quantity' | 'cost') =>
          key === 'quantity' ? checkedNumber(style.fields.quantity) : checkedNumber(style.fields.costFob);
        if (sortKey === 'quantity' || sortKey === 'cost') {
          const left = number(a, sortKey);
          const right = number(b, sortKey);
          if (left == null && right == null) return 0;
          if (left == null) return 1;
          if (right == null) return -1;
          return sortAsc ? left - right : right - left;
        }
        let left = '';
        let right = '';
        if (sortKey === 'styleNumber') {
          left = a.styleNumber;
          right = b.styleNumber;
        } else if (sortKey === 'name') {
          left = a.name;
          right = b.name;
        } else if (sortKey === 'delivery') {
          left = checkedText(a.fields.deliveryDate);
          right = checkedText(b.fields.deliveryDate);
        } else if (sortKey === 'status') {
          left = checkedText(a.fields.status);
          right = checkedText(b.fields.status);
        } else if (sortKey === 'stage') {
          left = boardColumnForStyle(a);
          right = boardColumnForStyle(b);
        }
        return sortAsc ? left.localeCompare(right) : right.localeCompare(left);
      });
  }, [styles, stageFilter, statusFilter, searchQuery, sortKey, sortAsc]);

  const checks = useMemo(() => outstandingChecks(filteredStyles), [filteredStyles]);
  const groups = useMemo(() => groupStyles(filteredStyles, groupBy), [filteredStyles, groupBy]);
  const currentCheck = checks[checkIndex] ?? null;

  useEffect(() => {
    if (!checkOpen) return;
    if (checks.length === 0) {
      setCheckOpen(false);
      return;
    }
    if (checkIndex >= checks.length) setCheckIndex(checks.length - 1);
  }, [checkOpen, checks.length, checkIndex]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function resetFilters() {
    setStageFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  }

  function toggleField(field: RangeField) {
    setVisibleFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function showField(field: RangeField) {
    return visibleFields.has(field);
  }

  const columns = tableColumns(showField, phone);

  async function openHistory() {
    setHistoryOpen(true);
    setFieldsOpen(false);
    setHistoryLoading(true);
    const loaded = await Promise.all(styles.map((style) => api.getStyle(style.id).catch(() => null)));
    setHistoryStyles(loaded.filter((style): style is StyleCard => style !== null));
    setHistoryLoading(false);
  }

  async function runCheck(action: () => Promise<unknown>) {
    setCheckBusy(true);
    setError(null);
    try {
      await action();
      setCheckEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check this value');
    } finally {
      setCheckBusy(false);
    }
  }

  const workspaceEmpty = !loading && !error && styles.length === 0;
  const filtersEmpty = !loading && !error && styles.length > 0 && filteredStyles.length === 0;
  const history = historyEntries(historyStyles);

  async function copyForwardingAddress() {
    if (!forwardAddress || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(forwardAddress);
      setAddressCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setAddressCopied(false), 1600);
    } catch {
      setAddressCopied(false);
    }
  }

  function sameFields(preset: RangeField[]) {
    return preset.length === visibleFields.size && preset.every((field) => visibleFields.has(field));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className={`page range-board ${workspaceEmpty ? 'is-empty' : ''} ${density === 'small' ? 'is-compact' : ''} ${density === 'large' ? 'is-large' : ''}`}>
        <section className="hero">
          {workspaceEmpty ? (
            <div className="range-hero is-empty">
              <div>
                <SeasonChip />
                <div className="range-title">
                  <h1>{CURRENT_SEASON} range</h1>
                  <span className="range-count">· 0 styles</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="range-hero">
                <div>
                  <SeasonChip />
                  <div className="range-title">
                    <h1>{CURRENT_SEASON} range</h1>
                    <span className="range-count">
                      · {styles.length} {styles.length === 1 ? 'style' : 'styles'}
                    </span>
                  </div>
                </div>
                <div className="range-hero-actions">
                  {checks.length > 0 ? (
                    <button
                      className="btn range-check-btn"
                      type="button"
                      onClick={() => {
                        setCheckIndex(0);
                        setCheckEditing(false);
                        setCheckOpen(true);
                      }}
                    >
                      <span className="range-check-mark" aria-hidden="true" />
                      Check {checks.length}
                    </button>
                  ) : null}
                  <button className="btn btn-secondary" type="button" onClick={() => void openHistory()}>
                    History
                  </button>
                </div>
              </div>
              <div className="stats sr-only">
                <div>
                  <div className="l">Styles</div>
                  <div className="v">{styles.length}</div>
                </div>
                <div aria-label="Order value">
                  <div className="l">Order value</div>
                  {totals.length === 0 ? (
                    <div className="v">—</div>
                  ) : (
                    totals.map((total) => (
                      <div className="v" key={total.currency}>
                        {formatOrderTotal(total)}
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <div className="l">Blocked</div>
                  <div className="v alert">{stats.blockedCount}</div>
                </div>
                <div>
                  <div className="l">Ship stage</div>
                  <div className="v">{stats.shipCount}</div>
                </div>
                <div>
                  <div className="l">Need attention</div>
                  <div className="v alert">{stats.attentionCount}</div>
                </div>
              </div>
            </>
          )}
        </section>

        {error ? <div className="error">{error}</div> : null}
        {loading ? <p className="muted">Loading the Range Board…</p> : null}

        {workspaceEmpty ? null : (
          <div className="fs">
            <div className="range-bar">
              <div className="range-toolbar">
                <div className="inbox-seg is-view" role="group" aria-label="Board layout">
                  <button type="button" aria-pressed={layout === 'gallery'} onClick={() => setLayout('gallery')}>
                    Gallery
                  </button>
                  <button type="button" aria-pressed={layout === 'table'} onClick={() => setLayout('table')}>
                    Table
                  </button>
                </div>
                <div className="inbox-seg" role="group" aria-label="Columns">
                  {Object.entries(COLUMN_PRESETS).map(([name, preset]) => (
                    <button key={name} type="button" aria-pressed={sameFields(preset)} onClick={() => setVisibleFields(new Set(preset))}>
                      {name}
                    </button>
                  ))}
                </div>
                <div className="range-group-control">
                  <span className="fs-l">Group</span>
                  <div className="inbox-seg" role="group" aria-label="Group">
                    {(
                      [
                        ['none', 'None'],
                        ['fabric', 'Fabric'],
                        ['factoryName', 'Mill'],
                      ] as const
                    ).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={groupBy === value} onClick={() => setGroupBy(value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="range-toolbar-end">
                  <div className="inbox-seg range-size" role="group" aria-label="Card size">
                    {(
                      [
                        ['small', 'S'],
                        ['medium', 'M'],
                        ['large', 'L'],
                      ] as const
                    ).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={density === value} onClick={() => setDensity(value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button className="range-fields-link" type="button" aria-label="Fields" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen((open) => !open)}>
                    <span className="range-fields-long" aria-hidden="true">Fields · show, filter, group, sort</span>
                    <span className="range-fields-short" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M4 6h16M7 12h10M10 18h4" />
                      </svg>
                      Fields · {visibleFields.size}
                    </span>
                  </button>
                </div>
              </div>
              <div className="range-bar-sub">
                <button className="range-add-filter" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
                  + Filter
                </button>
                <div className="range-showing">
                  Showing <span className="count-num">{filteredStyles.length}</span> of {styles.length} styles
                </div>
                <span className="range-sorted">Sorted by {SORT_LABEL[sortKey]}</span>
                <div className="search">
                  <input
                    type="text"
                    placeholder="Search styles"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
              </div>
            </div>
            {fieldsOpen ? (
              <fieldset className="range-fields">
                <legend>Fields</legend>
                <span className="range-fields-note">Show, filter, group, sort</span>
                {RANGE_FIELDS.map((field) => (
                  <label key={field}>
                    <input type="checkbox" checked={visibleFields.has(field)} onChange={() => toggleField(field)} />
                    {rangeFieldLabel(field)}
                  </label>
                ))}
              </fieldset>
            ) : null}

            {filtersOpen ? (
            <>
            <div className="fs-statuses">
              <span className="fs-l">Status</span>
              <button className={`s-chip ${statusFilter === 'ALL' ? 'active' : ''}`} type="button" onClick={() => setStatusFilter('ALL')}>
                All <span className="count">{styles.length}</span>
              </button>
              <button
                className={`s-chip alert ${statusFilter === 'attention' ? 'active' : ''}`}
                type="button"
                onClick={() => setStatusFilter('attention')}
              >
                Need attention <span className="count">{stats.attentionCount}</span>
              </button>
              <button
                className={`s-chip ${statusFilter === 'blocked' ? 'active' : ''}`}
                type="button"
                onClick={() => setStatusFilter('blocked')}
              >
                Blocked <span className="count">{stats.blockedCount}</span>
              </button>
              <button className={`s-chip ${statusFilter === 'waiting' ? 'active' : ''}`} type="button" onClick={() => setStatusFilter('waiting')}>
                Waiting
              </button>
              <button className={`s-chip ${statusFilter === 'on_track' ? 'active' : ''}`} type="button" onClick={() => setStatusFilter('on_track')}>
                On track
              </button>
              <button className={`s-chip ${statusFilter === 'shipped' ? 'active' : ''}`} type="button" onClick={() => setStatusFilter('shipped')}>
                Shipped
              </button>
            </div>

            <div className="fs-stages">
              <span className="fs-l">At Stage</span>
              <div className="stage-rail">
                <div className={`stage-cell all ${stageFilter === 'ALL' ? 'active' : ''}`} onClick={() => setStageFilter('ALL')}>
                  <span className="stage-dot" />
                  <span className="stage-name">All</span>
                  <span className="stage-count">{stageCounts.ALL ?? 0}</span>
                </div>
                {STAGE_COLUMNS.map((stage) => (
                  <div
                    key={stage}
                    className={`stage-cell ${stageFilter === stage ? 'active' : ''}`}
                    onClick={() => setStageFilter(stage)}
                  >
                    <span className="stage-dot" />
                    <span className="stage-name">{STAGE_FILTER_LABELS[stage] ?? stage}</span>
                    <span className="stage-count">{stageCounts[stage] ?? 0}</span>
                  </div>
                ))}
                <div
                  className={`stage-cell ${stageFilter === 'UNCONFIRMED' ? 'active' : ''}`}
                  onClick={() => setStageFilter('UNCONFIRMED')}
                >
                  <span className="stage-dot" style={{ borderColor: 'var(--ochre)' }} />
                  <span className="stage-name">Unchecked</span>
                  <span className="stage-count">{stageCounts.UNCONFIRMED ?? 0}</span>
                </div>
              </div>
            </div>
            </>
            ) : null}

            {stageFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery ? (
              <div className="fs-result">
                <button className="reset" type="button" onClick={resetFilters}>
                  Reset filters
                </button>
              </div>
            ) : null}
          </div>
        )}

        {checkOpen && currentCheck ? (
          <section className="range-check" role="dialog" aria-label="Check values">
            <p className="empty-kicker">
              Check {Math.min(checkIndex + 1, checks.length)} of {checks.length}
            </p>
            <h2>
              <Link to={`/styles/${currentCheck.styleId}`}>{currentCheck.styleNumber}</Link>
            </h2>
            <p>{fieldLabel(currentCheck.field.field)}</p>
            {currentCheck.field.confirmationStatus === 'NEEDS_REVIEW' ? (
              <FieldBlock field={currentCheck.field} revisions={[]} onChanged={() => void load()} compact />
            ) : (
              <>
                <p className="is-unchecked">
                  <span className="butter-pip" aria-hidden="true" />
                  From email {formatFieldValue(currentCheck.field.proposedValue)}
                </p>
                <div className="range-check-actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={checkBusy}
                    onClick={() => void runCheck(() => api.confirm(currentCheck.field.confirmationId!))}
                  >
                    Looks right
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={checkBusy}
                    onClick={() => {
                      setCheckEditing(true);
                      setCheckDraft(formatFieldValue(currentCheck.field.proposedValue));
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={checkBusy}
                    onClick={() => void runCheck(() => api.reject(currentCheck.field.confirmationId!))}
                  >
                    Not right
                  </button>
                </div>
                {checkEditing ? (
                  <div className="actions">
                    <input
                      type="text"
                      aria-label={`Edit ${currentCheck.field.field}`}
                      value={checkDraft}
                      onChange={(event) => setCheckDraft(event.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={checkBusy || !checkDraft.trim()}
                      onClick={() =>
                        void runCheck(() =>
                          api.confirm(
                            currentCheck.field.confirmationId!,
                            correctionPayload(currentCheck.field.field, checkDraft),
                          ),
                        )
                      }
                    >
                      Save edit
                    </button>
                  </div>
                ) : null}
              </>
            )}
            <button className="btn btn-ghost" type="button" onClick={() => setCheckOpen(false)}>
              Close
            </button>
          </section>
        ) : null}

        {historyOpen ? (
          <section className="range-history" aria-label="History">
            <div className="range-history-head">
              <h2>History</h2>
              <button className="btn btn-ghost" type="button" onClick={() => setHistoryOpen(false)}>
                Close
              </button>
            </div>
            {historyLoading ? <p className="muted">Loading history…</p> : null}
            {!historyLoading && history.length === 0 ? <p className="muted">No field history yet.</p> : null}
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  <span>
                    {entry.styleNumber} · {fieldLabel(entry.field)} · {entry.label}
                  </span>
                  <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="range-scroll">
        {workspaceEmpty ? (
          <section className="empty-range" aria-labelledby="workspace-empty-heading">
            <div className="empty-copy">
              <HangerRail />
              <h2 id="workspace-empty-heading">Your range starts with one supplier email.</h2>
              <p>
                Forward any email about a style: a cost sheet, a lab dip, a PO. Spindle reads it, makes the style card and puts it on this board.
              </p>
              <div className="empty-address-block">
                <span className="empty-kicker">Your forwarding address</span>
                {forwardAddress ? (
                  <div className="empty-address">
                    <span>{forwardAddress}</span>
                    <button type="button" onClick={() => void copyForwardingAddress()}>
                      {addressCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ) : forwardAddress === null ? (
                  <Link className="btn btn-primary" to="/settings/email-connections">
                    Register a forwarding address
                  </Link>
                ) : (
                  <Link to="/settings/email-connections">Forwarding addresses</Link>
                )}
              </div>
              <div className="empty-actions">
                <div className="empty-action">
                  <div>
                    <strong>Import your range sheet</strong>
                    <p>XLSX or CSV. Styles appear now, details fill in as emails arrive.</p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => setSoonNote('Upload sheet is not available yet.')}>
                    Upload sheet
                  </button>
                </div>
                <div className="empty-action">
                  <div>
                    <strong>See it work first</strong>
                    <p>We send a sample supplier email. Delete the style after.</p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => setSoonNote('Send a sample is not available yet.')}>
                    Send a sample
                  </button>
                </div>
              </div>
              {soonNote ? <p className="empty-step-note">{soonNote}</p> : null}
            </div>
            <EmptyGhosts />
            <p className="empty-footnote">
              Each card shows the garment flat, colourways and nine production stages, from tech pack to shipped.
            </p>
          </section>
        ) : layout === 'gallery' ? (
          filtersEmpty ? (
            <EmptyMatch onReset={resetFilters} />
          ) : (
            <div className="range-groups">
              {groups.map((group) => (
                <section key={group.key}>
                  {group.label ? (
                    <div className="range-group-head">
                      <span>{group.label}</span>
                      <span>{group.styles.length}</span>
                    </div>
                  ) : null}
                  <div className="range-gallery">
                    {group.styles.map((style) => (
                      <article
                        className={`range-card ${selectedIds.has(style.id) ? 'is-selected' : ''} ${style.needsConfirmationCount > 0 ? 'has-check' : ''}`}
                        key={style.id}
                      >
                        <SelectStyle
                          name={styleTitle(style)}
                          pressed={selectedIds.has(style.id)}
                          onToggle={() => toggleSelected(style.id)}
                        />
                        <Link className="range-card-link" to={`/styles/${style.id}`}>
                          <GalleryCard style={style} showField={showField} />
                        </Link>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : phone ? (
          <div className="range-phone-list">
            {filtersEmpty ? (
              <EmptyMatch onReset={resetFilters} />
            ) : (
              groups.map((group) => (
                <section key={group.key}>
                  {group.label ? (
                    <div className="range-group-head">
                      <span>{group.label}</span>
                      <span>
                        {group.styles.length} {group.styles.length === 1 ? 'style' : 'styles'}
                      </span>
                    </div>
                  ) : null}
                  {group.styles.map((style) => (
                    <PhoneStyleRow key={style.id} style={style} showField={showField} />
                  ))}
                </section>
              ))
            )}
          </div>
        ) : (
          <div
            className="range-table"
            style={{ ['--range-rest' as string]: columns.filter((column) => column.key !== 'style').map((column) => column.width).join(' ') }}
          >
            <div className="range-table-head">
              {columns.map((column) =>
                column.sort ? (
                  <button
                    key={column.key}
                    type="button"
                    className={column.key === 'style' ? 'range-pin' : undefined}
                    onClick={() => toggleSort(column.sort!)}
                  >
                    {column.label}
                    {sortKey === column.sort ? (sortAsc ? ' ↑' : ' ↓') : ''}
                  </button>
                ) : (
                  <span key={column.key}>{column.label}</span>
                ),
              )}
            </div>
            {filtersEmpty ? (
              <EmptyMatch onReset={resetFilters} />
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  {group.label ? (
                    <div className="range-group-head">
                      <span>{group.label}</span>
                      <span>{group.styles.length}</span>
                    </div>
                  ) : null}
                  {group.styles.map((style) => (
                    <div className={`range-table-row ${selectedIds.has(style.id) ? 'is-selected' : ''}`} key={style.id}>
                      <div className="range-cell range-pin">
                        <SelectStyle
                          name={styleTitle(style)}
                          pressed={selectedIds.has(style.id)}
                          onToggle={() => toggleSelected(style.id)}
                        />
                        <Link className="range-style-link" to={`/styles/${style.id}`}>
                          <TableCell column="style" style={style} showField={showField} />
                        </Link>
                      </div>
                      {columns
                        .filter((column) => column.key !== 'style')
                        .map((column) => (
                          <span className={`range-cell${column.key === 'stage' ? ' is-stage' : ''}${column.key === 'status' ? ' is-status' : ''}`} key={column.key}>
                            <TableCell column={column.key} style={style} showField={showField} />
                          </span>
                        ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {styles.length > 0 ? (
          <div className="range-legend">
            <span>
              <span className="butter-pip" aria-hidden="true" />
              Not checked yet
              <span className="range-legend-more">. A number beside the dot counts values waiting on that style.</span>
            </span>
            <span>
              <span className="range-disagree" aria-hidden="true">
                !
              </span>
              Emails disagree
            </span>
          </div>
        ) : null}

        {phone && checks.length > 0 ? (
          <div className="range-check-bar">
            <button
              type="button"
              onClick={() => {
                setCheckIndex(0);
                setCheckEditing(false);
                setCheckOpen(true);
              }}
            >
              Check {checks.length}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </>
  );
}

function tableColumns(showField: (field: RangeField) => boolean, phone = false): BoardColumn[] {
  const columns: BoardColumn[] = [{ key: 'style', label: 'Style', sort: 'styleNumber', width: 'var(--range-style)' }];
  if (showField('factoryName')) columns.push({ key: 'factory', label: 'Factory', width: phone ? '168px' : '200px' });
  if (showField('color')) columns.push({ key: 'color', label: 'Colour', width: phone ? '176px' : '210px' });
  if (showField('stage')) columns.push({ key: 'stage', label: 'Stage', width: phone ? '168px' : '280px' });
  if (showField('status')) columns.push({ key: 'status', label: 'Status', sort: 'status', width: phone ? '176px' : '220px' });
  if (showField('fabric')) columns.push({ key: 'fabric', label: 'Fabric', width: '220px' });
  if (showField('quantity')) columns.push({ key: 'quantity', label: 'Quantity', sort: 'quantity', width: '124px' });
  if (showField('costFob')) columns.push({ key: 'cost', label: 'Unit cost', sort: 'cost', width: '136px' });
  if (showField('costFob')) columns.push({ key: 'value', label: 'Value', width: '148px' });
  if (showField('deliveryDate')) columns.push({ key: 'delivery', label: 'Delivery', sort: 'delivery', width: '168px' });
  if (showField('season')) columns.push({ key: 'season', label: 'Season', width: '132px' });
  if (showField('currency')) columns.push({ key: 'currency', label: 'Currency', width: '120px' });
  columns.push({ key: 'latest', label: 'Latest', width: '280px' });
  return columns;
}

function PhoneStyleRow({ style, showField }: { style: StyleCard; showField: (field: RangeField) => boolean }) {
  const title = styleTitle(style);
  const color = displayFact(style.fields.color);
  const chips = color.text === '—' ? [] : colourChips(color.text);
  const stage = boardColumnForStyle(style);
  const stageLabel = stage === 'UNCONFIRMED' ? '' : STAGE_LABELS[stage];
  const delivery = displayFact(style.fields.deliveryDate);
  const status = displayFact(style.fields.status);
  const factory = displayFact(style.fields.factoryName);

  return (
    <Link className="range-phone-row" to={`/styles/${style.id}`}>
      <span className="range-phone-thumb" style={{ background: washFor(chips[0]?.hex) }}>
        <GarmentMark name={title} />
      </span>
      <span className="range-phone-copy">
        <span className="range-phone-name">
          <span className="range-card-name range-clip">{title}</span>
          {style.needsConfirmationCount > 0 ? <span className="butter-pip" aria-hidden="true" /> : null}
        </span>
        <span className="range-phone-sub range-clip">
          {style.styleNumber}
          {stageLabel ? ` · ${stageLabel}` : ''}
        </span>
        {showField('factoryName') && factory.text !== '—' ? (
          <span className={`range-phone-sub range-clip ${factory.unchecked || factory.disagree ? 'is-unchecked' : ''}`}>{factory.text}</span>
        ) : null}
      </span>
      <span className="range-phone-side">
        <span>{delivery.text === '—' ? '' : delivery.text}</span>
        {showField('status') && statusBadge(status.text) ? <StatusFlag fact={status} /> : null}
      </span>
    </Link>
  );
}

function GalleryCard({ style, showField }: { style: StyleCard; showField: (field: RangeField) => boolean }) {
  const title = styleTitle(style);
  const color = displayFact(style.fields.color);
  const chips = showField('color') && color.text !== '—' ? colourChips(color.text) : [];
  const factory = displayFact(style.fields.factoryName);
  const quantity = displayFact(style.fields.quantity);
  const cost = displayFact(style.fields.costFob, { money: true, currency: style.fields.currency });
  const delivery = displayFact(style.fields.deliveryDate);
  const status = displayFact(style.fields.status);
  const value = showField('costFob') ? lineOrderValue(style) : null;
  const supplier = style.supplierName?.trim() ?? '';
  const showFactory = showField('factoryName') && factory.text !== '—';

  return (
    <>
      <div className="range-plate" style={{ background: washFor(chips[0]?.hex) }}>
        <GarmentMark name={title} />
        {showField('status') ? <StatusFlag fact={status} /> : null}
      </div>
      <div className="range-card-title">
        <span className="range-card-name range-clip">{title}</span>
        {styleCreatedFromEmail(style) ? <span className="range-new">New</span> : null}
        {style.needsConfirmationCount > 0 ? (
          <span className="range-roll">
            <span className="butter-pip" aria-hidden="true" />
            {style.needsConfirmationCount}
          </span>
        ) : null}
        {emailsDisagree(style) ? (
          <span className="range-disagree" title="Emails disagree">
            !
          </span>
        ) : null}
        <span className="range-card-no">{style.styleNumber}</span>
      </div>
      {supplier || showFactory ? (
        <p className={`range-card-meta range-clip ${showFactory && (factory.unchecked || factory.disagree) ? 'is-unchecked' : ''}`}>
          <span className="range-card-code">{style.styleNumber}</span>
          {supplier ? <span>{supplier}</span> : null}
          {showFactory ? (
            <>
              {supplier ? ' · mill ' : 'mill '}
              <AttentionMark fact={factory} />
              <span>{factory.text}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {chips.length > 0 ? (
        <div className={`range-card-colours ${color.unchecked || color.disagree ? 'is-unchecked' : ''}`}>
          <AttentionMark fact={color} />
          <span className="range-swatches" aria-hidden="true">
            {chips.map((chip) => (
              <span key={chip.name} style={{ background: chip.hex }} />
            ))}
          </span>
          <span className="range-clip">{chips.map((chip) => chip.name).join(' · ')}</span>
        </div>
      ) : null}
      {showField('stage') ? <StagePips style={style} /> : null}
      <p className="range-card-foot">
        {showField('quantity') && quantity.text !== '—' ? <FactBit fact={quantity} suffix=" pcs" /> : null}
        {showField('deliveryDate') && delivery.text !== '—' ? <FactBit fact={delivery} prefix="ex-fac " /> : null}
        {showField('costFob') && cost.text !== '—' ? <FactBit fact={cost} /> : null}
        {value ? <span className="range-value">{value}</span> : null}
      </p>
    </>
  );
}

function TableCell({
  column,
  style,
  showField,
}: {
  column: string;
  style: StyleCard;
  showField: (field: RangeField) => boolean;
}) {
  const title = styleTitle(style);
  if (column === 'style') {
    return (
      <span className="range-style">
        <span className="range-thumb" style={{ background: washFor(colourChips(displayFact(style.fields.color).text)[0]?.hex) }}>
          <GarmentMark name={title} />
        </span>
        <span className="range-style-copy">
          <span className="range-style-line">
            <span className="range-card-name range-clip" title={title}>
              {title}
              {styleCreatedFromEmail(style) ? <span className="range-new">New</span> : null}
            </span>
            {style.needsConfirmationCount > 0 ? (
              <span className="range-roll">
                <span className="butter-pip" aria-hidden="true" />
                {style.needsConfirmationCount}
              </span>
            ) : null}
            {emailsDisagree(style) ? (
              <span className="range-disagree" title="Emails disagree">
                !
              </span>
            ) : null}
          </span>
          <span className="range-card-no">{style.styleNumber}</span>
        </span>
      </span>
    );
  }
  if (column === 'factory') {
    const factory = displayFact(style.fields.factoryName);
    if (factory.text === '—') return <span>—</span>;
    return (
      <span className={`range-clip ${factory.unchecked || factory.disagree ? 'is-unchecked' : ''}`} title={factory.text}>
        <AttentionMark fact={factory} />
        {factory.text}
      </span>
    );
  }
  if (column === 'color') {
    const color = displayFact(style.fields.color);
    const chips = color.text === '—' ? [] : colourChips(color.text);
    return (
      <span className={`range-card-colours ${color.unchecked || color.disagree ? 'is-unchecked' : ''}`}>
        <AttentionMark fact={color} />
        {chips.length > 0 ? (
          <span className="range-swatches" aria-hidden="true">
            {chips.map((chip) => (
              <span key={chip.name} style={{ background: chip.hex }} />
            ))}
          </span>
        ) : null}
        <span className="range-clip">{color.text}</span>
      </span>
    );
  }
  if (column === 'stage') return showField('stage') ? <StagePips style={style} /> : null;
  if (column === 'status') {
    const status = displayFact(style.fields.status);
    return statusBadge(status.text) ? <StatusFlag fact={status} /> : <span>—</span>;
  }
  if (column === 'cost') {
    const cost = displayFact(style.fields.costFob, { money: true, currency: style.fields.currency });
    return <FactBit fact={cost} />;
  }
  if (column === 'value') {
    const value = lineOrderValue(style);
    return value ? <span className="range-value">{value}</span> : <span>—</span>;
  }
  if (column === 'quantity') return <FactBit fact={displayFact(style.fields.quantity)} />;
  if (column === 'delivery') return <FactBit fact={displayFact(style.fields.deliveryDate)} />;
  if (column === 'fabric') return <FactBit fact={displayFact(style.fields.fabric)} />;
  if (column === 'season') return <FactBit fact={displayFact(style.fields.season)} />;
  if (column === 'currency') return <FactBit fact={displayFact(style.fields.currency)} />;
  const latest = latestUpdate(style);
  return (
    <span className="range-clip" title={latest === '—' ? undefined : latest}>
      {latest}
    </span>
  );
}

function FactBit({
  fact,
  prefix = '',
  suffix = '',
}: {
  fact: { text: string; unchecked: boolean; disagree: boolean };
  prefix?: string;
  suffix?: string;
}) {
  if (fact.text === '—') return <span>—</span>;
  return (
    <span className={fact.unchecked || fact.disagree ? 'is-unchecked' : undefined}>
      <AttentionMark fact={fact} />
      {prefix}
      <span>{fact.text}</span>
      {suffix}
    </span>
  );
}

function latestUpdate(style: StyleCard): string {
  let bestAt = '';
  let best = '';
  for (const field of Object.values(style.fields)) {
    const at = field?.confirmedAt;
    const subject = field?.sourceSubject?.trim();
    if (!at || !subject) continue;
    if (at > bestAt) {
      bestAt = at;
      best = subject;
    }
  }
  return best || '—';
}


function StagePips({ style }: { style: StyleCard }) {
  const dots = stageDots(boardColumnForStyle(style));
  const tone = currentStageTone(style);
  const pending = style.fields.stage ? !isCheckedStatus(style.fields.stage.confirmationStatus) && style.fields.stage.confirmationStatus !== 'NOT_STATED' : false;
  const stageDisagrees = style.fields.stage?.confirmationStatus === 'NEEDS_REVIEW' || style.fields.stage?.proposedDiffersFromConfirmed === true;
  const legacy = legacyStageValue(style);
  return (
    <div className="range-stage">
      {legacy ? (
        <p className="range-legacy">
          {pending ? 'From email, not checked' : 'Recorded earlier'} as {LEGACY_STAGE_LABELS[legacy]}. Not placed on the nine stages.
        </p>
      ) : null}
      <div className="stage-pips" aria-label="Production stage">
        {STAGE_COLUMNS.map((stage, index) => (
          <span
            key={stage}
            className={`stage-pip ${dots[index] === 'done' ? 'is-done' : ''} ${dots[index] === 'current' ? 'is-now' : ''} ${dots[index] === 'current' && tone ? `is-${tone}` : ''}`}
            title={STAGE_LABELS[stage]}
          />
        ))}
      </div>
      {stageDisagrees ? <span className="range-disagree" title="Emails disagree">!</span> : null}
      {pending ? <span className="butter-pip" aria-hidden="true" /> : null}
    </div>
  );
}

function AttentionMark({ fact }: { fact: { unchecked: boolean; disagree: boolean } }) {
  if (fact.disagree) {
    return (
      <span className="range-disagree" title="Emails disagree">
        !
      </span>
    );
  }
  if (fact.unchecked) return <span className="butter-pip" aria-hidden="true" />;
  return null;
}

function StatusFlag({ fact }: { fact: { text: string; unchecked: boolean; disagree: boolean } }) {
  const badge = statusBadge(fact.text);
  if (!badge) return null;
  return (
    <span className={`range-flag is-${badge.tone} ${fact.unchecked || fact.disagree ? 'is-unchecked' : ''}`}>
      <span className="range-flag-swatch" />
      <AttentionMark fact={fact} />
      <span>{badge.label}</span>
    </span>
  );
}

function SelectStyle({ name, pressed, onToggle }: { name: string; pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`range-select ${pressed ? 'is-on' : ''}`}
      aria-pressed={pressed}
      aria-label={`Select ${name}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      {pressed ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : null}
    </button>
  );
}

function SeasonChip() {
  return (
    <div className="season-row">
      <span className="season-chip">
        {CURRENT_SEASON}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
      <button type="button" className="season-add" disabled title="Not available yet">
        + Season
      </button>
    </div>
  );
}

function EmptyMatch({ onReset }: { onReset: () => void }) {
  return (
    <div className="tbl-empty show">
      <div className="em-mark">No styles match.</div>
      <button className="em-cta" type="button" onClick={onReset}>
        Reset filters
      </button>
    </div>
  );
}

function groupStyles(styles: StyleCard[], groupBy: GroupBy) {
  if (groupBy === 'none') return [{ key: 'all', label: null as string | null, styles }];
  const buckets = new Map<string, StyleCard[]>();
  for (const style of styles) {
    const label = groupLabel(style, groupBy);
    const rows = buckets.get(label) ?? [];
    rows.push(style);
    buckets.set(label, rows);
  }
  return [...buckets.entries()].map(([label, rows]) => ({ key: label, label, styles: rows }));
}

function groupLabel(style: StyleCard, groupBy: Exclude<GroupBy, 'none'>) {
  const field = groupBy === 'fabric' ? style.fields.fabric : style.fields.factoryName;
  if (!field || !isCheckedStatus(field.confirmationStatus)) return 'Not checked';
  const text = String(field.confirmedValue ?? field.displayValue ?? '').trim();
  return text || 'Not recorded';
}
