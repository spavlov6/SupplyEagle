import {
  AIRSPACE_POINTS,
  GEOPOLITICAL_HIGH_POINTS,
  GEOPOLITICAL_MEDIUM_POINTS,
  PASSAGE_POINTS,
  PIRACY_HIGH_POINTS,
  PIRACY_MEDIUM_POINTS,
  SANCTIONED_END_POINTS,
} from './corridor';
import {
  COVERAGE_CAP,
  COVERAGE_POINT,
  IDENTITY_CONFLICT_POINTS,
  IDENTITY_PARTIAL_POINTS,
  IDENTITY_UNVERIFIED_POINTS,
  REGISTRY_INACTIVE_POINTS,
  SANCTIONS_HIT_POINTS,
  SANCTIONS_UNKNOWN_POINTS,
  SCORE_CAP,
  WARNING_POINTS,
  type RiskBand,
  type RiskImpact,
  type RiskScore,
} from './score';

export function RiskScoreCard({
  kind,
  result,
}: {
  kind: 'route' | 'supplier';
  result: RiskScore | null;
}) {
  return (
    <section className="card brief-card risk-score-card" aria-live="polite">
      <div className="risk-score-head">
        <div>
          <h2>Risk score</h2>
          <p className="risk-score-kicker">{kicker(kind)}</p>
        </div>
        {kind === 'supplier' && result ? <ScoreTotal result={result} /> : null}
        {!result ? (
          <p className="risk-score-pending">
            {kind === 'route'
              ? 'The score appears when the lane is placed.'
              : 'The score appears when the sources finish.'}
          </p>
        ) : null}
      </div>

      {result && kind === 'route' ? (
        <div className="risk-score-split">
          <RiskGauge result={result} />
          <FactorList factors={result.factors} />
        </div>
      ) : null}
      {result && kind === 'supplier' ? (
        <FactorList factors={result.factors} />
      ) : null}

      <ScoreLegend kind={kind} />
    </section>
  );
}

function kicker(kind: 'route' | 'supplier'): string {
  if (kind === 'route') {
    return 'Corridor exposure from the countries on this lane and how the cargo moves. Higher means more exposure.';
  }
  return `Higher means more exposure. The total stops at ${SCORE_CAP}.`;
}

function ScoreTotal({ result }: { result: RiskScore }) {
  return (
    <div className="risk-score-total">
      <p className={`risk-score-number ${result.band}`}>
        <span className="visually-hidden">Score </span>
        {result.total}
        <span className="risk-score-max">/{SCORE_CAP}</span>
      </p>
      <span className={`risk-pill ${result.band}`}>
        {bandLabel(result.band)}
      </span>
    </div>
  );
}

function RiskGauge({ result }: { result: RiskScore }) {
  const segments = result.factors.filter((factor) => factor.points > 0);
  return (
    <div className="risk-score-gauge">
      <p className={`risk-score-number ${result.band}`}>
        <span className="visually-hidden">Score </span>
        {result.total}
        <span className="risk-score-max">/{SCORE_CAP}</span>
      </p>
      <div
        className="risk-meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={SCORE_CAP}
        aria-valuenow={result.total}
        aria-label="Corridor risk"
      >
        <div
          className="risk-meter-stack"
          style={{ height: `${result.total}%` }}
        >
          {segments.map((factor) => (
            <span
              key={factor.title}
              className={`risk-meter-segment is-${factor.impact}`}
              style={{ flexGrow: factor.points }}
              title={`${factor.title} ${factor.points}`}
            />
          ))}
        </div>
      </div>
      <span className={`risk-pill ${result.band}`}>
        {bandLabel(result.band)}
      </span>
    </div>
  );
}

