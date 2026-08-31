import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

export function isoToShortDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year.slice(2)}`;
}

export function shortDateToIso(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (!match) return null;
  let year = match[3];
  if (year.length === 2) year = `20${year}`;
  const month = match[2].padStart(2, '0');
  const day = match[1].padStart(2, '0');
  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);
  const dt = new Date(yearNum, monthNum - 1, dayNum);
  if (dt.getFullYear() !== yearNum || dt.getMonth() + 1 !== monthNum || dt.getDate() !== dayNum) return null;
  return `${year}-${month}-${day}`;
}

function ShortDateInput({ value, onChange, id, required, className, name }) {
  const [text, setText] = useState(() => isoToShortDate(value));

  useEffect(() => {
    setText(isoToShortDate(value));
  }, [value]);

  return (
    <Input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      placeholder="JJ/MM/AA"
      autoComplete="off"
      required={required}
      className={className}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const iso = shortDateToIso(next);
        if (iso) onChange(iso);
      }}
      onBlur={() => {
        const iso = shortDateToIso(text);
        if (iso) {
          onChange(iso);
          setText(isoToShortDate(iso));
        } else if (!text.trim()) {
          onChange('');
        }
      }}
    />
  );
}

export default ShortDateInput;
