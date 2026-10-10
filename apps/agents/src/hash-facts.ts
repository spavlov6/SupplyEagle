import { createHash } from 'node:crypto';

export function hashFacts(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
