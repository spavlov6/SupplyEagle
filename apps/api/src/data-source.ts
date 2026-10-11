import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { User } from './auth/user.entity.js';
import { Alert } from './pipeline/entities/alert.entity.js';
import { PlaceLocation } from './pipeline/entities/place-location.entity.js';
import { PipelineRun } from './pipeline/entities/pipeline-run.entity.js';
import { PipelineSchedule } from './pipeline/entities/pipeline-schedule.entity.js';
import { PipelineStage } from './pipeline/entities/pipeline-stage.entity.js';
import { Recommendation } from './pipeline/entities/recommendation.entity.js';
import { Route } from './routes/route.entity.js';
import { RouteAssessment } from './routes/route-assessment.entity.js';
import { RouteSourceCheck } from './routes/route-source-check.entity.js';
import { RouteSupplier } from './routes/route-supplier.entity.js';
import { Supplier } from './suppliers/supplier.entity.js';
import { SupplierAnalysis } from './suppliers/supplier-analysis.entity.js';
import { SupplierSourceCheck } from './suppliers/supplier-source-check.entity.js';

const migrationsGlob = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
  '*.js',
);

export const dataSourceOptions = {
  type: 'postgres',
  entities: [
    User,
    Supplier,
    SupplierAnalysis,
    SupplierSourceCheck,
    Route,
    RouteSupplier,
    RouteAssessment,
    RouteSourceCheck,
    PipelineSchedule,
    PipelineRun,
    PipelineStage,
    PlaceLocation,
    Alert,
    Recommendation,
  ],
  migrations: [migrationsGlob],
  synchronize: false,
} satisfies Omit<DataSourceOptions, 'url'>;

const dataSource = new DataSource({
  ...dataSourceOptions,
  url: process.env.DATABASE_URL,
});

export default dataSource;
