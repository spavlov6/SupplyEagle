import type {
  RouteAgreement,
  RouteSourceFacts,
  RouteSourceName,
} from '@supplyeagle/types';
import { clip } from './http.js';
import { assessRouteRisk, type RouteRiskDecision } from './risk.js';
import {
  confirmDisasters,
  confirmWeather,
  confirmedNews,
  propagateSuppliers,
  type DisasterProvider,
  type DisasterReport,
  type LaneEnd,
  type NewsProvider,
  type NewsReport,
  type SupplierFlagInput,
  type SupplierPropagation,
  type WeatherProvider,
  type WeatherReading,
} from './signals.js';

export type DiscoveryBag = {
  news: NewsReport[];
  weather: WeatherReading[];
  disasters: DisasterReport[];
  suppliers: SupplierFlagInput[];
  placeNames: Record<LaneEnd, string>;
  errors: Partial<Record<RouteSourceName, string>>;
};

export type FinishedCheck = {
  label: string | null;
  url: string | null;
  facts: RouteSourceFacts;
};

export function summarizeDiscovery(bag: DiscoveryBag): {
  decision: RouteRiskDecision;
  checks: Record<RouteSourceName, FinishedCheck>;
} {
  const news = confirmedNews(bag.news);
  const weather = confirmWeather(bag.weather, bag.placeNames);
  const disasters = confirmDisasters(bag.disasters);
  const supplier = propagateSuppliers(bag.suppliers);
  const decision = assessRouteRisk({
    news: news.map((item) => ({ hazard: item.hazard, why: item.headline })),
    disasters: disasters.map((item) => ({ why: item.headline })),
    weather: weather.map((item) => ({ why: item.why, extreme: item.extreme })),
    supplier: supplier ? { level: supplier.level, why: supplier.why } : null,
  });
  const newsConfirmed = news.length > 0;
  const weatherConfirmed = weather.length > 0;
  const disasterConfirmed = disasters.length > 0;
  const weatherLabel = weather[0]?.why ?? null;

  return {
    decision,
    checks: {
      gdelt: finishNews('gdelt', bag, newsConfirmed),
      google_news: finishNews('google_news', bag, newsConfirmed),
      reliefweb: finishRelief(bag, newsConfirmed, disasterConfirmed),
      open_meteo: finishWeather('open_meteo', bag, weatherConfirmed, weatherLabel),
      met_norway: finishWeather('met_norway', bag, weatherConfirmed, weatherLabel),
      gdacs: finishDisaster('gdacs', bag, disasterConfirmed),
      eonet: finishDisaster('eonet', bag, disasterConfirmed),
      usgs: finishDisaster('usgs', bag, disasterConfirmed),
      supplier_propagation: finishSupplier(bag, supplier),
    },
  };
}

function finishNews(
  provider: NewsProvider,
  bag: DiscoveryBag,
  confirmed: boolean,
): FinishedCheck {
  const own = bag.news.filter((report) => report.provider === provider);
  return fromReports({
    category: 'news',
    confirmed,
    headline: own[0]?.headline ?? null,
    url: own[0]?.url ?? null,
    hazard: own[0]?.hazard ?? null,
    place: own[0]?.place ?? null,
    detail: own.length > 0 ? describeNews(own) : (bag.errors[provider] ?? 'No matching report'),
  });
}

function finishRelief(
  bag: DiscoveryBag,
  newsConfirmed: boolean,
  disasterConfirmed: boolean,
): FinishedCheck {
  const news = bag.news.filter((report) => report.provider === 'reliefweb');
  const disasters = bag.disasters.filter((report) => report.provider === 'reliefweb');
  const lines = [...describeNewsLines(news), ...describeDisasterLines(disasters)];
  const first = news[0] ?? disasters[0];
  return fromReports({
    category: 'news',
    confirmed: newsConfirmed || disasterConfirmed,
    headline: first?.headline ?? null,
    url: first?.url ?? null,
    hazard: news[0]?.hazard ?? disasters[0]?.hazardClass ?? null,
    place: first?.place ?? null,
    detail: lines.length > 0 ? lines.join('; ') : (bag.errors.reliefweb ?? 'No matching report'),
  });
}

