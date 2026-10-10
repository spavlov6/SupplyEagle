import { Link, useParams } from 'react-router';
import {
  useAcceptRecommendation,
  useDismissRecommendation,
  useRecommendation,
} from './use-recommendations';

export function RecommendationPage() {
  const { recommendationId } = useParams();
  const recommendation = useRecommendation(recommendationId);
  const accept = useAcceptRecommendation();
  const dismiss = useDismissRecommendation();
  const item = recommendation.data;

  return (
    <main className="workspace">
      <p className="eyebrow">
        <Link to="/recommendations">Recommendations</Link>
      </p>
      {recommendation.isPending ? <p>Loading…</p> : null}
      {recommendation.isError ? (
        <p className="status error">Recommendation not found.</p>
      ) : null}
      {item ? (
        <article className="card panel-card">
          <h1>{item.title}</h1>
          <p>{item.description}</p>
          <p className="detail-meta">
            <span className="risk-pill stable">
              {item.type.replaceAll('_', ' ')}
            </span>
            <span>Priority {item.priority}</span>
            <span className="meta-status">{item.status}</span>
          </p>
          <p className="related-links">
            {item.supplierId ? (
              <Link to={`/suppliers/${item.supplierId}`}>
                {item.supplierName ?? 'Supplier'}
              </Link>
            ) : null}
            {item.routeId ? (
              <Link to={`/routes/${item.routeId}`}>
                {item.routeLabel ?? 'Route'}
              </Link>
            ) : null}
            {item.alternativeSupplierId ? (
              <Link to={`/suppliers/${item.alternativeSupplierId}`}>
                Alternative: {item.alternativeSupplierName ?? 'Supplier'}
              </Link>
            ) : null}
            {item.alternativeRouteId ? (
              <Link to={`/routes/${item.alternativeRouteId}`}>
                Alternative: {item.alternativeRouteLabel ?? 'Route'}
              </Link>
            ) : null}
          </p>
          {item.plan ? (
            <ol>
              {item.plan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {item.status === 'pending' ? (
            <div className="row-actions">
              <button
                type="button"
                disabled={accept.isPending}
                onClick={() => accept.mutate(item.id)}
              >
                Accept
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(item.id)}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </article>
      ) : null}
    </main>
  );
}
