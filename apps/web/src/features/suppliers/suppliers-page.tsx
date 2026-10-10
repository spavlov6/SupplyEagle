import { useState } from 'react';
import { Link } from 'react-router';
import type { AnalysisConfidence, Supplier } from '@supplyeagle/types';
import { formatAssessed } from '../format-assessed';
import { AddSupplierDialog } from './add-supplier-dialog';
import { useSuppliersQuery } from './use-suppliers';

export function SuppliersPage() {
  const suppliersQuery = useSuppliersQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const suppliers = suppliersQuery.data?.suppliers ?? [];
  const status = subtitle(suppliersQuery);

  return (
    <main className="suppliers-page">
      <header className="suppliers-heading">
        <div>
          <h1>Suppliers</h1>
          {status ? <p className="suppliers-subtitle">{status}</p> : null}
        </div>
        <div className="suppliers-heading-actions">
          <button type="button" onClick={() => setDialogOpen(true)}>
            Add supplier
          </button>
        </div>
      </header>

      <section className="card suppliers-card" aria-live="polite">
        <div className="suppliers-scroll">
          <table className="suppliers-table" aria-label="Suppliers">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Risk state</th>
                <th>Assessed</th>
              </tr>
            </thead>
            <tbody>
              {suppliersQuery.isPending ? (
                <tr>
                  <td colSpan={3} className="suppliers-empty">
                    Loading suppliers…
                  </td>
                </tr>
              ) : null}

              {suppliersQuery.isError ? (
                <tr>
                  <td colSpan={3} className="suppliers-empty">
                    <p className="status error">Could not load suppliers</p>
                    <p className="detail">Refresh the page, or try again.</p>
                    <button
                      type="button"
                      onClick={() => void suppliersQuery.refetch()}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : null}

              {suppliersQuery.data && suppliers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="suppliers-empty">
                    No suppliers yet.
                  </td>
                </tr>
              ) : null}

              {suppliers.map((supplier) => (
                <SupplierRow key={supplier.id} supplier={supplier} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dialogOpen ? (
        <AddSupplierDialog onClose={() => setDialogOpen(false)} />
      ) : null}
    </main>
  );
}

function subtitle(query: ReturnType<typeof useSuppliersQuery>): string | null {
  if (query.isPending) {
    return 'Loading suppliers…';
  }

  if (query.isError) {
    return 'Could not load suppliers';
  }

  return null;
}

function SupplierRow({ supplier }: { supplier: Supplier }) {
  return (
    <tr>
      <td>
        <div className="supplier-name">
          <Link to={`/suppliers/${supplier.id}`}>{supplier.name}</Link>
        </div>
        {supplier.country ? (
          <div className="supplier-place">{supplier.country}</div>
        ) : null}
      </td>
      <td>
        <RiskState supplier={supplier} />
      </td>
      <td className="muted-cell">
        {supplier.assessedAt ? formatAssessed(supplier.assessedAt) : '—'}
      </td>
    </tr>
  );
}

function RiskState({ supplier }: { supplier: Supplier }) {
  const view = riskView(supplier);
  return <span className={`risk-pill ${view.tone}`}>{view.label}</span>;
}

function riskView(supplier: Supplier): { tone: string; label: string } {
  if (supplier.sanctionsHit) {
    return { tone: 'critical', label: 'Sanctions hit' };
  }

  switch (supplier.analysisStatus) {
    case 'queued':
      return { tone: 'watch', label: 'Queued' };
    case 'running':
      return { tone: 'watch', label: 'Analyzing' };
    case 'failed':
      return { tone: 'watch', label: 'Incomplete' };
    case 'completed':
      return confidenceView(supplier.confidence);
    case null:
      return { tone: 'unassessed', label: 'Unassessed' };
    default: {
      const unexpected: never = supplier.analysisStatus;
      return unexpected;
    }
  }
}

function confidenceView(confidence: AnalysisConfidence | null): {
  tone: string;
  label: string;
} {
  switch (confidence) {
    case 'verified':
      return { tone: 'stable', label: 'Verified' };
    case 'partial':
      return { tone: 'watch', label: 'Partial' };
    case 'conflicting':
      return { tone: 'elevated', label: 'Conflicting' };
    case 'unverified':
      return { tone: 'unassessed', label: 'Unverified' };
    case null:
      return { tone: 'unassessed', label: 'Unassessed' };
    default: {
      const unexpected: never = confidence;
      return unexpected;
    }
  }
}
