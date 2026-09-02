import {
  absoluteUrl,
  buildJsonLd,
  buildSitemap,
  injectSeo,
  listPublicPages,
  parseGeoFromMaps,
  parsePostalAddress,
} from './generate-seo-shells.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

const copy = {
  contact: {
    name: 'Escape Occitanie',
    website: 'https://escapeoccitanie.fr',
    logo: 'https://example.com/logo.jpg',
    logoAlt: 'Escape Occitanie',
    address: '23 Bd de Verdun, 12400 Saint-Affrique',
    phone: '07 43 72 99 94',
    phoneHref: 'tel:+33743729994',
    email: 'contact@escapeoccitanie.fr',
    facebook: 'https://www.facebook.com/EscapeSaintAffrique',
    instagram: 'https://www.instagram.com/escape_occitanie/',
    maps: 'https://www.google.com/maps/place/Escape+Occitanie/@43.9575602,2.8805006,575m',
  },
  rooms: {
    directeur: {
      name: 'Convocation chez le Directeur',
      pagePath: '/salles/convocation-chez-le-directeur',
      bookingPath: '/reservation/convocation-chez-le-directeur',
      image: '/media/bureau-directeur-1.png',
      seo: { titre: 'Directeur SEO', description: 'Desc directeur' },
    },
    vaisseau: {
      name: 'La malédiction du Vaisseau Fantôme',
      pagePath: '/salles/la-malediction-du-vaisseau-fantome',
      bookingPath: '/reservation/la-malediction-du-vaisseau-fantome',
      image: '/media/vaisseau-1.png',
      seo: { titre: 'Vaisseau SEO', description: 'Desc vaisseau' },
    },
  },
  accueil: {
    seo: {
      titre: 'Escape Occitanie — Escape game immersif en Occitanie',
      description: "L'Escape Occitanie réouvre ses portes !",
    },
    seoOg: {
      titre: 'OG titre',
      description: 'OG desc',
    },
    hero: {
      titre: "L'Escape Occitanie",
      accent: 'réouvre ses portes',
      texte: 'Plongé en équipe au cœur de l’aventure.',
      image: 'https://example.com/hero.png',
      imageAlt: 'Couloir sombre',
    },
  },
  reserver: {
    seo: {
      titre: 'Réservation — {nom} — Escape Occitanie',
      description: 'Réservez « {nom} ».',
    },
    page: {
      seo: {
        titre: 'Tous les créneaux — Escape Occitanie',
        description: 'Comparez les deux salles.',
      },
    },
  },
};

expect(absoluteUrl('https://escapeoccitanie.fr', '/media/x.png') === 'https://escapeoccitanie.fr/media/x.png', 'absolute relative');
expect(absoluteUrl('https://escapeoccitanie.fr/', 'https://cdn.example/x.png') === 'https://cdn.example/x.png', 'absolute already');

const geo = parseGeoFromMaps(copy.contact.maps);
expect(geo?.latitude === '43.9575602', 'geo lat');
expect(geo?.longitude === '2.8805006', 'geo lng');

const postal = parsePostalAddress(copy.contact.address);
expect(postal.streetAddress === '23 Bd de Verdun', 'street');
expect(postal.postalCode === '12400', 'postal');
expect(postal.addressLocality === 'Saint-Affrique', 'city');

const pages = listPublicPages(copy);
expect(pages[0].path === '/', 'home first');
expect(pages.some((p) => p.path === '/tous-les-creneaux'), 'tous-les-creneaux page');
expect(pages.some((p) => p.path === '/salles/convocation-chez-le-directeur'), 'room page');
expect(pages.some((p) => p.path === '/reservation/convocation-chez-le-directeur'), 'booking page');
expect(!pages.some((p) => p.path.includes('maitre')), 'admin omitted');

const jsonLd = buildJsonLd(copy);
expect(jsonLd['@type'].includes('EntertainmentBusiness'), 'jsonld type');
expect(jsonLd.name === 'Escape Occitanie', 'jsonld name');
expect(jsonLd.address.addressLocality === 'Saint-Affrique', 'jsonld city');
expect(jsonLd.hasOfferCatalog.itemListElement.length === 2, 'two rooms');

const sitemap = buildSitemap(pages, '2026-09-02');
expect(sitemap.includes('<loc>https://escapeoccitanie.fr/</loc>'), 'sitemap home');
expect(sitemap.includes('https://escapeoccitanie.fr/salles/convocation-chez-le-directeur'), 'sitemap room');
expect(sitemap.includes('https://escapeoccitanie.fr/tous-les-creneaux'), 'sitemap all slots');
expect(sitemap.includes('<lastmod>2026-09-02</lastmod>'), 'sitemap lastmod');

const injected = injectSeo(
  `<!doctype html>
<html lang="fr">
	<head>
		<meta charset="UTF-8" />
		<link rel="icon" type="image/svg+xml" href="/vite.svg" />
		<meta name="generator" content="Hostinger AI Builder" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title></title>
	</head>
	<body>
		<div id="root"></div>
	</body>
</html>`,
  {
    title: copy.accueil.seo.titre,
    description: copy.accueil.seo.description,
    canonical: 'https://escapeoccitanie.fr/',
    image: copy.accueil.hero.image,
    siteName: copy.contact.name,
    jsonLd,
    noscriptHtml: '<h1>Escape Occitanie</h1><p>Deux salles.</p>',
    fallbackHtml: '<p>Escape Occitanie — escape game à Saint-Affrique.</p>',
    preloadImage: 'https://example.com/hero.png',
  }
);

expect(!injected.includes('Hostinger AI Builder'), 'generator removed');
expect(injected.includes(`<title>${copy.accueil.seo.titre}</title>`), 'title set');
expect(injected.includes('name="description"'), 'description meta');
expect(injected.includes('rel="canonical"'), 'canonical');
expect(injected.includes('application/ld+json'), 'json-ld');
expect(injected.includes('<noscript>'), 'noscript');
expect(injected.includes('id="root"') && injected.includes('escape game à Saint-Affrique'), 'visible fallback in root');
expect(injected.includes('/favicon.ico'), 'favicon ico');
expect(injected.includes('/favicon-48x48.png'), 'favicon 48');
expect(injected.includes('/favicon-192x192.png'), 'favicon 192');
expect(injected.includes('apple-touch-icon'), 'apple touch icon');
expect(!injected.includes('/vite.svg'), 'vite icon gone');
expect(!injected.includes('/favicon.svg'), 'placeholder svg gone');
expect(injected.includes('rel="preload"') && injected.includes('https://example.com/hero.png'), 'hero preload');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
