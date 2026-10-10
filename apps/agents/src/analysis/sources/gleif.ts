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

export async function fetchGleif(
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceResult> {
  try {
    const fuzzyUrl = new URL('https://api.gleif.org/api/v1/fuzzycompletions');
    fuzzyUrl.searchParams.set('field', 'entity.legalName');
    fuzzyUrl.searchParams.set('q', name);
    const fuzzyResponse = await fetchImpl(fuzzyUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!fuzzyResponse.ok) {
      return errorResult(`GLEIF returned ${fuzzyResponse.status}`);
    }

    const lei = selectFuzzyLei(await fuzzyResponse.json(), name);
    if (!lei) {
      return notFoundResult(null);
    }

    const recordResponse = await fetchImpl(
      `https://api.gleif.org/api/v1/lei-records/${encodeURIComponent(lei)}`,
      {
        headers: {
          accept: 'application/vnd.api+json',
          'user-agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!recordResponse.ok) {
      return errorResult(`GLEIF returned ${recordResponse.status}`);
    }

    return parseGleif(asRecordCollection(await recordResponse.json()), name);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'GLEIF request failed');
  }
}

export function selectFuzzyLei(body: unknown, queryName: string): string | null {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    return null;
  }

  for (const row of body.data) {
    if (!isRecord(row) || !isRecord(row.attributes)) {
      continue;
    }

    const value = asString(row.attributes.value);
    const lei = readFuzzyLei(row);
    if (!value || !lei || !namesCompatible(queryName, value)) {
      continue;
    }

    return lei;
  }

  return null;
}

export function parseGleif(body: unknown, queryName: string): SourceResult {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    return notFoundResult(null);
  }

  for (const record of body.data) {
    if (!isRecord(record) || !isRecord(record.attributes)) {
      continue;
    }

    const entity = record.attributes.entity;
    const legalName = readLegalName(entity);
    if (!legalName || !namesCompatible(queryName, legalName)) {
      continue;
    }

    const lei = asString(record.attributes.lei) ?? asString(record.id);
    return foundResult({
      label: legalName,
      url: lei
        ? `https://search.gleif.org/#/record/${encodeURIComponent(lei)}`
        : 'https://search.gleif.org/',
      legalName,
      country: readCountry(entity),
      sanctionsHit: null,
      lei,
      city: readCity(entity),
      address: readAddress(entity),
      registrationNumber: readRegisteredAs(entity),
      founded: readFounded(entity),
      entityStatus: readStatus(entity),
    });
  }

  return notFoundResult(null);
}

function readLegalName(entity: unknown): string | null {
  if (!isRecord(entity)) {
    return null;
  }

  if (typeof entity.legalName === 'string') {
    return asString(entity.legalName);
  }

  if (isRecord(entity.legalName)) {
    return asString(entity.legalName.name);
  }

  return null;
}

function readFuzzyLei(row: Record<string, unknown>): string | null {
  if (!isRecord(row.relationships) || !isRecord(row.relationships['lei-records'])) {
    return null;
  }

  const relation = row.relationships['lei-records'];
  if (!isRecord(relation.data)) {
    return null;
  }

  return asString(relation.data.id);
}

function asRecordCollection(body: unknown): unknown {
  if (isRecord(body) && isRecord(body.data)) {
    return { data: [body.data] };
  }

  return body;
}

function readCountry(entity: unknown): string | null {
  return asString(legalAddress(entity)?.country);
}

function readCity(entity: unknown): string | null {
  return asString(legalAddress(entity)?.city);
}

function readAddress(entity: unknown): string | null {
  const address = legalAddress(entity);
  if (!address) {
    return null;
  }

  const lines = Array.isArray(address.addressLines)
    ? address.addressLines
        .map(asString)
        .filter((line): line is string => line !== null)
    : [];
  const postalCode = asString(address.postalCode);
  const parts = [...lines, postalCode].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(', ') : null;
}

function readRegisteredAs(entity: unknown): string | null {
  if (!isRecord(entity)) {
    return null;
  }

  return asString(entity.registeredAs);
}

function readFounded(entity: unknown): string | null {
  if (!isRecord(entity)) {
    return null;
  }

  return yearOf(asString(entity.creationDate));
}

function readStatus(entity: unknown): string | null {
  if (!isRecord(entity)) {
    return null;
  }

  return asString(entity.status);
}

function legalAddress(entity: unknown): Record<string, unknown> | null {
  if (!isRecord(entity) || !isRecord(entity.legalAddress)) {
    return null;
  }

  return entity.legalAddress;
}

function yearOf(value: string | null): string | null {
  const year = value?.match(/\d{4}/)?.[0];
  return year ?? null;
}
