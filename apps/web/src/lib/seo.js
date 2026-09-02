import { fillCopy } from './fillCopy.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function originOf(website) {
  return String(website || '').replace(/\/$/, '');
}

export function absoluteUrl(website, src) {
  if (!src) return '';
  const raw = String(src);
  if (/^https?:\/\//i.test(raw)) return raw;
  const origin = originOf(website);
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export function parseGeoFromMaps(maps) {
  const match = String(maps || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!match) return null;
  return { latitude: match[1], longitude: match[2] };
}

export function parsePostalAddress(address) {
  const match = String(address || '').match(/^(.+),\s*(\d{5})\s+(.+)$/);
  if (!match) {
    return {
      streetAddress: String(address || ''),
      postalCode: '',
      addressLocality: '',
    };
  }
  return {
    streetAddress: match[1].trim(),
    postalCode: match[2],
    addressLocality: match[3].trim(),
  };
}

export function listPublicPages(copy) {
  const origin = originOf(copy.contact.website);
  const rooms = Object.values(copy.rooms || {});
  const pages = [
    {
      path: '/',
      loc: `${origin}/`,
      title: copy.accueil.seo.titre,
      description: copy.accueil.seo.description,
      image: absoluteUrl(origin, copy.accueil.hero.image),
      priority: '1.0',
    },
    {
      path: '/tous-les-creneaux',
      loc: `${origin}/tous-les-creneaux`,
      title: copy.reserver.page.seo.titre,
      description: copy.reserver.page.seo.description,
      image: absoluteUrl(origin, copy.accueil.hero.image),
      priority: '0.85',
    },
  ];
  for (const room of rooms) {
    pages.push({
      path: room.pagePath,
      loc: `${origin}${room.pagePath}`,
      title: room.seo.titre,
      description: room.seo.description,
      image: absoluteUrl(origin, room.image),
      priority: '0.9',
    });
    pages.push({
      path: room.bookingPath,
      loc: `${origin}${room.bookingPath}`,
      title: fillCopy(copy.reserver.seo.titre, { nom: room.name }),
      description: fillCopy(copy.reserver.seo.description, { nom: room.name }),
      image: absoluteUrl(origin, room.image),
      priority: '0.8',
    });
  }
  return pages;
}

export function buildJsonLd(copy) {
  const origin = originOf(copy.contact.website);
  const contact = copy.contact;
  const postal = parsePostalAddress(contact.address);
  const geo = parseGeoFromMaps(contact.maps);
  const rooms = Object.values(copy.rooms || {});
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'EntertainmentBusiness'],
    name: contact.name,
    url: `${origin}/`,
    image: absoluteUrl(origin, contact.logo),
    logo: absoluteUrl(origin, contact.logo),
    email: contact.email,
    telephone: String(contact.phoneHref || '').replace(/^tel:/, ''),
    address: {
      '@type': 'PostalAddress',
      streetAddress: postal.streetAddress,
      postalCode: postal.postalCode,
      addressLocality: postal.addressLocality,
      addressCountry: 'FR',
    },
    sameAs: [contact.facebook, contact.instagram].filter(Boolean),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: "Salles d'escape game",
      itemListElement: rooms.map((room) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Game',
          name: room.name,
          url: `${origin}${room.pagePath}`,
          image: absoluteUrl(origin, room.image),
          description: room.seo?.description || room.cardDescription || '',
        },
      })),
    },
  };
  if (geo) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: geo.latitude,
      longitude: geo.longitude,
    };
  }
  return jsonLd;
}

