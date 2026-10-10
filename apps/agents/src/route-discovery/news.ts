import {
  asString,
  errorMessage,
  isRecord,
  requestJson,
  requestText,
} from './http.js';
import { reliefWebAppName } from './reliefweb.js';
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

const NEWS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const LANE =
  /\b(ports?|airports?|airlines?|flights?|shipping|cargo|freight|rail|railway|border|terminals?|docks?|harbou?rs?|seaports?|runways?|vessels?|containers?|workers?|unions?|dockworkers?)\b/i;
const WEATHER =
  /\b(typhoons?|hurricanes?|cyclones?|floods?|flooding|deadly storm|severe storm|tropical storm|storm surge)\b/i;
const SECURITY =
  /\b(airstrikes?|air strikes?|missiles?|fighting|armed conflict|military|invasion|shelling|drone strikes?)\b/i;
const CLOSURE = /\b(closure|closures|closed|shutdown|shut down|shuts down)\b/i;
const STRIKE = /\b(strike|strikes|walkout|walkouts)\b/i;
const CONGESTION = /\b(congestion|congested|backlog|gridlock)\b/i;
const STORM = /\b(storm|storms|typhoon|hurricane|cyclone)\b/i;
const CONFLICT = /\b(conflict|war|airstrike|air strike|missile|fighting)\b/i;

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
  const settled = await Promise.all(
    places.map(async (place) => {
      try {
        const articles = await load(place.name);
        return {
          reports: reportsFromArticles(
            provider,
            place.end,
            place.name,
            articles,
          ),
          error: null,
        };
      } catch (error) {
        return {
          reports: [],
          error: errorMessage(error, `${provider} request failed`),
        };
      }
    }),
  );
  const reports = settled.flatMap((item) => item.reports);
  const errors = settled.flatMap((item) => (item.error ? [item.error] : []));

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
  if (
    isSports(title) ||
    title.includes('?') ||
    /^\s*(will|could|might)\b/i.test(title)
  ) {
    return [];
  }

  const lane = LANE.test(title);
  const weather = WEATHER.test(title);
  const security = SECURITY.test(title);
  const hazards: NewsHazard[] = [];
  if (CLOSURE.test(title) && (lane || weather)) {
    hazards.push('closure');
  }
  if (STRIKE.test(title) && isLaborStrike(title) && !isResolved(title)) {
    hazards.push('strike');
  }
  if (CONGESTION.test(title) && lane) {
    hazards.push('congestion');
  }
  if (STORM.test(title) && weather) {
    hazards.push('storm');
  }
  if (CONFLICT.test(title) && security) {
    hazards.push('conflict');
  }

  return hazards;
}

function isLaborStrike(title: string): boolean {
  if (
    /\bstrike\s+(a |the |an )?(pole|truck|tree|building|bridge|aircraft|plane)\b/i.test(
      title,
    )
  ) {
    return false;
  }

  return (
    /\b(walkouts?|pickets?|workers?|unions?|employees?|dockworkers?)\b/i.test(
      title,
    ) ||
    /\b(port|airport|airline|rail|railway|dock|border|terminal)\b.{0,40}\b(strike|strikes)\b/i.test(
      title,
    ) ||
    /\b(strike|strikes)\b.{0,40}\b(port|airport|airline|rail|railway|dock|border|terminal)\b/i.test(
      title,
    )
  );
}

function isResolved(title: string): boolean {
  return /\b(is over|are over|has ended|have ended|ended|called off|averted)\b/i.test(
    title,
  );
}

function isSports(title: string): boolean {
  if (/\b(wta|atp|nba|nfl|mlb|premier league)\b/i.test(title)) {
    return true;
  }

  return (
    /\bvs\.?\b/i.test(title) && /\b(round|set|match|tennis|golf)\b/i.test(title)
  );
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

function laneQuery(placeName: string): string {
  return `"${placeName}" ${laneTerms()}`;
}

function laneTerms(): string {
  return '(airport OR port OR flight OR shipping OR rail OR border) (closure OR closed OR shutdown OR strike OR walkout OR congestion OR typhoon OR hurricane OR flood)';
}

async function googleArticles(placeName: string): Promise<Article[]> {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', `${laneQuery(placeName)} when:14d`);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');
  const xml = await requestText(
    url.toString(),
    'application/rss+xml, application/xml, text/xml',
  );
  return rssArticles(xml);
}

async function reliefWebArticles(placeName: string): Promise<Article[]> {
  const from = new Date(Date.now() - NEWS_WINDOW_MS).toISOString().slice(0, 10);
  const url = new URL('https://api.reliefweb.int/v2/reports');
  url.searchParams.set('appname', reliefWebAppName());
  url.searchParams.set('query[value]', laneQuery(placeName));
  url.searchParams.set('query[fields][]', 'title');
  url.searchParams.set('query[operator]', 'AND');
  url.searchParams.set('filter[field]', 'date.created');
  url.searchParams.set('filter[value][from]', `${from}T00:00:00+00:00`);
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

    const source = Array.isArray(row.fields.source)
      ? row.fields.source.find(isRecord)
      : null;
    articles.push({
      title,
      url: asString(row.fields.url) ?? asString(row.href),
      domain: source
        ? (asString(source.homepage) ?? asString(source.shortname))
        : null,
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
    const sourceName = decodeXml(tagText(block, 'source') ?? '');
    articles.push({
      title: headlineWithoutSource(title, sourceName),
      url: decodeXml(tagText(block, 'link') ?? '') || null,
      domain: source?.[1] ? decodeXml(source[1]) : null,
    });
    if (articles.length >= 20) {
      break;
    }
  }

  return articles;
}

function headlineWithoutSource(title: string, sourceName: string): string {
  const source = sourceName.trim();
  if (!source) {
    return title;
  }

  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

function tagText(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(
    block,
  );
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
