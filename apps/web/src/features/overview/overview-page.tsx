import type { RouteRiskCounts } from '@supplyeagle/types';
import { useOverview } from './use-overview';

export function OverviewPage() {
  const overview = useOverview();
  const data = overview.data;

  return (
    <main className="workspace overview">
      <header>
        <h1>Overview</h1>
        <p className="suppliers-subtitle">Route risk across the account.</p>
      </header>

      <section className="kpi-row" aria-label="Account counts">
        <article>
          <span>Sanctioned suppliers</span>
          <strong>{data?.sanctionedSuppliers ?? '—'}</strong>
        </article>
        <article>
          <span>Disrupted routes</span>
          <strong>{data?.disruptedRoutes ?? '—'}</strong>
        </article>
        <article>
          <span>Last Pipeline run</span>
          <strong>
            {data?.lastScanAt
              ? new Date(data.lastScanAt).toLocaleString()
              : 'None yet'}
          </strong>
        </article>
      </section>

      <section className="card panel-card">
        <h2>Routes by risk</h2>
        {data ? <RiskMix counts={data.routesByRisk} /> : <p>Loading…</p>}
      </section>
    </main>
  );
}

function RiskMix({ counts }: { counts: RouteRiskCounts }) {
  const bars = [
    ['critical', 'Critical', counts.critical],
    ['elevated', 'Elevated', counts.elevated],
    ['watch', 'Watch', counts.watch],
    ['stable', 'Stable', counts.stable],
    ['unassessed', 'Unassessed', counts.unassessed],
  ] as const;
  const max = Math.max(1, ...bars.map((bar) => bar[2]));

  return (
    <svg
      className="chart"
      role="img"
      aria-label="Routes by risk"
      viewBox="0 0 480 148"
    >
      {bars.map(([name, label, value], index) => {
        const height = (value / max) * 78;
        const x = 20 + index * 92;
        return (
          <g key={name}>
            <rect
              x={x}
              y={100 - height}
              width="40"
              height={Math.max(height, value > 0 ? 4 : 0)}
              className={`bar ${name}`}
            />
            <text
              x={x + 20}
              y={92 - height}
              textAnchor="middle"
              className="chart-value"
            >
              {value}
            </text>
            <text x={x + 20} y="128" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
