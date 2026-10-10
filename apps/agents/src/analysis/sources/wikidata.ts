import { namesCompatible } from '../names.js';
import {
  USER_AGENT,
  asString,
  errorResult,
  foundResult,
  isRecord,
  notFoundResult,
  type SourceResult,
} from '../source-result.js';

const SPARQL_URL = 'https://query.wikidata.org/sparql';

export async function fetchWikidata(
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceResult> {
  try {
    const response = await fetchImpl(SPARQL_URL, {
      method: 'POST',
      headers: {
        accept: 'application/sparql-results+json',
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': USER_AGENT,
      },
      body: new URLSearchParams({ query: organizationQuery(name) }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      return errorResult(`Wikidata returned ${response.status}`);
    }

    return parseWikidata(await response.json(), name);
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : 'Wikidata request failed',
    );
  }
}

export function parseWikidata(body: unknown, queryName: string): SourceResult {
  if (!isRecord(body) || !isRecord(body.results) || !Array.isArray(body.results.bindings)) {
    return notFoundResult(null);
  }

  for (const binding of body.results.bindings) {
    if (!isRecord(binding)) {
      continue;
    }

    const label = bindingValue(binding.itemLabel);
    if (!label || !namesCompatible(queryName, label)) {
      continue;
    }

    const itemUrl = (bindingValue(binding.item) ?? 'https://www.wikidata.org/').replace(
      'http://www.wikidata.org/',
      'https://www.wikidata.org/',
    );
    return foundResult({
      label,
      url: itemUrl,
      legalName: label,
      country: bindingValue(binding.countryLabel),
      sanctionsHit: null,
      website: bindingValue(binding.website),
      description: bindingValue(binding.description),
      founded: yearOf(bindingValue(binding.inception)),
    });
  }

  return notFoundResult(null);
}

function organizationQuery(name: string): string {
  const search = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ');
  return `
SELECT ?item ?itemLabel ?countryLabel ?website ?description ?inception WHERE {
  {
    SELECT DISTINCT ?item WHERE {
      SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:endpoint "www.wikidata.org";
                        wikibase:api "EntitySearch";
                        mwapi:search "${search}";
                        mwapi:language "en".
        ?item wikibase:apiOutputItem mwapi:item.
      }
      ?item wdt:P31 ?type.
      VALUES ?type { wd:Q43229 wd:Q4830453 wd:Q783794 wd:Q891723 wd:Q167037 wd:Q6881511 wd:Q161726 }
    }
    LIMIT 5
  }
  OPTIONAL { ?item wdt:P17 ?country. }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL {
    ?item schema:description ?description.
    FILTER (LANG(?description) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 20`.trim();
}

function bindingValue(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return asString(value.value);
}

function yearOf(value: string | null): string | null {
  const year = value?.match(/\d{4}/)?.[0];
  return year ?? null;
}
