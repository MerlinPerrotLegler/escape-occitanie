import { timeToMinutes } from './bookingDeepLink.js';

export const PAGE_SIZE = 7;

export function parisToday() {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function parisNowMinutes() {
  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [hour, minute] = stamp.split(':').map(Number);
  return hour * 60 + minute;
}

export function openDayIsos(periodDates, todayISO) {
  return [...new Set((periodDates || []).filter((iso) => iso && iso >= todayISO))].sort();
}

export function pageSlice(openIsos, pageIndex, pageSize = PAGE_SIZE) {
  const list = openIsos || [];
  if (list.length === 0) {
    return { days: [], pageIndex: 0, pageCount: 0, hasPrev: false, hasNext: false };
  }
  const pageCount = Math.ceil(list.length / pageSize);
  const p = Math.max(0, Math.min(Number(pageIndex) || 0, pageCount - 1));
  return {
    days: list.slice(p * pageSize, p * pageSize + pageSize),
    pageIndex: p,
    pageCount,
    hasPrev: p > 0,
    hasNext: p < pageCount - 1,
  };
}

export function isSlotBookable(slot, { iso, todayISO, nowMinutes }) {
  if (!slot || slot.status !== 'open') return false;
  if (!iso || iso < todayISO) return false;
  if (iso === todayISO && timeToMinutes(slot.time) < nowMinutes) return false;
  return true;
}

export function buildColumns(days, slotsByRoomByDate, { todayISO, nowMinutes, roomSlugs }) {
  const columns = [];
  for (const iso of days || []) {
    const times = new Set();
    for (const slug of roomSlugs) {
      for (const slot of slotsByRoomByDate?.[slug]?.[iso] || []) {
        if (slot?.time) times.add(slot.time);
      }
    }
    for (const time of [...times].sort()) {
      const cells = {};
      for (const slug of roomSlugs) {
        const slot = (slotsByRoomByDate?.[slug]?.[iso] || []).find((row) => row.time === time);
        cells[slug] = isSlotBookable(slot, { iso, todayISO, nowMinutes }) ? 'open' : 'unavailable';
      }
      columns.push({ iso, time, cells });
    }
  }
  return columns;
}

export function groupColumnsByDay(columns) {
  const groups = [];
  for (const col of columns || []) {
    const last = groups[groups.length - 1];
    if (last && last.iso === col.iso) last.columns.push(col);
    else groups.push({ iso: col.iso, columns: [col] });
  }
  return groups;
}

export function formatDayHeading(iso, todayISO) {
  const date = new Date(`${iso}T12:00:00`);
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (iso.slice(0, 4) !== String(todayISO).slice(0, 4)) opts.year = 'numeric';
  return new Intl.DateTimeFormat('fr-FR', opts).format(date);
}

export function formatPageRange(days) {
  if (!days?.length) return '';
  const first = new Date(`${days[0]}T12:00:00`);
  const last = new Date(`${days[days.length - 1]}T12:00:00`);
  const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  if (days[0] === days[days.length - 1]) return dayMonth.format(first);
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(first);
    return `${first.getDate()}–${last.getDate()} ${month}`;
  }
  return `${dayMonth.format(first)} – ${dayMonth.format(last)}`;
}
