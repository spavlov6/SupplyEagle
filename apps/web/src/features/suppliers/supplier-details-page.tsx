import type {
  AnalysisConfidence,
  AnalysisStatus,
  SourceName,
  SupplierAnalysis,
  SupplierSourceCheck,
} from '@supplyeagle/types';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../lib/api-client';
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
        <header className="suppliers-heading">
          <div>
            <h1>Supplier</h1>
            <p className="suppliers-subtitle">Loading supplier…</p>
          </div>
        </header>
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
      <h1>{notFound ? 'Supplier not found' : 'Could not load this supplier'}</h1>
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

  return (
    <>
      <header className="suppliers-heading">
        <div>
          <h1>{name}</h1>
          <p className="suppliers-subtitle">
            {country ?? 'Country not verified yet'}
          </p>
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
            <StatusPill status={analysis?.status ?? null} />
            <ConfidencePill confidence={analysis?.confidence ?? null} />
            <SanctionsPill sanctionsHit={analysis?.sanctionsHit ?? null} />
          </div>
          {reassessError ? <p className="form-error">{reassessError}</p> : null}
        </div>
      </header>

      <VerificationBrief analysis={analysis} />
      <CompanyProfile analysis={analysis} />

      <section className="source-section" aria-label="Verification sources">
        <h2>Sources</h2>
        <ul className="source-list">
          {orderedSources(analysis).map((source) => (
            <SourceRow key={source.source} source={source} />
          ))}
        </ul>
      </section>
    </>
  );
}

function VerificationBrief({ analysis }: { analysis: SupplierAnalysis | null }) {
  return (
    <section className="card brief-card" aria-live="polite">
      <h2>Verification</h2>
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
                    <a className="text-link" href={item.href} target="_blank" rel="noreferrer">
                      {item.hrefLabel}
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="profile-decision">Verification has not started.</p>
      )}
    </section>
  );
}

