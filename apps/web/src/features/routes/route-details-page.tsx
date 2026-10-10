import type {
  AnalysisConfidence,
  AnalysisStatus,
  LaneStatus,
  RiskState,
  RouteAgreement,
  RouteAssessment,
  RouteDetail,
  RouteFinding,
  RoutePlace,
  RouteSourceCategory,
  RouteSourceCheck,
  RouteSourceName,
  ShippingMode,
  SourceCheckStatus,
} from '@supplyeagle/types';
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../lib/api-client';
import { RiskScoreCard } from '../risk/risk-score-card';
import { scoreLane } from '../risk/score';
import { focusDisasterHeadline } from './disaster-headline';
import { LaneTitle } from './lane-title';
import { useLanePlaces } from './lane-places';
import { RouteMap } from './route-map';
import { useReassessRouteMutation, useRouteQuery } from './use-routes';

const SOURCE_ORDER = [
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
        <section className="card loading-panel" aria-live="polite">
          <span className="spinner spinner-lg" aria-hidden="true" />
          <p>Loading route…</p>
        </section>
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
  const places = useLanePlaces(route.origin, route.destination);
  const reassess = useReassessRouteMutation(route.id);
  const assessing =
    reassess.isPending ||
    assessment?.status === 'queued' ||
    assessment?.status === 'running';

  const resetting =
    reassess.isPending &&
    assessment?.status !== 'queued' &&
    assessment?.status !== 'running';
  const sources = visibleSources(orderedSources(assessment), resetting);
  const checked = sources.filter(
    (source) => source.status !== 'pending',
  ).length;

  return (
    <>
      <header className="suppliers-heading">
        <div>
          <h1>
            <LaneTitle origin={route.origin} destination={route.destination} />
          </h1>
          <p className="suppliers-subtitle">{modeTitle(route.mode)}</p>
        </div>
        <div className="suppliers-heading-actions detail-actions">
          <button
            type="button"
            onClick={() => reassess.mutate()}
            disabled={assessing}
          >
            {assessing ? 'Reassessing…' : 'Reassess'}
          </button>
          <div className="detail-pills">
            <AssessmentPill
              status={assessment?.status ?? null}
              assessing={assessing}
            />
            <LanePill
              status={assessing ? null : (assessment?.laneStatus ?? null)}
              assessing={assessing}
            />
            <RiskPill
              risk={assessing ? null : (assessment?.riskState ?? null)}
              assessing={assessing}
            />
          </div>
          {reassess.isError ? (
            <p className="form-error">
              Reassess did not start. Try again in a moment.
            </p>
          ) : null}
        </div>
      </header>

      <RouteMap
        origin={route.origin}
        destination={route.destination}
        mode={route.mode}
        risk={assessing ? null : (assessment?.riskState ?? null)}
      />
      <DecisionCard
        route={route}
        assessment={assessment}
        assessing={assessing}
        checked={checked}
        total={sources.length}
        sources={sources}
        originCountry={places.data?.[0]?.country ?? null}
        destinationCountry={places.data?.[1]?.country ?? null}
      />
      <RiskScoreCard
        kind="route"
        mode={route.mode}
        result={
          places.isPending
            ? null
            : scoreLane({
                mode: route.mode,
                origin: places.data?.[0] ?? null,
                destination: places.data?.[1] ?? null,
              })
        }
      />
      <SupplierLinks route={route} />

      <section className="source-section" aria-label="Route sources">
        <div className="profile-heading">
          <h2>Sources</h2>
          {assessing ? (
            <span className="risk-pill watch">
              {checked} of {sources.length}
            </span>
          ) : null}
        </div>
        {assessing ? (
          <CheckProgress checked={checked} total={sources.length} />
        ) : null}
        {sourceGroups(sources).map((group) => (
          <SourceGroup
            key={group.category}
            title={group.title}
            sources={group.sources}
            assessing={assessing}
            origin={route.origin}
            destination={route.destination}
            originCountry={places.data?.[0]?.country ?? null}
            destinationCountry={places.data?.[1]?.country ?? null}
          />
        ))}
      </section>
    </>
  );
}

