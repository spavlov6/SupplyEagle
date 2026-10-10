import type { SourceFacts } from '@supplyeagle/types';

export type SourceResult = {
  status: 'found' | 'not_found' | 'error';
  label: string | null;
  url: string | null;
  facts: SourceFacts | null;
  error: string | null;
};

export const USER_AGENT = 'SupplyEagle/0.1 (supplier verification)';

export function notFoundResult(sanctionsHit: boolean | null): SourceResult {
  return {
    status: 'not_found',
    label: null,
    url: null,
    facts: {
      legalName: null,
      country: null,
      sanctionsHit,
      matched: false,
    },
    error: null,
  };
}

export function errorResult(message: string): SourceResult {
  return {
    status: 'error',
    label: null,
    url: null,
    facts: null,
    error: message,
  };
}

export function foundResult(input: {
  label: string;
  url: string;
  legalName: string;
  country: string | null;
  sanctionsHit: boolean | null;
  lei?: string | null;
  city?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  founded?: string | null;
  entityStatus?: string | null;
  website?: string | null;
  description?: string | null;
}): SourceResult {
  return {
    status: 'found',
    label: clip(input.label, 300),
    url: clip(input.url, 500),
    facts: {
      legalName: clip(input.legalName, 300),
      country: input.country ? clip(input.country, 80) : null,
      sanctionsHit: input.sanctionsHit,
      matched: true,
      lei: clipOptional(input.lei, 32),
      city: clipOptional(input.city, 80),
      address: clipOptional(input.address, 300),
      registrationNumber: clipOptional(input.registrationNumber, 80),
      founded: clipOptional(input.founded, 20),
      entityStatus: clipOptional(input.entityStatus, 40),
      website: clipOptional(input.website, 300),
      description: clipOptional(input.description, 400),
    },
    error: null,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function clipOptional(value: string | null | undefined, max: number): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? clip(trimmed, max) : null;
}
