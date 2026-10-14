export function money(cents: number, symbol = '$'): string {
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function timeUntil(ts: number): string {
  const mins = Math.max(0, Math.ceil((ts - Date.now()) / 60000));
  if (mins < 1) return 'any moment now';
  if (mins === 1) return '1 minute';
  if (mins < 60) return `${mins} minutes`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ${mins % 60} min`;
}

export function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "just now" / "12s ago" / "3 min ago" — for live-location freshness chips. */
export function timeAgo(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  return formatDate(ts);
}
