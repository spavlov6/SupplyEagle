import { useState } from 'react';
import type { Supplier } from '@supplyeagle/types';
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
                    <p className="detail">
                      {suppliersQuery.error instanceof Error
                        ? suppliersQuery.error.message
                        : 'Unknown error'}
                    </p>
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
        <div className="supplier-name">{supplier.name}</div>
        {supplier.country ? (
          <div className="supplier-place">{supplier.country}</div>
        ) : null}
      </td>
      <td>
        <span className="risk-pill unassessed">Unassessed</span>
      </td>
      <td className="muted-cell">—</td>
      <td className="muted-cell">—</td>
      <td>0</td>
      <td>
        <TrendSparkline />
      </td>
      <td className="muted-cell">{formatAssessed(supplier.createdAt)}</td>
    </tr>
  );
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

function formatAssessed(createdAt: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(createdAt).getTime()) / 60_000);

  if (!Number.isFinite(minutes) || minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}
