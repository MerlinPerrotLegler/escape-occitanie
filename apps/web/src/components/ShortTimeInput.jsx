import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pad2 } from '@/lib/shortDate';
import {
  SLOT_MINUTES,
  hhmmFromParts,
  hourOptions,
  minuteOptions,
  parseHhmm,
} from '@/lib/shortTime';

const SELECT_CLASS =
  'h-11 w-12 shrink-0 appearance-none border-0 bg-transparent px-0 text-center text-base tabular-nums outline-none focus:bg-primary/10 md:h-9 md:w-11 md:text-sm';

function ShortTimeInput({
  value,
  onChange,
  id,
  required,
  className,
  name,
  step = SLOT_MINUTES,
}) {
  const parsed = parseHhmm(value);
  const hhmm = parsed ? hhmmFromParts(parsed.hour, parsed.minute, step) : '10:00';
  const parts = parseHhmm(hhmm);
  const hours = hourOptions();
  const minutes = minuteOptions(step);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prefix = id || name || 'time';

  useEffect(() => {
    if (value !== hhmm) onChangeRef.current(hhmm);
  }, [value, hhmm]);

  function update(patch) {
    onChange(
      hhmmFromParts(patch.hour ?? parts.hour, patch.minute ?? parts.minute, step)
    );
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
      <label className="sr-only" htmlFor={`${prefix}-hour`}>
        Heure
      </label>
      <select
        id={`${prefix}-hour`}
        name={name ? `${name}-hour` : undefined}
        required={required}
        className={cn(SELECT_CLASS, 'rounded-none')}
        value={pad2(parts.hour)}
        onChange={(event) => update({ hour: event.target.value })}
      >
        {hours.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${prefix}-minute`}>
        Minutes
      </label>
      <div className="relative flex border-l border-input">
        <select
          id={`${prefix}-minute`}
          name={name ? `${name}-minute` : undefined}
          required={required}
          className={cn(SELECT_CLASS, 'rounded-none pr-4')}
          value={pad2(parts.minute)}
          onChange={(event) => update({ minute: event.target.value })}
        >
          {minutes.map((minute) => (
            <option key={minute} value={minute}>
              {minute}
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

export default ShortTimeInput;
