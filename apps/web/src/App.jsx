import React from 'react';
import { Route, Routes, BrowserRouter as Router, Link, Outlet, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import BookingPage from './pages/BookingPage';
import MaitreThibaultPage from './pages/MaitreThibaultPage';
import { COPY } from './generated/siteCopy';

function NotFound() {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-6 pt-16 text-center">
      <p className="font-display text-7xl font-black text-primary sm:text-8xl">{COPY.commun.notFound.code}</p>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-wider">
        {COPY.commun.notFound.titre}
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {COPY.commun.notFound.texte}
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
      >
        {COPY.commun.notFound.bouton}
      </Link>
    </div>
  );
}

function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="noise-overlay" aria-hidden="true" />
      <Routes>
        <Route path="/maitre" element={<MaitreThibaultPage />} />
        <Route path="/maitre-Thibault" element={<Navigate to="/maitre" replace />} />
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/salles/convocation-chez-le-directeur"
            element={<RoomPage roomKey="directeur" />}
          />
          <Route
            path="/salles/la-malediction-du-vaisseau-fantome"
            element={<RoomPage roomKey="vaisseau" />}
          />
          <Route
            path="/reservation/convocation-chez-le-directeur"
            element={<BookingPage roomKey="directeur" />}
          />
          <Route
            path="/reservation/la-malediction-du-vaisseau-fantome"
            element={<BookingPage roomKey="vaisseau" />}
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
