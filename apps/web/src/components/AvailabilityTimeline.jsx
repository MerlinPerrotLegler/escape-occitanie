import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ROOM_LIST } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { fillCopy } from '@/lib/fillCopy';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingForm, BookingSuccess } from '@/components/BookingForm';
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  fetchDaySlotsStrict,
  fetchOpenPeriodsStrict,
} from '@/lib/booking';
import { toISODate } from '@/lib/bookingDeepLink';
import { horizonIso } from '@/lib/calendarMonths';
import {
  buildColumns,
  formatColumnDate,
  formatDayHeading,
  formatPageRange,
  groupColumnsByDay,
  openDayIsos,
  pageSlice,
  parisNowMinutes,
  parisToday,
} from '@/lib/availabilityTimeline';

const tl = COPY.reserver.timeline;

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function AvailabilityTimeline({ highlightRoom }) {
  const rooms = ROOM_LIST;
  const roomSlugs = useMemo(() => rooms.map((room) => room.slug), [rooms]);
  const today = useMemo(() => parisToday(), []);
  const todayISO = toISODate(today);
  const nowMinutes = useMemo(() => parisNowMinutes(), []);

  const [settings, setSettings] = useState(DEFAULT_BOOKING_SETTINGS);
  const [openIsos, setOpenIsos] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [slotsByRoomByDate, setSlotsByRoomByDate] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(null);
  const [bookedKeys, setBookedKeys] = useState(() => new Set());
  const [reloadToken, setReloadToken] = useState(0);

  const slice = useMemo(() => pageSlice(openIsos || [], pageIndex), [openIsos, pageIndex]);
  const daysKey = slice.days.join(',');

  useEffect(() => {
    let cancelled = false;
    fetchBookingSettings().then((next) => {
      if (!cancelled) setSettings(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOpenIsos(null);
    setSlotsByRoomByDate(null);
    setError(null);
    setPageIndex(0);
    fetchOpenPeriodsStrict(todayISO, horizonIso(today))
      .then((periods) => {
        if (cancelled) return;
        setOpenIsos(openDayIsos(periods.map((row) => row.period_date), todayISO));
      })
      .catch(() => {
        if (!cancelled) setError(tl.erreur);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, today, todayISO]);

  useEffect(() => {
    setSelected(null);
    setDone(null);
  }, [pageIndex]);

  useEffect(() => {
    if (!openIsos || openIsos.length === 0) return undefined;
    const days = daysKey ? daysKey.split(',') : [];
    if (days.length === 0) return undefined;
    let cancelled = false;
    setLoadingSlots(true);
    setError(null);
    (async () => {
      try {
        const pairs = await Promise.all(
          days.flatMap((iso) =>
            roomSlugs.map(async (slug) => {
              const slots = await fetchDaySlotsStrict(slug, iso);
              return [slug, iso, slots];
            })
          )
        );
        if (cancelled) return;
        const next = {};
        for (const slug of roomSlugs) next[slug] = {};
        for (const [slug, iso, slots] of pairs) {
          next[slug][iso] = slots;
        }
        setSlotsByRoomByDate(next);
      } catch {
        if (!cancelled) {
          setSlotsByRoomByDate(null);
          setError(tl.erreur);
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [daysKey, openIsos, roomSlugs]);

  const columns = useMemo(() => {
    if (!slotsByRoomByDate) return [];
    return buildColumns(slice.days, slotsByRoomByDate, { todayISO, nowMinutes, roomSlugs }).map(
      (col) => ({
        ...col,
        cells: Object.fromEntries(
          Object.entries(col.cells).map(([slug, status]) => [
            slug,
            bookedKeys.has(`${slug}|${col.iso}|${col.time}`) ? 'unavailable' : status,
          ])
        ),
      })
    );
  }, [slotsByRoomByDate, slice.days, todayISO, nowMinutes, roomSlugs, bookedKeys]);

  const groups = useMemo(() => groupColumnsByDay(columns), [columns]);

  function retry() {
    setReloadToken((n) => n + 1);
  }

  const loadingPeriods = openIsos === null && !error;
  const loading = loadingPeriods || (Boolean(openIsos?.length) && loadingSlots && !slotsByRoomByDate);

  let body = null;
  if (error) {
    body = (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{tl.erreur}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {tl.reessayer}
        </button>
      </div>
    );
  } else if (loading) {
    body = (
      <div className="space-y-2 px-4 py-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  } else if (openIsos && openIsos.length === 0) {
    body = <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tl.vide}</p>;
  } else if (columns.length === 0) {
    body = <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tl.aucunHoraire}</p>;
  } else {
    body = (
      <div className="overflow-x-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `8.5rem repeat(${columns.length}, 5.75rem)`,
            gridTemplateRows: `auto auto repeat(${rooms.length}, 3.25rem)`,
          }}
        >
          <div className="sticky left-0 z-10 bg-card" />
          {groups.map((group) => (
            <div
              key={group.iso}
              className="relative border-b border-border/60"
              style={{ gridColumn: `span ${group.columns.length}` }}
            >
              <span className="sticky left-[8.5rem] z-[1] inline-block bg-card px-2 py-2 text-xs font-semibold capitalize tracking-wide text-foreground">
                {formatDayHeading(group.iso, todayISO)}
              </span>
            </div>
          ))}
          <div className="sticky left-0 z-10 bg-card" />
          {columns.map((col) => (
            <div
              key={`${col.iso}-${col.time ?? 'empty'}`}
              className="flex min-h-[2.75rem] flex-col items-center justify-center border-b border-border/60 px-1 text-center"
            >
              <span className="text-[10px] font-semibold capitalize leading-tight text-muted-foreground">
                {formatColumnDate(col.iso)}
              </span>
              <span className="text-xs font-medium text-foreground">{col.time || '—'}</span>
            </div>
          ))}
          {rooms.map((room) => (
            <React.Fragment key={room.slug}>
              <div
                className={cn(
                  'sticky left-0 z-10 flex items-center border-t border-border/50 bg-card px-3 text-sm font-semibold',
                  highlightRoom === room.slug && 'bg-primary/10'
                )}
              >
                {room.shortName}
              </div>
              {columns.map((col) => {
                const status = col.cells[room.slug];
                const active =
                  selected?.room.slug === room.slug &&
                  selected.iso === col.iso &&
                  selected.time === col.time;
                return status === 'open' ? (
                  <button
                    key={`${room.slug}-${col.iso}-${col.time ?? 'empty'}`}
                    type="button"
                    onClick={() => {
                      setDone(null);
                      setSelected({ room, iso: col.iso, time: col.time });
                    }}
                    aria-label={fillCopy(tl.ariaReserver, {
                      salle: room.shortName,
                      date: dayFormatter.format(new Date(`${col.iso}T12:00:00`)),
                      heure: col.time,
                    })}
                    className={cn(
                      'flex items-center justify-center border-l border-t border-border/40 text-xs font-medium',
                      'text-foreground hover:border-primary/60 hover:bg-primary/5',
                      highlightRoom === room.slug && 'bg-primary/5',
                      active && 'border-primary bg-primary/15 text-primary'
                    )}
                  >
                    {tl.reserver}
                  </button>
                ) : (
                  <div
                    key={`${room.slug}-${col.iso}-${col.time ?? 'empty'}`}
                    className={cn(
                      'flex items-center justify-center border-l border-t border-border/40 text-[11px] text-muted-foreground/50',
                      highlightRoom === room.slug && 'bg-primary/5'
                    )}
                  >
                    {tl.nonDispo}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  const showPager = Boolean(openIsos?.length) && !error;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border bg-card/60">
        {showPager && (
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-3 sm:px-4">
            <button
              type="button"
              disabled={!slice.hasPrev}
              onClick={() => setPageIndex((n) => n - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={tl.pagePrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground">
              {formatPageRange(slice.days)}
            </p>
            <button
              type="button"
              disabled={!slice.hasNext}
              onClick={() => setPageIndex((n) => n + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={tl.pageNext}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
        {body}
      </div>

      {done ? (
        <div className="mt-5">
          <BookingSuccess booking={done} room={selected?.room || rooms[0]} />
        </div>
      ) : selected ? (
        <BookingForm
          room={selected.room}
          iso={selected.iso}
          time={selected.time}
          settings={settings}
          title={fillCopy(tl.formTitre, {
            date: dayFormatter.format(new Date(`${selected.iso}T12:00:00`)),
            heure: selected.time,
            salle: selected.room.name,
            occupancy: settings.occupancy_minutes,
          })}
          onSuccess={(booking) => {
            setBookedKeys((prev) => {
              const next = new Set(prev);
              next.add(`${selected.room.slug}|${selected.iso}|${selected.time}`);
              return next;
            });
            setDone(booking);
          }}
        />
      ) : null}
    </div>
  );
}

export default AvailabilityTimeline;
