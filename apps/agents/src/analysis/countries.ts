const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const ALIASES: Record<string, string> = {
  uk: 'GB',
  usa: 'US',
  'united states of america': 'US',
  czechia: 'CZ',
  'czech republic': 'CZ',
  russia: 'RU',
  'russian federation': 'RU',
  vietnam: 'VN',
  'viet nam': 'VN',
  'south korea': 'KR',
  'republic of korea': 'KR',
  'north korea': 'KP',
};

export function canonicalCountry(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const candidate = ALIASES[trimmed.toLowerCase()] ?? trimmed;
  if (/^[a-z]{2}$/i.test(candidate)) {
    const code = candidate.toUpperCase();
    const name = regionNames.of(code);
    if (name && name.toUpperCase() !== code) {
      return name;
    }
  }

  return candidate;
}

export function countriesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = canonicalCountry(left);
  const b = canonicalCountry(right);
  if (!a || !b) {
    return false;
  }

  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}
