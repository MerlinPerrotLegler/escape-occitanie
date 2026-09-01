async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Une erreur est survenue.');
    err.status = res.status;
    err.warning = Boolean(data.warning);
    if (Array.isArray(data.dates)) err.dates = data.dates;
    throw err;
  }
  return data;
}

export async function fetchOpenPeriods(from, to) {
  try {
    const res = await fetch(`/api/periods.php?from=${from}&to=${to}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.periods) ? data.periods : [];
  } catch {
    return [];
  }
}

export async function fetchMonthAvailability(room, from, to) {
  try {
    const res = await fetch(`/api/availability.php?room=${encodeURIComponent(room)}&from=${from}&to=${to}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.days ?? null;
  } catch {
    return null;
  }
}

export async function fetchDaySlots(room, date) {
  try {
    const res = await fetch(`/api/availability.php?room=${encodeURIComponent(room)}&date=${date}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.slots) ? data.slots : [];
  } catch {
    return [];
  }
}

export async function createBooking(payload) {
  const res = await fetch('/api/bookings.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function fetchPeriods(from, to) {
  const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';
  const res = await fetch(`/api/periods.php${qs}`, { credentials: 'include' });
  return parseJson(res);
}

export async function copyPeriod(sourceId, dates, overwrite = false) {
  const res = await fetch('/api/periods.php?action=copy', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, dates, overwrite }),
  });
  return parseJson(res);
}

export async function createPeriod(payload) {
  const res = await fetch('/api/periods.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updatePeriod(id, payload) {
  const res = await fetch(`/api/periods.php?id=${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deletePeriod(id) {
  const res = await fetch(`/api/periods.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJson(res);
}

export const DEFAULT_BOOKING_SETTINGS = {
  block_both_rooms: false,
  block_next_slot: true,
  slot_minutes: 30,
  auto_confirm: false,
  occupancy_minutes: 60,
};

export const SLOT_MINUTE_OPTIONS = [15, 30, 60];

export function occupancyFromSettings(settings) {
  const slot = SLOT_MINUTE_OPTIONS.includes(Number(settings?.slot_minutes))
    ? Number(settings.slot_minutes)
    : 30;
  const blockNext = settings?.block_next_slot !== false;
  return slot * (blockNext ? 2 : 1);
}

export function normalizeBookingSettings(raw = {}) {
  const slot = SLOT_MINUTE_OPTIONS.includes(Number(raw.slot_minutes))
    ? Number(raw.slot_minutes)
    : DEFAULT_BOOKING_SETTINGS.slot_minutes;
  const blockNext = raw.block_next_slot !== false && raw.block_next_slot !== 0;
  return {
    block_both_rooms: Boolean(raw.block_both_rooms),
    block_next_slot: blockNext,
    slot_minutes: slot,
    auto_confirm: Boolean(raw.auto_confirm),
    occupancy_minutes: occupancyFromSettings({
      slot_minutes: slot,
      block_next_slot: blockNext,
    }),
  };
}

export async function fetchBookings({ filtre = 'aujourdhui', page = 1, focus } = {}) {
  const params = new URLSearchParams({
    filtre,
    page: String(page),
  });
  if (focus) params.set('focus', String(focus));
  const res = await fetch(`/api/bookings.php?${params}`, { credentials: 'include' });
  return parseJson(res);
}

export async function fetchBookingSettings() {
  try {
    const res = await fetch('/api/booking-settings.php');
    if (!res.ok) return DEFAULT_BOOKING_SETTINGS;
    const data = await res.json();
    return normalizeBookingSettings(data.settings || data);
  } catch {
    return DEFAULT_BOOKING_SETTINGS;
  }
}

export async function saveBookingSettings(payload) {
  const res = await fetch('/api/booking-settings.php', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  return normalizeBookingSettings(data.settings || data);
}

export async function cancelBooking(id) {
  const res = await fetch(`/api/bookings.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJson(res);
}

export async function updateBooking(id, payload) {
  const res = await fetch(`/api/bookings.php?id=${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function confirmBooking(id) {
  const res = await fetch(`/api/bookings.php?id=${id}&action=confirm`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseJson(res);
}

export async function resendBookingEmail(id) {
  const res = await fetch(`/api/bookings.php?id=${id}&action=mail`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseJson(res);
}

export async function fetchAdminDaySlots(date) {
  const res = await fetch(`/api/closed-slots.php?date=${encodeURIComponent(date)}`, {
    credentials: 'include',
  });
  return parseJson(res);
}

export async function closeSlot(room, date, time, status = 'closed') {
  const res = await fetch('/api/closed-slots.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, date, time, status }),
  });
  return parseJson(res);
}

export async function openSlot(room, date, time) {
  const params = new URLSearchParams({ room, date, time });
  const res = await fetch(`/api/closed-slots.php?${params}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJson(res);
}
