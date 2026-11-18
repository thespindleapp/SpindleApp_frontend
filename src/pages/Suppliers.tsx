import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { SupplierMark } from '../components/EmptyMarks';
import { supplierForwardMessage } from '../lib/empty';
import { pickForwardingAddress } from '../lib/shell';

export function SuppliersPage() {
  const [forwardAddress, setForwardAddress] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [soonNote, setSoonNote] = useState<string | null>(null);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .listEmailAccounts()
      .then((accounts) => {
        if (!cancelled) setForwardAddress(pickForwardingAddress(accounts));
      })
      .catch(() => {
        if (!cancelled) setForwardAddress(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  async function copyMessage() {
    if (!forwardAddress || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(supplierForwardMessage(forwardAddress));
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="page suppliers-page">
      <header className="suppliers-head">
        <div className="range-title">
          <h1>Suppliers</h1>
          <span className="range-count">· 0</span>
        </div>
        <button type="button" className="btn suppliers-add" onClick={() => setSoonNote('Add a supplier is not available yet.')}>
          + Add a supplier
        </button>
      </header>
      {soonNote ? <p className="empty-step-note">{soonNote}</p> : null}
      <div className="suppliers-cols" aria-hidden="true">
        <span>Supplier</span>
        <span>Contact</span>
        <span>Styles</span>
        <span>Emails</span>
        <span>Last heard</span>
      </div>
      <section className="suppliers-empty" aria-labelledby="suppliers-empty-heading">
        <div className="suppliers-copy">
          <SupplierMark />
          <h2 id="suppliers-empty-heading">Suppliers add themselves when they email you.</h2>
          <p>The first email from a new factory creates its row here, with the contact, the styles they make and how quickly they reply.</p>
          {forwardAddress ? (
            <p>Want emails to arrive without forwarding? Ask suppliers to copy in {forwardAddress}.</p>
          ) : forwardAddress === null ? (
            <p>Want emails to arrive without forwarding? Register a forwarding address and ask suppliers to copy it in.</p>
          ) : null}
        </div>
        <div className="supplier-message">
          <div className="supplier-message-head">
            <span>Message to send your suppliers</span>
            {forwardAddress ? (
              <button type="button" onClick={() => void copyMessage()}>
                {copied ? 'Copied' : 'Copy message'}
              </button>
            ) : null}
          </div>
          {forwardAddress ? (
            <div className="supplier-message-card">
              <span>Hi,</span>
              <span>
                Please copy <strong>{forwardAddress}</strong> on every email about our styles: costs, lab dips, samples, POs and shipping. Put the style number in the subject line where you can.
              </span>
              <span>Thank you</span>
            </div>
          ) : forwardAddress === null ? (
            <Link className="btn btn-secondary" to="/settings/email-connections">
              Register a forwarding address
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
