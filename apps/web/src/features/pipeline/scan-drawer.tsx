import { useEffect } from 'react';
import { Link } from 'react-router';
import type { PipelineRun } from '@supplyeagle/types';
import { useRecommendations } from '../recommendations/use-recommendations';
import { firstSentences } from './agent-label';

type DrawerLink = {
  id: string;
  label: string;
  to: string;
  tone?: string;
  mark?: string;
};

export function ScanDrawer({
  run,
  onClose,
}: {
  run: PipelineRun | null;
  onClose: () => void;
}) {
  const recommendations = useRecommendations('pending');

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recommendationRows = (
    recommendations.data?.recommendations ?? []
  ).slice(0, 4);
  const suppliers = unique([
    ...recommendationRows.flatMap((item) =>
      item.supplierId
        ? [
            {
              id: item.supplierId,
              label: item.supplierName ?? 'Supplier',
              to: `/suppliers/${item.supplierId}`,
            },
          ]
        : [],
    ),
  ]);
  const routes = unique([
    ...recommendationRows.flatMap((item) =>
      item.routeId
        ? [
            {
              id: item.routeId,
              label: item.routeLabel ?? 'Route',
              to: `/routes/${item.routeId}`,
            },
          ]
        : [],
    ),
  ]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="scan-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2 id="scan-drawer-title">Last Pipeline run</h2>
          </div>
          <button type="button" className="button-secondary" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="scan-summary">{shortSummary(run)}</p>
        <LinkList
          title="Recommendations"
          href="/recommendations"
          empty="No pending recommendations"
          items={recommendationRows.map((item) => ({
            id: item.id,
            label: item.title,
            to: `/recommendations/${item.id}`,
            tone: 'stable',
            mark: item.type.replaceAll('_', ' '),
          }))}
          onClose={onClose}
        />
        <LinkList
          title="Suppliers"
          empty="None affected"
          items={suppliers}
          onClose={onClose}
        />
        <LinkList
          title="Routes"
          empty="None affected"
          items={routes}
          onClose={onClose}
        />
      </aside>
    </div>
  );
}

function LinkList({
  title,
  href,
  empty,
  items,
  onClose,
}: {
  title: string;
  href?: string;
  empty: string;
  items: DrawerLink[];
  onClose: () => void;
}) {
  return (
    <section>
      <h3>
        {href ? (
          <Link to={href} onClick={onClose}>
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      {items.length === 0 ? (
        <p className="drawer-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link className="drawer-row" to={item.to} onClick={onClose}>
                {item.tone ? (
                  <span className={`risk-pill ${item.tone}`}>
                    {item.mark ?? item.tone}
                  </span>
                ) : (
                  <span className="drawer-dot" aria-hidden="true" />
                )}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function shortSummary(run: PipelineRun | null): string {
  const text = run?.stages.find(
    (stage) => stage.agentName === 'supply_risk',
  )?.summary;
  if (!text) {
    return 'No scan has finished yet.';
  }
  return firstSentences(text, 2);
}

function unique(rows: DrawerLink[]): DrawerLink[] {
  const seen = new Set<string>();
  const links: DrawerLink[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    links.push(row);
  }
  return links;
}
