import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  Search,
  Puzzle,
  Users,
  Timer,
  Star,
  Trophy,
  MapPin,
  Phone,
  Mail,
  KeyRound,
  ChevronDown,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/CountUp';
import Seo from '@/components/Seo';
import { CONTACT, ROOM_LIST, REVIEWS, HERO_IMAGE } from '@/data/rooms';
import { fetchSiteContent } from '@/lib/siteContent';
import { cn } from '@/lib/utils';

const MARQUEE_WORDS = [
  'Enquête',
  'Fouille',
  'Manipulation',
  'Réflexion',
  'Coopération',
  '60 minutes chrono',
  'Adrénaline',
  'Mystère',
];

const FEATURES = [
  {
    icon: Search,
    title: 'Investigation',
    text: 'Fouillez chaque recoin du décor : aucun détail n\'est laissé au hasard.',
  },
  {
    icon: Puzzle,
    title: 'Énigmes',
    text: 'Cadenas, mécanismes et casse-tête à résoudre en chaîne pour progresser.',
  },
  {
    icon: Users,
    title: 'Coopération',
    text: 'On ne s\'évade jamais seul : communiquez, partagez, combinez vos trouvailles.',
  },
  {
    icon: Timer,
    title: '60 minutes chrono',
    text: 'L\'adrénaline monte à mesure que le temps s\'écoule. Tiendrez-vous la pression ?',
  },
];

const RANK_STYLES = [
  'border-primary/60 bg-primary/15 text-primary',
  'border-slate-300/40 bg-slate-300/10 text-slate-300',
  'border-amber-700/50 bg-amber-700/10 text-amber-600',
];

