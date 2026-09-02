import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, CalendarDays } from 'lucide-react';
import { CONTACT, ROOM_LIST } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { cn } from '@/lib/utils';

const linkBase =
  'text-sm font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground';

function SiteHeader() {
  const [open, setOpen] = useState(false);

  const navItems = [
    { to: '/', label: COPY.commun.nav.accueil, end: true },
    ...ROOM_LIST.map((room) => ({ to: room.pagePath, label: room.shortName })),
    { to: '/#contact', label: COPY.commun.nav.contact, hash: true },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <img
            src={CONTACT.logo}
            alt={CONTACT.logoAlt}
            className="h-11 w-11 rounded-full object-cover shadow-[0_0_16px_hsl(var(--primary)/0.25)] ring-1 ring-primary/30 transition-transform duration-300 group-hover:scale-105 sm:h-12 sm:w-12"
          />
          <span className="font-display text-base font-bold tracking-widest text-foreground sm:text-lg">
            {COPY.commun.marque.ligne1} <span className="text-primary">{COPY.commun.marque.ligne2}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
          {navItems.map((item) =>
            item.hash ? (
              <Link key={item.label} to={item.to} className={linkBase}>
                {item.label}
              </Link>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(linkBase, isActive && 'text-primary')}
              >
                {item.label}
              </NavLink>
            )
          )}
          <Link
            to="/#salles"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <CalendarDays className="h-4 w-4" strokeWidth={2} />
            {COPY.commun.nav.reserver}
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav
          className="border-t border-border/60 bg-background/95 px-4 pb-6 pt-3 backdrop-blur-md lg:hidden"
          aria-label="Navigation mobile"
        >
          <ul className="flex flex-col divide-y divide-border/50">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[48px] items-center font-display text-sm font-semibold tracking-widest text-foreground/90"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/#salles"
            onClick={() => setOpen(false)}
            className="mt-4 flex h-12 items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98]"
          >
            <CalendarDays className="h-4 w-4" />
            {COPY.commun.nav.reserverSession}
          </Link>
        </nav>
      )}
    </header>
  );
}

export default SiteHeader;
