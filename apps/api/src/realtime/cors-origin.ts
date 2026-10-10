import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readCorsOrigin(): string {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN;
  }

  try {
    const contents = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.startsWith('CORS_ORIGIN=')) {
        continue;
      }

      const value = trimmed.slice('CORS_ORIGIN='.length).trim();
      if (value.length > 0) {
        return value;
      }
    }
  } catch {
    // The process environment is the fallback when no local env file exists.
  }

  return 'http://localhost:3000';
}
