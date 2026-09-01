export const MAX_MONTH_OFFSET = 18;

export function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function startOfLocalDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function initialMonthOffset(today, openIsos, maxOffset = MAX_MONTH_OFFSET) {
  const start = startOfLocalDay(today);
  const future = (openIsos || [])
    .map((iso) => new Date(`${iso}T12:00:00`))
    .filter((day) => startOfLocalDay(day) >= start)
    .sort((a, b) => a - b);
  if (future.length === 0) return 0;
  const first = future[0];
  if (first.getFullYear() === start.getFullYear() && first.getMonth() === start.getMonth()) {
    return 0;
  }
  const offset = monthsBetween(start, first);
  if (offset < 0) return 0;
  return Math.min(offset, maxOffset);
}

export function horizonIso(today, maxOffset = MAX_MONTH_OFFSET) {
  const last = new Date(today.getFullYear(), today.getMonth() + maxOffset + 1, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, '0');
  const d = String(last.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function firstOpenIso(todayIso, openIsos) {
  const upcoming = [...new Set(openIsos || [])]
    .filter((iso) => iso && iso >= todayIso)
    .sort();
  return upcoming[0] || null;
}