function HomePage() {
  const [reviews, setReviews] = useState(REVIEWS);
  const [recordsBySlug, setRecordsBySlug] = useState(() =>
    Object.fromEntries(ROOM_LIST.map((room) => [room.slug, room.records]))
  );

  useEffect(() => {
    let cancelled = false;
    fetchSiteContent().then((data) => {
      if (cancelled || !data) return;
      setReviews(data.reviews);
      setRecordsBySlug(data.records);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Escape Occitanie — Escape game immersif en Occitanie</title>
        <meta
          name="description"
          content="L'Escape Occitanie réouvre ses portes ! Deux salles d'escape game immersives : enquêtez dans le bureau du directeur ou brisez la malédiction du Vaisseau Fantôme. 60 minutes, 4 à 6 joueurs, dès 10 ans."
        />
      </Helmet>
      <Seo
        title="Escape Occitanie — Escape game immersif en Occitanie"
        description="Deux aventures immersives de 60 minutes : Convocation chez le Directeur et La malédiction du Vaisseau Fantôme. Réservez votre session."
        image={HERO_IMAGE}
        siteName="Escape Occitanie"
      />

      {/* HERO */}
      <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Couloir sombre d'un escape game, porte ancienne entrouverte laissant filtrer une lumière dorée"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/55 to-background" />
        <div
          className="lantern-glow absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-28 text-center sm:px-6">
          <Reveal>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.4em] text-primary sm:text-sm">
              Escape game — Occitanie
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.08] tracking-wide text-foreground sm:text-6xl lg:text-7xl">
              L'Escape Occitanie
              <br />
              <span className="relative inline-block text-primary">
                réouvre ses portes
                <svg
                  className="absolute -bottom-2 left-0 w-full text-primary/70"
                  viewBox="0 0 300 12"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 9 C 60 3, 150 2, 297 7"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{' '}
              !
            </h1>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
              Enfermés en équipe, vous avez 60 minutes pour fouiller les lieux, dénicher les
              indices, résoudre les énigmes et percer le mystère. Observation, logique et
              coopération seront vos seules clés vers la sortie.
            </p>
          </Reveal>
          <Reveal delay={0.36}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/#salles"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <CalendarDays className="h-5 w-5" />
                Réserver une session
              </Link>
              <Link
                to="/#experience"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md border border-foreground/25 px-8 text-base font-semibold text-foreground transition-all duration-200 hover:border-primary/60 hover:text-primary active:scale-[0.98]"
              >
                Découvrir l'expérience
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.48}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span>2 salles immersives</span>
              <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              <span>4 à 6 joueurs</span>
              <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              <span>Dès 10 ans</span>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-muted-foreground">
          <ChevronDown className="animate-float-slow h-6 w-6" aria-hidden="true" />
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-y border-border/60 bg-card/50 py-3.5" aria-hidden="true">
        <div className="animate-marquee flex w-max items-center gap-8">
          {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="flex items-center gap-8 font-display text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground"
            >
              {word}
              <KeyRound className="h-4 w-4 text-primary/70" strokeWidth={1.8} />
            </span>
          ))}
        </div>
      </div>

      {/* EXPÉRIENCE */}
      <section id="experience" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                L'expérience
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
                60 minutes pour résoudre l'impossible
              </h2>
              <p className="mt-6 leading-relaxed text-muted-foreground">
                Une porte se referme. Le chronomètre s'affole : 60 minutes, ni une de plus. En
                équipe de 4 à 6 joueurs, fouillez les lieux, dénichez les indices cachés, résolvez
                les énigmes et faites parler les mécanismes.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Ici, pas de force ni de hasard : seuls votre esprit d'observation, votre logique et
                votre cohésion vous permettront de sortir vainqueurs. Entre amis, en famille ou
                entre collègues, chaque session est une aventure dont vous êtes les héros.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border/60 pt-8">
                <div>
                  <p className="font-display text-3xl font-bold text-primary sm:text-4xl">
                    <CountUp value={2} />
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    Salles
                  </p>
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-primary sm:text-4xl">
                    <CountUp value={60} />
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    Minutes
                  </p>
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-primary sm:text-4xl">
                    <CountUp value={12} />
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    Joueurs max
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="flex flex-col divide-y divide-border/60">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={0.08 * i}>
                <div className="flex items-start gap-5 py-6 first:pt-0 last:pb-0">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-wider">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {feature.text}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SALLES */}
      <section id="salles" className="border-t border-border/60 bg-card/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="max-w-2xl">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                Nos aventures
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
                Deux salles, deux mondes à explorer
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Choisissez votre mission : menez l'enquête dans un collège aux secrets troublants,
                ou affrontez la malédiction d'un galion fantôme échoué dans la brume.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 flex flex-col gap-16 sm:gap-20">
            {ROOM_LIST.map((room, i) => (
              <Reveal key={room.slug} delay={0.05}>
                <article
                  className={cn(
                    'grid items-center gap-8 lg:grid-cols-2 lg:gap-12',
                    i % 2 === 1 && 'lg:[&>*:first-child]:order-2'
                  )}
                >
                  <Link
                    to={room.pagePath}
                    className="group relative block overflow-hidden rounded-xl border border-border/70"
                  >
                    <img
                      src={room.image}
                      alt={room.imageAlt}
                      loading="lazy"
                      className="aspect-[3/2] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-4 rounded-full border border-primary/40 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary backdrop-blur-sm">
                      {room.tagline}
                    </span>
                  </Link>

                  <div>
                    <h3 className="font-display text-2xl font-bold leading-snug tracking-wide sm:text-3xl">
                      {room.name}
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[room.players, room.minAge, room.duration].map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-secondary-foreground"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="mt-5 leading-relaxed text-muted-foreground">
                      {room.cardDescription}
                    </p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <Link
                        to={room.bookingPath}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                      >
                        <CalendarDays className="h-4 w-4" />
                        Réserver cette salle
                      </Link>
                      <Link
                        to={room.pagePath}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border px-6 text-sm font-semibold text-foreground transition-all hover:border-primary/60 hover:text-primary active:scale-[0.98]"
                      >
                        Découvrir l'histoire
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AVIS */}
      <section id="avis" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <div className="text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              Ils ont tenté l'aventure
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
              Les survivants témoignent
            </h2>
          </div>
        </Reveal>
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {reviews.map((review, i) => (
            <Reveal key={review.name} delay={0.1 * i}>
              <figure className="flex h-full flex-col border-l-2 border-primary/50 pl-6">
                <div
                  className="flex gap-1 text-primary"
                  aria-label={`${review.stars ?? 5} étoiles sur 5`}
                >
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={cn(
                        'h-4 w-4',
                        s < (review.stars ?? 5) ? 'fill-current' : 'text-muted-foreground'
                      )}
                      strokeWidth={s < (review.stars ?? 5) ? 0 : 1.5}
                    />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 leading-relaxed text-foreground/85">
                  « {review.text} »
                </blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="font-display font-bold tracking-wider text-foreground">
                    {review.name}
                  </span>
                  <span className="text-muted-foreground"> — {review.city}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* RECORDS */}
      <section id="records" className="border-t border-border/60 bg-card/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="text-center">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                Hall of fame
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
                Top 3 des records
              </h2>
              <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Les équipes les plus rapides de la saison. Saurez-vous faire mieux et graver votre
                nom au tableau ?
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {ROOM_LIST.map((room, i) => (
              <Reveal key={room.slug} delay={0.1 * i}>
                <div className="overflow-hidden rounded-xl border border-border bg-card/70">
                  <div className="flex items-center gap-3 border-b border-border/70 px-6 py-4">
                    <Trophy className="h-5 w-5 text-primary" strokeWidth={1.8} />
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.15em]">
                      {room.shortName}
                    </h3>
                  </div>
                  <ol className="divide-y divide-border/50">
                    {(recordsBySlug[room.slug] || room.records).map((record, rank) => (
                      <li key={record.team} className="flex items-center gap-4 px-6 py-4">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-display text-sm font-bold',
                            RANK_STYLES[rank]
                          )}
                        >
                          {rank + 1}
                        </span>
                        <span className="flex-1 font-medium text-foreground">{record.team}</span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                          {record.time}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                Contact
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
                Prêt à relever le défi ?
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Une question sur nos salles, un événement à organiser (anniversaire, enterrement de
                vie de célibataire, team building) ou une réservation à confirmer ? Notre équipe
                vous répond avec plaisir.
              </p>
              <ul className="mt-8 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <a
                    href={CONTACT.maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/85 transition-colors hover:text-primary"
                  >
                    {CONTACT.address}
                    <span className="mt-1 block text-xs font-medium text-primary">
                      Voir sur Google Maps
                    </span>
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <a
                    href={CONTACT.phoneHref}
                    className="text-foreground/85 transition-colors hover:text-primary"
                  >
                    {CONTACT.phone}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <a
                    href={`mailto:${CONTACT.email}`}
                    className="text-foreground/85 transition-colors hover:text-primary"
                  >
                    {CONTACT.email}
                  </a>
                </li>
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex h-full flex-col justify-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-card/60 p-8 sm:p-10">
              <KeyRound className="h-10 w-10 text-primary" strokeWidth={1.5} />
              <h3 className="mt-5 font-display text-2xl font-bold tracking-wide">
                Le chronomètre tourne déjà…
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Consultez les disponibilités de chaque salle et bloquez votre créneau. Les sessions
                partent vite, surtout le week-end !
              </p>
              <div className="mt-7 flex flex-col gap-3">
                {ROOM_LIST.map((room) => (
                  <Link
                    key={room.slug}
                    to={room.bookingPath}
                    className="group flex items-center justify-between rounded-lg border border-border bg-background/40 px-5 py-4 transition-all hover:border-primary/60 hover:bg-primary/5"
                  >
                    <span className="font-display text-sm font-bold tracking-wider">
                      {room.name}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                      Voir les créneaux
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export default HomePage;
