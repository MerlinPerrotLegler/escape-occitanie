import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  Users,
  Baby,
  Timer,
  KeyRound,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  Quote,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import Seo from '@/components/Seo';
import { CONTACT, ROOMS, ROOM_LIST } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { fillCopy } from '@/lib/fillCopy';
import { cn } from '@/lib/utils';

function Difficulty({ level }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Difficulté ${level} sur 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <KeyRound
          key={i}
          className={cn('h-4 w-4', i < level ? 'text-primary' : 'text-muted-foreground/25')}
          strokeWidth={1.8}
        />
      ))}
    </div>
  );
}

function RoomPage({ roomKey }) {
  const room = ROOMS[roomKey];
  const other = ROOM_LIST.find((r) => r.slug !== room.slug);
  const labels = COPY.commun.salle;

  return (
    <>
      <Helmet>
        <title>{room.name} — Escape Occitanie</title>
        <meta name="description" content={`${room.cardDescription} ${room.players}, ${room.minAge.toLowerCase()}, ${room.duration}. Réservez votre session chez Escape Occitanie.`} />
      </Helmet>
      <Seo
        title={`${room.name} — Escape Occitanie`}
        description={room.cardDescription}
        image={room.image}
        siteName={CONTACT.name}
      />

      {/* HERO SALLE */}
      <section className="relative flex min-h-[85dvh] items-end overflow-hidden">
        <img
          src={room.image}
          alt={room.imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-36 sm:px-6">
          <Reveal>
            <Link
              to="/#salles"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {labels.toutes}
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              {room.tagline}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-black leading-tight tracking-wide sm:text-5xl">
              {room.name}
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-6 flex flex-wrap gap-2">
              {[room.players, room.minAge, room.duration].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-foreground/20 bg-background/60 px-3.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm"
                >
                  {chip}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <Link
              to={room.bookingPath}
              className="mt-8 inline-flex min-h-[52px] items-center gap-2 rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <CalendarDays className="h-5 w-5" />
              {labels.reserverSalle}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* HISTOIRE */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
          <Reveal className="lg:col-span-3">
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                {labels.histoireSurtitre}
              </p>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-wide sm:text-3xl">
                {labels.histoireTitre}
              </h2>
              <div className="mt-6 space-y-5 leading-relaxed text-muted-foreground">
                {room.story.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-8 rounded-lg border border-primary/25 bg-primary/5 p-6">
                <Quote className="h-5 w-5 text-primary/70" strokeWidth={1.8} />
                <p className="font-hand mt-3 text-2xl leading-snug text-foreground/90 sm:text-3xl">
                  {room.note}
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.15} className="lg:col-span-2">
            <aside className="rounded-xl border border-border bg-card/60 p-7">
              <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">
                {labels.infos}
              </h3>
              <ul className="mt-6 space-y-5 text-sm">
                <li className="flex items-center gap-4">
                  <Users className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <div>
                    <p className="font-semibold text-foreground">{room.players}</p>
                    <p className="text-muted-foreground">{labels.parSession}</p>
                  </div>
                </li>
                <li className="flex items-center gap-4">
                  <Baby className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <div>
                    <p className="font-semibold text-foreground">{room.minAge}</p>
                    <p className="text-muted-foreground">{labels.ageNote}</p>
                  </div>
                </li>
                <li className="flex items-center gap-4">
                  <Timer className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <div>
                    <p className="font-semibold text-foreground">{room.duration}</p>
                    <p className="text-muted-foreground">{labels.dureeNote}</p>
                  </div>
                </li>
                <li className="flex items-center gap-4">
                  <KeyRound className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <div>
                    <Difficulty level={room.difficulty} />
                    <p className="mt-1 text-muted-foreground">{labels.difficulteNote}</p>
                  </div>
                </li>
              </ul>
              <Link
                to={room.bookingPath}
                className="mt-7 flex h-12 items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <CalendarDays className="h-4 w-4" />
                {labels.voirDispo}
              </Link>
            </aside>
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-card/60 px-6 py-12 text-center sm:px-12">
            <h2 className="font-display text-2xl font-bold tracking-wide sm:text-3xl">
              {labels.ctaTitre}
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
              {labels.ctaTexte}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to={room.bookingPath}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <CalendarDays className="h-5 w-5" />
                {fillCopy(labels.reserverNomCourt, { 'nom-court': room.shortName })}
              </Link>
              <Link
                to={other.pagePath}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md border border-border px-8 text-base font-semibold text-foreground transition-all hover:border-primary/60 hover:text-primary active:scale-[0.98]"
              >
                {labels.autreSalle}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

export default RoomPage;
