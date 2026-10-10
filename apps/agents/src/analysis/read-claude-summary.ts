export function readClaudeSummary(text: string): string {
  const withoutFences = text.replace(/```(?:json)?/gi, '');
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Claude did not return a summary');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    throw new Error('Claude did not return a summary');
  }

  if (!isRecord(parsed) || typeof parsed.summary !== 'string') {
    throw new Error('Claude did not return a summary');
  }

  const summary = parsed.summary.trim();
  if (summary.length === 0) {
    throw new Error('Claude did not return a summary');
  }

  return summary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
