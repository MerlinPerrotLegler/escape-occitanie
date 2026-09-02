import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, CalendarCheck, Info, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CONTACT } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { fillCopy } from '@/lib/fillCopy';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { createBooking, fetchBookingSettings, fetchDaySlots, fetchMonthAvailability, fetchOpenPeriods, DEFAULT_BOOKING_SETTINGS } from '@/lib/booking';
import {
  closestOpenSlot,
  parseQueryDate,
  parseQueryTime,
  rankOpenDates,
  toISODate,
} from '@/lib/bookingDeepLink';
import { MAX_MONTH_OFFSET, horizonIso, initialMonthOffset } from '@/lib/calendarMonths';
import { bookingContactSchema } from '@/lib/bookingContact';

const cal = COPY.reserver.calendrier;

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
  year: 'numeric',
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

function monthsBetween(today, iso) {
  const date = new Date(`${iso}T12:00:00`);
  return (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth());
}

function clampMonthOffset(offset, maxOffset = MAX_MONTH_OFFSET) {
  return Math.max(0, Math.min(maxOffset, offset));
}

function applyDateParam(prev, iso) {
  const next = new URLSearchParams(prev);
  next.set('date', iso);
  return next;
}

function BookingCalendar({ room }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(DEFAULT_BOOKING_SETTINGS);
  const queryDate = parseQueryDate(searchParams.get('date'));
  const queryTime = parseQueryTime(
    searchParams.get('heure') || searchParams.get('time'),
    settings.slot_minutes
  );
  const skipQueryBootstrap = useRef(false);
  const initLoadedISO = useRef(null);
  const slotsSectionRef = useRef(null);
  const formSectionRef = useRef(null);

  function scrollToSlots() {
    requestAnimationFrame(() => {
      slotsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function scrollToForm() {
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function selectSlot(time) {
    setSelectedSlot(time);
    // The form mounts on first selection; wait for commit + paint.
    requestAnimationFrame(() => {
      scrollToForm();
    });
  }

  function selectDay(iso) {
    if (iso !== queryDate) skipQueryBootstrap.current = true;
    if (iso !== selectedISO) {
      setSelectedISO(iso);
      setSelectedSlot(null);
      setSlots([]);
      setLoadingSlots(true);
      setSearchParams((prev) => {
        const next = applyDateParam(prev, iso);
        next.delete('heure');
        next.delete('time');
        return next;
      }, { replace: true });
    }
    scrollToSlots();
  }

  const today = useMemo(() => parisToday(), []);
  const todayISO = toISODate(today);
  const linkedOffset = queryDate ? Math.max(0, monthsBetween(today, queryDate)) : 0;
  const maxOffset = Math.max(MAX_MONTH_OFFSET, linkedOffset);

  const [monthOffset, setMonthOffset] = useState(() =>
    queryDate ? clampMonthOffset(monthsBetween(today, queryDate), maxOffset) : 0
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
  const contactForm = useForm({
    resolver: zodResolver(bookingContactSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', phone: '', players: 4 },
  });
  const [nextOpenIso, setNextOpenIso] = useState(null);
  const nextOpenOffset = nextOpenIso ? initialMonthOffset(today, [nextOpenIso]) : 0;

  useEffect(() => {
    let cancelled = false;
    fetchBookingSettings().then((next) => {
      if (!cancelled) setSettings(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const cells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth());
  const selectedDate = selectedISO ? new Date(`${selectedISO}T12:00:00`) : null;

  useEffect(() => {
    let cancelled = false;
    fetchOpenPeriods(todayISO, horizonIso(today)).then((periods) => {
      if (cancelled) return;
      const isos = [...new Set(periods.map((row) => row.period_date))].sort();
      setNextOpenIso(isos.find((iso) => iso >= todayISO) || null);
    });
    return () => {
      cancelled = true;
    };
  }, [room.slug, today, todayISO]);

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
    if (skipQueryBootstrap.current) {
      skipQueryBootstrap.current = false;
      return undefined;
    }
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      const requested = queryDate && queryDate >= todayISO ? queryDate : todayISO;
      const horizon = queryDate && queryDate > horizonIso(today) ? queryDate : horizonIso(today);
      const periods = await fetchOpenPeriods(todayISO, horizon);
      if (cancelled) return;
      const candidates = rankOpenDates(
        periods.map((row) => row.period_date),
        requested,
        todayISO
      );
      const nowMinutes = parisNowMinutes();
      let iso = requested;
      let list = [];
      let slot = null;
      for (const candidate of candidates) {
        const daySlots = await fetchDaySlots(room.slug, candidate);
        if (cancelled) return;
        const match = closestOpenSlot(daySlots, {
          iso: candidate,
          todayISO,
          preferredTime: queryTime,
          nowMinutes,
        });
        if (match) {
          iso = candidate;
          list = daySlots;
          slot = match;
          break;
        }
      }
      if (!slot && !candidates.includes(requested)) {
        list = await fetchDaySlots(room.slug, requested);
        if (cancelled) return;
      }
      setMonthOffset(clampMonthOffset(monthsBetween(today, iso), maxOffset));
      setSelectedISO(iso);
      setSlots(list);
      setSelectedSlot(slot);
      setLoadingSlots(false);
      initLoadedISO.current = iso;
      if (slot && iso !== queryDate) {
        skipQueryBootstrap.current = true;
        setSearchParams((prev) => applyDateParam(prev, iso), { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room.slug, queryDate, queryTime, today, todayISO, maxOffset, setSearchParams]);

  useEffect(() => {
    if (!selectedISO) return undefined;
    if (initLoadedISO.current === selectedISO) {
      initLoadedISO.current = null;
      return undefined;
    }
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
  }, [room.slug, selectedISO, done]);

  async function onSubmit(values) {
    if (!selectedISO || !selectedSlot) return;
    setSubmitting(true);
    try {
      const result = await createBooking({
        room: room.slug,
        date: selectedISO,
        time: selectedSlot,
        name: values.name,
        email: values.email,
        phone: values.phone,
        players: Number(values.players),
      });
      setDone(result.booking);
      const confirmed = result.booking?.status === 'confirmed' || settings.auto_confirm;
      toast.success(
        confirmed
          ? result.emailSent
            ? cal.toastConfirmeMail
            : cal.toastConfirme
          : result.emailSent
            ? cal.toastDemandeMail
            : cal.toastDemande
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const confirmed = done.status === 'confirmed';
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-6 sm:p-8">
        <CalendarCheck className="h-8 w-8 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-bold tracking-wide">
          {confirmed ? cal.doneConfirme : cal.doneDemande}
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {fillCopy(confirmed ? cal.doneCorpsConfirme : cal.doneCorpsDemande, {
            nom: done.guest_name,
            salle: room.name,
            date: dayFormatter.format(new Date(`${done.booking_date}T12:00:00`)),
            heure: done.time,
            joueurs: done.players,
            email: done.guest_email,
          })}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {confirmed ? cal.doneArriveConfirme : cal.doneArriveAttente}
        </p>
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
          aria-label={cal.moisPrev}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground sm:text-base">
          {monthFormatter.format(viewDate)}
        </p>
        <button
          type="button"
          disabled={monthOffset === maxOffset}
          onClick={() => setMonthOffset((v) => Math.min(maxOffset, v + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={cal.moisNext}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {nextOpenIso && nextOpenOffset !== monthOffset ? (
        <div className="border-b border-border/70 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setMonthOffset(nextOpenOffset);
              selectDay(nextOpenIso);
            }}
            className="text-left text-sm text-primary underline-offset-4 hover:underline"
          >
            {fillCopy(cal.prochaine, {
              date: dayFormatter.format(new Date(`${nextOpenIso}T12:00:00`)),
            })}
          </button>
        </div>
      ) : null}

      <div className="px-3 py-4 sm:px-6">
        <div className="grid grid-cols-7 gap-1 text-center">
          {cal.jours.map((d) => (
            <span
              key={d}
              className="pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {cells.map((date, idx) => {
            if (!date) return <span key={`empty-${idx}`} />;
            const iso = toISODate(date);
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
                onClick={() => selectDay(iso)}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-1 py-1.5 transition-all duration-150 sm:min-h-[64px]',
                  isPast || isClosed
                    ? 'cursor-not-allowed text-muted-foreground/35'
                    : 'text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]',
                  isSelected && 'border-primary bg-primary/10 shadow-[0_0_16px_hsl(var(--primary)/0.25)]'
                )}
                aria-label={`${dayFormatter.format(date)}${isPast || isClosed ? ` — ${cal.indisponible}` : ` — ${fillCopy(cal.creneauxDispo, { n: openCount })}`}`}
              >
                <span className="text-sm font-semibold sm:text-base">{date.getDate()}</span>
                {!isPast && info && !info.closed && (
                  <span className={cn('text-[10px] leading-none', openCount > 0 ? 'text-primary' : 'text-muted-foreground/60')}>
                    {openCount > 0 ? fillCopy(cal.dispo, { n: openCount }) : cal.complet}
                  </span>
                )}
                {!isPast && isClosed && (
                  <span className="text-[10px] leading-none text-muted-foreground/50">{cal.ferme}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={slotsSectionRef}
        id="horaires"
        className="scroll-mt-24 border-t border-border/70 px-4 py-5 sm:px-6"
      >
        {!selectedDate ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            {cal.choisirJour}
          </p>
        ) : (
          <div>
            <p className="font-display text-sm font-bold capitalize tracking-wider text-foreground">
              {dayFormatter.format(selectedDate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fillCopy(cal.creneauxInfo, {
                slot: settings.slot_minutes,
                occupancy: settings.occupancy_minutes,
              })}
            </p>
            {loadingSlots ? (
              <p className="mt-3 text-sm text-muted-foreground">{cal.chargement}</p>
            ) : slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{cal.aucun}</p>
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
                      onClick={() => selectSlot(slot.time)}
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
                      {isFull && <span className="sr-only">{cal.reserve}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <Form {...contactForm}>
                <form
                  ref={formSectionRef}
                  id="reservation"
                  onSubmit={contactForm.handleSubmit(onSubmit)}
                  className="mt-5 scroll-mt-24 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
                  noValidate
                >
                  <p className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-primary">
                    <CalendarCheck className="h-4 w-4" />
                    {dayFormatter.format(selectedDate)} à {selectedSlot} — {settings.occupancy_minutes} min
                  </p>
                  <FormField
                    control={contactForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder={cal.placeholderNom} autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="email" placeholder={cal.placeholderEmail} autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="tel" placeholder={cal.placeholderTel} autoComplete="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="players"
                    render={({ field }) => (
                      <FormItem>
                        <label className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-primary" />
                          {cal.joueurs}
                          <select
                            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          >
                            {[3, 4, 5, 6].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={submitting} className="h-11 w-full">
                    {cal.bouton}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {fillCopy(settings.auto_confirm ? cal.noteAuto : cal.noteManuel, {
                      telephone: CONTACT.phone,
                    })}
                  </p>
                </form>
              </Form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingCalendar;
