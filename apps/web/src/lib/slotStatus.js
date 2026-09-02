export function nextAdminSlotStatus(status) {
  if (status === 'open') return 'hidden';
  if (status === 'hidden') return 'closed';
  if (status === 'closed') return 'open';
  return null;
}

export function slotStatusLabel(status) {
  if (status === 'reserved') return 'Occupé';
  if (status === 'hidden') return 'Invisible';
  if (status === 'closed') return 'Fermé';
  return 'Ouvert';
}
