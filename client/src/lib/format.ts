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
