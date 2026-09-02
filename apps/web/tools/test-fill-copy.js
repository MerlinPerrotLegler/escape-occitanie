import { fillCopy } from '../src/lib/fillCopy.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(fillCopy('Réserver « {nom-court} »', { 'nom-court': 'Le Directeur' }) === 'Réserver « Le Directeur »', 'hyphen key');
expect(fillCopy('Bonjour {nom}', { nom: 'Ada' }) === 'Bonjour Ada', 'simple');
expect(fillCopy('reste {inconnu}', {}) === 'reste {inconnu}', 'unknown kept');
expect(fillCopy('Salle : {salle}', { salle: 'Le Directeur' }) === 'Salle : Le Directeur', 'salle');
expect(fillCopy('', { nom: 'x' }) === '', 'empty');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
