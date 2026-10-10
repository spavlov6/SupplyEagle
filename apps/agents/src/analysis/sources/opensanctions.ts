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

const MATCH_URL = 'https://api.opensanctions.org/match/default';

export async function fetchOpenSanctions(
  name: string,
  fetchImpl: typeof fetch = fetch,
  apiKey: string | null = null,
): Promise<SourceResult> {
  try {
    const response = await fetchImpl(MATCH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': USER_AGENT,
        ...(apiKey ? { authorization: `ApiKey ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        queries: {
          supplier: {
            schema: 'Organization',
            properties: { name: [name] },
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status === 401) {
      return errorResult('OpenSanctions requires AGENTS_OPENSANCTIONS_API_KEY');
    }

    if (!response.ok) {
      return errorResult(`OpenSanctions returned ${response.status}`);
    }

    return parseOpenSanctions(await response.json(), name);
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : 'OpenSanctions request failed',
    );
  }
}

export function parseOpenSanctions(body: unknown, queryName: string): SourceResult {
  const results = readResults(body);
  for (const result of results) {
    if (!isStrongMatch(result)) {
      continue;
    }

    const label = candidateName(result);
    if (!label || !namesCompatible(queryName, label)) {
      continue;
    }

    const id = asString(result.id);
    return foundResult({
      label,
      url: id
        ? `https://www.opensanctions.org/entities/${encodeURIComponent(id)}`
        : 'https://www.opensanctions.org/',
      legalName: label,
      country: firstString(result.properties, 'country'),
      sanctionsHit: true,
    });
  }

  return notFoundResult(false);
}

function readResults(body: unknown): Record<string, unknown>[] {
  if (!isRecord(body) || !isRecord(body.responses)) {
    return [];
  }

  const response = body.responses.supplier;
  if (!isRecord(response) || !Array.isArray(response.results)) {
    return [];
  }

  return response.results.filter(isRecord);
}

function isStrongMatch(result: Record<string, unknown>): boolean {
  if (result.match === true) {
    return true;
  }

  return typeof result.score === 'number' && result.score >= 0.8;
}

function candidateName(result: Record<string, unknown>): string | null {
  const caption = asString(result.caption);
  if (caption) {
    return caption;
  }

  return firstString(result.properties, 'name');
}

function firstString(properties: unknown, key: string): string | null {
  if (!isRecord(properties)) {
    return null;
  }

  const value = properties[key];
  if (Array.isArray(value)) {
    return asString(value[0]);
  }

  return asString(value);
}
