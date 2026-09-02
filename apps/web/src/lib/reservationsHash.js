export const BOOKING_FILTERS = [
  { id: 'aujourdhui', label: 'Aujourd’hui' },
  { id: 'demain', label: 'Demain' },
  { id: 'a-confirmer', label: 'À confirmer' },
  { id: 'avis', label: 'Avis' },
  { id: 'toutes', label: 'Toutes' },
];

export const BOOKING_SORTS = [
  { id: 'date', label: 'Date' },
  { id: 'heure', label: 'Heure' },
  { id: 'salle', label: 'Salle' },
  { id: 'client', label: 'Client' },
  { id: 'joueurs', label: 'Joueurs' },
  { id: 'statut', label: 'Statut' },
];

const TAB_ALIASES = {
  contenu: 'records',
  avis: 'records',
  reservation: 'reservations',
  creneaux: 'planning',
  creneau: 'planning',
};

export const OFFICE_TABS = ['reservations', 'planning', 'records'];

export function parseBookingFilter(raw) {
  const value = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '');
  if (value === 'demain' || value === 'tomorrow') return 'demain';
  if (value === 'a-confirmer' || value === 'pending' || value === 'aconfirmer') return 'a-confirmer';
  if (value === 'avis' || value === 'reviews') return 'avis';
  if (value === 'toutes' || value === 'all') return 'toutes';
  return 'aujourdhui';
}

export function parseBookingSort(raw) {
  const value = String(raw || '').toLowerCase();
  if (value === 'heure') return 'date';
  return BOOKING_SORTS.some((item) => item.id === value) ? value : null;
}

export function bookingSortMatches(column, tri) {
  const a = parseBookingSort(column);
  const b = parseBookingSort(tri);
  return Boolean(a && b && a === b);
}

export function parseBookingDir(raw) {
  return String(raw || '').toLowerCase() === 'desc' ? 'desc' : 'asc';
}

export function parsePage(raw) {
  const page = Number.parseInt(String(raw || '1'), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseLocationHash(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  const raw = String(hash || '').replace(/^#/, '');
  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  const [tabRaw, focusRaw] = path.split('/');
  const key = (tabRaw || '').toLowerCase();
  const id = TAB_ALIASES[key] || key;
  const tab = OFFICE_TABS.includes(id) ? id : 'reservations';
  const focusBookingId = /^\d+$/.test(focusRaw || '') ? Number(focusRaw) : null;
  const params = new URLSearchParams(query);
  const filtreExplicit = params.has('filtre') || params.has('filter');
  const filtre = parseBookingFilter(params.get('filtre') || params.get('filter'));
  const page = parsePage(params.get('page'));
  const tri = parseBookingSort(params.get('tri') || params.get('sort'));
  const sens = parseBookingDir(params.get('sens') || params.get('dir'));
  return { tab, focusBookingId, filtre, page, tri, sens, filtreExplicit };
}

export function pendingBadgeLabel(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) return '';
  return n > 9 ? '+' : String(Math.trunc(n));
}

export function defaultReservationsFilter(pendingCount, explicitFiltre) {
  if (explicitFiltre) return parseBookingFilter(explicitFiltre);
  return Number(pendingCount) > 0 ? 'a-confirmer' : 'aujourdhui';
}

export function reservationsTabHash(pendingCount) {
  return reservationsHash({
    filtre: defaultReservationsFilter(pendingCount),
    page: 1,
  });
}

export function reservationsHash({
  filtre = 'aujourdhui',
  page = 1,
  focusBookingId = null,
  tri = null,
  sens = 'asc',
} = {}) {
  const params = new URLSearchParams();
  params.set('filtre', parseBookingFilter(filtre));
  params.set('page', String(parsePage(page)));
  const sort = parseBookingSort(tri);
  if (sort) {
    params.set('tri', sort);
    params.set('sens', parseBookingDir(sens));
  }
  const path = focusBookingId ? `reservations/${focusBookingId}` : 'reservations';
  return `#${path}?${params.toString()}`;
}
