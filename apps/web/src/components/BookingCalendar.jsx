import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, CalendarCheck, Info, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CONTACT } from '@/data/rooms';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createBooking, fetchDaySlots, fetchMonthAvailability } from '@/lib/booking';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MAX_MONTH_OFFSET = 2;

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthRange(year, month) {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  return cells;
}

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function parisToday() {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parisNowMinutes() {
  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [hour, minute] = stamp.split(':').map(Number);
  return hour * 60 + minute;
}

function parseQueryDate(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dt = new Date(`${value}T12:00:00`);
    return Number.isNaN(dt.getTime()) || toISO(dt) !== value ? null : value;
  }
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!match) return null;
  let [, day, month, year] = match;
  if (year.length === 2) {
    year = Number(year) > 50 ? `19${year}` : `20${year}`;
  }
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const dt = new Date(`${iso}T12:00:00`);
  return Number.isNaN(dt.getTime()) || toISO(dt) !== iso ? null : iso;
}

function parseQueryTime(raw) {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d{1,2})(?:[:hH.](\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  if (hour > 23 || minute > 59 || minute % 30 !== 0) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function monthsBetween(today, iso) {
  const date = new Date(`${iso}T12:00:00`);
  return (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth());
}

function clampMonthOffset(offset) {
  return Math.max(0, Math.min(MAX_MONTH_OFFSET, offset));
}

async function fetchAvailabilityWindow(roomSlug, today) {
  const months = await Promise.all(
    [0, 1, 2].map((offset) => {
      const cursor = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const { from, to } = monthRange(cursor.getFullYear(), cursor.getMonth());
      return fetchMonthAvailability(roomSlug, from, to);
    })
  );
  return Object.assign({}, ...months.filter(Boolean));
}

function nearestOpenDay(days, requestedISO, todayISO) {
  const requested = new Date(`${requestedISO}T12:00:00`).getTime();
  let best = null;
  let bestDist = Infinity;
  Object.entries(days).forEach(([iso, info]) => {
    if (iso < todayISO || !info || info.closed || !info.open) return;
    const dist = Math.abs(new Date(`${iso}T12:00:00`).getTime() - requested);
    if (dist < bestDist) {
      best = iso;
      bestDist = dist;
    }
  });
  return best;
}

function closestOpenSlot(slots, { iso, todayISO, preferredTime }) {
  let open = slots.filter((slot) => slot.status === 'open');
  if (iso === todayISO) {
    const now = parisNowMinutes();
    const upcoming = open.filter((slot) => timeToMinutes(slot.time) >= now);
    if (upcoming.length) open = upcoming;
  }
  if (!open.length) return null;
  const target = preferredTime
    ? timeToMinutes(preferredTime)
    : iso === todayISO
      ? parisNowMinutes()
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

function BookingCalendar({ room }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryDate = parseQueryDate(searchParams.get('date'));
  const queryTime = parseQueryTime(searchParams.get('heure') || searchParams.get('time'));
  const appliedQuery = useRef(null);
  const initLoadedISO = useRef(null);

  const today = useMemo(() => parisToday(), []);
  const todayISO = toISO(today);

  const [monthOffset, setMonthOffset] = useState(() =>
    queryDate ? clampMonthOffset(monthsBetween(today, queryDate)) : 0
  );
  const [selectedISO, setSelectedISO] = useState(() => {
    if (!queryDate) return null;
    return queryDate < todayISO ? todayISO : queryDate;
  });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [days, setDays] = useState({});
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [done, setDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', players: 4 });

  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const cells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth());
  const selectedDate = selectedISO ? new Date(`${selectedISO}T12:00:00`) : null;

  useEffect(() => {
    const { from, to } = monthRange(viewDate.getFullYear(), viewDate.getMonth());
    let cancelled = false;
    fetchMonthAvailability(room.slug, from, to).then((data) => {
      if (!cancelled && data) setDays((prev) => ({ ...prev, ...data }));
    });
    return () => {
      cancelled = true;
    };
  }, [room.slug, monthOffset]);

  useEffect(() => {
    if (!queryDate) return undefined;
    const queryKey = `${room.slug}|${queryDate}|${queryTime || ''}`;
    if (appliedQuery.current === queryKey) return undefined;
    let cancelled = false;
    appliedQuery.current = queryKey;
    setLoadingSlots(true);
    (async () => {
      const requested = queryDate < todayISO ? todayISO : queryDate;
      const windowDays = await fetchAvailabilityWindow(room.slug, today);
      if (cancelled) return;
      setDays((prev) => ({ ...prev, ...windowDays }));
      const info = windowDays[requested];
      const iso =
        info?.open && !info.closed
          ? requested
          : nearestOpenDay(windowDays, requested, todayISO) || requested;
      setMonthOffset(clampMonthOffset(monthsBetween(today, iso)));
      setSelectedISO(iso);
      const list = await fetchDaySlots(room.slug, iso);
      if (cancelled) return;
      setSlots(list);
      setLoadingSlots(false);
      initLoadedISO.current = iso;
      const slot = closestOpenSlot(list, { iso, todayISO, preferredTime: queryTime });
      setSelectedSlot(slot);
      if (iso !== queryDate) {
        appliedQuery.current = `${room.slug}|${iso}|${queryTime || ''}`;
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set('date', iso);
            return next;
          },
          { replace: true }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room.slug, queryDate, queryTime, today, todayISO, setSearchParams]);

  useEffect(() => {
    if (!selectedISO) return undefined;
    const queryKey = `${room.slug}|${queryDate || ''}|${queryTime || ''}`;
    if (queryDate && appliedQuery.current === queryKey) return undefined;
    let cancelled = false;
    setLoadingSlots(true);
    fetchDaySlots(room.slug, selectedISO).then((list) => {
      if (cancelled) return;
      setSlots(list);
      setLoadingSlots(false);
    });
    return () => {
      cancelled = true;
    };
  }, [room.slug, selectedISO, done, queryDate, queryTime]);

  async function onSubmit(event) {
    event.preventDefault();
    if (!selectedISO || !selectedSlot) return;
    setSubmitting(true);
    try {
      const result = await createBooking({
        room: room.slug,
        date: selectedISO,
        time: selectedSlot,
        name: form.name,
        email: form.email,
        phone: form.phone,
        players: Number(form.players),
      });
      setDone(result.booking);
      toast.success(
        result.emailSent
          ? 'Demande envoyée. Un e-mail vous a été envoyé.'
          : 'Demande envoyée, en attente de confirmation.'
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-6 sm:p-8">
        <CalendarCheck className="h-8 w-8 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-bold tracking-wide">Demande envoyée</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {done.guest_name}, votre demande pour « {room.name} » le{' '}
          {dayFormatter.format(new Date(`${done.booking_date}T12:00:00`))} à {done.time} ({done.players}{' '}
          joueurs) est enregistrée. Elle sera confirmée par l’équipe. Un e-mail a été envoyé à{' '}
          {done.guest_email}.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Merci d’arriver 15 minutes en avance une fois confirmé.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-6">
        <button
          type="button"
          disabled={monthOffset === 0}
          onClick={() => setMonthOffset((v) => Math.max(0, v - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground sm:text-base">
          {monthFormatter.format(viewDate)}
        </p>
        <button
          type="button"
          disabled={monthOffset === MAX_MONTH_OFFSET}
          onClick={() => setMonthOffset((v) => Math.min(MAX_MONTH_OFFSET, v + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="px-3 py-4 sm:px-6">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((d) => (
            <span
              key={d}
              className="pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {cells.map((date, idx) => {
            if (!date) return <span key={`empty-${idx}`} />;
            const iso = toISO(date);
            const isPast = date < today;
            const info = days[iso];
            const openCount = isPast ? 0 : (info?.open ?? 0);
            const isSelected = selectedISO === iso;
            const isClosed = Boolean(info?.closed);
            return (
              <button
                key={iso}
                type="button"
                disabled={isPast || isClosed}
                onClick={() => {
                  appliedQuery.current = `${room.slug}|${iso}|`;
                  setSelectedISO(iso);
                  setSelectedSlot(null);
                  setSlots([]);
                  setLoadingSlots(true);
                  setSearchParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('date', iso);
                      next.delete('heure');
                      next.delete('time');
                      return next;
                    },
                    { replace: true }
                  );
                }}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-1 py-1.5 transition-all duration-150 sm:min-h-[64px]',
                  isPast || isClosed
                    ? 'cursor-not-allowed text-muted-foreground/35'
                    : 'text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]',
                  isSelected && 'border-primary bg-primary/10 shadow-[0_0_16px_hsl(var(--primary)/0.25)]'
                )}
                aria-label={`${dayFormatter.format(date)}${isPast || isClosed ? ' — indisponible' : ` — ${openCount} créneaux disponibles`}`}
              >
                <span className="text-sm font-semibold sm:text-base">{date.getDate()}</span>
                {!isPast && info && !info.closed && (
                  <span className={cn('text-[10px] leading-none', openCount > 0 ? 'text-primary' : 'text-muted-foreground/60')}>
                    {openCount > 0 ? `${openCount} dispo` : 'Complet'}
                  </span>
                )}
                {!isPast && isClosed && (
                  <span className="text-[10px] leading-none text-muted-foreground/50">Fermé</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border/70 px-4 py-5 sm:px-6">
        {!selectedDate ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            Sélectionnez un jour pour afficher les horaires disponibles.
          </p>
        ) : (
          <div>
            <p className="font-display text-sm font-bold capitalize tracking-wider text-foreground">
              {dayFormatter.format(selectedDate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Créneaux de départ toutes les 30 min — une partie dure 60 min.
            </p>
            {loadingSlots ? (
              <p className="mt-3 text-sm text-muted-foreground">Chargement des horaires…</p>
            ) : slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Aucun créneau ouvert ce jour-là.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((slot) => {
                  const isFull = slot.status !== 'open';
                  const isActive = selectedSlot === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={isFull}
                      onClick={() => setSelectedSlot(slot.time)}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-all duration-150',
                        isFull
                          ? 'cursor-not-allowed border-border/50 text-muted-foreground/40 line-through'
                          : 'border-border text-foreground hover:border-primary/60 hover:bg-primary/5 active:scale-[0.97]',
                        isActive && 'border-primary bg-primary/15 text-primary'
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {slot.time}
                      {isFull && <span className="sr-only">— réservé</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <form onSubmit={onSubmit} className="mt-5 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
                <p className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-primary">
                  <CalendarCheck className="h-4 w-4" />
                  {dayFormatter.format(selectedDate)} à {selectedSlot} — 60 min
                </p>
                <Input
                  required
                  placeholder="Nom"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  required
                  type="email"
                  placeholder="E-mail"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  required
                  type="tel"
                  placeholder="Téléphone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  Joueurs
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={form.players}
                    onChange={(e) => setForm({ ...form, players: e.target.value })}
                  >
                    {[3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={submitting} className="h-11 w-full">
                  Réserver ce créneau
                </Button>
                <p className="text-xs text-muted-foreground">
                  Un e-mail d’accusé de réception sera envoyé. Confirmation par l’équipe ensuite. Une
                  question ? {CONTACT.phone}
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingCalendar;
