import type {
  AnalysisConfidence,
  SourceCheckStatus,
  SourceFacts,
  SourceName,
} from '@supplyeagle/types';
import { canonicalCountry, countriesMatch } from './countries.js';

export type ConfidenceCheck = {
  source: SourceName;
  status: SourceCheckStatus;
  facts: SourceFacts | null;
};

export type ConfidenceAssessment = {
  confidence: AnalysisConfidence;
  legalName: string | null;
  country: string | null;
  sanctionsHit: boolean | null;
};

type IdentityHit = {
  matched: boolean;
  legalName: string | null;
  country: string | null;
};

export function assessConfidence(checks: ConfidenceCheck[]): ConfidenceAssessment {
  const gleif = identityHit(checks, 'gleif');
  const wikidata = identityHit(checks, 'wikidata');
  const sanctionsHit = readSanctions(checks.find((check) => check.source === 'opensanctions'));

  if (gleif.matched && wikidata.matched) {
    if (countriesMatch(gleif.country, wikidata.country)) {
      return {
        confidence: 'verified',
        legalName: gleif.legalName ?? wikidata.legalName,
        country: canonicalCountry(gleif.country),
        sanctionsHit,
      };
    }

    return {
      confidence: 'conflicting',
      legalName: null,
      country: null,
      sanctionsHit,
    };
  }

  if (gleif.matched || wikidata.matched) {
    const hit = gleif.matched ? gleif : wikidata;
    return {
      confidence: 'partial',
      legalName: hit.legalName,
      country: canonicalCountry(hit.country),
      sanctionsHit,
    };
  }

  return {
    confidence: 'unverified',
    legalName: null,
    country: null,
    sanctionsHit,
  };
}

function identityHit(checks: ConfidenceCheck[], source: SourceName): IdentityHit {
  const check = checks.find((candidate) => candidate.source === source);
  const matched = check?.status === 'found' && check.facts?.matched === true;
  if (!matched || !check?.facts) {
    return { matched: false, legalName: null, country: null };
  }

  return {
    matched: true,
    legalName: check.facts.legalName,
    country: check.facts.country,
  };
}

function readSanctions(check: ConfidenceCheck | undefined): boolean | null {
  if (!check || check.status === 'pending' || check.status === 'error') {
    return null;
  }

  if (check.status === 'not_found') {
    return false;
  }

  return check.facts?.sanctionsHit === true;
}
