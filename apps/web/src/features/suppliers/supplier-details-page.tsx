import type {
  AnalysisConfidence,
  AnalysisStatus,
  SourceName,
  SupplierAnalysis,
  SupplierSourceCheck,
} from '@supplyeagle/types';
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../lib/api-client';
import { RiskScoreCard } from '../risk/risk-score-card';
import { scoreSupplier } from '../risk/score';
import { useReassessSupplierMutation, useSupplierQuery } from './use-suppliers';

export function SupplierDetailsPage() {
  const { supplierId } = useParams();
  const supplierQuery = useSupplierQuery(supplierId);

  return (
    <main className="supplier-detail">
      <Link className="text-link" to="/suppliers">
        All suppliers
      </Link>

      {supplierQuery.isPending ? (
        <section className="card loading-panel" aria-live="polite">
          <span className="spinner spinner-lg" aria-hidden="true" />
          <p>Loading supplier…</p>
        </section>
      ) : null}

      {supplierQuery.isError ? (
        <SupplierLoadError error={supplierQuery.error} />
      ) : null}

      {supplierQuery.data ? (
        <SupplierDetail
          supplierId={supplierQuery.data.supplier.id}
          name={supplierQuery.data.supplier.name}
          country={supplierQuery.data.supplier.country}
          analysis={supplierQuery.data.analysis}
        />
      ) : null}
    </main>
  );
}

function SupplierLoadError({ error }: { error: unknown }) {
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <section className="card" aria-live="polite">
      <h1>
        {notFound ? 'Supplier not found' : 'Could not load this supplier'}
      </h1>
      <p className="detail">
        {notFound
          ? 'It may have been removed, or it belongs to another account.'
          : 'Refresh the page to try again.'}
      </p>
    </section>
  );
}

function SupplierDetail({
  supplierId,
  name,
  country,
  analysis,
}: {
  supplierId: string;
  name: string;
  country: string | null;
  analysis: SupplierAnalysis | null;
}) {
  const reassess = useReassessSupplierMutation(supplierId);
  const inProgress =
    reassess.isPending ||
    analysis?.status === 'queued' ||
    analysis?.status === 'running';
  const reassessError = reassess.isError
    ? 'Reassess did not start. Try again in a moment.'
    : null;
  const resetting =
    reassess.isPending &&
    analysis?.status !== 'queued' &&
    analysis?.status !== 'running';
  const sources = visibleSources(orderedSources(analysis), resetting);
  const checked = sources.filter(
    (source) => source.status !== 'pending',
  ).length;

  return (
    <>
      <header className="suppliers-heading">
        <div>
          <h1>{name}</h1>
          <p className="suppliers-subtitle">
            {displayCountry(country, analysis) ?? 'Country not verified yet'}
          </p>
          <CompanyMeta
            country={displayCountry(country, analysis)}
            analysis={analysis}
            checking={inProgress}
          />
        </div>
        <div className="suppliers-heading-actions detail-actions">
          <button
            type="button"
            onClick={() => reassess.mutate()}
            disabled={inProgress}
          >
            {inProgress ? 'Reassessing…' : 'Reassess'}
          </button>
          <div className="detail-pills">
            <StatusPill
              status={analysis?.status ?? null}
              assessing={inProgress}
            />
            <ConfidencePill
              confidence={inProgress ? null : (analysis?.confidence ?? null)}
              assessing={inProgress}
            />
            <SanctionsPill
              sanctionsHit={
                inProgress ? null : (analysis?.sanctionsHit ?? null)
              }
              assessing={inProgress}
            />
          </div>
          {reassessError ? <p className="form-error">{reassessError}</p> : null}
        </div>
      </header>

      <RiskScoreCard
        kind="supplier"
        result={
          inProgress || !analysis
            ? null
            : scoreSupplier({
                confidence: analysis.confidence,
                sanctionsHit: analysis.sanctionsHit,
                sources: analysis.sources,
              })
        }
      />
      <VerificationBrief
        analysis={inProgress ? null : analysis}
        checking={inProgress}
        checked={checked}
        total={sources.length}
      />
      <SupplierSources
        sources={sources}
        checking={inProgress}
        checked={checked}
      />
    </>
  );
}

