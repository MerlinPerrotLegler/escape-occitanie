# Contenu vitrine : dossier `contribution/` (XML + MJML)

Date: 2026-09-01  
Statut: validé en conversation, en attente de relecture du spec

## Problème

Tous les textes et images du site public (accueil, salles, contact, réservation, 404, e-mails) sont écrits en dur dans le React (`rooms.js`, pages, header/footer) et dans `mail.php`. Les changer impose de toucher au code. Maître Thibault ne gère que avis, records, planning et réservations.

## Objectif

Un dossier **`contribution/`** à la racine du repo est la source des textes et images de la **vitrine**. Un compile Vite (dev + build / deploy) en fait un module JS pour le front et un JSON pour PHP. Modifier un XML (ou un MJML), déployer : c’est en ligne.

**Contrainte dure : le front public ne change pas.** Mêmes composants, mêmes classes, même mise en page, mêmes URLs. Le premier seed des XML reprend les chaînes et images **actuelles** (URLs Hostinger inchangées). Pas de restyle, pas de nouvelle section, pas de 3ᵉ salle.

Les e-mails client/manager passent de texte brut à **HTML MJML**. C’est volontaire et **hors** du site web.

## Hors scope

- Éditeur dans Maître Thibault pour ces XML
- Tables SQL pour le copy vitrine
- Ajouter / supprimer une salle, changer les routes
- Textes du bureau `/maitre` (planning, résas, records — déjà en dur / SQL)
- Changer qui reçoit quel mail, ou la pièce jointe ICS
- Télécharger les images Hostinger dans git (les `src` du seed restent les URL actuelles)

## Découpage

| Contenu | Où |
|---|---|
| Accueil, salles, contact, réserver, 404, header/footer, e-mails | `contribution/` |
| Avis, hall of fame, créneaux, réservations | MySQL + Maître Thibault (inchangé) |

## Arborescence

```
contribution/
  commun.xml
  accueil.xml
  directeur.xml
  vaisseau.xml
  contact.xml
  reserver.xml
  emails.xml
  emails/
    client-attente.mjml
    client-confirmee.mjml
    manager-nouvelle.mjml
  images/          # optionnel au seed ; les XML peuvent pointer vers des URL
```

Les slugs `directeur` et `vaisseau` sont stables (fichiers + `id` XML). Les chemins d’URL (`/salles/convocation-chez-le-directeur`, etc.) restent dans `App.jsx`.

## Compile

Plugin Vite + script Node testable `apps/web/tools/compile-contribution.js`.

- Tourne au `dev` et au `build` (donc au deploy). Pas d’étape manuelle.
- En dev : watch `contribution/**` → régénère + recharge.
- `vite.config.js` : `server.fs.allow` inclut `contribution/` (racine du repo).

Sorties **générées, gitignorées** :

| Fichier | Consommateur |
|---|---|
| `apps/web/src/generated/siteCopy.js` | pages React |
| `apps/web/public/api/site-copy.json` | PHP e-mails |
| `apps/web/public/media/*` | copies des fichiers locaux référencés |

Images :

- `src` commençant par `images/` → fichier sous `contribution/`, recopié vers `/media/…`
- `src` `http://` ou `https://` → URL telle quelle (seed actuel)
- `alt` obligatoire sur toute image

XML mal formé, balise requise absente, MJML invalide, ou fichier image local manquant → **le build s’arrête** avec le chemin du fichier. Pas de site à moitié vide.

PHP : si `site-copy.json` est absent en prod, garder les phrases actuelles de `mail.php` (filet). Le build normal doit toujours embarquer le JSON.

`tools/generate-llms.js` lit le JSON compilé (titres / descriptions SEO), plus les `<title>` littéraux dans le JSX.

Dépendances de compile (dev) : `fast-xml-parser`, `mjml`, `html-to-text`.

## Front : lecture du copy

Les pages importent `@/generated/siteCopy` au lieu des chaînes locales.

`apps/web/src/data/rooms.js` ne conserve que le **filet avis / records** (fallback API). `CONTACT`, `ROOMS`, `ROOM_LIST`, `HERO_IMAGE` viennent du module généré.

Les composants gardent leur JSX. On remplace uniquement les littéraux. Exemple hero : le soulignement sur « réouvre ses portes » reste un `<span>` ; le XML fournit `titre` + `accent` séparés.

Icônes Lucide (features accueil, étapes résa) : toujours dans le code, **dans le même ordre** que les listes XML (4 features, 3 étapes). Le XML n’a que titre + texte.

Placeholders au rendu, comme les mails : `{nom-court}`, `{nom}`, `{telephone}` dans les boutons / textes partagés.

## XML des pages

Balises en français, attributs pour les champs courts, éléments pour les longs. Listes à cardinalité fixe là où le layout l’impose.

### `contact.xml`

Identité unique (header, footer, bloc contact, e-mails `{adresse}`).

- `nom`, `domaine`, `site`, `logo` (`src` + `alt`), `adresse`, `telephone`, `telephone-href`, `email`, `facebook`, `instagram`, `maps`

### `commun.xml`

- `marque` (ESCAPE / OCCITANIE comme aujourd’hui : deux morceaux)
- Nav : libellés Accueil, Contact, Réserver
- Footer : intro, titres de colonnes, copyright, lien « Avis & records »
- 404 : titre, texte, bouton
- Boutons globaux : « Toutes les salles », « Découvrir l'histoire », « Réserver cette salle », « Voir les créneaux », etc.

