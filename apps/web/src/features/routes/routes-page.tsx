import { useState } from 'react';
import { Link } from 'react-router';
import type {
  AnalysisStatus,
  LaneStatus,
  RiskState,
  RouteListItem,
  ShippingMode,
} from '@supplyeagle/types';
import { formatAssessed } from '../format-assessed';
import { AddRouteDialog } from './add-route-dialog';
import { LaneTitle } from './lane-title';
import { useRoutesQuery } from './use-routes';

export function RoutesPage() {
  const routesQuery = useRoutesQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const routes = routesQuery.data?.routes ?? [];

  return (
    <main className="suppliers-page">
      <header className="suppliers-heading">
        <div>
          <h1>Routes</h1>
          <p className="suppliers-subtitle">{subtitle(routesQuery)}</p>
        </div>
        <div className="suppliers-heading-actions">
          <button type="button" onClick={() => setDialogOpen(true)}>
            Add route
          </button>
        </div>
      </header>

      <section className="card suppliers-card" aria-live="polite">
        <div className="suppliers-scroll">
          <table className="suppliers-table" aria-label="Routes">
            <thead>
              <tr>
                <th>Lane</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Suppliers</th>
                <th>Transit</th>
                <th>Assessed</th>
              </tr>
            </thead>
            <tbody>
              {routesQuery.isPending ? (
                <tr>
                  <td colSpan={6} className="suppliers-empty">
                    Loading lanes…
                  </td>
                </tr>
              ) : null}
              {routesQuery.isError ? (
                <tr>
                  <td colSpan={6} className="suppliers-empty">
                    <p className="status error">Could not load routes</p>
                    <p className="detail">Refresh the page, or try again.</p>
                    <button
                      type="button"
                      onClick={() => void routesQuery.refetch()}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : null}
              {routesQuery.data && routes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="suppliers-empty">
                    No lanes yet.
                  </td>
                </tr>
              ) : null}
              {routes.map((route) => (
                <RouteRow key={route.id} route={route} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dialogOpen ? (
        <AddRouteDialog onClose={() => setDialogOpen(false)} />
      ) : null}
    </main>
  );
}

function subtitle(query: ReturnType<typeof useRoutesQuery>): string {
  if (query.isPending) {
    return 'Loading lanes…';
  }

  if (query.isError) {
    return 'Could not load routes';
  }

  const routes = query.data?.routes ?? [];
  const disrupted = routes.filter(
    (route) => route.laneStatus === 'disrupted',
  ).length;
  return `${routes.length} lanes · ${disrupted} disrupted`;
}

function RouteRow({ route }: { route: RouteListItem }) {
  const assessing = isAssessing(route.analysisStatus);

  return (
    <tr>
      <td>
        <div className="supplier-name lane-name">
          <Link to={`/routes/${route.id}`}>
            <LaneTitle origin={route.origin} destination={route.destination} />
          </Link>
          <span className="mode-pill">{modeLabel(route.mode)}</span>
        </div>
      </td>
      <td>
        <StatusCell route={route} assessing={assessing} />
      </td>
      <td>
        {assessing || !route.riskState ? (
          <Empty />
        ) : (
          <RiskPill risk={route.riskState} />
        )}
      </td>
      <td>{assessing ? <Empty /> : route.supplierCount}</td>
      <td className="muted-cell">
        {assessing || route.transitDays === null ? (
          <Empty />
        ) : (
          `${route.transitDays}d`
        )}
      </td>
      <td className="muted-cell">
        {route.assessedAt ? formatAssessed(route.assessedAt) : <Empty />}
      </td>
    </tr>
  );
}

function StatusCell({
  route,
  assessing,
}: {
  route: RouteListItem;
  assessing: boolean;
}) {
  if (assessing) {
    return <span className="risk-pill watch">Assessing</span>;
  }

  if (route.analysisStatus === 'failed') {
    return <span className="risk-pill critical">Failed</span>;
  }

  if (!route.laneStatus) {
    return <Empty />;
  }

  return <LanePill status={route.laneStatus} />;
}

function LanePill({ status }: { status: LaneStatus }) {
  switch (status) {
    case 'active':
      return <span className="risk-pill stable">Active</span>;
    case 'disrupted':
      return <span className="risk-pill critical">Disrupted</span>;
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

function RiskPill({ risk }: { risk: RiskState }) {
  switch (risk) {
    case 'critical':
      return <span className="risk-pill critical">Critical</span>;
    case 'elevated':
      return <span className="risk-pill elevated">Elevated</span>;
    case 'watch':
      return <span className="risk-pill watch">Watch</span>;
    case 'stable':
      return <span className="risk-pill stable">Stable</span>;
    default: {
      const unexpected: never = risk;
      return unexpected;
    }
  }
}

function Empty() {
  return <span className="muted-cell">—</span>;
}

function isAssessing(status: AnalysisStatus | null): boolean {
  return status === 'queued' || status === 'running';
}

function modeLabel(mode: ShippingMode): string {
  switch (mode) {
    case 'air':
      return 'air';
    case 'sea':
      return 'sea';
    default: {
      const unexpected: never = mode;
      return unexpected;
    }
  }
}
