import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import MediaImage from '@/components/MediaImage';
import { ROOM_LIST } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { cn } from '@/lib/utils';

function RoomCards() {
  const labels = COPY.commun;

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      {ROOM_LIST.map((room, i) => (
        <Reveal key={room.slug} delay={0.05}>
          <article
            id={i === 0 ? 'premiere-salle' : undefined}
            className={cn(
              'grid scroll-mt-24 items-center gap-8 lg:grid-cols-2 lg:gap-12',
              i % 2 === 1 && 'lg:[&>*:first-child]:order-2'
            )}
          >
            <Link
              to={room.pagePath}
              className="group relative block overflow-hidden rounded-xl border border-border/70"
            >
              <MediaImage
                src={room.image}
                webp={room.imageWebp}
                srcSet={room.imageSrcSet}
                alt={room.imageAlt}
                width={room.imageWidth}
                height={room.imageHeight}
                sizes="(min-width: 1024px) 50vw, 100vw"
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
                  {labels.salle.reserverSalle}
                </Link>
                <Link
                  to={room.pagePath}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border px-6 text-sm font-semibold text-foreground transition-all hover:border-primary/60 hover:text-primary active:scale-[0.98]"
                >
                  {labels.salle.decouvrirHistoire}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  );
}

export default RoomCards;
