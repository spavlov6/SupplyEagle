import type {
  LaneStatus,
  RiskState,
  RouteAgreement,
  RouteAssessment,
  RouteDetail,
  RouteSourceCategory,
  RouteSourceCheck,
  RouteSourceName,
  ShippingMode,
} from '@supplyeagle/types';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../lib/api-client';
import { useReassessRouteMutation, useRouteQuery } from './use-routes';

const SOURCE_ORDER = [
  'gdelt',
  'google_news',
  'reliefweb',
  'open_meteo',
  'met_norway',
  'gdacs',
  'eonet',
  'usgs',
  'supplier_propagation',
] as const satisfies readonly RouteSourceName[];

export function RouteDetailsPage() {
  const { routeId } = useParams();
  const routeQuery = useRouteQuery(routeId);

  return (
    <main className="supplier-detail">
      <Link className="text-link" to="/routes">
        All routes
      </Link>

      {routeQuery.isPending ? (
        <header className="suppliers-heading">
          <div>
            <h1>Route</h1>
            <p className="suppliers-subtitle">Loading route…</p>
          </div>
        </header>
      ) : null}

      {routeQuery.isError ? <RouteLoadError error={routeQuery.error} /> : null}

      {routeQuery.data ? (
        <RouteDetailView
          route={routeQuery.data.route}
          assessment={routeQuery.data.assessment}
        />
      ) : null}
    </main>
  );
}

function RouteLoadError({ error }: { error: unknown }) {
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <section className="card" aria-live="polite">
      <h1>{notFound ? 'Route not found' : 'Could not load this route'}</h1>
      <p className="detail">
        {notFound
          ? 'It may have been removed, or it belongs to another account.'
          : 'Refresh the page to try again.'}
      </p>
    </section>
  );
}

function RouteDetailView({
  route,
  assessment,
}: {
  route: RouteDetail;
  assessment: RouteAssessment | null;
}) {
  const reassess = useReassessRouteMutation(route.id);
  const assessing =
    reassess.isPending ||
    assessment?.status === 'queued' ||
    assessment?.status === 'running';

  return (
    <>
      <header className="suppliers-heading">
        <div>
          <h1>
            {route.origin} → {route.destination}
          </h1>
          <p className="suppliers-subtitle">{modeTitle(route.mode)}</p>
        </div>
        <div className="suppliers-heading-actions detail-actions">
          <button type="button" onClick={() => reassess.mutate()} disabled={assessing}>
            {assessing ? 'Reassessing…' : 'Reassess'}
          </button>
          {reassess.isError ? (
            <p className="form-error">Reassess did not start. Try again in a moment.</p>
          ) : null}
        </div>
      </header>

      <DecisionCard route={route} assessment={assessment} assessing={assessing} />
      <SupplierLinks route={route} />

      <section className="source-section" aria-label="Route sources">
        <h2>Sources</h2>
        <ul className="source-list">
          {orderedSources(assessment).map((source) => (
            <SourceRow key={source.source} source={source} />
          ))}
        </ul>
      </section>
    </>
  );
}

function DecisionCard({
  route,
  assessment,
  assessing,
}: {
  route: RouteDetail;
  assessment: RouteAssessment | null;
  assessing: boolean;
}) {
  return (
    <section className="card brief-card" aria-live="polite">
      <h2>Decision</h2>
      <ul className="brief-list">
        <Brief label="Lane" text={laneText(route, assessment, assessing)} />
        <Brief label="Risk" text={assessing ? 'Assessing' : riskText(assessment?.riskState ?? null)} />
        <Brief
          label="Why"
          text={assessing ? '—' : (assessment?.why ?? 'No corroborated disruption yet')}
        />
        <Brief
          label="Transit"
          text={assessing || assessment?.transitDays == null ? '—' : `${assessment.transitDays}d`}
        />
      </ul>
      {assessment?.error ? <p className="form-error">{assessment.error}</p> : null}
      {assessment?.summary ? <p className="profile-description">{assessment.summary}</p> : null}
    </section>
  );
}

function Brief({ label, text }: { label: string; text: string }) {
  return (
    <li className="brief-item">
      <span className="brief-label">{label}</span>
      <p className="brief-text">{text}</p>
    </li>
  );
}

