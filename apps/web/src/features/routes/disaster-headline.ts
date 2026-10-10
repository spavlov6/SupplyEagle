export function focusDisasterHeadline(
  headline: string,
  country: string | null,
): string {
  const parsed = countryList(headline);
  if (!parsed) {
    return headline;
  }

  const match = country
    ? parsed.countries.find((name) => sameCountry(name, country))
    : null;
  if (match) {
    return `${parsed.lead} in ${match}`;
  }

  return `${parsed.lead} across a wide area`;
}

function countryList(
  headline: string,
): { lead: string; countries: string[] } | null {
  const match = headline.match(/^(.+?)\s+in\s+(.+)$/i);
  const lead = match?.[1]?.trim();
  const rest = match?.[2];
  if (!lead || !rest) {
    return null;
  }

  const countries = rest
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);
  if (countries.length < 4) {
    return null;
  }

  return { lead, countries };
}

function sameCountry(left: string, right: string): boolean {
  return normalizeCountry(left) === normalizeCountry(right);
}

function normalizeCountry(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
