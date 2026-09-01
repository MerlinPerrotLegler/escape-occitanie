import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ROOMS } from '@/data/rooms';
import {
  fetchMe,
  fetchSiteContent,
  loginManager,
  logoutManager,
  saveSiteContent,
} from '@/lib/siteContent';
import {
  cancelBooking,
  closeSlot,
  confirmBooking,
  createPeriod,
  deletePeriod,
  fetchAdminDaySlots,
  fetchBookings,
  fetchPeriods,
  openSlot,
  resendBookingEmail,
  updateBooking,
  updatePeriod,
} from '@/lib/booking';
import ShortDateInput, { isoToShortDate, parisTodayIso } from '@/components/ShortDateInput';
import ShortTimeInput from '@/components/ShortTimeInput';
import DayPagination from '@/components/DayPagination';
import MonthYearSelect from '@/components/MonthYearSelect';
import PeriodCopyDialog from '@/components/PeriodCopyDialog';
import PeriodSlots from '@/components/PeriodSlots';
import { isoToYearMonth, monthBounds } from '@/lib/monthYear';
import { cn } from '@/lib/utils';
import { nextAdminSlotStatus } from '@/lib/slotStatus';

const EMPTY_REVIEWS = [1, 2, 3].map((slot) => ({
  slot,
  name: '',
  city: '',
  text: '',
  stars: 5,
}));

const EMPTY_RECORDS = {
  directeur: [1, 2, 3].map((rank) => ({ rank, team: '', time: '00:00' })),
  vaisseau: [1, 2, 3].map((rank) => ({ rank, team: '', time: '00:00' })),
};

const ROOM_BLOCKS = [
  { slug: 'directeur', label: ROOMS.directeur.shortName },
  { slug: 'vaisseau', label: ROOMS.vaisseau.shortName },
];

const TABS = [
  { id: 'reservations', label: 'Réservations' },
  { id: 'planning', label: 'Planning' },
  { id: 'records', label: 'Records & Avis' },
];

const REMEMBER_KEY = 'mt_remember';

function readRememberPreference() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

function writeRememberPreference(remember) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

const TAB_ALIASES = {
  contenu: 'records',
  avis: 'records',
  reservation: 'reservations',
  creneaux: 'planning',
  creneau: 'planning',
};

function parseLocationHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const [tabRaw, focusRaw] = raw.split('/');
  const key = (tabRaw || '').toLowerCase();
  const id = TAB_ALIASES[key] || key;
  const tab = TABS.some((item) => item.id === id) ? id : 'reservations';
  const focusBookingId = /^\d+$/.test(focusRaw || '') ? Number(focusRaw) : null;
  return { tab, focusBookingId };
}

function slotTimeRange(row) {
  const duration = Number(row.duration_minutes) || 60;
  if (duration <= 30 || !row.end_time) return row.time;
  return `${row.time}–${row.end_time}`;
}

function sortPeriods(list) {
  return [...list].sort(
    (a, b) => a.period_date.localeCompare(b.period_date) || a.start.localeCompare(b.start)
  );
}

function toastFromApi(err) {
  if (err.warning || err.status === 409) {
    toast.warning(err.message);
    return;
  }
  toast.error(err.message);
}

const ROOM_LABELS = {
  directeur: ROOMS.directeur.shortName,
  vaisseau: ROOMS.vaisseau.shortName,
};

