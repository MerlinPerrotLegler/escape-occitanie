import { pad2 } from './shortDate.js';

export const SLOT_MINUTES = 30;

export function parseHhmm(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function snapMinute(minute, step = SLOT_MINUTES) {
  const size = Number(step) > 0 ? Number(step) : SLOT_MINUTES;
  const raw = ((Number(minute) % 60) + 60) % 60;
  return Math.floor(raw / size) * size;
}

export function hhmmFromParts(hour, minute, step = SLOT_MINUTES) {
  const h = Math.max(0, Math.min(23, Number(hour) || 0));
  const m = snapMinute(minute, step);
  return `${pad2(h)}:${pad2(m)}`;
}

export function hourOptions() {
  return Array.from({ length: 24 }, (_, index) => pad2(index));
}

export function minuteOptions(step = SLOT_MINUTES) {
  const size = Number(step) > 0 ? Number(step) : SLOT_MINUTES;
  const minutes = [];
  for (let minute = 0; minute < 60; minute += size) {
    minutes.push(pad2(minute));
  }
  return minutes;
}
