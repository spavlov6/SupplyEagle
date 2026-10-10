import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  RouteSourceFacts,
  RouteSourceName,
  ShippingMode,
} from '@supplyeagle/types';
import { In, Repository } from 'typeorm';
import { SupplierAnalysis } from '../analysis/entities/supplier-analysis.entity.js';
import { categoryForSource, ROUTE_SOURCES } from './categories.js';
import {
  fetchGdacs,
  fetchEonet,
  fetchReliefWebDisasters,
  fetchUsgs,
} from './disasters.js';
import { RouteAssessment } from './entities/route-assessment.entity.js';
import { RouteSourceCheck } from './entities/route-source-check.entity.js';
import type { RouteSupplier } from './entities/route-supplier.entity.js';
import {
  disasterFindings,
  newsFindings,
  summarizeDiscovery,
  supplierFindings,
  weatherFindings,
  type DiscoveryBag,
} from './finish.js';
import { haversineKm, transitDays } from './geo.js';
import { locatePlace, LocateError, type LocatedPlace } from './geocode.js';
import { clip } from './http.js';
import { fetchGoogleNews, fetchReliefWebNews } from './news.js';
import { RouteRedisService } from './route-redis.service.js';
import { RouteSummaryService } from './route-summary.service.js';
import type {
  DisasterReport,
  NewsReport,
  SupplierFlagInput,
  WeatherReading,
} from './signals.js';
import { fetchMetNorway, fetchOpenMeteo } from './weather.js';

type LaneContext = {
  origin: LocatedPlace;
  destination: LocatedPlace;
  mode: ShippingMode;
  suppliers: SupplierFlagInput[];
};

type Preliminary = {
  status: 'found' | 'not_found' | 'error';
  label: string | null;
  url: string | null;
  detail: string | null;
  hazard: string | null;
  place: string | null;
  error: string | null;
  news: NewsReport[];
  weather: WeatherReading[];
  disasters: DisasterReport[];
  suppliers: SupplierFlagInput[];
};

@Injectable()
export class RouteDiscoveryRunner {
  private readonly logger = new Logger(RouteDiscoveryRunner.name);

  constructor(
    @InjectRepository(RouteAssessment)
    private readonly assessments: Repository<RouteAssessment>,
    @InjectRepository(RouteSourceCheck)
    private readonly checks: Repository<RouteSourceCheck>,
    @InjectRepository(SupplierAnalysis)
    private readonly supplierAnalyses: Repository<SupplierAnalysis>,
    private readonly claude: RouteSummaryService,
    private readonly redis: RouteRedisService,
  ) {}

