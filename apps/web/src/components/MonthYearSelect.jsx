import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parisTodayIso } from '@/lib/shortDate';
import { MONTH_LABELS_FR, isoToYearMonth, monthYearSelectYears } from '@/lib/monthYear';

const SELECT_CLASS =
  'h-11 appearance-none border-0 bg-transparent px-2 text-base outline-none focus:bg-primary/10 md:h-9 md:text-sm';

function MonthYearSelect({ value, onChange, id, className }) {
  const todayIso = parisTodayIso();
  const yearMonth = /^\d{4}-\d{2}$/.test(value || '') ? value : isoToYearMonth(todayIso);
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const years = monthYearSelectYears(todayIso, yearMonth);
  const prefix = id || 'month-year';

  function update(nextYear, nextMonth) {
    const y = String(nextYear);
    const m = String(nextMonth).padStart(2, '0');
    onChange(`${y}-${m}`);
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
      <label className="sr-only" htmlFor={`${prefix}-month`}>
        Mois
      </label>
      <div className="relative">
        <select
          id={`${prefix}-month`}
          className={cn(SELECT_CLASS, 'w-[9.5rem] pr-7')}
          value={month}
          onChange={(e) => update(year, Number(e.target.value))}
        >
          {MONTH_LABELS_FR.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <label className="sr-only" htmlFor={`${prefix}-year`}>
        Année
      </label>
      <div className="relative border-l border-input">
        <select
          id={`${prefix}-year`}
          className={cn(SELECT_CLASS, 'w-[4.5rem] pr-7')}
          value={String(year)}
          onChange={(e) => update(Number(e.target.value), month)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
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

export default MonthYearSelect;
