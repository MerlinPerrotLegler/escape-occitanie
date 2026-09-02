import React from 'react';
import { cn } from '@/lib/utils';
import { slotStatusLabel } from '@/lib/slotStatus';

function PeriodSlots({ rooms, loading, emptyLabel, onToggle, onReservedClick }) {
  if (loading) {
    return <p className="mt-4 text-sm text-muted-foreground">Chargement des créneaux…</p>;
  }
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      {rooms.map((room) => {
        const slots = room.slots || [];
        return (
          <div key={room.slug} className="rounded-xl border border-border p-5">
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.15em]">{room.label}</h3>
            {slots.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => {
                  const isReserved = slot.status === 'reserved';
                  const isClosed = slot.status === 'closed';
                  const isHidden = slot.status === 'hidden';
                  const reservedLabel = slot.guest_name || slotStatusLabel(slot.status);
                  return (
                    <button
                      key={`${room.slug}-${slot.time}`}
                      type="button"
                      onClick={() => {
                        if (slot.booking_id) {
                          onReservedClick(slot.booking_id);
                          return;
                        }
                        if (isReserved) return;
                        onToggle(room.slug, slot);
                      }}
                      className={cn(
                        'flex h-11 flex-col items-center justify-center rounded-md border px-1 text-xs font-medium transition-all duration-150',
                        isReserved
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                          : isHidden
                            ? 'border-sky-500/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                            : isClosed
                              ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
                              : 'border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/5'
                      )}
                      aria-label={
                        isReserved
                          ? `${slot.time} — ${reservedLabel}`
                          : `${slot.time} — ${slotStatusLabel(slot.status)}`
                      }
                    >
                      <span className="font-mono">{slot.time}</span>
                      <span
                        className={cn(
                          'max-w-full truncate text-[10px] leading-none',
                          isReserved
                            ? 'text-emerald-100'
                            : isHidden
                              ? 'text-sky-100'
                              : isClosed
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                        )}
                      >
                        {isReserved ? reservedLabel : slotStatusLabel(slot.status)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PeriodSlots;
