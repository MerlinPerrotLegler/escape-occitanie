const CRAWLER_RE =
  /googlebot|google-inspectiontool|googleother|bingbot|slurp|duckduckbot|baiduspider|yandex(?:bot|images)|facebookexternalhit|twitterbot|linkedinbot|embedly|whatsapp|telegrambot|applebot|ia_archiver|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider/i;

export function isCrawler(userAgent = '') {
  return CRAWLER_RE.test(String(userAgent));
}