function SupplierLinks({ route }: { route: RouteDetail }) {
  return (
    <section className="card profile-card" aria-label="Linked suppliers">
      <h2>Linked suppliers</h2>
      {route.suppliers.length === 0 ? (
        <p className="detail profile-empty">No suppliers linked.</p>
      ) : (
        <ul className="brief-list">
          {route.suppliers.map((supplier) => (
            <li key={supplier.id} className="brief-item">
              <span className="brief-label">Supplier</span>
              <p className="brief-text">
                <Link className="text-link" to={`/suppliers/${supplier.id}`}>
                  {supplier.name}
                </Link>
                {supplier.sanctionsHit ? ' · sanctions hit' : ''}
                {supplier.confidence ? ` · ${supplier.confidence}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SourceRow({ source }: { source: RouteSourceCheck }) {
  const agreement = agreementView(source);
  const reported = source.detail ?? source.label ?? source.error ?? 'No report yet';

  return (
    <li className="source-row">
      <div className="source-name">
        <h3>{sourceTitle(source.source)}</h3>
        <p>{categoryLabel(source)}</p>
      </div>
      <p className="source-detail">{reported}</p>
      <span className={`risk-pill ${agreement.tone}`}>{agreement.label}</span>
    </li>
  );
}

function orderedSources(assessment: RouteAssessment | null): RouteSourceCheck[] {
  const bySource = new Map((assessment?.sources ?? []).map((source) => [source.source, source]));
  return SOURCE_ORDER.map(
    (source) =>
      bySource.get(source) ?? {
        source,
        status: 'pending',
        label: null,
        url: null,
        category: categoryFor(source),
        agreement: null,
        hazard: null,
        place: null,
        detail: null,
        error: null,
      },
  );
}

function agreementView(source: RouteSourceCheck): { tone: string; label: string } {
  if (source.status === 'pending' || source.agreement === null) {
    return { tone: 'watch', label: 'Checking' };
  }

  return agreementLabel(source.agreement);
}

function agreementLabel(agreement: RouteAgreement): { tone: string; label: string } {
  switch (agreement) {
    case 'confirmed':
      return { tone: 'stable', label: 'Confirmed' };
    case 'unverified':
      return { tone: 'unassessed', label: 'Unverified' };
    default: {
      const unexpected: never = agreement;
      return unexpected;
    }
  }
}

function categoryLabel(source: RouteSourceCheck): string {
  if (source.source === 'reliefweb') {
    return 'News and disasters';
  }

  return categoryTitle(source.category);
}

function categoryTitle(category: RouteSourceCategory): string {
  switch (category) {
    case 'news':
      return 'News';
    case 'weather':
      return 'Weather';
    case 'disaster':
      return 'Disasters';
    case 'supplier':
      return 'Suppliers';
    default: {
      const unexpected: never = category;
      return unexpected;
    }
  }
}

function categoryFor(source: RouteSourceName): RouteSourceCategory {
  switch (source) {
    case 'gdelt':
    case 'google_news':
    case 'reliefweb':
      return 'news';
    case 'open_meteo':
    case 'met_norway':
      return 'weather';
    case 'gdacs':
    case 'eonet':
    case 'usgs':
      return 'disaster';
    case 'supplier_propagation':
      return 'supplier';
    default: {
      const unexpected: never = source;
      return unexpected;
    }
  }
}

function sourceTitle(source: RouteSourceName): string {
  switch (source) {
    case 'gdelt':
      return 'GDELT';
    case 'google_news':
      return 'Google News';
    case 'reliefweb':
      return 'ReliefWeb';
    case 'open_meteo':
      return 'Open-Meteo';
    case 'met_norway':
      return 'MET Norway';
    case 'gdacs':
      return 'GDACS';
    case 'eonet':
      return 'NASA EONET';
    case 'usgs':
      return 'USGS';
    case 'supplier_propagation':
      return 'Linked suppliers';
    default: {
      const unexpected: never = source;
      return unexpected;
    }
  }
}

function laneText(
  route: RouteDetail,
  assessment: RouteAssessment | null,
  assessing: boolean,
): string {
  if (assessing) {
    return 'Assessing';
  }

  if (assessment?.status === 'failed') {
    return 'Failed';
  }

  return assessment?.laneStatus ? laneLabel(assessment.laneStatus) : modeTitle(route.mode);
}

function laneLabel(status: LaneStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'disrupted':
      return 'Disrupted';
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

function riskText(risk: RiskState | null): string {
  switch (risk) {
    case 'critical':
      return 'Critical';
    case 'elevated':
      return 'Elevated';
    case 'watch':
      return 'Watch';
    case 'stable':
      return 'Stable';
    case null:
      return '—';
    default: {
      const unexpected: never = risk;
      return unexpected;
    }
  }
}

function modeTitle(mode: ShippingMode): string {
  switch (mode) {
    case 'air':
      return 'Air';
    case 'sea':
      return 'Sea cargo';
    default: {
      const unexpected: never = mode;
      return unexpected;
    }
  }
}