function DecisionCard({
  route,
  assessment,
  assessing,
  checked,
  total,
  sources,
  originCountry,
  destinationCountry,
}: {
  route: RouteDetail;
  assessment: RouteAssessment | null;
  assessing: boolean;
  checked: number;
  total: number;
  sources: RouteSourceCheck[];
  originCountry: string | null;
  destinationCountry: string | null;
}) {
  const structured = sources.some((source) => source.items.length > 0);

  return (
    <section className="card brief-card" aria-live="polite">
      <h2>Decision</h2>
      {assessing ? (
        <p className="profile-decision check-status">
          <span className="spinner" aria-hidden="true" />
          Checking {checked} of {total} sources
        </p>
      ) : null}
      <ul className="decision-stats">
        <Brief label="Lane" text={laneText(route, assessment, assessing)} />
        <Brief
          label="Risk"
          text={
            assessing ? 'Assessing' : riskText(assessment?.riskState ?? null)
          }
        />
        <Brief
          label="Transit"
          text={
            assessing || assessment?.transitDays == null
              ? '—'
              : `${assessment.transitDays}d`
          }
        />
      </ul>
      {!assessing && assessment?.error ? (
        <p className="form-error">{assessment.error}</p>
      ) : null}
      <LaneBrief
        origin={route.origin}
        destination={route.destination}
        originCountry={originCountry}
        destinationCountry={destinationCountry}
        sources={sources}
      />
      {!assessing && !structured && assessment?.summary ? (
        <p className="profile-description">{assessment.summary}</p>
      ) : null}
    </section>
  );
}

