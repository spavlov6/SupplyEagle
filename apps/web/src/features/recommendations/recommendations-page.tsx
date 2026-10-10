import { Link, useSearchParams } from 'react-router';
import type { RecommendationStatus } from '@supplyeagle/types';
import { useRecommendations } from './use-recommendations';

const FILTERS: RecommendationStatus[] = ['pending', 'accepted', 'dismissed'];

export function RecommendationsPage() {
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get('status'));
  const recommendations = useRecommendations(status);

  return (
    <main className="workspace">
      <header>
        <h1>Recommendations</h1>
      </header>
      <div className="filter-row">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={
              filter === status ? 'filter-chip current' : 'filter-chip'
            }
            onClick={() =>
              setParams(filter === 'pending' ? {} : { status: filter })
            }
          >
            {filter}
          </button>
        ))}
      </div>
      <section className="card suppliers-card" aria-live="polite">
        {recommendations.isPending ? (
          <p className="panel-pad">Loading…</p>
        ) : null}
        {recommendations.isError ? (
          <p className="panel-pad status error">
            Recommendations could not be loaded.
          </p>
        ) : null}
        {recommendations.data &&
        recommendations.data.recommendations.length === 0 ? (
          <p className="panel-pad">No {status} recommendations.</p>
        ) : null}
        {recommendations.data &&
        recommendations.data.recommendations.length > 0 ? (
          <ul className="recommendation-list">
            {recommendations.data.recommendations.map((item) => (
              <li key={item.id}>
                <div>
                  <Link
                    to={`/recommendations/${item.id}`}
                    className="supplier-name"
                  >
                    {item.title}
                  </Link>
                  <p className="supplier-place">{item.description}</p>
                </div>
                <span className="muted-cell">Priority {item.priority}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

function parseStatus(value: string | null): RecommendationStatus {
  if (value === 'accepted' || value === 'dismissed') {
    return value;
  }
  return 'pending';
}
