import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { htmlToText } from 'html-to-text';
import mjmlPkg from 'mjml';

const mjml2html = typeof mjmlPkg === 'function' ? mjmlPkg : mjmlPkg.default;

export const ROOM_ROUTES = {
  directeur: {
    pagePath: '/salles/convocation-chez-le-directeur',
    bookingPath: '/reservation/convocation-chez-le-directeur',
  },
  vaisseau: {
    pagePath: '/salles/la-malediction-du-vaisseau-fantome',
    bookingPath: '/reservation/la-malediction-du-vaisseau-fantome',
  },
};

const REQUIRED_FILES = [
  'contact.xml',
  'commun.xml',
  'accueil.xml',
  'directeur.xml',
  'vaisseau.xml',
  'reserver.xml',
  'emails.xml',
];

const EMAIL_IDS = ['client-attente', 'client-confirmee', 'manager-nouvelle'];

const ARRAY_TAGS = new Set([
  'p',
  'photo',
  'mot',
  'puce',
  'stat',
  'atout',
  'etape',
  'jour',
  'mail',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

export function contributionPaths(webRoot) {
  const root = webRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = path.resolve(root, '../..');
  return {
    contributionDir: path.join(repoRoot, 'contribution'),
    jsPath: path.join(root, 'src/generated/siteCopy.js'),
    jsonPath: path.join(root, 'public/api/site-copy.json'),
    mediaDir: path.join(root, 'public/media'),
  };
}

function asArray(value) {
  if (value == null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function str(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (typeof value === 'object' && value['#text'] != null) {
    return String(value['#text']).trim();
  }
  return '';
}

function reqNode(file, node, key) {
  if (!node || node[key] == null) {
    throw new Error(`${file}: balise manquante <${key}>`);
  }
  return node[key];
}

function reqStr(file, node, key) {
  const value = str(reqNode(file, node, key));
  if (!value) throw new Error(`${file}: <${key}> vide`);
  return value;
}

function parseXmlFile(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  try {
    return parser.parse(xml);
  } catch (err) {
    throw new Error(`${path.basename(filePath)}: XML invalide (${err.message})`);
  }
}

function rootOf(parsed, tag, file) {
  const node = parsed[tag];
  if (!node || typeof node !== 'object') {
    throw new Error(`${file}: racine <${tag}> absente`);
  }
  return node;
}

function parseImage(file, node, label) {
  if (!node || typeof node !== 'object') {
    throw new Error(`${file}: <${label}> manquant`);
  }
  const src = str(node.src);
  const alt = str(node.alt);
  if (!src) throw new Error(`${file}: <${label}> sans src`);
  if (!alt) throw new Error(`${file}: <${label}> sans alt`);
  return { src, alt };
}

function resolveImage(contributionDir, mediaDir, file, rawSrc) {
  if (rawSrc.startsWith('https://') || rawSrc.startsWith('http://')) {
    return rawSrc;
  }
  if (!rawSrc.startsWith('images/')) {
    throw new Error(`${file}: src d'image invalide « ${rawSrc} » (images/… ou URL)`);
  }
  const from = path.join(contributionDir, rawSrc);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
    throw new Error(`${file}: image locale absente ${rawSrc}`);
  }
  const rel = rawSrc.slice('images/'.length);
  const dest = path.join(mediaDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(from, dest);
  return `/media/${rel.split(path.sep).join('/')}`;
}

function imageField(contributionDir, mediaDir, file, node, label) {
  const parsed = parseImage(file, node, label);
  return {
    src: resolveImage(contributionDir, mediaDir, file, parsed.src),
    alt: parsed.alt,
  };
}

function parseContact(contributionDir, mediaDir, file, node) {
  const logo = imageField(contributionDir, mediaDir, file, reqNode(file, node, 'logo'), 'logo');
  return {
    name: reqStr(file, node, 'nom'),
    domain: reqStr(file, node, 'domaine'),
    website: reqStr(file, node, 'site'),
    logo: logo.src,
    logoAlt: logo.alt,
    address: reqStr(file, node, 'adresse'),
    phone: reqStr(file, node, 'telephone'),
    phoneHref: reqStr(file, node, 'telephone-href'),
    email: reqStr(file, node, 'email'),
    facebook: reqStr(file, node, 'facebook'),
    instagram: reqStr(file, node, 'instagram'),
    maps: reqStr(file, node, 'maps'),
  };
}

function parseCommun(file, node) {
  const marque = reqNode(file, node, 'marque');
  const nav = reqNode(file, node, 'nav');
  const footer = reqNode(file, node, 'footer');
  const notFound = reqNode(file, node, 'erreur-404');
  const salle = reqNode(file, node, 'salle');
  return {
    marque: {
      ligne1: reqStr(file, marque, 'ligne1'),
      ligne2: reqStr(file, marque, 'ligne2'),
    },
    nav: {
      accueil: reqStr(file, nav, 'accueil'),
      contact: reqStr(file, nav, 'contact'),
      reserver: reqStr(file, nav, 'reserver'),
      reserverSession: reqStr(file, nav, 'reserver-session'),
    },
    footer: {
      intro: reqStr(file, footer, 'intro'),
      explorer: reqStr(file, footer, 'explorer'),
      trouver: reqStr(file, footer, 'trouver'),
      avisRecords: reqStr(file, footer, 'avis-records'),
      copyright: reqStr(file, footer, 'copyright'),
    },
    notFound: {
      code: reqStr(file, notFound, 'code'),
      titre: reqStr(file, notFound, 'titre'),
      texte: reqStr(file, notFound, 'texte'),
      bouton: reqStr(file, notFound, 'bouton'),
    },
    salle: {
      toutes: reqStr(file, salle, 'toutes'),
      histoireSurtitre: reqStr(file, salle, 'histoire-surtitre'),
      histoireTitre: reqStr(file, salle, 'histoire-titre'),
      infos: reqStr(file, salle, 'infos'),
      parSession: reqStr(file, salle, 'par-session'),
      ageNote: reqStr(file, salle, 'age-note'),
      dureeNote: reqStr(file, salle, 'duree-note'),
      difficulteNote: reqStr(file, salle, 'difficulte-note'),
      tauxTexte: reqStr(file, salle, 'taux-texte'),
      galerieSurtitre: reqStr(file, salle, 'galerie-surtitre'),
      galerieTitre: reqStr(file, salle, 'galerie-titre'),
      ctaTitre: reqStr(file, salle, 'cta-titre'),
      ctaTexte: reqStr(file, salle, 'cta-texte'),
      reserverSalle: reqStr(file, salle, 'reserver-salle'),
      decouvrirHistoire: reqStr(file, salle, 'decouvrir-histoire'),
      voirDispo: reqStr(file, salle, 'voir-dispo'),
      reserverNomCourt: reqStr(file, salle, 'reserver-nom-court'),
      autreSalle: reqStr(file, salle, 'autre-salle'),
      voirCreneaux: reqStr(file, salle, 'voir-creneaux'),
      maps: reqStr(file, salle, 'maps'),
    },
  };
}

function parseAccueil(contributionDir, mediaDir, file, node) {
  const seo = reqNode(file, node, 'seo');
  const seoOg = reqNode(file, node, 'seo-og');
  const hero = reqNode(file, node, 'hero');
  const bandeau = reqNode(file, node, 'bandeau');
  const experience = reqNode(file, node, 'experience');
  const salles = reqNode(file, node, 'salles');
  const avis = reqNode(file, node, 'avis');
  const records = reqNode(file, node, 'records');
  const contact = reqNode(file, node, 'contact');
  const heroImage = imageField(contributionDir, mediaDir, file, reqNode(file, hero, 'image'), 'image');
  const puces = asArray(hero.puce).map((item) => str(item)).filter(Boolean);
  if (puces.length !== 3) throw new Error(`${file}: hero doit avoir exactement 3 <puce>`);
  const mots = asArray(bandeau.mot).map((item) => str(item)).filter(Boolean);
  if (mots.length < 1) throw new Error(`${file}: <bandeau> sans <mot>`);
  const paras = asArray(experience.p).map((item) => str(item)).filter(Boolean);
  if (paras.length < 2) throw new Error(`${file}: experience doit avoir au moins 2 <p>`);
  const stats = asArray(experience.stat);
  if (stats.length !== 3) throw new Error(`${file}: experience doit avoir exactement 3 <stat>`);
  const atouts = asArray(experience.atout);
  if (atouts.length !== 0 && atouts.length !== 4) {
    throw new Error(`${file}: experience doit avoir 0 ou 4 <atout>`);
  }
  return {
    seo: {
      titre: str(seo.titre) || reqStr(file, seo, 'titre'),
      description: str(seo.description) || reqStr(file, seo, 'description'),
    },
    seoOg: {
      titre: str(seoOg.titre) || reqStr(file, seoOg, 'titre'),
      description: str(seoOg.description) || reqStr(file, seoOg, 'description'),
    },
    hero: {
      surtitre: reqStr(file, hero, 'surtitre'),
      titre: reqStr(file, hero, 'titre'),
      accent: reqStr(file, hero, 'accent'),
      texte: reqStr(file, hero, 'texte'),
      image: heroImage.src,
      imageAlt: heroImage.alt,
      ctaReserver: reqStr(file, hero, 'cta-reserver'),
      ctaDecouvrir: reqStr(file, hero, 'cta-decouvrir'),
      puces,
    },
    bandeau: mots,
    experience: {
      surtitre: reqStr(file, experience, 'surtitre'),
      titre: reqStr(file, experience, 'titre'),
      paragraphes: paras,
      stats: stats.map((stat, i) => ({
        valeur: Number(str(stat.valeur)),
        libelle: str(stat.libelle),
        _i: i,
      })).map(({ valeur, libelle, _i }) => {
        if (!Number.isFinite(valeur) || !libelle) {
          throw new Error(`${file}: <stat> ${_i + 1} incomplet`);
        }
        return { valeur, libelle };
      }),
      atouts: atouts.map((atout, i) => {
        const titre = str(atout.titre);
        const texte = str(atout.texte);
        if (!titre || !texte) throw new Error(`${file}: <atout> ${i + 1} incomplet`);
        return { titre, texte };
      }),
    },
    salles: {
      surtitre: reqStr(file, salles, 'surtitre'),
      titre: reqStr(file, salles, 'titre'),
      texte: reqStr(file, salles, 'texte'),
    },
    avis: {
      surtitre: reqStr(file, avis, 'surtitre'),
      titre: reqStr(file, avis, 'titre'),
    },
    records: {
      surtitre: reqStr(file, records, 'surtitre'),
      titre: reqStr(file, records, 'titre'),
      texte: reqStr(file, records, 'texte'),
    },
    contact: {
      surtitre: reqStr(file, contact, 'surtitre'),
      titre: reqStr(file, contact, 'titre'),
      texte: reqStr(file, contact, 'texte'),
      encartTitre: reqStr(file, contact, 'encart-titre'),
      encartTexte: reqStr(file, contact, 'encart-texte'),
    },
  };
}

function parseSalle(contributionDir, mediaDir, file, expectedSlug, node) {
  const slug = str(node.slug);
  if (slug !== expectedSlug) {
    throw new Error(`${file}: slug « ${slug || 'vide'} » invalide (attendu ${expectedSlug})`);
  }
  const routes = ROOM_ROUTES[slug];
  if (!routes) {
    throw new Error(`${file}: slug inconnu « ${slug} »`);
  }
  const seo = reqNode(file, node, 'seo');
  const image = imageField(contributionDir, mediaDir, file, reqNode(file, node, 'image'), 'image');
  const histoire = asArray(reqNode(file, node, 'histoire').p)
    .map((item) => str(item))
    .filter(Boolean);
  if (histoire.length < 1) throw new Error(`${file}: <histoire> sans <p>`);
  const photos = asArray(reqNode(file, node, 'galerie').photo);
  if (photos.length !== 3) {
    throw new Error(`${file}: <galerie> doit contenir exactement 3 <photo>`);
  }
  const difficulty = Number(reqStr(file, node, 'difficulte'));
  const successRate = Number(reqStr(file, node, 'taux-reussite'));
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error(`${file}: <difficulte> doit être 1–5`);
  }
  if (!Number.isFinite(successRate)) {
    throw new Error(`${file}: <taux-reussite> invalide`);
  }
  return {
    slug,
    name: reqStr(file, node, 'nom'),
    shortName: reqStr(file, node, 'nom-court'),
    tagline: reqStr(file, node, 'accroche'),
    pagePath: routes.pagePath,
    bookingPath: routes.bookingPath,
    players: reqStr(file, node, 'joueurs'),
    minAge: reqStr(file, node, 'age'),
    duration: reqStr(file, node, 'duree'),
    difficulty,
    successRate,
    image: image.src,
    imageAlt: image.alt,
    cardDescription: reqStr(file, node, 'resume'),
    story: histoire,
    note: reqStr(file, node, 'citation'),
    gallery: photos.map((photo, i) => {
      const parsed = parseImage(file, photo, `photo ${i + 1}`);
      const caption = str(photo.legende);
      if (!caption) throw new Error(`${file}: <photo> ${i + 1} sans legende`);
      return {
        src: resolveImage(contributionDir, mediaDir, file, parsed.src),
        alt: parsed.alt,
        caption,
      };
    }),
    seo: {
      titre: str(seo.titre) || reqStr(file, seo, 'titre'),
      description: str(seo.description) || reqStr(file, seo, 'description'),
    },
  };
}

function parseReserver(file, node) {
  const seo = reqNode(file, node, 'seo');
  const seoOg = reqNode(file, node, 'seo-og');
  const cal = reqNode(file, node, 'calendrier');
  const page = reqNode(file, node, 'page');
  const pageSeo = reqNode(file, page, 'seo');
  const pageSeoOg = reqNode(file, page, 'seo-og');
  const timeline = reqNode(file, node, 'timeline');
  const etapes = asArray(node.etape);
  if (etapes.length !== 3) throw new Error(`${file}: exactement 3 <etape>`);
  const jours = asArray(cal.jour).map((item) => str(item)).filter(Boolean);
  if (jours.length !== 7) throw new Error(`${file}: calendrier doit avoir 7 <jour>`);
  return {
    seo: {
      titre: str(seo.titre) || reqStr(file, seo, 'titre'),
      description: str(seo.description) || reqStr(file, seo, 'description'),
    },
    seoOg: {
      description: str(seoOg.description) || reqStr(file, seoOg, 'description'),
    },
    surtitre: reqStr(file, node, 'surtitre'),
    intro: reqStr(file, node, 'intro'),
    retour: reqStr(file, node, 'retour'),
    comment: reqStr(file, node, 'comment'),
    contact: reqStr(file, node, 'contact'),
    etapes: etapes.map((etape, i) => {
      const titre = str(etape.titre);
      const texte = str(etape.texte);
      if (!titre || !texte) throw new Error(`${file}: <etape> ${i + 1} incomplet`);
      return { titre, texte };
    }),
    calendrier: {
      jours,
      ferme: reqStr(file, cal, 'ferme'),
      complet: reqStr(file, cal, 'complet'),
      dispo: reqStr(file, cal, 'dispo'),
      indisponible: reqStr(file, cal, 'indisponible'),
      creneauxDispo: reqStr(file, cal, 'creneaux-dispo'),
      moisPrev: reqStr(file, cal, 'mois-prev'),
      moisNext: reqStr(file, cal, 'mois-next'),
      prochaine: reqStr(file, cal, 'prochaine'),
      choisirJour: reqStr(file, cal, 'choisir-jour'),
      creneauxInfo: reqStr(file, cal, 'creneaux-info'),
      chargement: reqStr(file, cal, 'chargement'),
      aucun: reqStr(file, cal, 'aucun'),
      reserve: reqStr(file, cal, 'reserve'),
      placeholderNom: reqStr(file, cal, 'placeholder-nom'),
      placeholderEmail: reqStr(file, cal, 'placeholder-email'),
      placeholderTel: reqStr(file, cal, 'placeholder-tel'),
      joueurs: reqStr(file, cal, 'joueurs'),
      bouton: reqStr(file, cal, 'bouton'),
      noteAuto: reqStr(file, cal, 'note-auto'),
      noteManuel: reqStr(file, cal, 'note-manuel'),
      toastConfirmeMail: reqStr(file, cal, 'toast-confirme-mail'),
      toastConfirme: reqStr(file, cal, 'toast-confirme'),
      toastDemandeMail: reqStr(file, cal, 'toast-demande-mail'),
      toastDemande: reqStr(file, cal, 'toast-demande'),
      doneConfirme: reqStr(file, cal, 'done-confirme'),
      doneDemande: reqStr(file, cal, 'done-demande'),
      doneCorpsConfirme: reqStr(file, cal, 'done-corps-confirme'),
      doneCorpsDemande: reqStr(file, cal, 'done-corps-demande'),
      doneArriveConfirme: reqStr(file, cal, 'done-arrive-confirme'),
      doneArriveAttente: reqStr(file, cal, 'done-arrive-attente'),
    },
    page: {
      seo: {
        titre: str(pageSeo.titre) || reqStr(file, pageSeo, 'titre'),
        description: str(pageSeo.description) || reqStr(file, pageSeo, 'description'),
      },
      seoOg: {
        description: str(pageSeoOg.description) || reqStr(file, pageSeoOg, 'description'),
      },
      surtitre: reqStr(file, page, 'surtitre'),
      titre: reqStr(file, page, 'titre'),
      intro: reqStr(file, page, 'intro'),
    },
    timeline: {
      reserver: reqStr(file, timeline, 'reserver'),
      nonDispo: reqStr(file, timeline, 'non-dispo'),
      ariaReserver: reqStr(file, timeline, 'aria-reserver'),
      formTitre: reqStr(file, timeline, 'form-titre'),
      vide: reqStr(file, timeline, 'vide'),
      erreur: reqStr(file, timeline, 'erreur'),
      reessayer: reqStr(file, timeline, 'reessayer'),
      aucunHoraire: reqStr(file, timeline, 'aucun-horaire'),
      pagePrev: reqStr(file, timeline, 'page-prev'),
      pageNext: reqStr(file, timeline, 'page-next'),
    },
  };
}

async function compileMjml(file, source) {
  let result;
  try {
    result = await mjml2html(source, {
      validationLevel: 'strict',
      minify: false,
      beautify: false,
    });
  } catch (err) {
    throw new Error(`${file}: MJML invalide (${err.message})`);
  }
  if (result.errors?.length) {
    const detail = result.errors.map((item) => item.formattedMessage || item.message).join('; ');
    throw new Error(`${file}: MJML invalide (${detail})`);
  }
  if (!result.html) throw new Error(`${file}: MJML sans HTML`);
  return result.html;
}

async function parseEmails(contributionDir, file, node) {
  const mails = asArray(node.mail);
  const byId = new Map();
  for (const mail of mails) {
    const id = str(mail.id);
    if (!id) throw new Error(`${file}: <mail> sans id`);
    const sujet = str(mail.sujet);
    const mjmlRel = str(mail.mjml);
    if (!sujet) throw new Error(`${file}: mail ${id} sans <sujet>`);
    if (!mjmlRel) throw new Error(`${file}: mail ${id} sans <mjml>`);
    const mjmlPath = path.join(contributionDir, mjmlRel);
    if (!fs.existsSync(mjmlPath)) {
      throw new Error(`${file}: MJML absent ${mjmlRel}`);
    }
    const html = await compileMjml(path.basename(mjmlPath), fs.readFileSync(mjmlPath, 'utf8'));
    const texte = htmlToText(html, {
      wordwrap: 80,
      selectors: [{ selector: 'img', format: 'skip' }],
    });
    byId.set(id, { sujet, html, texte });
  }
  const emails = {};
  for (const id of EMAIL_IDS) {
    if (!byId.has(id)) throw new Error(`${file}: mail id « ${id} » manquant`);
    emails[id] = byId.get(id);
  }
  return emails;
}

function writeSiteCopyJs(jsPath, siteCopy) {
  const { contact, rooms, commun, accueil, reserver } = siteCopy;
  const body = [
    '/* generated by compile-contribution.js — do not edit */',
    `export const CONTACT = ${JSON.stringify(contact, null, 2)};`,
    `export const ROOMS = ${JSON.stringify(rooms, null, 2)};`,
    'export const ROOM_LIST = [ROOMS.directeur, ROOMS.vaisseau];',
    `export const HERO_IMAGE = ${JSON.stringify(accueil.hero.image)};`,
    `export const COPY = ${JSON.stringify({ commun, accueil, reserver }, null, 2)};`,
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(jsPath), { recursive: true });
  fs.writeFileSync(jsPath, body, 'utf8');
}

export async function compileContribution(contributionDir, { jsPath, jsonPath, mediaDir }) {
  if (!fs.existsSync(contributionDir)) {
    throw new Error(`${contributionDir}: dossier contribution absent`);
  }
  fs.mkdirSync(mediaDir, { recursive: true });
  for (const name of REQUIRED_FILES) {
    const filePath = path.join(contributionDir, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${name}: fichier manquant`);
    }
  }

  const contact = parseContact(
    contributionDir,
    mediaDir,
    'contact.xml',
    rootOf(parseXmlFile(path.join(contributionDir, 'contact.xml')), 'contact', 'contact.xml')
  );
  const commun = parseCommun(
    'commun.xml',
    rootOf(parseXmlFile(path.join(contributionDir, 'commun.xml')), 'commun', 'commun.xml')
  );
  const accueil = parseAccueil(
    contributionDir,
    mediaDir,
    'accueil.xml',
    rootOf(parseXmlFile(path.join(contributionDir, 'accueil.xml')), 'accueil', 'accueil.xml')
  );
  const directeur = parseSalle(
    contributionDir,
    mediaDir,
    'directeur.xml',
    'directeur',
    rootOf(parseXmlFile(path.join(contributionDir, 'directeur.xml')), 'salle', 'directeur.xml')
  );
  const vaisseau = parseSalle(
    contributionDir,
    mediaDir,
    'vaisseau.xml',
    'vaisseau',
    rootOf(parseXmlFile(path.join(contributionDir, 'vaisseau.xml')), 'salle', 'vaisseau.xml')
  );
  const reserver = parseReserver(
    'reserver.xml',
    rootOf(parseXmlFile(path.join(contributionDir, 'reserver.xml')), 'reserver', 'reserver.xml')
  );
  const emails = await parseEmails(
    contributionDir,
    'emails.xml',
    rootOf(parseXmlFile(path.join(contributionDir, 'emails.xml')), 'emails', 'emails.xml')
  );

  const siteCopy = {
    contact,
    rooms: { directeur, vaisseau },
    commun,
    accueil,
    reserver,
    emails,
  };

  writeSiteCopyJs(jsPath, siteCopy);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(siteCopy, null, 2)}\n`, 'utf8');
  return siteCopy;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const paths = contributionPaths();
  compileContribution(paths.contributionDir, paths)
    .then(() => {
      process.stdout.write(`compiled ${paths.contributionDir} → ${paths.jsPath}\n`);
    })
    .catch((err) => {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    });
}