export function buildSitemap(pages, lastmod) {
  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${escapeHtml(page.loc)}</loc>
    <lastmod>${escapeHtml(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${escapeHtml(page.priority || '0.5')}</priority>
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function buildNoscriptHtml(copy) {
  const rooms = Object.values(copy.rooms || {});
  const links = rooms
    .map(
      (room) =>
        `<li><a href="${escapeHtml(room.pagePath)}">${escapeHtml(room.name)}</a> — ${escapeHtml(room.seo?.description || '')}</li>`
    )
    .join('');
  return `<h1>${escapeHtml(copy.accueil.hero.titre)} ${escapeHtml(copy.accueil.hero.accent)}</h1>
<p>${escapeHtml(copy.accueil.seo.description)}</p>
<p>${escapeHtml(copy.accueil.hero.texte)}</p>
<ul>${links}</ul>
<p>${escapeHtml(copy.contact.address)} — ${escapeHtml(copy.contact.phone)}</p>`;
}

export function buildFallbackHtml(copy) {
  const city = parsePostalAddress(copy.contact.address).addressLocality || 'Saint-Affrique';
  const hero = copy.accueil?.hero?.imageWebp || copy.accueil?.hero?.image || '';
  const heroImg = hero
    ? `<img src="${escapeHtml(hero)}" alt="" width="${escapeHtml(copy.accueil?.hero?.imageWidth || 1600)}" height="${escapeHtml(copy.accueil?.hero?.imageHeight || 695)}" fetchpriority="high" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.4">`
    : '';
  return `<div style="position:relative;margin:0;min-height:100dvh;background:#120f0d;color:#f3ead8;font-family:Georgia,serif">${heroImg}<p style="position:relative;margin:0;padding:24px">${escapeHtml(copy.contact.name)} — escape game à ${escapeHtml(city)}.</p></div>`;
}

function upsertMeta(head, needle, tag) {
  if (needle.test(head)) {
    return head.replace(needle, tag);
  }
  return head.replace('</title>', `</title>\n\t\t${tag}`);
}

export function injectSeo(html, options) {
  const {
    title,
    description,
    canonical,
    image,
    siteName,
    jsonLd,
    noscriptHtml,
    fallbackHtml,
    preloadImage,
    preloadSrcSet,
  } = options;

  let out = html.replace(/<meta\s+name=["']generator["'][^>]*>\s*/i, '');
  out = out.replace(/href=["']\/vite\.svg["']/g, 'href="/favicon.svg"');
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  out = upsertMeta(
    out,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" data-react-helmet="true" content="${escapeHtml(description)}" />`
  );
  out = upsertMeta(
    out,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" data-react-helmet="true" href="${escapeHtml(canonical)}" />`
  );
  out = upsertMeta(
    out,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" data-react-helmet="true" content="${escapeHtml(title)}" />`
  );
  out = upsertMeta(
    out,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" data-react-helmet="true" content="${escapeHtml(description)}" />`
  );
  out = upsertMeta(
    out,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" data-react-helmet="true" content="${escapeHtml(canonical)}" />`
  );
  out = upsertMeta(
    out,
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" data-react-helmet="true" content="website" />`
  );
  out = upsertMeta(
    out,
    /<meta\s+property=["']og:locale["'][^>]*>/i,
    `<meta property="og:locale" data-react-helmet="true" content="fr_FR" />`
  );
  if (siteName) {
    out = upsertMeta(
      out,
      /<meta\s+property=["']og:site_name["'][^>]*>/i,
      `<meta property="og:site_name" data-react-helmet="true" content="${escapeHtml(siteName)}" />`
    );
  }
  if (image) {
    out = upsertMeta(
      out,
      /<meta\s+property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" data-react-helmet="true" content="${escapeHtml(image)}" />`
    );
  }

  if (preloadImage) {
    const srcSetAttr = preloadSrcSet ? ` imagesrcset="${escapeHtml(preloadSrcSet)}"` : '';
    const preloadTag = `<link rel="preload" as="image" href="${escapeHtml(preloadImage)}" fetchpriority="high"${srcSetAttr} imagesizes="100vw" />`;
    if (!/rel=["']preload["']/.test(out)) {
      out = out.replace('</title>', `</title>\n\t\t${preloadTag}`);
    }
  }

  const jsonLdTag = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  if (!out.includes('application/ld+json')) {
    out = out.replace('</head>', `\t\t${jsonLdTag}\n\t</head>`);
  }

  const noscript = `<noscript>${noscriptHtml}</noscript>`;
  if (!out.includes('<noscript>')) {
    out = out.replace('</body>', `\t\t${noscript}\n\t</body>`);
  }

  out = out.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${fallbackHtml}</div>`
  );

  return out;
}
