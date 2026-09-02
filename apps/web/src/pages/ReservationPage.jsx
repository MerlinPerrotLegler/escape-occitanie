import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import Seo from '@/components/Seo';
import AvailabilityTimeline from '@/components/AvailabilityTimeline';
import { CONTACT } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';

function ReservationPage() {
  const page = COPY.reserver.page;
  return (
    <>
      <Helmet>
        <title>{page.seo.titre}</title>
        <meta name="description" content={page.seo.description} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Seo
        title={page.seo.titre}
        description={page.seoOg.description}
        siteName={CONTACT.name}
      />
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <Reveal>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            {page.surtitre}
          </p>
          <h1 className="mt-3 font-display text-4xl font-black tracking-wide sm:text-5xl">
            {page.titre}
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            {page.intro}
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <AvailabilityTimeline />
        </Reveal>
      </section>
      <section className="border-t border-border/60 bg-card/30 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl font-bold tracking-wide sm:text-3xl">
              {page.rassuranceTitre}
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {page.rassuranceTexte}
            </p>
            <Link
              to="/#salles"
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              {page.rassuranceLien}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export default ReservationPage;