  async run(routeId: string): Promise<void> {
    const analysis = await this.assessments.findOne({
      where: { routeId, status: In(['queued', 'running']) },
      relations: { route: { links: { supplier: true } } },
      order: { createdAt: 'DESC' },
    });
    if (!analysis?.route) {
      return;
    }

    const route = analysis.route;
    try {
      await this.markRunning(analysis);
      const checks = await this.checks.find({
        where: { analysisId: analysis.id },
      });
      const origin = await this.locateEnd(route.origin);
      await delay(1_100);
      const destination = await this.locateEnd(route.destination);
      if (!origin || !destination) {
        const failed = [
          origin ? null : route.origin,
          destination ? null : route.destination,
        ]
          .filter((place): place is string => place !== null)
          .join(' and ');
        await this.failLocate(
          analysis,
          checks,
          `Could not locate ${failed}. Open-Meteo and Nominatim must both resolve within 50 km.`,
        );
        return;
      }

      const suppliers = await this.supplierFlags(route.links ?? []);
      const bag = await this.collectProviders(analysis, checks, {
        origin,
        destination,
        mode: route.mode,
        suppliers,
      });
      const finished = summarizeDiscovery(bag);
      await Promise.all(
        checks.map(async (check) => {
          const row = finished.checks[check.source];
          if (!row) {
            return;
          }

          await this.checks.update(check.id, {
            label: row.label,
            url: row.url,
            facts: row.facts,
          });
        }),
      );

      const days = transitDays(route.mode, haversineKm(origin, destination));
      await this.assessments.update(analysis.id, {
        status: 'completed',
        riskState: finished.decision.riskState,
        laneStatus: finished.decision.laneStatus,
        transitDays: days,
        why: clip(finished.decision.why, 300),
        summary: null,
        error: null,
      });
      await this.publish(analysis.userId, analysis.routeId);

      try {
        const summary = await this.claude.summarize({
          origin: route.origin,
          destination: route.destination,
          mode: route.mode,
          decision: finished.decision,
          checks: finished.checks,
        });
        await this.assessments.update(analysis.id, {
          summary: clip(summary, 4_000),
        });
        await this.publish(analysis.userId, analysis.routeId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Claude request failed';
        this.logger.error(`Route summary failed for ${routeId}: ${message}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Route assessment failed';
      this.logger.error(`Route assessment failed for ${routeId}: ${message}`);
      await this.assessments.update(analysis.id, {
        status: 'failed',
        error: message,
      });
      await this.publish(analysis.userId, analysis.routeId);
    }
  }

  private async markRunning(analysis: RouteAssessment): Promise<void> {
    await this.assessments.update(analysis.id, {
      status: 'running',
      error: null,
    });
    await this.checks.update(
      { analysisId: analysis.id },
      { status: 'pending', label: null, url: null, facts: null, error: null },
    );
    await this.publish(analysis.userId, analysis.routeId);
  }

  private async locateEnd(place: string): Promise<LocatedPlace | null> {
    try {
      return await locatePlace(place);
    } catch (error) {
      if (error instanceof LocateError) {
        this.logger.warn(error.message);
        return null;
      }

      throw error;
    }
  }

  private async collectProviders(
    analysis: RouteAssessment,
    checks: RouteSourceCheck[],
    lane: LaneContext,
  ): Promise<DiscoveryBag> {
    const bag: DiscoveryBag = {
      news: [],
      weather: [],
      disasters: [],
      suppliers: lane.suppliers,
      placeNames: {
        origin: lane.origin.name,
        destination: lane.destination.name,
      },
      errors: {},
    };
    const places = [
      { end: 'origin' as const, name: lane.origin.name },
      { end: 'destination' as const, name: lane.destination.name },
    ];

    await Promise.all(
      ROUTE_SOURCES.map(async (source) => {
        const check = checks.find((row) => row.source === source);
        if (!check) {
          return;
        }

        const outcome = await this.fetchSource(source, lane, places);
        if (outcome.error) {
          bag.errors[source] = outcome.error;
        }
        bag.news.push(...outcome.news);
        bag.weather.push(...outcome.weather);
        bag.disasters.push(...outcome.disasters);
        await this.checks.update(check.id, {
          status: outcome.status,
          label: outcome.label,
          url: outcome.url,
          error: outcome.error,
          facts: preliminaryFacts(source, outcome),
        });
        await this.publish(analysis.userId, analysis.routeId);
      }),
    );

    return bag;
  }

  private async fetchSource(
    source: RouteSourceName,
    lane: LaneContext,
    places: Array<{ end: 'origin' | 'destination'; name: string }>,
  ): Promise<Preliminary> {
    switch (source) {
      case 'google_news':
        return fromNews(await fetchGoogleNews(places));
      case 'reliefweb': {
        const [news, disasters] = await Promise.all([
          fetchReliefWebNews(places),
          fetchReliefWebDisasters(lane.origin, lane.destination),
        ]);
        return fromRelief(news, disasters);
      }
      case 'open_meteo':
        return fromWeather(
          await fetchOpenMeteo(lane.mode, lane.origin, lane.destination),
        );
      case 'met_norway':
        return fromWeather(
          await fetchMetNorway(lane.mode, lane.origin, lane.destination),
        );
      case 'gdacs':
        return fromDisasters(await fetchGdacs(lane.origin, lane.destination));
      case 'eonet':
        return fromDisasters(await fetchEonet(lane.origin, lane.destination));
      case 'usgs':
        return fromDisasters(await fetchUsgs(lane.origin, lane.destination));
      case 'supplier_propagation':
        return fromSuppliers(lane.suppliers);
      default: {
        const unexpected: never = source;
        return blank('error', `Unknown source ${String(unexpected)}`);
      }
    }
  }

  private async supplierFlags(
    links: RouteSupplier[],
  ): Promise<SupplierFlagInput[]> {
    const ids = [...new Set(links.map((link) => link.supplierId))];
    const rows =
      ids.length === 0
        ? []
        : await this.supplierAnalyses.find({
            where: { supplierId: In(ids) },
            order: { createdAt: 'DESC' },
          });
    const latest = new Map<string, SupplierAnalysis>();
    for (const row of rows) {
      if (!latest.has(row.supplierId)) {
        latest.set(row.supplierId, row);
      }
    }

    return links.map((link) => {
      const row = latest.get(link.supplierId);
      return {
        name: link.supplier?.name ?? 'Supplier',
        sanctionsHit: row?.sanctionsHit ?? null,
        confidence: row?.confidence ?? null,
      };
    });
  }

  private async failLocate(
    analysis: RouteAssessment,
    checks: RouteSourceCheck[],
    message: string,
  ): Promise<void> {
    await this.assessments.update(analysis.id, {
      status: 'failed',
      riskState: null,
      laneStatus: null,
      transitDays: null,
      why: null,
      summary: null,
      error: message,
    });
    for (const check of checks) {
      await this.checks.update(check.id, {
        status: 'error',
        label: null,
        url: null,
        error: 'Lane location was not confirmed',
        facts: {
          category: categoryForSource(check.source),
          agreement: 'unverified',
          hazard: null,
          place: null,
          detail: message,
          items: [],
        },
      });
    }
    await this.publish(analysis.userId, analysis.routeId);
  }

  private publish(userId: string, routeId: string): Promise<void> {
    return this.redis.publish({
      type: 'route.assessment.updated',
      userId,
      routeId,
    });
  }
}

function preliminaryFacts(
  source: RouteSourceName,
  outcome: Preliminary,
): RouteSourceFacts {
  return {
    category: categoryForSource(source),
    agreement: null,
    hazard: outcome.hazard,
    place: outcome.place,
    detail: outcome.detail,
    items: [
      ...newsFindings(outcome.news),
      ...weatherFindings(outcome.weather),
      ...disasterFindings(outcome.disasters),
      ...supplierFindings(outcome.suppliers),
    ],
  };
}

function fromNews(result: {
  reports: NewsReport[];
  error: string | null;
}): Preliminary {
  const first = result.reports[0];
  if (result.error && result.reports.length === 0) {
    return blank('error', result.error);
  }
  if (!first) {
    return { ...blank('not_found', null), detail: 'No matching report' };
  }

  return {
    status: 'found',
    label: clip(first.headline, 300),
    url: first.url ? clip(first.url, 500) : null,
    detail: result.reports
      .slice(0, 3)
      .map(
        (report) => `${report.hazard} at ${report.place}: ${report.headline}`,
      )
      .join('; '),
    hazard: first.hazard,
    place: first.place,
    error: null,
    news: result.reports,
    weather: [],
    disasters: [],
    suppliers: [],
  };
}

function fromRelief(
  news: { reports: NewsReport[]; error: string | null },
  disasters: { reports: DisasterReport[]; error: string | null },
): Preliminary {
  if (news.reports.length === 0 && disasters.reports.length === 0) {
    if (news.error || disasters.error) {
      return blank(
        'error',
        news.error ?? disasters.error ?? 'ReliefWeb request failed',
      );
    }

    return { ...blank('not_found', null), detail: 'No matching report' };
  }

  const newsOutcome = fromNews(news);
  const disasterOutcome = fromDisasters(disasters);
  return {
    status: 'found',
    label: newsOutcome.label ?? disasterOutcome.label,
    url: newsOutcome.url ?? disasterOutcome.url,
    detail: [newsOutcome.detail, disasterOutcome.detail]
      .filter((part) => part)
      .join('; '),
    hazard: newsOutcome.hazard ?? disasterOutcome.hazard,
    place: newsOutcome.place ?? disasterOutcome.place,
    error: null,
    news: news.reports,
    weather: [],
    disasters: disasters.reports,
    suppliers: [],
  };
}

function fromWeather(result: {
  readings: WeatherReading[];
  error: string | null;
}): Preliminary {
  if (result.error && result.readings.length === 0) {
    return blank('error', result.error);
  }
  if (result.readings.length === 0) {
    return { ...blank('not_found', null), detail: 'No weather reading' };
  }

  return {
    status: 'found',
    label: null,
    url: null,
    detail: `${result.readings.length} weather readings`,
    hazard: null,
    place: result.readings[0]?.place ?? null,
    error: null,
    news: [],
    weather: result.readings,
    disasters: [],
    suppliers: [],
  };
}

function fromDisasters(result: {
  reports: DisasterReport[];
  error: string | null;
}): Preliminary {
  const first = result.reports[0];
  if (result.error && result.reports.length === 0) {
    return blank('error', result.error);
  }
  if (!first) {
    return { ...blank('not_found', null), detail: 'No nearby event' };
  }

  return {
    status: 'found',
    label: clip(first.headline, 300),
    url: first.url ? clip(first.url, 500) : null,
    detail: result.reports
      .slice(0, 3)
      .map(
        (report) =>
          `${report.hazardClass} at ${report.place}: ${report.headline}`,
      )
      .join('; '),
    hazard: first.hazardClass,
    place: first.place,
    error: null,
    news: [],
    weather: [],
    disasters: result.reports,
    suppliers: [],
  };
}

function fromSuppliers(suppliers: SupplierFlagInput[]): Preliminary {
  const flagged = suppliers.filter(
    (supplier) =>
      supplier.sanctionsHit === true ||
      supplier.confidence === 'partial' ||
      supplier.confidence === 'conflicting' ||
      supplier.confidence === 'unverified',
  );
  const first = flagged[0];
  if (!first) {
    return {
      ...blank('not_found', null),
      detail: 'No supplier flags',
      suppliers,
    };
  }

  const why = first.name;
  return {
    status: 'found',
    label: clip(why, 300),
    url: null,
    detail: why,
    hazard: first.sanctionsHit === true ? 'sanctions' : 'weak_confidence',
    place: null,
    error: null,
    news: [],
    weather: [],
    disasters: [],
    suppliers,
  };
}

function blank(
  status: 'not_found' | 'error',
  error: string | null,
): Preliminary {
  return {
    status,
    label: null,
    url: null,
    detail: null,
    hazard: null,
    place: null,
    error,
    news: [],
    weather: [],
    disasters: [],
    suppliers: [],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