function CheckProgress({ checked, total }: { checked: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((checked / total) * 100);

  return (
    <div
      className="check-progress-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={checked}
      aria-label="Sources checked"
    >
      <span style={{ width: `${percent}%` }} />
    </div>
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
      <div className="profile-heading">
        <h2>Linked suppliers</h2>
        <span className="risk-pill unassessed">{route.suppliers.length}</span>
      </div>
      {route.suppliers.length === 0 ? (
        <p className="detail profile-empty">No suppliers linked.</p>
      ) : (
        <ul className="linked-suppliers">
          {route.suppliers.map((supplier) => (
            <li key={supplier.id}>
              <Link className="text-link" to={`/suppliers/${supplier.id}`}>
                {supplier.name}
              </Link>
              {supplier.sanctionsHit === true ? (
                <span className="risk-pill critical">Sanctions hit</span>
              ) : supplier.sanctionsHit === false ? (
                <span className="risk-pill stable">Sanctions clear</span>
              ) : (
                <span className="risk-pill unassessed">Sanctions unknown</span>
              )}
              {supplier.confidence ? (
                <span className="risk-pill unassessed">
                  {confidenceLabel(supplier.confidence)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SourceGroup({
  title,
  sources,
  assessing,
  origin,
  destination,
  originCountry,
  destinationCountry,
}: {
  title: string;
  sources: RouteSourceCheck[];
  assessing: boolean;
  origin: string;
  destination: string;
  originCountry: string | null;
  destinationCountry: string | null;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const reported = sources.filter(
    (source) => source.status !== 'pending',
  ).length;

  useEffect(() => {
    if (details.current) {
      details.current.open = assessing;
    }
  }, [assessing]);

  return (
    <details ref={details} className="source-group">
      <summary className="source-group-title">
        {title}
        <span className="source-group-meta">
          {reported} of {sources.length}
          <span className="source-chevron" aria-hidden="true" />
        </span>
      </summary>
      <ul className="source-list">
        {sources.map((source) => (
          <SourceRow
            key={source.source}
            source={source}
            origin={origin}
            destination={destination}
            originCountry={originCountry}
            destinationCountry={destinationCountry}
          />
        ))}
      </ul>
    </details>
  );
}

function SourceRow({
  source,
  origin,
  destination,
  originCountry,
  destinationCountry,
}: {
  source: RouteSourceCheck;
  origin: string;
  destination: string;
  originCountry: string | null;
  destinationCountry: string | null;
}) {
  const view = sourceView(source);
  const reported = sourceFinding(source);

  return (
    <li
      className={
        view.loading
          ? 'source-row is-checking'
          : source.items.length > 0
            ? 'source-row has-findings'
            : 'source-row'
      }
    >
      <div className="source-name">
        <h3>{sourceTitle(source.source)}</h3>
        <p className={`status ${view.tone}`}>
          {view.loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : null}
          {view.label}
        </p>
      </div>
      {source.items.length > 0 ? (
        <SourceFindings
          items={source.items}
          origin={origin}
          destination={destination}
          originCountry={originCountry}
          destinationCountry={destinationCountry}
        />
      ) : (
        <p className="source-detail">
          {reported}
          {source.url ? (
            <>
              {' '}
              <a
                className="text-link"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                Report
              </a>
            </>
          ) : null}
        </p>
      )}
      <AgreementPill source={source} />
    </li>
  );
}

function LaneBrief({
  origin,
  destination,
  originCountry,
  destinationCountry,
  sources,
}: {
  origin: string;
  destination: string;
  originCountry: string | null;
  destinationCountry: string | null;
  sources: RouteSourceCheck[];
}) {
  const tagged = sources.flatMap((source) =>
    source.items.map((item) => ({ item, provider: source.source })),
  );
  const places = tagged.filter((entry) => entry.item.kind !== 'supplier');
  if (places.length === 0) {
    return null;
  }

  return (
    <div className="lane-brief">
      <PlacePanel
        title={origin}
        place="origin"
        country={originCountry}
        entries={tagged}
      />
      <PlacePanel
        title={destination}
        place="destination"
        country={destinationCountry}
        entries={tagged}
      />
    </div>
  );
}

function PlacePanel({
  title,
  place,
  country,
  entries,
}: {
  title: string;
  place: RoutePlace;
  country: string | null;
  entries: Array<{ item: RouteFinding; provider: RouteSourceName }>;
}) {
  const here = entries.filter(
    (entry) => entry.item.kind !== 'supplier' && entry.item.place === place,
  );

  return (
    <section className="place-panel" aria-label={title}>
      <h3>{title}</h3>
      {here.length === 0 ? (
        <p className="detail profile-empty">Nothing reported here.</p>
      ) : (
        <>
          <FindingGroup
            title="Weather"
            entries={here}
            kind="weather"
            country={country}
          />
          <FindingGroup
            title="News"
            entries={here}
            kind="news"
            country={country}
          />
          <FindingGroup
            title="Disasters"
            entries={here}
            kind="disaster"
            country={country}
          />
        </>
      )}
    </section>
  );
}

function FindingGroup({
  title,
  entries,
  kind,
  country,
}: {
  title: string;
  entries: Array<{ item: RouteFinding; provider: RouteSourceName }>;
  kind: 'weather' | 'news' | 'disaster';
  country: string | null;
}) {
  const matches = entries.filter((entry) => entry.item.kind === kind);
  if (matches.length === 0) {
    return null;
  }

  if (kind === 'weather') {
    const reading = averageWeather(matches);
    return (
      <div className="finding-group">
        <h4>{title}</h4>
        <FindingBody
          item={{
            kind: 'weather',
            place: 'origin',
            windKmh: reading.windKmh,
            visibilityM: reading.visibilityM,
            waveHeightM: reading.waveHeightM,
          }}
          provider={null}
          country={country}
        />
      </div>
    );
  }

  return (
    <div className="finding-group">
      <h4>{title}</h4>
      <ul className="finding-list">
        {matches.map((entry) => (
          <li key={`${entry.provider}-${findingKey(entry.item)}`}>
            <FindingBody
              item={entry.item}
              provider={entry.provider}
              country={country}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceFindings({
  items,
  origin,
  destination,
  originCountry,
  destinationCountry,
}: {
  items: RouteFinding[];
  origin: string;
  destination: string;
  originCountry: string | null;
  destinationCountry: string | null;
}) {
  return (
    <ul className="finding-list source-findings">
      {items.map((item) => (
        <li key={findingKey(item)}>
          {item.kind === 'weather' ||
          item.kind === 'news' ||
          item.kind === 'disaster' ? (
            <p className="finding-kicker">
              {item.place === 'origin' ? origin : destination}
            </p>
          ) : null}
          <FindingBody
            item={item}
            provider={null}
            country={
              item.kind === 'supplier'
                ? null
                : item.place === 'origin'
                  ? originCountry
                  : destinationCountry
            }
          />
        </li>
      ))}
    </ul>
  );
}

function FindingBody({
  item,
  provider,
  country,
}: {
  item: RouteFinding;
  provider: RouteSourceName | null;
  country: string | null;
}) {
  switch (item.kind) {
    case 'weather':
      return (
        <div className="reading">
          {provider ? (
            <p className="reading-source">{sourceTitle(provider)}</p>
          ) : null}
          <dl className="reading-metrics">
            {item.windKmh !== null ? (
              <Metric label="Wind" value={windText(item.windKmh)} />
            ) : null}
            {item.visibilityM !== null ? (
              <Metric
                label="Visibility"
                value={visibilityText(item.visibilityM)}
              />
            ) : null}
            {item.waveHeightM !== null ? (
              <Metric label="Waves" value={waveText(item.waveHeightM)} />
            ) : null}
          </dl>
        </div>
      );
    case 'news':
    case 'disaster':
      return (
        <div className="finding-copy">
          <p className="finding-kicker">
            {provider ? `${sourceTitle(provider)} · ` : ''}
            {labelize(item.hazard)}
          </p>
          <p>
            {item.kind === 'disaster'
              ? focusDisasterHeadline(item.headline, country)
              : item.headline}
          </p>
          {item.url ? (
            <a
              className="text-link"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              Report
            </a>
          ) : null}
        </div>
      );
    case 'supplier':
      return (
        <div className="finding-copy">
          <p>{item.name}</p>
          <p className="finding-kicker">
            {item.sanctionsHit === true
              ? 'Sanctions hit'
              : item.sanctionsHit === false
                ? 'Sanctions clear'
                : 'Sanctions unknown'}
            {item.confidence ? ` · ${confidenceLabel(item.confidence)}` : ''}
          </p>
        </div>
      );
    default: {
      const unexpected: never = item;
      return unexpected;
    }
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function findingKey(item: RouteFinding): string {
  switch (item.kind) {
    case 'weather':
      return `weather-${item.place}-${item.windKmh ?? 'x'}`;
    case 'news':
      return `news-${item.place}-${item.headline}`;
    case 'disaster':
      return `disaster-${item.place}-${item.headline}`;
    case 'supplier':
      return `supplier-${item.name}`;
    default: {
      const unexpected: never = item;
      return unexpected;
    }
  }
}

function averageWeather(entries: Array<{ item: RouteFinding }>): {
  windKmh: number | null;
  visibilityM: number | null;
  waveHeightM: number | null;
} {
  const readings = entries.flatMap((entry) =>
    entry.item.kind === 'weather' ? [entry.item] : [],
  );

  return {
    windKmh: mean(readings.map((reading) => reading.windKmh)),
    visibilityM: mean(readings.map((reading) => reading.visibilityM)),
    waveHeightM: mean(readings.map((reading) => reading.waveHeightM)),
  };
}

function mean(values: Array<number | null>): number | null {
  const numbers = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function windText(value: number | null): string {
  if (value === null) {
    return '—';
  }

  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} km/h`;
}

function visibilityText(value: number | null): string {
  if (value === null) {
    return '—';
  }

  if (value >= 1000) {
    const kilometers = value / 1000;
    const digits = kilometers >= 10 ? 0 : 1;
    return `${kilometers.toFixed(digits)} km`;
  }

  return `${Math.round(value)} m`;
}

function waveText(value: number): string {
  return `${value.toFixed(1)} m`;
}

function labelize(value: string): string {
  return value.replaceAll('_', ' ');
}

function AgreementPill({ source }: { source: RouteSourceCheck }) {
  if (source.status === 'pending' || source.agreement === null) {
    return <span />;
  }

  const agreement = agreementLabel(source.agreement);
  return (
    <span className={`risk-pill ${agreement.tone}`}>{agreement.label}</span>
  );
}

function visibleSources(
  sources: RouteSourceCheck[],
  resetting: boolean,
): RouteSourceCheck[] {
  if (!resetting) {
    return sources;
  }

  return sources.map((source) => ({
    ...source,
    status: 'pending',
    label: null,
    url: null,
    agreement: null,
    hazard: null,
    place: null,
    detail: null,
    error: null,
    items: [],
  }));
}

function orderedSources(
  assessment: RouteAssessment | null,
): RouteSourceCheck[] {
  const bySource = new Map(
    (assessment?.sources ?? []).map((source) => [source.source, source]),
  );
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
        items: [],
      },
  );
}

const SOURCE_GROUPS = [
  { category: 'news', title: 'News' },
  { category: 'weather', title: 'Weather' },
  { category: 'disaster', title: 'Disasters' },
  { category: 'supplier', title: 'Suppliers' },
] as const satisfies ReadonlyArray<{
  category: RouteSourceCategory;
  title: string;
}>;

function sourceGroups(sources: RouteSourceCheck[]): Array<{
  category: RouteSourceCategory;
  title: string;
  sources: RouteSourceCheck[];
}> {
  return SOURCE_GROUPS.map((group) => ({
    ...group,
    sources: sources.filter((source) => source.category === group.category),
  }));
}

function sourceFinding(source: RouteSourceCheck): string {
  switch (source.status) {
    case 'pending':
      return '';
    case 'error':
      return source.error ?? 'This source could not be checked right now';
    case 'found':
    case 'not_found':
      return source.detail ?? source.label ?? '';
    default: {
      const unexpected: never = source.status;
      return unexpected;
    }
  }
}

function sourceView(source: RouteSourceCheck): {
  tone: string;
  label: string;
  loading: boolean;
} {
  if (source.status === 'pending') {
    return { tone: '', label: 'Checking…', loading: true };
  }

  return statusFallback(source.status);
}

function statusFallback(status: SourceCheckStatus): {
  tone: string;
  label: string;
  loading: boolean;
} {
  switch (status) {
    case 'pending':
      return { tone: '', label: 'Checking…', loading: true };
    case 'error':
      return { tone: 'error', label: 'Could not check', loading: false };
    case 'not_found':
      return { tone: 'ok', label: 'No report', loading: false };
    case 'found':
      return { tone: 'ok', label: 'Recorded', loading: false };
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

function AssessmentPill({
  status,
  assessing,
}: {
  status: AnalysisStatus | null;
  assessing: boolean;
}) {
  if (assessing) {
    return <span className="risk-pill watch">Checking sources</span>;
  }

  switch (status) {
    case 'queued':
    case 'running':
      return <span className="risk-pill watch">Checking sources</span>;
    case 'completed':
      return <span className="risk-pill stable">Complete</span>;
    case 'failed':
      return <span className="risk-pill critical">Incomplete</span>;
    case null:
      return <span className="risk-pill unassessed">Not started</span>;
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

function LanePill({
  status,
  assessing,
}: {
  status: LaneStatus | null;
  assessing: boolean;
}) {
  if (assessing || status === null) {
    return (
      <span className={assessing ? 'risk-pill watch' : 'risk-pill unassessed'}>
        {assessing ? 'Lane pending' : 'Lane unknown'}
      </span>
    );
  }

  return (
    <span className={`risk-pill ${laneTone(status)}`}>{laneLabel(status)}</span>
  );
}

function RiskPill({
  risk,
  assessing,
}: {
  risk: RiskState | null;
  assessing: boolean;
}) {
  if (assessing || risk === null) {
    return (
      <span className={assessing ? 'risk-pill watch' : 'risk-pill unassessed'}>
        {assessing ? 'Risk pending' : 'Risk unknown'}
      </span>
    );
  }

  return (
    <span className={`risk-pill ${riskTone(risk)}`}>{riskText(risk)}</span>
  );
}

function agreementLabel(agreement: RouteAgreement): {
  tone: string;
  label: string;
} {
  switch (agreement) {
    case 'confirmed':
      return { tone: 'stable', label: 'Confirmed' };
    case 'clear':
      return { tone: 'stable', label: 'Checked' };
    case 'unverified':
      return { tone: 'unassessed', label: 'Unverified' };
    default: {
      const unexpected: never = agreement;
      return unexpected;
    }
  }
}

function categoryFor(source: RouteSourceName): RouteSourceCategory {
  switch (source) {
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

  return assessment?.laneStatus
    ? laneLabel(assessment.laneStatus)
    : modeTitle(route.mode);
}

function confidenceLabel(confidence: AnalysisConfidence): string {
  switch (confidence) {
    case 'verified':
      return 'Verified';
    case 'partial':
      return 'Partial';
    case 'conflicting':
      return 'Conflicting';
    case 'unverified':
      return 'Unverified';
    default: {
      const unexpected: never = confidence;
      return unexpected;
    }
  }
}

function laneTone(status: LaneStatus): string {
  switch (status) {
    case 'active':
      return 'stable';
    case 'disrupted':
      return 'critical';
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
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

function riskTone(risk: RiskState): string {
  switch (risk) {
    case 'critical':
      return 'critical';
    case 'elevated':
      return 'elevated';
    case 'watch':
      return 'watch';
    case 'stable':
      return 'stable';
    default: {
      const unexpected: never = risk;
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