### `accueil.xml`

- `seo` : `titre`, `description` (les deux chaînes Helmet actuelles, distinctes de og si elles le sont déjà)
- `hero` : `surtitre`, `titre` (« L'Escape Occitanie »), `accent` (« réouvre ses portes » — c’est ce mot qui reste souligné), `texte`, `image`+`alt`, CTAs, 3 puces. Le « ! » après l’accent reste dans le JSX, comme aujourd’hui.
- `bandeau` : liste de mots (marquee)
- `experience` : surtitre, titre, **au moins 2** paragraphes, **exactement 3** stats (`valeur` + `libelle`), **0 ou 4** `atout` (titre + texte)
- Sections salles / avis / records / contact : surtitres, titres, textes d’intro (pas les avis ni les records)

### `directeur.xml` / `vaisseau.xml`

Racine `<salle slug="…">`.

- `seo`, `nom`, `nom-court`, `accroche`, `joueurs`, `age`, `duree`, `difficulte` (1–5), `taux-reussite`
- `image` + `alt` (hero salle)
- `resume` (carte accueil)
- `histoire` : un ou plusieurs `<p>`
- `citation`
- `galerie` : **exactement 3** `<photo src alt legende>`
- Textes **identiques aux deux salles** → `commun.xml` : « Toutes les salles », « L'histoire », « Votre mission commence ici », « Informations pratiques », « par session », « accompagnés d'un adulte », « pour vous échapper », « niveau de difficulté », phrase sous le taux de réussite, titres galerie, CTA « Oserez-vous franchir la porte ? » + paragraphe, « Découvrir l'autre salle », « Voir les disponibilités », « Réserver « {nom-court} » ».

### `reserver.xml`

- SEO (motif `Réservation — {nom} — …`)
- Intro de page, « Comment réserver ? », **exactement 3** étapes (titre + texte)
- Calendrier : toasts succès, écran post-envoi, « Fermé », « Complet », `{n} dispo », messages vide/chargement, placeholders Nom / E-mail / Téléphone, « Joueurs », « Réserver ce créneau », notes auto-confirm, erreurs `bookingContact.js`
- Jours `Lun`…`Dim` : dans le XML (seed identique)

Les règles de validation (longueurs, regex, libphonenumber) restent dans le code. Seuls les **messages** bougent.

## E-mails

`contribution/emails.xml` :

```xml
<emails>
  <mail id="client-attente">
    <sujet>Demande de réservation — Escape Occitanie</sujet>
    <mjml>emails/client-attente.mjml</mjml>
  </mail>
  <mail id="client-confirmee">
    <sujet>Confirmation de réservation — Escape Occitanie</sujet>
    <mjml>emails/client-confirmee.mjml</mjml>
  </mail>
  <mail id="manager-nouvelle">
    <sujet>Nouvelle demande de réservation — Escape Occitanie</sujet>
    <mjml>emails/manager-nouvelle.mjml</mjml>
  </mail>
</emails>
```

Les `id` sont figés dans PHP. Chemins MJML relatifs à `contribution/`.

Compile : MJML → HTML ; HTML → texte brut. Les `{nom}`, `{salle}`, `{date}`, `{heure}`, `{duree}`, `{joueurs}`, `{adresse}`, `{email}`, `{telephone}`, `{lien_ics}`, `{lien_google}`, `{logo}`, `{logo_alt}`, `{image_salle}`, `{image_salle_alt}` restent dans le HTML ; PHP les substitue à l’envoi. `{logo}` vient de `contact.xml` ; `{image_salle}` est le visuel de la salle réservée.

`mail.php` envoie `multipart/alternative` (texte + HTML). Confirmation : `multipart/mixed` avec ICS comme aujourd’hui. `{adresse}` vient de `contact.xml`. `{salle}` = `nom` de la salle. Sujet SMTP = `<sujet>` XML, pas `<mj-title>`.

Les MJML du seed reproduisent le **contenu** actuel des mails (mêmes phrases), en HTML.

## Erreurs

| Cas | Comportement |
|---|---|
| XML / MJML invalide, image locale absente | build / dev KO, message avec le fichier |
| Image en URL | pas de vérif réseau au compile |
| `site-copy.json` absent en PHP | filet = textes actuels de `mail.php` |
| API content down (accueil) | avis/records : `rooms.js` comme aujourd’hui ; le reste vient du bundle |

## Tests

Avant de déclarer terminé :

1. Compile des XML seed → le site local (`/`, une salle, `/reservation/…`, 404, header/footer) est visuellement le même qu’avant (textes, images Hostinger, soulignement du hero).
2. XML cassé ou photo locale manquante → `npm run build` échoue.
3. Envoi d’une résa de test : sujet XML, corps HTML + texte, ICS si confirmé ; placeholders remplis.
4. Changer une phrase dans `accueil.xml` + `npm run dev` → visible sans toucher au JSX.
5. Maître Thibault (avis, records, planning, résas) inchangé.
6. Tests Node du compile (fichier manquant, slug inconnu) + tests PHP de substitution déjà dans le style `apps/web/tools/test-*.php`.

## Fichiers touchés (orientation)

- Créer : `contribution/**`, plugin Vite, `compile-contribution.js`, gitignore des sorties
- Modifier : pages / header / footer / `BookingCalendar` / `bookingContact.js` (messages) / `mail.php` / `vite.config.js` / `generate-llms.js` / `rooms.js` (repli avis/records seulement)
- Ne pas modifier : CSS global, structure des sections, routes
