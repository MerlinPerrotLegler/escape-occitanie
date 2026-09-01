import React from 'react';
import { cn } from '@/lib/utils';
import { shiftIsoDate } from '@/lib/shortDate';

const BUTTON_CLASS =
  'h-11 shrink-0 bg-transparent px-3 text-sm font-medium tabular-nums text-foreground outline-none transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 md:h-9';

function DayPagination({ value, onChange, className, id }) {
  const prefix = id || 'day';

  function go(days) {
    const next = shiftIsoDate(value, days);
    if (next) onChange(next);
  }

  return (
    <div
      id={`${prefix}-group`}
      role="group"
      aria-label="Changer de jour"
      className={cn(
        'inline-flex overflow-hidden rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring',
        className
      )}
    >
      <button
        type="button"
        id={`${prefix}-prev`}
        className={BUTTON_CLASS}
        onClick={() => go(-1)}
        aria-label="Jour précédent"
      >
        J-1
      </button>
      <button
        type="button"
        id={`${prefix}-next`}
        className={cn(BUTTON_CLASS, 'border-l border-input')}
        onClick={() => go(1)}
        aria-label="Jour suivant"
      >
        J+1
      </button>
    </div>
  );
}

export default DayPagination;
