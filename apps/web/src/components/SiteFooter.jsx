import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, CalendarDays, Facebook, Instagram } from 'lucide-react';
import { CONTACT, ROOM_LIST } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src={CONTACT.logo}
              alt={CONTACT.logoAlt}
              className="h-11 w-11 rounded-full object-cover ring-1 ring-primary/30"
            />
            <span className="font-display text-base font-bold tracking-widest">
              {COPY.commun.marque.ligne1} <span className="text-primary">{COPY.commun.marque.ligne2}</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {COPY.commun.footer.intro}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <a
              href={CONTACT.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook Escape Occitanie"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-secondary/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Facebook className="h-4 w-4" strokeWidth={1.8} />
            </a>
            <a
              href={CONTACT.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Escape Occitanie"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-secondary/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Instagram className="h-4 w-4" strokeWidth={1.8} />
            </a>
            <a
              href={CONTACT.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {CONTACT.domain}
            </a>
          </div>
        </div>

        <nav aria-label="Navigation de pied de page">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {COPY.commun.footer.explorer}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
                {COPY.commun.nav.accueil}
              </Link>
            </li>
            {ROOM_LIST.map((room) => (
              <li key={room.slug}>
                <Link
                  to={room.pagePath}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {room.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/#avis"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {COPY.commun.footer.avisRecords}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {COPY.commun.footer.trouver}
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
              <a
                href={CONTACT.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {CONTACT.address}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
              <a href={CONTACT.phoneHref} className="transition-colors hover:text-foreground">
                {CONTACT.phone}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
              <a
                href={`mailto:${CONTACT.email}`}
                className="transition-colors hover:text-foreground"
              >
                {CONTACT.email}
              </a>
            </li>
          </ul>
          <Link
            to="/reservation"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <CalendarDays className="h-4 w-4" strokeWidth={2} />
            {COPY.commun.nav.reserver}
          </Link>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {COPY.commun.footer.copyright}
      </div>
    </footer>
  );
}

export default SiteFooter;
