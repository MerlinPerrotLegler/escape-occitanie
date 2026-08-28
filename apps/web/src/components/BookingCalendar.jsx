import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Phone, Mail, CalendarCheck, Info } from 'lucide-react';
import { CONTACT } from '@/data/rooms';
import { cn } from '@/lib/utils';

const SLOTS = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
const CLOSED_WEEKDAYS = [1, 2]; // lundi, mardi
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MAX_MONTH_OFFSET = 2;

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function slotStatus(roomSlug, dateISO, slot) {
  return hashString(`${roomSlug}|${dateISO}|${slot}`) % 10 < 4 ? 'full' : 'available';
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // lundi = 0
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

function BookingCalendar({ room }) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedISO, setSelectedISO] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const cells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth());

  const dayInfo = (date) => {
    if (!date) return null;
    const iso = toISO(date);
    const isPast = date < today;
    const isClosed = CLOSED_WEEKDAYS.includes(date.getDay());
    const available = isPast || isClosed ? 0 : SLOTS.filter((s) => slotStatus(room.slug, iso, s) === 'available').length;
    return { iso, isPast, isClosed, available };
  };

  const selectedDate = selectedISO ? new Date(`${selectedISO}T12:00:00`) : null;

  const mailtoHref = () => {
    if (!selectedDate || !selectedSlot) return `mailto:${CONTACT.email}`;
    const dateLabel = dayFormatter.format(selectedDate);
    const subject = `Réservation — ${room.name} — ${dateLabel} à ${selectedSlot}`;
    const body = `Bonjour,\n\nNous souhaitons réserver la salle « ${room.name} » le ${dateLabel} à ${selectedSlot}.\n\nNombre de joueurs : \nNom : \nTéléphone : \n\nMerci de nous confirmer la disponibilité.\n\nCordialement,`;
    return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/60">
      {/* En-tête du calendrier */}
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

      {/* Grille */}
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
            const info = dayInfo(date);
            const disabled = info.isPast || info.isClosed;
            const isSelected = selectedISO === info.iso;
            return (
              <button
                key={info.iso}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSelectedISO(info.iso);
                  setSelectedSlot(null);
                }}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-1 py-1.5 transition-all duration-150 sm:min-h-[64px]',
                  disabled
                    ? 'cursor-not-allowed text-muted-foreground/35'
                    : 'text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]',
                  isSelected && 'border-primary bg-primary/10 shadow-[0_0_16px_hsl(var(--primary)/0.25)]'
                )}
                aria-label={`${dayFormatter.format(date)}${disabled ? ' — indisponible' : ` — ${info.available} créneaux disponibles`}`}
              >
                <span className="text-sm font-semibold sm:text-base">{date.getDate()}</span>
                {!disabled && (
                  <span
                    className={cn(
                      'text-[10px] leading-none',
                      info.available > 0 ? 'text-primary' : 'text-muted-foreground/60'
                    )}
                  >
                    {info.available > 0 ? `${info.available} dispo` : 'Complet'}
                  </span>
                )}
                {info.isClosed && !info.isPast && (
                  <span className="text-[10px] leading-none text-muted-foreground/50">Fermé</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Créneaux du jour sélectionné */}
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
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SLOTS.map((slot) => {
                const status = slotStatus(room.slug, selectedISO, slot);
                const isFull = status === 'full';
                const isActive = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={isFull}
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      'flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-all duration-150',
                      isFull
                        ? 'cursor-not-allowed border-border/50 text-muted-foreground/40 line-through'
                        : 'border-border text-foreground hover:border-primary/60 hover:bg-primary/5 active:scale-[0.97]',
                      isActive && 'border-primary bg-primary/15 text-primary'
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {slot}
                    {isFull && <span className="sr-only">— complet</span>}
                  </button>
                );
              })}
            </div>

            {selectedSlot && (
              <div className="mt-5 rounded-lg border border-primary/40 bg-primary/5 p-4">
                <p className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-primary">
                  <CalendarCheck className="h-4 w-4" />
                  Créneau sélectionné : {dayFormatter.format(selectedDate)} à {selectedSlot}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Pour bloquer ce créneau dans la salle « {room.name} », contactez-nous — la
                  réservation est confirmée par téléphone ou par e-mail.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <a
                    href={CONTACT.phoneHref}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    <Phone className="h-4 w-4" />
                    {CONTACT.phone}
                  </a>
                  <a
                    href={mailtoHref()}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-primary/50 px-4 text-sm font-semibold text-primary transition-all hover:bg-primary/10 active:scale-[0.98]"
                  >
                    <Mail className="h-4 w-4" />
                    Demander par e-mail
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingCalendar;