function MaitreThibaultPage() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(readRememberPreference);
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState(() => parseLocationHash().tab);
  const [focusBookingId, setFocusBookingId] = useState(() => parseLocationHash().focusBookingId);
  const [reviews, setReviews] = useState(EMPTY_REVIEWS);
  const [records, setRecords] = useState(EMPTY_RECORDS);
  const [apiDown, setApiDown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [periodForm, setPeriodForm] = useState({ date: parisTodayIso(), start: '10:00', end: '22:00' });
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', players: 4, date: '', time: '' });
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [planningMonth, setPlanningMonth] = useState(() => isoToYearMonth(parisTodayIso()) || '');
  const [expandedPeriodId, setExpandedPeriodId] = useState(null);
  const [copySource, setCopySource] = useState(null);
  const [daySlots, setDaySlots] = useState({ directeur: [], vaisseau: [] });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const expandedBlockRef = useRef(null);

  const expandedPeriod = periods.find((row) => row.id === expandedPeriodId) || null;

  async function reloadDaySlots(date) {
    if (!date) return;
    const data = await fetchAdminDaySlots(date);
    setDaySlots({
      directeur: data.rooms?.directeur || [],
      vaisseau: data.rooms?.vaisseau || [],
    });
  }

  async function reloadPlanningMonth(yearMonth) {
    const bounds = monthBounds(yearMonth);
    if (!bounds) return [];
    const data = await fetchPeriods(bounds.from, bounds.to);
    const list = sortPeriods(data.periods || []);
    setPeriods(list);
    setExpandedPeriodId((id) => (list.some((row) => row.id === id) ? id : null));
    return list;
  }

  function showPeriodInPlanning(period) {
    const month = isoToYearMonth(period.period_date);
    if (month) setPlanningMonth(month);
    setExpandedPeriodId(period.id);
  }

  function setCreateDate(date) {
    const next = date || parisTodayIso();
    setPeriodForm((form) => (form.date === next ? form : { ...form, date: next }));
  }

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setSession(me);
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const next = parseLocationHash();
      setTab(next.tab);
      setFocusBookingId(next.focusBookingId);
    };
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${parseLocationHash().tab}`);
    }
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (tab !== 'reservations' || !focusBookingId) return undefined;
    const node = document.getElementById(`booking-${focusBookingId}`);
    if (!node) return undefined;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return undefined;
  }, [tab, focusBookingId, bookings]);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    fetchSiteContent().then((data) => {
      if (cancelled) return;
      if (!data) {
        setApiDown(true);
        return;
      }
      setApiDown(false);
      setReviews(data.reviews);
      setRecords(data.records);
    });
    fetchBookings()
      .then((data) => {
        if (!cancelled) setBookings(data.bookings || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    const bounds = monthBounds(planningMonth);
    if (!bounds) return undefined;
    fetchPeriods(bounds.from, bounds.to)
      .then((data) => {
        if (cancelled) return;
        const list = sortPeriods(data.periods || []);
        setPeriods(list);
        setExpandedPeriodId((id) => (list.some((row) => row.id === id) ? id : null));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, planningMonth]);

  useEffect(() => {
    if (!session || tab !== 'planning' || !expandedPeriod) {
      setDaySlots({ directeur: [], vaisseau: [] });
      return undefined;
    }
    let cancelled = false;
    setLoadingSlots(true);
    fetchAdminDaySlots(expandedPeriod.period_date)
      .then((data) => {
        if (cancelled) return;
        setDaySlots({
          directeur: data.rooms?.directeur || [],
          vaisseau: data.rooms?.vaisseau || [],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) setSession(null);
        setDaySlots({ directeur: [], vaisseau: [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, tab, expandedPeriodId, expandedPeriod?.period_date]);

  useEffect(() => {
    if (!expandedPeriodId || !expandedBlockRef.current) return;
    expandedBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [expandedPeriodId]);

  async function onLogin(event) {
    event.preventDefault();
    setLoginError('');
    try {
      const me = await loginManager(email, password, remember);
      writeRememberPreference(remember);
      setSession(me);
      setPassword('');
    } catch (err) {
      setLoginError(err.status === 429 ? err.message : 'Identifiants incorrects');
    }
  }

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        reviews: reviews.map((row, i) => ({
          slot: row.slot || i + 1,
          name: row.name,
          city: row.city,
          text: row.text,
          stars: row.stars,
        })),
        records,
      };
      const saved = await saveSiteContent(payload);
      setReviews(saved.reviews);
      setRecords(saved.records);
      toast.success('Enregistré.');
    } catch (err) {
      if (err.status === 401) {
        setSession(null);
        toast.error('Session expirée.');
      } else {
        toast.error(err.message || 'Enregistrement impossible, réessaie.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logoutManager();
    setSession(null);
  }

  function startEditPeriod(row) {
    setEditingPeriodId(row.id);
    setPeriodForm({ date: row.period_date, start: row.start, end: row.end });
  }

  function cancelEditPeriod() {
    setEditingPeriodId(null);
    setPeriodForm((form) => ({ ...form, start: '10:00', end: '22:00' }));
  }

  function togglePeriod(row) {
    const next = expandedPeriodId === row.id ? null : row.id;
    setExpandedPeriodId(next);
    setDaySlots({ directeur: [], vaisseau: [] });
    setLoadingSlots(Boolean(next));
  }

  async function onSavePeriod(event) {
    event.preventDefault();
    try {
      if (editingPeriodId) {
        const updated = await updatePeriod(editingPeriodId, periodForm);
        setEditingPeriodId(null);
        toast.success(`Plage modifiée le ${isoToShortDate(updated.period_date)}.`);
        showPeriodInPlanning(updated);
        await reloadPlanningMonth(isoToYearMonth(updated.period_date));
        setExpandedPeriodId(updated.id);
        await reloadDaySlots(updated.period_date);
        return;
      }
      const created = await createPeriod(periodForm);
      toast.success(`Plage ouverte le ${isoToShortDate(created.period_date)}.`);
      showPeriodInPlanning(created);
      await reloadPlanningMonth(isoToYearMonth(created.period_date));
      setExpandedPeriodId(created.id);
      await reloadDaySlots(created.period_date);
    } catch (err) {
      if (err.status === 401) setSession(null);
      toast.error(err.message);
    }
  }

  async function onDeletePeriod(id) {
    try {
      await deletePeriod(id);
      if (editingPeriodId === id) {
        setEditingPeriodId(null);
        setPeriodForm((form) => ({ ...form, start: '10:00', end: '22:00' }));
      }
      toast.success('Plage retirée.');
      await reloadPlanningMonth(planningMonth);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function onToggleSlot(room, slot) {
    const next = nextAdminSlotStatus(slot.status);
    if (!next || !expandedPeriod) return;
    try {
      if (next === 'open') {
        await openSlot(room, expandedPeriod.period_date, slot.time);
        toast.success(`Créneau ${slot.time} rouvert.`);
      } else if (next === 'hidden') {
        await closeSlot(room, expandedPeriod.period_date, slot.time, 'hidden');
        toast.success(`Créneau ${slot.time} indisponible.`);
      } else {
        await closeSlot(room, expandedPeriod.period_date, slot.time, 'closed');
        toast.success(`Créneau ${slot.time} fermé.`);
      }
      await reloadDaySlots(expandedPeriod.period_date);
    } catch (err) {
      if (err.status === 401) setSession(null);
      toastFromApi(err);
    }
  }

  async function onCancelBooking() {
    if (!cancellingBooking) return;
    const id = cancellingBooking.id;
    try {
      await cancelBooking(id);
      setBookings((list) => list.map((row) => (row.id === id ? { ...row, status: 'cancelled' } : row)));
      setCancellingBooking(null);
      toast.success('Réservation annulée.');
      if (expandedPeriod) await reloadDaySlots(expandedPeriod.period_date);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function onConfirmBooking(id) {
    try {
      const result = await confirmBooking(id);
      setBookings((list) => list.map((row) => (row.id === id ? result.booking : row)));
      toast.success(result.emailSent ? 'Confirmée. E-mail envoyé.' : 'Réservation confirmée.');
      if (expandedPeriod) await reloadDaySlots(expandedPeriod.period_date);
    } catch (err) {
      toastFromApi(err);
    }
  }

  function startEditBooking(row) {
    setEditingBooking(row.id);
    setEditForm({
      name: row.guest_name,
      email: row.guest_email,
      phone: row.guest_phone,
      players: row.players,
      date: row.booking_date,
      time: row.time,
    });
  }

  async function onSaveBooking(event) {
    event.preventDefault();
    if (!editingBooking) return;
    try {
      const result = await updateBooking(editingBooking, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        players: Number(editForm.players),
        date: editForm.date,
        time: editForm.time,
      });
      setBookings((list) => list.map((row) => (row.id === editingBooking ? result.booking : row)));
      setEditingBooking(null);
      toast.success('Réservation mise à jour.');
    } catch (err) {
      toastFromApi(err);
    }
  }

  async function onResendMail(id) {
    try {
      const result = await resendBookingEmail(id);
      toast.success(result.emailSent ? 'E-mail renvoyé.' : 'E-mail non envoyé (vérifie SMTP).');
    } catch (err) {
      toast.error(err.message);
    }
  }

  function bookingStatusLabel(status) {
    if (status === 'confirmed') return 'Confirmée';
    if (status === 'cancelled') return 'Annulée';
    return 'En attente';
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-12 text-foreground sm:px-6">
      <Helmet>
        <title>Bureau de Maître Thibault — Escape Occitanie</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto w-full max-w-5xl">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
          Accès restreint
        </p>
        <h1 className="mt-3 font-display text-3xl font-black tracking-wide sm:text-4xl">
          Bureau de Maître Thibault
        </h1>

        {checking ? (
          <p className="mt-8 text-muted-foreground">Ouverture du bureau…</p>
        ) : !session ? (
          <form onSubmit={onLogin} className="mt-10 max-w-md space-y-4">
            <p className="text-sm text-muted-foreground">
              Identifiez-vous pour gérer les avis, le planning et les réservations.
            </p>
            <div>
              <label htmlFor="mt-email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <Input
                id="mt-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="mt-password" className="mb-1.5 block text-sm font-medium">
                Mot de passe
              </label>
              <Input
                id="mt-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mt-remember"
                checked={remember}
                onCheckedChange={(value) => setRemember(value === true)}
              />
              <Label htmlFor="mt-remember" className="cursor-pointer font-normal">
                Se souvenir de moi
              </Label>
            </div>
            {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
            <Button type="submit" className="h-11 px-6">
              Entrer dans le bureau
            </Button>
          </form>
        ) : (
          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
              {TABS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={cn(
                    'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    tab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                </a>
              ))}
              <div className="ml-auto flex items-center gap-3">
                <Link to="/" className="text-sm font-medium text-primary hover:underline">
                  Voir le site
                </Link>
                <Button type="button" variant="outline" onClick={onLogout}>
                  Se déconnecter
                </Button>
              </div>
            </div>

            {apiDown ? (
              <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                API injoignable
              </p>
            ) : null}

            {tab === 'records' && (
              <form onSubmit={onSave} className="mt-10 space-y-12">
                <section>
                  <h2 className="font-display text-2xl font-bold tracking-wide">Hall of fame</h2>
                  <div className="mt-6 grid gap-8 md:grid-cols-2">
                    {ROOM_BLOCKS.map((room) => (
                      <div key={room.slug} className="rounded-xl border border-border p-5">
                        <h3 className="font-display text-sm font-bold uppercase tracking-[0.15em]">
                          {room.label}
                        </h3>
                        <ol className="mt-4 space-y-3">
                          {(records[room.slug] || []).map((row, index) => (
                            <li key={row.rank || index} className="flex items-center gap-2">
                              <span className="w-6 font-display text-sm font-bold text-primary">
                                {index + 1}
                              </span>
                              <Input
                                placeholder="Équipe"
                                value={row.team}
                                onChange={(e) => {
                                  const next = {
                                    ...records,
                                    [room.slug]: records[room.slug].map((item, i) =>
                                      i === index ? { ...item, team: e.target.value } : item
                                    ),
                                  };
                                  setRecords(next);
                                }}
                              />
                              <Input
                                className="w-24 font-mono"
                                placeholder="MM:SS"
                                value={row.time}
                                onChange={(e) => {
                                  const next = {
                                    ...records,
                                    [room.slug]: records[room.slug].map((item, i) =>
                                      i === index ? { ...item, time: e.target.value } : item
                                    ),
                                  };
                                  setRecords(next);
                                }}
                              />
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="font-display text-2xl font-bold tracking-wide">Avis</h2>
                  <div className="mt-6 space-y-8">
                    {reviews.map((review, index) => (
                      <fieldset
                        key={review.slot || index}
                        className="space-y-3 border-l-2 border-primary/50 pl-5"
                      >
                        <legend className="font-display text-sm font-bold tracking-wider">
                          Avis {index + 1}
                        </legend>
                        <Input
                          placeholder="Nom"
                          value={review.name}
                          onChange={(e) => {
                            const next = [...reviews];
                            next[index] = { ...review, name: e.target.value };
                            setReviews(next);
                          }}
                        />
                        <Input
                          placeholder="Ville"
                          value={review.city}
                          onChange={(e) => {
                            const next = [...reviews];
                            next[index] = { ...review, city: e.target.value };
                            setReviews(next);
                          }}
                        />
                        <Textarea
                          placeholder="Témoignage"
                          rows={4}
                          value={review.text}
                          onChange={(e) => {
                            const next = [...reviews];
                            next[index] = { ...review, text: e.target.value };
                            setReviews(next);
                          }}
                        />
                        <div className="flex gap-1" role="group" aria-label="Note sur 5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <button
                              key={s}
                              type="button"
                              className="text-primary"
                              aria-label={`${s + 1} étoiles`}
                              onClick={() => {
                                const next = [...reviews];
                                next[index] = { ...review, stars: s + 1 };
                                setReviews(next);
                              }}
                            >
                              <Star
                                className={cn(
                                  'h-5 w-5',
                                  s < review.stars ? 'fill-current' : 'text-muted-foreground'
                                )}
                                strokeWidth={s < review.stars ? 0 : 1.5}
                              />
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </section>

                <Button type="submit" disabled={saving} className="h-11 px-6">
                  Enregistrer
                </Button>
              </form>
            )}

            {tab === 'planning' && (
              <section className="mt-10 space-y-10">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-wide">Ajouter une plage</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Ouvrez un jour en indiquant le début et la fin (au moins 60 minutes, aligné
                    sur 30). Une partie dure 60 minutes : une réservation à 13h occupe 13h et
                    13h30, dès la demande.
                  </p>
                  <form onSubmit={onSavePeriod} className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="text-sm">
                      <p className="mb-1">Date</p>
                      <ShortDateInput
                        id="period-date"
                        required
                        value={periodForm.date}
                        onChange={setCreateDate}
                      />
                    </div>
                    <div className="text-sm">
                      <p className="mb-1">Début</p>
                      <ShortTimeInput
                        id="period-start"
                        required
                        value={periodForm.start}
                        onChange={(start) => setPeriodForm({ ...periodForm, start })}
                      />
                    </div>
                    <div className="text-sm">
                      <p className="mb-1">Fin</p>
                      <ShortTimeInput
                        id="period-end"
                        required
                        value={periodForm.end}
                        onChange={(end) => setPeriodForm({ ...periodForm, end })}
                      />
                    </div>
                    <Button type="submit">
                      {editingPeriodId ? 'Enregistrer la plage' : 'Ouvrir cette plage'}
                    </Button>
                    {editingPeriodId ? (
                      <Button type="button" variant="outline" onClick={cancelEditPeriod}>
                        Annuler
                      </Button>
                    ) : null}
                    <DayPagination
                      id="period-day"
                      className="ml-auto"
                      value={periodForm.date}
                      onChange={setCreateDate}
                    />
                  </form>
                </div>
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-wide">Planning</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Clique une plage pour voir ses créneaux. Cycle : Ouvert → Indisponible →
                        Fermé → Ouvert. Un créneau occupé (vert) ouvre la réservation.
                      </p>
                    </div>
                    <MonthYearSelect
                      id="planning-month"
                      value={planningMonth}
                      onChange={setPlanningMonth}
                    />
                  </div>
                  <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
                    {periods.length === 0 ? (
                      <li className="px-5 py-6 text-sm text-muted-foreground">
                        Aucune plage ouverte ce mois-ci.
                      </li>
                    ) : (
                      periods.map((row) => {
                        const isOpen = expandedPeriodId === row.id;
                        return (
                          <li
                            key={row.id}
                            ref={isOpen ? expandedBlockRef : null}
                            className={cn('scroll-mt-24 px-5 py-3', isOpen && 'bg-primary/5')}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <button
                                type="button"
                                onClick={() => togglePeriod(row)}
                                aria-expanded={isOpen}
                                className={cn(
                                  'text-left text-sm transition-colors',
                                  isOpen ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                <span className="font-medium text-foreground">
                                  {isoToShortDate(row.period_date)}
                                </span>
                                <span>
                                  {' '}
                                  — {row.start} → {row.end}
                                </span>
                              </button>
                              <div className="flex shrink-0 items-center gap-2">
                                {isOpen ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCopySource(row)}
                                  >
                                    Reproduire
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  aria-pressed={editingPeriodId === row.id}
                                  onClick={() => startEditPeriod(row)}
                                >
                                  Modifier
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onDeletePeriod(row.id)}
                                >
                                  Retirer
                                </Button>
                              </div>
                            </div>
                            {isOpen ? (
                              <PeriodSlots
                                key={row.id}
                                rooms={ROOM_BLOCKS.map((room) => ({
                                  ...room,
                                  slots: daySlots[room.slug] || [],
                                }))}
                                loading={loadingSlots}
                                emptyLabel="Aucun créneau ouvert ce jour-là."
                                onToggle={onToggleSlot}
                                onReservedClick={(bookingId) => {
                                  window.location.hash = `reservations/${bookingId}`;
                                }}
                              />
                            ) : null}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </section>
            )}

            <PeriodCopyDialog
              open={Boolean(copySource)}
              source={copySource}
              onOpenChange={(next) => {
                if (!next) setCopySource(null);
              }}
              onCopied={() => {
                reloadPlanningMonth(planningMonth);
              }}
            />

            {tab === 'reservations' && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold tracking-wide">Réservations</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les demandes arrivent en attente. Confirme-les pour envoyer l’e-mail. Une
                  réservation occupe 60 min. Modifier l’heure déplace la réservation dans une
                  plage libre.
                </p>
                <div className="mt-6 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-border/70 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Heure</th>
                        <th className="px-4 py-3">Salle</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Joueurs</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {bookings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                            Aucune réservation.
                          </td>
                        </tr>
                      ) : (
                        bookings.map((row) => (
                          <React.Fragment key={row.id}>
                            <tr
                              id={`booking-${row.id}`}
                              className={cn(
                                'scroll-mt-24',
                                focusBookingId === row.id && 'bg-emerald-500/15'
                              )}
                            >
                              <td className="px-4 py-3">{isoToShortDate(row.booking_date)}</td>
                              <td className="px-4 py-3 font-mono">{slotTimeRange(row)}</td>
                              <td className="px-4 py-3">{ROOM_LABELS[row.room_slug] || row.room_slug}</td>
                              <td className="px-4 py-3">
                                <div>{row.guest_name}</div>
                                <div className="text-xs text-muted-foreground">{row.guest_email}</div>
                                <div className="text-xs text-muted-foreground">{row.guest_phone}</div>
                              </td>
                              <td className="px-4 py-3">{row.players}</td>
                              <td className="px-4 py-3">{bookingStatusLabel(row.status)}</td>
                              <td className="px-4 py-3">
                                {row.status === 'cancelled' ? null : (
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {row.status === 'pending' ? (
                                      <Button type="button" size="sm" onClick={() => onConfirmBooking(row.id)}>
                                        Confirmer
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        editingBooking === row.id ? setEditingBooking(null) : startEditBooking(row)
                                      }
                                    >
                                      Modifier
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => onResendMail(row.id)}>
                                      Renvoyer l’e-mail
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCancellingBooking(row)}
                                    >
                                      Annuler
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {editingBooking === row.id ? (
                              <tr>
                                <td colSpan={7} className="bg-primary/5 px-4 py-4">
                                  <form onSubmit={onSaveBooking} className="grid gap-3 sm:grid-cols-3">
                                    <Input
                                      required
                                      placeholder="Nom"
                                      value={editForm.name}
                                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                    <Input
                                      required
                                      type="email"
                                      placeholder="E-mail"
                                      value={editForm.email}
                                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    />
                                    <Input
                                      required
                                      placeholder="Téléphone"
                                      value={editForm.phone}
                                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    />
                                    <div className="text-sm">
                                      <p className="mb-1">Date</p>
                                      <ShortDateInput
                                        id="edit-date"
                                        required
                                        value={editForm.date}
                                        onChange={(date) => setEditForm({ ...editForm, date })}
                                      />
                                    </div>
                                    <div className="text-sm">
                                      <p className="mb-1">Heure</p>
                                      <ShortTimeInput
                                        id="edit-time"
                                        required
                                        value={editForm.time}
                                        onChange={(time) => setEditForm({ ...editForm, time })}
                                      />
                                    </div>
                                    <label className="text-sm">
                                      Joueurs
                                      <select
                                        className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                                        value={editForm.players}
                                        onChange={(e) => setEditForm({ ...editForm, players: e.target.value })}
                                      >
                                        {[3, 4, 5, 6].map((n) => (
                                          <option key={n} value={n}>
                                            {n}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="flex gap-2 sm:col-span-3">
                                      <Button type="submit" size="sm">
                                        Enregistrer
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingBooking(null)}
                                      >
                                        Fermer
                                      </Button>
                                    </div>
                                  </form>
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(cancellingBooking)}
        onOpenChange={(open) => {
          if (!open) setCancellingBooking(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancellingBooking
                ? `${cancellingBooking.guest_name} — ${ROOM_LABELS[cancellingBooking.room_slug] || cancellingBooking.room_slug}, ${isoToShortDate(cancellingBooking.booking_date)} à ${slotTimeRange(cancellingBooking)}. Cette action libère le créneau et ne peut pas être annulée.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onCancelBooking()}
            >
              Confirmer l’annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MaitreThibaultPage;
