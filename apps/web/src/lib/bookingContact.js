import { isValidPhoneNumber } from 'libphonenumber-js/max';
import { z } from 'zod';

export const NAME_ERROR = 'Indiquez un nom (au moins 2 lettres).';
export const EMAIL_ERROR = 'E-mail invalide.';
export const PHONE_ERROR = 'Numéro de téléphone invalide.';

const NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M}\s'\u2019-]*$/u;

export function isGuestName(value) {
  const name = String(value ?? '').trim();
  if (name.length < 2 || name.length > 120) return false;
  if (!NAME_CHARS.test(name)) return false;
  const letters = name.match(/\p{L}/gu);
  return Boolean(letters && letters.length >= 2);
}

export function isGuestEmail(value) {
  const email = String(value ?? '').trim();
  if (email.length === 0 || email.length > 190) return false;
  return z.email().safeParse(email).success;
}

export function isGuestPhone(value) {
  const phone = String(value ?? '').trim();
  if (phone.length === 0 || phone.length > 40) return false;
  return isValidPhoneNumber(phone, 'FR');
}

export const bookingContactSchema = z.object({
  name: z.string().trim().refine(isGuestName, NAME_ERROR),
  email: z.string().trim().refine(isGuestEmail, EMAIL_ERROR),
  phone: z.string().trim().refine(isGuestPhone, PHONE_ERROR),
  players: z.coerce.number().int().min(3).max(6),
});
