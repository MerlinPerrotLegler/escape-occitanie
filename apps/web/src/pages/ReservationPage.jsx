import React from 'react';
import { Helmet } from 'react-helmet';
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
      </Helmet>
      <Seo
        title={page.seo.titre}
        description={page.seoOg.description}
        siteName={CONTACT.name}
      />
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <Reveal>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            {page.surtitre}
          </p>
          <h1 className="mt-3 font-display text-3xl font-black tracking-wide sm:text-4xl">
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
    </>
  );
}

export default ReservationPage;
