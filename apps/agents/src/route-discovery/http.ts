export const ROUTE_USER_AGENT =
  'SupplyEagle/0.1 (route discovery; contact: ops@supplyeagle.app)';

export async function requestText(
  url: string,
  accept = 'application/json',
): Promise<string> {
  try {
    return await requestTextOnce(url, accept);
  } catch (error) {
    if (!isTransient(error)) {
      throw error;
    }

    await delay(750);
    return requestTextOnce(url, accept);
  }
}

async function requestTextOnce(url: string, accept: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept,
      'user-agent': ROUTE_USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function isTransient(error: unknown): boolean {
  const message = errorMessage(error, '');
  return /fetch failed|terminated|econnreset|other side closed|socket|HTTP 406/i.test(
    message,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function requestJson(url: string): Promise<unknown> {
  const text = await requestText(url);
  return JSON.parse(text) as unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return fallback;
  }

  const cause = error.cause instanceof Error ? error.cause.message.trim() : '';
  return cause.length > 0 ? `${error.message}: ${cause}` : error.message;
}
