import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildFallbackHtml,
  buildJsonLd,
  buildNoscriptHtml,
  buildSitemap,
  injectSeo,
  listPublicPages,
} from '../src/lib/seo.js';

export {
  absoluteUrl,
  buildFallbackHtml,
  buildJsonLd,
  buildNoscriptHtml,
  buildSitemap,
  injectSeo,
  listPublicPages,
  parseGeoFromMaps,
  parsePostalAddress,
} from '../src/lib/seo.js';

export function applySeoToDist({ distDir, copy, lastmod }) {
  const pages = listPublicPages(copy);
  const home = pages[0];
  const indexPath = path.join(distDir, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const injected = injectSeo(html, {
    title: home.title,
    description: home.description,
    canonical: home.loc,
    image: home.image,
    siteName: copy.contact.name,
    jsonLd: buildJsonLd(copy),
    noscriptHtml: buildNoscriptHtml(copy),
    fallbackHtml: buildFallbackHtml(copy),
    preloadImage: copy.accueil?.hero?.imageWebp || copy.accueil?.hero?.image || home.image,
    preloadSrcSet: copy.accueil?.hero?.imageSrcSet || '',
  });
  fs.writeFileSync(indexPath, injected);
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), buildSitemap(pages, lastmod));
}

function main() {
  const webRoot = process.cwd();
  const distDir = path.resolve(webRoot, '../../dist/apps/web');
  const copyPath = path.join(webRoot, 'public/api/site-copy.json');
  const copy = JSON.parse(fs.readFileSync(copyPath, 'utf8'));
  const lastmod = new Date().toISOString().slice(0, 10);
  applySeoToDist({ distDir, copy, lastmod });
  fs.writeFileSync(path.join(webRoot, 'public/sitemap.xml'), buildSitemap(listPublicPages(copy), lastmod));
}

const isMainModule = import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  main();
}
