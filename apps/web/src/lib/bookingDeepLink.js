export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseQueryDate(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dt = new Date(`${value}T12:00:00`);
    return Number.isNaN(dt.getTime()) || toISODate(dt) !== value ? null : value;
  }
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!match) return null;
  let [, day, month, year] = match;
  if (year.length === 2) {
    year = Number(year) > 50 ? `19${year}` : `20${year}`;
  }
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const dt = new Date(`${iso}T12:00:00`);
  return Number.isNaN(dt.getTime()) || toISODate(dt) !== iso ? null : iso;
}

export function parseQueryTime(raw, slotMinutes = 30) {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d{1,2})(?:[:hH.](\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const step = [15, 30, 60].includes(Number(slotMinutes)) ? Number(slotMinutes) : 30;
  if (hour > 23 || minute > 59 || minute % step !== 0) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function rankOpenDates(periodDates, requestedISO, todayISO) {
  return [...new Set(periodDates || [])]
    .filter((iso) => iso && iso >= todayISO)
    .sort((a, b) => {
      const requested = new Date(`${requestedISO}T12:00:00`).getTime();
      const da = Math.abs(new Date(`${a}T12:00:00`).getTime() - requested);
      const db = Math.abs(new Date(`${b}T12:00:00`).getTime() - requested);
      return da - db || a.localeCompare(b);
    });
}

export function nearestOpenDay(days, requestedISO, todayISO, options = {}) {
  const exclude = options.exclude || null;
  const requested = new Date(`${requestedISO}T12:00:00`).getTime();
  let best = null;
  let bestDist = Infinity;
  Object.entries(days).forEach(([iso, info]) => {
    if (iso === exclude || iso < todayISO || !info || info.closed || !info.open) return;
    const dist = Math.abs(new Date(`${iso}T12:00:00`).getTime() - requested);
    if (dist < bestDist) {
      best = iso;
      bestDist = dist;
    }
  });
  return best;
}

export function closestOpenSlot(slots, { iso, todayISO, preferredTime, nowMinutes } = {}) {
  let open = (slots || []).filter((slot) => slot.status === 'open');
  const isToday = Boolean(iso && todayISO && iso === todayISO);
  if (isToday) {
    const now = nowMinutes ?? 0;
    open = open.filter((slot) => timeToMinutes(slot.time) >= now);
  }
  if (!open.length) return null;
  const target = preferredTime
    ? timeToMinutes(preferredTime)
    : isToday
      ? nowMinutes ?? timeToMinutes(open[0].time)
      : timeToMinutes(open[0].time);
  let best = open[0];
  let bestDist = Infinity;
  open.forEach((slot) => {
    const dist = Math.abs(timeToMinutes(slot.time) - target);
    if (dist < bestDist) {
      best = slot;
      bestDist = dist;
    }
  });
  return best.time;
}
