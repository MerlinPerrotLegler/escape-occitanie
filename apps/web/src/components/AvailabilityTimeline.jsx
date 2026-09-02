import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { scrollNodeIntoView } from '@/lib/scrollIntoView';
import {
  buildColumns,
  formatDayHeading,
  openDayIsos,
  pageSlice,
  parisNowMinutes,
  parisToday,
} from '@/lib/availabilityTimeline';

const tl = COPY.reserver.timeline;
const cal = COPY.reserver.calendrier;

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
  const [settingsReady, setSettingsReady] = useState(false);
  const [openIsos, setOpenIsos] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [slotsByRoomByDate, setSlotsByRoomByDate] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(null);
  const [bookedKeys, setBookedKeys] = useState(() => new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const skipDir = useRef(1);
  const formRef = useRef(null);

  const slice = useMemo(() => pageSlice(openIsos || [], pageIndex), [openIsos, pageIndex]);
  const daysKey = slice.days.join(',');

  useEffect(() => {
    let cancelled = false;
    fetchBookingSettings().then((next) => {
      if (!cancelled) {
        setSettings(next);
        setSettingsReady(true);
      }
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
    if (!slotsByRoomByDate || !settingsReady) return [];
    return buildColumns(slice.days, slotsByRoomByDate, {
      todayISO,
      nowMinutes,
      roomSlugs,
      slotMinutes: settings.slot_minutes,
    }).map(
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
  }, [slotsByRoomByDate, slice.days, todayISO, nowMinutes, roomSlugs, bookedKeys, settingsReady, settings.slot_minutes]);

  useEffect(() => {
    if (error || loadingSlots || !settingsReady || !slotsByRoomByDate || !openIsos?.length) return undefined;
    if (columns.length > 0) return undefined;
    const next = pageIndex + skipDir.current;
    if (next < 0 || next >= openIsos.length) return undefined;
    setPageIndex(next);
    return undefined;
  }, [columns.length, error, loadingSlots, openIsos, pageIndex, slotsByRoomByDate, settingsReady]);

  useLayoutEffect(() => {
    if (done || !selected) return undefined;
    const frame = requestAnimationFrame(() => scrollNodeIntoView(formRef.current));
    return () => cancelAnimationFrame(frame);
  }, [selected, done]);

  function retry() {
    skipDir.current = 1;
    setReloadToken((n) => n + 1);
  }

  const loadingPeriods = openIsos === null && !error;
  const canSkipEmpty =
    Boolean(openIsos?.length) &&
    pageIndex + skipDir.current >= 0 &&
    pageIndex + skipDir.current < (openIsos?.length || 0);
  const skippingEmpty =
    !error &&
    settingsReady &&
    !loadingSlots &&
    Boolean(slotsByRoomByDate) &&
    columns.length === 0 &&
    canSkipEmpty;
  const loading =
    loadingPeriods ||
    !settingsReady ||
    skippingEmpty ||
    (Boolean(openIsos?.length) && loadingSlots);

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
      <div
        className="mx-auto grid w-max"
        style={{
          gridTemplateColumns: `repeat(${rooms.length + 1}, max-content)`,
          gridTemplateRows: `auto repeat(${columns.length}, 1.85rem)`,
        }}
      >
        <div className="sticky left-0 z-10 bg-card" />
        {rooms.map((room) => (
          <div
            key={room.slug}
            className={cn(
              'flex items-center justify-center whitespace-nowrap border-b border-border/60 px-2.5 py-1 text-center text-[11px] font-semibold leading-tight',
              highlightRoom === room.slug && 'bg-primary/10'
            )}
          >
            {room.shortName}
          </div>
        ))}
        {columns.map((col) => (
          <div
            key={`${col.iso}-${col.time}`}
            className="group col-span-full grid grid-cols-subgrid"
          >
            <div className="sticky left-0 z-10 flex items-center justify-center whitespace-nowrap border-t border-border/50 bg-card px-2 text-[11px] font-medium tabular-nums text-foreground transition-colors group-hover:bg-primary/10">
              {col.time}
            </div>
            {rooms.map((room) => {
              const status = col.cells[room.slug];
              const active =
                selected?.room.slug === room.slug &&
                selected.iso === col.iso &&
                selected.time === col.time;
              return status === 'open' ? (
                <button
                  key={`${room.slug}-${col.iso}-${col.time}`}
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
                    'flex items-center justify-center whitespace-nowrap border-l border-t border-border/40 px-2.5 text-[11px] font-medium',
                    'text-foreground transition-colors group-hover:bg-primary/10',
                    highlightRoom === room.slug && 'bg-primary/5',
                    active && 'border-primary bg-primary/15 text-primary group-hover:bg-primary/20'
                  )}
                >
                  {tl.reserver}
                </button>
              ) : (
                <div
                  key={`${room.slug}-${col.iso}-${col.time}`}
                  className={cn(
                    'flex items-center justify-center whitespace-nowrap border-l border-t border-border/40 px-2.5 text-[10px] text-muted-foreground/50 transition-colors group-hover:bg-primary/10',
                    highlightRoom === room.slug && 'bg-primary/5'
                  )}
                >
                  {tl.nonDispo}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  const showPager = Boolean(openIsos?.length) && !error;
  const pagerLabel = slice.days[0] ? formatDayHeading(slice.days[0], todayISO) : '';

  return (
    <div>
      <div className="mx-auto flex max-w-full flex-col items-center">
        <div className="w-max max-w-full overflow-hidden rounded-xl border border-border bg-card/60">
          {showPager && (
            <div className="flex items-center justify-between border-b border-border/70 px-2 py-1.5 sm:px-3">
              <button
                type="button"
                disabled={!slice.hasPrev}
                onClick={() => {
                  skipDir.current = -1;
                  setPageIndex((n) => n - 1);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={tl.pagePrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-display text-xs font-bold capitalize tracking-wide text-foreground sm:text-sm">
                {pagerLabel}
              </p>
              <button
                type="button"
                disabled={!slice.hasNext}
                onClick={() => {
                  skipDir.current = 1;
                  setPageIndex((n) => n + 1);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={tl.pageNext}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {body}
        </div>
        {showPager && settingsReady && (
          <p className="mt-2 max-w-xs text-center text-xs text-muted-foreground">
            {fillCopy(cal.creneauxInfo, {
              slot: settings.slot_minutes,
              occupancy: settings.occupancy_minutes,
            })}
          </p>
        )}
      </div>

      {done ? (
        <div className="mt-5">
          <BookingSuccess booking={done} room={selected?.room || rooms[0]} />
        </div>
      ) : selected ? (
        <BookingForm
          key={`${selected.room.slug}|${selected.iso}|${selected.time}`}
          room={selected.room}
          iso={selected.iso}
          time={selected.time}
          settings={settings}
          formRef={formRef}
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
