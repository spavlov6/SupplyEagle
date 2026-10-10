import { asString, errorMessage, isRecord, requestJson, requestText } from './http.js';
import {
  normalizeDomain,
  type LaneEnd,
  type NewsHazard,
  type NewsProvider,
  type NewsReport,
} from './signals.js';

type Article = {
  title: string;
  url: string | null;
  domain: string | null;
};

const HAZARD_PATTERNS: ReadonlyArray<{ hazard: NewsHazard; pattern: RegExp }> = [
  { hazard: 'closure', pattern: /\b(closure|closures|closed|shutdown|shut down|shuts down)\b/i },
  { hazard: 'strike', pattern: /\b(strike|strikes|walkout|walkouts)\b/i },
  { hazard: 'congestion', pattern: /\b(congestion|congested|backlog|gridlock)\b/i },
  { hazard: 'storm', pattern: /\b(storm|storms|typhoon|hurricane|cyclone)\b/i },
  { hazard: 'conflict', pattern: /\b(conflict|war|airstrike|missile|fighting)\b/i },
];

export async function fetchGdelt(
  places: Array<{ end: LaneEnd; name: string }>,
): Promise<{ reports: NewsReport[]; error: string | null }> {
  return fetchPlaces('gdelt', places, gdeltArticles);
}

export async function fetchGoogleNews(
  places: Array<{ end: LaneEnd; name: string }>,
): Promise<{ reports: NewsReport[]; error: string | null }> {
  return fetchPlaces('google_news', places, googleArticles);
}

export async function fetchReliefWebNews(
  places: Array<{ end: LaneEnd; name: string }>,
): Promise<{ reports: NewsReport[]; error: string | null }> {
  return fetchPlaces('reliefweb', places, reliefWebArticles);
}

async function fetchPlaces(
  provider: NewsProvider,
  places: Array<{ end: LaneEnd; name: string }>,
  load: (placeName: string) => Promise<Article[]>,
): Promise<{ reports: NewsReport[]; error: string | null }> {
  const reports: NewsReport[] = [];
  const errors: string[] = [];
  for (const place of places) {
    try {
      const articles = await load(place.name);
      reports.push(...reportsFromArticles(provider, place.end, place.name, articles));
    } catch (error) {
      errors.push(errorMessage(error, `${provider} request failed`));
    }
  }

  if (reports.length === 0 && errors.length === places.length) {
    return { reports: [], error: errors[0] ?? `${provider} request failed` };
  }

  return { reports, error: null };
}

export function reportsFromArticles(
  provider: NewsProvider,
  place: LaneEnd,
  placeName: string,
  articles: Article[],
): NewsReport[] {
  const reports: NewsReport[] = [];
  for (const article of articles.slice(0, 20)) {
    if (!mentionsPlace(article.title, placeName)) {
      continue;
    }

    const domain = article.domain ? normalizeDomain(article.domain) : '';
    for (const hazard of classifyHeadline(article.title)) {
      reports.push({
        provider,
        place,
        hazard,
        domains: domain ? [domain] : [],
        headline: article.title,
        url: article.url,
      });
    }
  }

  return reports;
}

export function classifyHeadline(title: string): NewsHazard[] {
  return HAZARD_PATTERNS.filter((item) => item.pattern.test(title)).map((item) => item.hazard);
}

export function mentionsPlace(text: string, place: string): boolean {
  const tokens = place
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  if (tokens.length === 0) {
    return true;
  }

  const haystack = text.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

async function gdeltArticles(placeName: string): Promise<Article[]> {
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set(
    'query',
    `"${placeName}" (closure OR closed OR shutdown OR strike OR walkout OR congestion OR storm OR conflict)`,
  );
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', '25');
  url.searchParams.set('timespan', '7d');
  const body = await requestJson(url.toString());
  if (!isRecord(body) || !Array.isArray(body.articles)) {
    return [];
  }

  const articles: Article[] = [];
  for (const row of body.articles) {
    if (!isRecord(row)) {
      continue;
    }

    const title = asString(row.title);
    if (!title) {
      continue;
    }

    articles.push({
      title: decodeBasic(title),
      url: asString(row.url),
      domain: asString(row.domain) ?? asString(row.url),
    });
  }

  return articles;
}

async function googleArticles(placeName: string): Promise<Article[]> {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set(
    'q',
    `${placeName} (closure OR strike OR congestion OR storm OR conflict)`,
  );
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');
  const xml = await requestText(url.toString(), 'application/rss+xml, application/xml, text/xml');
  return rssArticles(xml);
}

async function reliefWebArticles(placeName: string): Promise<Article[]> {
  const url = new URL('https://api.reliefweb.int/v1/reports');
  url.searchParams.set('appname', 'supplyeagle');
  url.searchParams.set('query[value]', `${placeName} closure strike congestion storm conflict`);
  url.searchParams.set('limit', '20');
  url.searchParams.set('profile', 'list');
  url.searchParams.set('preset', 'latest');
  const body = await requestJson(url.toString());
  if (!isRecord(body) || !Array.isArray(body.data)) {
    return [];
  }

  const articles: Article[] = [];
  for (const row of body.data) {
    if (!isRecord(row) || !isRecord(row.fields)) {
      continue;
    }

    const title = asString(row.fields.title);
    if (!title) {
      continue;
    }

    const source = Array.isArray(row.fields.source) ? row.fields.source.find(isRecord) : null;
    articles.push({
      title,
      url: asString(row.fields.url) ?? asString(row.href),
      domain: source ? asString(source.homepage) ?? asString(source.shortname) : null,
    });
  }

  return articles;
}

function rssArticles(xml: string): Article[] {
  const articles: Article[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1] ?? '';
    const title = decodeXml(tagText(block, 'title') ?? '');
    if (!title) {
      continue;
    }

    const source = /<source\b[^>]*\burl="([^"]+)"/i.exec(block);
    articles.push({
      title,
      url: decodeXml(tagText(block, 'link') ?? '') || null,
      domain: source?.[1] ? decodeXml(source[1]) : null,
    });
    if (articles.length >= 20) {
      break;
    }
  }

  return articles;
}

function tagText(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  return match?.[1]?.trim() ?? null;
}

function decodeXml(value: string): string {
  return decodeBasic(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
}

function decodeBasic(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
