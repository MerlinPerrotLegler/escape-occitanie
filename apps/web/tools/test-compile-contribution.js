import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileContribution } from './compile-contribution.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const MJML = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-image src="{logo}" alt="{logo_alt}" />
        <mj-image src="{image_salle}" alt="{image_salle_alt}" />
        <mj-text>Bonjour {nom}, salle {salle}.</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

function writeMinimal(dir, { localImage = false, extraPhoto = false } = {}) {
  fs.mkdirSync(path.join(dir, 'emails'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
  if (localImage) {
    fs.writeFileSync(path.join(dir, 'images', 'hero.png'), PNG);
  }
  const imageSrc = localImage
    ? 'images/hero.png'
    : 'https://images.hostinger.com/example.png';

  fs.writeFileSync(
    path.join(dir, 'contact.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<contact>
  <nom>Escape Occitanie</nom>
  <domaine>escapeoccitanie.fr</domaine>
  <site>https://escapeoccitanie.fr</site>
  <logo src="${imageSrc}" alt="Logo"/>
  <adresse>23 Bd de Verdun</adresse>
  <telephone>07 43 72 99 94</telephone>
  <telephone-href>tel:+33743729994</telephone-href>
  <email>a@b.c</email>
  <facebook>https://facebook.com/x</facebook>
  <instagram>https://instagram.com/x</instagram>
  <maps>https://maps.google.com</maps>
</contact>
`
  );

  fs.writeFileSync(
    path.join(dir, 'commun.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<commun>
  <marque>
    <ligne1>ESCAPE</ligne1>
    <ligne2>OCCITANIE</ligne2>
  </marque>
  <nav>
    <accueil>Accueil</accueil>
    <contact>Contact</contact>
    <reserver>Réserver</reserver>
    <reserver-session>Réserver une session</reserver-session>
  </nav>
  <footer>
    <intro>Intro footer</intro>
    <explorer>Explorer</explorer>
    <trouver>Nous trouver</trouver>
    <avis-records>Avis &amp; records</avis-records>
    <copyright>Escape Occitanie — Tous droits réservés.</copyright>
  </footer>
  <erreur-404>
    <code>404</code>
    <titre>Cette porte n'existe pas…</titre>
    <texte>Brume</texte>
    <bouton>Retour à l'accueil</bouton>
  </erreur-404>
  <salle>
    <toutes>Toutes les salles</toutes>
    <histoire-surtitre>L'histoire</histoire-surtitre>
    <histoire-titre>Votre mission commence ici</histoire-titre>
    <infos>Informations pratiques</infos>
    <par-session>par session</par-session>
    <age-note>accompagnés d'un adulte</age-note>
    <duree-note>pour vous échapper</duree-note>
    <difficulte-note>niveau de difficulté</difficulte-note>
    <taux-texte>des équipes parviennent à sortir à temps.</taux-texte>
    <galerie-surtitre>Galerie</galerie-surtitre>
    <galerie-titre>Un aperçu</galerie-titre>
    <cta-titre>Oserez-vous</cta-titre>
    <cta-texte>Rassemblez votre équipe</cta-texte>
    <reserver-salle>Réserver cette salle</reserver-salle>
    <decouvrir-histoire>Découvrir l'histoire</decouvrir-histoire>
    <voir-dispo>Voir les disponibilités</voir-dispo>
    <reserver-nom-court>Réserver « {nom-court} »</reserver-nom-court>
    <autre-salle>Découvrir l'autre salle</autre-salle>
    <voir-creneaux>Voir les créneaux</voir-creneaux>
    <maps>Voir sur Google Maps</maps>
  </salle>
</commun>
`
  );

  fs.writeFileSync(
    path.join(dir, 'accueil.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<accueil>
  <seo titre="Titre SEO" description="Desc helmet"/>
  <seo-og titre="Titre OG" description="Desc og"/>
  <hero>
    <surtitre>Surtitre</surtitre>
    <titre>Titre hero</titre>
    <accent>accent</accent>
    <texte>Texte hero</texte>
    <image src="${imageSrc}" alt="Hero alt"/>
    <cta-reserver>Réserver une session</cta-reserver>
    <cta-decouvrir>Découvrir l'expérience</cta-decouvrir>
    <puce>A</puce>
    <puce>B</puce>
    <puce>C</puce>
  </hero>
  <bandeau>
    <mot>Enquête</mot>
    <mot>Fouille</mot>
  </bandeau>
  <experience>
    <surtitre>L'expérience</surtitre>
    <titre>60 minutes</titre>
    <p>Para 1</p>
    <p>Para 2</p>
    <stat valeur="2" libelle="Salles"/>
    <stat valeur="60" libelle="Minutes"/>
    <stat valeur="12" libelle="Joueurs max"/>
    <atout titre="Investigation" texte="Fouillez"/>
    <atout titre="Énigmes" texte="Cadenas"/>
    <atout titre="Coopération" texte="Ensemble"/>
    <atout titre="60 minutes chrono" texte="Pression"/>
  </experience>
  <salles>
    <surtitre>Nos aventures</surtitre>
    <titre>Deux salles</titre>
    <texte>Choisissez</texte>
  </salles>
  <avis>
    <surtitre>Ils ont tenté</surtitre>
    <titre>Les survivants</titre>
  </avis>
  <records>
    <surtitre>Hall of fame</surtitre>
    <titre>Top 3</titre>
    <texte>Les équipes</texte>
  </records>
  <contact>
    <surtitre>Contact</surtitre>
    <titre>Prêt</titre>
    <texte>Une question</texte>
    <encart-titre>Chronomètre</encart-titre>
    <encart-texte>Consultez</encart-texte>
  </contact>
</accueil>
`
  );

  const photos = extraPhoto
    ? `<photo src="${imageSrc}" alt="1" legende="a"/>
    <photo src="${imageSrc}" alt="2" legende="b"/>
    <photo src="${imageSrc}" alt="3" legende="c"/>
    <photo src="${imageSrc}" alt="4" legende="d"/>`
    : `<photo src="${imageSrc}" alt="1" legende="a"/>
    <photo src="${imageSrc}" alt="2" legende="b"/>
    <photo src="${imageSrc}" alt="3" legende="c"/>`;

  for (const [file, slug, difficulte] of [
    ['directeur.xml', 'directeur', '3'],
    ['vaisseau.xml', 'vaisseau', '4'],
  ]) {
    fs.writeFileSync(
      path.join(dir, file),
      `<?xml version="1.0" encoding="UTF-8"?>
<salle slug="${slug}">
  <seo titre="${slug} titre" description="${slug} desc"/>
  <nom>Nom ${slug}</nom>
  <nom-court>Court ${slug}</nom-court>
  <accroche>Accroche</accroche>
  <joueurs>3 à 6 joueurs</joueurs>
  <age>Dès 14 ans</age>
  <duree>60 minutes</duree>
  <difficulte>${difficulte}</difficulte>
  <taux-reussite>50</taux-reussite>
  <image src="${imageSrc}" alt="Salle alt"/>
  <resume>Résumé</resume>
  <histoire>
    <p>Histoire 1</p>
    <p>Histoire 2</p>
  </histoire>
  <citation>Citation</citation>
  <galerie>
    ${photos}
  </galerie>
</salle>
`
    );
  }

  fs.writeFileSync(
    path.join(dir, 'reserver.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<reserver>
  <seo titre="Réservation — {nom}" description="Desc {nom}"/>
  <seo-og description="Og {nom}"/>
  <surtitre>Réservation</surtitre>
  <intro>Intro</intro>
  <retour>Retour à la salle</retour>
  <comment>Comment réserver ?</comment>
  <etape titre="Étape 1" texte="Texte 1"/>
  <etape titre="Étape 2" texte="Texte 2"/>
  <etape titre="Étape 3" texte="Texte 3"/>
  <contact>Nous contacter</contact>
  <calendrier>
    <jour>Lun</jour><jour>Mar</jour><jour>Mer</jour><jour>Jeu</jour>
    <jour>Ven</jour><jour>Sam</jour><jour>Dim</jour>
    <ferme>Fermé</ferme>
    <complet>Complet</complet>
    <dispo>{n} dispo</dispo>
    <indisponible>indisponible</indisponible>
    <creneaux-dispo>{n} créneaux disponibles</creneaux-dispo>
    <mois-prev>Mois précédent</mois-prev>
    <mois-next>Mois suivant</mois-next>
    <prochaine>Prochaine ouverture le {date}</prochaine>
    <choisir-jour>Sélectionnez un jour</choisir-jour>
    <creneaux-info>Créneaux {slot} / {occupancy}</creneaux-info>
    <chargement>Chargement</chargement>
    <aucun>Aucun créneau</aucun>
    <reserve>— réservé</reserve>
    <placeholder-nom>Nom</placeholder-nom>
    <placeholder-email>E-mail</placeholder-email>
    <placeholder-tel>Téléphone</placeholder-tel>
    <joueurs>Joueurs</joueurs>
    <bouton>Réserver ce créneau</bouton>
    <note-auto>Note auto {telephone}</note-auto>
    <note-manuel>Note manuel {telephone}</note-manuel>
    <toast-confirme-mail>ok mail</toast-confirme-mail>
    <toast-confirme>ok</toast-confirme>
    <toast-demande-mail>demande mail</toast-demande-mail>
    <toast-demande>demande</toast-demande>
    <done-confirme>Réservation confirmée</done-confirme>
    <done-demande>Demande envoyée</done-demande>
    <done-corps-confirme>corps confirme</done-corps-confirme>
    <done-corps-demande>corps demande</done-corps-demande>
    <done-arrive-confirme>arrive confirme</done-arrive-confirme>
    <done-arrive-attente>arrive attente</done-arrive-attente>
  </calendrier>
  <page>
    <seo titre="Réservation — Escape Occitanie" description="Comparez les deux salles et réservez 60 min."/>
    <seo-og description="Disponibilités des deux salles."/>
    <surtitre>Réservation</surtitre>
    <titre>Réservation</titre>
    <intro>Intro comparatif</intro>
  </page>
  <timeline>
    <reserver>Réserver</reserver>
    <non-dispo>Non dispo</non-dispo>
    <aria-reserver>Réserver {salle}, {date} à {heure}</aria-reserver>
    <form-titre>{date} à {heure} — {salle} — {occupancy} min</form-titre>
    <vide>Aucune date ouverte pour le moment.</vide>
    <erreur>Impossible de charger les disponibilités.</erreur>
    <reessayer>Réessayer</reessayer>
    <aucun-horaire>Aucun horaire sur ces dates.</aucun-horaire>
    <page-prev>Dates précédentes</page-prev>
    <page-next>Dates suivantes</page-next>
  </timeline>
</reserver>
`
  );

  fs.writeFileSync(
    path.join(dir, 'emails.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<emails>
  <mail id="client-attente">
    <sujet>Demande</sujet>
    <mjml>emails/client-attente.mjml</mjml>
  </mail>
  <mail id="client-confirmee">
    <sujet>Confirmation</sujet>
    <mjml>emails/client-confirmee.mjml</mjml>
  </mail>
  <mail id="manager-nouvelle">
    <sujet>Nouvelle</sujet>
    <mjml>emails/manager-nouvelle.mjml</mjml>
  </mail>
</emails>
`
  );

  for (const name of ['client-attente', 'client-confirmee', 'manager-nouvelle']) {
    fs.writeFileSync(path.join(dir, 'emails', `${name}.mjml`), MJML);
  }
}

async function withTemp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contrib-'));
  const out = {
    jsPath: path.join(dir, 'out', 'siteCopy.js'),
    jsonPath: path.join(dir, 'out', 'site-copy.json'),
    mediaDir: path.join(dir, 'out', 'media'),
  };
  try {
    await fn(dir, out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

await withTemp(async (dir, out) => {
  writeMinimal(dir);
  const copy = await compileContribution(dir, out);
  expect(copy.contact.name === 'Escape Occitanie', 'contact name');
  expect(copy.contact.phoneHref === 'tel:+33743729994', 'phone href');
  expect(copy.rooms.directeur.pagePath.includes('/salles/'), 'directeur route');
  expect(copy.rooms.vaisseau.bookingPath.includes('/reservation/'), 'vaisseau booking');
  expect(copy.rooms.directeur.gallery.length === 3, '3 photos');
  expect(copy.accueil.hero.puces.length === 3, '3 puces');
  expect(copy.accueil.experience.atouts.length === 4, '4 atouts');
  expect(copy.reserver.page.titre === 'Réservation', 'reserver page titre');
  expect(copy.reserver.timeline.nonDispo === 'Non dispo', 'timeline non dispo');
  expect(copy.emails['client-attente'].sujet === 'Demande', 'email sujet');
  expect(copy.emails['client-attente'].html.includes('{nom}'), 'html keeps placeholder');
  expect(copy.emails['client-attente'].html.includes('{logo}'), 'html keeps logo placeholder');
  expect(copy.emails['client-attente'].html.includes('{image_salle}'), 'html keeps room image placeholder');
  expect(copy.emails['client-attente'].texte.includes('{nom}'), 'texte keeps placeholder');
  expect(copy.contact.logo.startsWith('https://'), 'https image unchanged');
  expect(fs.existsSync(out.jsPath), 'wrote js');
  expect(fs.existsSync(out.jsonPath), 'wrote json');
  const js = fs.readFileSync(out.jsPath, 'utf8');
  expect(js.includes('export const CONTACT'), 'js exports CONTACT');
  expect(js.includes('export const COPY'), 'js exports COPY');
});

await withTemp(async (dir, out) => {
  writeMinimal(dir, { localImage: true });
  const copy = await compileContribution(dir, out);
  expect(copy.accueil.hero.image === '/media/hero.png', 'local image rewritten');
  expect(fs.existsSync(path.join(out.mediaDir, 'hero.png')), 'media copied');
});

await withTemp(async (dir, out) => {
  writeMinimal(dir);
  fs.unlinkSync(path.join(dir, 'contact.xml'));
  let threw = false;
  try {
    await compileContribution(dir, out);
  } catch (err) {
    threw = true;
    expect(String(err.message).includes('contact.xml'), `missing file mentions contact.xml (got ${err.message})`);
  }
  expect(threw, 'missing xml throws');
});

await withTemp(async (dir, out) => {
  writeMinimal(dir, { localImage: true });
  fs.unlinkSync(path.join(dir, 'images', 'hero.png'));
  let threw = false;
  try {
    await compileContribution(dir, out);
  } catch (err) {
    threw = true;
    expect(String(err.message).includes('hero.png'), `missing image mentions file (got ${err.message})`);
  }
  expect(threw, 'missing local image throws');
});

await withTemp(async (dir, out) => {
  writeMinimal(dir);
  fs.writeFileSync(path.join(dir, 'directeur.xml'), '<salle slug="inconnu"><nom>x</nom></salle>');
  let threw = false;
  try {
    await compileContribution(dir, out);
  } catch (err) {
    threw = true;
    expect(String(err.message).toLowerCase().includes('slug') || String(err.message).includes('inconnu'), `unknown slug (got ${err.message})`);
  }
  expect(threw, 'unknown slug throws');
});

await withTemp(async (dir, out) => {
  writeMinimal(dir, { extraPhoto: true });
  let threw = false;
  try {
    await compileContribution(dir, out);
  } catch (err) {
    threw = true;
    expect(String(err.message).toLowerCase().includes('galerie') || String(err.message).includes('3'), `gallery count (got ${err.message})`);
  }
  expect(threw, '4 photos throws');
});

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
