import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import MonthYearSelect from '@/components/MonthYearSelect';
import { copyPeriod, fetchPeriods } from '@/lib/booking';
import { buildMonthCells, isoToYearMonth, monthBounds } from '@/lib/monthYear';
import { pad2 } from '@/lib/shortDate';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function dateToIso(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function PeriodCopyDialog({ open, onOpenChange, source, onCopied }) {
  const sourceIso = source?.period_date || '';
  const [viewMonth, setViewMonth] = useState(() => isoToYearMonth(sourceIso) || '');
  const [selected, setSelected] = useState(() => new Set());
  const [openDates, setOpenDates] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !sourceIso) return;
    setViewMonth(isoToYearMonth(sourceIso) || '');
    setSelected(new Set());
    setConfirming(false);
    setConflictCount(0);
  }, [open, sourceIso]);

  useEffect(() => {
    if (!open) return undefined;
    const bounds = monthBounds(viewMonth);
    if (!bounds) return undefined;
    let cancelled = false;
    fetchPeriods(bounds.from, bounds.to)
      .then((data) => {
        if (cancelled) return;
        setOpenDates(new Set((data.periods || []).map((row) => row.period_date)));
      })
      .catch(() => {
        if (!cancelled) setOpenDates(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [open, viewMonth]);

  const year = Number(String(viewMonth).slice(0, 4));
  const month = Number(String(viewMonth).slice(5, 7));
  const cells = useMemo(
    () => (year && month ? buildMonthCells(year, month) : []),
    [year, month]
  );

  function toggleDay(iso) {
    if (!iso || iso === sourceIso) return;
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  async function submit(overwrite) {
    if (!source || selected.size === 0) return;
    setBusy(true);
    try {
      await copyPeriod(source.id, [...selected], overwrite);
      toast.success('Plages reproduites.');
      onCopied?.();
      onOpenChange(false);
    } catch (err) {
      if (err.status === 409 && !overwrite) {
        setConflictCount(Array.isArray(err.dates) ? err.dates.length : selected.size);
        setConfirming(true);
        return;
      }
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reproduire la plage</DialogTitle>
          <DialogDescription>
            Copie les horaires et les créneaux Invisible / Fermé vers les jours choisis. Les
            réservations ne sont pas copiées.
          </DialogDescription>
        </DialogHeader>
        <MonthYearSelect id="copy-month" value={viewMonth} onChange={setViewMonth} />
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1 font-medium">
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`pad-${index}`} />;
            }
            const iso = dateToIso(cell);
            const isSource = iso === sourceIso;
            const isOpenDay = openDates.has(iso);
            const isSelected = selected.has(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={isSource || busy}
                onClick={() => toggleDay(iso)}
                className={cn(
                  'h-9 rounded-md text-sm tabular-nums',
                  isSource && 'cursor-not-allowed opacity-40',
                  isSelected && 'bg-primary text-primary-foreground',
                  !isSelected && isOpenDay && 'border border-primary/50 bg-primary/10',
                  !isSelected && !isOpenDay && !isSource && 'hover:bg-muted'
                )}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>
        {confirming ? (
          <p className="text-sm text-muted-foreground">
            Écraser les {conflictCount} jours déjà ouverts ?
          </p>
        ) : null}
        <DialogFooter>
          {confirming ? (
            <>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                Annuler
              </Button>
              <Button type="button" onClick={() => submit(true)} disabled={busy}>
                Écraser
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => submit(false)} disabled={busy || selected.size === 0}>
              Copier
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PeriodCopyDialog;
