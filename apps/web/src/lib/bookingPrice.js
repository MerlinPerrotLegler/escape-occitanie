export const DEFAULT_SLOT_PRICE = 120;

export function slotPriceFromCopy(copy) {
  const n = Number(copy?.reserver?.calendrier?.prixCreneau);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_SLOT_PRICE;
}

export function pricePerPerson(players, slotPrice = DEFAULT_SLOT_PRICE) {
  const n = Number(players);
  const slot = Number(slotPrice);
  if (!Number.isInteger(n) || n < 1 || !Number.isFinite(slot) || slot <= 0) return null;
  return slot / n;
}

export function formatPriceAmount(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  const n = Number(amount);
  if (Math.abs(n - Math.round(n)) < 0.0001) return String(Math.round(n));
  return n.toFixed(2).replace('.', ',');
}
