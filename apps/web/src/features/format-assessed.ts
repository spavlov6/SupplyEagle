export function formatAssessed(assessedAt: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(assessedAt).getTime()) / 60_000);

  if (!Number.isFinite(minutes) || minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}
