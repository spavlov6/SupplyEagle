const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

type ApiClientOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string | null;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiClient<T>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (Array.isArray(payload.message)) {
      return payload.message.map(String).join(', ');
    }
    if (typeof payload.message === 'string' && payload.message.length > 0) {
      return payload.message;
    }
  } catch {
    // Nest sometimes returns an empty body; fall back to the status line.
  }

  return `Request failed: ${response.status} ${response.statusText}`;
}