function SupplierSources({
  sources,
  checking,
  checked,
}: {
  sources: SupplierSourceCheck[];
  checking: boolean;
  checked: number;
}) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (details.current) {
      details.current.open = checking;
    }
  }, [checking]);

  return (
    <section className="source-section" aria-label="Verification sources">
      {checking ? (
        <CheckProgress checked={checked} total={sources.length} />
      ) : null}
      <details ref={details} className="source-group">
        <summary className="source-group-title source-section-toggle">
          <h2>Sources</h2>
          <span className="source-group-meta">
            {checked} of {sources.length}
            <span className="source-chevron" aria-hidden="true" />
          </span>
        </summary>
        <ul className="source-list">
          {sources.map((source) => (
            <SourceRow
              key={source.source}
              source={source}
              checking={checking}
            />
          ))}
        </ul>
      </details>
    </section>
  );
}

function VerificationBrief({
  analysis,
  checking,
  checked,
  total,
}: {
  analysis: SupplierAnalysis | null;
  checking: boolean;
  checked: number;
  total: number;
}) {
  return (
    <section className="card brief-card" aria-live="polite">
      <h2>Verification</h2>
      {checking ? (
        <p className="profile-decision check-status">
          <span className="spinner" aria-hidden="true" />
          Checking {checked} of {total} sources
        </p>
      ) : null}
      {analysis ? (
        <ul className="brief-list">
          {verificationItems(analysis).map((item) => (
            <li key={item.label} className="brief-item">
              <span className="brief-label">{item.label}</span>
              <p className="brief-text">
                {item.text}
                {item.href ? (
                  <>
                    {' '}
                    <a
                      className="text-link"
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.hrefLabel}
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : checking ? null : (
        <p className="profile-decision">Verification has not started.</p>
      )}
    </section>
  );
}

function CompanyMeta({
  country,
  analysis,
  checking,
}: {
  country: string | null;
  analysis: SupplierAnalysis | null;
  checking: boolean;
}) {
  const facts = companyFacts(analysis);
  const summary = companySummary(facts.description, country);
  const rows = factRows(facts);

  return (
    <div className="company-meta-wrap" aria-live="polite">
      {summary ? <p className="company-summary">{summary}</p> : null}
      <dl className="company-meta">
        {facts.entityStatus ? (
          <div>
            <dt>Registry</dt>
            <dd>
              <span
                className={`risk-pill ${facts.entityStatus === 'ACTIVE' ? 'stable' : 'watch'}`}
              >
                {registryStatusLabel(facts.entityStatus)}
              </span>
            </dd>
          </div>
        ) : null}
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {row.value ? (
                <FactValue row={{ ...row, value: row.value }} />
              ) : (
                <span className="profile-missing">
                  {checking ? 'Checking' : 'Not on file'}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type BriefItem = {
  label: string;
  text: string;
  href?: string;
  hrefLabel?: string;
};

function verificationItems(analysis: SupplierAnalysis): BriefItem[] {
  const sources = orderedSources(analysis);
  const gleif = sources.find((source) => source.source === 'gleif');
  const wikidata = sources.find((source) => source.source === 'wikidata');
  const sanctions = sources.find((source) => source.source === 'opensanctions');
  if (!gleif || !wikidata || !sanctions) {
    return [];
  }

  return [
    { label: 'Identity', text: identityText(analysis, gleif, wikidata) },
    sanctionsItem(analysis, sanctions),
  ];
}

function identityText(
  analysis: SupplierAnalysis,
  gleif: SupplierSourceCheck,
  wikidata: SupplierSourceCheck,
): string {
  switch (analysis.confidence) {
    case 'verified':
      return verifiedText(analysis, gleif, wikidata);
    case 'partial':
      return partialText(analysis, gleif, wikidata);
    case 'conflicting':
      return conflictingText(gleif, wikidata);
    case 'unverified':
      return unverifiedText(gleif, wikidata);
    case null:
      return checkingText(gleif, wikidata);
    default: {
      const unexpected: never = analysis.confidence;
      return unexpected;
    }
  }
}

function verifiedText(
  analysis: SupplierAnalysis,
  gleif: SupplierSourceCheck,
  wikidata: SupplierSourceCheck,
): string {
  const place = countryPhrase(
    analysis.country ?? gleif.country ?? wikidata.country,
  );
  const gleifName = gleif.label ?? 'the company';
  const wikidataName = wikidata.label ?? 'the company';
  if (gleifName.toLowerCase() === wikidataName.toLowerCase()) {
    return `GLEIF and Wikidata both matched ${gleifName}${place}.`;
  }

  return `GLEIF matched ${gleifName}. Wikidata matched ${wikidataName}${place}.`;
}

function partialText(
  analysis: SupplierAnalysis,
  gleif: SupplierSourceCheck,
  wikidata: SupplierSourceCheck,
): string {
  const matched =
    gleif.status === 'found'
      ? gleif
      : wikidata.status === 'found'
        ? wikidata
        : null;
  if (!matched) {
    return 'Only one identity source matched.';
  }

  const other = matched.source === 'gleif' ? wikidata : gleif;
  const place = countryPhrase(matched.country ?? analysis.country);
  const gap = other.source === 'gleif' ? gleifGap(other) : sourceState(other);
  return `${sourceTitle(matched.source)} matched ${matched.label ?? 'this company'}${place}. ${gap}`;
}

function conflictingText(
  gleif: SupplierSourceCheck,
  wikidata: SupplierSourceCheck,
): string {
  return `${matchedPlace(gleif)} ${matchedPlace(wikidata)}`.trim();
}

function unverifiedText(
  gleif: SupplierSourceCheck,
  wikidata: SupplierSourceCheck,
): string {
  if (gleif.status === 'not_found' && wikidata.status === 'not_found') {
    return 'GLEIF and Wikidata found no matching record.';
  }

  return `${sourceState(gleif)} ${sourceState(wikidata)}`.trim();
}

function checkingText(
  gleif: SupplierSourceCheck,
  wikidata: SupplierSourceCheck,
): string {
  if (gleif.status === 'pending' && wikidata.status === 'pending') {
    return 'Checking GLEIF and Wikidata.';
  }

  return `${sourceState(gleif)} ${sourceState(wikidata)}`.trim();
}

function sanctionsItem(
  analysis: SupplierAnalysis,
  source: SupplierSourceCheck,
): BriefItem {
  if (analysis.sanctionsHit === true || source.sanctionsHit === true) {
    const label = source.label ?? analysis.legalName ?? 'this company';
    return {
      label: 'Sanctions',
      text: `OpenSanctions matched ${label} and flagged a record.`,
      href: source.url ?? undefined,
      hrefLabel: 'Review record',
    };
  }

  if (
    analysis.sanctionsHit === false ||
    source.status === 'not_found' ||
    source.status === 'found'
  ) {
    return { label: 'Sanctions', text: 'No sanctions match.' };
  }

  return { label: 'Sanctions', text: sourceState(source) };
}

function matchedPlace(source: SupplierSourceCheck): string {
  const place = countryPhrase(source.country);
  return `${sourceTitle(source.source)} matched ${source.label ?? 'this company'}${place}.`;
}

function gleifGap(source: SupplierSourceCheck): string {
  switch (source.status) {
    case 'not_found':
      return 'GLEIF found no record.';
    case 'error':
      return 'GLEIF could not be checked.';
    case 'pending':
      return 'GLEIF is still checking.';
    case 'found':
      return 'GLEIF matched a record.';
    default: {
      const unexpected: never = source.status;
      return unexpected;
    }
  }
}

function sourceState(source: SupplierSourceCheck): string {
  const title = sourceTitle(source.source);
  switch (source.status) {
    case 'pending':
      return `${title} is still checking.`;
    case 'found':
      return `${title} matched ${source.label ?? 'this company'}${countryPhrase(source.country)}.`;
    case 'not_found':
      return `${title} found no record.`;
    case 'error':
      return `${title} could not be checked.`;
    default: {
      const unexpected: never = source.status;
      return unexpected;
    }
  }
}

function countryPhrase(country: string | null): string {
  if (!country) {
    return '';
  }

  const withArticle =
    /^(United|Netherlands|Czech|Philippines|Bahamas|Gambia|Maldives|Seychelles)/.test(
      country,
    );
  return withArticle ? ` in the ${country}` : ` in ${country}`;
}

function FactValue({ row }: { row: FactRow }) {
  if (!row.value) {
    return null;
  }

  if (row.kind === 'link') {
    return (
      <a
        className="text-link"
        href={row.value}
        target="_blank"
        rel="noreferrer"
      >
        {websiteLabel(row.value)}
      </a>
    );
  }

  return (
    <span className={row.kind === 'code' ? 'profile-code' : undefined}>
      {row.value}
    </span>
  );
}

type FactKind = 'text' | 'code' | 'link';

type FactRow = {
  label: string;
  value: string | null;
  kind: FactKind;
};

type CompanyFacts = {
  legalName: string | null;
  founded: string | null;
  entityStatus: string | null;
  website: string | null;
  description: string | null;
};

function displayCountry(
  country: string | null,
  analysis: SupplierAnalysis | null,
): string | null {
  const gleif = analysis?.sources.find((source) => source.source === 'gleif');
  const wikidata = analysis?.sources.find(
    (source) => source.source === 'wikidata',
  );
  return analysis?.country ?? gleif?.country ?? wikidata?.country ?? country;
}

function companySummary(
  description: string | null,
  country: string | null,
): string | null {
  if (!description) {
    return null;
  }

  const text = country
    ? description
        .replace(
          new RegExp(`\\s+(?:in|of)\\s+${escapeRegExp(country)}\\.?$`, 'i'),
          '',
        )
        .replace(new RegExp(`,\\s*${escapeRegExp(country)}\\.?$`, 'i'), '')
        .trim()
    : description.trim();

  if (!text) {
    return null;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function companyFacts(analysis: SupplierAnalysis | null): CompanyFacts {
  const gleif = analysis?.sources.find((source) => source.source === 'gleif');
  const wikidata = analysis?.sources.find(
    (source) => source.source === 'wikidata',
  );

  return {
    legalName: analysis?.legalName ?? gleif?.label ?? null,
    founded: wikidata?.founded ?? gleif?.founded ?? null,
    entityStatus: gleif?.entityStatus ?? null,
    website: wikidata?.website ?? null,
    description: wikidata?.description ?? null,
  };
}

function factRows(facts: CompanyFacts): FactRow[] {
  return [
    { label: 'Legal name', value: facts.legalName, kind: 'text' },
    { label: 'Founded', value: facts.founded, kind: 'text' },
    { label: 'Website', value: facts.website, kind: 'link' },
  ];
}

function registryStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'Active';
    case 'INACTIVE':
      return 'Inactive';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function visibleSources(
  sources: SupplierSourceCheck[],
  resetting: boolean,
): SupplierSourceCheck[] {
  if (!resetting) {
    return sources;
  }

  return sources.map((source) => ({
    ...source,
    status: 'pending',
    label: null,
    url: null,
    country: null,
    sanctionsHit: null,
    lei: null,
    city: null,
    address: null,
    registrationNumber: null,
    founded: null,
    entityStatus: null,
    website: null,
    description: null,
    error: null,
  }));
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

function orderedSources(
  analysis: SupplierAnalysis | null,
): SupplierSourceCheck[] {
  const bySource = new Map(
    (analysis?.sources ?? []).map((source) => [source.source, source]),
  );

  return (['opensanctions', 'gleif', 'wikidata'] as const).map(
    (source) =>
      bySource.get(source) ?? {
        source,
        status: 'pending',
        label: null,
        url: null,
        country: null,
        sanctionsHit: null,
        lei: null,
        city: null,
        address: null,
        registrationNumber: null,
        founded: null,
        entityStatus: null,
        website: null,
        description: null,
        error: null,
      },
  );
}

function SourceRow({
  source,
  checking,
}: {
  source: SupplierSourceCheck;
  checking: boolean;
}) {
  const detail = sourceDetail(source);
  const loading = checking && source.status === 'pending';

  return (
    <li className={loading ? 'source-row is-checking' : 'source-row'}>
      <div className="source-name">
        <h3>{sourceTitle(source.source)}</h3>
        <p className={`status ${loading ? '' : sourceTone(source)}`}>
          {loading ? <span className="spinner" aria-hidden="true" /> : null}
          {sourceSummary(source, checking)}
        </p>
      </div>
      <p className="source-detail">{detail}</p>
      {source.url ? (
        <a
          className="text-link"
          href={source.url}
          target="_blank"
          rel="noreferrer"
        >
          Record
        </a>
      ) : (
        <span />
      )}
    </li>
  );
}

function sourceDetail(source: SupplierSourceCheck): string {
  if (source.status !== 'found') {
    return '';
  }

  if (source.source === 'opensanctions') {
    return source.sanctionsHit ? (source.label ?? '') : '';
  }

  if (source.source === 'wikidata') {
    return source.description ?? source.label ?? '';
  }

  const place = source.city ?? source.country;
  return [source.label, place].filter((part) => part).join(' · ');
}

function sourceTitle(source: SourceName): string {
  switch (source) {
    case 'opensanctions':
      return 'OpenSanctions';
    case 'gleif':
      return 'GLEIF';
    case 'wikidata':
      return 'Wikidata';
    default: {
      const unexpected: never = source;
      return unexpected;
    }
  }
}

function sourceSummary(source: SupplierSourceCheck, checking: boolean): string {
  switch (source.status) {
    case 'pending':
      return checking ? 'Checking…' : 'Not checked';
    case 'error':
      return 'This source could not be checked right now';
    case 'not_found':
      return source.source === 'opensanctions'
        ? 'No sanctions match'
        : 'No matching record';
    case 'found':
      return source.source === 'opensanctions'
        ? source.sanctionsHit
          ? 'Sanctions match'
          : 'No sanctions match'
        : 'Matching record';
    default: {
      const unexpected: never = source.status;
      return unexpected;
    }
  }
}

function sourceTone(source: SupplierSourceCheck): string {
  if (
    source.status === 'error' ||
    (source.source === 'opensanctions' && source.sanctionsHit)
  ) {
    return 'error';
  }

  if (source.status === 'found') {
    return 'ok';
  }

  return '';
}

function StatusPill({
  status,
  assessing,
}: {
  status: AnalysisStatus | null;
  assessing: boolean;
}) {
  if (assessing) {
    return <span className="risk-pill watch">Checking sources</span>;
  }

  const view = statusView(status);
  return <span className={`risk-pill ${view.tone}`}>{view.label}</span>;
}

function statusView(status: AnalysisStatus | null): {
  tone: string;
  label: string;
} {
  switch (status) {
    case 'queued':
      return { tone: 'watch', label: 'Queued' };
    case 'running':
      return { tone: 'watch', label: 'Checking sources' };
    case 'completed':
      return { tone: 'stable', label: 'Complete' };
    case 'failed':
      return { tone: 'watch', label: 'Incomplete' };
    case null:
      return { tone: 'unassessed', label: 'Not started' };
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

function ConfidencePill({
  confidence,
  assessing,
}: {
  confidence: AnalysisConfidence | null;
  assessing: boolean;
}) {
  if (assessing) {
    return <span className="risk-pill watch">Confidence pending</span>;
  }

  const view = confidenceView(confidence);
  return <span className={`risk-pill ${view.tone}`}>{view.label}</span>;
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
      return { tone: 'unassessed', label: 'Confidence pending' };
    default: {
      const unexpected: never = confidence;
      return unexpected;
    }
  }
}

function SanctionsPill({
  sanctionsHit,
  assessing,
}: {
  sanctionsHit: boolean | null;
  assessing: boolean;
}) {
  if (assessing) {
    return <span className="risk-pill watch">Sanctions pending</span>;
  }

  if (sanctionsHit === true) {
    return <span className="risk-pill critical">Sanctions hit</span>;
  }

  if (sanctionsHit === false) {
    return <span className="risk-pill stable">Sanctions clear</span>;
  }

  return <span className="risk-pill unassessed">Sanctions unknown</span>;
}