function CompanyProfile({ analysis }: { analysis: SupplierAnalysis | null }) {
  const facts = companyFacts(analysis);
  const rows = factRows(facts);

  return (
    <section className="card profile-card" aria-live="polite">
      <div className="profile-heading">
        <h2>Company</h2>
        {facts.entityStatus ? (
          <span className={`risk-pill ${facts.entityStatus === 'ACTIVE' ? 'stable' : 'watch'}`}>
            {registryStatusLabel(facts.entityStatus)}
          </span>
        ) : null}
      </div>
      {facts.description ? <p className="profile-description">{facts.description}</p> : null}
      {rows.length > 0 ? (
        <dl className="profile-grid">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                <FactValue row={row} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="detail profile-empty">Company details appear as the sources finish.</p>
      )}
    </section>
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
  const place = countryPhrase(analysis.country ?? gleif.country ?? wikidata.country);
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
  const matched = gleif.status === 'found' ? gleif : wikidata.status === 'found' ? wikidata : null;
  if (!matched) {
    return 'Only one identity source matched.';
  }

  const other = matched.source === 'gleif' ? wikidata : gleif;
  const place = countryPhrase(matched.country ?? analysis.country);
  const gap = other.source === 'gleif' ? gleifGap(other) : sourceState(other);
  return `${sourceTitle(matched.source)} matched ${matched.label ?? 'this company'}${place}. ${gap}`;
}

function conflictingText(gleif: SupplierSourceCheck, wikidata: SupplierSourceCheck): string {
  return `${matchedPlace(gleif)} ${matchedPlace(wikidata)}`.trim();
}

function unverifiedText(gleif: SupplierSourceCheck, wikidata: SupplierSourceCheck): string {
  if (gleif.status === 'not_found' && wikidata.status === 'not_found') {
    return 'GLEIF and Wikidata found no matching record.';
  }

  return `${sourceState(gleif)} ${sourceState(wikidata)}`.trim();
}

function checkingText(gleif: SupplierSourceCheck, wikidata: SupplierSourceCheck): string {
  if (gleif.status === 'pending' && wikidata.status === 'pending') {
    return 'Checking GLEIF and Wikidata.';
  }

  return `${sourceState(gleif)} ${sourceState(wikidata)}`.trim();
}

function sanctionsItem(analysis: SupplierAnalysis, source: SupplierSourceCheck): BriefItem {
  if (analysis.sanctionsHit === true || source.sanctionsHit === true) {
    const label = source.label ?? analysis.legalName ?? 'this company';
    return {
      label: 'Sanctions',
      text: `OpenSanctions matched ${label} and flagged a record.`,
      href: source.url ?? undefined,
      hrefLabel: 'Review record',
    };
  }

  if (analysis.sanctionsHit === false || source.status === 'not_found' || source.status === 'found') {
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
      return 'GLEIF found no record, so no LEI is on file.';
    case 'error':
      return 'GLEIF could not be checked, so no LEI is on file.';
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

  const withArticle = /^(United|Netherlands|Czech|Philippines|Bahamas|Gambia|Maldives|Seychelles)/.test(
    country,
  );
  return withArticle ? ` in the ${country}` : ` in ${country}`;
}

function FactValue({ row }: { row: FactRow }) {
  if (row.kind === 'link') {
    return (
      <a className="text-link" href={row.value} target="_blank" rel="noreferrer">
        {websiteLabel(row.value)}
      </a>
    );
  }

  return <span className={row.kind === 'code' ? 'profile-code' : undefined}>{row.value}</span>;
}

type FactKind = 'text' | 'code' | 'link';

type FactRow = {
  label: string;
  value: string;
  kind: FactKind;
};

type CompanyFacts = {
  legalName: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  lei: string | null;
  registrationNumber: string | null;
  founded: string | null;
  entityStatus: string | null;
  website: string | null;
  description: string | null;
};

function companyFacts(analysis: SupplierAnalysis | null): CompanyFacts {
  const gleif = analysis?.sources.find((source) => source.source === 'gleif');
  const wikidata = analysis?.sources.find((source) => source.source === 'wikidata');

  return {
    legalName: analysis?.legalName ?? gleif?.label ?? null,
    country: analysis?.country ?? gleif?.country ?? wikidata?.country ?? null,
    city: gleif?.city ?? null,
    address: gleif?.address ?? null,
    lei: gleif?.lei ?? null,
    registrationNumber: gleif?.registrationNumber ?? null,
    founded: wikidata?.founded ?? gleif?.founded ?? null,
    entityStatus: gleif?.entityStatus ?? null,
    website: wikidata?.website ?? null,
    description: wikidata?.description ?? null,
  };
}

function factRows(facts: CompanyFacts): FactRow[] {
  const rows: FactRow[] = [];
  const add = (label: string, value: string | null, kind: FactKind = 'text') => {
    if (value) {
      rows.push({ label, value, kind });
    }
  };

  add('Legal name', facts.legalName);
  add('Country', facts.country);
  add('City', facts.city);
  add('Address', facts.address);
  add('LEI', facts.lei, 'code');
  add('Registration', facts.registrationNumber, 'code');
  add('Founded', facts.founded);
  add('Website', facts.website, 'link');
  return rows;
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

function orderedSources(analysis: SupplierAnalysis | null): SupplierSourceCheck[] {
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

function SourceRow({ source }: { source: SupplierSourceCheck }) {
  const detail = sourceDetail(source);

  return (
    <li className="source-row">
      <div className="source-name">
        <h3>{sourceTitle(source.source)}</h3>
        <p className={`status ${sourceTone(source)}`}>{sourceSummary(source)}</p>
      </div>
      <p className="source-detail">{detail}</p>
      {source.url ? (
        <a className="text-link" href={source.url} target="_blank" rel="noreferrer">
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

function sourceSummary(source: SupplierSourceCheck): string {
  switch (source.status) {
    case 'pending':
      return 'Checking…';
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
  if (source.status === 'error' || (source.source === 'opensanctions' && source.sanctionsHit)) {
    return 'error';
  }

  if (source.status === 'found') {
    return 'ok';
  }

  return '';
}

function StatusPill({ status }: { status: AnalysisStatus | null }) {
  const view = statusView(status);
  return <span className={`risk-pill ${view.tone}`}>{view.label}</span>;
}

function statusView(status: AnalysisStatus | null): { tone: string; label: string } {
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

function ConfidencePill({ confidence }: { confidence: AnalysisConfidence | null }) {
  const view = confidenceView(confidence);
  return <span className={`risk-pill ${view.tone}`}>{view.label}</span>;
}

function confidenceView(
  confidence: AnalysisConfidence | null,
): { tone: string; label: string } {
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

function SanctionsPill({ sanctionsHit }: { sanctionsHit: boolean | null }) {
  if (sanctionsHit === true) {
    return <span className="risk-pill critical">Sanctions hit</span>;
  }

  if (sanctionsHit === false) {
    return <span className="risk-pill stable">Sanctions clear</span>;
  }

  return <span className="risk-pill unassessed">Sanctions unknown</span>;
}
