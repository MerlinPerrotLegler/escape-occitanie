const url = new URL(window.location.href);
if (url.hostname === 'escapeoccitanie.fr' && !url.searchParams.has('_cdn')) {
  url.searchParams.set('_cdn', '1');
  window.location.replace(url.toString());
}
