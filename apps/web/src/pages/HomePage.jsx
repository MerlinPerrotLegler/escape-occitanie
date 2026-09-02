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
import MediaImage from '@/components/MediaImage';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/CountUp';
import Seo from '@/components/Seo';
import RoomCards from '@/components/RoomCards';
import { CONTACT, ROOM_LIST, REVIEWS, HERO_IMAGE } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { fetchSiteContent } from '@/lib/siteContent';
import { cn } from '@/lib/utils';

const FEATURE_ICONS = [Search, Puzzle, Users, Timer];
const home = COPY.accueil;
const labels = COPY.commun;

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
        <title>{home.seo.titre}</title>
        <meta name="description" content={home.seo.description} />
        {(home.hero.imageWebp || home.hero.image) && (
          <link
            rel="preload"
            as="image"
            href={home.hero.imageWebp || home.hero.image}
            imageSrcSet={home.hero.imageSrcSet || undefined}
            imageSizes="100vw"
            fetchPriority="high"
          />
        )}
      </Helmet>
      <Seo
        title={home.seoOg.titre}
        description={home.seoOg.description}
        image={HERO_IMAGE}
        siteName={CONTACT.name}
      />

      {/* HERO */}
      <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden">
        <MediaImage
          src={home.hero.image}
          webp={home.hero.imageWebp}
          srcSet={home.hero.imageSrcSet}
          alt={home.hero.imageAlt}
          width={home.hero.imageWidth}
          height={home.hero.imageHeight}
          priority
          sizes="100vw"
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
              {home.hero.surtitre}
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.08] tracking-wide text-foreground sm:text-6xl lg:text-7xl">
              {home.hero.titre}
              <br />
              <span className="relative inline-block text-primary">
                {home.hero.accent}
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
              {home.hero.texte}
            </p>
          </Reveal>
          <Reveal delay={0.36}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/#salles"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <CalendarDays className="h-5 w-5" />
                {home.hero.ctaReserver}
              </Link>
              <Link
                to="/#experience"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md border border-foreground/25 px-8 text-base font-semibold text-foreground transition-all duration-200 hover:border-primary/60 hover:text-primary active:scale-[0.98]"
              >
                {home.hero.ctaDecouvrir}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.48}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {home.hero.puces.map((puce, i) => (
                <React.Fragment key={puce}>
                  {i > 0 ? <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" /> : null}
                  <span>{puce}</span>
                </React.Fragment>
              ))}
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
          {[...home.bandeau, ...home.bandeau].map((word, i) => (
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
      <section id="experience" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              {home.experience.surtitre}
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
              {home.experience.titre}
            </h2>
            {home.experience.paragraphes.map((para, i) => {
              const accent = /^\p{Extended_Pictographic}/u.test(para);
              return (
                <p
                  key={i}
                  className={
                    accent
                      ? 'mt-8 font-display text-lg font-semibold tracking-wide text-foreground sm:text-xl'
                      : i === 0
                        ? 'mt-6 leading-relaxed text-muted-foreground'
                        : 'mt-4 leading-relaxed text-muted-foreground'
                  }
                >
                  {para}
                </p>
              );
            })}
          </div>
        </Reveal>
        <div className="mt-12 flex justify-center border-t border-border/60 pt-8">
          <div className="grid grid-cols-3 gap-8 text-center sm:gap-16">
            {home.experience.stats.map((stat) => (
              <div key={stat.libelle}>
                <p className="font-display text-3xl font-bold text-primary sm:text-4xl">
                  <CountUp value={stat.valeur} />
                </p>
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {stat.libelle}
                </p>
              </div>
            ))}
          </div>
        </div>
        {home.experience.atouts.length > 0 ? (
          <div className="mt-4 grid sm:grid-cols-2 sm:gap-x-12">
            {home.experience.atouts.map((feature, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <Reveal key={feature.titre} delay={0.08 * i}>
                  <div className="flex items-start gap-5 border-t border-border/60 py-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold tracking-wider">
                        {feature.titre}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {feature.texte}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* SALLES */}
      <section id="salles" className="scroll-mt-24 border-t border-border/60 bg-card/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="max-w-2xl">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                {home.salles.surtitre}
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
                {home.salles.titre}
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {home.salles.texte}
              </p>
            </div>
          </Reveal>

          <div className="mt-14">
            <RoomCards />
          </div>
        </div>
      </section>

      {/* AVIS */}
      <section id="avis" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <div className="text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              {home.avis.surtitre}
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
              {home.avis.titre}
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
                {home.records.surtitre}
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
                {home.records.titre}
              </h2>
              <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
                {home.records.texte}
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
      <section id="contact" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                {home.contact.surtitre}
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">
                {home.contact.titre}
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                {home.contact.texte}
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
                      {labels.salle.maps}
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
                {home.contact.encartTitre}
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {home.contact.encartTexte}
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
                      {labels.salle.voirCreneaux}
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