function FactorList({ factors }: { factors: RiskScore['factors'] }) {
  return (
    <ul className="risk-factors">
      {factors.map((factor) => (
        <li key={factor.title} className={`risk-factor is-${factor.impact}`}>
          <span className="risk-factor-mark" aria-hidden="true" />
          <div className="risk-factor-copy">
            <h3>{factor.title}</h3>
            <p>{factor.evidence}</p>
          </div>
          <div className="risk-factor-meta">
            <span className={`risk-pill ${impactTone(factor.impact)}`}>
              {impactLabel(factor.impact)}
            </span>
            <span className="risk-factor-points">{factor.points}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ScoreLegend({ kind }: { kind: 'route' | 'supplier' }) {
  return (
    <details className="score-legend">
      <summary>How this score is made</summary>
      <div className="score-legend-body">
        <p>
          Each factor adds its points once, using its strongest reading. The
          four totals are added, then capped at {SCORE_CAP}.
        </p>
        <ul className="score-bands">
          <li>
            <span className="risk-pill stable">0–19</span> Stable
          </li>
          <li>
            <span className="risk-pill watch">20–39</span> Watch
          </li>
          <li>
            <span className="risk-pill elevated">40–69</span> Elevated
          </li>
          <li>
            <span className="risk-pill critical">70–{SCORE_CAP}</span> Critical
          </li>
        </ul>
        {kind === 'route' ? <RouteWeights /> : <SupplierWeights />}
        <p>
          A failed check, with nothing corroborated in that factor, adds{' '}
          {WARNING_POINTS} as a warning rather than a hazard.
        </p>
        {kind === 'route' ? (
          <p>
            Sea scores use the usual ocean route, not the straight line on the
            map. Air scores use the direct track. The status pill above stays
            the strongest live signal from the sources.
          </p>
        ) : (
          <p>
            Sanctions carry the most weight. Identity points reflect how well
            GLEIF and Wikidata agree. A source that could not be checked adds a
            warning.
          </p>
        )}
      </div>
    </details>
  );
}

function RouteWeights() {
  return (
    <>
      <p>
        Piracy applies only to sea lanes. A high corridor, such as the Gulf of
        Aden or the Gulf of Guinea, scores {PIRACY_HIGH_POINTS}. A lesser one,
        such as Malacca on its own, scores {PIRACY_MEDIUM_POINTS}. Geopolitical
        exposure scores {GEOPOLITICAL_HIGH_POINTS} for the Red Sea, Hormuz, the
        Black Sea, or an end country in active conflict, and{' '}
        {GEOPOLITICAL_MEDIUM_POINTS} for a tension sea such as the South China
        Sea. An origin or destination under a broad sanctions program — Russia,
        Belarus, Iran, Syria, North Korea, or Cuba — scores{' '}
        {SANCTIONED_END_POINTS}. A sea passage through a major canal or strait
        scores {PASSAGE_POINTS}. A direct air track through restricted airspace
        scores {AIRSPACE_POINTS}.
      </p>
    </>
  );
}

function SupplierWeights() {
  return (
    <ul className="score-weights">
      <li>Sanctions hit {SANCTIONS_HIT_POINTS}</li>
      <li>Sanctions unknown {SANCTIONS_UNKNOWN_POINTS}</li>
      <li>Conflicting identity {IDENTITY_CONFLICT_POINTS}</li>
      <li>Unverified identity {IDENTITY_UNVERIFIED_POINTS}</li>
      <li>Partial identity {IDENTITY_PARTIAL_POINTS}</li>
      <li>Inactive registry {REGISTRY_INACTIVE_POINTS}</li>
      <li>
        Each failed source {COVERAGE_POINT}, up to {COVERAGE_CAP}
      </li>
    </ul>
  );
}

function bandLabel(band: RiskBand): string {
  switch (band) {
    case 'stable':
      return 'Stable';
    case 'watch':
      return 'Watch';
    case 'elevated':
      return 'Elevated';
    case 'critical':
      return 'Critical';
    default: {
      const unexpected: never = band;
      return unexpected;
    }
  }
}

function impactLabel(impact: RiskImpact): string {
  switch (impact) {
    case 'clear':
      return 'Clear';
    case 'warning':
      return 'Warning';
    case 'watch':
      return 'Watch';
    case 'elevated':
      return 'Elevated';
    case 'critical':
      return 'Critical';
    default: {
      const unexpected: never = impact;
      return unexpected;
    }
  }
}

function impactTone(impact: RiskImpact): string {
  switch (impact) {
    case 'clear':
      return 'stable';
    case 'warning':
      return 'warning';
    case 'watch':
      return 'watch';
    case 'elevated':
      return 'elevated';
    case 'critical':
      return 'critical';
    default: {
      const unexpected: never = impact;
      return unexpected;
    }
  }
}
