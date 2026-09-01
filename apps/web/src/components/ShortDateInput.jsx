import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  datePartsToIso,
  daysInMonth,
  isoToDateParts,
  isoToShortDate,
  pad2,
  parisTodayIso,
  shortDateToIso,
  yearSelectOptions,
} from '@/lib/shortDate';

export { isoToShortDate, parisTodayIso, shortDateToIso };

const SELECT_CLASS =
  'h-11 w-12 shrink-0 appearance-none border-0 bg-transparent px-0 text-center text-base tabular-nums outline-none focus:bg-primary/10 md:h-9 md:w-11 md:text-sm';

function ShortDateInput({ value, onChange, id, required, className, name }) {
  const todayIso = useMemo(() => parisTodayIso(), []);
  const iso = isoToDateParts(value) ? value : todayIso;
  const parts = isoToDateParts(iso);
  const years = yearSelectOptions(todayIso, iso);
  const dayCount = daysInMonth(parts.year, parts.month);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prefix = id || name || 'date';

  useEffect(() => {
    if (!value) onChangeRef.current(todayIso);
  }, [value, todayIso]);

  function update(patch) {
    const nextIso = datePartsToIso(
      patch.day ?? parts.day,
      patch.month ?? parts.month,
      patch.year ?? parts.year
    );
    if (nextIso) onChange(nextIso);
  }

  return (
    <div
      id={`${prefix}-group`}
      role="group"
      className={cn(
        'inline-flex overflow-hidden rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring',
        className
      )}
    >
      <label className="sr-only" htmlFor={`${prefix}-day`}>
        Jour
      </label>
      <select
        id={`${prefix}-day`}
        name={name ? `${name}-day` : undefined}
        required={required}
        className={cn(SELECT_CLASS, 'rounded-none')}
        value={parts.day}
        onChange={(event) => update({ day: event.target.value })}
      >
        {Array.from({ length: dayCount }, (_, index) => pad2(index + 1)).map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${prefix}-month`}>
        Mois
      </label>
      <select
        id={`${prefix}-month`}
        name={name ? `${name}-month` : undefined}
        required={required}
        className={cn(SELECT_CLASS, 'rounded-none border-l border-input')}
        value={parts.month}
        onChange={(event) => update({ month: event.target.value })}
      >
        {Array.from({ length: 12 }, (_, index) => pad2(index + 1)).map((month) => (
          <option key={month} value={month}>
            {month}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${prefix}-year`}>
        Année
      </label>
      <div className="relative flex border-l border-input">
        <select
          id={`${prefix}-year`}
          name={name ? `${name}-year` : undefined}
          required={required}
          className={cn(SELECT_CLASS, 'w-14 rounded-none pr-4 md:w-12')}
          value={parts.year}
          onChange={(event) => update({ year: event.target.value })}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default ShortDateInput;
