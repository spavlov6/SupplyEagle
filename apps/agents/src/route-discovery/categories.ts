import type { RouteSourceCategory, RouteSourceName } from '@supplyeagle/types';

export const ROUTE_SOURCES = [
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

type CoveredSource = (typeof ROUTE_SOURCES)[number];
type MissingSource = Exclude<RouteSourceName, CoveredSource>;
type SourcesComplete = [MissingSource] extends [never] ? true : never;
const sourcesComplete: SourcesComplete = true;
void sourcesComplete;

export function categoryForSource(source: RouteSourceName): RouteSourceCategory {
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
