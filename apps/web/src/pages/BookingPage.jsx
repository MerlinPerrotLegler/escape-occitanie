import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Users, Baby, Timer, Phone, Mail, MousePointerClick, Send, BadgeCheck } from 'lucide-react';
import Reveal from '@/components/Reveal';
import Seo from '@/components/Seo';
import BookingCalendar from '@/components/BookingCalendar';
import { ROOMS, CONTACT } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { fillCopy } from '@/lib/fillCopy';

const STEP_ICONS = [MousePointerClick, Send, BadgeCheck];

function BookingPage({ roomKey }) {
  const room = ROOMS[roomKey];
  const book = COPY.reserver;
  const vars = { nom: room.name };

  return (
    <>
      <Helmet>
        <title>{fillCopy(book.seo.titre, vars)}</title>
        <meta
          name="description"
          content={fillCopy(book.seo.description, vars)}
        />
      </Helmet>
      <Seo
        title={fillCopy(book.seo.titre, vars)}
        description={fillCopy(book.seoOg.description, vars)}
        image={room.image}
        siteName={CONTACT.name}
      />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <Reveal>
          <Link
            to={room.pagePath}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {book.retour}
          </Link>
          <p className="mt-6 font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            {book.surtitre}
          </p>
          <h1 className="mt-3 font-display text-3xl font-black tracking-wide sm:text-4xl">
            {room.name}
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            {book.intro}
          </p>
        </Reveal>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-3">
          <Reveal delay={0.1} className="lg:col-span-2">
            <BookingCalendar room={room} />
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex flex-col gap-6">
              <div className="overflow-hidden rounded-xl border border-border bg-card/60">
                <img
                  src={room.image}
                  alt={room.imageAlt}
                  loading="lazy"
                  className="aspect-[3/2] w-full object-cover"
                />
                <div className="flex flex-wrap gap-2 p-5">
                  {[room.players, room.minAge, room.duration].map((chip) => (
                    <span
                      key={chip}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {chip === room.players && <Users className="h-3 w-3" />}
                      {chip === room.minAge && <Baby className="h-3 w-3" />}
                      {chip === room.duration && <Timer className="h-3 w-3" />}
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-6">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">
                  {book.comment}
                </h2>
                <ol className="mt-5 space-y-5">
                  {book.etapes.map((step, i) => {
                    const Icon = STEP_ICONS[i];
                    return (
                    <li key={step.titre} className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {i + 1}. {step.titre}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {step.texte}
                        </p>
                      </div>
                    </li>
                    );
                  })}
                </ol>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">
                  {book.contact}
                </h2>
                <div className="mt-4 space-y-3 text-sm">
                  <a
                    href={CONTACT.phoneHref}
                    className="flex items-center gap-3 font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    <Phone className="h-4 w-4 text-primary" />
                    {CONTACT.phone}
                  </a>
                  <a
                    href={`mailto:${CONTACT.email}`}
                    className="flex items-center gap-3 font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    <Mail className="h-4 w-4 text-primary" />
                    {CONTACT.email}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export default BookingPage;
