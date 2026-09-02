import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const htaccess = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../public/.htaccess'),
  'utf8'
);

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

const htmlCache = htaccess.match(
  /<Files "index\.html">[\s\S]*?Header set Cache-Control "([^"]+)"/
);
expect(Boolean(htmlCache), 'index.html has Cache-Control');
expect(
  htmlCache?.[1].includes('s-maxage=0'),
  'index.html forbids Hostinger CDN HTML cache (s-maxage=0)'
);
expect(
  htmlCache?.[1].includes('max-age=0') && htmlCache?.[1].includes('must-revalidate'),
  'index.html revalidates in browsers'
);

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
