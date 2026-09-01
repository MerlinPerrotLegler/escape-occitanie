export function isoToShortDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function fullYear(year) {
  const raw = String(year);
  if (/^\d{4}$/.test(raw)) return Number(raw);
  if (/^\d{2}$/.test(raw)) return 2000 + Number(raw);
  return Number(raw);
}

export function daysInMonth(year, month) {
  const y = fullYear(year);
  const m = Number(month);
  return new Date(y, m, 0).getDate();
}

export function isoToDateParts(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split('-');
  return { day, month, year: year.slice(-2) };
}

export function datePartsToIso(day, month, year) {
  const y = fullYear(year);
  const m = Number(month);
  const max = daysInMonth(y, m);
  const d = Math.min(Number(day), max);
  if (!y || m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function yearSelectOptions(todayIso, selectedIso) {
  const todayYear = Number(String(todayIso || '').slice(0, 4));
  if (!todayYear) return [];
  const todayMonth = Number(String(todayIso).slice(5, 7)) || 1;
  const horizonYear = todayYear + Math.floor((todayMonth - 1 + 18) / 12);
  const years = new Set();
  for (let year = todayYear - 1; year <= horizonYear; year += 1) {
    years.add(year);
  }
  const selectedYear = Number(String(selectedIso || '').slice(0, 4));
  if (selectedYear) years.add(selectedYear);
  return [...years].sort((a, b) => a - b).map((year) => String(year).slice(-2));
}

export function parisTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
}

export function shiftIsoDate(iso, days) {
  const parts = isoToDateParts(iso);
  if (!parts) return null;
  const next = new Date(fullYear(parts.year), Number(parts.month) - 1, Number(parts.day) + Number(days));
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}

export function shortDateToIso(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (!match) return null;
  let year = match[3];
  if (year.length === 2) year = `20${year}`;
  const month = match[2].padStart(2, '0');
  const day = match[1].padStart(2, '0');
  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);
  const dt = new Date(yearNum, monthNum - 1, dayNum);
  if (dt.getFullYear() !== yearNum || dt.getMonth() + 1 !== monthNum || dt.getDate() !== dayNum) return null;
  return `${year}-${month}-${day}`;
}
