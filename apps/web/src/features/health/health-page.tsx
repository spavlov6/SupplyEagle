import { healthStatusLabel } from './health-status';
import { useHealthQuery } from './use-health-query';

export function HealthPage() {
  const healthQuery = useHealthQuery();

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">SupplyEagle</p>
        <h1>Service status</h1>
        <p className="lede">
          The web app reads API health through TanStack Query and the Vite
          <code> /api </code> proxy.
        </p>
      </header>

      <section className="card" aria-live="polite">
        {healthQuery.isPending ? <p>Checking the API…</p> : null}

        {healthQuery.isError ? (
          <div>
            <p className="status error">API unreachable</p>
            <p className="detail">
              {healthQuery.error instanceof Error
                ? healthQuery.error.message
                : 'Unknown error'}
            </p>
            <button type="button" onClick={() => void healthQuery.refetch()}>
              Retry
            </button>
          </div>
        ) : null}

        {healthQuery.data ? (
          <dl className="health">
            <div>
              <dt>Status</dt>
              <dd className={`status ${healthQuery.data.status}`}>
                {healthStatusLabel(healthQuery.data.status)}
              </dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{healthQuery.data.service}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{new Date(healthQuery.data.timestamp).toLocaleString()}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}
