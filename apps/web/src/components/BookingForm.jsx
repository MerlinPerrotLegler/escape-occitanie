import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CONTACT } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { fillCopy } from '@/lib/fillCopy';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { createBooking } from '@/lib/booking';
import { bookingContactSchemaForRoom, playerCountsForRoom } from '@/lib/bookingContact';
import { formatPriceAmount, pricePerPerson, slotPriceFromCopy } from '@/lib/bookingPrice';
import { TurnstileField } from '@/components/TurnstileField';
import { scrollNodeIntoView } from '@/lib/scrollIntoView';

const cal = COPY.reserver.calendrier;

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function bookingPriceVars(players) {
  const slotPrice = slotPriceFromCopy(COPY);
  return {
    prix: formatPriceAmount(slotPrice),
    prix_personne: formatPriceAmount(pricePerPerson(players, slotPrice)),
  };
}

export function BookingSuccess({ booking, room }) {
  const confirmed = booking.status === 'confirmed';
  const resultRef = useRef(null);

  useLayoutEffect(() => {
    const node = resultRef.current;
    requestAnimationFrame(() => scrollNodeIntoView(node));
  }, []);

  return (
    <div
      ref={resultRef}
      id="confirmation"
      className="scroll-mt-24 rounded-xl border border-primary/40 bg-primary/5 p-6 sm:p-8"
    >
      <CalendarCheck className="h-8 w-8 text-primary" />
      <h2 className="mt-4 font-display text-2xl font-bold tracking-wide">
        {confirmed ? cal.doneConfirme : cal.doneDemande}
      </h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        {fillCopy(confirmed ? cal.doneCorpsConfirme : cal.doneCorpsDemande, {
          nom: booking.guest_name,
          salle: room.name,
          date: dayFormatter.format(new Date(`${booking.booking_date}T12:00:00`)),
          heure: booking.time,
          joueurs: booking.players,
          email: booking.guest_email,
          ...bookingPriceVars(booking.players),
        })}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {confirmed ? cal.doneArriveConfirme : cal.doneArriveAttente}
      </p>
    </div>
  );
}

export function BookingForm({ room, iso, time, settings, formRef, title, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [turnstileOn, setTurnstileOn] = useState(null);
  const localFormRef = useRef(null);
  const playerCounts = playerCountsForRoom(room.slug);
  const schema = useMemo(() => bookingContactSchemaForRoom(room.slug), [room.slug]);
  const contactForm = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', phone: '', players: playerCounts.includes(4) ? 4 : playerCounts[0] },
  });
  const dateLabel = dayFormatter.format(new Date(`${iso}T12:00:00`));
  const slotPrice = slotPriceFromCopy(COPY);
  const selectedPlayers = Number(contactForm.watch('players'));
  const priceVars = bookingPriceVars(selectedPlayers);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => scrollNodeIntoView(localFormRef.current));
    return () => cancelAnimationFrame(frame);
  }, [room.slug, iso, time]);

  function setFormNode(node) {
    localFormRef.current = node;
    if (formRef) formRef.current = node;
  }

  function resetTurnstile() {
    setTurnstileToken('');
    setTurnstileReset((n) => n + 1);
  }

  async function onSubmit(values) {
    if (turnstileOn === null) {
      scrollNodeIntoView(localFormRef.current);
      return;
    }
    if (turnstileOn && !turnstileToken) {
      toast.error('Vérification anti-robot requise.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createBooking({
        room: room.slug,
        date: iso,
        time,
        name: values.name,
        email: values.email,
        phone: values.phone,
        players: Number(values.players),
        turnstileToken: turnstileOn ? turnstileToken : '',
      });
      const confirmed = result.booking?.status === 'confirmed' || settings.auto_confirm;
      toast.success(
        confirmed
          ? result.emailSent
            ? cal.toastConfirmeMail
            : cal.toastConfirme
          : result.emailSent
            ? cal.toastDemandeMail
            : cal.toastDemande
      );
      resetTurnstile();
      onSuccess?.(result.booking);
    } catch (err) {
      toast.error(err.message);
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...contactForm}>
      <form
        ref={setFormNode}
        id="reservation"
        onSubmit={contactForm.handleSubmit(onSubmit)}
        className="mt-5 scroll-mt-24 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
        noValidate
      >
        <p className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-primary">
          <CalendarCheck className="h-4 w-4" />
          {title || `${dateLabel} à ${time} — ${settings.occupancy_minutes} min`}
        </p>
        <FormField
          control={contactForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={cal.placeholderNom} autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={contactForm.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="email" placeholder={cal.placeholderEmail} autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={contactForm.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="tel" placeholder={cal.placeholderTel} autoComplete="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={contactForm.control}
          name="players"
          render={({ field }) => (
            <FormItem>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                {cal.joueurs}
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                >
                  {playerCounts.map((n) => (
                    <option key={n} value={n}>
                      {fillCopy(cal.prixOption, {
                        n,
                        prix_personne: formatPriceAmount(pricePerPerson(n, slotPrice)),
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-muted-foreground">{fillCopy(cal.prixAide, priceVars)}</p>
              <FormMessage />
            </FormItem>
          )}
        />
        <TurnstileField
          resetKey={`${room.slug}:${iso}:${time}:${turnstileReset}`}
          onToken={setTurnstileToken}
          onEnabled={setTurnstileOn}
        />
        <Button type="submit" disabled={submitting || turnstileOn === null || (turnstileOn === true && !turnstileToken)} className="h-11 w-full">
          {cal.bouton}
        </Button>
        <p className="text-xs text-muted-foreground">
          {fillCopy(settings.auto_confirm ? cal.noteAuto : cal.noteManuel, {
            telephone: CONTACT.phone,
          })}
        </p>
      </form>
    </Form>
  );
}
