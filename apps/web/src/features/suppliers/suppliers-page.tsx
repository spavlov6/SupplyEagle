import { useState } from 'react';
import { Link } from 'react-router';
import type { AnalysisConfidence, Supplier } from '@supplyeagle/types';
import { formatAssessed } from '../format-assessed';
import { AddSupplierDialog } from './add-supplier-dialog';
import { useSuppliersQuery } from './use-suppliers';

type Density = 'comfortable' | 'compact';

export function SuppliersPage() {
  const suppliersQuery = useSuppliersQuery();
  const [density, setDensity] = useState<Density>('comfortable');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const suppliers = suppliersQuery.data?.suppliers ?? [];
  const allSelected =
    suppliers.length > 0 &&
    suppliers.every((supplier) => selected.has(supplier.id));

  function toggleDensity() {
    setDensity((current) =>
      current === 'comfortable' ? 'compact' : 'comfortable',
    );
  }

  function toggleAll() {
    setSelected((current) => {
      const everySelected =
        suppliers.length > 0 &&
        suppliers.every((supplier) => current.has(supplier.id));

      if (everySelected) {
        return new Set();
      }

      return new Set(suppliers.map((supplier) => supplier.id));
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <main className="suppliers-page">
      <header className="suppliers-heading">
        <div>
          <h1>Suppliers</h1>
          <p className="suppliers-subtitle">{subtitle(suppliersQuery)}</p>
        </div>
        <div className="suppliers-heading-actions">
          <button
            type="button"
            className="density-toggle"
            onClick={toggleDensity}
          >
            density: <span>{density}</span>
          </button>
          <button type="button" onClick={() => setDialogOpen(true)}>
            Add supplier
          </button>
        </div>
      </header>

      <div className="suppliers-toolbar">
        <div className="filter-row">
          <button type="button" className="filter-chip" aria-disabled="true">
            Risk state ▾
          </button>
          <button type="button" className="filter-chip" aria-disabled="true">
            Country ▾
          </button>
          <button type="button" className="filter-chip" aria-disabled="true">
            Commodity ▾
          </button>
          <button type="button" className="filter-chip" aria-disabled="true">
            Has open signals · 0
          </button>
        </div>
        <p className="bulk-actions">bulk: reassess · tag · export</p>
      </div>

      <section className="card suppliers-card" aria-live="polite">
        <div className="suppliers-scroll">
          <table
            className={
              density === 'compact'
                ? 'suppliers-table compact'
                : 'suppliers-table'
            }
            aria-label="Suppliers"
          >
            <thead>
              <tr>
                <th className="select-col">
                  <input
                    type="checkbox"
                    aria-label="Select all suppliers"
                    checked={allSelected}
                    disabled={suppliers.length === 0}
                    onChange={toggleAll}
                  />
                </th>
                <th>Supplier</th>
                <th>Risk state</th>
                <th>Exposure</th>
                <th>Commodities</th>
                <th>Signals</th>
                <th>Trend 7d</th>
                <th>Assessed</th>
              </tr>
            </thead>
            <tbody>
              {suppliersQuery.isPending ? (
                <tr>
                  <td colSpan={8} className="suppliers-empty">
                    Loading suppliers…
                  </td>
                </tr>
              ) : null}

              {suppliersQuery.isError ? (
                <tr>
                  <td colSpan={8} className="suppliers-empty">
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
                  <td colSpan={8} className="suppliers-empty">
                    No suppliers yet.
                  </td>
                </tr>
              ) : null}

              {suppliers.map((supplier) => (
                <SupplierRow
                  key={supplier.id}
                  supplier={supplier}
                  selected={selected.has(supplier.id)}
                  onToggle={toggleOne}
                />
              ))}
            </tbody>
          </table>
        </div>
        {suppliersQuery.data ? (
          <p className="suppliers-footer">
            showing {suppliers.length} of {suppliers.length}
          </p>
        ) : null}
      </section>

      {dialogOpen ? (
        <AddSupplierDialog onClose={() => setDialogOpen(false)} />
      ) : null}
    </main>
  );
}

function subtitle(query: ReturnType<typeof useSuppliersQuery>): string {
  if (query.isPending) {
    return 'Loading suppliers…';
  }

  if (query.isError) {
    return 'Could not load suppliers';
  }

  return `${query.data?.suppliers.length ?? 0} monitored`;
}

type SupplierRowProps = {
  supplier: Supplier;
  selected: boolean;
  onToggle: (id: string) => void;
};

function SupplierRow({ supplier, selected, onToggle }: SupplierRowProps) {
  return (
    <tr>
      <td className="select-col">
        <input
          type="checkbox"
          aria-label={`Select ${supplier.name}`}
          checked={selected}
          onChange={() => onToggle(supplier.id)}
        />
      </td>
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
      <td className="muted-cell">—</td>
      <td className="muted-cell">—</td>
      <td>0</td>
      <td>
        <TrendSparkline />
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

function TrendSparkline() {
  return (
    <svg className="sparkline" viewBox="0 0 72 24" aria-hidden="true">
      <path
        d="M2 12 H70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