function finishWeather(
  provider: WeatherProvider,
  bag: DiscoveryBag,
  confirmed: boolean,
  categoryWhy: string | null,
): FinishedCheck {
  const own = bag.weather.filter((reading) => reading.provider === provider);
  const measured = describeWeather(own);
  return fromReports({
    category: 'weather',
    confirmed,
    headline: confirmed && categoryWhy ? categoryWhy : measured,
    url: null,
    hazard: confirmed ? 'weather' : null,
    place: own[0]?.place ?? null,
    detail: measured ?? bag.errors[provider] ?? 'No weather reading',
  });
}

function finishDisaster(
  provider: DisasterProvider,
  bag: DiscoveryBag,
  confirmed: boolean,
): FinishedCheck {
  const own = bag.disasters.filter((report) => report.provider === provider);
  return fromReports({
    category: 'disaster',
    confirmed,
    headline: own[0]?.headline ?? null,
    url: own[0]?.url ?? null,
    hazard: own[0]?.hazardClass ?? null,
    place: own[0]?.place ?? null,
    detail:
      own.length > 0 ? describeDisasterLines(own).join('; ') : (bag.errors[provider] ?? 'No nearby event'),
  });
}

function finishSupplier(bag: DiscoveryBag, supplier: SupplierPropagation | null): FinishedCheck {
  const reasons = bag.suppliers.flatMap((input) => {
    if (input.sanctionsHit === true) {
      return [`${input.name} sanctions`];
    }

    switch (input.confidence) {
      case 'partial':
      case 'conflicting':
      case 'unverified':
        return [`${input.name} ${input.confidence}`];
      case 'verified':
      case null:
        return [];
      default: {
        const unexpected: never = input.confidence;
        return unexpected;
      }
    }
  });

  return fromReports({
    category: 'supplier',
    confirmed: supplier !== null,
    headline: supplier?.why ?? null,
    url: null,
    hazard: supplier ? (supplier.level === 'elevated' ? 'sanctions' : 'weak_confidence') : null,
    place: null,
    detail: supplier ? `${supplier.why}. ${reasons.join('; ')}` : 'No supplier flags',
  });
}

function fromReports(input: {
  category: RouteSourceFacts['category'];
  confirmed: boolean;
  headline: string | null;
  url: string | null;
  hazard: string | null;
  place: string | null;
  detail: string;
}): FinishedCheck {
  const agreement: RouteAgreement = input.confirmed ? 'confirmed' : 'unverified';
  return {
    label: input.headline ? clip(input.headline, 300) : null,
    url: input.url ? clip(input.url, 500) : null,
    facts: {
      category: input.category,
      agreement,
      hazard: input.hazard,
      place: input.place,
      detail: clip(input.detail, 800),
    },
  };
}

function describeNews(reports: NewsReport[]): string {
  return describeNewsLines(reports).join('; ');
}

function describeNewsLines(reports: NewsReport[]): string[] {
  return reports.slice(0, 3).map((report) => `${report.hazard} at ${report.place}: ${report.headline}`);
}

function describeDisasterLines(reports: DisasterReport[]): string[] {
  return reports
    .slice(0, 3)
    .map((report) => `${report.hazardClass} at ${report.place}: ${report.headline}`);
}

function describeWeather(readings: WeatherReading[]): string | null {
  if (readings.length === 0) {
    return null;
  }

  return readings
    .map((reading) => {
      const parts = [`${reading.place} wind ${formatNumber(reading.windKmh)} km/h`];
      if (reading.waveHeightM !== null) {
        parts.push(`waves ${reading.waveHeightM.toFixed(1)} m`);
      }
      if (reading.visibilityM !== null) {
        parts.push(`visibility ${Math.round(reading.visibilityM)} m`);
      }
      return parts.join(', ');
    })
    .join('; ');
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }

  return Math.round(value).toString();
}
