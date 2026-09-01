async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Une erreur est survenue.');
    err.status = res.status;
    err.warning = Boolean(data.warning);
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

export async function fetchPeriods() {
  const res = await fetch('/api/periods.php', { credentials: 'include' });
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

export async function deletePeriod(id) {
  const res = await fetch(`/api/periods.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseJson(res);
}

export async function fetchBookings() {
  const res = await fetch('/api/bookings.php', { credentials: 'include' });
  return parseJson(res);
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

export async function closeSlot(room, date, time) {
  const res = await fetch('/api/closed-slots.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, date, time }),
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
